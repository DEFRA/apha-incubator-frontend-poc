# Esri Map — Implementation Plan

## Goal

Populate the existing `/esri-map` placeholder page (`src/server/routes/esri-map/`)
with a real map, rendered with `@defra/interactive-map`, showing positive wild
bird avian influenza findings from an Esri ArcGIS Feature Service. Follow the
same server-fetch → GeoJSON → `datasets` plugin pattern already used for
`/latest-cases` (see `docs/latest-cases-map-plan.md`) — no new/beta
dependencies (`@arcgis/core`) needed.

## Data source

**Service:** `Positive_Wild_Birds_All_Seasons_(Public)` FeatureServer, layer `0`
(`Wild_Birds_All`), single point layer, public, no token required.

**API URL:** Configure the base service URL in `.env` (e.g. `ESRI_API_URL`). The
query parameters use `where=1=1`, `outFields=*`, `returnGeometry=true`, and
`f=geojson`. Without the `where=1=1` clause, the ArcGIS service returns little/no data.

Query params:

| Param            | Value     | Why                                                                                   |
| ---------------- | --------- | ------------------------------------------------------------------------------------- |
| `where`          | `1=1`     | Required — with no `where` clause ArcGIS returns zero/most records                    |
| `outFields`      | `*`       | Return all attribute fields                                                           |
| `returnGeometry` | `true`    | Include point coordinates                                                             |
| `f`              | `geojson` | Response format — GeoJSON `FeatureCollection`, ready to hand to the `datasets` plugin |

**Pagination is required.** The service's `maxRecordCount` is `1000`, and a
5-record test request already came back with `"exceededTransferLimit": true`.
The full dataset must be fetched in pages using `resultOffset` /
`resultRecordCount`, repeating until `exceededTransferLimit` is `false` (or the
response has fewer than `resultRecordCount` features), then merging all pages
into a single `FeatureCollection`. Use the `ESRI_API_URL` environment variable
to construct paginated requests with `resultOffset` and `resultRecordCount` query parameters.

**Fields returned** (from `FeatureServer/0?f=pjson`):

```
OBJECTID        esriFieldTypeOID
Town            esriFieldTypeString
District        esriFieldTypeString
County          esriFieldTypeString
Country         esriFieldTypeString
Date_collected  esriFieldTypeDate   (epoch ms, UTC)
Species         esriFieldTypeString
Test_date       esriFieldTypeDate   (epoch ms, UTC)
Virus_Isolated  esriFieldTypeString (e.g. "H5N1")
High_Path       esriFieldTypeString ("yes" / "no")
Season          esriFieldTypeInteger
```

Sample feature (from a live test query):

```json
{
  "type": "Feature",
  "id": 1,
  "geometry": { "type": "Point", "coordinates": [-3.077, 52.944] },
  "properties": {
    "OBJECTID": 1,
    "Town": "Wrexham",
    "District": "Wrexham",
    "County": "Wrexham County Borough Council",
    "Country": "Wales",
    "Date_collected": 1634428800000,
    "Species": "Pheasant",
    "Test_date": 1635379200000,
    "Virus_Isolated": "H5N1",
    "High_Path": "yes",
    "Season": 21
  }
}
```

## Categorisation / styling

Group features by `High_Path` (`"yes"` / `"no"` / anything else → `"unknown"`)
into 3 datasets, each with its own colour and a legend entry, mirroring
`featuresByCategory` in `src/client/javascripts/latest-cases-map.js`.

| Category                   | `High_Path` value       | Suggested colour  |
| -------------------------- | ----------------------- | ----------------- |
| High pathogenicity         | `"yes"`                 | `#d61c1c` (red)   |
| Low/non-high pathogenicity | `"no"`                  | `#e8a020` (amber) |
| Unknown/not reported       | anything else / missing | `#6b7f99` (grey)  |

## Existing scaffold to build on

`src/server/routes/esri-map/` already exists as a placeholder:

- `index.js` — registers `GET /esri-map` (done, no change needed).
- `controller.js` — currently returns a static placeholder view (to be
  extended).
- `index.njk` — currently a placeholder paragraph (to be extended).
- `controller.test.js` — currently asserts the placeholder text (to be
  replaced with real assertions).

## Breakdown into small features (one PR/task each)

### Feature 1 — Esri client: fetch + paginate

**Files:** `src/server/common/helpers/esri/esri-client.js` (new),
`esri-client.test.js` (new)

- Export `fetchEsriFeatureCollection(baseUrl, { pageSize = 1000 } = {})`.
- Build the query URL per page: `${baseUrl}/query?where=1=1&outFields=*&returnGeometry=true&f=geojson&resultOffset=${offset}&resultRecordCount=${pageSize}`.
- Loop, incrementing `resultOffset` by `pageSize`, until a page's
  `properties.exceededTransferLimit` is falsy or it returns fewer than
  `pageSize` features.
- Merge all pages' `features` arrays into one `{ type: 'FeatureCollection', features: [...] }`.
- Must not throw on network/HTTP errors — catch and return
  `{ type: 'FeatureCollection', features: [] }`, logging the error (match the
  existing WAHIS client's error-handling style, e.g.
  `src/server/common/helpers/wahis/wahis-client.js`).
- Tests: single page (no pagination needed), multi-page (`exceededTransferLimit: true` then `false`), upstream error → empty `FeatureCollection`, malformed/non-JSON response → empty `FeatureCollection`.

### Feature 2 — Categorisation helper

**Files:** `src/server/common/helpers/esri/wild-birds-geojson.js` (new),
`wild-birds-geojson.test.js` (new)

- Export `categoriseWildBirdFeatures(featureCollection)`.
- Group `features` into `{ high_path: [], low_path: [], unknown: [] }` by
  `properties.High_Path` (`"yes"` → `high_path`, `"no"` → `low_path`,
  anything else/missing → `unknown`).
- Return the 3 groups as `FeatureCollection`s ready for the `datasets` plugin.
- Tests: mixed values, missing `High_Path`, case-sensitivity (e.g. `"Yes"`),
  empty input.

### Feature 3 — Controller wiring

**Files:** `src/server/routes/esri-map/controller.js` (extend),
`controller.test.js` (extend)

- Define the service base URL as a named constant (or config value if this
  repo has a config module for external URLs — check
  `src/config/config.js` first and follow that pattern rather than a bare
  string).
- Call `fetchEsriFeatureCollection` then `categoriseWildBirdFeatures`.
- Pass the 3 categorised `FeatureCollection`s into the view context (e.g.
  `highPathGeoJson`, `lowPathGeoJson`, `unknownGeoJson`).
- Replace the placeholder `Esri map` paragraph assertions in
  `controller.test.js` with assertions that the view context/rendered
  script tags contain the expected GeoJSON keys; mock
  `fetchEsriFeatureCollection` so the test doesn't hit the real network.

### Feature 4 — Template + client map module

**Files:** `src/server/routes/esri-map/index.njk` (extend),
`src/client/javascripts/esri-map.js` (new),
`src/client/javascripts/esri-map.test.js` (new)

- In `index.njk`: replace the placeholder paragraph with a map container
  (`<div id="esri-map"></div>`), embed the 3 `FeatureCollection`s via the
  `toJsonScript` filter (e.g. `{{ highPathGeoJson | toJsonScript('high-path-geojson') }}`,
  and similarly for the other two), and add the module script tag in
  `{% block bodyEnd %}`:
  ```njk
  <script type="module" src="{{ getAssetPath('src/client/javascripts/esri-map.js') }}"></script>
  ```
  Also add `{% for href in getAssetCss('src/client/javascripts/esri-map.js') %}` in the head, matching `latest-cases/index.njk`'s pattern.
- In `esri-map.js`:
  - Read and `JSON.parse` the 3 script tags.
  - `import InteractiveMap from '@defra/interactive-map'`,
    `maplibreProvider` from `@defra/interactive-map/providers/maplibre`,
    `createDatasetsPlugin` from `@defra/interactive-map/plugins/datasets`,
    `import '@defra/interactive-map/css'`.
  - Build 3 datasets (`esri-map-high-path`, `esri-map-low-path`,
    `esri-map-unknown`), styled per the colour table above, each with
    `symbol: 'circle'`, `showInKey: true`, `showInMenu: true`.
  - No `interact` plugin yet (display-only — see Feature 6).
  - On `map:ready`, call `interactiveMap.fitToBounds(...)` over the combined
    features if any exist, else leave default center/zoom (reuse the same
    guard pattern as `latest-cases-map.js`).
- Tests: mirror `latest-cases-map.test.js` — assert the map is constructed
  with 3 datasets and correct styles; `fitToBounds` not called when all 3
  collections are empty.

### Feature 5 — Legend (Map Key plugin)

**Files:** `src/client/javascripts/esri-map.js` (extend)

- `import createMapKeyPlugin from '@defra/interactive-map/plugins/map-key'`
  and its CSS; add to `plugins: [...]` alongside the datasets plugin.
- Confirm the legend shows 3 entries with the correct labels/colours (High
  pathogenicity / Low pathogenicity / Unknown).

### Feature 6 — CSP + build check (cross-cutting, do after Features 1–5 build cleanly)

**Files:** `src/server/plugins/content-security-policy.js` (verify only),
`content-security-policy.test.js` (verify only)

- The Esri REST calls are server-side only (Node `fetch`), so **no CSP
  change should be needed** for `connectSrc`/`imgSrc` — the browser never
  talks to `services.arcgis.com` directly. Confirm this holds; only add a
  CSP entry if a follow-up feature (e.g. live client-side refetching) later
  requires direct browser calls to ArcGIS.
- Confirm `npm run build` / dev server serves `esri-map.js` correctly
  (same MapLibre worker vendor-path mechanism already set up in
  `vite.config.js` applies unchanged — no new Vite config needed).

### Feature 7 (optional follow-up, not in initial scope) — Feature selection + info panel

**Files:** `src/client/javascripts/esri-map.js` (extend)

- Add `createInteractPlugin` with `interactionModes: ['selectFeature']` over
  all 3 layer IDs, `idProperty: 'OBJECTID'`.
- Add an info panel showing `Town`, `County`, `Country`, `Species`,
  `Virus_Isolated`, `High_Path`, formatted `Date_collected`/`Test_date`.
- Only start this once Features 1–6 are merged and confirmed working.

### Feature 8 — ADR

**Files:** `adr/use-server-side-geojson-for-esri-data.adr.md` (new)

- Document the decision: server-side fetch + GeoJSON conversion (with
  pagination) via the `datasets` plugin, vs. the beta `@arcgis/core`-based
  ESRI provider (`@defra/interactive-map/providers/beta/esri`) for live
  `FeatureService` rendering.
- Context: beta provider adds a heavier client dependency and is explicitly
  marked unstable in the package; server-side fetch matches the existing
  `/latest-cases` pattern and keeps API calls (and any future auth/token
  handling) server-side.
- Use the `create-adr` skill's standard template (Title / Status / Context /
  Decision / Consequences).

## Explicitly out of scope (initial pass)

- Client-side viewport/bbox-based refetching (static full-dataset snapshot
  per page load only).
- Feature-click interaction/info panel (Feature 7, follow-up only).
- Any date/season filtering or search UI.
- Changes to the beta `@arcgis/core` ESRI provider path.

## Verification checklist

1. `npm test` passes, including new tests for `esri-client.js`,
   `wild-birds-geojson.js`, the controller, and `esri-map.js`.
2. `npm run dev` → visit `/esri-map` → map renders, 3 legend entries visible,
   points coloured by `High_Path`.
3. Confirm total feature count matches the service's true row count (check
   pagination pulled every page — compare against
   `.../FeatureServer/0/query?where=1=1&returnCountOnly=true&f=json`).
4. Confirm no CSP violations logged in devtools (no direct browser calls to
   `services.arcgis.com` expected).
5. Confirm GeoJSON coordinate order is `[longitude, latitude]` by
   spot-checking one rendered point.
