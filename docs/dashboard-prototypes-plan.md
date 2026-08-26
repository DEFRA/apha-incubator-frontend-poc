# Plan: Three charting-library dashboard prototypes (D3, Plotly, Chart.js)

## Summary

Build three comparable dashboard prototypes in `apha-incubator-frontend-poc`, each
rendering the **same four charts** from the synthetic outbreak dataset
(`src/server/data/outbreak-sample-data.json`) but using a different charting library —
D3.js, Plotly.js and Chart.js. Each dashboard follows the attached wireframe: a page
title and summary, then a 2×2 grid of headed chart cards. Chart 1 is clickable and
navigates to an expanded detail page showing a larger version of the same chart plus
server-side filter controls and two summary panels. Visual and structural inspiration
comes from the [UKHSA dashboard](https://ukhsa-dashboard.data.gov.uk/), notably its
pairing of every chart with an accessible data table. Each library gets its own git
branch and its own `docs/<package>.md`, so the three approaches can be reviewed and
compared independently.

## Decisions (from Q&A)

| Area            | Decision                                                                                                                              |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Routes          | `/dashboard/d3`, `/dashboard/plotly`, `/dashboard/chartjs`; expanded view at `/dashboard/{lib}/{chartId}`                             |
| Chart parity    | All three dashboards render the same four charts, same data, same types                                                               |
| Charts          | 1. Weekly new cases (line) · 2. Cases by region (bar) · 3. Cases by disease (stacked bar/area) · 4. Severity breakdown (doughnut/pie) |
| Clickable chart | Chart 1 only. Charts 2–4 use an inert `#` link                                                                                        |
| Click UX        | Chart canvas click navigates **and** a visible GOV.UK link is provided for keyboard/AT users                                          |
| Expanded view   | Larger chart + interactive filter controls (region / disease) + two detail panels                                                     |
| Filtering       | Server-side via query params (e.g. `?region=Devon&disease=bramblewick-pox`), page reload on change                                    |
| Data delivery   | Server aggregates into chart-ready JSON, embedded in a `<script type="application/json">` tag                                         |
| Branching       | Shared foundation branch first; three library branches created off it                                                                 |
| PRs             | Push all branches and open a PR for each                                                                                              |
| Testing         | Route/controller tests + unit tests for aggregation helpers                                                                           |
| Navigation      | No new nav items. Home page gets a prototype summary + links to all three dashboards                                                  |
| Home links      | All three links added in the foundation branch (two 404 until their branches merge)                                                   |
| Docs            | `docs/d3.md`, `docs/plotly.md`, `docs/chartjs.md`, each on its own library branch                                                     |
| Doc content     | Library summary, GOV.UK/APHA fit, bundle size, accessibility notes, usage here, suggested iterations                                  |
| Accessibility   | Every chart paired with a data table inside a `govuk-details` disclosure                                                              |
| Bundling        | Separate Vite entry point per dashboard, loaded only on that page                                                                     |
| Plotly + CSP    | Attempt a strict-CSP-compatible setup first; only relax `styleSrc` if genuinely unrenderable, and document the trade-off              |
| Sub-agents      | Foundation built directly; the three library branches fanned out to parallel sub-agents                                               |
| Disclaimer      | GOV.UK warning/inset text surfacing the synthetic-data disclaimer on every dashboard and expanded page                                |

## Phase 1 — Foundation branch (`feat/dashboard-foundation`)

Built directly, off `main`. Contains everything shared by the three libraries, so the
library branches contain only library-specific code.

1. **Commit the dataset** — `src/server/data/outbreak-sample-data.json` is currently
   untracked; add it on this branch.
2. **Data loader** — `src/server/common/helpers/outbreak-data.js`: reads and caches the
   JSON once at module load, exposes `getOutbreakData()`.
3. **Aggregation helpers** — `src/server/common/helpers/outbreak-aggregations.js`, pure
   and library-agnostic, returning plain `{ labels, series }` shapes:
   - `weeklyCases(records)` → weekly totals time series
   - `casesByRegion(records)` → totals per region
   - `casesByDiseaseOverTime(records)` → stacked series per disease
   - `casesBySeverity(records)` → Low/Medium/High totals
   - `filterRecords(records, { region, disease })` → for the expanded view
   - `toTableRows(chartData)` → shared shape for the accessible data table
4. **Chart view-model builder** — `src/server/common/helpers/dashboard-view-model.js`:
   assembles the four chart definitions (id, heading, caption, chart data, table data,
   href) so every library branch renders an identical page structure.
5. **Shared templates**:
   - `src/server/common/templates/partials/chart-card.njk` — heading, chart mount
     `<div>` carrying `data-chart-id` and an embedded JSON payload, optional link,
     `govuk-details` data table.
   - `src/server/common/templates/partials/synthetic-data-warning.njk` — GOV.UK warning
     text using `meta.disclaimer` from the dataset.
   - `src/server/common/templates/partials/dashboard-overview.njk` and
     `dashboard-expanded.njk` — the wireframe layouts, with a `chartScript` block each
     library branch overrides.
6. **Filter form component** — GOV.UK select inputs for region and disease, submitting
   GET to the current expanded-view path.
7. **Home page update** — prototype explainer plus links to all three dashboards.
8. **Tests** — unit tests for the loader, each aggregation helper, `filterRecords`, and
   the view-model builder.
9. Run `npm run lint`, `npm test`; push and open a PR.

## Phase 2 — Library branches (parallel sub-agents)

Three branches, each created from `feat/dashboard-foundation`, each handled by its own
sub-agent working from an identical brief so the outputs stay comparable:

- `feat/dashboard-d3` — D3.js
- `feat/dashboard-plotly` — Plotly.js
- `feat/dashboard-chartjs` — Chart.js

Each sub-agent does the same work for its library:

1. `npm install <library>` (pinned exact version, matching repo convention).
2. Add route plugin `src/server/routes/dashboard-<lib>/` with `index.js`,
   `controller.js`, `index.njk`, `expanded.njk`, `controller.test.js`; register it in
   `src/server/plugins/router.js`.
3. Overview controller builds the view model via the shared helpers and renders the four
   chart cards. Expanded controller reads `region`/`disease` query params, validates them
   against the dataset, filters, and re-renders.
4. Client module `src/client/javascripts/dashboard-<lib>.js` — reads each mount point's
   embedded JSON and renders the four charts using **basic, idiomatic features of that
   library only** (no heavy abstraction; this is a first pass to iterate on). Wires the
   chart-1 click handler to navigate to the expanded view.
5. Register the new entry point in `vite.config.js` and load it from the dashboard
   templates' `bodyEnd`/script block.
6. Use the GOV.UK colour palette for series colours; make charts responsive to container
   width.
7. Verify under the existing CSP. Plotly agent: attempt strict-CSP compatibility first
   (per plotly.js issues [#7543](https://github.com/plotly/plotly.js/issues/7543),
   [#7349](https://github.com/plotly/plotly.js/issues/7349),
   [#6233](https://github.com/plotly/plotly.js/issues/6233)); only relax `styleSrc` in
   `src/server/plugins/content-security-policy.js` if rendering genuinely fails, and
   document it.
8. Write `docs/<package>.md` covering: summary, GOV.UK/APHA fit, bundle size (measured
   from the actual Vite build), accessibility notes, how it's used here, and suggested
   iterations.
9. Run `npm run lint` and `npm test`; push the branch and open a PR.

## Phase 3 — Consolidation

1. Review each sub-agent's output for consistency of structure and naming across the
   three branches.
2. Manually smoke-test all six pages (three overviews, three expanded views) with
   `npm run dev`, including the filter query params and the chart-1 click-through.
3. Summarise the three PRs and the headline comparison findings back to you.

## Architecture Decision Records

The repo currently has **no `adr/` directory and no existing ADRs**. Two decisions here
clear the `create-adr` bar (dependency choice + cross-cutting convention), but both are
explicitly _prototype_ decisions whose entire purpose is to be evaluated and possibly
discarded — recording them as accepted ADRs now would be premature.

**Recommendation: no ADRs at this stage.** Once the three PRs are reviewed and a
charting library is actually selected for APHA use, that selection is genuinely
significant and hard to reverse, and should get an ADR (`adr/choose-charting-library.adr.md`)
citing these three prototypes as the evidence. Flagged here so it isn't forgotten. If
you'd prefer an ADR up front recording the _comparison approach itself_, say so and I'll
add one.

## Assumptions

- New dependencies use exact pinned versions, matching the existing `package.json` style.
- Branch names follow `feat/...`; PRs target `main` and are opened as drafts is not
  assumed — they'll be normal PRs unless you say otherwise.
- Charts use the GOV.UK colour palette rather than each library's default colours.
- Invalid or unknown `region`/`disease` query values fall back to "all", rather than
  returning a 400.
- Merge conflicts in `vite.config.js`, `package.json` and `router.js` between the three
  library branches are expected and will be resolved at merge time.
- Commits include the `Co-authored-by: Copilot` trailer.

## Sources consulted

- Attached wireframe: `/Users/simonddefra/Screenshots/Screenshot 2026-08-25 at 10.05.45.png`
- Dataset: `src/server/data/outbreak-sample-data.json`
- Repo: `src/server/routes/about/*`, `src/server/plugins/content-security-policy.js`,
  `src/server/common/templates/layouts/page.njk`, `vite.config.js`, `package.json`
- [UKHSA data dashboard](https://ukhsa-dashboard.data.gov.uk/)
- plotly.js strict-CSP issues [#7543](https://github.com/plotly/plotly.js/issues/7543),
  [#7349](https://github.com/plotly/plotly.js/issues/7349),
  [#6233](https://github.com/plotly/plotly.js/issues/6233)
