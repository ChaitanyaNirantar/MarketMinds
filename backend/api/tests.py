"""Tests for the Facebook / Instagram integration. Meta's API is faked; nothing goes over the network."""

import base64
import hashlib
import hmac
import json
import shutil
import tempfile
from datetime import timedelta
from unittest import mock
from urllib.parse import parse_qs, urlparse

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.authtoken.models import Token
from rest_framework.test import APIClient

from .integrations.base import ProviderError
from .integrations.captions import compose_caption
from .integrations.crypto import decrypt, encrypt
from .models import ChannelResult, ContentItem, MediaAsset, PostMetric, ScheduledPost, SocialAccount
from .seed import seed_demo
from .social import publish_due_posts, publish_post, sync_business

TMP_MEDIA = tempfile.mkdtemp(prefix="mm-media-")

META = dict(
    FACEBOOK_APP_ID="fb-app",
    FACEBOOK_APP_SECRET="fb-secret",
    INSTAGRAM_APP_ID="ig-app",
    INSTAGRAM_APP_SECRET="ig-secret",
    PUBLIC_BASE_URL="https://mm.example.test",
    FRONTEND_URL="http://localhost:5173",
    META_GRAPH_VERSION="v24.0",
    MEDIA_ROOT=TMP_MEDIA,
    TOKEN_ENCRYPTION_KEY="EkspdpjNFY41tUgKi-NulYC8nmOGXUDHJYB_IdAmFa4=",
)


class FakeGraph:
    """Answers graph_request calls from a list of (method, url substring, response) rules."""

    def __init__(self, rules):
        self.rules = rules
        self.calls = []

    def __call__(self, method, url, *, params=None, data=None):
        self.calls.append((method, url, params or {}, data or {}))
        for rule_method, needle, response in self.rules:
            if rule_method == method and needle in url:
                if isinstance(response, Exception):
                    raise response
                return response(params or {}, data or {}) if callable(response) else response
        raise AssertionError(f"Unexpected Meta call: {method} {url}")


class _PatchBoth:
    """Swap the Graph API client in both providers for a FakeGraph."""

    def __init__(self, fake):
        self.patches = [
            mock.patch("api.integrations.facebook.graph_request", fake),
            mock.patch("api.integrations.instagram.graph_request", fake),
        ]

    def __enter__(self):
        for p in self.patches:
            p.start()

    def __exit__(self, *exc):
        for p in self.patches:
            p.stop()


@override_settings(**META)
class MetaTestCase(TestCase):
    @classmethod
    def tearDownClass(cls):
        super().tearDownClass()
        shutil.rmtree(TMP_MEDIA, ignore_errors=True)

    def setUp(self):
        self.user = seed_demo(reset=True)
        self.business = self.user.business
        self.client = APIClient()
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {Token.objects.get(user=self.user).key}")
        self.campaign = self.business.campaigns.get(is_current=True)

    def live_account(self, platform, external_id="123", token="page-token", **extra):
        account = SocialAccount.objects.get(business=self.business, platform=platform)
        account.connected = True
        account.is_live = True
        account.external_id = external_id
        account.display_name = extra.pop("name", "Iron Peak Fitness")
        account.access_token = token
        account.connected_at = timezone.now()
        for k, v in extra.items():
            setattr(account, k, v)
        account.save()
        return account

    def make_post(self, platform, content_id="c3", **kw):
        content = ContentItem.objects.get(campaign=self.campaign, public_id=content_id)
        defaults = dict(
            business=self.business,
            public_id=f"t-{platform}-{content_id}",
            title=content.topic,
            platform=platform,
            content=content,
            status="Scheduled",
            scheduled_at=timezone.now() - timedelta(minutes=1),
        )
        defaults.update(kw)
        return ScheduledPost.objects.create(**defaults)

    def add_image(self, content_id):
        content = ContentItem.objects.get(campaign=self.campaign, public_id=content_id)
        return MediaAsset.objects.create(
            content=content, file=SimpleUploadedFile(f"{content_id}.jpg", b"\xff\xd8\xff fake jpeg", content_type="image/jpeg")
        )


class CryptoTests(MetaTestCase):
    def test_tokens_are_encrypted_at_rest(self):
        account = self.live_account("Facebook", token="super-secret-token")
        raw = SocialAccount.objects.filter(pk=account.pk).values_list("access_token_enc", flat=True)[0]
        self.assertNotIn("super-secret-token", raw)
        self.assertEqual(SocialAccount.objects.get(pk=account.pk).access_token, "super-secret-token")

    def test_garbage_ciphertext_reads_as_empty(self):
        self.assertEqual(decrypt("not-a-token"), "")
        self.assertEqual(decrypt(encrypt("x")), "x")

    def test_workspace_never_contains_tokens(self):
        self.live_account("Facebook", token="super-secret-token")
        body = self.client.get("/api/workspace").content.decode()
        self.assertNotIn("super-secret-token", body)


class OAuthFlowTests(MetaTestCase):
    def start(self, platform):
        res = self.client.get(f"/api/accounts/{platform}/authorize")
        self.assertEqual(res.status_code, 200, res.content)
        url = urlparse(res.json()["url"])
        return url, parse_qs(url.query)

    def callback(self, platform, **params):
        return APIClient().get(f"/api/oauth/{platform}/callback", params)

    def test_authorize_url_points_at_meta_with_redirect(self):
        url, q = self.start("facebook")
        self.assertEqual(url.netloc, "www.facebook.com")
        self.assertEqual(q["redirect_uri"], ["https://mm.example.test/api/oauth/facebook/callback"])
        self.assertIn("pages_manage_posts", q["scope"][0])

        url, q = self.start("instagram")
        self.assertEqual(url.netloc, "www.instagram.com")
        self.assertIn("instagram_business_content_publish", q["scope"][0])

    @override_settings(FACEBOOK_LOGIN_CONFIG_ID="cfg-123")
    def test_facebook_login_for_business_uses_config_id(self):
        _, q = self.start("facebook")
        self.assertEqual(q["config_id"], ["cfg-123"])
        self.assertEqual(q["override_default_response_type"], ["true"])
        self.assertNotIn("scope", q)

    @override_settings(FACEBOOK_APP_ID="", FACEBOOK_APP_SECRET="")
    def test_authorize_refused_when_not_configured_and_demo_connect_still_works(self):
        self.assertEqual(self.client.get("/api/accounts/Facebook/authorize").status_code, 400)
        res = self.client.post("/api/accounts/Facebook/connect", {}, format="json")
        self.assertTrue(res.json()["accounts"]["Facebook"])
        self.assertFalse(res.json()["accountDetails"]["Facebook"]["live"])

    def test_demo_connect_refused_when_real_sign_in_available(self):
        res = self.client.post("/api/accounts/Facebook/connect", {}, format="json")
        self.assertEqual(res.status_code, 400)

    def test_tampered_state_is_rejected(self):
        res = self.callback("facebook", code="abc", state="forged")
        self.assertEqual(res.status_code, 302)
        self.assertIn("error=", res["Location"])

    def test_state_cannot_be_replayed(self):
        _, q = self.start("instagram")
        fake = FakeGraph([
            ("POST", "api.instagram.com/oauth/access_token", {"access_token": "short", "user_id": 9,
                                                               "permissions": "instagram_business_basic,instagram_business_content_publish"}),
            ("GET", "graph.instagram.com/access_token", {"access_token": "long-ig", "expires_in": 5184000}),
            ("GET", "/me", {"user_id": "17841400000", "username": "ironpeakfitness"}),
        ])
        with _PatchBoth(fake):
            first = self.callback("instagram", code="abc", state=q["state"][0])
            second = self.callback("instagram", code="abc", state=q["state"][0])
        self.assertIn("connected=Instagram", first["Location"])
        self.assertIn("error=", second["Location"])

    def test_facebook_single_page_connects_directly(self):
        _, q = self.start("facebook")
        fake = FakeGraph([
            ("GET", "/oauth/access_token", lambda p, d: {"access_token": "long-user" if "fb_exchange_token" in p else "short-user",
                                                          "expires_in": 5183944}),
            ("GET", "/me/permissions", {"data": [{"permission": "pages_show_list", "status": "granted"},
                                                 {"permission": "pages_manage_posts", "status": "granted"}]}),
            ("GET", "/me/accounts", {"data": [{"id": "555", "name": "Iron Peak Fitness", "access_token": "page-tok",
                                               "tasks": ["CREATE_CONTENT", "ANALYZE"]}]}),
            ("GET", "/me", {"id": "42", "name": "Owner"}),
        ])
        with _PatchBoth(fake):
            res = self.callback("facebook", code="abc", state=q["state"][0])
        self.assertIn("connected=Facebook", res["Location"])
        account = SocialAccount.objects.get(business=self.business, platform="Facebook")
        self.assertTrue(account.connected and account.is_live)
        self.assertEqual((account.external_id, account.display_name, account.access_token), ("555", "Iron Peak Fitness", "page-tok"))
        self.assertIsNone(account.token_expires_at)  # Page token does not expire
        # Every Facebook call carries appsecret_proof.
        authed = [c for c in fake.calls if "access_token" in c[2]]
        self.assertTrue(all("appsecret_proof" in c[2] for c in authed))

    def test_facebook_missing_permission_is_refused(self):
        _, q = self.start("facebook")
        fake = FakeGraph([
            ("GET", "/oauth/access_token", {"access_token": "tok", "expires_in": 100}),
            ("GET", "/me/permissions", {"data": [{"permission": "pages_show_list", "status": "granted"},
                                                 {"permission": "pages_manage_posts", "status": "declined"}]}),
            ("GET", "/me", {"id": "42"}),
        ])
        with _PatchBoth(fake):
            res = self.callback("facebook", code="abc", state=q["state"][0])
        self.assertIn("pages_manage_posts", res["Location"])
        self.assertFalse(SocialAccount.objects.get(business=self.business, platform="Facebook").connected)

    def test_facebook_several_pages_asks_user_to_pick(self):
        _, q = self.start("facebook")
        pages = {"data": [
            {"id": "1", "name": "Iron Peak Fitness", "access_token": "t1", "tasks": ["CREATE_CONTENT"]},
            {"id": "2", "name": "Iron Peak Kids", "access_token": "t2", "tasks": ["CREATE_CONTENT"]},
            {"id": "3", "name": "Read-only Page", "access_token": "t3", "tasks": ["ANALYZE"]},
        ]}
        fake = FakeGraph([
            ("GET", "/oauth/access_token", {"access_token": "user", "expires_in": 100}),
            ("GET", "/me/permissions", {"data": [{"permission": "pages_show_list", "status": "granted"},
                                                 {"permission": "pages_manage_posts", "status": "granted"}]}),
            ("GET", "/me/accounts", pages),
            ("GET", "/me", {"id": "42"}),
        ])
        with _PatchBoth(fake):
            res = self.callback("facebook", code="abc", state=q["state"][0])
            self.assertIn("pick=Facebook", res["Location"])
            listed = self.client.get("/api/accounts/Facebook/targets").json()
            self.assertEqual([t["id"] for t in listed], ["1", "2"])  # read-only Page filtered out
            self.assertNotIn("access_token", listed[0])
            chosen = self.client.post("/api/accounts/Facebook/select", {"id": "2"}, format="json").json()
        self.assertEqual(chosen["accountDetails"]["Facebook"]["name"], "Iron Peak Kids")
        self.assertEqual(SocialAccount.objects.get(business=self.business, platform="Facebook").access_token, "t2")

    def test_disconnect_wipes_credentials(self):
        self.live_account("Instagram", token="tok")
        res = self.client.post("/api/accounts/Instagram/disconnect", {}, format="json").json()
        self.assertFalse(res["accounts"]["Instagram"])
        account = SocialAccount.objects.get(business=self.business, platform="Instagram")
        self.assertEqual((account.access_token_enc, account.external_id), ("", ""))


class PublishingTests(MetaTestCase):
    def test_facebook_text_post_includes_tracked_link(self):
        account = self.live_account("Facebook", external_id="555")
        post = self.make_post("Facebook", "c3")
        fake = FakeGraph([
            ("POST", "/555/feed", {"id": "555_999"}),
            ("GET", "/555_999", {"permalink_url": "https://facebook.com/555/posts/999"}),
        ])
        with _PatchBoth(fake):
            publish_post(post)
        post.refresh_from_db()
        self.assertEqual((post.status, post.external_id), ("Published", "555_999"))
        self.assertEqual(post.permalink, "https://facebook.com/555/posts/999")
        message = fake.calls[0][3]["message"]
        self.assertIn("utm_source=facebook", message)
        self.assertIn("utm_content=c3", message)
        self.assertEqual(account.access_token, fake.calls[0][3]["access_token"])

    def test_facebook_post_with_image_uses_photos_edge(self):
        self.live_account("Facebook", external_id="555")
        self.add_image("c3")
        post = self.make_post("Facebook", "c3")
        fake = FakeGraph([
            ("POST", "/555/photos", {"id": "photo1", "post_id": "555_1000"}),
            ("GET", "/555_1000", {"permalink_url": "https://facebook.com/p"}),
        ])
        with _PatchBoth(fake):
            publish_post(post)
        post.refresh_from_db()
        self.assertEqual(post.external_id, "555_1000")
        self.assertTrue(fake.calls[0][3]["url"].startswith("https://mm.example.test/media/content/"))

    def test_instagram_requires_an_image(self):
        self.live_account("Instagram", external_id="17841400000")
        post = self.make_post("Instagram", "c5")
        with _PatchBoth(FakeGraph([])):
            publish_post(post)
        post.refresh_from_db()
        self.assertEqual(post.status, "Failed")
        self.assertIn("needs an image", post.error)

    def test_instagram_two_step_publish_waits_for_container(self):
        self.live_account("Instagram", external_id="17841400000")
        self.add_image("c5")
        post = self.make_post("Instagram", "c5")
        statuses = iter([{"status_code": "IN_PROGRESS"}, {"status_code": "FINISHED"}])
        fake = FakeGraph([
            ("POST", "/17841400000/media_publish", {"id": "media-77"}),
            ("POST", "/17841400000/media", {"id": "container-1"}),
            ("GET", "/container-1", lambda p, d: next(statuses)),
            ("GET", "/media-77", {"permalink": "https://instagram.com/p/abc"}),
        ])
        with _PatchBoth(fake), mock.patch("api.integrations.instagram.time.sleep"):
            publish_post(post)
        post.refresh_from_db()
        self.assertEqual((post.status, post.external_id, post.permalink), ("Published", "media-77", "https://instagram.com/p/abc"))
        caption = fake.calls[0][3]["caption"]
        self.assertIn("link in bio", caption)
        self.assertNotIn("utm_", caption)

    def test_expired_token_marks_account_for_reconnect(self):
        self.live_account("Facebook", external_id="555")
        post = self.make_post("Facebook", "c3")
        fake = FakeGraph([("POST", "/555/feed", ProviderError("Session has expired", auth=True, code=190))])
        with _PatchBoth(fake):
            publish_post(post)
        post.refresh_from_db()
        account = SocialAccount.objects.get(business=self.business, platform="Facebook")
        self.assertEqual(post.error, "Token expired. Reconnect Facebook, then retry.")
        self.assertFalse(account.connected)
        self.assertEqual(account.status, "expired")

    def test_scheduler_skips_demo_and_never_posts_stale_items(self):
        # Seeded demo posts are in the past; nothing should be sent for them.
        self.live_account("Facebook", external_id="555")
        stale = self.make_post("Facebook", "c3", scheduled_at=timezone.now() - timedelta(days=3))
        fresh = self.make_post("Facebook", "c11", scheduled_at=timezone.now() - timedelta(minutes=2))
        future = self.make_post("Facebook", "c7", scheduled_at=timezone.now() + timedelta(hours=1))
        fake = FakeGraph([("POST", "/555/feed", {"id": "555_1"}), ("GET", "/555_1", {"permalink_url": ""})])
        with _PatchBoth(fake):
            counts = publish_due_posts()
        for p in (stale, fresh, future):
            p.refresh_from_db()
        self.assertEqual(fresh.status, "Published")
        self.assertEqual(stale.status, "Failed")
        self.assertIn("Missed its time slot", stale.error)
        self.assertEqual(future.status, "Scheduled")
        self.assertGreaterEqual(counts["skipped"], 1)  # demo Instagram posts
        self.assertEqual(len([c for c in fake.calls if c[0] == "POST"]), 1)

    def test_retry_on_live_account_queues_for_now(self):
        self.live_account("Facebook", external_id="555")
        post = self.make_post("Facebook", "c3", status="Failed", error="x", scheduled_at=timezone.now() - timedelta(days=3))
        self.client.post(f"/api/posts/{post.public_id}/retry", {}, format="json")
        post.refresh_from_db()
        self.assertEqual(post.status, "Scheduled")
        self.assertLess(abs((timezone.now() - post.scheduled_at).total_seconds()), 5)

    def test_schedule_approved_links_content_and_splits_all(self):
        ContentItem.objects.filter(campaign=self.campaign, public_id="c8").update(status="Approved")
        res = self.client.post("/api/schedule/approved", {}, format="json").json()
        made = ScheduledPost.objects.filter(business=self.business, content__public_id="c8")
        self.assertEqual(sorted(made.values_list("platform", flat=True)), ["Facebook", "Instagram", "LinkedIn"])
        self.assertTrue(all(p.scheduled_at for p in made))
        self.assertGreaterEqual(res["added"], 3)


class SyncTests(MetaTestCase):
    def test_sync_stores_snapshots_and_rolls_up_into_connected_results(self):
        self.live_account("Facebook", external_id="555")
        self.live_account("Instagram", external_id="17841400000")
        self.make_post("Facebook", "c3", status="Published", external_id="555_1")
        self.make_post("Facebook", "c11", status="Published", external_id="555_2")
        self.make_post("Instagram", "c5", status="Published", external_id="ig_1")
        before = ChannelResult.objects.get(campaign=self.campaign, channel="Facebook")

        def fb_insights(params, data):
            n = 1000 if "555_1" in fake.calls[-1][1] else 500
            return {"data": [{"name": "post_impressions", "values": [{"value": n}]},
                             {"name": "post_clicks", "values": [{"value": n // 10}]}]}

        fake = FakeGraph([
            ("GET", "/555_1/insights", fb_insights),
            ("GET", "/555_2/insights", fb_insights),
            ("GET", "/555_", {"shares": {"count": 3}, "reactions": {"summary": {"total_count": 20}},
                              "comments": {"summary": {"total_count": 4}}}),
            ("GET", "/ig_1/insights", {"data": [{"name": "views", "values": [{"value": 2400}]},
                                                {"name": "reach", "values": [{"value": 1800}]},
                                                {"name": "saved", "values": [{"value": 12}]}]}),
        ])
        with _PatchBoth(fake):
            summary = sync_business(self.business)
        self.assertEqual(summary["Facebook"], "2 posts updated")
        self.assertEqual(summary["Instagram"], "1 post updated")
        self.assertEqual(PostMetric.objects.count(), 3)

        fb = ChannelResult.objects.get(campaign=self.campaign, channel="Facebook")
        self.assertEqual((fb.impressions, fb.clicks, fb.source), (1500, 150, "Connected"))
        self.assertEqual((fb.leads, fb.members), (before.leads, before.members))  # platforms don't know these
        ig = ChannelResult.objects.get(campaign=self.campaign, channel="Instagram")
        self.assertEqual(ig.impressions, 2400)

    def test_rejected_metric_falls_back_to_one_at_a_time(self):
        self.live_account("Facebook", external_id="555")
        self.make_post("Facebook", "c3", status="Published", external_id="555_1")

        def insights(params, data):
            if "," in params["metric"] or params["metric"] == "post_impressions":
                raise ProviderError("(#100) The value must be a valid insights metric", code=100)
            return {"data": [{"name": params["metric"], "values": [{"value": 77}]}]}

        fake = FakeGraph([("GET", "/insights", insights), ("GET", "/555_1", {})])
        with _PatchBoth(fake):
            sync_business(self.business)
        self.assertEqual(PostMetric.objects.get().views, 77)  # from post_media_view


class CaptionTests(MetaTestCase):
    def test_link_uses_business_website(self):
        post = self.make_post("Facebook", "c3")
        caption = compose_caption(post)
        self.assertIn("https://ironpeakfitness.com/free-intro?utm_source=facebook", caption)
        self.assertIn("utm_campaign=7", caption)


class MediaUploadTests(MetaTestCase):
    def test_upload_replace_and_remove(self):
        jpeg = SimpleUploadedFile("a.jpg", b"\xff\xd8\xff data", content_type="image/jpeg")
        res = self.client.post("/api/content/c5/media", {"file": jpeg}, format="multipart")
        self.assertEqual(res.status_code, 201)
        item = next(c for c in res.json()["content"] if c["id"] == "c5")
        self.assertEqual(len(item["media"]), 1)
        self.assertTrue(item["media"][0]["url"].startswith("/media/content/"))

        gif = SimpleUploadedFile("a.gif", b"GIF89a", content_type="image/gif")
        self.assertEqual(self.client.post("/api/content/c5/media", {"file": gif}, format="multipart").status_code, 400)

        res = self.client.delete("/api/content/c5/media")
        item = next(c for c in res.json()["content"] if c["id"] == "c5")
        self.assertEqual(item["media"], [])


class MetaCallbackTests(MetaTestCase):
    def signed(self, payload, secret):
        body = base64.urlsafe_b64encode(json.dumps(payload).encode()).decode().rstrip("=")
        sig = base64.urlsafe_b64encode(hmac.new(secret.encode(), body.encode(), hashlib.sha256).digest()).decode().rstrip("=")
        return f"{sig}.{body}"

    def test_data_deletion_wipes_matching_accounts(self):
        self.live_account("Instagram", platform_user_id="9001")
        res = APIClient().post("/api/meta/data-deletion", {"signed_request": self.signed({"user_id": "9001"}, "ig-secret")})
        self.assertEqual(res.status_code, 200)
        self.assertIn("confirmation_code", res.json())
        self.assertFalse(SocialAccount.objects.get(business=self.business, platform="Instagram").connected)

    def test_forged_signature_is_rejected(self):
        res = APIClient().post("/api/meta/deauthorize", {"signed_request": self.signed({"user_id": "1"}, "wrong")})
        self.assertEqual(res.status_code, 400)
