# COG Raster Overlay — Implementation Notes

## Goal

Add a georeferenced raster overlay (a wild birds heatmap GeoTIFF) as an
extra toggleable layer on the existing `/esri-map` page, alongside the 3
existing point datasets.

## What was actually shipped (vs. a full COG protocol)

An earlier research pass (see prior session handoff) considered a full
Cloud Optimized GeoTIFF (COG) pipeline using a custom MapLibre protocol
handler (e.g. `@geomatico/maplibre-cog-protocol`) for tiled HTTP
range-request streaming. Inspecting the actual sample file
(`wild-birds-heatmap.tif`, now at `src/server/data/rasters/`) showed it is
small (583×1091px, single tile, no overview pyramid) — not the kind of
large, multi-resolution raster that range-request streaming exists for.

Given that, the implementation instead uses:

- **Server-side decode:** `src/server/common/helpers/raster/cog-raster.js`
  fetches the raster (remote URL — S3 in production, configured via
  `raster.wildBirdsHeatmapUrl` / `RASTER_WILD_BIRDS_HEATMAP_URL`; falls
  back to the local `src/server/data/rasters/wild-birds-heatmap.tif`
  fixture when unset), decodes it with `geotiff` (pure JS, works in Node),
  and re-encodes it as a PNG data URL with `pngjs` (also pure JS — no
  native/binary dependencies added).
- **Native MapLibre `image` source, client-side:** the 4 geo corner
  coordinates are derived server-side from the GeoTIFF's
  `ModelPixelScale`/`ModelTiepoint` tags via `geotiff`'s
  `image.getBoundingBox()`. The client (`esri-map.js`) reaches the
  underlying MapLibre `Map` instance via the **documented**
  `map:ready` event payload (`interactiveMap.on('map:ready', ({ map }) =>
{...})` — see `MAP_READY` in `@defra/interactive-map`'s
  `src/config/events.js`) and calls
  `map.addSource(id, { type: 'image', url, coordinates })` +
  `map.addLayer({ type: 'raster', ... })` directly, after waiting for
  `map.isStyleLoaded()` (the style can still be loading when `map:ready`
  fires).
- **Manual toggle, no Datasets plugin/Map Key integration:** because this
  bypasses the Datasets plugin, there's no automatic legend entry or
  layer-menu item. A manual checkbox panel (`Layers`) was added, wired to
  `map.setLayoutProperty(layerId, 'visibility', ...)`.

## Known caveats / follow-ups

- **CRS handling:** the current sample fixture declares its CRS as
  EPSG:3857 (Web Mercator) via its `GeoKeyDirectoryTag`.
  `cog-raster.js` detects this via `image.getGeoKeys()` and reprojects
  the 4 corner coordinates to WGS84 (EPSG:4326) before handing them to
  MapLibre's `image` source. Files without a `GeoKeyDirectoryTag` (e.g.
  the original sample) are still assumed to already be WGS84 — **verify
  the CRS of any new production data source** and extend the
  reprojection logic if it uses a different CRS.
- **Scale ceiling:** this approach loads the whole raster into memory
  server-side and ships it as a single embedded PNG data URL. Fine for
  small rasters like the sample; if production files turn out to be large
  or tiled (multi-resolution pyramids), revisit with a true COG
  range-request protocol instead (flagged, not implemented here).
- **Manual layer/legend maintenance:** since this bypasses the Datasets
  plugin, the toggle panel and layer visibility are maintained by hand in
  `esri-map.js` rather than via the plugin's automatic layer menu — keep
  these in sync manually if the plugin's Map Key/legend UI changes.

## Files touched

- `src/config/config.js` — `raster.wildBirdsHeatmapUrl` config value.
- `src/server/common/helpers/raster/cog-raster.js` (+ test) — fetch/decode
  helper.
- `src/server/data/rasters/wild-birds-heatmap.tif` — sample fixture
  (moved from repo root).
- `src/server/routes/esri-map/controller.js` (+ test) — fetches/decodes the
  overlay and passes it into the view context.
- `src/server/routes/esri-map/index.njk` — embeds the overlay payload.
- `src/client/javascripts/esri-map.js` (+ test) — adds the raster
  source/layer and the manual visibility toggle.
