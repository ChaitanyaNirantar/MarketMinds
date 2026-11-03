from __future__ import annotations

from .models import Business, Campaign, Goal


def tick_processing(business: Business):
    for source in business.sources.filter(status="Processing"):
        progress = min(100, (source.progress or 0) + 8)
        if progress >= 100:
            source.status = "Indexed"
            source.progress = None
            source.chunks = 12 + (len(source.name) % 20)
        else:
            source.progress = progress
        source.save()


def source_json(s):
    return {
        "id": s.public_id,
        "name": s.name,
        "type": s.kind,
        "status": s.status,
        "chunks": s.chunks,
        "progress": s.progress,
        "error": s.error or None,
    }


def goal_json(g: Goal | None):
    if not g:
        return {
            "id": None,
            "text": "",
            "outcome": "Memberships",
            "target": 0,
            "deadline": "2026-11-25",
            "budget": 0,
            "channels": ["LinkedIn", "Instagram", "Facebook"],
        }
    return {
        "id": g.public_id,
        "text": g.text,
        "outcome": g.outcome,
        "target": g.target,
        "deadline": g.deadline.isoformat() if g.deadline else None,
        "budget": g.budget,
        "channels": g.channels or [],
    }


def workspace_json(business: Business):
    tick_processing(business)
    current_goal = business.goals.filter(is_current=True).order_by("-id").first()
    campaign = business.campaigns.filter(is_current=True).first() or business.campaigns.order_by("id").first()
    strategy = getattr(current_goal, "strategy", None) if current_goal else None
    accounts = {a.platform: a.connected for a in business.accounts.all()}
    for p in ("LinkedIn", "Instagram", "Facebook"):
        accounts.setdefault(p, False)

    rec = None
    past_recs = []
    weekly = []
    content = []
    results = []
    phases = []
    if campaign:
        rec = campaign.recommendations.filter(is_current=True).first()
        past_recs = [
            {"rec": r.rec, "decision": r.decision, "outcome": r.outcome}
            for r in campaign.recommendations.filter(is_current=False)
        ]
        weekly = [{"week": w.week, "members": w.members} for w in campaign.weekly_members.order_by("order")]
        content = [
            {
                "id": c.public_id,
                "week": c.week,
                "topic": c.topic,
                "format": c.format,
                "platform": c.platform,
                "phase": c.phase,
                "status": c.status,
                "caption": c.caption,
                "cta": c.cta,
                "grounding": c.grounding or [],
            }
            for c in campaign.content.all()
        ]
        results = [
            {
                "channel": r.channel,
                "impressions": r.impressions,
                "clicks": r.clicks,
                "leads": r.leads,
                "members": r.members,
                "source": r.source,
            }
            for r in campaign.results.all()
        ]
        phases = [
            {"name": p.name, "subtitle": p.subtitle, "start": p.start, "end": p.end}
            for p in campaign.phases.all()
        ]

    previous = [
        {"goal": g.text, "result": g.result_label or "—", "status": g.status, "id": g.public_id}
        for g in business.goals.filter(is_current=False).order_by("-deadline")
    ]

    return {
        "user": {"email": business.user.email or business.user.username},
        "business": {
            "name": business.name,
            "website": business.website,
            "industry": business.industry,
            "location": business.location,
            "description": business.description,
            "audience": {
                "who": business.audience_who,
                "radius": business.audience_radius,
                "pains": business.audience_pains,
            },
            "brandVoices": business.brand_voices or [],
        },
        "products": [
            {"id": p.public_id, "name": p.name, "description": p.description, "price": p.price}
            for p in business.products.all()
        ],
        "sources": [source_json(s) for s in business.sources.all()],
        "passages": [
            {"text": p.text, "source": p.source_label, "score": p.score}
            for p in business.passages.all()
        ],
        "goal": goal_json(current_goal),
        "previousGoals": previous,
        "strategyStatus": strategy.status if strategy else "Draft",
        "strategy": None
        if not strategy
        else {
            "title": strategy.title,
            "audience": strategy.audience,
            "messages": strategy.messages or [],
            "allocation": strategy.allocation or [],
            "conversionNote": strategy.conversion_note,
            "evidence": strategy.evidence or [],
        },
        "campaign": None
        if not campaign
        else {
            "id": campaign.public_id,
            "name": campaign.name,
            "status": campaign.status,
            "objective": campaign.objective,
            "audience": campaign.audience,
            "dateRange": campaign.date_range,
            "membersWon": campaign.members_won,
        },
        "campaigns": [
            {
                "name": c.name,
                "members": c.members_won,
                "status": c.status,
                "to": f"/campaigns/{c.public_id}",
            }
            for c in business.campaigns.all()
        ],
        "phases": phases,
        "content": content,
        "accounts": accounts,
        "posts": [
            {
                "id": p.public_id,
                "title": p.title,
                "platform": p.platform,
                "day": p.day,
                "time": p.time,
                "date": p.date,
                "status": p.status,
                "error": p.error or None,
            }
            for p in business.posts.all()
        ],
        "results": results,
        "websiteOutcomes": None
        if not campaign
        else {
            "visits": campaign.website_visits,
            "leads": campaign.trial_leads,
            "source": campaign.website_source,
        },
        "weeklyMembers": weekly,
        "pastRecommendations": past_recs,
        "recommendation": None
        if not rec
        else {
            "confidence": rec.confidence,
            "happened": rec.happened,
            "why": rec.why,
            "nextStep": rec.next_step,
            "proposedGoal": rec.proposed_goal,
            "proposedMix": rec.proposed_mix,
            "proposedExperiment": rec.proposed_experiment,
        },
    }


SAMPLE_RESULTS = [
    {"channel": "Instagram", "impressions": 9000, "clicks": 250, "leads": 30, "members": 15, "source": "Sample"},
    {"channel": "Facebook", "impressions": 4000, "clicks": 260, "leads": 45, "members": 25, "source": "Sample"},
    {"channel": "LinkedIn", "impressions": 1200, "clicks": 80, "leads": 14, "members": 8, "source": "Sample"},
]


def current_campaign(business: Business) -> Campaign | None:
    return business.campaigns.filter(is_current=True).first() or business.campaigns.order_by("id").first()
