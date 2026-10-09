# Audit 145: finalize the confirmed sale snapshot from summary

> Historical implementation evidence. The source bases and results below belong to the original work, not to release46. This file is carried into a LOCAL composition on the proposed release46 tree `4f9c15bea974ce8ed2a22ab3c265ebd1e86ef06f`, which is a candidate and is not asserted to be published main. Current scope and validation limits are recorded in `audit145-current-main-local-review.md`. No new version is assigned, and migration145 is not registered in the release46 manifest.

Follow-on to local recovery commit `b3058f648f26561fa0ea7b76e830ed6caa31a99d`. The new regression first ran against that commit and failed: restoring the local USD 150 override and MXN 10,200 No Objeto line, jumping to summary and choosing Save left the simulated backend with USD 100/116 and no manual line, despite invoking final success.

## Bounded correction

- Finalization now supplies the exact nonblank sale rows, their tax/source metadata and the captured exchange rate to the final service. The same payload builder used by step 3 derives header amount/currency.
- Sales and the final state are sent together in one guarded update. There is no separate successful state update after a failed sale write, and the activity/success callback occurs only after the update resolves.
- A synchronous in-flight guard ignores duplicate Save calls while validation or persistence is pending.
- Summary Save reuses step 1 recipient/general/tariff/CRM checks, step 2 cost/provider/automatic-cost checks and step 3 sale validation. Costs modified since their last successful step 2 save must return through step 2. Saving changes only to internal cost/provider refreshes that acknowledged baseline without overwriting a local sale override.
- An empty sale snapshot is rejected for review in step 3 rather than silently generating and saving replacement sales that were not confirmed by the user.
- Mixed-currency capture without a valid exchange rate and server/concurrency errors leave the local capture available; they cannot report final success.

The final update remains scoped to sales/FX/header currency/amount and the existing state transition. It is not a transaction spanning separately saved general data, cost rows, CRM links or uploads. The reviewed migration and all SQL remain unchanged. No remote database, GUI/PAC, publication or deployment action is part of this work.

## Verification

Final local validation passed: 189 tests across 15 files, changed-file ESLint with no warnings, full app TypeScript and node TypeScript. Focused tests include interrupted draft recovery, summary skip, normal step-3 progression, all step validation failures, mixed-currency FX omission, server conflict/retry, double Save and cost-only baseline refresh. The red reproduction was preserved separately and shows USD100/no manual line before this correction. The combined validation held the shared heavy-work lock from 2026-10-07 08:39:50 to 08:42:12 UTC, used one test worker and a 2560 MiB heap. `git diff --check` and the 200-line production-file limit passed. The frozen combined candidate’s production build and bundle/sourcemap results are recorded separately in its review evidence manifest. No browser QA was run.

The unchanged migration SHA-256 remains `80c1282ad95409da623267ea9a681f2f22545f84eb1bc66a76ef90aba59f8681`.
