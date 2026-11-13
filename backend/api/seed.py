"""Idempotent demo workspace for Iron Peak Fitness (the wireframe example)."""

from datetime import date

from django.contrib.auth import get_user_model
from rest_framework.authtoken.models import Token

from .models import (
    Business,
    Campaign,
    ChannelResult,
    ContentItem,
    Goal,
    KnowledgeSource,
    Passage,
    Phase,
    Product,
    Recommendation,
    ScheduledPost,
    SocialAccount,
    Strategy,
    WeeklyMember,
)

DEMO_EMAIL = "you@business.com"
DEMO_PASSWORD = "password123"

CONTENT = [
    dict(public_id="c1", week=1, topic="Meet your coaches", format="Reel", platform="Instagram", phase="Awareness", status="Awaiting",
         caption="New to lifting? You are exactly who we built Iron Peak for. Meet the coaches who guide every rep. Try a free intro class this week. #beginnerfitness",
         cta="Book a free intro", grounding=["services-and-prices.pdf", "member-testimonials.txt"]),
    dict(public_id="c2", week=1, topic="Myths about lifting", format="Carousel", platform="Instagram", phase="Awareness", status="Awaiting",
         caption="Myth: you need to be fit before you start lifting. Fact: our coaches start where you are. Swipe for 4 more myths we hear every week. #strengthtraining",
         cta="Book a free intro", grounding=["ironpeakfitness.com"]),
    dict(public_id="c3", week=2, topic="What a class looks like", format="Post", platform="Facebook", phase="Education", status="Awaiting",
         caption="Ever wondered what happens in a 45-minute Iron Peak class? Warm-up, coached lifts, a short finisher. Max 6 people per coach, so nobody gets lost.",
         cta="See the class schedule", grounding=["services-and-prices.pdf"]),
    dict(public_id="c4", week=2, topic="Why coached training works", format="Article post", platform="LinkedIn", phase="Education", status="Edited",
         caption="Busy professionals in Champaign: coached small-group strength training fits in 45 minutes and adapts to your level. Here is how our coaches plan each session.",
         cta="Book a free intro", grounding=["services-and-prices.pdf", "ironpeakfitness.com"]),
    dict(public_id="c5", week=3, topic="Member story: Dana", format="Carousel", platform="Instagram", phase="Social proof", status="Approved",
         caption='"I had never touched a barbell. Six weeks later I deadlifted my bodyweight." Dana started with Beginner Foundations. Your first session is free.',
         cta="Book a free intro", grounding=["member-testimonials.txt"]),
    dict(public_id="c6", week=3, topic="A morning at Iron Peak", format="Story", platform="Instagram", phase="Social proof", status="Approved",
         caption="6 AM crew checking in. Coffee after, PRs during. Come see what mornings look like.",
         cta="Book a free intro", grounding=["ironpeakfitness.com"]),
    dict(public_id="c7", week=3, topic="Member Q&A thread", format="Post", platform="Facebook", phase="Social proof", status="Awaiting",
         caption="We asked members what surprised them most about their first month. Here are our favourite answers. What would you ask a coach?",
         cta="Book a free intro", grounding=["member-testimonials.txt"]),
    dict(public_id="c8", week=4, topic="Free intro week", format="Post + Story", platform="All", phase="Conversion", status="Awaiting",
         caption="Free intro week starts Monday. One coached session, zero pressure, no gym experience needed. Spots are limited to 6 per class.",
         cta="Claim your free intro", grounding=["services-and-prices.pdf", "ironpeakfitness.com"]),
    dict(public_id="c9", week=4, topic="Last call: intro spots", format="Story", platform="Instagram", phase="Conversion", status="Awaiting",
         caption="Only a few free intro spots left this week. Tap to book yours.",
         cta="Claim your free intro", grounding=["ironpeakfitness.com"]),
    dict(public_id="c10", week=4, topic="Founder note", format="Post", platform="LinkedIn", phase="Conversion", status="Approved",
         caption="Why we started Iron Peak: strength training should not be intimidating. This month we are opening free intro sessions to the Champaign community.",
         cta="Book a free intro", grounding=["ironpeakfitness.com"]),
    dict(public_id="c11", week=2, topic="Lifting for runners", format="Post", platform="Facebook", phase="Education", status="Awaiting",
         caption="Runners: two strength sessions a week can make your miles feel easier. Our coaches build programs around your training.",
         cta="Book a free intro", grounding=["services-and-prices.pdf"]),
    dict(public_id="c12", week=1, topic="Guaranteed 10 lb loss", format="Post", platform="Facebook", phase="Awareness", status="Rejected",
         caption="Lose 10 lb in 2 weeks, guaranteed!",
         cta="Join now", grounding=[]),
]


def seed_demo(reset=True):
    User = get_user_model()
    user, _ = User.objects.get_or_create(
        username=DEMO_EMAIL,
        defaults={"email": DEMO_EMAIL},
    )
    user.email = DEMO_EMAIL
    user.set_password(DEMO_PASSWORD)
    user.save()
    Token.objects.get_or_create(user=user)

    if reset:
        Business.objects.filter(user=user).delete()

    business, _ = Business.objects.get_or_create(
        user=user,
        defaults=dict(
            name="Iron Peak Fitness",
            website="https://ironpeakfitness.com",
            industry="Fitness studio",
            location="Champaign, IL",
            description="Boutique strength-training studio offering small-group classes and personal training for beginners and returning lifters. Every session is coached.",
            audience_who="Beginners aged 22-40 who want coached, low-pressure workouts",
            audience_radius="5 miles",
            audience_pains="Intimidated by big gyms; unsure how to start lifting safely",
            brand_voices=["Friendly", "Inspirational"],
        ),
    )

    if business.products.exists():
        return user

    Product.objects.bulk_create([
        Product(business=business, public_id="p1", name="Small-group class", description="45-min coached session", price="$18"),
        Product(business=business, public_id="p2", name="Beginner Foundations", description="6-week small-group intro to lifting", price="$149"),
    ])

    KnowledgeSource.objects.bulk_create([
        KnowledgeSource(business=business, public_id="s1", name="services-and-prices.pdf", kind="PDF", status="Indexed", chunks=24),
        KnowledgeSource(business=business, public_id="s2", name="ironpeakfitness.com", kind="Website", status="Indexed", chunks=61),
        KnowledgeSource(business=business, public_id="s3", name="brand-guidelines.docx", kind="DOCX", status="Processing", chunks=None, progress=45),
        KnowledgeSource(business=business, public_id="s4", name="member-testimonials.txt", kind="TXT", status="Indexed", chunks=9),
        KnowledgeSource(
            business=business, public_id="s5", name="old-menu.pdf", kind="PDF", status="Failed", chunks=None,
            error="This PDF is a scanned image with no readable text. Upload a text-based PDF or retry with OCR.",
        ),
    ])

    Passage.objects.bulk_create([
        Passage(business=business, source_label="services-and-prices.pdf, p.2", score=0.92,
                text="Beginner Foundations: a 6-week small-group intro to lifting. Max 6 people per coach, no experience needed."),
        Passage(business=business, source_label="ironpeakfitness.com/start", score=0.88,
                text="New members start with a free coached intro session. Book online and we will pair you with a coach."),
        Passage(business=business, source_label="member-testimonials.txt", score=0.71,
                text='"I had never touched a barbell. Six weeks later I deadlifted my bodyweight." — Dana R.'),
        Passage(business=business, source_label="services-and-prices.pdf, p.1", score=0.64,
                text="Small-group classes run 45 minutes, Monday to Saturday, 6 AM to 8 PM."),
    ])

    past1 = Goal.objects.create(
        business=business, public_id="g-sept", text="50 trial signups (Sept)",
        outcome="Trial signups", target=50, deadline=date(2026, 9, 30),
        result_label="58 / 50", status="Completed", is_current=False,
    )
    Goal.objects.create(
        business=business, public_id="g-aug", text="Launch Saturday open gym (Aug)",
        outcome="Class bookings", target=40, deadline=date(2026, 8, 31),
        result_label="31 / 40", status="Missed", is_current=False,
    )
    goal = Goal.objects.create(
        business=business, public_id="12",
        text="I want to generate 100 new memberships in the next 30 days.",
        outcome="Memberships", target=100, deadline=date(2026, 11, 25), budget=0,
        channels=["LinkedIn", "Instagram", "Facebook"],
        status="Awaiting approval", is_current=True,
    )

    Strategy.objects.create(
        goal=goal,
        title="Strategy: 30-day new-member acquisition",
        status="Awaiting approval",
        audience="Beginners aged 22-40 within 5 miles who want coached, low-pressure workouts.",
        messages=["You do not need to be fit to start.", "Coaches guide every rep.", "Real member results."],
        allocation=[{"p": "Instagram", "pct": 45}, {"p": "Facebook", "pct": 35}, {"p": "LinkedIn", "pct": 20}],
        conversion_note="Send all posts to /free-intro. Track form submissions as the conversion.",
        evidence=[
            {"kind": "Fact", "text": "62% of current members joined as complete beginners.", "source": "member-survey.pdf"},
            {"kind": "Fact", "text": "New members start with a free coached intro session.", "source": "ironpeakfitness.com/start"},
            {"kind": "Fact", "text": "September trial campaign beat its goal: 58 of 50 signups.", "source": "Past campaign"},
            {"kind": "Assumption", "text": "Beginners respond better to coach-led video than to promo graphics.", "source": "AI-inferred"},
            {"kind": "Assumption", "text": "Most prospects live within 5 miles of the studio.", "source": "AI-inferred"},
        ],
    )

    campaign = Campaign.objects.create(
        business=business, goal=goal, public_id="7", name="Fall Member Drive",
        status="Live", objective="100 new memberships", audience="local beginners",
        date_range="Nov 1 – Nov 25", members_won=42, is_current=True,
        website_visits=540, trial_leads=118, website_source="Imported",
    )
    Campaign.objects.create(
        business=business, public_id="8", name="Referral Push", status="Live",
        members_won=25, is_current=False,
    )
    Campaign.objects.create(
        business=business, public_id="9", name="Holiday Promo", status="Draft",
        members_won=None, is_current=False,
    )

    Phase.objects.bulk_create([
        Phase(campaign=campaign, name="Awareness", subtitle="Reach new people", start=0, end=1.25),
        Phase(campaign=campaign, name="Education", subtitle="Show how classes work", start=0.75, end=2.25),
        Phase(campaign=campaign, name="Social proof", subtitle="Member stories", start=1.75, end=3.25),
        Phase(campaign=campaign, name="Conversion", subtitle="Free intro offer", start=2.75, end=4),
    ])

    ContentItem.objects.bulk_create([ContentItem(campaign=campaign, **row) for row in CONTENT])

    SocialAccount.objects.bulk_create([
        SocialAccount(business=business, platform="LinkedIn", connected=True),
        SocialAccount(business=business, platform="Instagram", connected=True),
        SocialAccount(business=business, platform="Facebook", connected=False),
    ])

    ScheduledPost.objects.bulk_create([
        ScheduledPost(business=business, public_id="sp1", title="Meet your coaches", platform="Instagram", day=0, time="9:00 AM", date="Nov 2", status="Scheduled"),
        ScheduledPost(business=business, public_id="sp2", title="Why coached training works", platform="LinkedIn", day=1, time="9:00 AM", date="Nov 3", status="Scheduled"),
        ScheduledPost(business=business, public_id="sp3", title="Lifting for runners", platform="Facebook", day=2, time="9:00 AM", date="Nov 4", status="Scheduled"),
        ScheduledPost(business=business, public_id="sp4", title="Myths about lifting", platform="Instagram", day=3, time="9:00 AM", date="Nov 5", status="Published"),
        ScheduledPost(business=business, public_id="sp5", title="What a class looks like", platform="Facebook", day=4, time="9:00 AM", date="Nov 6", status="Failed",
                      error="Token expired. Reconnect Facebook, then retry."),
        ScheduledPost(business=business, public_id="sp6", title="Member story: Dana", platform="Instagram", day=5, time="9:00 AM", date="Nov 7", status="Scheduled"),
    ])

    # Link each demo post to its content and give it a real timestamp.
    from .social import scheduled_at_for

    by_topic = {c.topic: c for c in campaign.content.all()}
    for post in business.posts.all():
        post.content = by_topic.get(post.title)
        post.scheduled_at = scheduled_at_for(post.day, post.time)
        post.save(update_fields=["content", "scheduled_at"])

    ChannelResult.objects.bulk_create([
        ChannelResult(campaign=campaign, channel="Instagram", impressions=11400, clicks=310, leads=41, members=22, source="Imported"),
        ChannelResult(campaign=campaign, channel="Facebook", impressions=5200, clicks=340, leads=58, members=34, source="Imported"),
        ChannelResult(campaign=campaign, channel="LinkedIn", impressions=1600, clicks=110, leads=19, members=11, source="Connected"),
    ])
    WeeklyMember.objects.bulk_create([
        WeeklyMember(campaign=campaign, week="Wk 1", members=9, order=1),
        WeeklyMember(campaign=campaign, week="Wk 2", members=15, order=2),
        WeeklyMember(campaign=campaign, week="Wk 3", members=19, order=3),
        WeeklyMember(campaign=campaign, week="Wk 4", members=24, order=4),
    ])

    Recommendation.objects.create(
        campaign=campaign, rec="Current advice", is_current=True, confidence="Medium",
        happened="Instagram earned 63% of impressions but only 33% of new members. Facebook earned 29% of impressions and 51% of members.",
        why="Fewer impressions turned into more members on Facebook, so impressions alone are a poor guide to where to spend effort.",
        next_step="Run a 30-day retention-and-referral campaign with more Facebook posts, and test testimonial posts against promo posts.",
        proposed_goal="40 repeat members and 20 referrals by Dec 20",
        proposed_mix="Facebook 50%, Instagram 30%, LinkedIn 20%",
        proposed_experiment="Testimonials vs. promos",
    )
    Recommendation.objects.create(
        campaign=campaign, rec="Post more reels (Sept)", decision="Accepted", outcome="+12% visits", is_current=False,
    )
    Recommendation.objects.create(
        campaign=campaign, rec="Pause LinkedIn ads (Aug)", decision="Dismissed", outcome="—", is_current=False,
    )
    _ = past1
    return user
