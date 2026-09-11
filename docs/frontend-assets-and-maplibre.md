# Frontend assets and MapLibre wiring

Two production-only traps have already cost this repo significant debugging time.
Both are invisible in `npm run dev`. Read this before adding any client-side entry
point or changing the map.

## 1. Entry-point CSS is not automatic in production

`vite.config.js` declares one input per client entry (`application`,
`applicationCss`, `dashboardPlotly`, `dashboardChartjs`, `dashboardD3`,
`latestCasesMap`). When an entry's JavaScript imports CSS — for example
`import '@defra/interactive-map/css'` in
`src/client/javascripts/latest-cases-map.js` — the two environments behave
differently:

- **Dev.** The Vite middleware injects that CSS at runtime through the JS module
  graph. Nothing needs to be in the template.
- **Production.** Vite extracts it into a separate hashed file and records it in
  `.public/.vite/manifest.json` under the entry's `css` array. **Nothing links it
  automatically.** The template must emit the `<link>` tag.

`getAssetPath()` in `src/config/nunjucks/context/context.js` resolves only the
`file` field. Use `getAssetCss()` for the stylesheets, and render them in the page's
`head` block:

```njk
{% block head %}
  {{ super() }}
  {% for href in getAssetCss('src/client/javascripts/latest-cases-map.js') %}
    <link href="{{ href }}" rel="stylesheet">
  {% endfor %}
{% endblock %}
```

`getAssetCss()` returns `[]` outside production, because the dev server already
injects the CSS.

### Why this matters more than it looks

`@defra/interactive-map` does not only use its stylesheet for appearance. It reads
layout values back out of CSS at runtime:

```js
Number.parseInt(
  getComputedStyle(document.documentElement).getPropertyValue('--divider-gap'),
  10
)
```

`--divider-gap` is defined in `:root` in the library's stylesheet. If that
stylesheet is missing, `getPropertyValue` returns `''`, `parseInt('')` is `NaN`, and
the `NaN` propagates into MapLibre's map padding. MapLibre's
`EdgeInsets.interpolate()` does not validate its input, so the `NaN` is stored
silently and surfaces later as three unrelated-looking errors:

```text
TypeError: null is not an object (evaluating 'n[0]')          // Transform._calcMatrices
Error: Invalid value for edge-insets, top, bottom, ...        // Style._load → migrateProjection
TypeError: null is not an object (evaluating 'this.sky...')   // every later render frame
```

The third error is a knock-on: the second aborts `Style._load()` before `style.sky`
is created.

**Rule.** Any new client entry whose JavaScript imports CSS must render
`getAssetCss()` for that entry in its template, and must be checked against a
production build, not just `npm run dev`.

## 2. MapLibre v6 cannot find its own worker when bundled

`package.json` pins:

```json
"overrides": { "maplibre-gl": "6.4.1" }
```

This is deliberate. `@defra/interactive-map` declares `maplibre-gl: ^5.23.0`, but
every 5.x release carries the critical XSS advisory **GHSA-jrc7-96c5-q579**, which
fails the `npm run security-audit` gate. There is no in-range fix. Do not remove
the override or downgrade to 5.x.

MapLibre v6 is ESM-only and no longer derives its web-worker URL automatically.
`setWorkerUrl()` is now bundler-only. Without explicit wiring the worker never
starts: the raster base map still draws, but vector tiles and GeoJSON are never
parsed, so data layers silently vanish — or, as seen here, the worker request 404s.

Two pieces of wiring handle this. Keep them together; changing one breaks the other.

1. **`vite.config.js` → `maplibreWorkerAssets` plugin.** MapLibre ships
   `maplibre-gl-worker.mjs` and `maplibre-gl-shared.mjs` as siblings that import each
   other by a hardcoded relative path. Vite's normal asset pipeline hashes files
   individually, which breaks that pairing. The plugin copies both files, plus their
   sourcemaps, verbatim and unhashed, to a fixed vendor path
   (`/public/vendor/maplibre-gl/`), and serves them from the same path in dev.

2. **`src/client/javascripts/latest-cases-map.js`.** Builds the worker URL from
   `import.meta.env.BASE_URL` and passes it to the provider:

   ```js
   maplibreProvider({ workerUrl: maplibreWorkerUrl })
   ```

   The provider calls `maplibre.setWorkerUrl(workerUrl)` before constructing the
   map.

Do not replace the vendor copy with a hashed `?url` import. Hashing the pair breaks
the worker's relative import of the shared chunk.

### Verifying the worker actually runs

MapLibre issues vector tile fetches from **worker scope**, not from the page. In
Chrome DevTools the network panel shows them, but automated Chrome DevTools Protocol
checks only see them when `Target.setAutoAttach` is enabled. A zero `.pbf` count in
the page session is a measurement artefact, not a broken worker.

A healthy production map shows all of:

- a worker target for `/public/vendor/maplibre-gl/maplibre-gl-worker.mjs`;
- `200` responses for `tiles.openfreemap.org/planet/...` `.pbf` tiles;
- a vector base map with borders, roads and labels, not just background colour;
- rendered dataset symbols for the outbreak categories.

## 3. CSP notes

`src/server/plugins/content-security-policy.js` already covers the map:

- `connectSrc` allows `https://tiles.openfreemap.org` for style, glyph, sprite and
  tile requests.
- `workerSrc` allows `'self'` and `blob:`.
- `styleSrc` uses `'unsafe-inline'` because MapLibre applies inline styles via JS.
  Per the CSP spec a hash source in the same directive would cancel
  `'unsafe-inline'`, so the previous Plotly-specific hash was removed deliberately.
  Do not reintroduce a hash to `styleSrc`.

## 4. Checklist for new client entry points

1. Add the entry to `build.rolldownOptions.input` in `vite.config.js`.
2. Reference the JS with `getAssetPath('src/client/javascripts/<entry>.js')`.
3. If the entry imports CSS, also render `getAssetCss()` for it in a `head` block.
4. Build with `npm run build:frontend` and run the app with `NODE_ENV=production`.
5. Load the page and confirm the console is clean. Dev alone is not sufficient
   evidence.
