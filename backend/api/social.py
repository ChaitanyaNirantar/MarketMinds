"""Publishing scheduled posts and pulling their numbers back from the platforms."""

from __future__ import annotations

import logging
from datetime import date, datetime, timedelta

from django.conf import settings
from django.db.models import Max
from django.utils import timezone

from .integrations.base import ProviderError
from .integrations.registry import live_provider
from .models import Business, ChannelResult, PostMetric, ScheduledPost, SocialAccount

log = logging.getLogger(__name__)

# The Schedule screen shows one fixed week; day 0 is this date.
SCHEDULE_WEEK_START = date(2026, 11, 2)
_WEEK = [SCHEDULE_WEEK_START + timedelta(days=i) for i in range(7)]
DAYS = [f"{d:%b} {d.day}" for d in _WEEK]  # "Nov 2" ... "Nov 8"


def scheduled_at_for(day: int, time_label: str) -> datetime:
    """Turn the Schedule screen's (day index, "9:00 AM") into a real timestamp."""
    day = max(0, min(6, int(day)))
    t = datetime.strptime(time_label.strip(), "%I:%M %p").time()
    return timezone.make_aware(datetime.combine(SCHEDULE_WEEK_START + timedelta(days=day), t))


def account_for(post: ScheduledPost) -> SocialAccount | None:
    return SocialAccount.objects.filter(business_id=post.business_id, platform=post.platform).first()


def is_live(account: SocialAccount | None) -> bool:
    return bool(account and account.is_live and account.connected and live_provider(account.platform))


def mark_auth_failure(account: SocialAccount, message: str):
    account.connected = False
    account.status = SocialAccount.Status.EXPIRED
    account.last_error = message
    account.save(update_fields=["connected", "status", "last_error"])


def publish_post(post: ScheduledPost, *, now: datetime | None = None) -> ScheduledPost:
    """Send one post to its platform. Records success or failure on the post; never raises ProviderError."""
    now = now or timezone.now()
    account = account_for(post)
    post.attempts += 1
    post.last_attempt_at = now
    if not is_live(account):
        post.status = "Failed"
        post.error = f"Connect a real {post.platform} account first."
        post.save()
        return post
    provider = live_provider(post.platform)
    try:
        provider.refresh_if_needed(account)
        result = provider.publish(account, post)
    except ProviderError as exc:
        post.status = "Failed"
        if exc.auth:
            mark_auth_failure(account, exc.message)
            post.error = f"Token expired. Reconnect {post.platform}, then retry."
        else:
            post.error = exc.message
        log.warning("Publishing %s to %s failed: %s", post.public_id, post.platform, exc.message)
        post.save()
        return post
    post.status = "Published"
    post.error = ""
    post.external_id = result.external_id
    post.permalink = result.permalink
    post.published_at = now
    post.save()
    return post


def publish_due_posts(now: datetime | None = None) -> dict[str, int]:
    """Publish every scheduled post whose time has come. Safe to run every minute."""
    now = now or timezone.now()
    max_late = timedelta(minutes=settings.PUBLISH_MAX_LATENESS_MINUTES)
    counts = {"published": 0, "failed": 0, "missed": 0, "skipped": 0}
    due = ScheduledPost.objects.filter(status="Scheduled", scheduled_at__lte=now, external_id="").select_related(
        "content", "business"
    )
    for post in due:
        if not is_live(account_for(post)):
            counts["skipped"] += 1  # demo account: nothing real to publish to
            continue
        # Claim the post so two overlapping runs never publish it twice.
        if not ScheduledPost.objects.filter(pk=post.pk, status="Scheduled").update(status="Publishing"):
            continue
        if now - post.scheduled_at > max_late:
            post.status = "Failed"
            post.error = "Missed its time slot, so it was not posted late. Click Retry to publish it now."
            post.save(update_fields=["status", "error"])
            counts["missed"] += 1
            continue
        publish_post(post, now=now)
        counts["published" if post.status == "Published" else "failed"] += 1
    return counts


def sync_account(account: SocialAccount) -> int:
    """Pull fresh numbers for every published post on this account. Returns posts updated."""
    provider = live_provider(account.platform)
    if not provider or not is_live(account):
        return 0
    posts = {
        p.external_id: p
        for p in ScheduledPost.objects.filter(
            business_id=account.business_id, platform=account.platform, status="Published"
        ).exclude(external_id="")
    }
    if not posts:
        account.last_synced_at = timezone.now()
        account.save(update_fields=["last_synced_at"])
        return 0
    try:
        provider.refresh_if_needed(account)
        stats = provider.fetch_post_stats(account, list(posts))
    except ProviderError as exc:
        if exc.auth:
            mark_auth_failure(account, exc.message)
        raise
    PostMetric.objects.bulk_create(
        [
            PostMetric(
                post=posts[s.external_id],
                views=s.views,
                reach=s.reach,
                likes=s.likes,
                comments=s.comments,
                shares=s.shares,
                saves=s.saves,
                clicks=s.clicks,
                raw=s.raw,
            )
            for s in stats
            if s.external_id in posts
        ]
    )
    account.last_synced_at = timezone.now()
    account.save(update_fields=["last_synced_at"])
    return len(stats)


def rollup_results(business: Business) -> int:
    """Total each campaign's latest post numbers per channel into ChannelResult rows marked Connected.

    Leads and members are left alone: platforms do not know who joined the gym.
    """
    updated = 0
    for campaign in business.campaigns.all():
        posts = ScheduledPost.objects.filter(business=business, content__campaign=campaign).exclude(external_id="")
        for platform in posts.values_list("platform", flat=True).distinct():
            latest_ids = (
                PostMetric.objects.filter(post__in=posts.filter(platform=platform))
                .values("post")
                .annotate(last=Max("id"))
                .values_list("last", flat=True)
            )
            metrics = list(PostMetric.objects.filter(id__in=list(latest_ids)))
            if not metrics:
                continue
            row, _ = ChannelResult.objects.get_or_create(campaign=campaign, channel=platform)
            row.impressions = sum(m.views for m in metrics)
            row.clicks = sum(m.clicks for m in metrics)
            row.source = "Connected"
            row.save()
            updated += 1
    return updated


def sync_business(business: Business) -> dict[str, str]:
    """Sync every live account, then refresh the campaign totals. Returns a per-platform summary."""
    summary: dict[str, str] = {}
    for account in business.accounts.all():
        if not is_live(account):
            continue
        try:
            n = sync_account(account)
            summary[account.platform] = f"{n} post{'s' if n != 1 else ''} updated"
        except ProviderError as exc:
            summary[account.platform] = f"Failed: {exc.message}"
    rollup_results(business)
    return summary
