# Latest Cases Map — Implementation Plan

## Goal

Show WAHIS "latest cases" outbreak locations on an interactive map, using
`@defra/interactive-map` (the same package demonstrated in
`apha-incubator-maps-poc`). Latitude/longitude values must come only from
the WAHIS `all-information` response (`outbreaks[].latitude` /
`outbreaks[].longitude`, per the `OutbreakSummary` schema in
`wahis-openapi.yaml`). Do not invent, hardcode, or geocode coordinates from
any other source.

## Source of truth for data shape

`wahis-openapi.yaml` → `OutbreakSummary` schema (used in
`GET /review/event/{eventId}/all-information`'s `outbreaks` array):

```yaml
latitude: { type: number, format: double, nullable: true }
longitude: { type: number, format: double, nullable: true }
locationApprox: { type: boolean } # true = coordinates are approximate
location: { type: string, nullable: true }
adminDivision: { type: string, nullable: true }
isCluster: { type: boolean }
clusterCount: { type: integer, nullable: true }
startDate: { type: string, format: date-time, nullable: true }
endDate: { type: string, format: date-time, nullable: true }
outbreakId: { type: integer }
```

Rule: `latitude`/`longitude` are nullable. Any code touching them must
handle `null`/`undefined` on both fields before use.

## Reference implementation to copy the pattern from

`apha-incubator-maps-poc`:

- `src/client/javascripts/map.js` — `InteractiveMap` + `maplibreProvider` +
  `createDatasetsPlugin` (GeoJSON dataset) + `createInteractPlugin`
  (click-to-select, info panel).
- `src/server/routes/map/index.njk` — `#map` container + module script tag.
- `src/server/plugins/content-security-policy.js` — CSP additions required
  for MapLibre GL (tile host, worker blobs, inline styles).

Do not copy the static `european-cities.geojson.json` approach — the
frontend-poc map must render server-supplied, real outbreak data.

## Files to touch in apha-incubator-frontend-poc

1. `package.json`
   - Add dependency: `"@defra/interactive-map": "0.0.40-alpha"` (match the
     version pinned in apha-incubator-maps-poc unless a newer stable
     version is available — check npm registry first).

2. `src/server/plugins/content-security-policy.js`
   - Merge in the same additions used in maps-poc, keeping existing
     Plotly `styleSrc` hash entry:
     - `connectSrc`: add `https://tiles.openfreemap.org`
     - `imgSrc`: add `https://tiles.openfreemap.org`
     - `workerSrc`: add `['self', 'blob:']` (new key, not currently present)
   - Update/extend `content-security-policy.test.js` to assert the new
     directives are present in the response header.

3. `src/server/common/helpers/wahis/latest-cases-geojson.js` (new)
   - Export `buildOutbreaksGeoJSON(events)`:
     - Input: same `events` array shape produced by `getLatestCases()`
       (each item has `summary`, `detail`, `detailError`).
     - Flatten `detail?.outbreaks ?? []` across all events.
     - Filter out any outbreak where `latitude == null || longitude == null`.
     - Map surviving outbreaks to a GeoJSON `Feature`:
       ```js
       {
         type: 'Feature',
         geometry: { type: 'Point', coordinates: [outbreak.longitude, outbreak.latitude] },
         properties: {
           eventId: summary.eventId,
           outbreakId: outbreak.outbreakId,
           disease: summary.disease,
           country: summary.country,
           location: outbreak.location,
           adminDivision: outbreak.adminDivision,
           startDate: outbreak.startDate,
           endDate: outbreak.endDate,
           isCluster: outbreak.isCluster,
           clusterCount: outbreak.clusterCount,
           locationApprox: outbreak.locationApprox
         }
       }
       ```
       GeoJSON coordinate order is `[longitude, latitude]` — do not swap.
     - Return `{ type: 'FeatureCollection', features: [...] }`.
     - Must return a valid (possibly empty-features) FeatureCollection when
       no outbreaks have coordinates — never throw.

4. `src/server/common/helpers/wahis/latest-cases-geojson.test.js` (new)
   - Case: outbreaks with valid lat/long → correct features, correct
     coordinate order.
   - Case: outbreak with `latitude: null` or `longitude: null` → excluded.
   - Case: event with `detail: null` (detail fetch failed) → skipped, no
     throw.
   - Case: no outbreaks at all → `{ type: 'FeatureCollection', features: [] }`.

5. `src/server/routes/latest-cases/controller.js`
   - Import `buildOutbreaksGeoJSON`.
   - On success path, add `outbreaksGeoJson: buildOutbreaksGeoJSON(events)`
     to the view context (need access to raw `events`, not just the view
     model — call it alongside `buildLatestCasesViewModel(latestCases)`).
   - On the upstream-error catch path, pass
     `outbreaksGeoJson: { type: 'FeatureCollection', features: [] }`.

6. `src/server/routes/latest-cases/controller.test.js`
   - Assert `outbreaksGeoJson` is present in the view context on both
     success and upstream-error paths.

7. `src/server/routes/latest-cases/index.njk`
   - Add a map section above or below the existing table, e.g.:
     ```njk
     <div class="govuk-grid-row">
       <div class="govuk-grid-column-full">
         <style>
           #latest-cases-map { width: 100%; height: 500px; border: 1px solid #b1b4b6; }
         </style>
         <div data-testid="latest-cases-map">
           <div id="latest-cases-map"></div>
         </div>
       </div>
     </div>
     {{ outbreaksGeoJson | toJsonScript('outbreaks-geojson') }}
     ```
   - Use the existing `toJsonScript` nunjucks filter
     (`src/config/nunjucks/filters/to-json-script.js`) to embed the
     FeatureCollection safely — do not hand-serialize JSON into the
     template.
   - In `{% block bodyEnd %}`, add:
     ```njk
     <script type="module" src="{{ getAssetPath('src/client/javascripts/latest-cases-map.js') }}"></script>
     ```
   - If there are zero features, still render the map container but skip
     `fitToBounds` client-side (see step 8) rather than hiding the map —
     keep behaviour predictable.

8. `src/client/javascripts/latest-cases-map.js` (new)
   - Modeled on maps-poc's `map.js`:
     - Read `#outbreaks-geojson` script tag content, `JSON.parse` it.
     - `import InteractiveMap from '@defra/interactive-map'`
     - `import maplibreProvider from '@defra/interactive-map/providers/maplibre'`
     - `import createDatasetsPlugin from '@defra/interactive-map/plugins/datasets'`
     - `import createInteractPlugin from '@defra/interactive-map/plugins/interact'`
     - `import '@defra/interactive-map/css'`
     - One dataset (`id: 'latest-cases-outbreaks'`) built from the parsed
       GeoJSON. Style clusters (`isCluster: true`) and approximate points
       (`locationApprox: true`) with visually distinct markers/opacity from
       precise, single-outbreak points.
     - `interactPlugin` for click-to-select; on select, show a panel with
       `disease`, `country`, `location`/`adminDivision`, `startDate`,
       `endDate`, and a note when `locationApprox` is true
       ("Location is approximate").
     - On `map:ready`: if `features.length > 0`, call
       `interactiveMap.fitToBounds(geojson)`; otherwise leave default
       center/zoom (e.g. Europe-wide view) — do not call `fitToBounds` on
       an empty collection.
     - Mount to a `<div id="latest-cases-map">` (match the id used in the
       template, not maps-poc's `#map`).

9. `src/client/javascripts/latest-cases-map.test.js` (new)
   - Mirror `apha-incubator-maps-poc/src/client/javascripts/map.test.js`
     structure/mocking approach for `@defra/interactive-map`.
   - Assert map is constructed with the parsed GeoJSON dataset.
   - Assert `fitToBounds` is not called when features is empty.

## Explicitly out of scope

- Changing `latest-cases-view-model.js`'s existing table output
  (`buildOutbreakRows`, the `"lat, long"` string) — leave untouched. The
  new GeoJSON path is additive, not a replacement.
- Any change to WAHIS fetch logic, filters, or caching
  (`wahis-client.js`, `latest-cases-filters.js`, `latest-cases-data.js`).
- Publishing changes to `apha-incubator-maps-poc` or `wahis-openapi` —
  both are read-only references for this work.
- Clustering algorithm changes beyond what WAHIS already reports via
  `isCluster`/`clusterCount`.

## Verification checklist for the implementing agent

1. `npm install` picks up `@defra/interactive-map` cleanly.
2. `npm test` passes, including new tests for
   `latest-cases-geojson.js`, controller, CSP, and the client map script.
3. `npm run dev` (or equivalent) → visit `/latest-cases` → map renders,
   shows points only for outbreaks with real coordinates, page does not
   500 when WAHIS is unreachable (existing `upstreamError` banner path
   still works, map container renders empty).
4. Confirm in devtools that no CSP violations are logged for MapLibre
   tile requests or worker creation.
5. Confirm GeoJSON coordinate order is `[longitude, latitude]` by
   spot-checking one rendered point against its known real-world location.
6. For production asset handling, see [`frontend-assets-and-maplibre.md`](./frontend-assets-and-maplibre.md).
