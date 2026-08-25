# Chart.js dashboard prototype

## Summary

A Chart.js 4.5.1 implementation of the four APHA outbreak dashboard charts (line, bar,
stacked-bar, doughnut), rendered client-side from the shared synthetic outbreak dataset.
The prototype covers the overview grid (`GET /dashboard/chartjs`) and an expanded
single-chart view with region/disease filters (`GET /dashboard/chartjs/{chartId}`).

Chart.js is the most widely-used canvas-based charting library in the JavaScript
ecosystem. It has a deliberately simple, declarative API, active maintenance, and
reasonable tree-shaking support from v4. Its chief trade-off is that all output is raster
canvas: there is no SVG path, no accessible text in the DOM, and no CSS hook into rendered
content.

---

## Fit with GOV.UK and APHA

### Integration model

Chart.js integrates naturally into a server-rendered hapi/nunjucks stack. The server
writes chart data into a `<script type="application/json">` block; the client module reads
it, creates a `<canvas>`, and calls the appropriate Chart.js builder. No framework
dependency, no CDN requirement. The library sits entirely within the existing Vite build
pipeline.

### Fonts

Chart.js renders axis labels, tick text, legend text and tooltip text onto the canvas.
These do **not** inherit the page CSS font. By default Chart.js uses its own fallback stack
(`'Helvetica Neue', 'Helvetica', 'Arial', sans-serif`), which is visually similar to but
not the same as GDS Transport. To match the Design System typography you must set:

```js
Chart.defaults.font.family = "'GDS Transport', Arial, sans-serif"
Chart.defaults.font.size = 16
```

GDS Transport is loaded by `govuk-frontend` as a self-hosted web font; it is available in
the browser by the time the chart module runs. This prototype does not set these defaults —
axis labels and legend text therefore appear in a slightly different typeface to the rest of
the page. This is a visible inconsistency in a production service.

### GOV.UK colour palette

The shared view model (`buildDashboardViewModel` / `buildExpandedViewModel`) resolves GOV.UK
palette hex values and passes them in `chart.data.series[*].colour` (single-series charts)
and `chart.data.sliceColours` (doughnut). The client module applies these directly to Chart.js
`borderColor`, `backgroundColor` and `backgroundColor[]` dataset properties, fully
overriding Chart.js defaults. No Chart.js default colour appears in any rendered chart.

### Colour contrast on canvas

Canvas pixels are composite; contrast cannot be measured by browser developer tools or
automated WCAG checkers in the same way as HTML text. GOV.UK palette colours were chosen
for adequate contrast against a white background, but the canvas rendering pipeline can
introduce anti-aliasing that slightly softens edges. Thin lines (e.g. the line chart
stroke) at a 1px default weight may be hard to distinguish for users with low vision.
Increasing `borderWidth` to 2–3 px is a simple improvement.

Legend and axis tick text rendered in the canvas at small sizes may not meet the WCAG 1.4.3
4.5:1 contrast ratio for text, depending on the colour combination chosen. This cannot be
verified without manually sampling canvas pixels.

### Print behaviour

Canvas elements do not print reliably across all browsers. At print time the canvas is
typically rendered as a rasterised image at screen resolution, which will appear blurry at
print DPI. SVG-based libraries (D3, Plotly in SVG mode) reproduce crisply. If printed
reports are a requirement, Chart.js is the wrong choice without a server-side rendering
supplement (see Suggested iterations).

### Tooltips and legends

Chart.js's default tooltip is a dark-background floating box positioned by JS. It does not
follow GOV.UK Design System conventions — the colour, border-radius, font size and spacing
all differ from GOV.UK components. It is also not keyboard-accessible. In a production
service the tooltip would need to be replaced with a custom plugin or removed in favour of a
visible label.

The default legend position is `'top'`; in this prototype it is set to `'bottom'` for
multi-series charts (stacked-bar, doughnut) to keep it below the chart area and avoid
crowding the heading. Single-series charts have `legend.display: false`. Neither variant
matches GOV.UK typography exactly (see Fonts above).

---

## Bundle size

Measured from `npm run build:frontend` with tree-shaking via explicit `Chart.register()`
calls (not `import 'chart.js/auto'`):

| Chunk                                  | Raw       | Gzip     |
| -------------------------------------- | --------- | -------- |
| `application.js` (baseline)            | 9.85 kB   | 3.16 kB  |
| `dashboardChartjs.js` (this prototype) | 189.85 kB | 66.00 kB |

**The Chart.js entry adds approximately 180 kB raw / 63 kB gzip over the baseline.**

Registered in this prototype:
`LineController`, `BarController`, `DoughnutController`, `CategoryScale`, `LinearScale`,
`PointElement`, `LineElement`, `BarElement`, `ArcElement`, `Tooltip`, `Legend`, `Filler`.

Comparative figures:

- `chart.js/auto` (all controllers, scales, plugins registered) would be approximately
  **230 kB raw / 79 kB gzip** — roughly 13 kB gzip more than this build.
- The date adapter (`chartjs-adapter-date-fns`) would add approximately **7–10 kB gzip**
  depending on the date-fns version and tree-shaking. A lighter option is
  `chartjs-adapter-luxon` if Luxon is already a dependency.
- Adding a scatter or radar chart type would each add approximately 5–10 kB gzip through
  their respective controllers and scale registrations.

The core Chart.js library (~60 kB gzip) dominates the total and cannot be avoided. The
practical floor with any meaningful chart set is around 55–65 kB gzip. This compares
unfavourably to a hand-rolled D3 build for a small fixed chart set, but favourably to
Plotly.js, which delivers ~150–250 kB gzip even in its partial bundle form.

---

## Accessibility

### Canvas opacity to assistive technology

A `<canvas>` element, once drawn on, exposes nothing to the browser accessibility tree. No
rendered label, axis tick, data point value or legend entry is readable by a screen reader.
Chart.js does not implement the [Canvas Accessibility API](https://www.w3.org/TR/2dcontext/#best-practices)
fallback content pattern.

In this prototype:

- The `<canvas>` is marked `aria-hidden="true"`, removing it from the accessibility tree
  entirely.
- The mount `<div>` carries `role="img"` and `aria-label` (composed from the chart heading
  and caption by `chart-card.njk`). This gives screen reader users a one-line announcement
  that a chart exists and what it shows, but no data.
- Every chart is paired with a server-rendered `<details>` / `govukTable` data table that
  is fully accessible without JavaScript. This is the primary accessible representation.

### Keyboard interaction

Chart.js provides no keyboard interaction with data points. There is no way to tab to a
data point, read its value, or navigate between series using a keyboard alone. The
click-to-expand navigation on the weekly-cases chart is attached to the mount `<div>` via a
click listener — a `<div>` is not keyboard-focusable by default and is not in the tab order.
Wrapping the mount in a `<button>` or `<a>` element would be needed for keyboard access.

### Tooltips

Tooltips are pointer-only (hover/touch). They are not exposed via ARIA, are not
keyboard-accessible, and disappear when focus leaves the element. A WCAG 2.2 assessment
would flag these as a failure of **1.4.13 Content on Hover or Focus** unless the tooltip
content is also available through another mechanism. The data table satisfies the
"available through another mechanism" condition, but only if reviewers accept that
equivalence.

### Browser zoom and text size

At 200% browser zoom the canvas resizes via the `responsive: true` / `maintainAspectRatio: false`
settings, but the text rendered inside the canvas does not scale proportionally — it stays
at the pixel size set in `Chart.defaults.font.size`. Setting that default to `1rem`-equivalent
px and re-rendering on font-size change events is non-trivial. This is a known limitation of
canvas-based charts.

### Forced colours / high contrast mode

In Windows High Contrast mode, CSS forced-colours applies to HTML elements but **not** to
canvas pixel content. Chart lines, bars, and legend colour swatches will retain their
original colours regardless of the user's contrast preferences. This means charts may become
unreadable for users who rely on high contrast. The data table remains fully readable in
forced-colours mode.

### WCAG 2.2 AA summary

| Criterion                        | Outcome                                                                             |
| -------------------------------- | ----------------------------------------------------------------------------------- |
| 1.1.1 Non-text content           | **Passes** — `role="img"` + `aria-label` on mount, data table as text alternative   |
| 1.3.1 Info and relationships     | **Passes** — data table conveys structure; canvas is decorative                     |
| 1.4.3 Contrast (text)            | **Cannot fully verify** — canvas text contrast cannot be checked by automated tools |
| 1.4.4 Resize text                | **Fails** — canvas text does not scale with browser font-size preference            |
| 1.4.11 Non-text contrast         | **At risk** — depends on line weight and colour choices                             |
| 1.4.13 Content on hover or focus | **At risk** — tooltips are pointer-only; data table provides equivalent             |
| 2.1.1 Keyboard                   | **Fails** — data points and click-to-expand not keyboard-accessible                 |
| 2.4.3 Focus order                | **Passes** — canvas is `aria-hidden`, not in focus order                            |

---

## CSP outcome

No changes to the CSP were needed. Chart.js assigns sizing via `canvas.style.width` and
`canvas.style.height` as JavaScript DOM property assignments. These are **not** governed by
the `style-src` CSP directive, which applies only to `<style>` elements and `style`
attributes in HTML markup — not to `element.style.*` property writes from script. The
existing `style-src 'self'` policy is sufficient.

---

## How it is used in this prototype

### Registered components

```js
import {
  Chart,
  LineController,
  BarController,
  DoughnutController,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Tooltip,
  Legend,
  Filler
} from 'chart.js'

Chart.register(
  LineController,
  BarController,
  DoughnutController,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Tooltip,
  Legend,
  Filler
)
```

`TimeScale` is not registered because no date adapter is installed (see Suggested
iterations). Date-labelled axes (`labelType: 'date'`) use `CategoryScale` with ISO date
strings as category labels. Tick density is controlled with `maxTicksLimit: 8`.

`Filler` is registered to support the area fill on the line chart (`fill: true`).

### Chart configurations

| Chart                | Type            | Key options                                                   |
| -------------------- | --------------- | ------------------------------------------------------------- |
| `weekly-cases`       | `line`          | Single series, `fill: true`, `tension: 0.3`, `pointRadius: 3` |
| `cases-by-region`    | `bar`           | Single series, vertical bars                                  |
| `cases-by-disease`   | `bar` (stacked) | Multi-series, `stacked: true` on both axes, bottom legend     |
| `severity-breakdown` | `doughnut`      | `sliceColours` array from data, bottom legend                 |

All charts share:

```js
{ responsive: true, maintainAspectRatio: false }
```

The mount `<div>` has a fixed CSS height (260 px on the grid, 440 px in the expanded view)
with `position: relative`. Chart.js reads the container dimensions and fills them, so the
same chart code works at both sizes without configuration changes.

### Data wiring

For each `.app-chart[data-chart-id]` mount the module:

1. Reads `data-chart-id`, `data-chart-type`, `data-chart-href`, and `data-clickable`.
2. Finds the sibling `<script type="application/json" data-chart-data="{id}">` and
   `JSON.parse`s it.
3. Creates a `<canvas aria-hidden="true">` and appends it to the mount.
4. Dispatches to the appropriate builder function.

### Click-to-expand

When `data-clickable === "true"` a click listener is added to the mount div that calls
`window.location.assign(chartHref)`. The cursor is set to `pointer` by CSS
(`.app-chart[data-clickable="true"]` in `_dashboard.scss`) — no inline style is applied.

---

## Suggested iterations

### Date axis

Install a date adapter and switch to `TimeScale` for proper date axis formatting:

```
npm install chartjs-adapter-date-fns date-fns --save-exact
```

Then replace `CategoryScale` with `TimeScale` and configure:

```js
scales: {
  x: {
    type: 'time',
    time: { unit: 'week', displayFormats: { week: 'd MMM yy' } }
  }
}
```

`chartjs-adapter-luxon` is a lighter alternative if Luxon is already in the bundle.

### GDS Transport font

Add to your client entry point before any charts are rendered:

```js
Chart.defaults.font.family = "'GDS Transport', Arial, sans-serif"
Chart.defaults.font.size = 16
Chart.defaults.color = '#0b0c0c' // govuk-colour('black')
```

### Shared chart-config module

The four builder functions share repeated options (`responsive`, `maintainAspectRatio`,
axis label styles, tooltip configuration). Extracting a shared `chartDefaults.js` module
would reduce duplication and make a single point of change for GOV.UK styling decisions.

### Accessible tooltips

Replace Chart.js's default canvas tooltip with an external HTML tooltip plugin
(e.g. a custom `afterDraw` hook that positions a visually-hidden `<div>`) so that tooltip
content is in the DOM and can be read by assistive technology. Alternatively, suppress
tooltips entirely and rely on the data table.

### Keyboard access to click-to-expand

Replace the `<div>` mount with a `<button>` or `<a>` element for the clickable
`weekly-cases` chart, so keyboard users can activate the expanded view without a mouse.
The current click listener on a `<div>` is not keyboard-accessible.

### Server-side / static rendering

Chart.js does not run in Node.js without a canvas shim. Options for static output include:

- [`chartjs-node-canvas`](https://github.com/SeanSobey/ChartJS-Node-Canvas) — renders to
  a PNG buffer server-side using `node-canvas`.
- Pre-generating PNG chart images at build time and serving them as `<img>` elements with
  `alt` text (simpler, but loses interactivity).
- Switching to a library that produces SVG (D3, Plotly in SVG mode) if vector output or
  server-side rendering is a hard requirement.

### Testing canvas output

Vitest/jsdom does not implement the Canvas 2D API, so Chart.js rendering cannot be verified
in unit tests. Options:

- Mock the canvas context and assert `Chart` was called with expected config (unit test,
  tests configuration not pixels).
- Use Playwright or Cypress with a real browser to take screenshots and compare against
  baselines (visual regression).
- For the server-rendered parts (data tables, mount attributes), the existing hapi
  `server.inject` + cheerio tests are sufficient and already cover the contract.
