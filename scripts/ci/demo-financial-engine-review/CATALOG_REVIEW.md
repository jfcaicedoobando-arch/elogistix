# Canonical catalog source inventory

This extractor is an offline review aid. It verifies the exact published baseline
blob and discovers a conservative closure from the nine engine/lookup tables,
the canonical approval helpers, table defaults, foreign keys, indexes, views,
triggers and public DML targets. It preserves the original source spans and emits
per-statement SHA-256 hashes. It never runs SQL, Docker, a seed or a network call.
The producer's `clientes`, `contactos_cliente` and `crm_empresas` tables are
additional explicit write roots. Financial root-trigger cardinality stays 85 for
comparison with the published engine inventory.

The unavailable Library proposal is not reconstructed or claimed as equivalent.
`source-review.json` records the baseline's last change and the one subsequent
Supabase migration through pinned main. That migration only redefines the four
stopped demo functions; those bodies are excluded entirely from this catalog.

From this directory, with an already-materialized exact baseline:

```text
python3 -I extract_catalog.py --baseline /local/baseline.sql --out diagnostic --diagnostic
python3 -I -m unittest discover -s . -p test_extract_catalog.py -v
```

`--emit-candidate` additionally emits exact selected statements for review. It does
not authorize installation or lift any gate. `dependency_report.json` always has
`complete:false`: the scanner is not a semantic PostgreSQL dependency resolver.
Dynamic SQL, external schemas, support-table bootstrap paths and SQL execution
remain explicit review gates. No generated SQL should be run while those gates
are unresolved. Neither successful extraction nor offline tests certify finance.

Important integration requirements identified from authentic sources:

- Install source order `01-private`, `02-manifest`, `04-engine`, issuer `10` to
  `16`, authentic identity/bridge/producer, then `06-simulation-guards`. The
  authentic registry must replace the fail-closed adapter placeholders.
- The private installer requires the same approval/core owner with SUPERUSER or
  BYPASSRLS authority. The laboratory may bootstrap an explicitly labeled synthetic
  NOSUPERUSER BYPASSRLS owner. Do not weaken that guard or claim RLS acceptance.
- The authentic SQL transport predicate requires registered login/technical-role
  OIDs, actual `SET ROLE service_role`, matching synthetic claims, and the pinned
  owner executing the SECURITY DEFINER boundary. A direct owner call alone cannot
  pass the authentic issuer. A SQL fixture is not real HTTP/JWT authentication.
- Extend supplier/shipment/category rows and install canonical defaults/triggers
  before producing any immutable identity snapshot. Supplier category/type,
  shipment mode/type, internal invoice folios, revision timestamps, approval,
  financial conversion and payment balances must use canonical definitions.
- Resolve the sanitized manifest/payment-literal conflict in a versioned local
  copy, preserving the upstream files and recording source-map hashes.

The PR344 input fixture cannot be reused as a canonical financial fixture. Its
category is `Synthetic test category`, while the engine requires `Sin categoría`.
Supplier labels A/B/C must match the manifest's numbered suppliers after canonical
normalization. Shipment expedientes `SYNTHETIC-1/2/3` must match
`SYNTHETIC-SHIPMENT-1/2/3`. Shipment state `Activo` is absent from the canonical
enum; an explicit allowed state such as `Confirmado` must be chosen. Real shipment
columns also require `modo` and `tipo`, and the supplier category constraint
requires a matching `tipo` or `subtipo_gasto`. Build a new explicit UUID mapping
for aap/ttn/ofc before any immutable producer snapshot; do not repair sealed rows.

Financial acceptance needs a fresh genuine producer/registry-issued context in
each database. Happy path must verify 13 paired actions, three approvals, one
simulated payment, equal checkpoint/marker/receipt/projection, and stable replay.
Five independent injected failures must reach their exact SQLSTATE/message before
row snapshots prove rollback: event, receipt, checkpoint, marker, execution receipt.
Both-tenant manual sentinels and all writer/identity/business rows must survive.
Check deferred constraints explicitly. Require cleanup of the owned container and
anonymous volumes before any PASS. Keep synthetic auth, engine and real transport
results separate; real transport, durable dispatch and activation remain NOT_RUN.
