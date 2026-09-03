# Latest cases (WAHIS avian influenza, Europe)

## Summary

A server-rendered route, `GET /latest-cases`, that recreates **Workflow 4**
("Full event extract — report + outbreaks + species table"), scoped to
**avian influenza events in Europe submitted in the last 24 hours**. It
is the first route in this repo to call a live
third-party API: it fetches directly from WOAH's public, unofficial,
reverse-engineered WAHIS (World Animal Health Information System) REST API
at request time (cached briefly), and renders the results as a GOV.UK
Accordion — one section per event, with the one-line alert as the heading
and the full report/outbreak/species detail revealed on expand.

## Endpoints used

| Endpoint                                        | Purpose                                          | Confidence       |
| ----------------------------------------------- | ------------------------------------------------ | ---------------- |
| `GET pi/country/list-geo-region`                | Resolve "Europe" to a list of `areaId`s          | ✅ Verified live |
| `GET pi/disease/first-level-filters`            | Resolve avian influenza to `firstDiseases` ids   | ✅ Verified live |
| `POST pi/event/filtered-list`                   | Step 1: the scoped event list                    | ✅ Verified live |
| `GET pi/review/event/{eventId}/all-information` | Step 2: per-event report/outbreak/species detail | ✅ Verified live |

Workflow 4 step 3 (per-outbreak species detail) is **out of scope** — one
request per outbreak, and the aggregated `quantitativeData.totals` from
step 2 is sufficient for this page.

## Scoping decisions

- **"Europe"** is WOAH's own `list-geo-region` "Europe" entry (48
  `areaId`s at time of writing), not a Defra/EU-specific country list. If
  the live lookup fails, or returns no "Europe" entry, the code falls back
  to a static snapshot of those ids
  (`latest-cases-filters.js#FALLBACK_EUROPE_AREA_IDS`), logging a warning —
  WAHIS ids are internal and could be reassigned by WOAH at any time.
- **"Avian influenza"** matches `first-level-filters` entries by name
  (`/avian influenza/i`, `/influenza a virus/i`), currently ids **668**
  (HPAI, poultry), **671** (HPAI, non-poultry/wild birds), **888** (LPAI
  transmissible to humans) and **922** (HPAI, bovines) — verified live
  2026-09-02. Falls back to the same static id list on lookup failure.
- **"Last 24 hours"** is a true rolling window: `submissionDate` is
  day-granularity only and compared at midnight, so the request asks for
  yesterday→tomorrow and a Node-side timestamp cut (`getLatestCases` in
  `latest-cases-data.js`) then drops anything older than `now - 24h`.
- **"Alerts"** = WAHIS _events_, keyed on `submissionDate` (when reported),
  not `eventStartDate` (when the outbreak itself started).
- Results are capped at `wahis.maxDetailEvents` (default 25) detail
  fetches; the page states when results were truncated.
- English only (`language=en`); no pagination/filtering/sorting controls
  on this page.

## Caching and failure handling

- Resolved Europe/avian-influenza ids and the assembled `getLatestCases`
  result are not persisted beyond the module-level in-memory cache used
  by `resolveEuropeCountryIds`/`resolveAvianInfluenzaDiseaseIds`
  (`wahis.cacheTtlMs`, default 10 minutes) — this is a lightweight
  in-process cache, not the shared catbox session cache, since this is a
  disposable POC and the existing catbox instance is wired for session
  state rather than general-purpose caching.
- Per-event detail fetches run with a small concurrency cap
  (`wahis.detailConcurrency`, default 5) and tolerate individual failures:
  a failed `all-information` call renders that event's summary line with
  a "detail could not be loaded" notice rather than losing the whole page.
- If the initial `filtered-list` call itself fails, the page still
  renders (200), with a GOV.UK warning banner instead of the accordion —
  a third party being unavailable should not 500 a POC page.
- The common case is genuinely **zero events** (a 24h avian-influenza
  Europe window is often empty) — the empty state is a deliberate,
  labelled state, not an error.

## Data mapping caveats (Workflow 4 pitfalls)

- Disease/country names are `.trim()`-med — WAHIS sometimes emits trailing
  whitespace (e.g. `"West Nile Fever "`).
- Catalog fields (reason, event status, report status, unit) display their
  `.translation`, not their internal `.keyValue`.
- `quantitativeData.totals` are **cumulative** counts (not just the
  latest report's new counts) — labelled "cumulative totals" in the UI.
- A `null` count renders as "Not reported"; a `0` renders as `0`. These are
  semantically different in WAHIS data and must not be conflated.

## Configuration

All new config lives under the `wahis` key in `src/config/config.js`:
`baseUrl`, `language`, `cacheTtlMs`, `maxDetailEvents`,
`detailConcurrency`, plus optional `timeoutMs` — each overridable via a
`WAHIS_*` environment variable.

## Local development behind a TLS-inspecting proxy (Zscaler)

If local requests to `wahis.woah.org` fail certificate validation, add the
proxy root certificate to `.env` through the existing truststore contract
as a base64-encoded PEM value:

```dotenv
TRUSTSTORE_ZSCALER=<base64-encoded PEM certificate>
```

This is the only required local setup for the WAHIS route.

## Verification

Live-verified 2026-09-02 by comparing filtered vs. unfiltered
`pi/event/filtered-list` calls for the same date window (8 rows filtered
to Europe + avian influenza vs. 33 unfiltered), per this repo's rule that
a `200` alone doesn't confirm a filter works, and by inspecting a real
`pi/review/event/{id}/all-information` response to confirm the
`quantitativeData`/`outbreaks` shapes this page relies on.
