# Audit144: selective customer credits in shipment P&L

This forward follows the literal financial49 reader. It changes only the body
of `pnl_financiero_embarque(uuid)`, its explanatory UI copy and focused tests.
It does not change fiscal documents, stored amounts, states, writers, FX helpers,
RLS, owners, grants, costs, insurance coverage or historical fixtures F11/NC3.

The real consumer is `TabPnl` → `usePnlFinanciero` → `fetchPnlEmbarque` →
`pnl_financiero_embarque`. The separate `_venta_facturada_por_embarque` lineage
implementation does not correct this reader by itself.

## Attribution and valuation

The complete Audit132 economic parser and conversion prevalidation remain
literal. A malformed economic line invalidates the whole note. Only Timbrada or
Aplicada, nondeleted NCs count. A valid zero remains distinct from unknown.

For an existing concept of this invoice and organization, with a live shipment
in the same organization, credit is assigned only to that concept's shipment.
UUID identity is trimmed and normalized before a guarded cast. A missing,
malformed, deleted, foreign or otherwise inconsistent link receives only the
existing invoice factor, with explicit provisional status. No historical link
is inferred. This warning also applies to a single-shipment legacy invoice
because its credited concept is unknown. Unverified economic bases retain the
separate Audit132 warning and are not replaced by gross fiscal amounts.

The loop traverses every persisted JSON line, in ordinality order, before
filtering shipments. Converted cumulative bases produce document-currency
line debits, with the final cumulative value fixed to the complete converted
Audit132 base. MXN debits are differences of rounded global invoice balances
before and after each line. Thus many small FX lines do not introduce independent
rounding errors. Exact shipments receive only their line debits, including a
deterministically allocated valuation residue; provisional lines retain their
factor and warning. The credit-detail sum equals the headline debit. A complete
single-shipment NC with factor one retains the former Audit132 net valuation.
The attribution of a sub-cent valuation residue is deliberately new; it is not
claimed to preserve every old per-shipment proportional result bit-for-bit.

`repartos_provisionales` now counts invoices with an actually unresolved NC
lineage, rather than every multi-shipment invoice containing an NC. Known exact
credits therefore stop hiding calculable profit. Missing economic base, missing
FX and costs/coverage incompleteness continue to block profit independently.

## Bounded tests and installation

Run `scripts/ci/audit144/run-local.sh` with PG_SERVER_BIN and PG_CLIENT_BIN
pointing to local PostgreSQL17.9 binaries. It owns a fresh loopback-only cluster,
uses a shared validation lock, and shuts the cluster down. The fixture refuses
other clusters. Tests execute the real full reader against minimal synthetic
tables, not a substitute implementation or application-wide schema replay.

The old reader is a RED control. The candidate is applied twice, preserving the
catalog and ACL, and tested for selective same/different-shipment credits,
legacy/mixed data, exact zero, FX, malformed bases, 30 small fractional-FX lines,
and a final foreign lineage that must remain provisional without exposing its
concept. Data snapshots before and after every read remain equal. Autocommit
installation must fail at SAVEPOINT without changes.

The migration requires the caller's transaction and stop-on-error behavior.
Its accepted preimage is the literal final49 body, not normalized baseline text.
Baseline projection is a separate one-function patch produced using the native
17.9 dump and the repository's schema-snapshot normalization rules. There is
no global release assignment, remote application, deployment or GUI closure
claim in this delta. Functional acceptance in Sandbox remains separate.
