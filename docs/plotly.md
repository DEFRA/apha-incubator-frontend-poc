# Plotly.js dashboard prototype

## Summary

A dashboard prototype using **Plotly.js** (`plotly.js-basic-dist-min` 4.0.0) to render the four standard outbreak charts (line, bar, stacked-bar, doughnut) from the shared synthetic dataset. Routes are at `/dashboard/plotly` (overview) and `/dashboard/plotly/{chartId}` (expanded view with filters).

**Package choice:** `plotly.js-basic-dist-min` was chosen over the full `plotly.js-dist-min`. Both ship as pre-built minified single-file bundles (avoiding CJS/ESM interop issues with this project's Vite/Rolldown pipeline), but the `basic` variant excludes 3D, geo, financial, statistical and speciality chart modules — none of which appear in this prototype. The four chart types used (scatter/line, bar, stacked bar, pie/doughnut) are all present in the basic bundle. See Bundle size for the measured difference.

---

## Fit with GOV.UK and APHA

Plotly is a strong fit for scientific and analytical dashboards that need interactive features (hover, zoom, pan, download). For this GOV.UK prototype those features are largely suppressed (`displayModeBar: false`) because the design system prioritises accessibility and clear data disclosure over interactivity. What Plotly does bring that is immediately useful:

- **Responsive by default** — `responsive: true` in the config means one `Plotly.newPlot` call works in both the 260 px grid card and the 440 px expanded view.
- **Built-in hover tooltips** — low-cost interactivity that survives without the toolbar.
- **Clear multi-series support** — the stacked-bar and legend handling requires no custom logic.

What works against Plotly in a GOV.UK context:

- Bundle size is larger than Chart.js or D3 even with the basic bundle (see below).
- Plotly's default aesthetic diverges significantly from GOV.UK typography and colours; every layout property must be overridden explicitly.
- Inline-style injection breaks a strict CSP (see CSP section).

---

## Bundle size

Measured from `npm run build:frontend` output in this worktree.

### Shipped: `plotly.js-basic-dist-min` (partial bundle)

| Asset                                         | Raw          | Gzip       |
| --------------------------------------------- | ------------ | ---------- |
| `dashboardPlotly-*.js` (basic partial bundle) | **1,139 kB** | **381 kB** |
| `application-*.js` (baseline, no charting)    | 9.85 kB      | 3.16 kB    |

**Plotly basic adds ~1,129 kB raw / ~378 kB gzip** over the baseline.

The `basic` partial bundle covers scatter/line, bar, and pie/doughnut chart types — all four chart types used in this prototype. It excludes 3D, geo, financial, and statistical chart modules.

### For comparison: `plotly.js-dist-min` (full bundle, measured but not shipped)

| Asset                                | Raw          | Gzip         |
| ------------------------------------ | ------------ | ------------ |
| `dashboardPlotly-*.js` (full bundle) | **4,071 kB** | **1,247 kB** |

The full bundle is **3.3× larger** (raw) / **3.3× larger** (gzip) than the basic bundle. The difference is modules for 3D surface plots, Mapbox/geo charts, violin/box plots, treemaps, Sankey diagrams and others not used here.

### Context

For comparison, Chart.js full bundle is ~200 kB gzipped; D3 core is ~50 kB. At 381 kB gzip, the Plotly basic bundle is still large but in a more defensible range for authenticated internal tooling with warm caches. It remains inappropriate for public-facing citizen services on slow connections.

A further reduction is possible using a hand-rolled partial bundle (only the specific trace types used: `scatter`, `bar`, `pie`) but that requires additional Vite/Rolldown CJS interop configuration — noted as a suggested iteration.

---

## Accessibility

- The chart mount already carries `role="img"` and `aria-label` (set by the shared `chart-card.njk` partial).
- Each chart is paired with a GOV.UK `<details>` data table — the primary accessible representation of the data.
- The SVG Plotly renders inside the mount is marked `aria-hidden="true"` after rendering, avoiding duplicate announcements.
- `displayModeBar: false` removes the toolbar SVG buttons (zoom, pan, download) which would otherwise add unlabelled interactive elements.
- Hover tooltips remain active; these are decorative for sighted users and are not keyboard-accessible — acceptable since the data table carries all the information.
- Click navigation on the weekly-cases chart (`data-clickable="true"`) is implemented via a click listener on the mount `<div>` rather than Plotly's `plotly_click` event. Reason: `plotly_click` only fires on data series points; clicking the chart background or axis area would silently fail. The mount-level listener is more robust. The mount is not a `<button>` or `<a>`, so keyboard activation is missing — this is a known prototype limitation to address in a next iteration (add `tabindex="0"` + `keydown` handler, or wrap in a real link).

---

## CSP

### What was tried

**Strict approach:** The service runs `style-src: 'self'` with no `'unsafe-inline'`. Plotly injects `<style>` elements into `<head>` at render time. Source inspection of `plotly-basic.min.js` confirms a single injection site in function `q9`:

```js
n = document.createElement('style')
n.setAttribute('id', 'plotly.js-style-global')
n.appendChild(document.createTextNode('')) // empty text
document.head.appendChild(n) // CSP check happens here
// then: n.sheet.insertRule(rule, ...)       // adds CSS after insertion
```

Key finding: **the `<style>` element is inserted with empty text, then populated via `CSSStyleSheet.insertRule`**. The CSP hash check occurs at `appendChild` time (over the element's text content at that moment — the empty string `""`). `insertRule` calls that follow are a CSSOM API and are not subject to `style-src` policy.

**Options investigated:**

| Approach                                | Outcome                                                                          |
| --------------------------------------- | -------------------------------------------------------------------------------- |
| Import Plotly CSS separately via Vite   | No CSS file ships in `plotly.js-basic-dist-min` — styles are emitted only via JS |
| `Plotly.setPlotConfig({ ... })`         | No option to suppress style injection                                            |
| Hash of injected `<style>` text content | **Feasible** — text content is always `""` at insertion time; see below          |
| Server-side nonces                      | Plotly does not accept externally-supplied nonces on its `<style>` elements      |
| `style-src-elem: 'unsafe-inline'` only  | Blankie does not support `style-src-elem` as a distinct directive                |

### What was shipped: a CSP hash

The hash of the empty string `""` (sha256) is `47DEQpj8HBSa+/TImW+5JCeuQeRkm5NMpJWZG3hSuFU=`. Adding this to `styleSrc` in place of `'unsafe-inline'` allows the empty `<style>` element to be inserted; subsequent `insertRule` calls succeed because CSSOM APIs are not blocked by `style-src`.

```js
styleSrc: ['self', "'sha256-47DEQpj8HBSa+/TImW+5JCeuQeRkm5NMpJWZG3hSuFU='"]
```

This is a materially stronger policy than `'unsafe-inline'`:

- `'unsafe-inline'` permits any inline `<style>` or `style=` attribute, including those injected by XSS.
- The hash only permits the one empty-text `<style>` element that Plotly creates; any other inline style is still blocked.

**Caveat:** This hash is version-pinned to `plotly.js-basic-dist-min@4.0.0`. It will need updating if Plotly ever switches from `insertRule`-based injection to `textContent`-based injection, or if the number of `<style>` elements changes. The CSP test asserts the hash is present, making it visible on upgrade.

The CSP test (`content-security-policy.test.js`) was updated to assert this hash is present in the response header.

---

## How it is used in this prototype

1. `GET /dashboard/plotly` — calls `buildDashboardViewModel('plotly')`, renders `dashboard-plotly/index.njk` (extends `partials/dashboard-overview.njk`).
2. `GET /dashboard/plotly/{chartId}` — calls `buildExpandedViewModel('plotly', chartId, request.query)`, renders `dashboard-plotly/expanded.njk` (extends `partials/dashboard-expanded.njk`). Unknown `chartId` returns 404.
3. Both templates override `{% block chartScript %}` to load `dashboard-plotly.js` via `getAssetPath`.
4. The client module finds every `.app-chart[data-chart-id]` mount, reads its paired `<script type="application/json">` data block, and calls `Plotly.newPlot` with a type-specific trace and layout derived from the GOV.UK palette colours already present in `chart.data.series[].colour`.
5. `displayModeBar: false` is set globally so no toolbar is rendered.
6. `responsive: true` is set so the chart reflows on container resize.

### Chart implementation decisions

- **Line:** `scatter` trace with `mode: 'lines+markers'`. Date axis formatted `%d %b %Y`.
- **Bar:** Single-series `bar` trace, no legend (redundant for single series).
- **Stacked bar:** Multi-series `bar` traces with `barmode: 'stack'`, horizontal legend below the chart to avoid overlap.
- **Doughnut:** `pie` trace with `hole: 0.4`, `sliceColours` from the data model, legend below.

---

## Suggested iterations

1. **Hand-rolled trace-only bundle** — the current `plotly.js-basic-dist-min` still includes all basic chart types. A custom build using only `scatter`, `bar`, and `pie` traces could reduce the bundle further. Requires a CJS interop shim in Vite config.
2. **Keyboard navigation for clickable charts** — add `tabindex="0"` and a `keydown` (Enter/Space) handler to mounts where `data-clickable="true"`, or restructure as a `<button>` wrapping the mount.
3. **`style-src-elem` via native CSP middleware** — replace Blankie with a CSP middleware that supports Level 3 directives. This would let the hash cover only `<style>` elements (`style-src-elem`) while `style-src-attr` remains `'self'`, eliminating any ambiguity about inline style attributes.
4. **Plotly theme helper** — extract the GOV.UK layout overrides (font, background, margin) into a shared module; right now they are duplicated across the four render functions.
5. **Responsiveness on resize** — `responsive: true` in Plotly config handles most cases, but explicit `Plotly.Plots.resize` calls on a `ResizeObserver` may be needed if the container changes size without a window resize event (e.g., filter panel collapsing).
