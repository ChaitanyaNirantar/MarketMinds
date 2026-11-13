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

That migrates SQLite, loads the Iron Peak Fitness demo workspace, and serves **http://127.0.0.1:8000**.

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

Open **http://localhost:5173**. Log in with the demo account:

| | |
| --- | --- |
| Email | `you@business.com` |
| Password | `password123` |

There is also a **Use demo account** link on the login screen. Sign up creates a real (empty) account in SQLite.

Check the API is up: http://127.0.0.1:8000/api/health

Django admin: http://127.0.0.1:8000/admin/ (create a superuser with `python manage.py createsuperuser` if you want it).

## What the backend stores

Approving a post, connecting Facebook, retrying a failed publish, saving results, editing the business profile, and accepting a recommendation all persist in SQLite. Restarting the servers keeps your changes until you run `python manage.py seed_demo` again, which resets the demo account.

Indexing progress and strategy generation are still simulated (no live LLM or document parser). They run as Django endpoints instead of browser-only mock state.

## Connecting real Facebook and Instagram accounts

Without credentials, every platform stays in **demo mode**: **Connect** just marks it connected and nothing is posted. Add Meta app credentials and Facebook and Instagram switch to real sign-in, publishing and stats. LinkedIn stays in demo mode for now.

**What you need**

- A Facebook **Page**, and an Instagram **Business or Creator** account (personal Instagram accounts have no API access).
- A Meta app at [developers.facebook.com](https://developers.facebook.com/apps) (type **Business**) with two products added:
  - **Facebook Login for Business**. Add the redirect URI `<PUBLIC_BASE_URL>/api/oauth/facebook/callback`.
  - **Instagram → API setup with Instagram login**. Add the redirect URI `<PUBLIC_BASE_URL>/api/oauth/instagram/callback`, and note the separate *Instagram* app ID and secret.
- An HTTPS tunnel to Django (`ngrok http 8000` or `cloudflared tunnel --url http://localhost:8000`). Meta must reach the sign-in callback, and Instagram downloads post images from your server.
- For Meta's required app callbacks, use `<PUBLIC_BASE_URL>/api/meta/deauthorize` and `<PUBLIC_BASE_URL>/api/meta/data-deletion`.

While the app is in **Development mode** it works right away for anyone with a role on the app (add yourself as an admin or tester). Before other businesses can connect, the app needs **App Review** for each permission and **Business Verification**.

**Setup**

1. Copy `backend/.env.example` to `backend/.env`, then fill in `PUBLIC_BASE_URL` (your tunnel URL), the Facebook and Instagram app IDs and secrets, and a `TOKEN_ENCRYPTION_KEY`.
2. Restart Django, then run `python manage.py migrate`.
3. In the app, open **Schedule** and click **Connect** on Facebook or Instagram. If your account manages several Pages, you'll be asked which one to post as.
4. Add an image to each Instagram post on the **Content** page. Instagram can't publish without one.
5. Publish: click **Publish now** in the publication log, or leave the scheduler running so posts go out at their scheduled time:

   ```bash
   python manage.py run_scheduler        # publishes due posts every minute, syncs stats every 3 hours
   ```

   In production, run `python manage.py publish_due_posts` every minute and `python manage.py sync_metrics` every few hours from cron or a task queue instead.
6. On **Results**, click **Sync now** to pull views and clicks for published posts into rows labelled `Connected`. Leads and members are never overwritten, because the platforms don't know who joined.

**How it's built**

| Piece | Where |
| --- | --- |
| Shared provider interface and Graph API error handling | `backend/api/integrations/base.py` |
| Facebook Pages (sign-in, Page picking, `/feed` and `/photos`, post insights) | `backend/api/integrations/facebook.py` |
| Instagram with Instagram Login (two-step media publish, insights, 60-day token refresh) | `backend/api/integrations/instagram.py` |
| Captions with tracked (`utm_*`) landing-page links | `backend/api/integrations/captions.py` |
| Token encryption at rest (Fernet) | `backend/api/integrations/crypto.py` |
| Publishing, scheduler and stats roll-up | `backend/api/social.py` |
| Endpoints (sign-in, callback, Page picking, publish now, sync, image upload, Meta callbacks) | `backend/api/social_views.py` |

Safety rules built in:
- Tokens are encrypted at rest and never sent to the browser.
- Sign-in uses a signed, single-use, 10-minute `state` value.
- Facebook calls carry `appsecret_proof`.
- A post more than 6 hours overdue is marked failed instead of being posted late, so connecting a real account never sends out stale demo posts.
- An expired token marks the account **Reconnect** and fails its posts with a clear message.

Run the backend tests (Meta is faked; no network calls):

```bash
cd backend && python manage.py test api
```

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

- Real LLM calls, document parsing/embeddings
- LinkedIn and X integrations (Facebook and Instagram are real once configured)
- Meta Lead Ads webhooks (real leads), carousels/reels/stories publishing, and a date picker beyond the fixed week of Nov 2
- Production hardening: Postgres, object storage for images (S3/R2), a proper task queue. Settings now read from environment variables, but `DEBUG` defaults to on
