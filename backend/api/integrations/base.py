"""Shared interface every social platform provider implements.

Views, the publisher and the metrics sync only talk to this interface, so a
new platform (LinkedIn, X) is a new module plus one line in ``registry.py``.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from typing import TYPE_CHECKING, Any

import requests

if TYPE_CHECKING:
    from ..models import ScheduledPost, SocialAccount

HTTP_TIMEOUT = 20


class ProviderError(Exception):
    """A platform call failed. ``auth`` means the user has to reconnect."""

    def __init__(self, message: str, *, auth: bool = False, retryable: bool = False, code: Any = None):
        super().__init__(message)
        self.message = message
        self.auth = auth
        self.retryable = retryable
        self.code = code


@dataclass
class TokenSet:
    access_token: str
    expires_at: datetime | None = None
    platform_user_id: str = ""
    scopes: list[str] = field(default_factory=list)


@dataclass
class Target:
    """Something we can post as: a Facebook Page or an Instagram account."""

    id: str
    name: str
    access_token: str = ""


@dataclass
class PublishResult:
    external_id: str
    permalink: str = ""


@dataclass
class PostStats:
    external_id: str
    views: int = 0
    reach: int = 0
    likes: int = 0
    comments: int = 0
    shares: int = 0
    saves: int = 0
    clicks: int = 0
    raw: dict = field(default_factory=dict)


class Provider:
    platform: str = ""
    # True when the user picks one of several targets after signing in
    # (Facebook Pages). False when the signed-in account is the target.
    needs_target_pick: bool = False

    def is_configured(self) -> bool:
        raise NotImplementedError

    def redirect_uri(self) -> str:
        from django.conf import settings

        return f"{settings.PUBLIC_BASE_URL}/api/oauth/{self.platform.lower()}/callback"

    def authorize_url(self, state: str) -> str:
        raise NotImplementedError

    def exchange_code(self, code: str) -> TokenSet:
        raise NotImplementedError

    def list_targets(self, user_token: str) -> list[Target]:
        raise NotImplementedError

    def refresh_if_needed(self, account: SocialAccount) -> bool:
        """Refresh the stored token when it is close to expiring. Returns True if refreshed."""
        return False

    def publish(self, account: SocialAccount, post: ScheduledPost) -> PublishResult:
        raise NotImplementedError

    def fetch_post_stats(self, account: SocialAccount, external_ids: list[str]) -> list[PostStats]:
        raise NotImplementedError


def graph_request(method: str, url: str, *, params: dict | None = None, data: dict | None = None) -> dict:
    """Call a Meta Graph endpoint and turn its error format into ProviderError."""
    try:
        resp = requests.request(method, url, params=params, data=data, timeout=HTTP_TIMEOUT)
    except requests.RequestException as exc:
        raise ProviderError(f"Could not reach Meta: {exc.__class__.__name__}", retryable=True) from exc
    try:
        body = resp.json()
    except ValueError:
        body = {}
    if resp.ok and not (isinstance(body, dict) and "error" in body):
        return body if isinstance(body, dict) else {"data": body}

    err = body.get("error") if isinstance(body, dict) else None
    if isinstance(err, dict):
        message = err.get("error_user_msg") or err.get("message") or "Meta returned an error."
        code = err.get("code")
        subcode = err.get("error_subcode")
        # 190 = invalid/expired token, 102 = session problem, 10/200-299 = permission missing.
        auth = code in (102, 190) or subcode in (458, 459, 460, 463, 464, 467)
        retryable = code in (1, 2, 4, 17, 32, 341, 368, 613) or resp.status_code >= 500
        raise ProviderError(message, auth=auth, retryable=retryable, code=code)
    if isinstance(body, dict) and body.get("error_message"):
        # api.instagram.com/oauth/access_token uses a flatter error shape.
        raise ProviderError(body["error_message"], code=body.get("code"))
    raise ProviderError(f"Meta returned HTTP {resp.status_code}.", retryable=resp.status_code >= 500)
