# Document-grounded marketing assistant

MarketMinds uses a local retrieval-augmented generation (RAG) pipeline to propose strategies and performance recommendations. React displays results; Django owns authorization, retrieval, validation, jobs, and acceptance. Uploads do not train or fine-tune a model.

## Start locally

Requirements: Python 3.10+, Node 18.18+, local Ollama (EmbeddingGemma requires Ollama 0.11.10+), and enough memory for the selected models. This implementation is a local single-worker prototype, not a public-production deployment.

```sh
ollama pull embeddinggemma
ollama pull qwen3:4b
python3 -m venv backend/.venv
backend/.venv/bin/python -m pip install -r backend/requirements.txt
backend/.venv/bin/python backend/manage.py migrate
npm ci
```

Run these in three separate terminals from the repository root, with Ollama running:

```sh
backend/.venv/bin/python backend/manage.py runserver 127.0.0.1:8000
```

```sh
backend/.venv/bin/python backend/manage.py run_ai_worker
```

```sh
npm run dev
```

Open http://localhost:5173, sign up, and open Knowledge Base. Upload `docs/examples/harbor-yoga.txt` as a **Business brief**, wait for indexing, enter a goal, then generate strategy ideas. Inspect citations and assumptions, edit a title/actions if needed, and accept an idea. Acceptance creates a real campaign with zero initial performance values. Nothing is published or scheduled.

For recommendations, record results in the campaign first, then open its Recommendation tab and generate. Recommendations are review-only and use source-labeled campaign rows plus retrieved document context. They do not automatically start another campaign.

An optional demo account can be created with `backend/.venv/bin/python backend/manage.py seed_demo`. That command resets the demo workspace; do not run it against an account containing work you want to preserve. Legacy seeded knowledge entries are excluded from the real retrieval pipeline. Upload actual files even when using the demo account.

## Configuration

`.env.example` lists supported variables. `.env` files are not automatically loaded: export values in both the API and worker shells. The two processes must use the same database, private upload directory, and embedding model. Ollama is restricted to a loopback HTTP endpoint; no redirects or environment proxies are used. React never contacts Ollama directly.

The generation timeout is shared across at most two generation attempts. The default 120-second allowance is a local setting, not a latency guarantee. Indexing uses batches of eight chunks with a bounded overall duration. Run only one worker. Queued jobs remain queued until it runs; abandoned running jobs become retryable failures after 12 minutes. Do not start duplicate workers to increase capacity.

## Model choice and resources

- `embeddinggemma`: compact local embedding model used for both indexing and query embeddings; currently about 622 MB on disk. A purpose-built encoder separates retrieval from generation.
- `qwen3:4b`: roughly 2.5 GB quantized model on disk; a practical initial local baseline. Runs with thinking disabled, low temperature, JSON schema, and an 8,192-token context setting. Small-model semantic errors remain possible.
- Model sizes are not peak RAM estimates. Benchmark the actual machine with both models and concurrent application processes. The saved evaluation includes machine information and timings. CPU inference can be slower than an accelerated local runtime.
- No hosted AI service receives document content. Local operation avoids per-request API charges, but hardware, electricity and maintenance are real costs.
- Embedding model tags must not be changed in place without reindexing. The index records the configured model name, not a guaranteed immutable digest. Record `ollama list` in your deployment notes; evaluation attempts to capture installed model digests.

## Processing and storage

`React multipart upload → authenticated Django endpoint → private file + queued AIJob → worker → extract → chunk → Ollama /api/embed → KnowledgeChunk → indexed source`.

Uploads support text-based PDF and UTF-8 TXT, with 10 MB/file, 100 PDF pages, 150,000 extracted characters, 200 chunks/document, and 20 documents/business. Extraction runs in a child process with a wall timeout, CPU limit, and Linux address-space limit. macOS does not enforce the Linux memory cap. This is not a hardened hostile-file parsing sandbox.

Text is normalized without discarding page labels. Chunks are capped at 1,200 characters with approximately 120 characters overlap and paragraph/sentence boundaries where available. These are conservative character limits, not tokenizer-exact chunks. The embedding API uses `truncate: false`; model input-limit errors fail indexing instead of silently truncating. All chunks are committed atomically after successful embedding. An incomplete/failed source is never searched.

Private files have generated paths, restricted filesystem permissions, and no public media route. Duplicate file hashes are checked within a business. Reindexing uses an immutable file, removes the old chunks from search while processing, then commits the rebuilt index. There is no user-facing version-history system yet; upload a replacement as a new source and remove the outdated source.

Deleting a source removes its file/chunks, clears retained generation snapshots/output/evidence for that business, and invalidates in-flight generation writes. Accepted campaign/strategy text is retained as user-approved work; citation excerpts are removed. Backups and manual demo resets have separate retention behavior. General account deletion and backup erasure workflows are not implemented.

## Readiness and retrieval

Readiness checks real indexed sources and user-declared categories. A business brief covers services/audience; alternatively supply product documentation plus an audience profile/document. This is a transparent coverage heuristic, not proof of sufficient factual content. The model can still return `needs_information` for irrelevant, insufficient, or contradictory evidence.

Retrieval filters by the authenticated business and active embedding model **before** ranking. It computes cosine similarity over a maximum of 4,000 chunks using Python, with no external vector database. Strategy requests search the goal, products/constraints, and audience/voice; up to six passages enter the generation context. A constraints source receives a reserved passage. Filenames, locations, scores and chunk IDs are saved with each answer. Similarity is a ranking score, not a confidence percentage. There is no universal similarity cutoff or full semantic contradiction detector.

Full-scan SQLite retrieval is intended for a bounded local corpus. Larger deployments need a dedicated job queue, concurrency limits, durable object storage, and database/vector indexing with the same tenant isolation. These components are not claimed as implemented here.

## Generation and acceptance

`Goal + business profile + retrieved evidence (+ saved results for recommendations) → local Ollama chat → Pydantic schema/citation checks → saved review → explicit user acceptance`.

The model returns ideas, supporting facts and exact quotes, proposed actions, assumptions, risks, success metrics, missing information, and conflicts. Documents are explicitly untrusted data and the model has no tools. Retrieved prompt-injection text can still influence a model; the tests are evidence for selected cases, not a universal defense.

Django validates schema/lengths, citation membership, exact quote substrings (normalized whitespace/case), numbers in factual claims, numeric success thresholds against supplied context, and unsupported numbers in quoted proposed public copy. Recommendation observations must exactly match saved channel/source/metric/value tuples. Reported conflicts force `needs_information` and discard proposals. One targeted correction is allowed for invalid output. These checks do **not** prove that a paraphrased claim is entailed by a quote or that advice is sensible. Review all output; there is no automatic publishing or causal inference guarantee.

Snapshots detect changes to the business, products, goal, active documents or result rows between generation and acceptance. Acceptance is owner-scoped, transactional and idempotent. Title/action edits are explicitly user-authored changes and validated for shape/length. Accepting creates or updates the campaign belonging to that goal; source evidence remains inspectable until deletion. Failed generation does not replace an accepted strategy.

## Relevant endpoints

- `POST /api/sources`: multipart `file` and `category` → 202, indexing job.
- `POST /api/sources/{id}/retry`, `DELETE /api/sources/{id}`.
- `GET /api/knowledge/readiness`; `POST /api/knowledge/search` with `query`.
- `PUT /api/goals`: validated goal fields → workspace with real goal ID.
- `POST /api/ai/generations`: `{kind: "strategy", goal_id}` or `{kind: "recommendation", campaign_id}` → 202.
- `GET /api/ai/generations/{uuid}`: state, evidence, output, stale flag.
- `POST /api/ai/generations/{uuid}/accept`: `idea_index` plus optional `edits` (`title`, `proposed_actions`).
- `GET /api/campaigns/{id}/plan`: actual saved plan.

All endpoints require the existing DRF token authentication. Generation requests allow one active job/business and at most five new requests/minute. Retrieval is synchronous; it has bounded inputs but no distributed/global rate limiter. The existing local-demo auth and development-server setup need production hardening before public deployment.

## Verification

```sh
backend/.venv/bin/python backend/manage.py test api.tests
backend/.venv/bin/python backend/manage.py makemigrations --check --dry-run
npm run build
backend/.venv/bin/python scripts/evaluate-rag.py --output docs/evaluation/new-run.json
```

The unit/integration suite mocks only model responses and verifies real API, database, files, extraction, ownership and acceptance behavior. `evaluate-rag.py` makes actual Ollama calls using fictional fixtures in a disposable database and refuses to overwrite existing reports. Its quality fields require manual review. See `docs/RAG_EVALUATION.md` for measured results and limitations.

A headless browser smoke test is available at `scripts/test-rag-browser.mjs`. It needs Google Chrome, the API on :8000, a worker, and Vite on :5178 (`npm run dev -- --host 127.0.0.1 --port 5178`). It creates a randomly named fictional test account in that test instance, then checks upload, real generation, citations, reload persistence, acceptance, empty content and mobile layout. Run it only against a disposable test database. Screenshots are Git-ignored.

## Remaining boundaries

No OCR, DOCX parsing, website crawling, reranker, fine-tuning, automatic source authority/date resolution, or semantic entailment verifier. Source deletion is coarse-grained: it invalidates all generated suggestions for the business. The pre-existing social/publishing simulation and other dashboard demo values remain outside this PR. AI content/post generation is not implemented; this feature generates strategies and recommendations.

References: [Ollama embeddings](https://docs.ollama.com/capabilities/embeddings), [embedding API](https://docs.ollama.com/api/embed), [structured outputs](https://docs.ollama.com/capabilities/structured-outputs), [pypdf extraction](https://pypdf.readthedocs.io/en/stable/user/extract-text.html).
