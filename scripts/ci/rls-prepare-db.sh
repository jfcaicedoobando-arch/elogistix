#!/usr/bin/env bash
# Prepara la BD efímera de CI para las suites RLS:
#   1) bootstrap de stubs (auth/storage/cron/net/pgmq)
#   2) baseline squash (fuente única hasta el corte)
#   3) replay ORDENADO de todas las migraciones NO incluidas en el squash
#
# Extraído del YAML para no repetir el `sed` de stubbing de extensiones tres
# veces. No cambia el SQL: mismos archivos, mismo orden, mismos
# --single-transaction y ON_ERROR_STOP.
#
# Requiere las variables PG* del entorno (PGHOST/PGUSER/…).
set -euo pipefail

PSQL=(psql -v ON_ERROR_STOP=1 -X -q)
CUTOFF_ENV="supabase/schema/squash/cutoff.env"

AUD54_FORWARD="20261009005400_audit54_cierre_cxc_saldo_real.sql"
audit54_runtime_checked=0

# The mandatory Actions SQL job tests AUD54 against the actual pre-forward
# replay state. Clone a schema-only checkpoint once, never replay history twice.
# The harness owns and removes its clone and transient QA role; caller DB stays
# untouched until the normal ordered migration replay resumes below.
audit54_checkpoint_runtime() {
  if [[ "${ISOLATED_QA_DB:-}" != 1 || "${PGDATABASE:-}" != postgres || "${PGUSER:-}" != postgres ]]; then
    echo "::error::AUD54 runtime requires the isolated Actions postgres service" >&2
    return 1
  fi
  local checkpoint before after status=0
  checkpoint="$(mktemp)"
  before="$("${PSQL[@]}" -A -t -c "SELECT md5(to_jsonb(p)::text) FROM pg_proc p WHERE p.oid='public.validar_cierre_embarque(uuid)'::regprocedure;")"
  if pg_dump --schema-only --file="$checkpoint"; then
    PGDATABASE=audit54_cxc_contract AUD54_CXC_CHECKPOINT="$checkpoint" \
      bash scripts/ci/audit54-cxc-forward-runtime.sh || status=$?
  else
    status=1
  fi
  rm -f -- "$checkpoint"
  [[ "$status" == 0 ]] || return "$status"
  after="$("${PSQL[@]}" -A -t -c "SELECT md5(to_jsonb(p)::text) FROM pg_proc p WHERE p.oid='public.validar_cierre_embarque(uuid)'::regprocedure;")"
  if [[ "$before" != "$after" ]]; then
    echo "::error::AUD54 runtime changed the source checkpoint function" >&2
    return 1
  fi
}

# Stubbea CREATE EXTENSION de extensiones no disponibles en la imagen de CI.
stub_extensiones() {
  sed -E \
    -e 's/^[[:space:]]+CREATE EXTENSION[[:space:]]+(IF NOT EXISTS[[:space:]]+)?(pg_cron|pg_net|pgmq|supabase_vault)[^;]*;/    PERFORM 1; -- [ci] stubbed \2/I' \
    -e 's/^CREATE EXTENSION[[:space:]]+(IF NOT EXISTS[[:space:]]+)?(pg_cron|pg_net|pgmq|supabase_vault)[^;]*;/SELECT 1; -- [ci] stubbed \2/I' \
    "$1"
}

# Falla claro si un archivo requerido falta, no es legible o quedó vacío.
requerir_archivo() {
  if [ ! -r "$1" ] || [ ! -s "$1" ]; then
    echo "::error::$1 no existe, no es legible o está vacío ($2)"
    exit 1
  fi
}

# This preparer destroys/rebuilds an isolated test schema; never use a remote
# connection or a populated database, including a production tunnel on loopback.
if [[ "${PGHOST:-}" != localhost && "${PGHOST:-}" != 127.0.0.1 ]] \
   || [[ -n "${SUPABASE_DB_URL:-}" || -n "${DATABASE_URL:-}" || -n "${PGHOSTADDR:-}" || -n "${PGSERVICE:-}" || -n "${PGSERVICEFILE:-}" ]]; then
  echo "Refusing schema replay: an isolated loopback database is required" >&2
  exit 1
fi
if ! existing_relations="$(psql -v ON_ERROR_STOP=1 -X -A -t -c \
  "SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind IN ('r','p','v','m','f','S')")" \
  || [[ "$existing_relations" != 0 ]]; then
  echo "Refusing schema replay: target public schema must be empty" >&2
  exit 1
fi

echo "▶ Bootstrap (stubs auth/storage/cron/net/pgmq)"
"${PSQL[@]}" -f supabase/tests/rls/_ci_bootstrap.sql

requerir_archivo "$CUTOFF_ENV" "corte del squash"
# Archivo del repo con asignaciones conocidas: SQUASH_FILE y SQUASH_INCLUDED.
set -a
# shellcheck source=supabase/schema/squash/cutoff.env disable=SC1091
. "$CUTOFF_ENV"
set +a

requerir_archivo "${SQUASH_FILE:-}" "baseline squash"
requerir_archivo "${SQUASH_INCLUDED:-}" "inventario incluido en el squash"

echo "▶ Baseline squash: $SQUASH_FILE"
stub_extensiones "$SQUASH_FILE" | "${PSQL[@]}" --single-transaction

# Opt-in snapshot for selector installer negatives. The exact hash is reviewed;
# capture before its atomic migration, while no psql connection owns postgres.
selector148_installer=""
if [[ "${SELECTOR148_ISOLATED_CI:-}" == 1 ]]; then
  selector148_installer="$(node scripts/ci/selector148/control.cjs locate)"
fi

echo "▶ Replay de migraciones posteriores al squash"
shopt -s nullglob
aplicadas=0
omitidas_datos=0
# Migraciones de DATOS de un registro concreto (limpiezas puntuales de
# producción). No aportan esquema y en una BD recién creada el registro no
# existe, así que su RPC aborta y tumbaba el replay. Los archivos de
# supabase/migrations/ son inmutables: la lista es el único lugar donde se
# declaran. Sólo se agregan migraciones SIN DDL.
DATA_ONLY="supabase/schema/squash/data-only.txt"
for f in $(printf '%s\n' supabase/migrations/*.sql | LC_ALL=C sort); do
  base="$(basename "$f")"
  # El corte por timestamp no basta: hay migraciones creadas DESPUÉS del squash
  # con timestamp anterior al corte. La fuente de verdad es el inventario de
  # archivos incluidos en el squash.
  grep -qxF "$base" "$SQUASH_INCLUDED" && continue

  if [ -r "$DATA_ONLY" ] && grep -qxF "$base" "$DATA_ONLY"; then
    echo "⏭ $base (migración de datos puntual, sin DDL)"
    omitidas_datos=$((omitidas_datos + 1))
    continue
  fi


  # AUD54 controls are opt-in in the disposable Actions service.
  if [[ "${AUD54_CI:-}" == 1 && "$base" == "$AUD54_FORWARD" ]]; then
    [[ "$audit54_runtime_checked" == 0 ]] || { echo "::error::AUD54 runtime checkpoint repeated"; exit 1; }
    echo "AUD54 mandatory catalog/transaction runtime on pre-forward checkpoint"
    audit54_checkpoint_runtime
    audit54_runtime_checked=1
  fi

  # Focused financial-envelope controls supplied by the financial49 package.
  if [[ "${FINANCIAL49_CI:-}" == 1 ]] && [[ "$base" == 20261009010000_audit148_cobertura_documental_exacta.sql || "$base" == 20261009010100_audit148_papelera_seguros.sql ]]; then
    node scripts/ci/financial49/test-envelope.mjs "$f"
  fi

  if [[ -n "$selector148_installer" && "$f" == "$selector148_installer" ]]; then
    node scripts/ci/selector148/control.cjs capture
  fi

  # Narrow real-schema installer controls run before the exact container forward.
  if [[ "${PRICING_CONTAINER_CI:-}" == 1 && "$base" == 20261009014000_pricing_container_rpc_guard.sql ]]; then
    node scripts/ci/pricing-container/test-envelope.mjs "$f"
  fi

  # Leads installer controls are opt-in only in the disposable Actions service.
  if [[ "${LEADS_SCOPE_CI:-}" == 1 && "$base" == 20261009031000_crm_leads_duplicados_scope.sql ]]; then
    node scripts/ci/leads-scope/test-envelope.mjs "$f"
  fi

  echo "▶ $base"
  if stub_extensiones "$f" | "${PSQL[@]}" --single-transaction; then
    aplicadas=$((aplicadas + 1))
    continue
  fi
  echo "::error file=$f::la migración no aplica sobre el baseline squash"
  exit 1
done

if [[ "${AUD54_CI:-}" == 1 && "$audit54_runtime_checked" != 1 ]]; then
  echo "::error::AUD54 runtime checkpoint was not executed before its forward"
  exit 1
fi

echo "✓ BD preparada · $aplicadas migraciones aplicadas · $omitidas_datos de datos omitidas"
