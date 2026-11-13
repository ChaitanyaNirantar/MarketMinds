"""The one list of platforms the app knows about."""

from __future__ import annotations

from .base import Provider
from .facebook import FacebookProvider
from .instagram import InstagramProvider

# Order is the order the UI shows them in.
PLATFORMS = ["Instagram", "Facebook", "LinkedIn"]

_PROVIDERS: dict[str, Provider] = {
    "Facebook": FacebookProvider(),
    "Instagram": InstagramProvider(),
}


def normalize_platform(name: str) -> str | None:
    for p in PLATFORMS:
        if p.lower() == (name or "").lower():
            return p
    return None


def get_provider(platform: str) -> Provider | None:
    """The provider for a platform, or None if it has no real integration yet."""
    return _PROVIDERS.get(platform)


def live_provider(platform: str) -> Provider | None:
    """The provider only if its app credentials are configured."""
    provider = get_provider(platform)
    return provider if provider and provider.is_configured() else None
