"""Endpoints for real platform connections (sign-in, Page picking, publishing, stats, images)."""

from __future__ import annotations

import base64
import hashlib
import hmac
import json
import secrets
from urllib.parse import urlencode

from django.conf import settings
from django.core import signing
from django.shortcuts import redirect
from django.utils import timezone
from rest_framework.decorators import api_view, parser_classes, permission_classes
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from .integrations.base import ProviderError, Target
from .integrations.registry import live_provider, normalize_platform
from .models import ContentItem, MediaAsset, ScheduledPost, SocialAccount
from .payload import current_campaign, workspace_json
from .social import publish_post, sync_business
from .views import business_of

STATE_SALT = "marketminds.oauth"
STATE_MAX_AGE = 600  # seconds the user has to finish signing in

# Without these the integration cannot do its job, so we refuse the connection.
REQUIRED_SCOPES = {
    "Facebook": {"pages_show_list", "pages_manage_posts"},
    "Instagram": {"instagram_business_basic", "instagram_business_content_publish"},
}

MAX_IMAGE_BYTES = 8 * 1024 * 1024
IMAGE_TYPES = {"image/jpeg": ".jpg", "image/png": ".png"}


def _frontend(path: str = "/schedule", **params) -> str:
    query = f"?{urlencode(params)}" if params else ""
    return f"{settings.FRONTEND_URL}{path}{query}"


def _live_or_404(platform_name: str):
    platform = normalize_platform(platform_name)
    provider = live_provider(platform) if platform else None
    return platform, provider


def _apply_target(account: SocialAccount, target: Target, *, keep_expiry: bool):
    account.external_id = target.id
    account.display_name = target.name
    account.access_token = target.access_token
    if not keep_expiry:
        account.token_expires_at = None  # Page tokens from a long-lived user token do not expire
    account.connected = True
    account.is_live = True
    account.status = SocialAccount.Status.OK
    account.last_error = ""


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def authorize(request, platform):
    platform, provider = _live_or_404(platform)
    if not provider:
        return Response({"detail": f"{platform or 'This platform'} is not set up for real sign-in on this server."}, status=400)
    b = business_of(request)
    account, _ = SocialAccount.objects.get_or_create(business=b, platform=platform)
    nonce = secrets.token_urlsafe(24)
    account.oauth_nonce = nonce
    account.save(update_fields=["oauth_nonce"])
    state = signing.dumps({"b": b.id, "p": platform, "n": nonce}, salt=STATE_SALT)
    return Response({"url": provider.authorize_url(state)})


@api_view(["GET"])
@permission_classes([AllowAny])
def oauth_callback(request, platform):
    """Meta sends the browser here after sign-in. We finish the exchange and bounce back to the app."""
    platform, provider = _live_or_404(platform)
    if not provider:
        return redirect(_frontend(error="This platform is not set up on the server."))
    try:
        state = signing.loads(request.GET.get("state", ""), salt=STATE_SALT, max_age=STATE_MAX_AGE)
    except signing.SignatureExpired:
        return redirect(_frontend(error="Sign-in took too long. Please try connecting again."))
    except signing.BadSignature:
        return redirect(_frontend(error="Sign-in could not be verified. Please try connecting again."))
    if state.get("p") != platform:
        return redirect(_frontend(error="Sign-in could not be verified. Please try connecting again."))

    account = SocialAccount.objects.filter(business_id=state.get("b"), platform=platform).first()
    if not account or not account.oauth_nonce or not hmac.compare_digest(account.oauth_nonce, state.get("n", "")):
        return redirect(_frontend(error="This sign-in link was already used. Please try connecting again."))
    account.oauth_nonce = ""
    account.save(update_fields=["oauth_nonce"])

    if request.GET.get("error"):
        reason = request.GET.get("error_description") or request.GET.get("error_reason") or "Sign-in was cancelled."
        return redirect(_frontend(error=reason.replace("+", " ")))
    code = request.GET.get("code")
    if not code:
        return redirect(_frontend(error="Sign-in did not return a code."))

    try:
        tokens = provider.exchange_code(code)
        missing = REQUIRED_SCOPES.get(platform, set()) - set(tokens.scopes) if tokens.scopes else set()
        if missing:
            return redirect(
                _frontend(error=f"{platform} permissions were not granted: {', '.join(sorted(missing))}. Connect again and allow them.")
            )
        account.user_token = tokens.access_token
        account.platform_user_id = tokens.platform_user_id
        account.scopes = tokens.scopes
        account.token_expires_at = tokens.expires_at
        account.connected_at = timezone.now()
        account.token_refreshed_at = None
        account.is_live = True
        targets = provider.list_targets(tokens.access_token)
    except ProviderError as exc:
        return redirect(_frontend(error=f"{platform}: {exc.message}"))

    if not targets:
        account.clear_credentials()
        account.save()
        hint = "No Facebook Pages found that you can post to." if platform == "Facebook" else "No Instagram account found."
        return redirect(_frontend(error=hint))
    if provider.needs_target_pick and len(targets) > 1:
        account.connected = False
        account.status = SocialAccount.Status.NEEDS_TARGET
        account.save()
        return redirect(_frontend(pick=platform))

    _apply_target(account, targets[0], keep_expiry=not provider.needs_target_pick)
    account.save()
    return redirect(_frontend(connected=platform))


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def list_targets(request, platform):
    platform, provider = _live_or_404(platform)
    if not provider:
        return Response({"detail": "Not available."}, status=400)
    account = SocialAccount.objects.filter(business=business_of(request), platform=platform).first()
    if not account or not account.user_token:
        return Response({"detail": f"Sign in to {platform} first."}, status=400)
    try:
        targets = provider.list_targets(account.user_token)
    except ProviderError as exc:
        return Response({"detail": exc.message}, status=400 if not exc.auth else 401)
    # Never send Page tokens to the browser.
    return Response([{"id": t.id, "name": t.name} for t in targets])


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def select_target(request, platform):
    platform, provider = _live_or_404(platform)
    if not provider:
        return Response({"detail": "Not available."}, status=400)
    b = business_of(request)
    account = SocialAccount.objects.filter(business=b, platform=platform).first()
    if not account or not account.user_token:
        return Response({"detail": f"Sign in to {platform} first."}, status=400)
    wanted = str(request.data.get("id") or "")
    try:
        target = next((t for t in provider.list_targets(account.user_token) if t.id == wanted), None)
    except ProviderError as exc:
        return Response({"detail": exc.message}, status=400)
    if not target:
        return Response({"detail": "That Page is not available to this account."}, status=400)
    _apply_target(account, target, keep_expiry=not provider.needs_target_pick)
    account.save()
    return Response(workspace_json(b))


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def disconnect(request, platform):
    platform = normalize_platform(platform)
    b = business_of(request)
    account = SocialAccount.objects.filter(business=b, platform=platform).first()
    if account:
        account.clear_credentials()
        account.save()
    return Response(workspace_json(b))


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def publish_now(request, post_id):
    b = business_of(request)
    post = ScheduledPost.objects.filter(business=b, public_id=post_id).select_related("content").first()
    if not post:
        return Response({"detail": "Post not found."}, status=404)
    if post.status == "Published":
        return Response({"detail": "Already published."}, status=400)
    publish_post(post)
    payload = workspace_json(b)
    payload["published"] = post.status == "Published"
    payload["error"] = post.error or None
    return Response(payload)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def sync_results(request):
    b = business_of(request)
    summary = sync_business(b)
    payload = workspace_json(b)
    payload["sync"] = summary
    return Response(payload)


@api_view(["POST", "DELETE"])
@permission_classes([IsAuthenticated])
@parser_classes([MultiPartParser, FormParser])
def content_media(request, content_id):
    b = business_of(request)
    campaign = current_campaign(b)
    item = ContentItem.objects.filter(campaign=campaign, public_id=content_id).first() if campaign else None
    if not item:
        return Response({"detail": "Content not found."}, status=404)
    if request.method == "DELETE":
        for asset in item.media.all():
            asset.file.delete(save=False)
            asset.delete()
        return Response(workspace_json(b))

    upload = request.FILES.get("file")
    if not upload:
        return Response({"detail": "Choose an image to upload."}, status=400)
    if upload.content_type not in IMAGE_TYPES:
        return Response({"detail": "Use a JPEG or PNG image. Instagram only accepts JPEG."}, status=400)
    if upload.size > MAX_IMAGE_BYTES:
        return Response({"detail": "Images must be 8 MB or smaller."}, status=400)
    # One image per post for now: replace whatever was there.
    for asset in item.media.all():
        asset.file.delete(save=False)
        asset.delete()
    upload.name = f"{item.public_id}-{secrets.token_hex(6)}{IMAGE_TYPES[upload.content_type]}"
    MediaAsset.objects.create(content=item, file=upload)
    return Response(workspace_json(b), status=201)


# --- Meta app callbacks (required for App Review) -----------------------------


def _parse_signed_request(signed_request: str) -> dict | None:
    """Verify a Meta signed_request with whichever app secret signed it."""
    try:
        sig_b64, payload_b64 = signed_request.split(".", 1)
        pad = lambda s: s + "=" * (-len(s) % 4)  # noqa: E731
        sig = base64.urlsafe_b64decode(pad(sig_b64))
        payload = json.loads(base64.urlsafe_b64decode(pad(payload_b64)))
    except (ValueError, json.JSONDecodeError):
        return None
    for secret in (settings.FACEBOOK_APP_SECRET, settings.INSTAGRAM_APP_SECRET):
        if secret and hmac.compare_digest(sig, hmac.new(secret.encode(), payload_b64.encode(), hashlib.sha256).digest()):
            return payload
    return None


def _forget_user(user_id: str) -> int:
    count = 0
    for account in SocialAccount.objects.filter(platform_user_id=str(user_id)):
        account.clear_credentials()
        account.save()
        count += 1
    return count


@api_view(["POST"])
@permission_classes([AllowAny])
def meta_deauthorize(request):
    payload = _parse_signed_request(request.data.get("signed_request", ""))
    if not payload or not payload.get("user_id"):
        return Response({"detail": "Invalid signed_request."}, status=400)
    _forget_user(payload["user_id"])
    return Response({"ok": True})


@api_view(["POST"])
@permission_classes([AllowAny])
def meta_data_deletion(request):
    payload = _parse_signed_request(request.data.get("signed_request", ""))
    if not payload or not payload.get("user_id"):
        return Response({"detail": "Invalid signed_request."}, status=400)
    _forget_user(payload["user_id"])
    code = secrets.token_hex(8)
    return Response({"url": _frontend("/login", deletion=code), "confirmation_code": code})
