from django.conf import settings
from django.db import models


class Business(models.Model):
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="business")
    name = models.CharField(max_length=200, blank=True)
    website = models.CharField(max_length=300, blank=True)
    industry = models.CharField(max_length=120, blank=True)
    location = models.CharField(max_length=200, blank=True)
    description = models.TextField(blank=True)
    audience_who = models.TextField(blank=True)
    audience_radius = models.CharField(max_length=80, blank=True)
    audience_pains = models.TextField(blank=True)
    brand_voices = models.JSONField(default=list, blank=True)

    def __str__(self):
        return self.name or self.user.username


class Product(models.Model):
    business = models.ForeignKey(Business, on_delete=models.CASCADE, related_name="products")
    public_id = models.CharField(max_length=40)
    name = models.CharField(max_length=200)
    description = models.CharField(max_length=400, blank=True)
    price = models.CharField(max_length=40, blank=True)

    class Meta:
        unique_together = ("business", "public_id")


class KnowledgeSource(models.Model):
    class Kind(models.TextChoices):
        PDF = "PDF"
        WEBSITE = "Website"
        DOCX = "DOCX"
        TXT = "TXT"

    class Status(models.TextChoices):
        INDEXED = "Indexed"
        PROCESSING = "Processing"
        FAILED = "Failed"

    business = models.ForeignKey(Business, on_delete=models.CASCADE, related_name="sources")
    public_id = models.CharField(max_length=40)
    name = models.CharField(max_length=300)
    kind = models.CharField(max_length=20, choices=Kind.choices)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PROCESSING)
    chunks = models.IntegerField(null=True, blank=True)
    progress = models.IntegerField(null=True, blank=True)
    error = models.TextField(blank=True)

    class Meta:
        unique_together = ("business", "public_id")


class Passage(models.Model):
    business = models.ForeignKey(Business, on_delete=models.CASCADE, related_name="passages")
    source_label = models.CharField(max_length=200)
    text = models.TextField()
    score = models.FloatField(default=0.5)


class Goal(models.Model):
    business = models.ForeignKey(Business, on_delete=models.CASCADE, related_name="goals")
    public_id = models.CharField(max_length=40)
    text = models.TextField()
    outcome = models.CharField(max_length=80, default="Memberships")
    target = models.IntegerField(default=0)
    deadline = models.DateField(null=True, blank=True)
    budget = models.IntegerField(default=0)
    channels = models.JSONField(default=list, blank=True)
    result_label = models.CharField(max_length=80, blank=True)
    status = models.CharField(max_length=40, default="Draft")
    is_current = models.BooleanField(default=False)

    class Meta:
        unique_together = ("business", "public_id")


class Strategy(models.Model):
    goal = models.OneToOneField(Goal, on_delete=models.CASCADE, related_name="strategy")
    title = models.CharField(max_length=200, blank=True)
    status = models.CharField(max_length=40, default="Awaiting approval")
    audience = models.TextField(blank=True)
    messages = models.JSONField(default=list, blank=True)
    allocation = models.JSONField(default=list, blank=True)
    conversion_note = models.TextField(blank=True)
    evidence = models.JSONField(default=list, blank=True)


class Campaign(models.Model):
    business = models.ForeignKey(Business, on_delete=models.CASCADE, related_name="campaigns")
    goal = models.ForeignKey(Goal, on_delete=models.SET_NULL, null=True, blank=True, related_name="campaigns")
    public_id = models.CharField(max_length=40)
    name = models.CharField(max_length=200)
    status = models.CharField(max_length=40, default="Draft")
    objective = models.CharField(max_length=200, blank=True)
    audience = models.CharField(max_length=200, blank=True)
    date_range = models.CharField(max_length=80, blank=True)
    members_won = models.IntegerField(null=True, blank=True)
    website_visits = models.IntegerField(default=540)
    trial_leads = models.IntegerField(default=118)
    website_source = models.CharField(max_length=20, default="Imported")
    is_current = models.BooleanField(default=False)

    class Meta:
        unique_together = ("business", "public_id")


class Phase(models.Model):
    campaign = models.ForeignKey(Campaign, on_delete=models.CASCADE, related_name="phases")
    name = models.CharField(max_length=80)
    subtitle = models.CharField(max_length=200, blank=True)
    start = models.FloatField(default=0)
    end = models.FloatField(default=1)


class ContentItem(models.Model):
    campaign = models.ForeignKey(Campaign, on_delete=models.CASCADE, related_name="content")
    public_id = models.CharField(max_length=40)
    week = models.IntegerField(default=1)
    topic = models.CharField(max_length=200)
    format = models.CharField(max_length=80)
    platform = models.CharField(max_length=40)
    phase = models.CharField(max_length=80)
    status = models.CharField(max_length=40, default="Awaiting")
    caption = models.TextField(blank=True)
    cta = models.CharField(max_length=200, blank=True)
    grounding = models.JSONField(default=list, blank=True)

    class Meta:
        unique_together = ("campaign", "public_id")


class MediaAsset(models.Model):
    """An image attached to a post. Instagram fetches it from its public URL."""

    content = models.ForeignKey(ContentItem, on_delete=models.CASCADE, related_name="media")
    file = models.FileField(upload_to="content/%Y/%m/")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["id"]

    @property
    def public_url(self) -> str:
        return f"{settings.PUBLIC_BASE_URL}{self.file.url}"


class SocialAccount(models.Model):
    class Status(models.TextChoices):
        OK = "", "OK"
        NEEDS_TARGET = "needs_target", "Needs a Page picked"
        EXPIRED = "expired", "Token expired"
        ERROR = "error", "Error"

    business = models.ForeignKey(Business, on_delete=models.CASCADE, related_name="accounts")
    platform = models.CharField(max_length=40)
    connected = models.BooleanField(default=False)
    # False = demo connection (no real platform behind it).
    is_live = models.BooleanField(default=False)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.OK, blank=True)
    last_error = models.TextField(blank=True)
    # The Page / Instagram account we post as, and who signed in.
    external_id = models.CharField(max_length=100, blank=True)
    display_name = models.CharField(max_length=200, blank=True)
    platform_user_id = models.CharField(max_length=100, blank=True)
    # Encrypted with api.integrations.crypto; never read these columns directly.
    access_token_enc = models.TextField(blank=True)
    user_token_enc = models.TextField(blank=True)
    token_expires_at = models.DateTimeField(null=True, blank=True)
    token_refreshed_at = models.DateTimeField(null=True, blank=True)
    scopes = models.JSONField(default=list, blank=True)
    oauth_nonce = models.CharField(max_length=64, blank=True)
    connected_at = models.DateTimeField(null=True, blank=True)
    last_synced_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        unique_together = ("business", "platform")

    def __str__(self):
        return f"{self.business} - {self.platform}"

    @property
    def access_token(self) -> str:
        from .integrations.crypto import decrypt

        return decrypt(self.access_token_enc)

    @access_token.setter
    def access_token(self, value: str):
        from .integrations.crypto import encrypt

        self.access_token_enc = encrypt(value)

    @property
    def user_token(self) -> str:
        from .integrations.crypto import decrypt

        return decrypt(self.user_token_enc)

    @user_token.setter
    def user_token(self, value: str):
        from .integrations.crypto import encrypt

        self.user_token_enc = encrypt(value)

    def clear_credentials(self):
        self.connected = False
        self.is_live = False
        self.status = self.Status.OK
        self.last_error = ""
        self.external_id = ""
        self.display_name = ""
        self.platform_user_id = ""
        self.access_token_enc = ""
        self.user_token_enc = ""
        self.token_expires_at = None
        self.token_refreshed_at = None
        self.scopes = []
        self.oauth_nonce = ""


class ScheduledPost(models.Model):
    business = models.ForeignKey(Business, on_delete=models.CASCADE, related_name="posts")
    public_id = models.CharField(max_length=40)
    title = models.CharField(max_length=200)
    platform = models.CharField(max_length=40)
    day = models.IntegerField(default=0)
    time = models.CharField(max_length=20, default="9:00 AM")
    date = models.CharField(max_length=20, blank=True)
    status = models.CharField(max_length=20, default="Scheduled")
    error = models.TextField(blank=True)
    content = models.ForeignKey(ContentItem, on_delete=models.SET_NULL, null=True, blank=True, related_name="scheduled_posts")
    scheduled_at = models.DateTimeField(null=True, blank=True)
    # Filled in once the platform accepts the post.
    external_id = models.CharField(max_length=100, blank=True)
    permalink = models.URLField(max_length=500, blank=True)
    published_at = models.DateTimeField(null=True, blank=True)
    attempts = models.IntegerField(default=0)
    last_attempt_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        unique_together = ("business", "public_id")


class PostMetric(models.Model):
    """One snapshot of a published post's numbers, as reported by the platform."""

    post = models.ForeignKey(ScheduledPost, on_delete=models.CASCADE, related_name="metrics")
    captured_at = models.DateTimeField(auto_now_add=True)
    views = models.IntegerField(default=0)
    reach = models.IntegerField(default=0)
    likes = models.IntegerField(default=0)
    comments = models.IntegerField(default=0)
    shares = models.IntegerField(default=0)
    saves = models.IntegerField(default=0)
    clicks = models.IntegerField(default=0)
    raw = models.JSONField(default=dict, blank=True)

    class Meta:
        ordering = ["-captured_at", "-id"]


class ChannelResult(models.Model):
    campaign = models.ForeignKey(Campaign, on_delete=models.CASCADE, related_name="results")
    channel = models.CharField(max_length=40)
    impressions = models.IntegerField(default=0)
    clicks = models.IntegerField(default=0)
    leads = models.IntegerField(default=0)
    members = models.IntegerField(default=0)
    source = models.CharField(max_length=20, default="Imported")

    class Meta:
        unique_together = ("campaign", "channel")


class WeeklyMember(models.Model):
    campaign = models.ForeignKey(Campaign, on_delete=models.CASCADE, related_name="weekly_members")
    week = models.CharField(max_length=20)
    members = models.IntegerField(default=0)
    order = models.IntegerField(default=0)


class Recommendation(models.Model):
    campaign = models.ForeignKey(Campaign, on_delete=models.CASCADE, related_name="recommendations")
    rec = models.CharField(max_length=300)
    decision = models.CharField(max_length=40, blank=True)
    outcome = models.CharField(max_length=80, blank=True)
    is_current = models.BooleanField(default=False)
    confidence = models.CharField(max_length=40, blank=True)
    happened = models.TextField(blank=True)
    why = models.TextField(blank=True)
    next_step = models.TextField(blank=True)
    proposed_goal = models.CharField(max_length=300, blank=True)
    proposed_mix = models.CharField(max_length=200, blank=True)
    proposed_experiment = models.CharField(max_length=200, blank=True)
