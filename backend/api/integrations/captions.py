"""Build the text that actually gets posted, including a tracked link."""

from __future__ import annotations

from typing import TYPE_CHECKING
from urllib.parse import urlencode

if TYPE_CHECKING:
    from ..models import ScheduledPost

LANDING_PATH = "/free-intro"


def tracked_link(post: ScheduledPost) -> str:
    """Landing-page URL tagged so website visits and sign-ups credit this post."""
    website = (post.business.website or "").strip().rstrip("/")
    if not website:
        return ""
    if not website.startswith(("http://", "https://")):
        website = f"https://{website}"
    content = post.content
    query = {
        "utm_source": post.platform.lower(),
        "utm_medium": "social",
        "utm_campaign": content.campaign.public_id if content else "marketminds",
        "utm_content": content.public_id if content else post.public_id,
    }
    return f"{website}{LANDING_PATH}?{urlencode(query)}"


def compose_caption(post: ScheduledPost) -> str:
    content = post.content
    caption = (content.caption if content else post.title).strip()
    cta = (content.cta if content else "").strip()
    if post.platform == "Instagram":
        # Links in Instagram captions are not clickable; point at the bio link instead.
        return f"{caption}\n\n{cta} - link in bio." if cta else caption
    link = tracked_link(post)
    parts = [caption]
    if cta and link:
        parts.append(f"{cta}: {link}")
    elif link:
        parts.append(link)
    return "\n\n".join(parts)
