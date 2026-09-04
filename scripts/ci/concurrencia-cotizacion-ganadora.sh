#!/usr/bin/env bash
# =============================================================================
# concurrencia-cotizacion-ganadora.sh · v13.823.59
#
# Prueba de CONCURRENCIA REAL (dos sesiones) de la autoridad única
# cotización terminal → oportunidad ganada.
#
# Escenario: dos sesiones aceptan cotizaciones DISTINTAS de la MISMA
# oportunidad. Resultado obligatorio:
#   - exactamente una cotización queda en estado terminal (C1, la de la sesión A);
#   - la sesión B falla EXCLUSIVAMENTE con LC_COTIZACION_GANADORA_EXISTE
#     (la violación cruda del índice único parcial NO cuenta: ese invariante se
#     verifica por separado en supabase/tests/*);
#   - la oportunidad queda con UNA sola `cotizacion_ganadora_id`, UNA auditoría
#     de cierre y UNA notificación.
#
# No cabe en `supabase/tests/*.sql` (esas suites son una sola transacción
# BEGIN…ROLLBACK). Aquí el fixture se COMMITEA y se limpia siempre al final.
#
# Coordinación DETERMINISTA (sin `sleep` a ciegas y sin carrera): la sesión A
# hace su UPDATE y se queda dentro de la transacción esperando el SEMÁFORO
# `public.lc_conc_barrera` (fila 'go'), identificada por `application_name`.
# El script espera —con timeout acotado— a ver la transacción de A con su lock
# ya tomado; sólo entonces levanta el semáforo (A comitea) y arranca B.
# Antes A dormía un `pg_sleep` fijo de 5 s y en CI lento terminaba ANTES de que
# el sondeo la observara: la barrera fallaba con la sesión A ya en `A_OK`.

#
# SÓLO se ejecuta en GitHub Actions (workflow rls-tests.yml); nunca automático
# dentro de Lovable.
#
# Uso:
#   PGHOST=... PGUSER=... bash scripts/ci/concurrencia-cotizacion-ganadora.sh
#   (o SUPABASE_DB_URL=postgres://...)
# =============================================================================
set -euo pipefail

APP_A='lc_conc_ganadora_a'
ESPERA_MAX_S=60      # timeout de la barrera (CI lento: runners compartidos)
A_ESPERA_MAX_S=120   # techo de espera de A por el semáforo (evita cuelgue)

PSQL_BASE=(psql -v ON_ERROR_STOP=1 -X -q -t -A)
if [[ -n "${SUPABASE_DB_URL:-}" ]]; then
  PSQL_BASE+=("${SUPABASE_DB_URL}")
fi
psql_run() { "${PSQL_BASE[@]}" "$@"; }

# UUID de fixture: sólo dígitos hexadecimales, inequívocos (prefijo c0nc → c0c0).
ORG='c0c0c0c0-0000-4000-8000-00000000000a'
CLI='c0c0c0c0-0000-4000-8000-000000000201'
OP='c0c0c0c0-0000-4000-8000-000000000301'
C1='c0c0c0c0-0000-4000-8000-000000000401'
C2='c0c0c0c0-0000-4000-8000-000000000402'
VEND='c0c0c0c0-0000-4000-8000-000000000801'

log_a="$(mktemp)"; log_b="$(mktemp)"

limpiar() {
  local rc=$?
  psql_run >/dev/null 2>&1 <<SQL || true
DELETE FROM public.crm_notificaciones WHERE organization_id = '${ORG}';
DELETE FROM public.bitacora_actividad WHERE organization_id = '${ORG}';
UPDATE public.crm_oportunidades SET cotizacion_ganadora_id = NULL WHERE organization_id = '${ORG}';
DELETE FROM public.cotizaciones WHERE organization_id = '${ORG}';
DELETE FROM public.crm_oportunidades WHERE organization_id = '${ORG}';
DELETE FROM public.crm_etapas_pipeline WHERE organization_id = '${ORG}';
DELETE FROM public.clientes WHERE organization_id = '${ORG}';
DELETE FROM public.organization_members WHERE organization_id = '${ORG}';
DELETE FROM public.organizations WHERE id = '${ORG}';
DELETE FROM public.user_roles WHERE user_id = '${VEND}';
DELETE FROM auth.users WHERE id = '${VEND}';
DROP TABLE IF EXISTS public.lc_conc_barrera;
SQL
  rm -f "$log_a" "$log_b"
  return $rc
}
trap limpiar EXIT

limpiar >/dev/null 2>&1 || true
log_a="$(mktemp)"; log_b="$(mktemp)"

# ── Fixture committeado ──────────────────────────────────────────────────────
psql_run <<SQL
INSERT INTO public.organizations (id, nombre) VALUES ('${ORG}', 'TEST CONCURRENCIA GANADORA');
INSERT INTO public.crm_etapas_pipeline (organization_id, nombre, tipo, orden, probabilidad_default, sla_dias)
VALUES ('${ORG}', 'TEST Abierta', 'abierta', 91, 20, 7),
       ('${ORG}', 'TEST Ganada', 'ganada', 92, 100, 7)
ON CONFLICT DO NOTHING;
INSERT INTO public.clientes (id, organization_id, nombre, email)
VALUES ('${CLI}', '${ORG}', 'TEST Cliente Concurrencia', 'concurrencia@test.local');
INSERT INTO auth.users (id, email) VALUES ('${VEND}', 'concurrencia-vend@test.local')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.crm_oportunidades (id, organization_id, nombre, etapa_id, cliente_id, probabilidad, vendedor_id)
SELECT '${OP}', '${ORG}', 'Op concurrencia', e.id, '${CLI}', 20, '${VEND}'
  FROM public.crm_etapas_pipeline e
 WHERE e.organization_id = '${ORG}' AND e.tipo = 'abierta' AND e.deleted_at IS NULL
 ORDER BY e.orden LIMIT 1;
INSERT INTO public.cotizaciones (id, organization_id, folio, modo, tipo, cliente_id, oportunidad_id, estado, subtotal, version)
VALUES ('${C1}', '${ORG}', 'TEST-CONC-0001', 'Marítimo', 'Importación', '${CLI}', '${OP}', 'Enviada', 1000, 1),
       ('${C2}', '${ORG}', 'TEST-CONC-0002', 'Marítimo', 'Importación', '${CLI}', '${OP}', 'Enviada', 2000, 1);
SQL

# Semáforo de coordinación (se limpia en `limpiar`).
psql_run <<SQL
DROP TABLE IF EXISTS public.lc_conc_barrera;
CREATE UNLOGGED TABLE public.lc_conc_barrera (id text PRIMARY KEY);
SQL

# ── Sesión A: acepta C1 y retiene el lock hasta que se levante el semáforo ───
( psql_run > "$log_a" 2>&1 <<SQL
SET application_name = '${APP_A}';
BEGIN;
UPDATE public.cotizaciones SET estado = 'Aceptada' WHERE id = '${C1}';
DO \$\$
DECLARE t0 timestamptz := clock_timestamp();
BEGIN
  LOOP
    EXIT WHEN EXISTS (SELECT 1 FROM public.lc_conc_barrera WHERE id = 'go');
    IF clock_timestamp() - t0 > interval '${A_ESPERA_MAX_S} seconds' THEN
      RAISE EXCEPTION 'A_TIMEOUT_SEMAFORO';
    END IF;
    PERFORM pg_sleep(0.05);
  END LOOP;
END \$\$;
COMMIT;
SELECT 'A_OK';
SQL
) &
pid_a=$!

# ── Barrera determinista: A ya escribió y tiene su lock de transacción ───────
listo=0
for _ in $(seq 1 $((ESPERA_MAX_S * 10))); do
  estado=$(psql_run <<SQL
SELECT EXISTS (
  SELECT 1
    FROM pg_locks l
    JOIN pg_stat_activity a ON a.pid = l.pid
   WHERE a.application_name = '${APP_A}'
     AND a.xact_start IS NOT NULL
     AND l.locktype = 'transactionid'
     AND l.granted
)::text;
SQL
) || estado='error'
  if [[ "$estado" == "t" ]]; then listo=1; break; fi
  if ! kill -0 "$pid_a" 2>/dev/null; then break; fi
  sleep 0.1
done

if [[ $listo -ne 1 ]]; then
  echo "── sesión A ──"; cat "$log_a"
  echo "FALLO: la sesión A no alcanzó la barrera (UPDATE + lock) en ${ESPERA_MAX_S}s" >&2
  exit 1
fi

# A está dentro de la transacción con el lock tomado: se levanta el semáforo
# para que comitee mientras B queda encolada en ese mismo lock.
psql_run <<SQL
INSERT INTO public.lc_conc_barrera (id) VALUES ('go') ON CONFLICT DO NOTHING;
SQL


# ── Sesión B: intenta aceptar C2 de la misma oportunidad ─────────────────────
# Se bloquea en el lock de A y, al liberarse, debe fallar por ganadora existente.
rc_b=0
set +e
psql_run > "$log_b" 2>&1 <<SQL
BEGIN;
UPDATE public.cotizaciones SET estado = 'Aceptada' WHERE id = '${C2}';
COMMIT;
SQL
rc_b=$?
set -e

# `wait` con set -e no debe ocultar la causa: se captura el rc de A.
rc_a=0
wait "$pid_a" || rc_a=$?

echo "── sesión A (rc=${rc_a}) ──"; cat "$log_a"
echo "── sesión B (rc=${rc_b}) ──"; cat "$log_b"

if [[ $rc_a -ne 0 ]]; then
  echo "FALLO: la sesión A (aceptación legítima) terminó con rc=${rc_a}" >&2
  exit 1
fi
if [[ $rc_b -eq 0 ]]; then
  echo "FALLO: la sesión B aceptó una segunda cotización de la misma oportunidad" >&2
  exit 1
fi
if ! grep -q 'LC_COTIZACION_GANADORA_EXISTE' "$log_b"; then
  echo "FALLO: la sesión B debía fallar con LC_COTIZACION_GANADORA_EXISTE" >&2
  exit 1
fi

# ── Invariantes finales ──────────────────────────────────────────────────────
resultado=$(psql_run <<SQL
SELECT (SELECT count(*) FROM public.cotizaciones
         WHERE oportunidad_id = '${OP}' AND deleted_at IS NULL
           AND estado IN ('Aceptada','En operación'))::text
    || '|' || (SELECT COALESCE(cotizacion_ganadora_id::text,'-') FROM public.crm_oportunidades WHERE id = '${OP}')
    || '|' || (SELECT count(*) FROM public.bitacora_actividad
                WHERE entidad_id = '${OP}' AND accion = 'oportunidad_ganada_auto')::text
    || '|' || (SELECT count(*) FROM public.crm_notificaciones
                WHERE organization_id = '${ORG}' AND tipo = 'oportunidad_ganada')::text;
SQL
)
echo "invariantes(terminales|ganadora|auditorias|notificaciones) = ${resultado}"

IFS='|' read -r terminales ganadora auditorias notifs <<<"$resultado"
[[ "$terminales" == "1" ]] || { echo "FALLO: hay ${terminales} cotizaciones terminales" >&2; exit 1; }
[[ "$ganadora" == "$C1" ]] || { echo "FALLO: ganadora inesperada ${ganadora}" >&2; exit 1; }
[[ "$auditorias" == "1" ]] || { echo "FALLO: ${auditorias} auditorías de cierre" >&2; exit 1; }
[[ "$notifs" == "1" ]] || { echo "FALLO: ${notifs} notificaciones de oportunidad ganada" >&2; exit 1; }

echo "concurrencia-cotizacion-ganadora OK"
