# MarketMinds

**AI Marketing Manager for small businesses.** Turn a plain-language marketing goal into a strategy, a campaign, and approved posts, then measure it by leads and members instead of likes and use what you learn to plan the next campaign.

```
Goal → Strategy → Campaign → Content → Approval → Publish or export → Results → Learn → Next goal
```

This repo is a front-end prototype built from the MarketMinds low-fidelity wireframes. The example business is **Iron Peak Fitness**, a strength-training studio in Champaign, IL. There is no backend yet. All data is mock data held in memory (`src/data/mock.ts`), and the "AI" steps are simulated.

## Stack

| Concern | Choice |
| --- | --- |
| UI | React 18 + TypeScript |
| Build / dev server | Vite 5 |
| Styling | Tailwind CSS 3 (+ Inter variable font) |
| Routing | React Router 6 |
| Icons | lucide-react |
| State | React context (`src/store/AppStore.tsx`) |
| Screenshots | puppeteer-core (dev only) |

All dependency versions are pinned exactly in `package.json`, and `package-lock.json` locks the full tree.

## Getting started

Requirements: **Node.js 18.18+** (tested on Node 22) and npm.

```bash
npm install        # install pinned dependencies
npm run dev        # start the dev server at http://localhost:5173
```

Other scripts:

```bash
npm run build      # type-check and build to dist/
npm run preview    # serve the production build at http://localhost:4173
npm run typecheck  # TypeScript only
```

The app opens on `/login`. Any valid-looking email and password signs you in. **Log in** goes to the Dashboard, and **Sign up** starts Business Profile onboarding. Every screen is also reachable from the sidebar.

## Screens

| # | Screen | Route |
| --- | --- | --- |
| 1 | Log in / Sign up | `/login` |
| 2 | Business Profile onboarding (4-step stepper) | `/business/new` |
| 3 | Knowledge Base (RAG sources + retrieval tester) | `/knowledge` |
| 4 | Goal Entry | `/goals/new` |
| 5 | Strategy Review | `/goals/12/strategy` |
| 6 | Campaign Plan | `/campaigns/7` |
| 7 | Content Approval Queue | `/campaigns/7/content` |
| 8 | Schedule and Publishing | `/schedule` |
| 9 | Enter or Import Results | `/campaigns/7/results` |
| 10 | Dashboard (outcome-first) | `/dashboard` |
| 11 | Campaign Analytics and Channel Comparison | `/campaigns/7/analytics` |
| 12 | AI Recommendation and Next Campaign | `/campaigns/7/recommendation` |

Campaign screens share a tab bar (Plan, Content, Results, Analytics, Recommendation) so you can move between them in one click.

## Behaviour worth knowing

- **Approval never publishes.** Only approved posts count toward *Schedule approved (n)*. *Export approved* downloads a CSV and does not mark anything published.
- **Failures stay on the row that failed.** The failed Knowledge Base document and the failed Facebook post each show a plain-language reason and a Retry button. Retry on the Facebook post is enabled after you click *Connect* for Facebook (simulated OAuth).
- **Every number says where it came from.** Results rows are tagged Connected, Imported, Typed, or Sample. If you load the labeled sample, Analytics tags the funnel stages *Sample* instead of *Observed*.
- **Status is a word, not a color.** Failed items also get a dashed outline.
- **The loop closes.** *Accept and start next campaign* on the Recommendation screen opens Goal Entry with the next goal filled in.
- Indexing progress, strategy and content generation, and OAuth are simulated with timers.

## Project structure

```
src/
  App.tsx              routes
  components/
    Layout.tsx         top bar, sidebar, campaign tabs
    ui.tsx             Button, Card, StatusChip, PlatformTag, Field, …
  data/mock.ts         Iron Peak Fitness mock data
  pages/               one file per wireframe screen
  store/AppStore.tsx   shared in-memory app state
scripts/screenshots.mjs  captures every screen with headless Chrome
```

## Screenshots

With a server running (`npm run preview`), run:

```bash
BASE_URL=http://localhost:4173 OUT_DIR=./screenshots-out CHROME_PATH=/path/to/chrome npm run screenshots
```

## Not in this prototype yet

- A real backend: auth, persistence, document parsing and embeddings, LLM calls, social-platform OAuth and publishing APIs.
- Brand colours and final visual design. The wireframes leave these for later, so this UI applies a neutral indigo theme.
