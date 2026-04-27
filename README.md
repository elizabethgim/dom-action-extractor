# DOM Action Effect Extractor

Interactive chart DOM elements are inspected, chart actions are executed, and the resulting visual/effect changes are collected for analysis. The frontend is built with React, TypeScript, and Vite, with dataset/chart assets stored under `src/datasets` and `public`.

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
├── src/
│   ├── main.tsx
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
│   ├── datasets/
│   │   ├── synthetic/
│   │   └── real-world/
│   ├── styles/
│   └── types/
└── backend/
    ├── app.ts
    ├── routes/
    ├── keywords/
    ├── app/
    │   ├── main.py
    │   ├── core/
    │   ├── routes/
    │   └── domain/
    └── example/
```

## Main Areas

- `src/pages`: top-level application pages and routing targets.
- `src/components`: UI panels for chart building, extraction, and AI run workflows.
- `src/hooks`: stateful React logic for extraction, rendering, filtering, and AI runner behavior.
- `src/core/actionExtractor`: DOM action discovery, probing, logging, and inferred effect extraction.
- `src/core/autoAction`: automated hover, click, double-click, brush, and wheel actions.
- `src/core/charts`: chart registry, adapters, loaders, and chart question metadata.
- `src/core/markExtractor`: axis, label, path, and data mark extraction utilities.
- `src/datasets`: synthetic and real-world chart examples used by the app.
- `backend`: experimental API, keyword extraction utilities, and dataset loader services.
