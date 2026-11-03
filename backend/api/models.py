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


class SocialAccount(models.Model):
    business = models.ForeignKey(Business, on_delete=models.CASCADE, related_name="accounts")
    platform = models.CharField(max_length=40)
    connected = models.BooleanField(default=False)

    class Meta:
        unique_together = ("business", "platform")


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

    class Meta:
        unique_together = ("business", "public_id")


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
