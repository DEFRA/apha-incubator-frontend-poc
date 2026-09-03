# IDM Disease Intelligence Review Prototype — Thin MVP

## Summary

Build a proof-of-concept inside the existing DEFRA CDP Hapi/Nunjucks frontend template
that demonstrates the spreadsheet-based IDM workflow becoming a digital service:
load a weekly batch of **Outbreak** CSV snapshots (WOAH/WAHIS-style data, one file per
record, keyed by `OUTBREAK ID`), diff it against the previous week's batch to detect
new/changed/removed records (with field-level before/after values for changes), let an
analyst review and mark each record Approved/Rejected/Needs investigation via a
GOV.UK-styled web UI, hold those decisions in memory for the demo session, and expose
approved records both as a JSON download and a simple read-only `GET /api/approved-records`
endpoint. Scope is deliberately narrow: Outbreak records only (Report/Species ignored for
now), local filesystem storage read from a `csv/<batch-date>/` folder layout (already
gitignored), no real S3 wiring yet (documented as a future swap), and in-memory decision
storage that resets on restart. This is explicitly a disposable proof-of-concept, not
production-grade — simplicity is favoured over extensibility everywhere.

### What reviewing the real `WOAHSPOLScrapeCombined-2.xlsx` confirmed/changed

Inspected the workbook's sheet structure and sample data (via header + first rows per
sheet, without loading the full 80MB file into memory). It contains:

- **`ScrapeNew`** (~503 rows) — this week's freshly scraped records (one row per
  outbreak+species combination), keyed by a composite `ScrapeKey` = `EventId + OutbreakId`.
- **`SPOLFull`** (~228,620 rows) — the full historical accumulated master dataset, keyed
  by the equivalent `SPOLKey` = `EventId + OutbreakId`.
- **`SPOLScrapeCombined`** (~188,005 rows, more columns) — the enriched, published/merged
  result: `ScrapeNew` reconciled against `SPOLFull` plus extra lookups (disease
  hierarchy levels, species taxonomy `Family`/`Order`/`Class`).
- Small reference/lookup sheets (`SpeciesMissing`, `Sheet1`, `Sheet2`) — species not
  matched to taxonomy, and admin-division/country name lists used for data cleaning.
  `Sheet3` looks like a legacy/staging dump, not relevant to the MVP.

**This confirms our MVP's conceptual model is a faithful mini version of the real
pipeline**: `ScrapeNew` (latest batch) vs `SPOLFull`-equivalent (previous batch) →
diff → analyst review → `SPOLScrapeCombined`-equivalent (approved/exported output).
Two refinements this drives into the plan below:

1. **Field naming** in our diff/UI will mirror the real convention (`Event Id`,
   `Outbreak Id`, `Disease`, `Country`, etc.) rather than inventing new labels, and the
   review table will surface a few real business fields (Disease, Country, Start/End
   Date) alongside the changed-fields list, not just a raw all-columns dump — this
   makes the demo feel recognisable to IDM analysts.
2. **"Removed" is a simulated concept for the demo, not a strong real-world pattern** —
   in production, WAHIS outbreaks are typically updated/closed (End Date filled) rather
   than deleted outright, so our sample batches will still include a "removed" example
   for completeness, but the plan/docs will note this caveat rather than presenting it
   as a common real occurrence.
3. Our MVP keeps a single-field key (`OUTBREAK ID`) rather than the real composite
   `EventId + OutbreakId` key, because scope is Outbreak-only (no Species join) — this
   remains valid since `OUTBREAK ID` is unique per Outbreak CSV row. No change needed,
   just noting the deliberate simplification versus the real composite key.

## Assumptions

- Only `Outbreak_*.csv` files are in scope; `Report_*.csv` and `Species_*.csv` are ignored
  for this MVP.
- A "weekly snapshot" = all `Outbreak_*.csv` files inside one dated batch subfolder, e.g.
  `csv/2026-08-17/Outbreak_7784.csv`. The app always compares the two most recent batch
  folders (latest vs previous).
- Record identity/diff key = `OUTBREAK ID` column. "Changed" = same `OUTBREAK ID` present
  in both batches but ≥1 field differs; the review UI shows a per-field old/new value list.
- Review decisions (`approved` / `rejected` / `needs_investigation`) are stored in a simple
  in-memory server-side store (e.g. a Map/object in a singleton service). This resets on
  server restart — acceptable for a demo.
- S3 is _not_ wired up for real in this MVP. The batch-loading code lives in one small,
  isolated module reading from local disk (default path `./csv`), so it stays trivial to
  swap for an S3-backed implementation later — but no abstraction layer/interface is
  built speculatively, per "keep this as minimal as possible."
- Export = a `GET` route that returns approved records as a downloadable JSON file. The
  same data also backs a read-only `GET /api/approved-records` JSON API endpoint.
- UI follows the existing template conventions: Hapi route + controller + Nunjucks view
  using GOV.UK Frontend components (matching the pattern in
  `src/server/routes/dashboard-chartjs`), not a separate SPA/framework.
- No authentication/access control is added — matches current template state and is out
  of scope for a demo prototype.
- CSV parsing needs a small new dependency (`csv-parse`) since the WOAH-style CSVs contain
  quoted fields with embedded commas (e.g. `"Latitude, Longitude"`); no such library exists
  in `package.json` today.
- The real CSVs already present in `csv/` (flat, ungitignored-but-untracked) will be
  reorganised by me into two sample batch folders (e.g. `csv/2026-08-17/` and
  `csv/2026-08-24/`) — copying/splitting the existing 6 Outbreak files and lightly editing
  a couple of field values — purely so the diff logic can be demoed/tested locally. These
  folders are already covered by `.gitignore` (`csv`), so nothing sensitive is committed.
- Minor gap (low impact, assumed): exact wording/labels for the three decision states and
  page URLs are my call, following GOV.UK content style — not worth a question.
- The review dashboard will surface a handful of real business fields (`Disease`,
  `Country`, `Outbreak Start Date`, `Outbreak End Date`) alongside `Outbreak Id` for
  context, in addition to the field-level changed-value list — informed by the real
  `SPOLScrapeCombined` column set, so the demo reads like genuine IDM data rather than a
  generic diff tool.
- "Removed" records will be documented as a simulated/demo concept (real WAHIS records
  are typically updated/closed rather than deleted), while still being demonstrated for
  completeness since the original brief asks for it explicitly.

## Plan Steps

1. **Add CSV parsing dependency**
   Add `csv-parse` (sync API) to `package.json`/lockfile.

2. **Batch storage module** (`src/server/common/helpers/intelligence/batch-store.js` or similar)
   - List available batch folders under `csv/` (sorted by folder name/date).
   - Given a batch folder, read & parse all `Outbreak_*.csv` files into an array of row
     objects keyed by `OUTBREAK ID`.
   - Expose a function to get "latest" and "previous" batch's parsed Outbreak records.

3. **Diff engine** (`src/server/common/helpers/intelligence/diff.js`)
   - Given previous + latest record sets (keyed by `OUTBREAK ID`), compute:
     - `new`: IDs only in latest
     - `removed`: IDs only in previous
     - `changed`: IDs in both with ≥1 differing field → list of `{ field, oldValue, newValue }`
     - (unchanged records are computed but not surfaced in the review UI)
   - Unit tests (Vitest) covering each case plus edge cases (empty batch, identical batches).

4. **Review decision store** (`src/server/common/helpers/intelligence/review-store.js`)
   - In-memory Map: `outbreakId -> { status, decidedAt }`.
   - Functions: `setDecision(id, status)`, `getDecision(id)`, `getAllApproved(records)`.
   - Unit tests.

5. **Routes/controllers/views** (new `src/server/routes/intelligence/` folder, following
   the `dashboard-chartjs` pattern):
   - `GET /intelligence` — review dashboard: runs the diff for latest vs previous batch,
     renders new/changed/removed records in GOV.UK tables showing key business fields
     (Disease, Country, Outbreak Start/End Date) plus the field-level old/new values for
     changed records, with a summary line ("Scrape successful: X new, Y changed, Z
     removed outbreaks") and per-record Approve/Reject/Needs investigation actions
     (forms posting back).
   - `POST /intelligence/{outbreakId}/decision` — records the analyst's decision, redirects
     back to the dashboard.
   - `GET /intelligence/approved` — lists currently approved records with an "Export JSON"
     link.
   - `GET /intelligence/export` — downloads approved records as a JSON file
     (`Content-Disposition: attachment`).
   - `GET /api/approved-records` — read-only JSON API returning the same approved record
     set (for external/API consumers).
   - Controller tests following existing `controller.test.js` conventions.

6. **Register new route plugin** in the server plugin registration (alongside existing
   `dashboard-*`, `home`, etc.).

7. **Sample data setup** (local only, gitignored)
   - Reorganise the existing flat `csv/Outbreak_*.csv` files into two batch folders
     (e.g. `csv/2026-08-17/` with a subset, `csv/2026-08-24/` with the rest plus one
     edited record) so `new`, `changed`, and `removed` all have at least one example.

8. **Manual smoke test**
   - Run the app locally, walk through: dashboard shows diff → approve/reject/flag a
     few records → approved list updates → export downloads JSON → `GET
/api/approved-records` returns matching JSON.

9. **Docs**
   - Add a short section to `README.md` (or a new `docs/` note) describing the
     prototype's purpose, the `csv/<batch-date>/Outbreak_*.csv` layout expected, the
     explicit "S3 not wired up yet, local-disk-only for now" note for future work, and a
     brief note that the flow mirrors the real production pipeline observed in
     `WOAHSPOLScrapeCombined-2.xlsx` (`ScrapeNew` → `SPOLFull` → `SPOLScrapeCombined`),
     including the caveat that "removed" records are a simulated concept for this demo.

## ADR Check

No ADR-worthy decisions identified. The two candidate decisions — (a) deferring real S3
integration in favour of local filesystem reads, and (b) using in-memory (non-persistent)
storage for review decisions — are both low-risk, easily reversible, explicitly
demo-scoped choices requested directly by the user for a prototype that "might not evolve
further." Neither meets the bar of "significant and hard to reverse" that would warrant
an ADR. No ADR created or updated.

## Open Questions

None outstanding — scope, data structure, storage, and UI approach were all resolved
during the Q&A.
