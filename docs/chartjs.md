# Chart.js dashboard prototype

## Summary

A Chart.js 4.5.1 implementation of the four APHA outbreak dashboard charts (line, bar, stacked-bar, doughnut), rendered client-side from the shared synthetic outbreak dataset. The prototype covers the overview grid and an expanded single-chart view with region/disease filters.

## Fit with GOV.UK and APHA

Chart.js is a canvas-based library with a simple, declarative API. It integrates naturally into a server-rendered hapi/nunjucks stack: the server writes chart data into a `<script type="application/json">` block, and the client module reads and renders it. No framework dependency. GOV.UK colour tokens are passed through `chart.data.series[*].colour` (and `sliceColours` for the doughnut) and applied directly to datasets — Chart.js defaults are fully overridden.

The library has no peer dependencies and no CDN requirement. It sits entirely within the existing Vite build pipeline.

Downsides:

- Canvas-based rendering means charts are raster images — not natively zoomable or selectable as text.
- Chart.js does not produce SVG, so output cannot be styled with CSS or searched by screen readers. The accessible data table paired with every chart is therefore essential, not optional.
- Date-axis formatting requires a separate adapter package (`chartjs-adapter-date-fns`, `chartjs-adapter-luxon`, etc). This prototype omits it to avoid an extra dependency; date labels are rendered as raw ISO strings on a CategoryScale. A production build would need a suitable adapter.
- The legend and tooltip text are rendered on canvas and do not inherit page font or colour variables automatically — `Chart.defaults.font.family` would need to be set to match GDS Transport.

## Bundle size

Measured from `npm run build:frontend`:

| Chunk                              | Raw       | Gzip     |
| ---------------------------------- | --------- | -------- |
| `application.js` (baseline)        | 9.85 kB   | 3.16 kB  |
| `dashboardChartjs.js` (this entry) | 189.85 kB | 66.00 kB |

The Chart.js entry adds approximately **180 kB raw / 63 kB gzip** over the baseline application bundle. This is a tree-shaken build — only the six controllers/elements/scales/plugins actually used are registered (no `chart.js/auto`). Importing `chart.js/auto` would be roughly 230 kB raw. The cost is primarily the Chart.js core; it cannot be reduced materially without switching to a lighter library.

## Accessibility

- The `<canvas>` element receives `aria-hidden="true"`. The mount `<div>` already carries `role="img"` and `aria-label` (set by `chart-card.njk`).
- Every chart is paired with a `<details>` / `govukTable` data table rendered server-side — fully accessible without JavaScript.
- Canvas content is not exposed to the accessibility tree; the data table is the primary accessible representation.
- Legend and tooltip text are painted on canvas and therefore invisible to assistive technology. Users relying on screen readers fall back to the data table.
- Keyboard navigation of chart interactivity is not provided by Chart.js out of the box.

## CSP outcome

No CSP changes were needed. Chart.js sets sizing properties via `canvas.style.width` / `canvas.style.height` (inline element styles on a DOM node). These are **not** governed by the `style-src` directive, which applies only to `<style>` elements and `style` attributes in HTML source — not to JavaScript assignments to `element.style`. The existing `style-src 'self'` policy is sufficient.

## How it is used in this prototype

1. `GET /dashboard/chartjs` renders the overview via `buildDashboardViewModel('chartjs')`.
2. `GET /dashboard/chartjs/{chartId}` renders the expanded view via `buildExpandedViewModel('chartjs', chartId, query)`, returning 404 for unknown chart IDs. Unknown filter values fall back to `'all'` (handled by the shared view model).
3. Both views extend the shared `dashboard-overview.njk` / `dashboard-expanded.njk` partials and override `{% block chartScript %}` to load `dashboard-chartjs.js`.
4. The client module queries every `.app-chart[data-chart-id]` mount, reads the sibling JSON `<script>`, and calls the appropriate builder function (`buildLineChart`, `buildBarChart`, `buildStackedBarChart`, `buildDoughnutChart`). A `<canvas aria-hidden="true">` is created inside the mount.
5. When `data-clickable="true"`, clicking the mount navigates to `data-chart-href`.
6. `responsive: true` + `maintainAspectRatio: false` means the same canvas code renders correctly in both the 260 px grid card and the 440 px expanded view.

## Suggested iterations

- **Add a date adapter** (`chartjs-adapter-date-fns`) to use `TimeScale` for proper date axis formatting and tick control on weekly data.
- **Set `Chart.defaults.font.family`** to `GDS Transport, Arial, sans-serif` so axis labels and legend text match the page typography.
- **Add focus / keyboard navigation** for the clickable chart card, or wrap the mount in a button/link element rather than attaching a raw click listener.
- **Consider SVG alternatives** if zooming or text selection in chart content is required — Chart.js cannot produce SVG.
- **Expose chart titles in the canvas** via `plugins.title` so the `aria-label` on the mount is not the only source of context, even if the canvas remains `aria-hidden`.
