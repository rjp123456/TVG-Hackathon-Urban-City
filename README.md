# CityTwin AI

Single-page Next.js control-center demo for urban energy digital twin simulation.

## What This Demo Includes

- Next.js App Router + React + TypeScript + Tailwind CSS
- Fully client-side deterministic 72-hour simulation (no backend, no external APIs)
- Sci-fi glass/neon UI with interactive controls
- SVG hex map of 8 districts with stress color states
- SVG forecast chart (city load vs capacity)
- Scenario presets and intervention toggles/sliders
- AI-style risk feed + recommendations + impact summary

## Project Structure

- `app/page.tsx`: main screen and state orchestration
- `components/*`: UI modules (map, chart, controls, AI panel, top bar, shell)
- `lib/cityData.ts`: exact district/edge/scenario dataset
- `lib/simulation.ts`: deterministic simulation engine
- `lib/recommendations.ts`: recommendation/risk logic
- `types/city.ts`: core types

## Prerequisites

- Node.js 18.17+ (Node 20 LTS recommended)
- npm 9+ (or pnpm/yarn if preferred)
- If you use `nvm`, run:

```bash
nvm use
```

## Install

```bash
npm install
```

## Run Locally (Dev)

```bash
npm run dev
```

Open:

- `http://localhost:3000`

## Production Build Check (Recommended before demo)

```bash
npm run typecheck
npm run build
npm run start
```

Then open `http://localhost:3000`.

## Quick Demo Flow (Hackathon Script)

1. Start in `Baseline` scenario.
2. Point out `Resilience Score` and stable map colors.
3. Switch scenario to `Heatwave + EV Surge`.
4. Click `Play` in top scrubber and watch `T+18h` to `T+22h`.
5. Show Downtown turning high-stress/red and risk feed overload alert.
6. In Intervention Console, set:
   - `Storage MWh = 3.0`
   - `Microgrid = ON`
   - `Demand Response = ON`
7. Click `RUN 72H SIMULATION`.
8. Show lower stress, improved recommendations, and resilience jump.
9. Close with: `Cities can test interventions before spending millions.`

## How To Use the App

### Top Bar

- **Scenario dropdown**: Instantly applies preset parameters.
- **Reset**: Returns to baseline + hour 0.
- **Play/Pause + slider**: Moves current hour from `T+0h` to `T+72h`.
- **KPIs**: Grid Health, Carbon Intensity, Peak Risk at selected hour.

### Left Panel (Intervention Console)

- Sliders:
  - `EV Adoption Delta` (`-0.05` to `+0.30`)
  - `Solar Delta` (`-0.10` to `+0.30`)
  - `Storage MWh` (`0` to `5`)
- Toggles:
  - Microgrid
  - Demand Response
  - Heatwave
  - Storm
  - Event
- `RUN 72H SIMULATION` button triggers pulse feedback; simulation is already live-updating.

### Center Panel (Hex City Map)

- Click any district hex to inspect it in AI panel.
- Color indicates stress at selected hour:
  - Green: low stress
  - Yellow: moderate
  - Orange: high
  - Red: overload risk
- Hover a hex to see tooltip (load/capacity/stress/probability).
- Animated edge particles indicate power-flow links.

### Bottom Panel (Forecast Chart)

- Green line: city load forecast.
- Cyan dashed line: city capacity forecast.
- Yellow vertical line: selected hour.
- Click or drag across chart to scrub time.

### Right Panel (AI Panel + Metrics)

- Metric cards: resilience, peak load, overload count, carbon at current hour.
- Selected district status card.
- Mission risk feed updates with scenario/controls.
- Recommended actions (max 3) with confidence + expected impact.
- Impact summary compares current setup vs baseline.

## Troubleshooting

### Port 3000 is busy

```bash
PORT=3001 npm run dev
```

Then open `http://localhost:3001`.

### Tailwind styles do not appear

- Confirm `app/globals.css` includes `@tailwind base/components/utilities`
- Confirm `tailwind.config.ts` content includes `app` and `components`
- Restart dev server

### Type errors on first install

- Run `npm install` again
- Ensure Node version is 18.17+

## Notes

- This project intentionally uses deterministic local simulation and dummy data only.
- No external APIs are required.
