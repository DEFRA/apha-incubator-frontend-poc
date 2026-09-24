# Rendering the wild birds heatmap raster overlay as a server-decoded image source

## Status

Accepted

## Context

The `/esri-map` page needed a georeferenced raster overlay (a wild birds
heatmap GeoTIFF) shown alongside the existing 3 Esri point datasets.

An earlier research pass considered a full Cloud Optimized GeoTIFF (COG)
pipeline: a custom MapLibre protocol handler (e.g.
`@geomatico/maplibre-cog-protocol`) that decodes tiled COG bytes via HTTP
range requests, avoiding a tile server. That approach is designed for
large, multi-resolution rasters where loading the whole file at once is
impractical.

Inspecting the actual sample file provided
(`wild-birds-heatmap.tif`, 110×117px) showed it does not match that
profile: it is a single 512×512 tile (the whole image fits inside it), has
no overview pyramid, and is ~10KB. It is also missing an explicit
`GeoKeyDirectoryTag`, so its CRS is not declared in the file (WGS84 is
inferred from the coordinate values, which plot over GB/Ireland). Whether
production raster files will stay this small, or grow into large/tiled
COGs, is not yet confirmed.

`geotiff` (pure JS, works in Node and the browser) and `pngjs` (pure JS PNG
encoder) were already installable without adding native/binary
dependencies (unlike `sharp`), and MapLibre supports a native `image`
source type (4 geo corner coordinates + any browser-displayable image) that
needs no custom protocol handler at all.

## Decision

We will decode the wild birds heatmap GeoTIFF **server-side** using
`geotiff`, deriving the raster's pixel data and its 4 geo corner
coordinates (from `ModelPixelScale`/`ModelTiepoint` via
`image.getBoundingBox()`), re-encode it as a PNG with `pngjs`, and embed it
as a base64 data URL in the page. Client-side, we add it to the map as a
native MapLibre `image` source + `raster` layer, reached via the
documented `map:ready` event payload
(`interactiveMap.on('map:ready', ({ map }) => {...})`, the underlying
MapLibre `Map` instance), after confirming `map.isStyleLoaded()`.

We will **not** adopt a COG HTTP-range-request protocol library
(`@geomatico/maplibre-cog-protocol` or similar) at this time. That remains
the fallback approach if production raster files turn out to be large or
tiled enough that loading them whole becomes impractical.

## Consequences

- **Easier:** no new heavy/native dependency; the client bundle stays
  free of TIFF-decoding code since decoding happens server-side; the
  raster's source (local fixture vs. remote S3 URL) is swappable via one
  config value (`raster.wildBirdsHeatmapUrl`) without touching the
  decode/render pipeline.
- **Harder:** the raster layer, its visibility toggle, and any future
  legend entry are maintained by hand in `esri-map.js`, since bypassing
  the Datasets plugin means no automatic legend/Map Key entry or
  layer-menu item is generated for it.
- **Neutral/follow-up:** the assumed WGS84 CRS should be verified against
  the real production data source. If production rasters turn out to be
  large/tiled, this decision should be revisited (superseded) in favour of
  a true COG range-request protocol.
