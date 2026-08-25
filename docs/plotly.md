# Plotly.js dashboard prototype

## Summary

A dashboard prototype using **Plotly.js** (`plotly.js-dist-min` 4.0.0) to render the four standard outbreak charts (line, bar, stacked-bar, doughnut) from the shared synthetic dataset. Routes are at `/dashboard/plotly` (overview) and `/dashboard/plotly/{chartId}` (expanded view with filters).

**Package choice:** `plotly.js-dist-min` was selected over `plotly.js` because it ships as a single pre-built minified bundle, avoiding the need to configure a partial/custom build (which requires Webpack or Rollup-specific bundling infrastructure that conflicts with this project's Vite/Rolldown pipeline). The trade-off is that you get the full Plotly surface area regardless of which chart types you use. See Bundle size below.

---

## Fit with GOV.UK and APHA

Plotly is a strong fit for scientific and analytical dashboards that need interactive features (hover, zoom, pan, download). For this GOV.UK prototype those features are largely suppressed (`displayModeBar: false`) because the design system prioritises accessibility and clear data disclosure over interactivity. What Plotly does bring that is immediately useful:

- **Responsive by default** — `responsive: true` in the config means one `Plotly.newPlot` call works in both the 260 px grid card and the 440 px expanded view.
- **Built-in hover tooltips** — low-cost interactivity that survives without the toolbar.
- **Clear multi-series support** — the stacked-bar and legend handling requires no custom logic.

What works against Plotly in a GOV.UK context:

- Bundle size is very large (see below), dominated by components (3D, geo, statistical) that are never used here.
- Plotly's default aesthetic diverges significantly from GOV.UK typography and colours; every layout property must be overridden explicitly.
- Inline-style injection breaks a strict CSP (see CSP section).

---

## Bundle size

Measured from `npm run build:frontend` output in this worktree:

| Asset                                       | Raw          | Gzip         |
| ------------------------------------------- | ------------ | ------------ |
| `dashboardPlotly-*.js` (Plotly entry chunk) | **4,071 kB** | **1,247 kB** |
| `application-*.js` (baseline, no charting)  | 9.85 kB      | 3.16 kB      |

**Plotly adds ~4,061 kB raw / ~1,244 kB gzip** over the baseline.

This is the single largest drawback of `plotly.js-dist-min`. The full bundle includes unused modules for 3D surface plots, geographic maps, statistical distributions, and Sankey diagrams. A partial build using `plotly.js/lib/index-cartesian` (Cartesian charts only) would be ~2× smaller but requires additional Vite/Rolldown configuration to handle Plotly's CommonJS glue code correctly — not attempted in this prototype pass but a clear next iteration.

For context, Chart.js full bundle is ~200 kB gzipped; D3 core is ~50 kB. Plotly at 1.2 MB gzipped is only acceptable for authenticated internal tooling with warm caches; it should not ship to citizens on slow connections.

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

**Strict approach:** The service runs `style-src: 'self'` with no `'unsafe-inline'`. Plotly injects `<style>` elements into `<head>` at render time using `document.createElement('style')` + `document.head.appendChild(...)`. This is used for:

1. Container/plot area layout (height, overflow)
2. Axis tick label positioning
3. Internal housekeeping for drag layers

Inspecting `plotly.min.js`: there are 3 distinct `createElement("style")` call sites confirmed in the minified source. These are not configurable via `Plotly.setPlotConfig` or any public API.

**Options investigated:**

| Approach                                                                                  | Outcome                                                                                                                                                                                                                                                                |
| ----------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Import Plotly CSS separately via Vite                                                     | `plotly.js-dist-min` ships no separate CSS file — styles are only emitted via JS                                                                                                                                                                                       |
| `Plotly.setPlotConfig({ ... })`                                                           | No documented option to suppress style injection                                                                                                                                                                                                                       |
| Compute hash of injected `<style>` content                                                | Infeasible — styles are generated dynamically and differ per chart/container                                                                                                                                                                                           |
| Server-side nonces (`generateNonces: true` + `Plotly.setPlotConfig({ plotlyServerURL })`) | Plotly has no mechanism to accept an externally-supplied nonce; nonces must be written into the `<style>` element itself, which Plotly does not support                                                                                                                |
| Partial bundle (cartesian-only, hand-built)                                               | Would not reduce style injection — the injection is in core `src/lib/style_inject.js`, not in chart-type modules                                                                                                                                                       |
| `style-src-elem: 'unsafe-inline'` only                                                    | More targeted than `style-src: 'unsafe-inline'` because it permits inline `<style>` elements but not `style=` attributes; however, **Blankie does not support `style-src-elem`** as a distinct directive, so this cannot be expressed without switching CSP middleware |

### What was conceded

`'unsafe-inline'` was added to `styleSrc` in `content-security-policy.js`. This is the minimum change that allows Plotly to render.

**Trade-off:** `'unsafe-inline'` in `style-src` allows any inline `<style>` element or `style=` attribute injected into the page — including by XSS payloads. For a service that renders user-supplied data this is a meaningful weakening. The existing `script-src` policy (no `'unsafe-inline'`) means a style-injection XSS cannot run arbitrary JavaScript, but it can alter page appearance (clickjacking, phishing via CSS). This is an acceptable prototype trade-off but should not reach production without either:

1. Switching to a CSP middleware that supports `style-src-elem` independently (so inline `<style>` is allowed but `style=` attributes are not), or
2. Replacing `plotly.js-dist-min` with a version that accepts an external nonce (not currently available upstream), or
3. Choosing a different library (Chart.js renders into `<canvas>` and injects no styles at all).

The CSP test (`content-security-policy.test.js`) was updated to assert `'unsafe-inline'` is present, making the relaxation explicit and visible in the test suite.

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

1. **Partial bundle** — replace `plotly.js-dist-min` with a hand-rolled Plotly subset (`plotly.js/lib/index-cartesian` + only the traces actually used). Expected size reduction: ~50% raw. Requires either a CJS interop shim in Vite config or switching to Plotly's ESM builds when available.
2. **Keyboard navigation for clickable charts** — add `tabindex="0"` and a `keydown` (Enter/Space) handler to mounts where `data-clickable="true"`, or restructure as a `<button>` wrapping the mount.
3. **`style-src-elem` via native CSP middleware** — replace Blankie with `@hapi/scooter` + a hand-written CSP header helper that supports Level 3 directives. This would let us allow `<style>` elements (`style-src-elem: 'unsafe-inline'`) without also allowing `style=` attributes (`style-src-attr: 'self'`).
4. **Plotly theme helper** — extract the GOV.UK layout overrides (font, background, margin) into a shared module; right now they are duplicated across the four render functions.
5. **Responsiveness on resize** — `responsive: true` in Plotly config handles most cases, but explicit `Plotly.Plots.resize` calls on a `ResizeObserver` may be needed if the container changes size without a window resize event (e.g., filter panel collapsing).
