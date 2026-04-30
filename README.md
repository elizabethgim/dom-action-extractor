# DOM Action Effect Extractor

Interactive chart DOM elements are inspected, chart actions are executed, and the resulting visual/effect changes are collected for analysis. The frontend is built with React, TypeScript, and Vite, with dataset/chart assets stored under `datasets` and `public`.

## Getting Started

```bash
npm install
npm run dev
```

Build and lint:

```bash
npm run build
npm run lint
```

```bash
PYTHONPATH=backend backend/.venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
python -m uvicorn backend.app.main:app --reload
```

## Directory Structure

```text
.
├── README.md
├── index.html
├── package.json
├── vite.config.ts
├── tsconfig.json
├── scripts/
│   └── shorten-observable-file-names.js
├── public/
│   ├── *.csv
│   └── tableau/
├── datasets/
│   ├── index.js
│   ├── synthetic/
│   └── real-world/
├── src/
│   ├── main.tsx
│   ├── debug/
│   │   └── debugBus.ts
│   ├── pages/
│   │   ├── App.tsx
│   │   ├── AiPage.tsx
│   │   ├── DebugPage.tsx
│   │   ├── SettingsPage.tsx
│   │   └── SystemPage.tsx
│   ├── components/
│   │   ├── builder/
│   │   ├── extracter/
│   │   └── runner/
│   ├── hooks/
│   ├── services/
│   │   ├── chartApi.ts
│   │   └── datasetApi.ts
│   ├── core/
│   │   ├── actionExtractor/
│   │   ├── ai/
│   │   ├── autoAction/
│   │   ├── charts/
│   │   ├── info/
│   │   ├── interpretation/
│   │   ├── markExtractor/
│   │   ├── models/
│   │   ├── prompts/
│   │   └── utils/
│   ├── styles/
│   └── types/
└── backend/
    ├── app.ts
    ├── package.json
    ├── tsconfig.json
    ├── data/
    │   └── app.db
    ├── routes/
    ├── keywords/
    ├── app/
    │   ├── main.py
    │   ├── core/
    │   │   ├── database.py
    │   │   └── settings.py
    │   ├── routes/
    │   │   ├── charts.py
    │   │   └── datasets.py
    │   └── domain/
    │       ├── charts/
    │       │   ├── registry.py
    │       │   ├── repository.py
    │       │   ├── schemas.py
    │       │   └── service.py
    │       └── datasets/
    │           ├── loaders/
    │           ├── registry.py
    │           ├── schemas.py
    │           └── service.py
    └── example/
```

### Backend
```text
DOM-ACTION-EFFECT-EXTRACTOR/
├── backend/
│   ├── .venv/
│   ├── app/
│   │   ├── core/
│   │   │   ├── database.py
│   │   │   └── settings.py
│   │   ├── domain/
│   │   │   ├── ai_runs/
│   │   │   ├── charts/
│   │   │   └── datasets/
│   │   ├── routes/
│   │   │   ├── ai_runs.py
│   │   │   ├── charts.py
│   │   │   └── datasets.py
│   │   └── main.py
│   └── ...
├── frontend/
│   └── ...
└── ...
```

## Main Areas

- `src/pages`: top-level application pages and routing targets.
- `src/components`: UI panels for chart building, extraction, and AI run workflows.
- `src/hooks`: stateful React logic for extraction, rendering, filtering, and AI runner behavior.
- `src/services`: frontend API clients for chart catalog and dataset endpoints.
- `src/core/actionExtractor`: DOM action discovery, probing, logging, and inferred effect extraction.
- `src/core/autoAction`: automated hover, click, double-click, brush, and wheel actions.
- `src/core/charts`: chart registry, adapters, loaders, and chart question metadata.
- `src/core/markExtractor`: axis, label, path, and data mark extraction utilities.
- `src/debug`: lightweight debug/event utilities.
- `datasets`: synthetic and real-world chart examples imported through the `@datasets` alias.
- `backend/app/domain/charts`: visualization catalog schemas, seed registry, SQLite repository, and API service.
- `backend/app/domain/datasets`: dataset metadata, loaders, and data service.
- `backend/app/routes`: FastAPI routers for `/charts` and `/datasets`.
- `backend/data/app.db`: local SQLite database for visualization catalog metadata. The file is created and seeded automatically on backend startup.
