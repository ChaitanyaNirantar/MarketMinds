"""Facebook Pages via Facebook Login and the Graph API."""

from __future__ import annotations

import hashlib
import hmac
from datetime import timedelta
from urllib.parse import urlencode

from django.conf import settings
from django.utils import timezone

from .base import PostStats, Provider, ProviderError, PublishResult, Target, TokenSet, graph_request
from .captions import compose_caption

# Tried in order; Meta has been renaming Page post metrics, so missing ones are skipped.
POST_INSIGHT_METRICS = ["post_impressions", "post_media_view", "post_impressions_unique", "post_clicks"]


class FacebookProvider(Provider):
    platform = "Facebook"
    needs_target_pick = True

    @property
    def graph(self) -> str:
        return f"https://graph.facebook.com/{settings.META_GRAPH_VERSION}"

    def is_configured(self) -> bool:
        return bool(settings.FACEBOOK_APP_ID and settings.FACEBOOK_APP_SECRET)

    def _proof(self, token: str) -> str:
        # appsecret_proof proves calls come from our server, not a leaked token.
        return hmac.new(settings.FACEBOOK_APP_SECRET.encode(), token.encode(), hashlib.sha256).hexdigest()

    def _auth(self, token: str) -> dict:
        return {"access_token": token, "appsecret_proof": self._proof(token)}

    def authorize_url(self, state: str) -> str:
        query = {
            "client_id": settings.FACEBOOK_APP_ID,
            "redirect_uri": self.redirect_uri(),
            "state": state,
            "response_type": "code",
            "scope": settings.FACEBOOK_SCOPES,
        }
        return f"https://www.facebook.com/{settings.META_GRAPH_VERSION}/dialog/oauth?{urlencode(query)}"

    def exchange_code(self, code: str) -> TokenSet:
        short = graph_request(
            "GET",
            f"{self.graph}/oauth/access_token",
            params={
                "client_id": settings.FACEBOOK_APP_ID,
                "client_secret": settings.FACEBOOK_APP_SECRET,
                "redirect_uri": self.redirect_uri(),
                "code": code,
            },
        )
        # Swap for a long-lived user token so the Page tokens derived from it do not expire.
        long = graph_request(
            "GET",
            f"{self.graph}/oauth/access_token",
            params={
                "grant_type": "fb_exchange_token",
                "client_id": settings.FACEBOOK_APP_ID,
                "client_secret": settings.FACEBOOK_APP_SECRET,
                "fb_exchange_token": short["access_token"],
            },
        )
        token = long["access_token"]
        me = graph_request("GET", f"{self.graph}/me", params={"fields": "id,name", **self._auth(token)})
        perms = graph_request("GET", f"{self.graph}/me/permissions", params=self._auth(token))
        granted = [p["permission"] for p in perms.get("data", []) if p.get("status") == "granted"]
        expires_in = long.get("expires_in")
        return TokenSet(
            access_token=token,
            expires_at=timezone.now() + timedelta(seconds=int(expires_in)) if expires_in else None,
            platform_user_id=str(me.get("id", "")),
            scopes=granted,
        )

    def list_targets(self, user_token: str) -> list[Target]:
        targets: list[Target] = []
        url = f"{self.graph}/me/accounts"
        params = {"fields": "id,name,access_token,tasks", "limit": 100, **self._auth(user_token)}
        while url:
            page = graph_request("GET", url, params=params)
            for row in page.get("data", []):
                tasks = row.get("tasks") or []
                if tasks and "CREATE_CONTENT" not in tasks:
                    continue  # the user cannot post on this Page
                targets.append(Target(id=str(row["id"]), name=row.get("name", ""), access_token=row.get("access_token", "")))
            url = (page.get("paging") or {}).get("next")
            params = None  # the "next" URL already carries every parameter
        return targets

    def publish(self, account, post) -> PublishResult:
        token = account.access_token
        if not token or not account.external_id:
            raise ProviderError("Facebook is not connected to a Page.", auth=True)
        message = compose_caption(post)
        media = list(post.content.media.all()) if post.content else []
        if media:
            res = graph_request(
                "POST",
                f"{self.graph}/{account.external_id}/photos",
                data={"url": media[0].public_url, "message": message, **self._auth(token)},
            )
            post_id = res.get("post_id") or res.get("id")
        else:
            res = graph_request(
                "POST", f"{self.graph}/{account.external_id}/feed", data={"message": message, **self._auth(token)}
            )
            post_id = res.get("id")
        if not post_id:
            raise ProviderError("Facebook did not return a post ID.")
        permalink = ""
        try:
            info = graph_request("GET", f"{self.graph}/{post_id}", params={"fields": "permalink_url", **self._auth(token)})
            permalink = info.get("permalink_url", "")
        except ProviderError:
            pass  # the post is live; a missing link is not worth failing over
        return PublishResult(external_id=str(post_id), permalink=permalink)

    def fetch_post_stats(self, account, external_ids: list[str]) -> list[PostStats]:
        token = account.access_token
        out: list[PostStats] = []
        for post_id in external_ids:
            fields = graph_request(
                "GET",
                f"{self.graph}/{post_id}",
                params={
                    "fields": "shares,reactions.summary(total_count).limit(0),comments.summary(total_count).limit(0)",
                    **self._auth(token),
                },
            )
            insights = self._insights(post_id, token)
            views = insights.get("post_impressions") or insights.get("post_media_view") or 0
            out.append(
                PostStats(
                    external_id=post_id,
                    views=views,
                    reach=insights.get("post_impressions_unique", 0),
                    likes=((fields.get("reactions") or {}).get("summary") or {}).get("total_count", 0),
                    comments=((fields.get("comments") or {}).get("summary") or {}).get("total_count", 0),
                    shares=(fields.get("shares") or {}).get("count", 0),
                    clicks=insights.get("post_clicks", 0),
                    raw={"fields": fields, "insights": insights},
                )
            )
        return out

    def _insights(self, post_id: str, token: str) -> dict[str, int]:
        def parse(body: dict) -> dict[str, int]:
            values: dict[str, int] = {}
            for row in body.get("data", []):
                points = row.get("values") or []
                value = points[-1].get("value") if points else 0
                values[row.get("name", "")] = value if isinstance(value, int) else 0
            return values

        url = f"{self.graph}/{post_id}/insights"
        try:
            return parse(graph_request("GET", url, params={"metric": ",".join(POST_INSIGHT_METRICS), **self._auth(token)}))
        except ProviderError as exc:
            if exc.auth:
                raise
        # One metric was rejected: ask for each on its own and keep what works.
        values: dict[str, int] = {}
        for metric in POST_INSIGHT_METRICS:
            try:
                values.update(parse(graph_request("GET", url, params={"metric": metric, **self._auth(token)})))
            except ProviderError as exc:
                if exc.auth:
                    raise
        return values
