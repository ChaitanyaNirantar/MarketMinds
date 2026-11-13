# MarketMinds

**AI Marketing Manager for small businesses.** Turn a plain-language marketing goal into a strategy, a campaign, and approved posts, then measure it by leads and members instead of likes and use what you learn to plan the next campaign.

```
Goal → Strategy → Campaign → Content → Approval → Publish or export → Results → Learn → Next goal
```

The example business is **Iron Peak Fitness**, a strength-training studio in Champaign, IL.

## Stack

| Concern | Choice |
| --- | --- |
| UI | React 18 + TypeScript + Vite 5 + Tailwind CSS 3 |
| API | Django 5.1 + Django REST Framework 3.15 |
| Database | SQLite (`backend/db.sqlite3`, created on first run) |
| Auth | DRF token auth |

The React app talks to Django at `/api`. In development Vite proxies that to `http://127.0.0.1:8000`.

## Run locally (two terminals)

Requirements: **Python 3.10+** and **Node.js 18.18+**.

**Terminal 1 — Django API**

```bash
chmod +x scripts/start-backend.sh scripts/start-frontend.sh
./scripts/start-backend.sh
```

That migrates SQLite and serves **http://127.0.0.1:8000**.

Or by hand:

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -r requirements.txt
python manage.py migrate
python manage.py seed_demo         # reset demo data any time
python manage.py runserver 8000
```

**Terminal 2 — React app**

```bash
./scripts/start-frontend.sh
```

Or: `npm install && npm run dev`

Open **http://localhost:5173** and sign up for an empty workspace. To create the optional demo account, run `python backend/manage.py seed_demo` with the backend environment active (this resets its workspace). Demo credentials:

| | |
| --- | --- |
| Email | `you@business.com` |
| Password | `password123` |

There is also a **Use demo account** link on the login screen. Sign up creates a real (empty) account in SQLite.

Check the API is up: http://127.0.0.1:8000/api/health

Django admin: http://127.0.0.1:8000/admin/ (create a superuser with `python manage.py createsuperuser` if you want it).

## What the backend stores

Approving a post, connecting Facebook, retrying a failed publish, saving results, editing the business profile, and accepting a recommendation all persist in SQLite. Restarting the servers keeps your changes until you run `python manage.py seed_demo` again, which resets the demo account.

PDF/TXT indexing, semantic retrieval, strategy ideas, and performance recommendations now use local Ollama with cited evidence. See [README_AI.md](README_AI.md) for model installation, the required background worker, evaluation, and limitations. Social connect/publishing and post generation remain simulated or unimplemented; they are not live integrations.

## Local AI workflow

Follow [README_AI.md](README_AI.md) to install `embeddinggemma` and `qwen3:4b`, start `run_ai_worker` in a separate terminal, and upload a PDF/TXT business brief. The included fictional `docs/examples/harbor-yoga.txt` is a starting example. Review citations and assumptions, then explicitly accept a strategy to create a campaign.

## Screens

| # | Screen | Route |
| --- | --- | --- |
| 1 | Log in / Sign up | `/login` |
| 2 | Business Profile onboarding | `/business/new` |
| 3 | Knowledge Base | `/knowledge` |
| 4 | Goal Entry | `/goals/new` |
| 5 | Strategy Review | `/goals/12/strategy` |
| 6 | Campaign Plan | `/campaigns/7` |
| 7 | Content Approval Queue | `/campaigns/7/content` |
| 8 | Schedule and Publishing | `/schedule` |
| 9 | Enter or Import Results | `/campaigns/7/results` |
| 10 | Dashboard | `/dashboard` |
| 11 | Campaign Analytics | `/campaigns/7/analytics` |
| 12 | AI Recommendation | `/campaigns/7/recommendation` |

## Project structure

```
backend/                 Django project
  requirements.txt     pinned Python deps
  config/              Django settings and URLs
  api/                 models, views, seed data
src/                   React app
  api.ts               fetch wrapper (Token auth)
  store/AppStore.tsx   loads /api/workspace
scripts/
  start-backend.sh
  start-frontend.sh
```

## Other commands

```bash
npm run build       # type-check and production build
npm run preview     # serve dist/ (still needs Django on :8000)
npm run typecheck
python backend/manage.py seed_demo
```

## Not in this prototype yet

- OCR, DOCX/website ingestion, AI post drafting, or live social-platform OAuth and publishing
- Production auth hardening (this is a local demo: `DEBUG=True`, SQLite, a committed dev secret)
