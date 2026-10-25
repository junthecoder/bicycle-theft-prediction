# Fukuoka Bicycle Thefts Prediction

Interactive map of bicycle thefts in Fukuoka city by 町丁目 (census small area), with a
date/time slider, a theft-count or per-capita choropleth, and a detail panel aimed at both
residents and police. Prediction is not implemented yet.

## Layout

- `backend/`: Python (uv) data pipeline and FastAPI service. Run commands from here, e.g. `uv run pipeline`.
- `frontend/`: React + TypeScript (pnpm, Vite) map UI. Run `pnpm dev` from here.
- `data/`: raw and processed data, shared by both (not tracked).

## Setup

### 1. Data

Place the yearly theft CSVs from the Fukuoka Prefectural Police under `data/raw/bicycle-thefts/`
and the e-Stat census files listed below under `data/raw/census/`. Then, in `backend/`:

```sh
uv sync
uv run pipeline           # raw theft CSVs -> data/processed/fukuoka_bicycle_thefts.parquet
uv run build-areas        # census shapefiles -> data/processed/fukuoka_areas.{geojson,parquet}
uv run download-pmtiles   # Protomaps basemap clipped to the city -> data/raw/fukuoka.pmtiles (needs the `pmtiles` CLI)
```

### 2. Run

```sh
cd backend && uv run api          # FastAPI on http://127.0.0.1:8000 (serves /api/* and /tiles/fukuoka.pmtiles)
cd frontend && pnpm install && pnpm dev   # Vite on http://localhost:5173, proxies /api and /tiles to the backend
```

### Keeping the API types in sync

Response models are Pydantic classes in `backend/src/bicycle_theft/api/schemas.py`. After changing
them or any endpoint:

```sh
cd backend && uv run export-openapi    # writes backend/openapi.json
cd frontend && pnpm generate:api       # regenerates frontend/src/client with @hey-api/openapi-ts
```

### Basemap style

`frontend/src/basemap-style.json` is generated from `@protomaps/basemaps` (light flavor, Japanese
labels). Regenerate it after upgrading the package:

```sh
cd frontend && pnpm generate_style
```

## Dataset

### Boundary data

#### Download page
https://www.e-stat.go.jp/gis/statmap-search?page=1&type=2&aggregateUnitForBoundary=A&toukeiCode=00200521&toukeiYear=2020&serveyId=A002005212020&prefCode=40&coordsys=1&format=shape&datum=2011

#### Download links

Unzip each archive into `data/raw/census/boundary/<archive name>/`.

40131	福岡市東区	https://www.e-stat.go.jp/gis/statmap-search/data?dlserveyId=A002005212020&code=40131&coordSys=1&format=shape&downloadType=5&datum=2011
40132	福岡市博多区	https://www.e-stat.go.jp/gis/statmap-search/data?dlserveyId=A002005212020&code=40132&coordSys=1&format=shape&downloadType=5&datum=2011
40133	福岡市中央区	https://www.e-stat.go.jp/gis/statmap-search/data?dlserveyId=A002005212020&code=40133&coordSys=1&format=shape&downloadType=5&datum=2011
40134	福岡市南区	https://www.e-stat.go.jp/gis/statmap-search/data?dlserveyId=A002005212020&code=40134&coordSys=1&format=shape&downloadType=5&datum=2011
40135	福岡市西区	https://www.e-stat.go.jp/gis/statmap-search/data?dlserveyId=A002005212020&code=40135&coordSys=1&format=shape&downloadType=5&datum=2011
40136	福岡市城南区	https://www.e-stat.go.jp/gis/statmap-search/data?dlserveyId=A002005212020&code=40136&coordSys=1&format=shape&downloadType=5&datum=2011
40137	福岡市早良区	https://www.e-stat.go.jp/gis/statmap-search/data?dlserveyId=A002005212020&code=40137&coordSys=1&format=shape&downloadType=5&datum=2011

### Population data

Population per 町丁目 comes from the `JINKO` attribute of the boundary shapefiles (2020 census).
The age breakdown table below is downloaded for later use.

#### Download page
https://www.e-stat.go.jp/gis/statmap-search?page=2&type=1&toukeiCode=00200521&toukeiYear=2020&aggregateUnit=A&serveyId=A002005212020&statsId=T001082

#### Download link
https://www.e-stat.go.jp/gis/statmap-search/data?statsId=T001082&code=40&downloadType=2

### PMTiles

Run `uv run download-pmtiles` in `backend/` to download PMTiles for Fukuoka city.

## Verification and audit

Use Python 3.15+, Node.js 24 and pnpm 12.15.0 (pinned in `frontend/package.json`).

```sh
cd backend
uv sync --frozen
uv run python -m unittest discover -s tests -v
uv run ruff check src tests
uv run ruff format --check src tests
cd ../frontend
pnpm install --frozen-lockfile
pnpm test
pnpm lint
pnpm build
```

Tests use synthetic fixtures and need no untracked datasets. GitHub Actions also checks generated API drift and dependency advisories, including a weekly scan. The pnpm workspace settings restrict dependency build scripts to esbuild and require a patched js-yaml version for API generation.

The API bug-fix release is **0.1.1**. Invalid windows now return 422 instead of overflowing, unknown timeline areas return 404, and timelines include zero-count months. Existing successful response shapes are preserved.

The [repository audit](docs/audit/README.md) links the findings in Markdown, JSON and CSV, test evidence, dependency scan results, limitations and performance measurements. For production, serve the frontend build behind a same-origin reverse proxy for `/api` and `/tiles`; the Vite development proxy does not configure production hosting.
