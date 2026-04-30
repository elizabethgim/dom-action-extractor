# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Frontend (React + Vite, port 5173)
npm run dev
npm run build
npm run lint

# Backend (FastAPI + Python, port 8000)
PYTHONPATH=backend backend/.venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

Both servers must be running together. Vite proxies `/api` requests to `http://127.0.0.1:8000`.

## Architecture

This tool renders interactive D3/Observable charts, intercepts their DOM event listeners, runs an AI agent loop that reads the chart and decides which actions to perform, and collects the resulting visual effects.

### Frontend (`src/`)

**Pages (React Router)**
- `/` or `/system` → `SystemPage`: select a chart, render it, pick a question, then navigate to `/ai`
- `/ai` → `AiPage`: runs the AI step-debugger loop and shows intermediate responses
- `/animation` → `AnimationPage`: plays back a recorded step sequence
- `/debug`, `/settings` → developer utilities

**Core action extraction pipeline** (`src/core/actionExtractor/`)
1. `hook.ts` — monkey-patches `EventTarget.prototype.addEventListener` globally to record every listener into a `Map<Element, Record<eventType, Set<Listener>>>` registry. Must be installed before the chart renders.
2. `extractActions.ts` — walks the hook registry, filters to SVG-descendant elements, assigns stable `action-id-{eventType}` attributes, and builds the `actionRegistry` used by the AI loop.
3. `actionLogger.ts` — installs a capture-phase document listener + MutationObserver to log user/auto actions and DOM mutations in real time.
4. `d3Run.ts` — fires D3's internal `__on` handlers directly (bypasses DOM events) for programmatic action execution.
5. `effect.ts` — captures before/after screenshots and calls the AI to infer what visual effect an action produced.

**Chart adapters** (`src/core/charts/`)
- `d3Adapter` — wraps a D3 render function; creates `.chartMount.chartMount--d3` inside the container.
- `observableAdapter` — runs Observable notebooks via `@observablehq/runtime`.
- `iframeAdapter` — embeds an HTML file in an `<iframe>` (used for Tableau).
- All adapters expose `{ mount, unmount, getInfo }`.

**Chart registry** (`src/core/charts/chartRegistry.ts`) — maps `"{source}:{slug}"` string IDs (e.g., `"csv:covid"`, `"observable:zoom-area"`) to adapter instances. This is the single source of truth on the frontend side.

**AI runner loop** (`src/hooks/useAiRunnerMachine.ts`)
Each step: capture screenshot → `extractActions` → call `decideNextAction` (posts to `/chat` with prompt + image) → parse AI JSON response → optionally execute the chosen action → repeat up to `maxStep` (default 7). Stops on `ANSWERED`, `NO_PLAN`, `NO_ACTION`, `MAX_STEP`, `USER_STOP`, or `ERROR`.

**AI/LLM calls** (`src/core/interpretation/sendToAI.ts`, `src/core/ai/sendToAI.ts`)
Posts `{ prompt, model, images }` to a path like `/chat`. Default model is `"llava:latest"` (local multimodal LLM). Images are base64-encoded screenshots from `html2canvas`.

**Path aliases** (defined in `vite.config.ts`):
```
@           → src/
@components → src/components/
@core       → src/core/
@styles     → src/styles/
@hooks      → src/hooks/
@datasets   → datasets/
@debug      → src/debug/
```

### Backend (`backend/`)

FastAPI app with two routers:
- `GET /charts` — lists the chart catalog from SQLite (`backend/data/app.db`)
- `GET /charts/{chart_id}` — gets a single chart entry
- `GET /datasets` — lists available datasets

The SQLite database is created and seeded automatically on startup from `backend/app/domain/charts/registry.py` (`CHARTS` dict). Adding a chart requires an entry in that dict.

The `/chat` AI endpoint is **not** in this codebase — it is expected to be served separately (e.g., Ollama).

## Adding a Chart

1. Implement the render function in `datasets/` (D3) or as an Observable notebook.
2. Register it in `src/core/charts/chartRegistry.ts` using the appropriate adapter and a `"{source}:{slug}"` key.
3. Add a matching `ChartDefinition` entry to `backend/app/domain/charts/registry.py` with the same `id`.
4. Optionally add chart metadata (title, description, tags) to `src/core/info/d3InfoMap.ts`.
