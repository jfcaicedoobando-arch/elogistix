#!/usr/bin/env bash
# Run ONLY inside the no-network disposable container created by run-ci.sh.
set -euo pipefail
umask 077
[[ $# == 0 && "${PRICING_RPC_ISOLATED_CONTAINER:-}" == 1 ]] || exit 64
PLAN=/bundle
NATIVE=/usr/lib/postgresql/17
PSQL="$NATIVE/bin/psql"
REPLAY="$PLAN/replay.sql"
ASSERTIONS="$PLAN/assertions.sql"
[[ -r "$PLAN/SHA256SUMS" && -x "$NATIVE/bin/initdb" && -x "$PSQL" ]] || exit 69
# No inherited database/service/password, preload, or cloud credential environment.
clean() { env -i PATH=/usr/bin:/bin HOME="$RUN" LANG=C LC_ALL=C "$@"; }
RUN=$(mktemp -d /tmp/pricing-rpc.XXXXXXXX)
TOKEN=$(basename -- "$RUN")
printf '%s\n' "$TOKEN" > "$RUN/.owned-by-this-replay"
EVIDENCE=/tmp/replay-evidence
mkdir "$EVIDENCE" "$RUN/socket"
PGDATA="$RUN/data"
cleanup() {
  code=$?
  trap - EXIT INT TERM
  disposed=false
  stopped=true
  if [[ -f "$PGDATA/postmaster.pid" ]]; then
    clean "$NATIVE/bin/pg_ctl" -D "$PGDATA" -m fast -w -t 30 stop >>"$RUN/server.log" 2>&1 || stopped=false
  fi
  for f in initdb.log server.log replay.log; do
    [[ ! -f "$RUN/$f" ]] || cp -- "$RUN/$f" "$EVIDENCE/$f"
  done
  if [[ "$stopped" == true && "$RUN" == /tmp/pricing-rpc.* && ! -L "$RUN" && -f "$RUN/.owned-by-this-replay" && "$(cat "$RUN/.owned-by-this-replay")" == "$TOKEN" ]]; then
    rm -rf --one-file-system -- "$RUN"
    disposed=true
  else
    code=70
  fi
  printf 'exit_code=%s\ncluster_disposed=%s\n' "$code" "$disposed" > "$EVIDENCE/status.txt"
  exit "$code"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
(cd "$PLAN" && sha256sum --strict --check SHA256SUMS) > "$EVIDENCE/hashes.log" 2>&1
clean "$PSQL" --version > "$EVIDENCE/postgres-version.txt"
grep -Eq 'PostgreSQL\) 17\.' "$EVIDENCE/postgres-version.txt"
clean "$NATIVE/bin/initdb" -D "$PGDATA" -U replay_bootstrap --no-locale -E UTF8 --auth-local=trust --auth-host=reject > "$RUN/initdb.log" 2>&1
# Private Unix socket, no TCP listener; container additionally has --network none.
clean "$NATIVE/bin/pg_ctl" -D "$PGDATA" -o "-c listen_addresses='' -c unix_socket_directories='$RUN/socket' -c unix_socket_permissions=0700" -l "$RUN/server.log" -w -t 30 start
cat > "$RUN/load.sql" <<SQL
\set ON_ERROR_STOP on
BEGIN;
\i '$PLAN/bootstrap-synthetic.sql'
\i '$PLAN/auth-uid.sql'
\i '$PLAN/auth-jwt.sql'
\i '$PLAN/auth-role.sql'
\i '$REPLAY'
-- Revoke in the same transaction that creates the candidate, even if the bundle
-- restores platform defaults granting EXECUTE on other public functions.
DO \$revoke\$
DECLARE f record;
BEGIN
 FOR f IN SELECT p.oid::regprocedure AS sig FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='public' AND p.proname IN ('crm_vincular_cotizacion_cliente_pricing','guard_cotizacion_origen_pricing')
 LOOP
  EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated, service_role',f.sig);
 END LOOP;
 IF NOT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='crm_vincular_cotizacion_cliente_pricing') THEN
  RAISE EXCEPTION 'Reviewed replay bundle did not create the candidate';
 END IF;
 FOR f IN SELECT p.oid FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='crm_vincular_cotizacion_cliente_pricing'
 LOOP
  IF has_function_privilege('anon',f.oid,'EXECUTE') OR has_function_privilege('authenticated',f.oid,'EXECUTE') OR has_function_privilege('service_role',f.oid,'EXECUTE') THEN
   RAISE EXCEPTION 'Candidate application EXECUTE must remain revoked';
  END IF;
 END LOOP;
END
\$revoke\$;
COMMIT;
\i '$ASSERTIONS'
DO \$final_acl\$
DECLARE f record;
BEGIN
 FOR f IN SELECT p.oid FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname='public' AND p.proname IN ('crm_vincular_cotizacion_cliente_pricing','guard_cotizacion_origen_pricing')
 LOOP
  IF has_function_privilege('anon',f.oid,'EXECUTE') OR has_function_privilege('authenticated',f.oid,'EXECUTE') OR has_function_privilege('service_role',f.oid,'EXECUTE') THEN
   RAISE EXCEPTION 'Assertions left candidate application EXECUTE enabled';
  END IF;
 END LOOP;
 IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname IN ('postgres','anon','authenticated','service_role','authenticator','supabase_admin','supabase_auth_admin','dashboard_user','sandbox_exec','supabase_privileged_role') AND rolcanlogin) THEN
  RAISE EXCEPTION 'A simulated role was left LOGIN-enabled';
 END IF;
END
\$final_acl\$;
SQL
clean "$PSQL" -X --no-password -h "$RUN/socket" -p 5432 -U replay_bootstrap -d postgres -v ON_ERROR_STOP=1 -f "$RUN/load.sql" > "$RUN/replay.log" 2>&1
