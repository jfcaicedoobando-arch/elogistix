# Reviewed copy adaptations

This review deliberately separates executable code proposals from real operational
configuration. No copy constitutes approval to install, register or run it.

- `rpc/rpc-attempt.ts`: primitive string checks for context/scope; strict calendar
  timestamp validator. `rpc/rpc-attempt.test.mjs`: 54 added regression cases, 98 total.
- `sql/01-private.sql`, `sql/04-engine.sql`, `issuer/10-issuer.sql`,
  `issuer/13-readonly-verifiers.sql`, `issuer/14-reconcile.sql`,
  `issuer/16-owner-registry.sql`, `identity/tests/bridge/prepare_identity_receipt.sql`,
  `identity/tests/bridge/verify_identity_receipt.sql`: synthetic tenant substitution.
- `sql/04-engine.sql`: synthetic invoice folios replace the historical exclusion list.
- `sql/02-manifest.sql`: synthetic tenant, suppliers, tax IDs, shipment references,
  invoice folios, descriptions and payment labels. Compact JSON checksum regenerated.
  Catalog and identity helper are aligned with the separately prepared synthetic harness.
- `identity/proposals/demo-fixture-identity.sql.proposed`: synthetic tenant, company/
  contact names, cities, states and emails; empty phone and tax fields. Authorization,
  locking and identity validation logic is retained; literal payload equivalence is
  expressly not claimed.
- `identity/tests/bridge/fixture-contract.sql`: synthetic foreign tenant for negative
  cases. This SQL test is not executed or registered by the offline runner.
- `issuer/source-pins.json`: retained approval-body/file hashes; engine file hash
  regenerated. No operational project metadata is retained.
- Other copied SQL and source-contract tests are unchanged. The historical seed core
  body is excluded entirely. There is no replacement public seed function or owner
  metadata stub in this export. The separate harness must label its own fixtures.
- New documentation, synthetic catalog JSON, public source tests and integrity scripts
  describe this export only. Legacy runtime/identity suites and historical results
  have not been copied or counted as validation of this smaller package.

All SQL behavior remains NOT_RUN. The offline suite's source assertions cannot
establish database bypass, permissions, producer behavior or transaction durability.
