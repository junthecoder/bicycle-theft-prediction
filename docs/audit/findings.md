# Findings and fixes

Audit date: 2026-10-25. Baseline: `0022d1a`. Delivery branch: `chore/audit/repository-review`. API version: `0.1.1`.

18 fixed findings: 6 high, 10 medium, 2 low; no critical finding confirmed. Three high findings are published advisories affecting one development dependency. Closely related fixes share branches/commits.

The baseline assessment, validation evidence and limitations are in [README.md](README.md). The canonical register is [findings.json](findings.json); [findings.csv](findings.csv) contains the same finding fields.

| ID | Severity | Category | Finding | Fix |
| --- | --- | --- | --- | --- |
| BUG-001 | high | integration | Pipeline cannot read the documented input layout | `f401ffb` |
| BUG-002 | high | data integrity | Malformed compact dates become Excel serial dates | `a20a4b4` |
| BUG-003 | medium | edge case | Hours outside 0–23 enter the dataset | `a20a4b4` |
| BUG-004 | high | functional | Duplicate area names select the smaller population | `c3d68ea` |
| BUG-005 | medium | functional | Parent-town and 大字 fallbacks do not compose | `c3d68ea` |
| BUG-006 | medium | integration | A single legacy year can fail API startup | `eeb72b6` |
| BUG-007 | medium | edge case | Accepted date windows cause HTTP 500 overflow | `54be6a4` |
| BUG-008 | medium | API contract | Timeline contract loses empty months and accepts unknown areas | `df3eaea` |
| BUG-009 | medium | state management | Async requests run before prerequisites and retain stale errors | `9becd3d` |
| BUG-010 | medium | functional | Ranking shows comparison deltas outside data coverage | `f80b837` |
| BUG-011 | low | accessibility | Hour-chart buttons cannot be reached or activated by keyboard | `e568cff` |
| BUG-012 | low | display | Low-population zero-count areas show a misleading numeric rate | `ccb6ae7` |
| BUG-013 | medium | functional | Map focus ignores overlay space and changes persistent padding | `ccb6ae7` |
| BUG-014 | medium | integration | Download failures leave shared partial files and metadata can wait indefinitely | `e4ca0d7` |
| BUG-015 | high | security | js-yaml merge-chain CPU exhaustion | `4170200` |
| BUG-016 | high | security | js-yaml ordered-map CPU exhaustion | `4170200` |
| BUG-017 | high | security | js-yaml empty-merge CPU exhaustion | `4170200` |
| BUG-018 | medium | functional | Mobile layout hides the only metric selector | `9bf2167` |

## BUG-001: Pipeline cannot read the documented input layout

**HIGH / P1** · integration · CSV ingestion · complexity: medium · status: fixed

Files: `backend/src/bicycle_theft/pipeline.py`.

**Observed:** Running pipeline with CSVs under data/raw/bicycle-thefts fails with cannot concat empty list.

**Expected:** Read that directory, validate each input, and publish every input row only after a successful export.

**Root cause:** The default glob targeted data/raw/*.csv. The old per-load-file destination also copied each shard to one live path.

**Impact:** The documented setup cannot rebuild its essential dataset. Direct copies also expose incomplete output; multiple load shards could overwrite one another.

**Reproduce:** Put two valid yearly CSVs under a temporary raw/bicycle-thefts directory and invoke main with temporary raw/processed paths.

**Verify:** test_pipeline.py: multi-file row count, actionable empty input, malformed input preserves old output, failed partial write preserves old output and removes staging. Full local input rebuilt to a temporary directory: 63,083 rows, no live data changed.

**Audit trail:** `fix/pipeline/reliable-parquet-output` → `f401ffb`.

## BUG-002: Malformed compact dates become Excel serial dates

**HIGH / P1** · data integrity · Date parser · complexity: low · status: fixed

Files: `backend/src/bicycle_theft/pipeline.py`.

**Observed:** 20241301 silently becomes year 57318 instead of failing validation.

**Expected:** Reject invalid calendar dates; retain documented date formats and unknown/null values.

**Root cause:** The coalesce fallback interpreted any integer as an Excel day count.

**Impact:** Corrupt dates can break Python/Pydantic date conversion and move incidents outside the visible period.

**Reproduce:** Pass 20241301 or 20250230 to parse_types with an otherwise valid hour.

**Verify:** test_parsing.py rejects malformed compact dates; valid slash dates, compact dates, five-digit Excel serials and unknowns still parse.

**Audit trail:** `fix/pipeline/validate-date-and-hour-values` → `a20a4b4`.

## BUG-003: Hours outside 0–23 enter the dataset

**MEDIUM / P2** · edge case · Hour parser · complexity: low · status: fixed

Files: `backend/src/bicycle_theft/pipeline.py`.

**Observed:** -1, 24 and 127 are accepted as hours.

**Expected:** Reject values outside 0–23 while retaining 不明/null.

**Root cause:** Int8 conversion checked storage range rather than the domain of hours.

**Impact:** Summary totals can disagree with the 24 hourly bins and hour filters.

**Reproduce:** Pass each invalid hour to parse_types with a valid date.

**Verify:** test_parsing.py tests negative, 24, 127, fractional and nonnumeric hours plus valid boundaries.

**Audit trail:** `fix/pipeline/validate-date-and-hour-values` → `a20a4b4`.

## BUG-004: Duplicate area names select the smaller population

**HIGH / P1** · functional · Census join · complexity: low · status: fixed

Files: `backend/src/bicycle_theft/api/data.py`.

**Observed:** 壱岐団地 thefts map to 40135026002 (population 1,163), contrary to the documented preference for 40135026001 (3,537).

**Expected:** Choose the most populous matching area deterministically.

**Root cause:** A descending population sort was followed by a dictionary comprehension; later, smaller areas overwrote earlier entries.

**Impact:** Thefts appear in the wrong polygon and per-capita rates use the wrong denominator.

**Reproduce:** Call area_lookup on the two same-name areas in either input order.

**Verify:** test_area_matching.py checks both orders; population sort plus key-code tie break and first-entry preservation.

**Audit trail:** `fix/api/correct-area-matching` → `c3d68ea`.

## BUG-005: Parent-town and 大字 fallbacks do not compose

**MEDIUM / P2** · functional · Area normalization · complexity: low · status: fixed

Files: `backend/src/bicycle_theft/api/data.py`.

**Observed:** 北原１丁目 fails to match 大字北原 when both a parent-town and prefix fallback are needed.

**Expected:** Apply the 大字 fallback to the normalized name and its parent town.

**Root cause:** Only the original name received the prefix.

**Impact:** Otherwise recognizable incidents remain unmapped.

**Reproduce:** Use a lookup containing only (40135, 大字北原) and match 北原１丁目.

**Verify:** test_area_matching.py covers composed fallbacks, ward isolation and null names.

**Audit trail:** `fix/api/correct-area-matching` → `c3d68ea`.

## BUG-006: A single legacy year can fail API startup

**MEDIUM / P2** · integration · Parquet schema compatibility · complexity: low · status: fixed

Files: `backend/src/bicycle_theft/api/data.py`.

**Observed:** Reading or renaming optional columns fails when a whole year lacks them.

**Expected:** Require identifying/date/hour columns; fill absent optional category columns with typed nulls.

**Root cause:** The loader requested every possible yearly column unconditionally.

**Impact:** Valid supported yearly input cannot be served unless other years happen to supply all columns.

**Reproduce:** Load a frame with date, hour, city, area and legacy 発生場所の属性 but without newer place/age/lock columns.

**Verify:** test_area_matching.py checks successful join, legacy place fallback and null age.

**Audit trail:** `fix/api/legacy-year-schema` → `eeb72b6`.

## BUG-007: Accepted date windows cause HTTP 500 overflow

**MEDIUM / P2** · edge case · Query validation · complexity: low · status: fixed

Files: `backend/src/bicycle_theft/api/app.py`, `backend/src/bicycle_theft/api/data.py`.

**Observed:** Very large days, end=0001-01-01, or a representable current window with an unrepresentable prior window produce 500.

**Expected:** Return a documented 422 validation response before constructing invalid dates.

**Root cause:** days had no calendar bound, and previous-window subtraction was unchecked.

**Impact:** Untrusted query parameters trigger predictable service errors and failed statistics requests.

**Reproduce:** Request by-area and summary with days=10**100; or end=0001-01-01 and days=1; or end=2025-01-01 and days=500000.

**Verify:** test_api.py checks all cases on both endpoints and normal current/previous totals. 422 detail follows the existing validation-error shape.

**Audit trail:** `fix/api/validate-window-and-timeline` → `54be6a4`.

## BUG-008: Timeline contract loses empty months and accepts unknown areas

**MEDIUM / P2** · API contract · Monthly timeline · complexity: medium · status: fixed

Files: `backend/src/bicycle_theft/api/app.py`, `backend/src/bicycle_theft/api/data.py`.

**Observed:** Unknown areas return 200 with an empty list while summary returns 404; filters remove zero-count months from the timeline.

**Expected:** Unknown keys return 404; valid filtered timelines retain a common monthly calendar with explicit zeros.

**Root cause:** The timeline did not validate area membership or reindex grouped results against the calendar.

**Impact:** Clients cannot distinguish invalid keys from valid areas without thefts, and sparse calendars are ambiguous.

**Reproduce:** Request timeline?key_code=missing; then filter a fixture with January thefts and no matching February/March thefts.

**Verify:** test_api.py checks consistent 404, January count and zero months from coverage start through the latest data month.

**Audit trail:** `fix/api/complete-timeline-contract` → `df3eaea`.

## BUG-009: Async requests run before prerequisites and retain stale errors

**MEDIUM / P2** · state management · Request lifecycle · complexity: medium · status: fixed

Files: `frontend/src/hooks/useAsync.ts`, `frontend/src/App.tsx`.

**Observed:** Slow metadata starts no-period requests; an error from an old key remains visible during a new request. Summary, outline and timeline errors were omitted from App error selection.

**Expected:** Wait for prerequisites, hide obsolete errors, abort stale requests, and surface required endpoint failures.

**Root cause:** The hook had no disabled key and always returned the last error, regardless of key; App checked only three request errors.

**Impact:** Slow/recovering requests can show false failure screens; failed secondary data can leave stale or incomplete views without an explanation.

**Reproduce:** Mount with no request key, then a rejecting key, then a pending key; resolve an older request after switching keys.

**Verify:** async.test.tsx checks zero calls before prerequisites, error reset on key changes, abort signal and stale-response rejection. App error aggregation reviewed statically.

**Audit trail:** `fix/frontend/request-lifecycle` → `9becd3d`.

## BUG-010: Ranking shows comparison deltas outside data coverage

**MEDIUM / P2** · functional · Ranking · complexity: low · status: fixed

Files: `frontend/src/components/SidePanel.tsx`.

**Observed:** Early/all-period windows show ▲ increases against an unsupported previous window, although summary correctly suppresses that comparison.

**Expected:** Show — when the preceding full window is outside coverage.

**Root cause:** Ranking did not apply the coverage check used by summary.

**Impact:** Users can read unavailable historical data as a real increase in thefts.

**Reproduce:** Render ranking for end=2018-01-02, days=7, coverage starting 2018-01-01, count=5 and prev_count=0.

**Verify:** display.test.tsx verifies — near the start and ▲5 when comparison is supported; baseline component was rerun with the corrected JSX harness and failed as expected.

**Audit trail:** `fix/frontend/consistent-comparison-and-map-values` → `f80b837`.

## BUG-011: Hour-chart buttons cannot be reached or activated by keyboard

**LOW / P3** · accessibility · Interactive charts · complexity: low · status: fixed

Files: `frontend/src/components/Charts.tsx`.

**Observed:** Clickable divs declare role=button but have no tab stop, keyboard handler or accessible label.

**Expected:** Tab reaches each interactive bar; Enter/Space selects its hour; accessible text identifies the value.

**Root cause:** Only mouse click behavior was implemented.

**Impact:** Keyboard-only users cannot use the advertised hour filtering interaction.

**Reproduce:** Render Bars with onClick; inspect tabIndex and dispatch Enter/Space.

**Verify:** display.test.tsx asserts tabIndex=0, both key activations and a nonempty accessible label.

**Audit trail:** `fix/frontend/keyboard-chart-controls` → `e568cff`.

## BUG-012: Low-population zero-count areas show a misleading numeric rate

**LOW / P3** · display · Map popup · complexity: low · status: fixed

Files: `frontend/src/Map.tsx`, `frontend/src/lib/mapDisplay.ts`.

**Observed:** Areas absent from both count windows show 0 in the rate popup even when population is below the suppression threshold.

**Expected:** Show — below the population threshold, consistently with the map fill and summary.

**Root cause:** The formatter returned zero for missing count entries without checking population.

**Impact:** The popup implies a valid rate where the API intentionally suppresses it.

**Reproduce:** Format a rate with no count entry, population=50 and minimum=100.

**Verify:** map-display.test.ts checks suppressed rates, valid zero rates and count mode.

**Audit trail:** `fix/frontend/map-rate-and-focus` → `ccb6ae7`.

## BUG-013: Map focus ignores overlay space and changes persistent padding

**MEDIUM / P2** · functional · Map camera · complexity: low · status: fixed

Files: `frontend/src/Map.tsx`, `frontend/src/lib/mapDisplay.ts`.

**Observed:** fitBounds uses padding=60 on all sides, ignoring the measured panels, and stores that padding by default.

**Expected:** Fit the selected feature within the visible area and leave persistent layout padding intact.

**Root cause:** The camera call overrode overlay-aware padding and did not set retainPadding=false.

**Impact:** A selected area can be framed beneath controls, and subsequent pans can use displaced padding.

**Reproduce:** Inspect focus options for top=250/right=372 insets and the actual fitBounds caller.

**Verify:** map-display.test.ts checks overlay-adjusted padding and retainPadding=false. Source readiness and caller wiring reviewed; live GPU behavior remains unverified.

**Audit trail:** `fix/frontend/map-rate-and-focus` → `ccb6ae7`.

## BUG-014: Download failures leave shared partial files and metadata can wait indefinitely

**MEDIUM / P2** · integration · Basemap download · complexity: low · status: fixed

Files: `backend/src/bicycle_theft/download_pmtiles.py`.

**Observed:** A failed extraction leaves fukuoka.pmtiles.part; retries reuse that path. The metadata request has no timeout.

**Expected:** Use a unique staging directory, remove partial output on failure, retain the old basemap and bound metadata waiting.

**Root cause:** A fixed staging filename had no cleanup, and urlopen used its default unlimited timeout.

**Impact:** Failed or concurrent downloads can interfere with retries, and an unresponsive listing can hang the command.

**Reproduce:** Mock extraction to write a partial file then fail; mock urlopen and inspect its timeout.

**Verify:** test_download.py checks cleanup, preservation of the previous map, successful replacement, parent-directory creation and a 30-second metadata timeout. No full planet extraction is run.

**Audit trail:** `fix/download/recover-partial-extracts` → `e4ca0d7`.

## BUG-015: js-yaml merge-chain CPU exhaustion

**HIGH / P1** · security · OpenAPI generator dependency · complexity: low · status: fixed

Files: `frontend/pnpm-lock.yaml`, `frontend/pnpm-workspace.yaml`.

**Observed:** The locked js-yaml 4.2.0 matches GHSA-52cp-r559-cp3m (>=4.0.0 <4.3.0).

**Expected:** Use a release patched for every advisory, at least 4.3.0 for this issue.

**Root cause:** A transitive API-generator dependency resolved to a vulnerable release.

**Impact:** Crafted YAML processed by development tooling can consume excessive CPU. This dependency is not in the shipped browser application; no production exploit is demonstrated.

**Reproduce:** Run pnpm audit against the original committed package.json and pnpm-lock.yaml in a temporary directory.

**Verify:** frontend-audit-before.json reports the high advisory; after override to ^4.3.2, lock resolves 4.3.2 and frontend-audit-after.json reports zero advisories. API generation and build pass.

**Audit trail:** `fix/dependencies/patch-yaml-advisories` → `4170200`.

Sources: [advisory](https://github.com/advisories/GHSA-52cp-r559-cp3m).

## BUG-016: js-yaml ordered-map CPU exhaustion

**HIGH / P1** · security · OpenAPI generator dependency · complexity: low · status: fixed

Files: `frontend/pnpm-lock.yaml`, `frontend/pnpm-workspace.yaml`.

**Observed:** The locked js-yaml 4.2.0 matches GHSA-5p4m-2wfm-xmqj (>=4.0.0 <4.3.1).

**Expected:** Use a release patched for every advisory, at least 4.3.1 for this issue.

**Root cause:** A transitive API-generator dependency resolved to a vulnerable release.

**Impact:** Crafted YAML processed by development tooling can consume excessive CPU. This dependency is not in the shipped browser application; no production exploit is demonstrated.

**Reproduce:** Run pnpm audit against the original committed package.json and pnpm-lock.yaml in a temporary directory.

**Verify:** frontend-audit-before.json reports the high advisory; after override to ^4.3.2, lock resolves 4.3.2 and frontend-audit-after.json reports zero advisories. API generation and build pass.

**Audit trail:** `fix/dependencies/patch-yaml-advisories` → `4170200`.

Sources: [advisory](https://github.com/advisories/GHSA-5p4m-2wfm-xmqj).

## BUG-017: js-yaml empty-merge CPU exhaustion

**HIGH / P1** · security · OpenAPI generator dependency · complexity: low · status: fixed

Files: `frontend/pnpm-lock.yaml`, `frontend/pnpm-workspace.yaml`.

**Observed:** The locked js-yaml 4.2.0 matches GHSA-2883-xcg3-v3hh (>=4.0.0 <4.3.2).

**Expected:** Use a release patched for every advisory, at least 4.3.2 for this issue.

**Root cause:** A transitive API-generator dependency resolved to a vulnerable release.

**Impact:** Crafted YAML processed by development tooling can consume excessive CPU. This dependency is not in the shipped browser application; no production exploit is demonstrated.

**Reproduce:** Run pnpm audit against the original committed package.json and pnpm-lock.yaml in a temporary directory.

**Verify:** frontend-audit-before.json reports the high advisory; after override to ^4.3.2, lock resolves 4.3.2 and frontend-audit-after.json reports zero advisories. API generation and build pass.

**Audit trail:** `fix/dependencies/patch-yaml-advisories` → `4170200`.

Sources: [advisory](https://github.com/advisories/GHSA-2883-xcg3-v3hh).

## BUG-018: Mobile layout hides the only metric selector

**MEDIUM / P2** · functional · Responsive controls · complexity: low · status: fixed

Files: `frontend/src/App.css`, `frontend/src/App.tsx`, `frontend/src/components/TimeControls.tsx`, `frontend/src/components/MetricSelector.tsx`.

**Observed:** At widths <=760px the floating legend is hidden, taking the count/per-capita radio group with it.

**Expected:** Keep metric selection available in the mobile time panel.

**Root cause:** The selector existed only inside the hidden legend.

**Impact:** Mobile users cannot switch the map metric.

**Reproduce:** Render the time panel and inspect the mobile breakpoint hiding the floating legend.

**Verify:** mobile-controls.test.tsx mounts the panel, finds the mobile selector and switches to rate. CSS breakpoint/display rules reviewed statically; actual viewport layout remains a browser-test limitation.

**Audit trail:** `fix/frontend/mobile-metric-control` → `9bf2167`.

## Assumptions

- Supported raw CSVs contain the documented date/hour columns; API data requires city and area columns.
- Positive 1–5 digit Excel serials cover the current police files; other integer-looking dates are not accepted as serials.
- Synthetic tests require no local data. The read-only local-data integration run and benchmark require the untracked datasets.
- Fix branches are stacked by component; closely related defects can share a fix commit and branch. Tests covering multiple defects were committed together before their fixes.

## Limitations

- No finite review proves that every possible defect has been found.
- Browser automation stalled before app navigation; no browser/GPU or responsive visual smoke test is claimed.
- CI was authored and locally checked but has not run on GitHub; no remote push or deployment was performed.
- Advisory results are a point-in-time check, with platform marker filtering; they do not establish absence of unknown vulnerabilities.
- Semantic ccc indexing required unavailable global configuration; direct source review/search was used.
- Full external PMTiles downloads and source-dataset correctness were not independently validated.
- The old dlt shard-overwrite risk was identified from its unconditional same-path copy; no forced dlt multi-shard load was executed. The replacement eliminates that design.
- GitHub documents pnpm update-bot support through version 10; frontend pnpm 12 dependencies use weekly advisory checks and manual lockfile updates rather than a potentially unsupported Dependabot job.

## Recommendations

- Require the committed CI checks on pull requests, and review weekly dependency-update PRs.
- Keep schema/contract generation in CI to catch drift; use explicit domain validation before data publication.
- Monitor API request latency, 4xx/5xx counts and file/range errors without logging raw query content unnecessarily.
- Record ingestion row counts, rejected dates/hours, source-year coverage, unmapped counts and duplicate-name decisions.
- Add browser/GPU smoke tests for map camera changes, mobile layout and worker loading in an environment with reliable browser control.
- Track bundle transfer size and browser startup before adding performance budgets; the map bundle warning alone does not establish a defect.
- Treat areas with no recorded theft as an observation, not proof that police exclude those names; validate that interpretation with the source owner.
