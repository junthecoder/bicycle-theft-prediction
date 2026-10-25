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

## Executive summary

**18 findings fixed:** 6 high, 10 medium and 2 low. No critical vulnerability was confirmed. Three high findings are separate advisories against one development dependency (`js-yaml` 4.2.0); the final lock resolves 4.3.2. The remaining findings address ingestion, date/hour validation, area matching, legacy schemas, API windows/timelines, asynchronous UI state, comparisons, accessibility, mobile controls and map presentation.

- [Detailed Markdown register](findings.md)
- [Canonical JSON register](findings.json)
- [CSV register](findings.csv)
- [Python scan before](backend-audit-before.json) / [after](backend-audit-after.json)
- [Frontend scan before](frontend-audit-before.json) / [after](frontend-audit-after.json)
- [Measured query performance](benchmarks.json)

All fixes are committed using Conventional Commits. Fix branches are stacked by component; related issues share branches and commits, rather than maintaining 18 mutually independent branches. The detailed register identifies each branch and fix commit. Failing tests were committed before implementation; dependency remediation uses the failing advisory scan as its regression check. The delivery branch is `chore/audit/repository-review`; `main` is unchanged.

## Validation results

| Check | Result |
| --- | --- |
| Backend unit/integration/regression suite | 24 tests pass, including HTTP route/range tests and synthetic geospatial fixtures |
| Frontend unit/component/regression suite | 8 tests pass, including asynchronous lifecycle, keyboard events and mobile metric selection |
| Python static analysis and formatting | Ruff passes for backend source/tests and audit scripts |
| Frontend static analysis/build | Oxlint and TypeScript/Vite build pass |
| Generated contract | OpenAPI and SDK regenerated; API patch version 0.1.1 |
| Dependency advisories | Frontend: 3 high → 0; backend: 0 before and after, among packages scanned |
| Local raw-data integration | 63,083 prefecture input rows rebuilt into a temporary output; 33,789 city rows, 33,776 mapped, 1,140 areas; 90-day city total 1,127 reconciles with area totals + unmapped |
| Live data preservation | No raw/processed user files replaced; pipeline integration output used a temporary directory |
| Warm query benchmark | 30 iterations; medians: metadata 2.880 ms, area counts 4.529 ms, summary 5.451 ms, timeline 2.077 ms |
| Browser/GPU smoke test | Not completed: browser control stalled before app navigation |
| GitHub-hosted CI | Workflow added and locally checked; remote execution is unverified |

### Re-run

```sh
# from backend/
uv sync --frozen
uv run python -m unittest discover -s tests -v
uv run ruff check src tests
uv run ruff format --check src tests
uv run export-openapi
# Optional: requires local processed data
uv run python ../scripts/benchmark.py --output ../docs/audit/benchmarks.json

# from frontend/
pnpm install --frozen-lockfile
pnpm test
pnpm lint
pnpm build
pnpm generate:api
pnpm audit --audit-level=low

# from the repository root: refresh Markdown and CSV from the JSON register
python3 scripts/export_audit.py
```

For Python advisories, export exact locked packages with `uv export --frozen --no-hashes --no-emit-project --output-file /tmp/requirements-audit.txt` from backend/, then run `uv tool run pip-audit --no-deps --disable-pip -r /tmp/requirements-audit.txt`. This audits exact pinned packages without installing their code; platform markers determine which packages are scanned. Registry errors must fail the check, not be reported as a clean scan.

## Prevention and operational follow-up

The new CI runs on pushes, pull requests and a weekly schedule. It checks deterministic tests without private data, static analysis, build, contract drift and advisories. Dependabot configuration covers uv and GitHub Actions. Frontend dependencies receive a weekly `pnpm audit`; pnpm 12 lockfile updates should be handled with the pinned pnpm CLI until supported by the update bot. [GitHub currently documents pnpm support through version 10](https://docs.github.com/en/code-security/reference/supply-chain-security/supported-ecosystems-and-repositories). Enable these checks as branch-protection requirements after the first hosted run.

The common patterns were missing domain validation, implicit assumptions about input schemas, overwrite semantics, and inconsistent treatment of absent data between views. Keep normalization deterministic and shared, validate before publication, publish complete files atomically, and test boundaries as well as successful examples.

Monitor API latency and error counts, ingestion row counts and source coverage, unmapped incidents, duplicate-name decisions, and failed range/download requests. Add a reliable browser/GPU smoke-test environment for map-worker loading, overlay-aware focusing and actual mobile layouts. The Vite map bundle remains large (~413 KB compressed plus worker); measure browser load and interaction time before setting a performance budget. No browser performance regression or source-data accuracy claim is made.

The advisory register links the supporting GitHub advisories. Package-policy configuration follows [pnpm's current build settings](https://github.com/pnpm/pnpm/blob/main/pnpm/docs/settings/build.md). CI setup references the official [setup-uv](https://github.com/astral-sh/setup-uv) and [setup-node](https://github.com/actions/setup-node) projects.
