# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Predicting bicycle thefts in Fukuoka city. Two independent sub-projects share one untracked `data/` directory at the repo root:

- `backend/`: Python 3.15 package `bicycle_theft` (managed with uv, `src/` layout, `uv_build` backend). It holds the data pipeline and, later, the model and the FastAPI service.
- `frontend/`: React 19 + TypeScript + Vite app (pnpm) that renders a MapLibre map via `react-map-gl/maplibre`. Most of it is still Vite template code.

## Commands

Run backend commands from `backend/` and frontend commands from `frontend/`.

```sh
# backend
uv sync                      # install deps (dev group includes ipykernel for notebooks/)
uv run pipeline              # raw theft CSVs -> data/processed/fukuoka_bicycle_thefts.parquet
uv run census-bbox           # print WGS84 bbox of census boundary shapefiles
uv run download-pmtiles      # extract Fukuoka basemap to data/raw/fukuoka.pmtiles (needs the `pmtiles` CLI on PATH)

# frontend
pnpm install
pnpm dev                     # Vite dev server
pnpm build                   # tsc -b && vite build (type-check is part of build)
pnpm lint                    # oxlint
```

There is no test suite or Python linter configured yet.

## Architecture

**Data paths.** `bicycle_theft/paths.py` resolves `REPO_ROOT` from its own file location (`parents[3]`), and every script imports `RAW_DIR` / `PROCESSED_DIR` from it. Use these constants instead of hard-coding paths. If you move `paths.py`, update the `parents[...]` index. Expected layout under `data/raw/`: `bicycle-thefts/*.csv` (yearly files), `census/boundary/` (e-Stat shapefiles, one per ward), `census/population/`, and `fukuoka.pmtiles`. The e-Stat download URLs for the census data are listed in `README.md`.

**Pipeline (`pipeline.py`).** This is a dlt pipeline with a custom `@dlt.destination` that copies dlt's Parquet load file straight into `data/processed/<table>.parquet`. `batch_size=0` makes the sink receive the file path rather than rows. The table uses `write_disposition="replace"`, so each run rebuilds it from scratch. The raw CSVs are messy in ways the code handles on purpose:
- Encoding varies by year: cp932 (not strict shift_jis) or UTF-8 with a BOM. `decode()` tries both.
- Column sets differ across years, so frames are concatenated with `how="diagonal"`.
- Some files are padded with all-null rows (about 1M in 2018), and these are filtered out.
- `発生年月日（始期）` can be `YYYY/M/D`, `YYYYMMDD`, or an Excel serial number. `発生時（始期）` is cast to Int8. `不明` becomes null, and any other value that fails to parse raises an error. Keep that strictness when you add columns.
- Column names stay in the original Japanese.

**Basemap.** `download-pmtiles` reuses `census_bbox()` to clip the newest Protomaps daily planet build (`build-metadata.protomaps.dev/builds.json`) to the census boundary extent. Because of this, the boundary shapefiles must exist before you download tiles.

**Notebooks.** `backend/notebooks/` uses the backend venv (`.vscode/settings.json` points the interpreter at `backend/.venv`) and imports from `bicycle_theft.paths` to load the processed Parquet with polars.

## Conventions

- Commits use Conventional Commits with a scope, e.g. `feat(frontend): ...`, `chore(dependencies): ...`.
- Backend code uses polars for data work (pandas and geopandas are used only for shapefile handling). Comments explain *why* data quirks exist, so keep that style.
