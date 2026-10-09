# Shipment receivable: fiscal credit lineage

The published fixture (A 100 / B 300, invoice 400, selective credit 100 against A)
returned sale A 0 / B 300 correctly but pending collection A 75 / B 225. The independent
pending branch still multiplied the canonical invoice balance by original base
weights. This forward changes only `venta.pdte_cobro_mxn` in the existing
`pnl_financiero_embarque(uuid)` reader. React already displays null as “No calculable”.

## Bounded contract

- A wholly single-shipment invoice retains its canonical invoice balance.
- Multi-shipment attribution uses fiscal gross: persisted invoice concept base,
  its explicit VAT treatment/rate and retained amounts. Bases and gross totals
  must reconcile exactly with the header. A rounding discrepancy is unknown;
  it is never spread across shipments silently.
- Every active NC (Timbrada/Aplicada, not deleted) needs valid same-invoice,
  same-organization lineage and complete fiscal metadata. Base, VAT and
  retentions are rounded independently per line, following the existing NC
  writer. Their sum must equal the persisted gross NC amount exactly.
- Cumulative gross conversions use the existing canonical NC currency helper,
  with currency/rate prevalidation. The resulting document-currency debt is
  converted to MXN once using the invoice valuation already chosen by the RPC.
- With no collections, exact remaining gross amounts are shown. A credited-out
  shipment shows zero. If only one shipment retains debt, it receives the
  canonical remaining invoice balance after collections. If multiple shipments
  retain positive debt and a collection has no proven lineage, pending is null.
  The payment's shipment header is never treated as payment allocation.
- Invalid/legacy multi-shipment fiscal data or lineage produces null only for
  pending collection. The existing sale, detail, margin, cost and diagnostic
  calculations are left unchanged. Zero/negative canonical balance has no
  remaining debt. Existing invoice-state eligibility remains unchanged.

No fiscal document, payment, historical row, role, grant, helper or schema is
rewritten. No production migration or deployment is performed by these tests.

## Installation and evidence

The forward requires an existing transaction and stops on an unreviewed body.
Its envelope is the existing audit144 pre/post catalog and ACL invariant, with
the preimage pinned to audit144 and the postimage pinned to this reader. Applying
it twice is idempotent. Autocommit is rejected before replacement. Caller
rollback restores the original body atomically; a later rollback release must
be another explicitly reviewed forward, not an edit to migration history.

`run-local.sh` owns a fresh loopback-only PostgreSQL 17.9 cluster and closes it.
`run-ci.sh` runs only in the isolated Actions service, creates its own disposable
database, rolls back its synthetic objects and roles, and drops the database.
Both execute the actual complete pre/post RPC, using the live baseline balance
calculator (including Timbrada, Aplicada and cancelled-REP exclusion), never a
constant-zero balance stub. The original audit144 files remain unchanged.

The focused suite has 31 cases, comparing both shipments, and checks every other
JSON field against the previous reader. It includes the GUI fixture, mixed VAT,
retentions, collection ambiguity, the sole remaining debtor, cancelled/deleted
collections and credits, FX, normalized/foreign/missing identities, inconsistent
fiscal totals, invalid metadata and genuine zero. The old reader is a red
control (A 75 instead of 0). The focused step runs before normal RLS schema replay;
the normal replay and schema-baseline checks still apply in CI.
