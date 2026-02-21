# CityTwin AI Austin

CityTwin AI Austin is a single-screen, sci-fi urban energy control center built for the UT hackathon. It combines deterministic local simulation with lightweight ERCOT live seeding for demo credibility.

## Live Demo

- Vercel: https://tvghackathonurbancity.vercel.app/
- Video Walkthrough (Loom): https://www.loom.com/share/b4a26fd8b8d44f6782832e2aca1476a9

## Tech Stack

- Next.js 14 (App Router)
- React + TypeScript
- Tailwind CSS
- SVG-based map/chart visuals
- No heavy charting libraries
- Client-side simulation with server-side proxy route for ERCOT seed fetch

## Core Features

- Austin-themed 8-district hex map (UT and city-centric labels)
- 72-hour simulation horizon with play/scrub controls
- Interactive interventions:
  - Global policies (microgrid, demand response, heatwave/storm/event)
  - District-level interventions (battery, transformer, solar, local DR)
- Budget + ROI constraints with over-budget protection
- Counterfactual recommendations (simulated impact deltas)
- Explainability drivers per district
- A/B compare mode with pinned baseline
- Live ERCOT seed mode by default:
  - Current system demand
  - Wind generation
  - Solar generation
  - Automatic fallback to synthetic mode if live fetch fails

## Architecture Overview

- `app/page.tsx`
  - Main state orchestration, simulation lifecycle, live seed fetch, compare mode
- `components/*`
  - UI modules for map, controls, forecast chart, AI panel, compare, timeline
- `lib/simulation.ts`
  - Deterministic simulation engine (with optional live input override)
- `lib/recommendations.ts`
  - Counterfactual action generation/scoring
- `lib/cityData.ts`
  - District definitions + scenarios
- `app/api/ercot/basic/route.ts`
  - Lightweight server proxy for ERCOT seed metrics

## Environment Variables

Use `.env.local` (recommended) in project root:

```bash
ERCOT_SUBSCRIPTION_KEY=your_key_here
# Optional only if endpoint requires bearer token
ERCOT_BEARER_TOKEN=
```

Template is provided in `env.example`.

## Local Development

1. Install dependencies:

```bash
npm install
```

2. Start dev server:

```bash
npm run dev
```

3. Open:

- http://localhost:3000

## Build and Type Check

```bash
npm run typecheck
npm run build
npm run start
```

## Demo Script (Fast)

1. Open app and show Austin district map + live control center layout.
2. Show mission risk feed and counterfactual actions.
3. Scrub or play 72h horizon to show stress changes.
4. Apply district interventions (battery/capacity/solar/DR) and show immediate impact.
5. Use compare mode to show deltas in peak load, overloads, resilience, and cost.
6. Mention live ERCOT seed is active by default and gracefully falls back if unavailable.

## Troubleshooting

### Missing chunk errors (e.g. `Cannot find module './xyz.js'`)

Clear build cache and rerun:

```bash
rm -rf .next
npm run dev
```

If needed, full reset:

```bash
rm -rf .next node_modules package-lock.json
npm install
npm run dev
```

### Node version instability

Use Node 20 LTS for best Next.js 14 stability.

## Notes

- This app is designed for hackathon speed and presentation quality.
- Live ERCOT integration is intentionally lightweight (seed-only), not full production telemetry.
- No secrets are exposed to the browser; ERCOT calls go through server routes.
