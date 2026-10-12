# Acceptance SQL isolated review candidate

Preparation only. This directory is **not approval of a backend change**.
The v1 early-conversion proposal is deliberately not loaded. The reviewed
business order under consideration is acceptance followed by conversion, with a
narrow exception for an eligible CRM prospect; its v2 bytes are still pending.
The runner currently supports **baseline characterization only** and refuses
candidate execution. Do not turn a neutral baseline pass into a feature pass.

## What is implemented

- Exact `becc073819df29dfc4bf4619e1deb5be92c0a4be` source inventory of 1,528
  replay inputs. Each file's Git blob and byte count are checked before use.
- Repository-native `scripts/ci/rls-prepare-db.sh`: the actual bootstrap,
  inventory-based squash, data-only exclusions and ordered migrations.
- Official PostgreSQL 17.6 image resolved to a recorded immutable digest; actual
  `server_version_num=170006` is required. The runtime owns one new database in
  one identified new container and removes only that exact container.
- No network on the container, published ports, bind mounts, Docker socket,
  project secrets, remote database options, host checkout or persisted
  credentials. Root filesystem read-only, user postgres, dropped capabilities,
  no-new-privileges, bounded memory/PIDs/CPU. SQL/data live in tmpfs.
- Strict same-repository, exact branch, exact base and exact head admission. No
  push, schedule, pull_request_target or workflow_dispatch event.
- Existing Supabase platform bootstrap is used to supply `auth.uid/jwt/role`
  from request claims and unavailable managed platform schemas. Business RPCs,
  policies, constraints and triggers are never mocked. `net.http_post` and
  `pgmq.send` are changed from replay stubs to explicit runtime failures before
  business tests; unexpected network/queue calls cannot fake success.
- `_ci_post_migrate.sql` is NOT run. In particular there is no auth FK removal,
  blanket table/function grant, disabled business trigger, altered policy,
  service-role execution of an authenticated success case, or privileged test
  actor. Test memberships use gerente_operaciones/vendedor and require the
  real membership mirror to create user_roles, avoiding blocked legacy roles
  or duplicate role inserts. The normal signup trigger seeds an initial synthetic sentinel to avoid
  accidentally crowning the first test actor super_admin.
- Twelve neutral behavioral cases call the existing RPCs under actual SQL role
  `authenticated`. Only fixture setup and inspection use postgres. Rejections
  require exact SQLSTATE plus the stable domain code; assertion NULL is failure.
- Per-negative full synthetic organization snapshots cover quotes, CRM,
  clients, stage history, audit, notices, shipments and invoices. Global
  rollback evidence also captures auth.users and the seeded pipeline stages. Whole-suite ROLLBACK is
  verified from a second connection. Public functions/triggers/constraints and
  logical table ACL/RLS catalog are compared before/after, with raw evidence.
  Sequence counters and physical pg_class statistics are not asserted to roll
  back, because PostgreSQL does not provide that guarantee.

## Invocation after independent review and publication

From the repository root:

    python3 scripts/ci/acceptance-review/run.py --static-only
    python3 scripts/ci/acceptance-review/test_runner.py

In the gated Actions PR only:

    python3 scripts/ci/acceptance-review/run.py --characterize-baseline

A default invocation is blocked. The runner does not accept DB URLs, hostnames,
credentials or an arbitrary SQL path. It does not implement v2 loading yet.
`review-contract.json` leaves candidate, semantic suite and concurrency suite
null and marks the state `blocked_pending_semantic_review`.

The generated workflow is scoped to the suggested test branch only and to the
PR base `b355e978bd2fa8adda3195218d32cc61bfbfcc98`. The verified comparison
from backend source base becc073 changes only
`src/integrations/supabase/types.ts` (PostgrestVersion 14.5 to 14.1); no backend
input changed. The source index remains becc073 and every copied backend byte
is still checked. The unrelated types change is preserved. If PR base moves,
re-review the comparison and explicitly update admission; do not quietly switch to current main, relax hashes or mix an
unreviewed migration into the run.

## PostgreSQL version distinction

This PG17.6 job is a diagnostic requested for isolated behavioral validation.
The repository's normal RLS workflow is pinned to **PostgreSQL 17.9**, digest
`postgres@sha256:66b6a97eac1771fc78bd201b918b4253859f436c6913aeede97bd5366cce89ae`.
A PG17.6 run does not prove PG17.9 baseline parity. The final gate must execute
v2 on that verified normal runtime and regenerate/check baseline using the
repository instructions. Do not rewrite the 17.9 baseline using 17.6 output.

No existing NC migration or envelope is changed. Full historical schema replay
naturally includes migrations already present in the exact base; no new NC
migration is part of this package.

## Missing before any feature approval

1. Exact v2 SQL/mirror/forward and final approved eligibility/retry contract.
2. Implement the full `CASE-MATRIX.md` against those bytes, using real functions.
3. Implement the `CONCURRENCY.md` two-session authenticated tests; the old
   concurrency script uses privileged direct UPDATE and does not prove the
   canonical RPC journey.
4. Preserve the complete pre/post function catalog (OID, owner, ACL,
   SECURITY DEFINER, search_path and every non-body property) around the one
   explicitly approved function change. Protected conversion and trigger bodies
   must remain identical. Fail on any extra change.
5. Run existing relevant guards and full RLS on PostgreSQL 17.9, update SQL test
   catalog/guard manifests as required, and confirm exact PR commit checks.
6. Execute the new harness. This executor has neither `docker` nor `psql` and no
   software was installed. Static checks are not SQL parsing/runtime evidence.

## Provenance and findings

Input: Library `libfile_6fa632bfdddc81919cff8ee03342f8ed`, version 1,
`elogistix-aceptacion-interna-becc073-review.zip`, SHA256
`aa047cbf23dd13a86a4a6e8c206a1dcce504359970bc562a7520a2a29e366791`.
All 47 payload entries listed by its SHA256SUMS verified. Its proposal remains
reference-only and is not copied into the runnable package.

The original v1 suite inserts `es_prospecto=true` without `prospecto_empresa`;
the real `_cotizaciones_validar_prospecto` rejects that fixture before conversion.
The real `_crm_sync_oportunidad_desde_cotizacion` aligns an open opportunity's
currency on quote insert/update; a currency mismatch fixture must be established
after that sync. Both details are accounted for in the plan/tests here.

The repository's `convertir_prospecto_a_cliente_canonico.sql` and
`guard_cotizacion_vinculo_cliente.sql` include prose-only behavioral sections.
Do not count their notices as executed conversion, tenant or rollback coverage.
The new suite must supply and call the actual missing journeys.
