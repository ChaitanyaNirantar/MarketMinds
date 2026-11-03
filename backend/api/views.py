import re
import time
from datetime import date

from django.contrib.auth import authenticate, get_user_model
from rest_framework.authtoken.models import Token
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from .models import (
    Business,
    ChannelResult,
    ContentItem,
    Goal,
    KnowledgeSource,
    Product,
    ScheduledPost,
    SocialAccount,
    Strategy,
)
from .payload import SAMPLE_RESULTS, current_campaign, source_json, workspace_json
from .seed import seed_demo

User = get_user_model()
DAYS = ["Nov 2", "Nov 3", "Nov 4", "Nov 5", "Nov 6", "Nov 7", "Nov 8"]


def business_of(request) -> Business:
    business, _ = Business.objects.get_or_create(user=request.user)
    return business


def ok_workspace(business):
    return Response(workspace_json(business))


@api_view(["GET"])
@permission_classes([AllowAny])
def health(_request):
    return Response({"ok": True, "service": "marketminds-django"})


@api_view(["POST"])
@permission_classes([AllowAny])
def login(request):
    email = (request.data.get("email") or "").strip().lower()
    password = request.data.get("password") or ""
    if not email or not password:
        return Response({"detail": "Email and password are required."}, status=400)
    user = authenticate(username=email, password=password)
    if user is None:
        return Response({"detail": "Those credentials do not match an account."}, status=400)
    token, _ = Token.objects.get_or_create(user=user)
    business, _ = Business.objects.get_or_create(user=user)
    return Response({"token": token.key, "email": user.username, "workspace": workspace_json(business)})


@api_view(["POST"])
@permission_classes([AllowAny])
def signup(request):
    email = (request.data.get("email") or "").strip().lower()
    password = request.data.get("password") or ""
    name = (request.data.get("name") or "").strip()
    if not email or "@" not in email:
        return Response({"detail": "Enter a valid email address."}, status=400)
    if len(password) < 8:
        return Response({"detail": "Use at least 8 characters."}, status=400)
    if not name:
        return Response({"detail": "Enter your business name."}, status=400)
    if User.objects.filter(username=email).exists():
        return Response({"detail": "An account with that email already exists."}, status=400)
    user = User.objects.create_user(username=email, email=email, password=password)
    Business.objects.create(user=user, name=name)
    for platform, connected in (("LinkedIn", False), ("Instagram", False), ("Facebook", False)):
        SocialAccount.objects.create(business=user.business, platform=platform, connected=connected)
    token = Token.objects.create(user=user)
    return Response({"token": token.key, "email": email, "workspace": workspace_json(user.business)}, status=201)


@api_view(["POST"])
@permission_classes([AllowAny])
def seed(_request):
    """Reset the Iron Peak Fitness demo account. Handy while testing locally."""
    user = seed_demo(reset=True)
    token, _ = Token.objects.get_or_create(user=user)
    return Response({"ok": True, "email": user.username, "token": token.key, "password": "password123"})


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def workspace(request):
    return ok_workspace(business_of(request))


@api_view(["PUT"])
@permission_classes([IsAuthenticated])
def save_business(request):
    b = business_of(request)
    data = request.data
    b.name = data.get("name", b.name)
    b.website = data.get("website", b.website)
    b.industry = data.get("industry", b.industry)
    b.location = data.get("location", b.location)
    b.description = data.get("description", b.description)
    audience = data.get("audience") or {}
    b.audience_who = audience.get("who", b.audience_who)
    b.audience_radius = audience.get("radius", b.audience_radius)
    b.audience_pains = audience.get("pains", b.audience_pains)
    b.brand_voices = data.get("brandVoices", b.brand_voices)
    b.save()
    products = data.get("products")
    if products is not None:
        b.products.all().delete()
        for i, p in enumerate(products):
            Product.objects.create(
                business=b,
                public_id=p.get("id") or f"p{i+1}",
                name=p.get("name") or "",
                description=p.get("description") or "",
                price=p.get("price") or "",
            )
    return ok_workspace(b)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def add_source(request):
    b = business_of(request)
    name = (request.data.get("name") or "").strip()
    kind = request.data.get("type") or "TXT"
    if not name:
        return Response({"detail": "Name is required."}, status=400)
    source = KnowledgeSource.objects.create(
        business=b,
        public_id=f"s{int(time.time() * 1000)}",
        name=name,
        kind=kind if kind in {c.value for c in KnowledgeSource.Kind} else "TXT",
        status="Processing",
        progress=0,
    )
    return Response(source_json(source), status=201)


@api_view(["DELETE"])
@permission_classes([IsAuthenticated])
def delete_source(request, source_id):
    b = business_of(request)
    KnowledgeSource.objects.filter(business=b, public_id=source_id).delete()
    return ok_workspace(b)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def retry_source(request, source_id):
    b = business_of(request)
    source = KnowledgeSource.objects.filter(business=b, public_id=source_id).first()
    if not source:
        return Response({"detail": "Source not found."}, status=404)
    source.status = "Processing"
    source.progress = 0
    source.error = ""
    source.save()
    return ok_workspace(b)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def search_knowledge(request):
    b = business_of(request)
    query = (request.data.get("query") or "").lower()
    words = [w for w in re.split(r"\W+", query) if len(w) > 3]
    scored = []
    for p in b.passages.all():
        hits = sum(1 for w in words if w in p.text.lower())
        scored.append({"text": p.text, "source": p.source_label, "score": p.score, "hits": hits})
    scored.sort(key=lambda x: (x["hits"], x["score"]), reverse=True)
    return Response(scored[:3])


@api_view(["PUT"])
@permission_classes([IsAuthenticated])
def save_goal(request):
    b = business_of(request)
    data = request.data
    goal = b.goals.filter(is_current=True).first()
    if not goal:
        goal = Goal.objects.create(business=b, public_id="12", is_current=True, text="")
    goal.text = data.get("text", goal.text)
    goal.outcome = data.get("outcome", goal.outcome)
    goal.target = int(data.get("target", goal.target) or 0)
    deadline = data.get("deadline")
    if deadline:
        goal.deadline = date.fromisoformat(deadline)
    goal.budget = int(data.get("budget", goal.budget) or 0)
    goal.channels = data.get("channels", goal.channels)
    goal.status = "Draft"
    goal.save()
    return ok_workspace(b)


def _interpret_and_fill_strategy(goal: Goal):
    strategy, _ = Strategy.objects.get_or_create(
        goal=goal,
        defaults={
            "title": f"Strategy: {goal.outcome.lower()} campaign",
            "status": "Awaiting approval",
            "audience": "Beginners aged 22-40 within 5 miles who want coached, low-pressure workouts.",
            "messages": ["You do not need to be fit to start.", "Coaches guide every rep.", "Real member results."],
            "allocation": [{"p": p, "pct": pct} for p, pct in zip(goal.channels or ["Instagram", "Facebook", "LinkedIn"], [45, 35, 20])],
            "conversion_note": "Send all posts to /free-intro. Track form submissions as the conversion.",
            "evidence": [
                {"kind": "Fact", "text": "New members start with a free coached intro session.", "source": "ironpeakfitness.com/start"},
                {"kind": "Assumption", "text": "This goal can be reached with the current channel mix.", "source": "AI-inferred"},
            ],
        },
    )
    strategy.status = "Awaiting approval"
    strategy.save()
    goal.status = "Awaiting approval"
    goal.save()
    return strategy


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def generate_strategy(request):
    b = business_of(request)
    goal = b.goals.filter(is_current=True).first()
    if not goal:
        goal = Goal.objects.create(business=b, public_id="12", is_current=True, text="")
    data = request.data or {}
    if data.get("text"):
        goal.text = data["text"]
    if data.get("outcome"):
        goal.outcome = data["outcome"]
    if "target" in data:
        goal.target = int(data.get("target") or 0)
    if data.get("deadline"):
        goal.deadline = date.fromisoformat(data["deadline"])
    if "budget" in data:
        goal.budget = int(data.get("budget") or 0)
    if "channels" in data:
        goal.channels = data["channels"]
    goal.save()
    _interpret_and_fill_strategy(goal)
    return ok_workspace(b)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def approve_strategy(request):
    b = business_of(request)
    goal = b.goals.filter(is_current=True).first()
    if not goal or not hasattr(goal, "strategy"):
        return Response({"detail": "No strategy to approve."}, status=400)
    goal.strategy.status = "Approved"
    goal.strategy.save()
    goal.status = "Approved"
    goal.save()
    campaign = current_campaign(b)
    if campaign:
        campaign.status = "Plan ready" if campaign.status == "Draft" else campaign.status
        campaign.goal = goal
        campaign.save()
    return ok_workspace(b)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def generate_content(request):
    """Content is already drafted in the demo seed; this just acknowledges the action."""
    return ok_workspace(business_of(request))


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def bulk_content_status(request):
    b = business_of(request)
    campaign = current_campaign(b)
    ids = request.data.get("ids") or []
    new_status = request.data.get("status")
    if not campaign or not new_status:
        return Response({"detail": "ids and status are required."}, status=400)
    ContentItem.objects.filter(campaign=campaign, public_id__in=ids).update(status=new_status)
    return ok_workspace(b)


@api_view(["PATCH"])
@permission_classes([IsAuthenticated])
def update_content(request, content_id):
    b = business_of(request)
    campaign = current_campaign(b)
    item = ContentItem.objects.filter(campaign=campaign, public_id=content_id).first() if campaign else None
    if not item:
        return Response({"detail": "Content not found."}, status=404)
    if "caption" in request.data:
        item.caption = request.data["caption"]
        item.status = "Edited"
    if "status" in request.data:
        item.status = request.data["status"]
    item.save()
    return ok_workspace(b)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def connect_account(request, platform):
    b = business_of(request)
    account, _ = SocialAccount.objects.get_or_create(business=b, platform=platform)
    account.connected = True
    account.save()
    return ok_workspace(b)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def retry_post(request, post_id):
    b = business_of(request)
    post = ScheduledPost.objects.filter(business=b, public_id=post_id).first()
    if not post:
        return Response({"detail": "Post not found."}, status=404)
    account = SocialAccount.objects.filter(business=b, platform=post.platform).first()
    if account and not account.connected:
        return Response({"detail": f"Reconnect {post.platform} first."}, status=400)
    post.status = "Scheduled"
    post.error = ""
    post.save()
    return ok_workspace(b)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def move_post(request, post_id):
    b = business_of(request)
    post = ScheduledPost.objects.filter(business=b, public_id=post_id).first()
    if not post:
        return Response({"detail": "Post not found."}, status=404)
    day = int(request.data.get("day", post.day))
    post.day = max(0, min(6, day))
    post.date = DAYS[post.day]
    post.save()
    return ok_workspace(b)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def schedule_approved(request):
    b = business_of(request)
    campaign = current_campaign(b)
    if not campaign:
        return Response({"added": 0, **workspace_json(b)})
    scheduled_titles = set(b.posts.values_list("title", flat=True))
    to_add = [c for c in campaign.content.filter(status="Approved") if c.topic not in scheduled_titles]
    for i, c in enumerate(to_add):
        platform = "Instagram" if c.platform == "All" else c.platform
        day = 6 - (i % 2)
        ScheduledPost.objects.create(
            business=b,
            public_id=f"sp-{c.public_id}",
            title=c.topic,
            platform=platform,
            day=day,
            time="12:00 PM" if i % 2 else "5:30 PM",
            date=DAYS[day],
            status="Scheduled",
        )
    payload = workspace_json(b)
    payload["added"] = len(to_add)
    return Response(payload)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def sample_results(_request):
    return Response(SAMPLE_RESULTS)


@api_view(["PUT"])
@permission_classes([IsAuthenticated])
def save_results(request):
    b = business_of(request)
    campaign = current_campaign(b)
    if not campaign:
        return Response({"detail": "No campaign."}, status=400)
    rows = request.data.get("rows") or []
    campaign.results.all().delete()
    for row in rows:
        ChannelResult.objects.create(
            campaign=campaign,
            channel=row["channel"],
            impressions=int(row.get("impressions") or 0),
            clicks=int(row.get("clicks") or 0),
            leads=int(row.get("leads") or 0),
            members=int(row.get("members") or 0),
            source=row.get("source") or "Typed",
        )
    if "visits" in request.data:
        campaign.website_visits = int(request.data.get("visits") or 0)
    if "leads" in request.data:
        campaign.trial_leads = int(request.data.get("leads") or 0)
    if request.data.get("websiteSource"):
        campaign.website_source = request.data["websiteSource"]
    campaign.save()
    return ok_workspace(b)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def accept_recommendation(request):
    b = business_of(request)
    campaign = current_campaign(b)
    rec = campaign.recommendations.filter(is_current=True).first() if campaign else None
    text = (request.data.get("text") or "").strip()
    if rec and not text:
        text = f"Get {rec.proposed_goal} with a retention-and-referral campaign."
    if rec:
        rec.decision = "Accepted"
        rec.save()
    b.goals.update(is_current=False)
    goal = Goal.objects.create(
        business=b,
        public_id=f"g{int(time.time())}",
        text=text or "Get 40 repeat members and 20 referrals by Dec 20.",
        outcome="Repeat members",
        target=40,
        deadline=date(2026, 12, 20),
        channels=["Facebook", "Instagram", "LinkedIn"],
        status="Draft",
        is_current=True,
    )
    if request.data.get("deadline"):
        goal.deadline = date.fromisoformat(request.data["deadline"])
        goal.save()
    return ok_workspace(b)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def dismiss_recommendation(request):
    b = business_of(request)
    campaign = current_campaign(b)
    rec = campaign.recommendations.filter(is_current=True).first() if campaign else None
    if rec:
        rec.decision = "Dismissed"
        rec.save()
    return ok_workspace(b)

