import hashlib
import json
from collections.abc import Mapping
import uuid
from datetime import timedelta
from django.conf import settings
from django.db import IntegrityError, transaction
from django.db.models import F
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import serializers
from rest_framework.decorators import api_view
from rest_framework.response import Response
from api.models import AIJob, Business, Goal, KnowledgeSource
from api.payload import workspace_json
from api.rag import client, service


class GoalInput(serializers.Serializer):
    text = serializers.CharField(max_length=2000)
    outcome = serializers.CharField(max_length=80)
    target = serializers.IntegerField(min_value=1, max_value=100000000)
    budget = serializers.IntegerField(min_value=0, max_value=100000000)
    deadline = serializers.DateField()
    channels = serializers.ListField(child=serializers.ChoiceField(choices=["Instagram", "Facebook", "LinkedIn"]), min_length=1, max_length=3)


def business_of(request):
    return Business.objects.get_or_create(user=request.user)[0]


def lock_business(b):
    Business.objects.filter(pk=b.pk).update(name=F("name"))


def fail(exc, status=400):
    return Response({"detail": str(exc)}, status=status)


@api_view(["POST"])
def upload(request):
    if not isinstance(request.data, Mapping):
        return fail("Send an object with the required fields.")
    b = business_of(request)
    file = request.FILES.get("file")
    category = request.data.get("category", "general")
    if not file or file.size > 10*1024*1024 or file.size == 0:
        return fail("Upload a nonempty PDF or UTF-8 TXT file up to 10 MB.")
    kind = file.name.rsplit(".", 1)[-1].upper()
    if kind not in {"PDF", "TXT"} or not isinstance(category, str) or category not in service.CATEGORIES:
        return fail("Choose a supported category and a PDF or TXT file.")
    digest = hashlib.sha256()
    for part in file.chunks():
        digest.update(part)
    file.seek(0)
    with transaction.atomic():
        lock_business(b)
        if b.sources.filter(file__gt="").count() >= 20:
            return fail("The local workspace supports 20 documents. Remove an unused source first.")
        if b.sources.filter(sha256=digest.hexdigest()).exists():
            return fail("This document is already uploaded. Retry its indexing or remove it first.", 409)
        source = KnowledgeSource(business=b, public_id=uuid.uuid4().hex, name=file.name[:200], kind=kind,
                                 sha256=digest.hexdigest(), category=category, status="Processing", progress=0)
        try:
            source.file.save(file.name, file, save=False)
            source.save()
            job = AIJob.objects.create(business=b, source=source, kind="index", model=settings.OLLAMA_EMBED_MODEL)
        except Exception:
            if source.file:
                source.file.delete(save=False)
            raise
    return Response({"source_id": source.public_id, "job": service.job_json(job)}, status=202)


@api_view(["DELETE"])
def delete_source(request, source_id):
    b = business_of(request)
    with transaction.atomic():
        lock_business(b)
        source = get_object_or_404(b.sources, public_id=source_id)
        # Clear retained private excerpts and cancel generations, including in-flight writes.
        b.ai_jobs.exclude(kind="index").update(status="invalidated", stage="Source removed", evidence=[], output={}, snapshot={}, error="A source was removed. Generate a new suggestion.")
        from api.models import Strategy
        Strategy.objects.filter(goal__business=b).update(evidence=[])
        filename, storage = source.file.name, source.file.storage
        source.delete()
        if filename:
            transaction.on_commit(lambda: storage.delete(filename))
    return Response(workspace_json(b))


@api_view(["POST"])
def retry_source(request, source_id):
    b = business_of(request)
    with transaction.atomic():
        lock_business(b)
        source = get_object_or_404(b.sources, public_id=source_id)
        if not source.file:
            return fail("This is a legacy demo source. Upload the actual file to index it.")
        if source.aijob_set.filter(status__in=["queued", "running"]).exists():
            return fail("This document is already queued or processing.", 409)
        source.status, source.progress, source.error = "Processing", 0, ""
        source.save(update_fields=["status", "progress", "error"])
        source.indexed_chunks.all().delete()
        AIJob.objects.create(business=b, source=source, kind="index", model=settings.OLLAMA_EMBED_MODEL)
    return Response(workspace_json(b), status=202)


@api_view(["GET"])
def readiness(request):
    return Response(service.readiness(business_of(request)))


@api_view(["POST"])
def search(request):
    if not isinstance(request.data, Mapping):
        return fail("Send an object with the required fields.")
    b = business_of(request)
    query = request.data.get("query")
    if not isinstance(query, str) or not query.strip() or len(query) > 1500:
        return fail("Enter a question between 1 and 1500 characters.")
    try:
        return Response(service.retrieve(b, [query], limit=4))
    except client.AIError as exc:
        return fail(exc, 503)


@api_view(["PUT"])
def save_goal(request):
    data = GoalInput(data=request.data)
    if not data.is_valid():
        return Response({"detail": "Check the goal, positive target, nonnegative budget, deadline and selected channels.", "fields": data.errors}, status=400)
    b = business_of(request)
    with transaction.atomic():
        lock_business(b)
        goal = b.goals.filter(is_current=True).first()
        # Editing an approved goal starts a new goal rather than mutating an accepted campaign's context.
        if not goal or goal.status == "Approved":
            b.goals.update(is_current=False)
            goal = Goal(business=b, public_id=uuid.uuid4().hex, is_current=True)
        for key, value in data.validated_data.items():
            setattr(goal, key, value)
        goal.status = "Draft"
        goal.save()
    return Response(workspace_json(b))


@api_view(["GET", "POST"])
def generations(request):
    b = business_of(request)
    if request.method == "GET":
        jobs = b.ai_jobs.exclude(kind="index")
        if request.query_params.get("goal_id"):
            jobs = jobs.filter(goal__public_id=request.query_params["goal_id"])
        return Response([service.job_json(j) for j in jobs.select_related("goal", "campaign")[:20]])
    if not isinstance(request.data, Mapping):
        return fail("Send an object with the required fields.")
    kind = request.data.get("kind", "strategy")
    if kind not in ("strategy", "recommendation"):
        return fail("Choose strategy or recommendation.")
    campaign = None
    if kind == "recommendation":
        campaign = get_object_or_404(b.campaigns, public_id=request.data.get("campaign_id"))
        if not campaign.goal_id or not campaign.results.exists():
            return fail("Record campaign results before requesting performance recommendations.")
        goal = campaign.goal
    else:
        goal = get_object_or_404(b.goals, public_id=request.data.get("goal_id"))
    coverage = service.readiness(b)
    if not coverage["ready"]:
        return Response({"detail": " ".join(coverage["missing"]) or "Upload and index a business document first.", "readiness": coverage}, status=400)
    try:
        with transaction.atomic():
            lock_business(b)
            if b.ai_jobs.exclude(kind="index").filter(created_at__gte=timezone.now()-timedelta(minutes=1)).count() >= 5:
                return fail("Please wait: at most five generation requests per minute.", 429)
            if b.ai_jobs.exclude(kind="index").filter(status__in=["queued", "running"]).exists():
                return fail("A generation is already queued or running. Open it from the strategy page.", 409)
            job = AIJob(business=b, goal=goal, campaign=campaign, kind=kind, model=settings.OLLAMA_CHAT_MODEL)
            if kind == "recommendation":
                job.prompt_version = "rag-rec-v3"
            job.snapshot = service.snapshot(job)
            if len(json.dumps(job.snapshot)) > 24000:
                return fail("Business context is too long. Shorten profile/product descriptions before generating.")
            job.save()
    except IntegrityError:
        return fail("A generation is already running.", 409)
    return Response(service.job_json(job), status=202)


@api_view(["GET"])
def generation_detail(request, job_id):
    job = get_object_or_404(AIJob.objects.select_related("goal", "campaign"), pk=job_id, business__user=request.user)
    result = service.job_json(job)
    if job.kind != "index" and job.status == "succeeded":
        result["stale"] = service.snapshot(job) != job.snapshot
    return Response(result)


@api_view(["POST"])
def accept_generation(request, job_id):
    if not isinstance(request.data, Mapping):
        return fail("Send an object with the required fields.")
    job = get_object_or_404(AIJob, pk=job_id, business__user=request.user)
    index = request.data.get("idea_index")
    edits = request.data.get("edits", {})
    if type(index) is not int or not isinstance(edits, dict) or set(edits)-{"title", "proposed_actions"}:
        return fail("Choose an idea and edit only its title or proposed actions.")
    try:
        campaign = service.accept(job, index, edits)
    except (client.AIError, ValueError) as exc:
        return fail(exc if isinstance(exc, client.AIError) else "The edited idea has invalid or overlong fields.", 409)
    return Response({"campaign_id": campaign.public_id, "workspace": workspace_json(job.business)})


@api_view(["POST"])
def retired_generation(request):
    return fail("Use the document-grounded strategy screen to generate and review an AI suggestion.", 409)


@api_view(["GET"])
def campaign_plan(request, campaign_id):
    campaign = get_object_or_404(business_of(request).campaigns.select_related("goal"), public_id=campaign_id)
    strategy = getattr(campaign.goal, "strategy", None) if campaign.goal_id else None
    return Response({"id": campaign.public_id, "name": campaign.name, "status": campaign.status,
        "objective": campaign.objective, "audience": campaign.audience, "date_range": campaign.date_range,
        "goal_id": campaign.goal.public_id if campaign.goal_id else None,
        "actions": strategy.messages if strategy else [], "rationale": strategy.conversion_note if strategy else ""})
