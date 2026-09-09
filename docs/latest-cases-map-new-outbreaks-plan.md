# Latest Cases Map — Plot Only New Outbreaks (Last 24h) Fix Plan

## Product requirement (confirmed)

Plot outbreaks **newly reported in the last 24 hours** on the map, even
when they belong to an older, ongoing event. Do not plot an event's whole
outbreak history just because the event itself is old — only the
outbreak(s) actually introduced by a report submitted in the window.

This means the existing intent of `filterOutbreaksIntroducedByReport()`
(match `outbreak.createdByReportId === row.reportId`) is the **correct
mechanism** and must be kept, not removed. The earlier plan
(`docs/latest-cases-map-empty-fix-plan.md`, now superseded/deleted)
recommended dropping this filter — that is rejected per this
clarification.

## Re-diagnosis: why the map still shows nothing today

Two different explanations are consistent with "map shows no points",
and they need different responses:

1. **Legitimately zero.** Most reports in any 24h window are `FUR`
   (follow-up) reports that update existing outbreaks' counts/status
   without adding new outbreak locations. If, in the current window,
   none of the matched events happens to have introduced a genuinely new
   outbreak, an empty map is the _correct_ result, not a bug — but the
   page gives no way to tell "correctly empty" apart from "broken".
2. **A robustness gap in how "this report's new outbreaks" is
   identified**, specifically:
   - `getLatestCases()` calls `getEventAllInformation(row.eventId)`
     (`GET /review/event/{eventId}/all-information`), which
     `wahis-openapi.yaml` documents as "the latest validated state of an
     on-going event" — i.e. an **event-scoped**, always-current snapshot.
   - `EventSummary` rows from `/event/filtered-list` are **per report**,
     not per event (`EventSummary` has `reportId`/`reportNumber`/
     `submissionDate` per row — the same `eventId` can legitimately appear
     more than once in a 24h window if it received more than one report).
   - The code filters the event-scoped cumulative outbreak list by
     `createdByReportId === row.reportId` per row. This should still work
     per-row in the common case, but it depends entirely on
     `createdByReportId` being populated correctly and on the event-scoped
     "latest" snapshot still containing that report's outbreaks
     unchanged. This assumption is **unverified against the live API** —
     `wahis-openapi.yaml` marks `OutbreakSummary`/`createdByReportId` as
     verified-live in general, but nobody has checked a live sample where
     `report-evolution.newOutbreaks > 0` to confirm the matching
     `all-information` outbreak actually carries that exact
     `createdByReportId`.
   - There is no defensive fallback: if `createdByReportId` is ever
     missing/null on a genuinely-new outbreak (undocumented edge case),
     it silently drops that outbreak with no logging to notice it.

## Plan

### Step 0 — Verify the assumption against the live API (spike, do first)

Before changing code, confirm the mechanism actually works when there is
real new-outbreak data:

1. `GET /pi/event/{eventId}/report-evolution?language=en` for a few
   `eventId`s from the current `/event/filtered-list` results, find a
   report version with `newOutbreaks > 0`.
2. `GET /pi/review/report/{reportId}/all-information?language=en` for
   that exact `reportId`.
3. Confirm the `outbreaks[]` array contains `newOutbreaks`-many entries
   with `createdByReportId === reportId`.
4. If this checks out, proceed with Step 1–4 below (hardening, not
   redesign). If it does not check out (e.g. `createdByReportId` is
   consistently a different/older id, or missing), stop and re-scope —
   the whole "new outbreak" feature would need a different data source
   (e.g. diffing `report-evolution` totals over time, which is a bigger
   change and its own plan).

### Step 1 — Fetch report-scoped detail instead of event-scoped detail

Change `src/server/common/helpers/wahis/latest-cases-data.js` to call
`GET /review/report/{reportId}/all-information` (`getReportAllInformation`,
keyed by `row.reportId`) instead of
`GET /review/event/{eventId}/all-information` (`getEventAllInformation`,
keyed by `row.eventId`).

Reasons:

- It fetches the exact snapshot as of the specific report in the 24h
  window, rather than "whatever the event's current latest validated
  state is" — removes any dependency on the event not having moved on
  since.
- It naturally supports the case where the same `eventId` had two
  reports in the window: each row gets its own correctly-scoped detail
  call instead of two calls to the same event-scoped endpoint that must
  then be told apart only by `createdByReportId`.
- Still requires the `createdByReportId === row.reportId` filter
  afterwards — this endpoint's `outbreaks[]` is still the report's
  outbreak list (cumulative as of that report), not automatically
  narrowed to "new only" (confirm in Step 0).

Changes:

- `src/server/common/helpers/wahis/wahis-client.js`: add
  `getReportAllInformation(reportId, options)` calling
  `GET /review/report/{reportId}/all-information` (mirror
  `getEventAllInformation`'s shape).
- `src/server/common/helpers/wahis/wahis-client.test.js`: add a test for
  the new export.
- `src/server/common/helpers/wahis/latest-cases-data.js`: replace the
  `getEventAllInformation(row.eventId, ...)` call with
  `getReportAllInformation(row.reportId, ...)`. Keep
  `filterOutbreaksIntroducedByReport` as-is (rename if desired, e.g.
  `filterNewOutbreaksForReport`, purely cosmetic).
- `src/server/common/helpers/wahis/latest-cases-data.test.js`: update
  the mocked client call from `getEventAllInformation` to
  `getReportAllInformation`, asserting it's called with `row.reportId`
  (not `row.eventId`).

### Step 2 — Add visibility/logging to tell "empty is correct" from "empty is broken"

In `getLatestCases()`, after building `events`, compute and log (at
`info` level, not `warn`, since zero is an expected outcome some days):

- `totalMatchedEvents` (already have `totalMatched`)
- `eventsWithNewOutbreaks` — count of events where
  `detail.outbreaks.length > 0` after filtering
- `totalNewOutbreaks` — sum of `detail.outbreaks.length` across events

This makes it possible to check logs/metrics and confirm "0 new outbreaks
today" was a deliberate, observed outcome rather than a silent failure.
Also log a `debug`-level line per event when its report is `FUR` and
filtering yields zero outbreaks, to distinguish "no new outbreaks in this
follow-up" from "unexpectedly missing `createdByReportId` match" (the
former is normal; keep the message worded so it isn't read as an error).

### Step 3 — Defensive fallback for `IN` (initial) reports

An `IN` (initial) report, by definition, introduces the outbreaks it
lists — there is no prior report for that event. As a defensive
fallback (not a replacement for the primary filter), if
`row.reportType === 'IN'` and the `createdByReportId` filter yields zero
matches (e.g. missing/null `createdByReportId` on some records), fall
back to treating all outbreaks in that report's response as new. Log a
`warn` when this fallback is used, since it indicates `createdByReportId`
did not behave as documented — useful signal to revisit Step 0's
assumption.

### Step 4 — Tests

- `latest-cases-data.test.js`:
  - Same-event, two-reports-in-window case: two rows for one `eventId`
    with different `reportId`s, each producing its own
    `getReportAllInformation` call and its own correctly-filtered
    outbreak subset.
  - `FUR` report with zero matching `createdByReportId` → empty
    `detail.outbreaks`, no fallback applied, still `detailError: false`.
  - `IN` report with zero matching `createdByReportId` → fallback
    applies, all outbreaks in the response returned.
  - Existing "detail fetch fails" (`onError`) path still passes with the
    renamed client call.
- `wahis-client.test.js`: new `getReportAllInformation` test mirrors the
  existing `getEventAllInformation` test.
- `latest-cases-geojson.test.js` / `latest-cases-view-model.test.js`: no
  behavioural change expected — both already consume `detail.outbreaks`
  as given; re-run to confirm.

### Step 5 — Manual verification

- `npm test` green.
- `npm run dev` → `/latest-cases` → check server logs for the new
  `eventsWithNewOutbreaks`/`totalNewOutbreaks` line on each request.
- If live data currently has zero new outbreaks, confirm this is visible
  in logs as an expected zero, not swallowed silently — this is the
  acceptance bar for "diagnosable", separate from "has points to show
  today".
- If/when live data does include a newly-introduced outbreak, confirm it
  appears as a map point and in the outbreaks table, and that an older
  outbreak on the same event (not introduced by today's report) does
  **not** appear.

## Explicitly out of scope

- Changing the event-list fetch/filter logic (`getFilteredEvents`,
  `latest-cases-filters.js`, submission-date windowing).
- Building a full diff-based "new outbreak" detection using
  `report-evolution` totals over time (only pursue if Step 0's spike
  shows `createdByReportId` matching doesn't work as documented).
- The `isCluster` field mismatch noted previously (`OutbreakSummary` has
  no `isCluster`, only `MapOutbreak` does) — unrelated to this fix, keep
  as a separate known limitation.
