# Repository audit — 2026-10-25

Baseline: `0022d1a` (`main`); working tree was clean. Review covers all tracked application modules, generated API contract/client, configuration, lockfiles, notebook code and documentation. Raw datasets and generated map tiles are local inputs, not committed source. Prediction is explicitly unimplemented and is not classified as a bug.

## Project map and boundaries

| Path | Responsibility / entry points |
| --- | --- |
| `backend/src/bicycle_theft/pipeline.py` | Yearly police CSV ingestion (`pipeline`) |
| `backend/src/bicycle_theft/areas.py` | Census shapefile normalization / area and outline generation (`build-areas`) |
| `backend/src/bicycle_theft/census_bbox.py`, `download_pmtiles.py` | Boundary extent / external Protomaps download |
| `backend/src/bicycle_theft/api/` | In-memory joins and statistics, FastAPI (`api`), OpenAPI exporter |
| `backend/notebooks/eda.ipynb` | Exploratory analysis, not a production entry point |
| `backend/openapi.json`, `frontend/src/client/` | Generated HTTP contract and fetch SDK |
| `frontend/src/App.tsx`, `Map.tsx` | State / requests and MapLibre rendering |
| `frontend/src/components/`, `hooks/`, `lib/` | Charts, controls, async lifecycle, dates, periods and colors |
| `frontend/vite.config.ts` | Local API/tiles proxies and MapLibre worker bundling |
| `data/raw/`, `data/processed/` | Untracked local data shared by pipeline and API |

Python 3.15+, uv/uv_build, Polars, GeoPandas/Pandas/PyArrow, FastAPI/Pydantic/Uvicorn; TypeScript 6, React 19, Vite 8, pnpm, MapLibre, PMTiles. No database, authentication, writes over HTTP, or prediction model. Backend binds to loopback. External boundaries are manual police/census downloads, Protomaps metadata/tiles, hosted glyphs/sprites, and package/advisory registries. The frontend production build needs a same-origin reverse proxy for `/api` and `/tiles`; Vite's dev proxy is not a deployment server.

## Baseline and process

- Frontend production build and Oxlint pass; bundler reports a large map bundle (performance observation, not a demonstrated defect).
- No original tests, backend linter, CI, deployment pipeline, performance budgets or benchmark suite.
- Local dataset: 33,789 city thefts, 1,140 areas; duplicate census names and 13 unmapped thefts require care. Missing matches alone do not establish a code defect.
- Review code and contract → reproduce with deterministic fixtures → record severity/impact/root cause → create a fix branch → commit a failing test → apply minimal fix → run targeted and regression checks → commit fix → consolidate on the audit branch.
- Severity: high = corrupt output, broken core workflow or published high advisory; medium = incorrect statistics/contract or request-triggered failures; low = limited display/accessibility defects. No critical issue is asserted without evidence.
- Branches are stacked from the previous reviewed fix, preserving independent branch tips and Conventional Commits. No changes are pushed or deployed.

## Limitations

A finite audit cannot prove the absence of all bugs or vulnerabilities. Reports distinguish reproduced defects, published dependency advisories, preventive improvements and unverified risks. Data source semantics, future upstream changes, full browser/GPU behavior and internet services require separate validation. The `ccc` semantic index was unavailable: initialization requires writing global settings outside the workspace. Direct source search and review are used instead.

Final findings, reproduction steps, validation results and preventive recommendations are recorded alongside this document.
