# Canonical replay of tarifario Drizzle 0010

This package preserves the immutable `drizzle/migrations/0010_tarifario_pricing.sql` and adds its reviewed Supabase replay. It does not apply SQL remotely.

- Source SHA-256: `2d6e1e42612e6b1e7b028e12c91fcdf3a5f0cfba1946d89a8a7562712d2c25c8`.
- Replay: `20261006234000_replay_tarifario_pricing.sql`. Its timestamp is a reserved replay ordering slot between release 38 (`20261006233700`) and release 39 (`20261006234200`), not a claim about the production application date.
- Replay SHA-256: `52a656f865c8f1eb6bb5eda548d383b1ad252cabe099f005dcb52c7332f5b00d`.
- Replay uses IF NOT EXISTS for tables, indexes and the column, and DROP POLICY IF EXISTS before recreating each identical policy. These guards satisfy the canonical migration idempotency contract. The immutable source, function body, table/column definitions, policies and explicit GRANTs remain unchanged.
- Incorporate this replay and its baseline delta into pending release 39 together with audit 131. Preserve release manifests 35–38 and the reserved ordering of 40–42. The source replay was prepared separately; its integration belongs to the release39 manifest together with131.

## Objects preserved from 0010

Two tables (`costeo_cargos_fob_agente`, `costeo_cargos_locales_naviera`), their primary/foreign/check constraints, two active-row organization indexes, RLS and six policies; `crm_solicitudes_pricing.tarifa_tarifario_id` and its foreign key; `crm_aplicar_tarifa_tarifario(uuid, uuid)` with its original body and execution ACL. Existing object permissions and function definitions must remain unchanged.

The source explicitly grants authenticated SELECT/INSERT/UPDATE on charges. Effective remote privileges can differ because PostgreSQL default privileges are also inherited at object creation. The generic CI post-migration grant previously added DELETE artificially. The test harness restores the isolated pre-harness ACL for these two new tables. This is a CI-only invariant, not a permission template to impose on Lovable Cloud. The baseline includes the isolated replay ACL matching those explicit grants, and `tarifario_cargos_permisos.sql` checks table and RPC privileges after the harness.

## Validation and reconciliation boundaries

An isolated PostgreSQL 17 replay of the canonical history and a forward application on pristine release 38 produce identical schema snapshots before any CI grants. The baseline delta is constrained to the same insertion-only object blocks; historical baseline objects are retained. Local fixtures do not certify remote equivalence.

The replay has reapplication guards, but it is not an installer that reconciles arbitrary existing schemas. A database may already contain 0010 through Lovable/Drizzle. Before any remote application, read its Drizzle and Supabase migration ledgers and compare complete column types/defaults/nullability, constraints, indexes, RLS/policies, owners, function attributes and full function body against the reviewed source. Compare table and RPC ACLs against the separately captured and reviewed Cloud catalog, preserving its actual privileges and defaults. Object existence alone is insufficient.

If that comparison establishes structural/RPC equivalence and exact preservation of the reviewed Cloud ACLs, prepare a reviewed ledger-reconciliation operation that recognizes the already-applied SQL; do not rerun CREATE TABLE. If differences exist, stop and design a separate reviewed corrective migration. Neither a local test pass nor this document authorizes remote SQL, migration-ledger writes, or deployment.

## Cloud default-privilege context confirmed (2026-10-07 19:11 UTC)

Independent read-only review found Drizzle ledger entry11 with the exact source hash and no Supabase entry for this replay. The source RPC, 23 relevant columns, 11 constraints, four indexes and six policies match the reviewed installation; no extra user triggers were found.

The two charge tables have the existing Cloud ACL: postgres, anon, authenticated and service_role carry `arwdDxtm`, and sandbox_exec carries `ar`. The same privileges occur in the current postgres public-table defaults and four historical tables (costeo_agentes, costeo_tarifas, crm_pricing_opciones and crm_solicitudes_pricing). The source GRANT is additive and does not remove those defaults. This explains the difference from the bare-local replay ACL; it is not evidence that0010 ran incorrectly or proof of row exposure. RLS remains enabled, with no DELETE/ALL policy. RPC execution remains limited to postgres, authenticated and service_role, without PUBLIC/anon execution.

The reviewed path for this already-existing installation is ledger-only recognition, preserving the captured Cloud ACLs exactly. Do not execute replay DDL, GRANT/REVOKE, default-privilege changes or the CI harness remotely. Recheck the complete catalog and both ledgers immediately before and after the independently reviewed operation; any unexpected drift aborts it. These observations are not permission to execute, not a guarantee of future freshness, and not a reason to normalize Cloud privileges to the isolated test baseline.
