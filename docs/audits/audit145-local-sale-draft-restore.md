# Audit 145: interrupted local sale capture

> Historical implementation evidence. The source bases and results below belong to the original work, not to release46. This file is carried into a LOCAL composition on the proposed release46 tree `4f9c15bea974ce8ed2a22ab3c265ebd1e86ef06f`, which is a candidate and is not asserted to be published main. Current scope and validation limits are recorded in `audit145-current-main-local-review.md`. No new version is assigned, and migration145 is not registered in the release46 manifest.

This follow-on is separate from the reviewed same-session sale regeneration and SQL lineage patch at `f32d8654ecb5a103bfd796fd3e5117eb55f71a90`.

## Reproduced gap and correction

The v3 browser draft omitted both sale arrays. After committed steps 1/2, changing the generated USD sale from 100 to 150 and adding a manual MXN 10,200 No Objeto sale lost both edits after reload, even when explicitly flushing autosave. No step 3 server save had occurred.

Version 4 records the complete local USD/MXN arrays, stable cost lineage, fiscal treatment/rate/flag, SAT product code, notes, totals and mixed-currency exchange rate alongside the existing form, costs, step, quote ID and expected server timestamp. Sale/currency changes outside React Hook Form trigger immediate local persistence. The last synchronized cost snapshot is retained too: returning to step 2 cannot reset a restored sale override, while cost edits made before interruption are still detected at the next synchronization. An explicit empty array is authoritative and does not resurrect previously saved server concepts. Clearing the last local-only sale removes a previously written empty draft instead of reviving that sale on reload.

## Recovery contract

- User and organization remain part of the storage key and are checked inside v4 payloads. The new-quote page remounts the wizard on identity/tenant changes. Delayed restore responses after tenant/user/document changes, unmount or discard are ignored.
- A linked draft must pass one tenant-filtered server snapshot read: exact quote, live row, editable state, no linked shipment and unchanged `updated_at`. Form, costs, sales, FX and step are then applied together. Failed reads or version conflicts leave the original local payload intact and block wizard save/autosave pending an explicit restore/discard decision.
- Repeated Restore clicks share one in-flight operation. Retrying repeats the original timestamp comparison; it does not adopt a newer server version over stale local capture.
- v1/v2/v3 drafts remain readable and explicitly disclose missing sales/tax edits/FX. Unlinked legacy drafts can restore their available form/cost fields. Linked v3 drafts with a matching timestamp restore canonical server sales/FX and return at most to step 2 for review. Linked legacy drafts with no timestamp cannot prove compatibility with server sales, so recovery asks the user to open current server data and retains the local draft.
- Completed saves disable autosave after clearing the draft so the success flow does not recreate it.
- This is browser-local recovery only. It does not claim that unsaved sales were previously committed to the database, synchronize independent tabs, or recover a file attachment (MSDS).

## Validation

Validated locally: 151 tests passed across 13 focused files; changed-file ESLint passed without warnings; full app and node TypeScript checks passed. Interruption/recovery, baseline resumption, legacy, malformed snapshots, tenant/user/document isolation, cancellation/editability, controller wiring and service-query tests are covered. All changed production files meet the 200-line limit, and `git diff --check` passed. The final validation acquired the shared heavy-work lock at 2026-10-07 08:20:49 UTC and used a 2560 MiB heap with a single Vitest worker. That focused pass did not run a production build or browser QA; the subsequent combined candidate has separate build/gate evidence.

The recovery commit alone did not correct skipping directly to the summary with valid unsaved sales. That separately reproduced route is now addressed in the subsequent [summary-finalization correction](audit145-summary-finalization.md), with its own red-to-green test and single-write finalization contract.

The reviewed migration `20261008000000_audit145_cotizacion_venta_lineage.sql` is unchanged: SHA-256 `80c1282ad95409da623267ea9a681f2f22545f84eb1bc66a76ef90aba59f8681`. No remote SQL, GUI/PAC actions, deployment or publication was performed.
