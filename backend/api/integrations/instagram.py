"""Instagram professional accounts via Instagram Login (no Facebook Page needed)."""

from __future__ import annotations

import time
from datetime import timedelta
from urllib.parse import urlencode

from django.conf import settings
from django.utils import timezone

from .base import PostStats, Provider, ProviderError, PublishResult, Target, TokenSet, graph_request
from .captions import compose_caption

MEDIA_INSIGHT_METRICS = ["views", "reach", "likes", "comments", "saved", "shares"]
REFRESH_WHEN_LEFT = timedelta(days=7)
MIN_TOKEN_AGE = timedelta(hours=24)  # Instagram refuses to refresh tokens younger than this


class InstagramProvider(Provider):
    platform = "Instagram"
    needs_target_pick = False
    # How long to wait for Instagram to finish processing an uploaded image.
    container_poll_seconds = 2.0
    container_poll_attempts = 15

    @property
    def graph(self) -> str:
        return f"https://graph.instagram.com/{settings.META_GRAPH_VERSION}"

    def is_configured(self) -> bool:
        return bool(settings.INSTAGRAM_APP_ID and settings.INSTAGRAM_APP_SECRET)

    def authorize_url(self, state: str) -> str:
        query = {
            "client_id": settings.INSTAGRAM_APP_ID,
            "redirect_uri": self.redirect_uri(),
            "response_type": "code",
            "scope": settings.INSTAGRAM_SCOPES,
            "state": state,
        }
        return f"https://www.instagram.com/oauth/authorize?{urlencode(query)}"

    def exchange_code(self, code: str) -> TokenSet:
        short = graph_request(
            "POST",
            "https://api.instagram.com/oauth/access_token",
            data={
                "client_id": settings.INSTAGRAM_APP_ID,
                "client_secret": settings.INSTAGRAM_APP_SECRET,
                "grant_type": "authorization_code",
                "redirect_uri": self.redirect_uri(),
                "code": code.removesuffix("#_"),
            },
        )
        if isinstance(short.get("data"), list) and short["data"]:
            short = short["data"][0]
        long = graph_request(
            "GET",
            "https://graph.instagram.com/access_token",
            params={
                "grant_type": "ig_exchange_token",
                "client_secret": settings.INSTAGRAM_APP_SECRET,
                "access_token": short["access_token"],
            },
        )
        permissions = short.get("permissions") or []
        if isinstance(permissions, str):
            permissions = [p for p in permissions.split(",") if p]
        return TokenSet(
            access_token=long["access_token"],
            expires_at=timezone.now() + timedelta(seconds=int(long.get("expires_in") or 0)) if long.get("expires_in") else None,
            platform_user_id=str(short.get("user_id", "")),
            scopes=list(permissions),
        )

    def list_targets(self, user_token: str) -> list[Target]:
        me = graph_request("GET", f"{self.graph}/me", params={"fields": "user_id,username", "access_token": user_token})
        ig_id = str(me.get("user_id") or me.get("id") or "")
        if not ig_id:
            raise ProviderError("Instagram did not return an account ID.")
        username = me.get("username", "")
        return [Target(id=ig_id, name=f"@{username}" if username else ig_id, access_token=user_token)]

    def refresh_if_needed(self, account) -> bool:
        if not account.token_expires_at:
            return False
        now = timezone.now()
        if account.token_expires_at - now > REFRESH_WHEN_LEFT:
            return False
        issued = account.token_refreshed_at or account.connected_at
        if issued and now - issued < MIN_TOKEN_AGE:
            return False
        res = graph_request(
            "GET",
            "https://graph.instagram.com/refresh_access_token",
            params={"grant_type": "ig_refresh_token", "access_token": account.access_token},
        )
        account.access_token = res["access_token"]
        if res.get("expires_in"):
            account.token_expires_at = now + timedelta(seconds=int(res["expires_in"]))
        account.token_refreshed_at = now
        account.save(update_fields=["access_token_enc", "token_expires_at", "token_refreshed_at"])
        return True

    def publish(self, account, post) -> PublishResult:
        token = account.access_token
        if not token or not account.external_id:
            raise ProviderError("Instagram is not connected.", auth=True)
        media = list(post.content.media.all()) if post.content else []
        if not media:
            raise ProviderError("Instagram needs an image. Add one to this post on the Content page, then retry.")

        container = graph_request(
            "POST",
            f"{self.graph}/{account.external_id}/media",
            data={"image_url": media[0].public_url, "caption": compose_caption(post), "access_token": token},
        )
        container_id = container.get("id")
        if not container_id:
            raise ProviderError("Instagram did not accept the image.")
        self._wait_until_ready(container_id, token)

        published = graph_request(
            "POST",
            f"{self.graph}/{account.external_id}/media_publish",
            data={"creation_id": container_id, "access_token": token},
        )
        media_id = published.get("id")
        if not media_id:
            raise ProviderError("Instagram did not return a post ID.")
        permalink = ""
        try:
            permalink = graph_request(
                "GET", f"{self.graph}/{media_id}", params={"fields": "permalink", "access_token": token}
            ).get("permalink", "")
        except ProviderError:
            pass
        return PublishResult(external_id=str(media_id), permalink=permalink)

    def _wait_until_ready(self, container_id: str, token: str):
        for _ in range(self.container_poll_attempts):
            status = graph_request(
                "GET", f"{self.graph}/{container_id}", params={"fields": "status_code,status", "access_token": token}
            )
            code = status.get("status_code")
            if code in (None, "FINISHED", "PUBLISHED"):
                return
            if code in ("ERROR", "EXPIRED"):
                detail = status.get("status") or code
                raise ProviderError(
                    f"Instagram could not process the image ({detail}). Use a JPEG under 8 MB with an aspect ratio "
                    "between 4:5 and 1.91:1, and make sure PUBLIC_BASE_URL is reachable from the internet."
                )
            time.sleep(self.container_poll_seconds)
        raise ProviderError("Instagram is still processing the image. Retry in a minute.", retryable=True)

    def fetch_post_stats(self, account, external_ids: list[str]) -> list[PostStats]:
        token = account.access_token
        out: list[PostStats] = []
        for media_id in external_ids:
            values = self._insights(media_id, token)
            out.append(
                PostStats(
                    external_id=media_id,
                    views=values.get("views", 0),
                    reach=values.get("reach", 0),
                    likes=values.get("likes", 0),
                    comments=values.get("comments", 0),
                    shares=values.get("shares", 0),
                    saves=values.get("saved", 0),
                    raw=values,
                )
            )
        return out

    def _insights(self, media_id: str, token: str) -> dict[str, int]:
        def parse(body: dict) -> dict[str, int]:
            values: dict[str, int] = {}
            for row in body.get("data", []):
                points = row.get("values") or []
                value = points[0].get("value") if points else (row.get("total_value") or {}).get("value", 0)
                values[row.get("name", "")] = value if isinstance(value, int) else 0
            return values

        url = f"{self.graph}/{media_id}/insights"
        try:
            return parse(graph_request("GET", url, params={"metric": ",".join(MEDIA_INSIGHT_METRICS), "access_token": token}))
        except ProviderError as exc:
            if exc.auth:
                raise
        # Some metrics do not apply to every media type (e.g. stories); ask one at a time.
        values: dict[str, int] = {}
        for metric in MEDIA_INSIGHT_METRICS:
            try:
                values.update(parse(graph_request("GET", url, params={"metric": metric, "access_token": token})))
            except ProviderError as exc:
                if exc.auth:
                    raise
        return values
