# Query-work audit follow-up (2026-10)

Base: `c8387216bbafac7cd28db702604f982ccf4f904c`.

This change removes demonstrably unused work without rewriting financial contracts.
The measurements below are isolated synthetic tests, not production latency or HAR
measurements. No real business records, database load tests, remote migrations, or
production deployment were used.

## Recommendation disposition

| ID | Scope | Disposition |
| --- | --- | --- |
| F01 | CxP server pagination and full-population aggregates | Deferred. Current derived status/origin filters, global sort, totals and exports require the full authorized population. A client-side cap or paging before these computations would reintroduce incorrect totals/false empty results. Requires a versioned server contract and representative SQL tests. |
| F02 | Mutually exclusive shipment list strategies | Implemented: disable paged query while state/alert full-set mode is active. Server-side derived filters and reuse of full-set extras remain deferred; full export is unchanged. |
| F03 | Unused executive finance KPIs | Implemented: remove subscription, loading dependency and unused return field. Critical source loading/errors remain. |
| F04 | CRM analytics work | Partial: stages and opportunities start together; both panels share a compatible stage catalog through QueryClient. Server-side aggregates and the remaining duplicate opportunity read are deferred. Truncation guards and soft-delete filters remain. |
| F05 | Detail prefetch | Implemented: hover and navigation share full query options/key, with 200 ms coalescing, one in-flight full request, and pending timer cleanup on unmount. A final hovered row may still load after pointer exit; no pointer-leave intent signal was added. |
| F06 | CxP lightweight DTO | Deferred with F01. Removing child arrays changes the documented missing-server-balance fallback. Define strict missing-row behavior and validate multi-currency/soft-delete equivalence first. |
| F07 | Treasury computation | Implemented: memoize by input array references, exchange-rate scalars/date, and Mexico business day. Existing shared clock updates at midnight and after a suspended tab returns. Finance retry delegates to Treasury once rather than issuing duplicate CxC/CxP refetch calls. |
| F08 | CRM report waterfall/fan-out | Partial: scoped metadata and report-data invalidation. Initial board → definitions → data waterfall remains; batching/viewport scheduling requires measured representative dashboards and a server/UI contract. |
| F09 | Pricing refresh ownership | Scoped invalidations and one response-tariff polling owner; successful saves refresh responses, cancellation does not. Preserve conditional polling and error states. |
| F10 | SQL plans/index candidates | Deferred: no representative EXPLAIN/BUFFERS evidence establishing a beneficial replacement. Existing indexes, RLS, security-invoker views and currency conversion remain untouched. |
| F11 | Action-only code | JSZip import deferred until ZIP action, preserving bounded download concurrency and auth-scope checks. TarifaForm lazy loading and other chunk changes remain measurement-dependent. |

## Synthetic regression measurements

New tests executed both against unmodified base and implementation:

- Finance: the unused executive hook is no longer called, even when its mocked
  response stays loading. Actual CxC loading/errors still propagate. Retry calls
  the Treasury owner once, which refreshes its underlying sources.
- Shipment state/alert filters: zero unused paged reads, including a local page
  change; switching back to ordinary mode makes one paged read.
- Shipment hover sweep across two rows: one full-detail fetch, no legacy detail
  fetch; navigating to the prefetched row uses the same cached result. Unmount
  before 200 ms prevents the pending request.
- Treasury: fixtures of 100, 1,000 and 5,000 rows each perform one calculation for
  mount plus ten unchanged rerenders, versus eleven on the base. Replacing an
  input array or exchange rate recomputes; unchanged inputs preserve result
  identity and totals. The 30-day window advances at Mexico midnight.
- CRM analytics: opportunities are requested while the stage response is still
  pending. The two mounted panels issue five mocked reads, including one shared
  stage read, instead of the six-read base structure. This is not a reduced-row
  aggregate; all existing truncation protections remain.

The new first-batch/analytics regression suite fails on the original base
(10 failures, one pass), demonstrating the missing behavior rather than merely
asserting implementation internals. Existing domain and service tests provide
separate result-equivalence coverage.

## Remaining acceptance work

F01/F06 must test full-population KPIs, global ordering, derived filters, export,
notes, cancelled records, missing balance rows and rows beyond the first page.
Do not turn complete reads into arbitrary limits. F04 server aggregates must
compare currencies and deleted/missing stages over more than 5,000 records;
client truncation errors must not be suppressed. F10 requires representative
small and large datasets with equivalent tenant roles and SQL plans before and
after, rather than assuming textual repeated subqueries are repeated scans.

No latency percentage is claimed. Browser interaction timings, transferred bytes,
React commit durations, production p95, and deployed SQL plans remain unmeasured.

## Invalidation and interaction regression measurements

- With 1, 6, and 20 mounted report datasets, creating/renaming a board performs
  zero aggregate reads. Editing a report refreshes its list and its aggregate
  once; removed definitions are removed from cached metadata before they can
  remount stale data observers.
- Pricing response tariffs have one query observer and one foreground read per
  30-second polling interval. Background polling pauses and resumes. Form
  cancel/reopen adds no reads; successful/partial saves trigger one refresh.
- Successful request persistence does not await subsequent list refreshes. A
  deferred/erroring refresh cannot suppress the form's attachment callback.
- Shared CRM stages do not have an independent retry budget: with two outer
  retries, a failing panel makes three stage reads, not nine nested attempts.

Independent review found the retry multiplication and mutation-callback ordering
issues during development. Both were fixed and covered by regression tests
before publication. Review did not include real-browser or attachment-upload
integration testing.
