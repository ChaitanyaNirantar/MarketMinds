import io
import json
import tempfile
from datetime import date, timedelta
from pathlib import Path
from unittest.mock import patch
from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient
from pypdf import PdfWriter
from api.models import AIJob, Business, ChannelResult, Goal, KnowledgeChunk, KnowledgeSource
from api.rag import client, service
from api.rag.schemas import validate_answer

BRIEF = ('Harbor Yoga offers beginner yoga classes for adults in the local neighborhood. '
         'Our audience is first-time students who prefer calm instruction. '
         'Brand voice: warm and clear. Do not advertise discounts or guaranteed health outcomes. '
         'Class capacity is twelve participants. Introductory classes require advance booking.')


def embeddings(texts):
    return [[1.0, 0.0, 0.0] for _ in texts]


def answer(evidence):
    return json.dumps({"status": "ready", "conflicts": [], "missing_information": [], "ideas": [{
        "title": "Introduce beginner classes", "rationale": "Explain the documented service to new students.",
        "audience": "First-time adult students", "supporting_facts": [{"claim": "Beginner classes are offered.",
        "citation_id": evidence[0]["citation_id"], "quote": "Harbor Yoga offers beginner yoga classes for adults in the local neighborhood."}],
        "proposed_actions": ["Test an instructor introduction post."], "assumptions": ["An instructor can participate."],
        "success_metrics": ["Introductory bookings"], "risks": ["Confirm remaining class capacity."]}]})


class RAGTests(TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.settings_override = override_settings(MEDIA_ROOT=self.temp.name)
        self.settings_override.enable()
        self.addCleanup(self.settings_override.disable)
        self.user = get_user_model().objects.create_user(username="owner", password="testing-password")
        self.other = get_user_model().objects.create_user(username="other", password="testing-password")
        self.business = Business.objects.create(user=self.user, name="Harbor Yoga", audience_who="First-time students")
        self.api = APIClient(); self.api.force_authenticate(self.user)
        self.goal = Goal.objects.create(business=self.business, public_id="goal-a", text="Attract introductory bookings", outcome="Class bookings", target=20,
                                       budget=200, deadline=date(2026, 12, 20), channels=["Instagram"], is_current=True)

    def upload(self, text=BRIEF, name="brief.txt", category="brief"):
        return self.api.post("/api/sources", {"file": SimpleUploadedFile(name, text.encode() if isinstance(text, str) else text), "category": category}, format="multipart")

    def indexed(self):
        response = self.upload()
        self.assertEqual(response.status_code, 202, response.data)
        with patch("api.rag.client.embed", side_effect=embeddings):
            self.assertTrue(service.process_next())
        source = self.business.sources.get(file__gt="")
        self.assertEqual(source.status, "Indexed", source.error)
        return source

    def queued(self, kind="strategy", **kwargs):
        response = self.api.post("/api/ai/generations", {"goal_id": self.goal.public_id, "kind": kind, **kwargs}, format="json")
        self.assertEqual(response.status_code, 202, response.data)
        return AIJob.objects.get(pk=response.data["id"])

    def generated(self):
        self.indexed(); job = self.queued()
        def model(messages, schema, **kwargs):
            return answer(json.loads(messages[1]["content"])["DOCUMENT_EVIDENCE"])
        with patch("api.rag.client.embed", side_effect=embeddings), patch("api.rag.client.chat", side_effect=model):
            service.process_next()
        job.refresh_from_db(); self.assertEqual(job.status, "succeeded", job.error)
        return job

    def test_authenticated_routes_and_owner_isolation(self):
        source = self.indexed(); job = self.queued()
        self.api.force_authenticate(self.other)
        for path in [f"/api/ai/generations/{job.pk}", f"/api/campaigns/not-owned/plan"]:
            self.assertEqual(self.api.get(path).status_code, 404)
        self.assertEqual(self.api.delete(f"/api/sources/{source.public_id}").status_code, 404)
        self.assertEqual(self.api.post(f"/api/ai/generations/{job.pk}/accept", {"idea_index": 0}, format="json").status_code, 404)
        self.assertEqual(self.api.post("/api/ai/generations", {"goal_id": self.goal.public_id}, format="json").status_code, 404)
        self.api.force_authenticate(None)
        self.assertEqual(self.api.get("/api/knowledge/readiness").status_code, 401)
        self.assertEqual(self.api.get(f"/api/ai/generations/{job.pk}").status_code, 401)

    def test_real_upload_and_get_never_advances_processing(self):
        response = self.upload(); self.assertEqual(response.status_code, 202)
        source = self.business.sources.get()
        self.assertTrue(Path(source.file.path).exists())
        for _ in range(3):
            self.api.get("/api/workspace")
        source.refresh_from_db(); self.assertEqual(source.status, "Processing"); self.assertEqual(source.progress, 0)
        self.assertEqual(source.indexed_chunks.count(), 0)

    def test_metadata_only_and_duplicate_uploads_are_rejected(self):
        self.assertEqual(self.api.post("/api/sources", {"name": "pretend.pdf", "type": "PDF"}).status_code, 400)
        self.upload(); self.assertEqual(self.upload().status_code, 409)
        self.assertEqual(self.upload(name="unsupported.docx").status_code, 400)

    def test_extraction_failure_is_retryable(self):
        self.upload("short")
        service.process_next()
        source = self.business.sources.get()
        self.assertEqual(source.status, "Failed"); self.assertIn("readable text", source.error)
        self.assertEqual(self.api.post(f"/api/sources/{source.public_id}/retry").status_code, 202)
        self.assertEqual(self.api.post(f"/api/sources/{source.public_id}/retry").status_code, 409)

    def test_scanned_pdf_and_corrupt_pdf_fail_without_fake_chunks(self):
        writer = PdfWriter(); writer.add_blank_page(width=100, height=100)
        pdf = io.BytesIO(); writer.write(pdf)
        self.upload(pdf.getvalue(), name="scan.pdf")
        service.process_next()
        self.assertEqual(self.business.sources.get().status, "Failed")
        self.upload(b"not a pdf", name="broken.pdf"); service.process_next()
        self.assertFalse(KnowledgeChunk.objects.exists())

    def test_readiness_requires_real_index_and_declared_coverage(self):
        KnowledgeSource.objects.create(business=self.business, public_id="demo", name="demo.pdf", kind="PDF", status="Indexed", chunks=30)
        self.assertFalse(self.api.get("/api/knowledge/readiness").data["ready"])
        self.indexed()
        self.assertTrue(self.api.get("/api/knowledge/readiness").data["ready"])
        self.assertEqual(len(self.api.get("/api/workspace").data["sources"]), 1)

    def test_search_is_scoped_and_retains_locations(self):
        self.indexed()
        other_b = Business.objects.create(user=self.other)
        other_s = KnowledgeSource.objects.create(business=other_b, public_id="secret", file="dummy", status="Indexed", embedding_model="embeddinggemma")
        KnowledgeChunk.objects.create(source=other_s, position=0, location="Text", text="PRIVATE COMPETITOR SECRET", embedding=[1, 0, 0])
        with patch("api.rag.client.embed", side_effect=embeddings):
            found = self.api.post("/api/knowledge/search", {"query": "beginner services"}, format="json")
        self.assertEqual(found.status_code, 200)
        self.assertEqual(found.data[0]["location"], "Text")
        self.assertNotIn("PRIVATE", json.dumps(found.data))

    def test_embedding_failure_leaves_no_partial_searchable_index(self):
        self.upload()
        with patch("api.rag.client.embed", side_effect=client.AIError("Ollama unavailable")):
            service.process_next()
        self.assertFalse(KnowledgeChunk.objects.exists())
        self.assertEqual(self.business.sources.get().status, "Failed")

    def test_one_pending_generation_and_validation(self):
        self.indexed(); self.queued()
        self.assertEqual(self.api.post("/api/ai/generations", {"goal_id": "goal-a"}, format="json").status_code, 409)
        invalid = self.api.put("/api/goals", {"text": "Bad", "target": -1}, format="json")
        self.assertEqual(invalid.status_code, 400)
        self.assertEqual(self.api.post("/api/goals/approve-strategy").status_code, 409)

    def test_strategy_end_to_end_acceptance_is_explicit_and_idempotent(self):
        job = self.generated()
        self.assertFalse(self.business.campaigns.exists())
        self.assertTrue(job.evidence); self.assertTrue(job.snapshot)
        accepted = self.api.post(f"/api/ai/generations/{job.pk}/accept", {"idea_index": 0, "edits": {"title": "Reviewed strategy"}}, format="json")
        self.assertEqual(accepted.status_code, 200, accepted.data)
        repeat = self.api.post(f"/api/ai/generations/{job.pk}/accept", {"idea_index": 0}, format="json")
        self.assertEqual(repeat.data["campaign_id"], accepted.data["campaign_id"])
        self.assertEqual(self.business.campaigns.count(), 1)
        campaign = self.business.campaigns.get()
        self.assertEqual(campaign.website_visits, 0)
        plan = self.api.get(f"/api/campaigns/{campaign.public_id}/plan")
        self.assertEqual(plan.data["name"], "Reviewed strategy")
        self.assertEqual(plan.data["actions"], ["Test an instructor introduction post."])

    def test_context_change_prevents_acceptance(self):
        job = self.generated()
        self.goal.budget = 500; self.goal.save()
        self.assertTrue(self.api.get(f"/api/ai/generations/{job.pk}").data["stale"])
        self.assertEqual(self.api.post(f"/api/ai/generations/{job.pk}/accept", {"idea_index": 0}, format="json").status_code, 409)
        self.assertFalse(self.business.campaigns.exists())

    def test_delete_clears_evidence_and_files_and_cancels_jobs(self):
        job = self.generated(); source = self.business.sources.get(); path = source.file.path
        with self.captureOnCommitCallbacks(execute=True):
            response = self.api.delete(f"/api/sources/{source.public_id}")
        self.assertEqual(response.status_code, 200)
        self.assertFalse(Path(path).exists()); self.assertFalse(KnowledgeChunk.objects.exists())
        job.refresh_from_db(); self.assertEqual(job.status, "invalidated"); self.assertEqual(job.evidence, []); self.assertEqual(job.output, {})

    def test_invalid_citations_retry_once_and_never_apply(self):
        self.indexed(); job = self.queued()
        invalid = answer([{"citation_id": "MADE-UP"}])
        with patch("api.rag.client.embed", side_effect=embeddings), patch("api.rag.client.chat", return_value=invalid) as chat:
            service.process_next()
        self.assertEqual(chat.call_count, 2)
        job.refresh_from_db(); self.assertEqual(job.status, "failed"); self.assertFalse(self.business.campaigns.exists())

    def test_missing_information_is_a_valid_result_not_an_acceptible_strategy(self):
        self.indexed(); job = self.queued()
        missing = json.dumps({"status": "needs_information", "conflicts": [], "ideas": [], "missing_information": ["Confirm your current offer terms."]})
        with patch("api.rag.client.embed", side_effect=embeddings), patch("api.rag.client.chat", return_value=missing):
            service.process_next()
        job.refresh_from_db(); self.assertEqual(job.status, "succeeded")
        self.assertEqual(self.api.post(f"/api/ai/generations/{job.pk}/accept", {"idea_index": 0}, format="json").status_code, 409)

    def test_model_failure_preserves_accepted_strategy(self):
        job = self.generated()
        self.api.post(f"/api/ai/generations/{job.pk}/accept", {"idea_index": 0}, format="json")
        next_job = self.queued()
        with patch("api.rag.client.embed", side_effect=embeddings), patch("api.rag.client.chat", side_effect=client.AIError("The local model timed out.")):
            service.process_next()
        next_job.refresh_from_db(); self.assertEqual(next_job.status, "failed")
        self.goal.refresh_from_db(); self.assertEqual(self.goal.strategy.status, "Approved")

    def test_performance_recommendation_requires_and_snapshots_results(self):
        job = self.generated(); accepted = self.api.post(f"/api/ai/generations/{job.pk}/accept", {"idea_index": 0}, format="json")
        cid = accepted.data["campaign_id"]
        request = {"kind": "recommendation", "campaign_id": cid}
        self.assertEqual(self.api.post("/api/ai/generations", request, format="json").status_code, 400)
        campaign = self.business.campaigns.get()
        ChannelResult.objects.create(campaign=campaign, channel="Instagram", impressions=100, clicks=10, leads=2, members=1, source="Typed")
        job = self.queued("recommendation", campaign_id=cid)
        self.assertEqual(job.snapshot["results"][0]["members"], 1)
        self.assertEqual(job.snapshot["results"][0]["source"], "Typed")

    def test_interrupted_jobs_recover_as_retryable_failures(self):
        self.upload(); job = AIJob.objects.get()
        AIJob.objects.filter(pk=job.pk).update(status="running", updated_at=timezone.now()-timedelta(minutes=13))
        self.assertFalse(service.process_next())
        job.refresh_from_db(); self.assertEqual(job.status, "failed")
        self.assertEqual(self.business.sources.get().status, "Failed")

    def test_embedding_and_chat_validation_rejects_remote_or_bad_output(self):
        with override_settings(OLLAMA_BASE_URL="https://example.com"), self.assertRaises(client.AIError):
            client.embed(["Private business text"])
        for vectors in [[[0, 0]], [[float("nan"), 1]], [[1, 2], [1]]]:
            with patch("api.rag.client.request", return_value={"embeddings": vectors}), self.assertRaises(client.AIError):
                client.embed(["one"])
        with self.assertRaises(ValueError):
            validate_answer(answer([{"citation_id": "S1"}]), [{"citation_id": "S1", "text": "An unrelated document passage."}])

    def test_conflict_detection_forces_clarification_even_when_model_says_ready(self):
        raw = json.loads(answer([{"citation_id": "S1"}]))
        raw["conflicts"] = ["Two different introductory prices are listed."]
        result = validate_answer(json.dumps(raw), [{"citation_id": "S1", "text": BRIEF}])
        self.assertEqual(result["status"], "needs_information")
        self.assertEqual(result["ideas"], [])
        self.assertTrue(result["missing_information"])

    def test_invented_benchmark_is_rejected_even_with_valid_citations(self):
        raw = json.loads(answer([{"citation_id": "S1"}]))
        raw["ideas"][0]["success_metrics"] = ["Achieve a 99% engagement rate"]
        with self.assertRaisesRegex(ValueError, "numeric success"):
            validate_answer(json.dumps(raw), [{"citation_id": "S1", "text": BRIEF}], {"goal": {"target": 20}})

    def test_deletion_during_inference_cannot_restore_private_evidence(self):
        source = self.indexed(); job = self.queued()
        def delete_then_respond(messages, schema, **kwargs):
            evidence = json.loads(messages[1]["content"])["DOCUMENT_EVIDENCE"]
            self.api.delete(f"/api/sources/{source.public_id}")
            return answer(evidence)
        with patch("api.rag.client.embed", side_effect=embeddings), patch("api.rag.client.chat", side_effect=delete_then_respond):
            service.process_next()
        job.refresh_from_db()
        self.assertEqual(job.status, "invalidated")
        self.assertEqual(job.output, {}); self.assertEqual(job.evidence, [])

    def test_edited_goal_starts_new_goal_after_acceptance(self):
        job = self.generated()
        self.api.post(f"/api/ai/generations/{job.pk}/accept", {"idea_index": 0}, format="json")
        response = self.api.put("/api/goals", {"text": "A new plan", "outcome": "Class bookings", "target": 10, "budget": 100, "deadline": "2026-12-22", "channels": ["Instagram"]}, format="json")
        self.assertEqual(response.status_code, 200)
        self.assertNotEqual(response.data["goal"]["id"], self.goal.public_id)
        self.goal.refresh_from_db(); self.assertEqual(self.goal.text, "Attract introductory bookings")

    def test_non_object_requests_fail_gracefully(self):
        for path in ["/api/knowledge/search", "/api/ai/generations", "/api/sources"]:
            self.assertEqual(self.api.post(path, ["not an object"], format="json").status_code, 400)

    def test_invented_numbers_in_proposed_public_copy_are_rejected(self):
        raw = json.loads(answer([{"citation_id": "S1"}]))
        raw["ideas"][0]["proposed_actions"] = ["Post 'Your first class is a 15-minute intro session' on Instagram"]
        with self.assertRaisesRegex(ValueError, "Quoted public copy"):
            validate_answer(json.dumps(raw), [{"citation_id": "S1", "text": BRIEF}])

    def test_recommendation_observations_must_match_recorded_values(self):
        raw = json.loads(answer([{"citation_id": "S1"}]))
        raw["observations"] = [{"channel": "Instagram", "metric": "members", "value": 4, "source": "Typed"}]
        context = {"results": [{"channel": "Instagram", "members": 4, "source": "Typed"}]}
        evidence = [{"citation_id": "S1", "text": BRIEF}]
        self.assertEqual(validate_answer(json.dumps(raw), evidence, context, recommendation=True)["observations"][0]["value"], 4)
        raw["observations"][0]["value"] = 400
        with self.assertRaisesRegex(ValueError, "Performance observations"):
            validate_answer(json.dumps(raw), evidence, context, recommendation=True)
