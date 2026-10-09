#!/usr/bin/env bash
# Catalog/transaction contract on the pre-forward checkpoint cloned by CI.
# Never calls the financial closure body or runs full application/SQL suites.
set -euo pipefail

if [[ "${GITHUB_ACTIONS:-}" != true || "${ISOLATED_QA_DB:-}" != 1 \
  || ( "${PGHOST:-}" != localhost && "${PGHOST:-}" != 127.0.0.1 ) \
  || "${PGDATABASE:-}" != audit54_cxc_contract || "${PGUSER:-}" != postgres \
  || -n "${SUPABASE_DB_URL:-}" || -n "${DATABASE_URL:-}" || -n "${PGHOSTADDR:-}" \
  || -n "${PGSERVICE:-}" || -n "${PGSERVICEFILE:-}" ]]; then
  echo 'Refusing: requires the dedicated loopback checkpoint clone in GitHub Actions.' >&2
  exit 1
fi

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"
FORWARD="supabase/migrations/20261009005400_audit54_cierre_cxc_saldo_real.sql"
PREVIOUS="supabase/migrations/20261007001300_audit139_cierre_saldo_atribuido.sql"
LOG_DIR="${LOG_DIR:-/tmp/audit54-cxc-forward-runtime}"
mkdir -p "$LOG_DIR"
[[ -r "${AUD54_CXC_CHECKPOINT:-}" && -s "${AUD54_CXC_CHECKPOINT:-}" ]] || {
  echo 'Refusing: requires the schema-only checkpoint captured immediately before AUD54.' >&2
  exit 1
}
FIXTURES="$(mktemp -d)"
PSQL=(psql -v ON_ERROR_STOP=1 -v VERBOSITY=verbose -X -q -A -t)
CASES=0
CLONE_CREATED=0
ROLE_CREATED=0

psql_run() { "${PSQL[@]}" "$@"; }
public_schema_metadata() {
  psql_run "$@" -c "SELECT jsonb_build_object(
    'owner', pg_get_userbyid(n.nspowner),
    'acl', (SELECT jsonb_agg(a.acl::text ORDER BY a.acl::text)
      FROM unnest(COALESCE(n.nspacl, acldefault('n', n.nspowner))) AS a(acl))
  )::text FROM pg_namespace n WHERE n.nspname='public';"
}
fail() { echo "FAILED: $*" >&2; exit 1; }
pass() { CASES=$((CASES + 1)); echo "PASS: $1"; }
catalog_hash() {
  psql_run -c "SELECT md5((to_jsonb(p) - CASE WHEN '$1'='metadata' THEN 'prosrc' ELSE '' END)::text)
    FROM pg_proc p WHERE p.oid='public.validar_cierre_embarque(uuid)'::regprocedure;"
}
assert_catalog() {
  [[ "$(catalog_hash "$3")" == "$2" ]] || fail "$1 changed catalog beyond its transaction"
}
membership_hash() {
  psql_run -c "SELECT md5(COALESCE(jsonb_agg(to_jsonb(m) ORDER BY m.roleid,m.member,m.grantor)::text,'[]')) FROM pg_auth_members m;"
}
assert_memberships() {
  [[ "$(membership_hash)" == "$2" ]] || fail "$1 changed cluster role memberships"
}
cleanup() {
  local status=$?
  trap - EXIT
  if [[ "$CLONE_CREATED" == 1 ]]; then
    dropdb --maintenance-db=postgres --if-exists audit54_cxc_contract > "$LOG_DIR/cleanup.log" 2>&1 || status=1
  fi
  if [[ "$ROLE_CREATED" == 1 ]]; then
    "${PSQL[@]}" -d postgres -c 'DROP ROLE audit54_cxc_unexpected;' >> "$LOG_DIR/cleanup.log" 2>&1 || status=1
  fi
  rm -rf -- "$FIXTURES"
  exit "$status"
}
trap cleanup EXIT

available="$(psql_run -d postgres -c "SELECT current_database()='postgres' AND current_user='postgres'
  AND NOT EXISTS(SELECT 1 FROM pg_database WHERE datname='audit54_cxc_contract')
  AND NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='audit54_cxc_unexpected');")"
[[ "$available" == t ]] || fail 'checkpoint clone or QA role already exists; refusing to overwrite'
source_public_metadata="$(public_schema_metadata -d postgres)"
[[ -n "$source_public_metadata" ]] || fail 'source checkpoint requires an existing public schema'
printf '%s\n' "$source_public_metadata" > "$LOG_DIR/source-public-metadata.json"
createdb --maintenance-db=postgres audit54_cxc_contract > "$LOG_DIR/create-clone.log" 2>&1
CLONE_CREATED=1

empty="$(psql_run -c "SELECT current_database()='audit54_cxc_contract' AND current_user='postgres'
  AND EXISTS(SELECT 1 FROM pg_namespace WHERE nspname='public')
  AND NOT EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public')
  AND NOT EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public');")"
[[ "$empty" == t ]] || fail 'runtime contract requires a fresh empty public schema'
# pg_dump treats public as a preexisting namespace and restores its owner/ACL
# rather than CREATE SCHEMA. Keep only this newly created clone's proven-empty
# default namespace; verify the restored owner/ACL against the source below.
python3 scripts/ci/audit54-cxc-runtime-fixtures.py "$ROOT" "$FIXTURES"

# Restore the actual pre-forward schema once; never rerun its migration history.
# Cluster roles are those already bootstrapped by the mandatory SQL job.
psql_run --single-transaction -f "$AUD54_CXC_CHECKPOINT" > "$LOG_DIR/restore-checkpoint.log" 2>&1
restored_public_metadata="$(public_schema_metadata)"
printf '%s\n' "$restored_public_metadata" > "$LOG_DIR/restored-public-metadata.json"
[[ "$restored_public_metadata" == "$source_public_metadata" ]] \
  || fail 'checkpoint restore changed the public schema owner or ACL'
psql_run -c 'CREATE ROLE audit54_cxc_unexpected NOLOGIN;' > "$LOG_DIR/bootstrap.log" 2>&1
ROLE_CREATED=1
psql_run >> "$LOG_DIR/bootstrap.log" 2>&1 <<'SQL'
CREATE TABLE public.audit54_runtime_caller_probe(id integer PRIMARY KEY);
SQL

seed() {
  psql_run -c 'TRUNCATE public.audit54_runtime_caller_probe;' \
    > "$LOG_DIR/seed.log" 2>&1
  psql_run -f "$PREVIOUS" >> "$LOG_DIR/seed.log" 2>&1
}

expect_rejection() {
  local name="$1" expected="$2" file="${3:-$FORWARD}" before
  before="$(catalog_hash full)"
  if psql_run > "$LOG_DIR/$name.log" 2>&1 <<SQL
BEGIN;
\i $file
COMMIT;
SQL
  then
    fail "$name unexpectedly accepted the forward"
  fi
  grep -q "$expected" "$LOG_DIR/$name.log" || { cat "$LOG_DIR/$name.log"; fail "$name failed for the wrong reason"; }
  assert_catalog "$name" "$before" full
  pass "$name rejects before changes or rolls back completely"
}
expect_fault_rejection() {
  local name="$1" expected="$2" statement="$3" before
  before="$(catalog_hash full)"
  psql_run > "$LOG_DIR/$name.log" 2>&1 <<SQL
BEGIN;
$statement
CREATE TEMP TABLE audit54_runtime_fault_snapshot ON COMMIT DROP AS
  SELECT md5(to_jsonb(p)::text) AS fingerprint FROM pg_proc p
  WHERE p.oid='public.validar_cierre_embarque(uuid)'::regprocedure;
\set ON_ERROR_STOP off
\i $FORWARD
\set ON_ERROR_STOP on
ROLLBACK TO SAVEPOINT audit54_cxc_forward;
DO \$runtime_fault\$
BEGIN
  IF (SELECT md5(to_jsonb(p)::text) FROM pg_proc p
      WHERE p.oid='public.validar_cierre_embarque(uuid)'::regprocedure)
      IS DISTINCT FROM (SELECT fingerprint FROM audit54_runtime_fault_snapshot)
      OR to_regclass('pg_temp.audit54_cxc_metadata') IS NOT NULL THEN
    RAISE EXCEPTION 'AUD54_RUNTIME_ASSERT: rejected forward changed the faulted catalog';
  END IF;
END
\$runtime_fault\$;
ROLLBACK;
SQL
  grep -q "$expected" "$LOG_DIR/$name.log" || { cat "$LOG_DIR/$name.log"; fail "$name failed for the wrong reason"; }
  assert_catalog "$name" "$before" full
  pass "$name rejects without changing the faulted catalog and rolls back its fixture"
}

# Validate the unmodified checkpoint first, before any synthetic fixture reset.
before="$(catalog_hash metadata)"
psql_run > "$LOG_DIR/approved-catalog.log" 2>&1 <<SQL
BEGIN;
\i $FORWARD
\i $FIXTURES/assert-after.sql
COMMIT;
SQL
assert_catalog approved-catalog "$before" metadata
pass 'approved catalog applies the exact mirror body with unchanged owner/attributes/ACL'

seed
before="$(catalog_hash full)"
psql_run > "$LOG_DIR/caller-rollback.log" 2>&1 <<SQL
BEGIN;
INSERT INTO public.audit54_runtime_caller_probe VALUES(1);
\i $FORWARD
\i $FIXTURES/assert-after.sql
INSERT INTO public.audit54_runtime_caller_probe VALUES(2);
ROLLBACK;
SQL
assert_catalog caller-rollback "$before" full
[[ "$(psql_run -c 'SELECT count(*) FROM public.audit54_runtime_caller_probe;')" == 0 ]] || fail 'forward committed caller writes'
pass 'caller rollback restores the original function and its surrounding writes'

seed
before="$(catalog_hash full)"
if psql_run -f "$FORWARD" > "$LOG_DIR/autocommit.log" 2>&1; then
  fail 'autocommit unexpectedly accepted the forward'
fi
grep -q '25P01' "$LOG_DIR/autocommit.log" || { cat "$LOG_DIR/autocommit.log"; fail 'autocommit did not reject at SAVEPOINT'; }
grep -q 'SAVEPOINT' "$LOG_DIR/autocommit.log" || fail 'autocommit rejection was unrelated to transaction ownership'
assert_catalog autocommit "$before" full
pass 'autocommit rejects at the first SAVEPOINT before any mutation'

while IFS='|' read -r name statement; do
  seed
  expect_fault_rejection "$name" 'AUD54_CXC_PRECATALOG' "$statement"
done <<'CATALOG'
unexpected-owner|ALTER FUNCTION public.validar_cierre_embarque(uuid) OWNER TO audit54_cxc_unexpected;
unexpected-security|ALTER FUNCTION public.validar_cierre_embarque(uuid) SECURITY INVOKER;
unexpected-volatility|ALTER FUNCTION public.validar_cierre_embarque(uuid) STABLE;
unexpected-strict|ALTER FUNCTION public.validar_cierre_embarque(uuid) STRICT;
unexpected-leakproof|ALTER FUNCTION public.validar_cierre_embarque(uuid) LEAKPROOF;
unexpected-parallel|ALTER FUNCTION public.validar_cierre_embarque(uuid) PARALLEL SAFE;
unexpected-cost|ALTER FUNCTION public.validar_cierre_embarque(uuid) COST 101;
unexpected-config|ALTER FUNCTION public.validar_cierre_embarque(uuid) SET search_path=public,pg_catalog;
CATALOG
seed
expect_fault_rejection unexpected-default 'AUD54_CXC_PRECATALOG' "\\i $FIXTURES/default-drift.sql"

# The grantor case injects only proacl on this one function OID in the protected
# disposable DB. It keeps the same three grantees/EXECUTE/no-WGO, so the guard
# must reject the unexpected grantor independently of missing/extra privileges.
while IFS='|' read -r name statement; do
  seed
  expect_fault_rejection "$name" 'AUD54_CXC_PREACL' "$statement"
done <<'ACL'
missing-authenticated|REVOKE EXECUTE ON FUNCTION public.validar_cierre_embarque(uuid) FROM authenticated;
missing-service-role|REVOKE EXECUTE ON FUNCTION public.validar_cierre_embarque(uuid) FROM service_role;
missing-owner-grant|REVOKE EXECUTE ON FUNCTION public.validar_cierre_embarque(uuid) FROM postgres;
extra-anonymous|GRANT EXECUTE ON FUNCTION public.validar_cierre_embarque(uuid) TO anon;
extra-public|GRANT EXECUTE ON FUNCTION public.validar_cierre_embarque(uuid) TO PUBLIC;
extra-role|GRANT EXECUTE ON FUNCTION public.validar_cierre_embarque(uuid) TO audit54_cxc_unexpected;
unexpected-grant-option|GRANT EXECUTE ON FUNCTION public.validar_cierre_embarque(uuid) TO authenticated WITH GRANT OPTION;
unexpected-grantor|UPDATE pg_catalog.pg_proc SET proacl=ARRAY['postgres=X/postgres','authenticated=X/postgres','service_role=X/authenticated']::aclitem[] WHERE oid='public.validar_cierre_embarque(uuid)'::regprocedure;
ACL

seed
expect_fault_rejection unexpected-source 'AUD54_CXC_PREIMAGE' "\\i $FIXTURES/body-drift.sql"

# Role inheritance can expose EXECUTE while the function's direct ACL is exact.
# Membership is cluster-wide, so keep this fault entirely in BEGIN/ROLLBACK.
seed
before="$(catalog_hash full)"
members_before="$(membership_hash)"
psql_run > "$LOG_DIR/inherited-anonymous-execute.log" 2>&1 <<SQL
BEGIN;
GRANT authenticated TO anon;
DO \$runtime_inherited\$
BEGIN
  IF NOT has_function_privilege('anon','public.validar_cierre_embarque(uuid)','EXECUTE')
     OR (SELECT md5(to_jsonb(p)::text) FROM pg_proc p
         WHERE p.oid='public.validar_cierre_embarque(uuid)'::regprocedure) IS DISTINCT FROM '$before' THEN
    RAISE EXCEPTION 'AUD54_RUNTIME_ASSERT: inheritance fixture must change effective privilege only';
  END IF;
END
\$runtime_inherited\$;
\set ON_ERROR_STOP off
\i $FORWARD
\set ON_ERROR_STOP on
ROLLBACK TO SAVEPOINT audit54_cxc_forward;
\i $FIXTURES/assert-before.sql
ROLLBACK;
SQL
grep -q 'AUD54_CXC_PREEFFECTIVE' "$LOG_DIR/inherited-anonymous-execute.log" || fail 'inherited EXECUTE did not reject at the effective-privilege preguard'
assert_catalog inherited-anonymous-execute "$before" full
assert_memberships inherited-anonymous-execute "$members_before"
pass 'inherited anonymous EXECUTE rejects with unchanged proacl and rolls back cluster membership'

for fault in late-cost late-acl late-body late-inheritance; do
  seed
  members_before="$(membership_hash)"
  expect_rejection "$fault" 'AUD54_CXC_METADATA' "$FIXTURES/$fault.sql"
  assert_memberships "$fault" "$members_before"
done

# Prove SAVEPOINT recovery preserves caller work when the late guard aborts.
# ON_ERROR_STOP is disabled only across the intentionally failing test copy;
# every assertion and subsequent caller statement remains fail-closed.
seed
before="$(catalog_hash full)"
psql_run > "$LOG_DIR/caller-savepoint-recovery.log" 2>&1 <<SQL
BEGIN;
INSERT INTO public.audit54_runtime_caller_probe VALUES(1);
\set ON_ERROR_STOP off
\i $FIXTURES/late-cost.sql
\set ON_ERROR_STOP on
ROLLBACK TO SAVEPOINT audit54_cxc_forward;
\i $FIXTURES/assert-before.sql
INSERT INTO public.audit54_runtime_caller_probe VALUES(2);
COMMIT;
SQL
grep -q 'AUD54_CXC_METADATA' "$LOG_DIR/caller-savepoint-recovery.log" || fail 'late recovery did not reach the postcondition'
assert_catalog caller-savepoint-recovery "$before" full
[[ "$(psql_run -c 'SELECT count(*) FROM public.audit54_runtime_caller_probe;')" == 2 ]] || fail 'savepoint recovery discarded caller work'
pass 'late postcondition rollback restores the function while caller retains and commits its own work'

[[ "$CASES" == 27 ]] || fail "expected 27 focused cases, got $CASES"
echo "AUD54 CxC forward runtime: $CASES focused catalog/transaction cases passed."
