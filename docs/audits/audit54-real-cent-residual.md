# AUD54 extension: a real cent is outstanding debt

Historical source-candidate report. The current segregated delivery status is documented in [audit54-core-delivery.md](audit54-core-delivery.md).

Local candidate only, based on main `2c7575bfcb3902e7e0c0d1a49c90516b8040ec72`.
Migration `20261007235500` is a provisional local ID; final release ordering needs review.
No production/Sandbox database writes, remote SQL, deployment, backfill or compensating payment.

## Finding and intended contract

Original AUD54 required that an accepted PUE payment fully settle the invoice or have an explicit authorized accounting treatment. The earlier fix instead made the implementation's `<= 0.01` status threshold into the business rule. Its tests asserted that total 1.16 minus payment 1.15 could be Pagada with exact balance 0.01.

The reproduced A8 Sandbox invoice preserved exactly 1.15 in the bank/payment. No accounting adjustment existed. Detail reported Pagada and balance 0.01, hid payment action; Cobranza excluded the invoice; statement retained the cent, while its aging excluded it.

Debt is positive when `ROUND(balance, 2) > 0`, matching `roundMoney` (half away from zero). Zero and positive subcent residuals below 0.005 do not create collectible monetary debt; 0.005 rounds to 0.01 and is collectible. This is a presentation/decision predicate: stored/raw balance, payment, FX conversion and bank movement remain unchanged. Subtraction for PUE validation happens in Decimal/Postgres numeric before rounding, so 1.16 − 1.155 is exactly at the boundary.

PUE must cover the full monetary balance, including credit-note netting. Existing one-active-payment policy remains. A historical PUE with an already recorded payment and residual is visible with review guidance; no second payment is offered or forced. PPD can collect the remaining cent. Overpayment tolerance is unchanged.

## Legacy boundary

No invoice state is rewritten by migration or by reads. Pagada without recorded active applied payments is not added to Cobranza/cartera/aging and is not enabled for payment. Its pre-existing exact balance behavior in `saldo_factura` and the statement remains unchanged, as required by the existing legacy guard. The differing historical scope of those reports is preserved rather than inventing missing transactions.

Pagada with documented active payment and a positive monetary balance becomes visible in collection reads, retaining its stored state for review. Cancelada/Sustituida, deleted payments and canceled REP remain excluded according to each reader's existing scope. No new fiscal or financial adjustment type is introduced.

## Consumers changed and covered by targeted contracts

- `recalcular_estado_factura`: future trigger recalculation considers a real cent outstanding.
- `_assert_pago_pue_exhibicion_unica`: inserts and monetary edits must settle monetary balance; one payment remains enforced.
- Individual payment form and batch row validator/summary: same PUE predicate.
- Detail flags and active-payment context: PPD residual actionable; PUE existing payment blocked; legacy without evidence unchanged.
- Detail residual warning, overdue reminder, overdue styling, payment section's `liquidada` result.
- Credit-note draft/detail `facturaLiquidada` classification: a cent is not falsely labeled settled. No credit-note amount or over-credit tolerance changed.
- `cartera_pendiente` and matching `cartera_pendiente_total`: documented Pagada residual included, same rounding boundary.
- Actual GUI RPCs `cobranza_listado` and `cobranza_agregados`: residual visible, correct status/count and monetary row sums. They now use the existing `_nc_aplicadas_moneda_factura` canon for Timbrada/Aplicada; their old public helper counted only Aplicada, which would invent debt for newly visible Pagada with a stamped NC.
- `estado_cuenta_agregados`: positive monetary debt/counts and per-row monetary sums, same existing organization/portal and historical scope.
- Statement local mapping/status, only-balance filter, aging/bucket filter, local KPIs and shared past-due predicate.
- `cxc_aging_clientes` and drilldown balance filter: same boundary and documented residual. Existing cancellation/substitution/refactoring exclusions preserved.
- Accounting cartera report's shared row filter: includes a real cent; existing FX valuation unchanged.

All raw individual amounts remain intact. Monetary aggregate sums round per invoice to match the UI's existing `sumarMontos` contract, avoiding phantom zero-value counts from fractional currency-conversion residue.

## Mandatory composition for global AUD54 closure and other scope limits

- Mandatory before global AUD54 closure: prepared AUD141/PR168 `cobranza_conteo_vencidas` is absent on this main. Its outstanding-debt predicate must be composed manually with this contract; no AUD141 code is imported.
- Mandatory before global AUD54 closure: Dashboard Dirección `loadCarteraAbierta` queries only open stored states, and `calcularHero` discards Pagada. Its native-currency/converted balance classification must also receive the documented-residual contract; this candidate does not change Dashboard Dirección.
- Mandatory before global AUD54 closure: `validar_cierre_embarque` still has its separate CxC paid-state shortcut and 0.01 threshold. Requires a separate explicit composition with AUD139, whose current delta changes NC state handling. This candidate does not claim to fix shipment closure.
- CxP settlement guards, supplier payment forms, scheduled payments and unrelated finance rules are unchanged. The shared accounting cartera report filter now retains a real cent for either side, without modifying its source data or payment guards.
- PDF/XML historical documents and stored invoice states are unchanged. Statement exports follow their existing visible rows/data.
- No unrelated denied AUD144 tests are run. Targeted SQL fixtures use BEGIN/ROLLBACK, no real stamping.

## Validation record

- Passed: fresh PostgreSQL 17 local replay (287 migrations + existing squash; one data migration excluded by the existing runner).
- Passed: 8 targeted SQL suites: AUD54 PUE closure; AUD54 visible balances; legacy paid balance; overpayment; pending cancellation; multicurrency NC; deleted-NC aging; monetary rounding contract. All fixture transactions roll back.
- Passed: 240 Vitest assertions in 23 files, including UI warning and interactive statement bucket/filter regression; full TypeScript build-mode check; changed-file ESLint; migration hygiene, replay mirror, schema functions, release manifest, test hygiene, architecture, RPC sync and schema-column audits.
- Failed unrelated fixture: generic `test_rls_financiero.sql` inserts organization membership with no auth.users row, causing `user_roles_user_id_fkey` before its financial assertions. Reproduced with the same fixture on untouched `2c7575b` before applying AUD54 in a fresh local replay; this candidate does not alter the fixture or role synchronization.
- Full local schema snapshot differs from committed main in unrelated ACL/view infrastructure. A separate fresh main replay followed by AUD54 in the SAME database proves that only the eight intended function bodies change; the rest of the normalized schema dump is byte-identical. Function/relation owners, ACL, signatures, execution modes and RLS catalog metadata are identical before/after (SHA256 `cd555535e105e94587831b998fcba6b6d3ec5a925a666ecae1d278f116f081fe`). Only those eight pg_dump bodies were copied into baseline; no unrelated permission or view drift was imported. Full baseline equality against main is not claimed.
- SQL contracts are registered in `_guards_manifest.txt` and discovered by the RLS runner. No AUD144-specific denied test was run. Full-release CI/deployment and real GUI retest are not claimed.
- Global AUD54 remains OPEN until the mandatory shipment-closure/141/Dashboard Dirección composition and integrated retest pass.


## Independent-review corrections P1/P2

The first local candidate was rejected on these two points; it is not treated as globally verified.

- P1: `calcularSaldoFactura` now accumulates native payment applications and already-converted NC with Decimal without rounding each value before subtraction. When supplied, the server balance remains authoritative. The real `RawFactura` mapping, only-balance filter, monetary classification, aging and KPIs are tested at 0.0049 / 0.005 / 0.01. Fixtures include the exact USD1.16 − MXN23.10/TC20 application1.155 case, valid foreign-currency NC conversion, multiple NC, mixed cash/NC and canceled/deleted rows. Presentation/classification remains two decimals; stored/raw applications are not rewritten.
- P2: Cartera's existing `pagado` evidence survives conversion to batch candidates. The RPC sums only active applications, whose positive-amount database constraint makes a positive sum evidence of a prior active payment. PUE with missing/nonfinite evidence fails closed. PUE with a prior payment stays visible and linked for review, but is disabled in row/select-all selection, lote derivation, amount entry, FIFO/full-balance shortcuts and validators. PPD partial payments remain supported.
- The shared table primitives now forward TanStack's existing boolean-or-row-predicate selection option; boolean callers retain their behavior. Mobile remains a review/navigation card, with the same explanation.
- A batch submit rechecks the latest committed candidate snapshot after the asynchronous REP lookup. Changed evidence, missing invoices, a closed dialog or unmount prevent starting the mutation. A benign refresh preserves user input and the existing request ID. No new remote preflight is inserted ahead of the idempotent RPC; database atomic guards remain responsible for concurrent races.
- This follow-up changes no SQL, migration, backend ACL or historical data. The existing generic financial-fixture failure remains explicitly not passed. The mandatory global-closure work in shipment closure139, count141 and Dashboard Dirección remains outside this local correction.

Revision validation: 319/319 tests in 33 files passed on the final code, including existing table-selection regressions and old saldo/NC/FX contracts. Full TypeScript build-mode check, changed-file ESLint, test hygiene, architecture, casts and schema-column audits passed. No new PostgreSQL replay was needed because this revision changes no SQL. A new independent review is still required. The separate adjustment-label candidate adds an aria-label to the mobile button in ResponsiveDataTable; compose that independent hunk with the row-selection type change here and rerun mobile regression before release.
