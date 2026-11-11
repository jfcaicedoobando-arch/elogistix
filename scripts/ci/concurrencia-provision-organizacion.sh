#!/usr/bin/env bash
# Ejecutar sólo dentro de la base efímera de db:verify.
set -euo pipefail
[[ "${ISOLATED_QA_DB:-}" == 1 && "${PGHOST:-}" == 127.0.0.1 ]] || {
  echo 'Se requiere una base efímera en loopback.' >&2
  exit 1
}
unset PGHOSTADDR PGSERVICE PGSERVICEFILE PGOPTIONS

psql_run() { psql -v ON_ERROR_STOP=1 -X -q -t -A "$@"; }
read -r caller owner < <(psql_run -F ' ' -c 'SELECT gen_random_uuid(), gen_random_uuid();')
logs=$(mktemp -d)
cleanup() {
  psql_run -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity
    WHERE application_name IN ('qa_provision_a', 'qa_provision_b');
    DROP TABLE IF EXISTS public.qa_provision_barrera;" >/dev/null 2>&1 || true
}
trap cleanup EXIT

psql_run <<SQL
CREATE TABLE public.qa_provision_barrera (listo boolean);
INSERT INTO auth.users (id, email) VALUES
  ('$caller', '$caller@example.invalid'), ('$owner', '$owner@example.invalid');
INSERT INTO public.user_roles (user_id, role) VALUES ('$caller', 'super_admin')
  ON CONFLICT (user_id) DO UPDATE SET role = EXCLUDED.role;
SQL

claims="SELECT set_config('request.jwt.claims', '{\"sub\":\"$caller\",\"role\":\"authenticated\"}', true);
SET LOCAL ROLE authenticated;"

(
  psql_run >"$logs/a.log" 2>&1 <<SQL
SET application_name = 'qa_provision_a';
BEGIN;
$claims
SELECT public.provision_organization('QA provision A $owner', NULL, '$owner');
RESET ROLE;
DO \$barrier\$
DECLARE limite timestamptz := clock_timestamp() + interval '30 seconds';
BEGIN
  LOOP
    EXIT WHEN EXISTS (SELECT 1 FROM public.qa_provision_barrera WHERE listo);
    IF clock_timestamp() > limite THEN RAISE EXCEPTION 'No llegó la segunda sesión'; END IF;
    PERFORM pg_sleep(0.05);
  END LOOP;
END \$barrier\$;
COMMIT;
SQL
) &
pid_a=$!

esperar_sesion() {
  local consulta="$1"
  for _ in $(seq 1 200); do
    [[ "$(psql_run -c "$consulta")" == t ]] && return 0
    sleep 0.1
  done
  cat "$logs"/*.log >&2
  echo 'No se observó el bloqueo entre sesiones.' >&2
  return 1
}
esperar_sesion "SELECT EXISTS (SELECT 1 FROM pg_stat_activity
  WHERE application_name = 'qa_provision_a' AND wait_event = 'PgSleep');"
(
  psql_run >"$logs/b.log" 2>&1 <<SQL
SET application_name = 'qa_provision_b';
BEGIN;
SET LOCAL statement_timeout = '30s';
$claims
SELECT public.provision_organization('QA provision B $owner', NULL, '$owner');
COMMIT;
SQL
) &
pid_b=$!

esperar_sesion "SELECT EXISTS (SELECT 1 FROM pg_stat_activity b
  JOIN pg_stat_activity a ON a.pid = ANY(pg_blocking_pids(b.pid))
  WHERE b.application_name = 'qa_provision_b' AND a.application_name = 'qa_provision_a');"
psql_run -c 'INSERT INTO public.qa_provision_barrera VALUES (true);'
wait "$pid_a" || { cat "$logs/a.log" >&2; exit 1; }
if wait "$pid_b" || ! grep -q LC_OWNER_YA_ASIGNADO "$logs/b.log"; then
  cat "$logs/b.log" >&2
  exit 1
fi

resultado=$(psql_run <<SQL
SELECT
  (SELECT count(*) FROM public.organizations WHERE nombre IN ('QA provision A $owner', 'QA provision B $owner')),
  (SELECT count(*) FROM public.organization_members m
    JOIN public.organizations o ON o.id = m.organization_id
    WHERE m.user_id = '$owner' AND m.role = 'admin_org' AND o.nombre = 'QA provision A $owner'),
  (SELECT count(*) FROM public.bitacora_actividad b
    JOIN public.organizations o ON o.id = b.entidad_id
    WHERE b.accion = 'provision_organization' AND o.nombre = 'QA provision A $owner');
SQL
)
[[ "$resultado" == '1|1|1' ]] || { echo "Organizaciones | membresías | bitácoras: $resultado" >&2; exit 1; }
echo 'PASS: dos sesiones dejan una sola organización, con su administrador y su bitácora.'
