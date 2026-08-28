#!/usr/bin/env bash
# db:verify — levanta un Postgres local (Docker), aplica TODAS las migraciones
# y corre una suite SQL/RLS mínima de verificación. Sirve para detectar fallos
# antes de pushear, sin esperar el workflow `rls-tests` de GitHub Actions.
#
# Uso:
#   bun run db:verify                       # base limpia + migraciones + suite mínima
#   bun run db:verify -- --suites isolation,financiero
#   bun run db:verify -- --all              # TODAS las suites test_rls_*.sql
#   bun run db:verify -- --reuse            # no recrea el contenedor (rápido)
#   bun run db:verify -- --keep             # deja el contenedor arriba al terminar
#   bun run db:verify -- --port 55433       # otro puerto local
#   bun run db:verify -- --no-behavioral    # omite supabase/tests/*.sql
#   bun run db:verify -- --only-schema      # sólo migraciones + guardias (sin suites)
#   bun run db:verify -- --snapshot supabase/schema/baseline.sql
#
# Requisitos: docker + psql (+ pg_dump para --snapshot) en PATH.
# Salida: logs en .db-verify-logs/<timestamp>/ y resumen al final.


set -uo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

# Misma imagen pinneada que .github/workflows/rls-tests.yml (postgres 17.6).
PG_IMAGE="postgres@sha256:b86568d3e0fe1dfaeff52714f9da36f206a30e4c49131b82bf96982d78627409"
CONTAINER="elogistix-verify-db"

PORT=55432
REUSE=0
KEEP=0
RUN_ALL=0
RUN_BEHAVIORAL=1
ONLY_SCHEMA=0
SNAPSHOT_OUT=""
SUITES_ARG=""


# Suite mínima: cubre aislamiento multi-tenant, dinero, roles y anon.
SUITES_MIN=(isolation financiero cross_tenant_mutations roles_no_admin anon_deny_all policy_linter)

while [ $# -gt 0 ]; do
  case "$1" in
    --suites)         SUITES_ARG="${2:-}"; shift ;;
    --suites=*)       SUITES_ARG="${1#--suites=}" ;;
    --all)            RUN_ALL=1 ;;
    --reuse)          REUSE=1 ;;
    --keep)           KEEP=1 ;;
    --no-behavioral)  RUN_BEHAVIORAL=0 ;;
    --only-schema)    ONLY_SCHEMA=1; RUN_BEHAVIORAL=0 ;;
    --snapshot)       SNAPSHOT_OUT="${2:-}"; shift ;;
    --snapshot=*)     SNAPSHOT_OUT="${1#--snapshot=}" ;;

    --port)           PORT="${2:-}"; shift ;;
    --port=*)         PORT="${1#--port=}" ;;
    -h|--help)        sed -n '2,20p' "$0"; exit 0 ;;
    *) echo "⚠️  flag desconocido: $1" >&2; exit 2 ;;
  esac
  shift
done

for bin in docker psql; do
  command -v "$bin" >/dev/null 2>&1 || { echo "❌ '$bin' no está en PATH." >&2; exit 127; }
done

export PGHOST=127.0.0.1 PGPORT="$PORT" PGUSER=postgres PGPASSWORD=postgres PGDATABASE=postgres
PSQL=(psql -v ON_ERROR_STOP=1 -X -q)

LOGDIR=".db-verify-logs/$(date +%Y%m%d-%H%M%S)"
mkdir -p "$LOGDIR"

cleanup() {
  if [ "$KEEP" = "1" ]; then
    echo "ℹ️  contenedor '$CONTAINER' sigue arriba (puerto $PORT). Bajalo con: docker rm -f $CONTAINER"
  else
    docker rm -f "$CONTAINER" >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT

step() { printf '\n\033[1m▶ %s\033[0m\n' "$1"; }
fail() { printf '\033[31m❌ %s\033[0m\n' "$1" >&2; }
ok()   { printf '\033[32m✓ %s\033[0m\n' "$1"; }

# ---------- 1) Postgres local ----------
if [ "$REUSE" = "1" ] && docker ps --format '{{.Names}}' | grep -qx "$CONTAINER"; then
  step "Reusando Postgres existente ($CONTAINER:$PORT)"
else
  step "Levantando Postgres efímero ($CONTAINER:$PORT)"
  docker rm -f "$CONTAINER" >/dev/null 2>&1 || true
  docker run -d --name "$CONTAINER" \
    -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=postgres \
    -p "$PORT:5432" --shm-size=256m "$PG_IMAGE" >/dev/null || {
      fail "no se pudo iniciar el contenedor"; exit 1; }

  for _ in $(seq 1 60); do
    if docker exec "$CONTAINER" pg_isready -U postgres >/dev/null 2>&1; then break; fi
    sleep 1
  done
  docker exec "$CONTAINER" pg_isready -U postgres >/dev/null 2>&1 || {
    fail "Postgres no respondió a tiempo"; docker logs --tail 40 "$CONTAINER"; exit 1; }
  ok "Postgres listo"
fi

run_sql() { # run_sql <archivo> <nombre-log>
  local file="$1" name="$2"
  if "${PSQL[@]}" -f "$file" > "$LOGDIR/$name.log" 2>&1; then
    ok "$name"
    return 0
  fi
  fail "$name — ver $LOGDIR/$name.log"
  tail -n 25 "$LOGDIR/$name.log" >&2
  return 1
}

# ---------- 2) Preparación de esquema ----------
if [ "$REUSE" != "1" ]; then
  step "Bootstrap (stubs auth/storage/cron/net/pgmq)"
  run_sql supabase/tests/rls/_ci_bootstrap.sql bootstrap || exit 1

  step "Drift fixes"
  run_sql supabase/tests/rls/_ci_drift.sql drift || exit 1

  step "Aplicando migraciones (base limpia)"
  shopt -s nullglob
  migr_log="$LOGDIR/migrations.log"
  : > "$migr_log"
  total=0
  # Paridad con CI (.github/workflows/rls-tests.yml): las migraciones legacy
  # exentas y las "ancladas por texto" no aplican en base limpia; su estado
  # final lo garantiza una migración posterior de reaplicación.
  local exentas=" 20260729035825 20260812090000 "
  local ancladas
  ancladas="$(grep -vE '^\s*(#|$)' supabase/tests/rls/drift-anclas.txt 2>/dev/null || true)"
  for f in $(printf '%s\n' supabase/migrations/*.sql | LC_ALL=C sort); do
    base="$(basename "$f")"
    echo "▶ $base" >> "$migr_log"
    # Las extensiones que no existen en la imagen oficial se neutralizan,
    # igual que en CI, para que la migración aplique en base limpia.
    if sed -E \
        -e 's/^[[:space:]]+CREATE EXTENSION[[:space:]]+(IF NOT EXISTS[[:space:]]+)?(pg_cron|pg_net|pgmq|supabase_vault)[^;]*;/    PERFORM 1; -- [ci] stubbed \2/I' \
        -e 's/^CREATE EXTENSION[[:space:]]+(IF NOT EXISTS[[:space:]]+)?(pg_cron|pg_net|pgmq|supabase_vault)[^;]*;/SELECT 1; -- [ci] stubbed \2/I' \
        "$f" | "${PSQL[@]}" --single-transaction >> "$migr_log" 2>&1; then
      total=$((total + 1))
      continue
    fi
    if [[ "$exentas" == *" ${base%%_*} "* ]]; then
      echo "↷ $base: migración legacy exenta (estado final en migración posterior)"
      continue
    fi
    if printf '%s\n' "$ancladas" | grep -qxF "$base"; then
      echo "↷ $base: migración anclada omitida (reaplicación posterior garantiza el estado)"
      continue
    fi
    fail "migración '$base' no aplica en base limpia — ver $migr_log"
    tail -n 30 "$migr_log" >&2
    exit 1
  done
  ok "$total migraciones aplicadas"

  step "Post-migrate + verificación de cobertura RLS"
  run_sql supabase/tests/rls/_ci_post_migrate.sql post_migrate || exit 1
  run_sql supabase/tests/rls/_ci_verify_rls.sql verify_rls || exit 1

  step "Guardia de integridad de esquema"
  if psql -X -q -A -t -f scripts/db/integrity-guard.sql > "$LOGDIR/integrity.log" 2>&1 \
     && [ "$(grep -c . "$LOGDIR/integrity.log")" = "0" ]; then
    ok "integridad"
  else
    fail "guardia de integridad reportó hallazgos"
    cat "$LOGDIR/integrity.log" >&2
    exit 1
  fi
fi

# ---------- 2b) Snapshot del esquema (baseline golden) ----------
if [ -n "$SNAPSHOT_OUT" ]; then
  step "Generando snapshot de esquema → $SNAPSHOT_OUT"
  mkdir -p "$(dirname "$SNAPSHOT_OUT")"
  if bash scripts/db/schema-snapshot.sh "$SNAPSHOT_OUT" "$CONTAINER" 2> "$LOGDIR/snapshot.log"; then
    ok "snapshot ($(wc -l < "$SNAPSHOT_OUT") líneas)"
  else
    fail "no se pudo generar el snapshot — ver $LOGDIR/snapshot.log"
    cat "$LOGDIR/snapshot.log" >&2
    exit 1
  fi
fi

if [ "$ONLY_SCHEMA" = "1" ]; then
  printf '\n'
  ok "Sólo esquema: migraciones + guardias en verde. Logs: $LOGDIR"
  exit 0
fi

# ---------- 3) Suites SQL/RLS ----------
declare -a SUITES=()

if [ -n "$SUITES_ARG" ]; then
  IFS=',' read -r -a SUITES <<< "$SUITES_ARG"
elif [ "$RUN_ALL" = "1" ]; then
  while IFS= read -r s; do SUITES+=("$s"); done < <(
    find supabase/tests/rls -maxdepth 1 -name 'test_rls_*.sql' \
      | sed -E 's|.*/test_rls_||; s|\.sql$||' | LC_ALL=C sort)
else
  SUITES=("${SUITES_MIN[@]}")
fi

FAILED=()
step "Suites RLS (${#SUITES[@]})"
for s in "${SUITES[@]}"; do
  file="supabase/tests/rls/test_rls_${s}.sql"
  if [ ! -f "$file" ]; then
    fail "suite inexistente: $s"; FAILED+=("rls:$s"); continue
  fi
  run_sql "$file" "rls_$s" || FAILED+=("rls:$s")
done

if [ "$RUN_BEHAVIORAL" = "1" ]; then
  step "Suites conductuales (supabase/tests/*.sql)"
  for f in $(printf '%s\n' supabase/tests/*.sql | LC_ALL=C sort); do
    name="$(basename "$f" .sql)"
    run_sql "$f" "sql_$name" || FAILED+=("sql:$name")
  done
fi

# ---------- 4) Resumen ----------
printf '\n────────────────────────────────\n'
if [ "${#FAILED[@]}" -eq 0 ]; then
  ok "Verificación local en verde. Logs: $LOGDIR"
  exit 0
fi
fail "Fallaron ${#FAILED[@]} suite(s):"
for f in "${FAILED[@]}"; do echo "   • $f" >&2; done
echo "Logs: $LOGDIR" >&2
exit 1
