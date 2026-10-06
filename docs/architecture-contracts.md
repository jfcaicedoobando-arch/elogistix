# Incremental architecture contracts

This change preserves feature ownership, transactional SQL and the existing query library. It does not change historical documents, balances, migrations, tenancy policy or deployment settings.

## Financial arithmetic

Finite cent amounts use Decimal `ROUND_HALF_UP` (ties away from zero), matching PostgreSQL `round(numeric, 2)`. `sumarMontos` rounds each already-calculated amount before accumulation. Line prices keep their original precision until quantity multiplication. IVA retains its existing sequence: round the base, multiply by the explicit rate, then round tax. Totals add the rounded base and tax. No currency conversion or exchange-rate fallback was introduced.

This intentionally changes negative half-cent results such as `sumarMontos([-1.005])` from -1.00 to -1.01. It does not recalculate persisted records. Margin ratios and deprecated conversion implementations are outside this monetary-cent migration.

Invalid-input behavior is deliberately not unified silently: existing frontend helpers retain their previous invalid-input behavior; external JSONB contracts reject invalid figures. The fiscal balance helper rejects non-finite input. A future fail-closed migration must inventory in-process callers before changing legacy helper failure semantics.

`tests/contracts/money.json` supplies reference vectors to frontend and Deno tests. `supabase/tests/money_contract_rounding.sql` checks the same PostgreSQL numeric policy and cancellation. Deno entrypoints have a separate inventory/typecheck step; unit tests alone do not cover adapter assembly.

## Fiscal response boundaries

Cancellation recognizes accepted, pending and verifying variants. Accepted cancellation requires its terminal status and substitution flag. Invalid or contradictory bodies retain uncertainty and direct the user to consult status before another request. Both HTTP-error and 2xx-error bodies validate the fields that can enable a retry. Receipt responses require a coherent saved/status pair. Unknown response bodies never become default `false` flags or fabricated zero figures.

## Explicit operation effects

`facturacion/application/efectosRep.ts` owns the REP operation's affected read keys; the hook executes those effects. Existing tuple identities remain unchanged. Payment registration retains its own invalidation, independent of any subsequent REP result. This is one operation migrated incrementally; other operations retain their established helpers.

## Public APIs and pure contracts

Facturación publishes an intentional sales-read API from its root. External sales-read consumers use that API; a dedicated lint rule blocks reopening the private implementation path. Routes remain explicit lazy entrypoints. This is not a claim that all features have completed their public-surface migration.

Domain row contracts belong to domain/types, with compatibility reexports where needed. A resolved-import test checks aliases and relative imports from domain code, including type-only imports. Existing monetary conversions and non-atomic supplier-bank mutators remain available to their characterization tests, but are excluded from the public supplier-service barrel or forbidden in new production imports.

## Saved documents and partial completion

Inbox persistence returns the saved document ID plus explicit flags for unconfirmed suggestions, XML verification and unexpected audit-call failure. Once saved, a later ancillary failure cannot report that the document was never created. The controller invalidates the inbox and emits one partial-success warning; it instructs review of the existing document rather than duplicate upload. A failed XML verification is never marked verified by this fallback. The shared activity logger is best-effort, so successful return does not certify durable audit persistence.

## Static controls and limits

ESLint policy identities are independent, so a later accessibility or cross-feature rule cannot replace monetary, query-key or layer restrictions. Existing exceptions were not expanded to obtain a pass. Tests inspect effective configuration and prohibited/allowed virtual files.

SQL mirror exceptions pin full input signatures, effective migration filenames and both normalized-definition SHA-256 hashes. Formatting normalization preserves literals. The static extractor intentionally covers explicit `CREATE OR REPLACE FUNCTION public.<unquoted-name>` definitions; it does not model dynamic SQL, plain CREATE, quoted function names, DROP/ALTER, permissions or deployed state. Replay, RLS and runtime invariants remain separate checks. No applied migration was edited.

Broader module splits, a complete deep-import baseline, all HTTP adapter behavioral contracts, retirement of every legacy implementation and global invalid-input semantics remain incremental work. These are not prerequisites for replacing the entire application architecture.
