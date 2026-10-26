# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Predicting bicycle thefts in Fukuoka city. Two independent sub-projects share one untracked `data/` directory at the repo root:

- `backend/`: Python 3.15 package `bicycle_theft` (managed with uv, `src/` layout, `uv_build` backend). It holds the data pipeline and the FastAPI service; the model comes later.
- `frontend/`: React 19 + TypeScript + Vite app (pnpm) that renders a MapLibre map via `react-map-gl/maplibre` with a 町丁目 choropleth, a date/time slider and a detail side panel. The UI text is Japanese.

## Commands

Run backend commands from `backend/` and frontend commands from `frontend/`.

```sh
# backend
uv sync                      # install deps (dev group includes ipykernel for notebooks/)
uv run pipeline              # raw theft CSVs -> data/processed/fukuoka_bicycle_thefts.parquet
uv run build-areas           # census shapefiles -> data/processed/fukuoka_areas.{geojson,parquet} + fukuoka_city.geojson
uv run census-bbox           # print WGS84 bbox of census boundary shapefiles
uv run download-pmtiles      # extract Fukuoka basemap (census extent + 12 km) to data/raw/fukuoka.pmtiles (needs the `pmtiles` CLI on PATH)
uv run api                   # FastAPI with reload on http://127.0.0.1:8000
uv run export-openapi        # write backend/openapi.json from the FastAPI app

# frontend
pnpm install
pnpm dev                     # Vite dev server; proxies /api and /tiles to the backend
pnpm build                   # tsc -b && vite build (type-check is part of build)
pnpm lint                    # oxlint
pnpm generate:api            # ../backend/openapi.json -> src/client (@hey-api/openapi-ts)
pnpm generate_style          # @protomaps/basemaps light flavor, Japanese labels -> src/basemap-style.json
```

Regression tests run with `uv run python -m unittest discover -s tests -v` in backend/ and `pnpm test` in frontend/. Backend static checks use `uv run ruff check src tests` and `uv run ruff format --check src tests`. GitHub Actions checks tests, lint, builds, generated contract drift and dependency advisories. See `docs/audit/README.md` for the audit trail.

## Architecture

**Data paths.** `bicycle_theft/paths.py` resolves `REPO_ROOT` from its own file location (`parents[3]`), and every script imports `RAW_DIR` / `PROCESSED_DIR` from it. Use these constants instead of hard-coding paths. If you move `paths.py`, update the `parents[...]` index. Expected layout under `data/raw/`: `bicycle-thefts/*.csv` (yearly files), `census/boundary/` (e-Stat shapefiles, one per ward, all seven wards), `census/population/`, and `fukuoka.pmtiles`. The e-Stat download URLs for the census data are listed in `README.md`.

**Pipeline (`pipeline.py`).** Reads `data/raw/bicycle-thefts/*.csv` into Polars, validates the required date/hour columns, unions yearly schemas, and writes one complete Parquet file to a temporary sibling before atomically replacing `data/processed/fukuoka_bicycle_thefts.parquet`. Missing CSVs and invalid inputs fail without replacing the previous output. The old per-load-file dlt sink was removed because it searched the wrong directory and could overwrite earlier shards. The raw CSVs are messy in ways the code handles on purpose:
- Encoding varies by year: cp932 (not strict shift_jis) or UTF-8 with a BOM. `decode()` tries both.
- Column sets differ across years, so frames are concatenated with `how="diagonal"`.
- Some files are padded with all-null rows (about 1M in 2018), and these are filtered out.
- `発生年月日（始期）` can be `YYYY/M/D`, `YYYYMMDD`, or an Excel serial number. `発生時（始期）` is cast to Int8 and must be 0–23. Only positive 1–5 digit values can be treated as Excel serial dates; malformed 8-digit calendar dates fail. `不明` becomes null, and any other value that fails to parse raises an error. Keep that strictness when you add columns.
- Column names stay in the original Japanese.
- The data covers the whole prefecture; the API filters to Fukuoka city (市区町村コード starting with `4013`).

**Areas (`areas.py`).** Builds the 町丁目 layer from the census shapefiles: drops water areas (HCODE 8154), dissolves rows that share a KEY_CODE, simplifies geometry, and writes `fukuoka_areas.geojson` (for the map) plus `fukuoka_areas.parquet` (attributes only). It also unions every row, water included so 博多湾 and the rivers leave no holes, into `fukuoka_city.geojson`, the bold city outline on the map. Population is the shapefile's `JINKO` (2020 census). `normalize_area_name()` reconciles police spellings with census spellings: NFKC, variant characters (洲→州, ヶ→ケ, 桧→檜) and kanji numerals before 丁目. The API additionally falls back to the parent 町 when a 丁目 was created after the census (北原１丁目 → 北原) and to the `大字` prefix. About 99.9% of city rows map to an area. Duplicate normalized names select the largest population with a key-code tie break; parent-町 and 大字 fallbacks compose. A single legacy year may omit optional category columns.

**API (`api/`).** `schemas.py` holds every Pydantic response model; `data.py` loads the thefts and areas into memory at startup and answers the queries (all polars, a few ms each); `app.py` defines the routes. Endpoints: `/api/meta`, `/api/areas` (GeoJSON), `/api/city-outline` (GeoJSON), `/api/thefts/by-area`, `/api/thefts/summary`, `/api/thefts/timeline`, and `/tiles/fukuoka.pmtiles` (a `FileResponse`, which honours Range requests as the pmtiles client needs). Unknown timeline areas return 404, matching summary, and timelines retain zero months across the whole supported calendar. Time windows are "`days` ending on `end`" with calendar-safe bounds on `days` and both current/previous windows (invalid windows return 422) (the frontend's 全期間 sends everything since `date_min`), and hour bands wrap past midnight when `hour_to < hour_from`; the full day (0–23) also includes rows with unknown hour. Per-capita rates are null below `MIN_POPULATION_FOR_RATE` residents. `/api/meta` also lists `unrecorded_areas`, the 町丁目 with no theft in the whole data (the police evidently never file under those names); the map paints them dark grey. Route handler names become OpenAPI operation ids, hence the generated SDK function names.

**Type sync.** `backend/openapi.json` is committed and is the contract between the two projects. After changing schemas or endpoints run `uv run export-openapi` then `pnpm generate:api`; `frontend/src/client/` is generated and must not be edited by hand.

**Frontend.** `src/App.tsx` owns the state (period, metric, selected area, colour-scale lock) and fetches through `src/lib/api.ts` with the `useAsync` hook (debounced, aborts stale requests, keeps old data while loading). `src/Map.tsx` renders the Protomaps basemap from the generated `basemap-style.json` and the areas GeoJSON; theft values are pushed with `setFeatureState` (feature ids are promoted from `key_code`) so slider moves don't re-upload geometry. `src/lib/period.ts` defines the time selection (`days` is a number or `'all'`, resolved against `date_min` by `windowDays`; the hour band is start + span so it can wrap midnight, and `HourRangeSlider` maps it onto two thumbs of one 0–24 track), `src/lib/date.ts` handles holidays via `@holiday-jp/holiday_jp` (Saturday blue, Sunday/holiday red, `(祝)` marker), `src/lib/color.ts` the YlOrRd ramp and the 98th-percentile scale, with `UNRECORDED_COLOR` for areas flagged by `unrecorded_areas` (feature state `unrecorded` wins over `value`). `src/components/Charts.tsx` holds the small SVG charts: `Bars`, `CategoryList` and the `Donut` used for 発生場所 and 被害者の年齢 (five fixed category hues plus a grey その他・不明 fold). MapLibre 6 needs `setWorkerUrl` with Vite's `?worker&url` import and `optimizeDeps.exclude: ['maplibre-gl']`, otherwise the worker fails to load. Data credits live in MapLibre's attribution control, never compact, which App.css stretches into a footer bar along the bottom edge: `src/lib/attribution.ts` builds it as one ordered string (MapLibre sorts array entries by length) and replaces the style's Protomaps credit with a substring of it so MapLibre's dedupe drops the original. `useOverlayInsets` measures the footer (`insets.footer`, exposed as `--attribution-height`) so the legend, controls and the mobile bottom sheet sit above it. `public/credits.html` holds the full credits, resource URLs, processing notes and the disclaimer; keep it in step with the data sources.

**Basemap.** `download-pmtiles` reuses `census_bbox()` to clip the newest Protomaps daily planet build (`build-metadata.protomaps.dev/builds.json`) to the census boundary extent plus `MARGIN_KM`. Because of this, the boundary shapefiles must exist before you download tiles. `Map.tsx` limits panning to `CITY_EXTENT` (the city without the far-off 小呂島) padded by `VIEW_MARGIN_KM`, which must stay below `MARGIN_KM`. `useOverlayInsets` measures the overlay panels: the side panel becomes map padding so the bounds are balanced in the visible part of the map, while the controls panel's height is added to the north bound at the current zoom (`constrainToCity`, re-run on every zoom) so the map can be dragged down from under it without raising the minimum zoom. The build listing rejects urllib's default User-Agent, so the script sends its own. Fonts and sprites still come from protomaps.github.io.

**Notebooks.** `backend/notebooks/` uses the backend venv (`.vscode/settings.json` points the interpreter at `backend/.venv`) and imports from `bicycle_theft.paths` to load the processed Parquet with polars.

## Conventions

- Commits use Conventional Commits with a scope, e.g. `feat(frontend): ...`, `chore(dependencies): ...`.
- Branches use Conventional Branch Naming: `feat/<scope>/<short-description>`, `fix/<scope>/<short-description>`, etc. Use dashes, not underscores.
- Backend code uses polars for data work (pandas and geopandas are used only for shapefile handling). Comments explain *why* data quirks exist, so keep that style.
- Frontend UI strings are Japanese; keep new labels consistent with the existing ones.
- Code is Apache-2.0 (`LICENSE`, `NOTICE`); third-party files kept in the repo are listed in `THIRD_PARTY_NOTICES.md`. Data is not covered and `data/` is never committed. `pnpm build` completes `dist/third-party-licenses.md` with a small plugin in `vite.config.ts` (maplibre-gl's pre-bundled dependencies plus `THIRD_PARTY_NOTICES.md`).
