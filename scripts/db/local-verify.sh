#!/usr/bin/env bash
# db:verify — levanta un Postgres efímero (Docker o `initdb` local), aplica
# TODAS las migraciones y corre una suite SQL/RLS mínima de verificación. Sirve
# para detectar fallos antes de pushear, sin esperar el workflow `rls-tests`.
#
# Uso:
#   bun run db:verify                       # base limpia + migraciones + suite mínima
#   bun run db:verify -- --suites isolation,financiero
#   bun run db:verify -- --all              # TODAS las suites test_rls_*.sql
#   bun run db:verify -- --reuse            # no recrea la base (rápido)
#   bun run db:verify -- --keep             # deja el servidor arriba al terminar
#   bun run db:verify -- --port 55433       # otro puerto local
#   bun run db:verify -- --no-behavioral    # omite supabase/tests/*.sql
#   bun run db:verify -- --only-schema      # sólo migraciones + guardias (sin suites)
#   bun run db:verify -- --snapshot supabase/schema/baseline.sql
#   bun run db:verify -- --backend local    # fuerza `initdb` (sin Docker)
#
# Requisitos: psql 17 + (docker) o (initdb/pg_ctl 17) en PATH; pg_dump para --snapshot.
# Salida: logs en .db-verify-logs/<timestamp>/ y resumen al final.



set -uo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

# Misma imagen pinneada que .github/workflows/rls-tests.yml (postgres 17.9).
PG_IMAGE="postgres@sha256:66b6a97eac1771fc78bd201b918b4253859f436c6913aeede97bd5366cce89ae"
CONTAINER="elogistix-verify-db"

# Punto de partida de toda base limpia: historial consolidado (squash) + corte.
# Fuente única compartida con .github/workflows/rls-tests.yml.
# shellcheck disable=SC1091
. supabase/schema/squash/cutoff.env

PORT=55432
REUSE=0
KEEP=0
RUN_ALL=0
RUN_BEHAVIORAL=1
ONLY_SCHEMA=0
SNAPSHOT_OUT=""
SNAPSHOT_PRE_OUT=""
SUITES_ARG=""
BACKEND="auto"          # auto | docker | local



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
    --snapshot-pre)   SNAPSHOT_PRE_OUT="${2:-}"; shift ;;
    --snapshot-pre=*) SNAPSHOT_PRE_OUT="${1#--snapshot-pre=}" ;;
    --backend)        BACKEND="${2:-}"; shift ;;
    --backend=*)      BACKEND="${1#--backend=}" ;;

    --port)           PORT="${2:-}"; shift ;;
    --port=*)         PORT="${1#--port=}" ;;
    -h|--help)        sed -n '2,20p' "$0"; exit 0 ;;
    *) echo "⚠️  flag desconocido: $1" >&2; exit 2 ;;
  esac
  shift
done

command -v psql >/dev/null 2>&1 || { echo "❌ 'psql' no está en PATH." >&2; exit 127; }

# ---------- 0) Backend: Docker o Postgres local (initdb) ----------
# El sandbox de Lovable NO tiene Docker: sin este fallback nadie puede correr
# `db:verify` ni regenerar la baseline antes de pushear, y CI se convierte en el
# primer lugar donde se descubre el problema.
docker_usable() {
  command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1
}
case "$BACKEND" in
  auto)   if docker_usable; then BACKEND=docker; else BACKEND=local; fi ;;
  docker) docker_usable || { echo "❌ Docker no está disponible (usá --backend local)." >&2; exit 127; } ;;
  local)  : ;;
  *)      echo "❌ --backend inválido: $BACKEND (docker|local|auto)" >&2; exit 2 ;;
esac

if [ "$BACKEND" = "local" ]; then
  for bin in initdb pg_ctl; do
    command -v "$bin" >/dev/null 2>&1 || {
      echo "❌ '$bin' no está en PATH (necesario para --backend local)." >&2; exit 127; }
  done
fi

# El servidor de pruebas es Postgres 17: pg_dump se niega a respaldar un
# servidor más nuevo que él ("server version mismatch"). Avisamos temprano.
if command -v pg_dump >/dev/null 2>&1; then
  PGDUMP_MAJOR="$(pg_dump --version | sed -nE 's/.* ([0-9]+)(\.[0-9]+)?.*/\1/p')"
  if [ -n "${PGDUMP_MAJOR:-}" ] && [ "$PGDUMP_MAJOR" -lt 17 ]; then
    echo "⚠️  pg_dump $PGDUMP_MAJOR es más viejo que el servidor (17): instala postgresql-client-17 si vas a usar --snapshot." >&2
  fi
fi


export PGHOST=127.0.0.1 PGPORT="$PORT" PGUSER=postgres PGPASSWORD=postgres PGDATABASE=postgres
export PGSSLMODE=disable
PSQL=(psql -v ON_ERROR_STOP=1 -X -q)

LOGDIR=".db-verify-logs/$(date +%Y%m%d-%H%M%S)"
mkdir -p "$LOGDIR"

# Postgres se niega a correr como root; en el sandbox (uid 0) delegamos a un
# usuario sin privilegios con setpriv.
PGDATA_DIR="$ROOT/.db-verify-logs/pgdata-$PORT"
PGSOCK_DIR="${TMPDIR:-/tmp}/db-verify-sock-$PORT"
RUNAS=()
if [ "$(id -u)" = "0" ]; then
  command -v setpriv >/dev/null 2>&1 || {
    echo "❌ corriendo como root y sin 'setpriv': Postgres no arranca como root." >&2; exit 127; }
  RUNAS=(setpriv --reuid=1000 --regid=1000 --clear-groups)
fi

pg_local_ready() { pg_isready -q -h 127.0.0.1 -p "$PORT" >/dev/null 2>&1; }

pg_local_stop() {
  [ -d "$PGDATA_DIR" ] || return 0
  "${RUNAS[@]}" pg_ctl -D "$PGDATA_DIR" -m immediate -w stop >/dev/null 2>&1 || true
}

pg_local_up() {
  if [ "$REUSE" = "1" ] && pg_local_ready; then
    step "Reusando Postgres local (127.0.0.1:$PORT)"
    return 0
  fi
  step "Levantando Postgres efímero con initdb (127.0.0.1:$PORT)"
  pg_local_stop
  rm -rf "$PGDATA_DIR"
  mkdir -p "$PGDATA_DIR" "$PGSOCK_DIR"
  if [ "${#RUNAS[@]}" -gt 0 ]; then
    chown -R 1000:1000 "$PGDATA_DIR" "$PGSOCK_DIR" "$LOGDIR"
  fi
  "${RUNAS[@]}" initdb -D "$PGDATA_DIR" -U postgres --auth=trust --encoding=UTF8 \
    > "$LOGDIR/initdb.log" 2>&1 || {
      fail "initdb falló — ver $LOGDIR/initdb.log"; tail -n 20 "$LOGDIR/initdb.log" >&2; exit 1; }
  "${RUNAS[@]}" pg_ctl -D "$PGDATA_DIR" -l "$LOGDIR/postgres.log" -w \
    -o "-p $PORT -c listen_addresses=127.0.0.1 -k $PGSOCK_DIR -c fsync=off -c full_page_writes=off" \
    start > "$LOGDIR/pgctl.log" 2>&1 || {
      fail "Postgres no arrancó — ver $LOGDIR/postgres.log"; tail -n 20 "$LOGDIR/postgres.log" >&2; exit 1; }
  pg_local_ready || { fail "Postgres no respondió en 127.0.0.1:$PORT"; exit 1; }
  ok "Postgres listo (local)"
}

pg_docker_up() {
  if [ "$REUSE" = "1" ] && docker ps --format '{{.Names}}' | grep -qx "$CONTAINER"; then
    step "Reusando Postgres existente ($CONTAINER:$PORT)"
    return 0
  fi
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
  ok "Postgres listo (docker)"
}

cleanup() {
  if [ "$KEEP" = "1" ]; then
    if [ "$BACKEND" = "docker" ]; then
      echo "ℹ️  contenedor '$CONTAINER' sigue arriba (puerto $PORT). Bajalo con: docker rm -f $CONTAINER"
    else
      echo "ℹ️  Postgres local sigue arriba (puerto $PORT). Bajalo con: pg_ctl -D $PGDATA_DIR -m immediate stop"
    fi
  elif [ "$BACKEND" = "docker" ]; then
    docker rm -f "$CONTAINER" >/dev/null 2>&1 || true
  else
    pg_local_stop
  fi
}
trap cleanup EXIT

step() { printf '\n\033[1m▶ %s\033[0m\n' "$1"; }
fail() { printf '\033[31m❌ %s\033[0m\n' "$1" >&2; }
ok()   { printf '\033[32m✓ %s\033[0m\n' "$1"; }

# ---------- 1) Postgres efímero ----------
if [ "$BACKEND" = "docker" ]; then
  pg_docker_up
else
  pg_local_up
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

  # Neutraliza las extensiones que no existen en la imagen/sandbox, igual que CI.
  stub_ext() {
    sed -E \
      -e 's/^[[:space:]]+CREATE EXTENSION[[:space:]]+(IF NOT EXISTS[[:space:]]+)?(pg_cron|pg_net|pgmq|supabase_vault)[^;]*;/    PERFORM 1; -- [ci] stubbed \2/I' \
      -e 's/^CREATE EXTENSION[[:space:]]+(IF NOT EXISTS[[:space:]]+)?(pg_cron|pg_net|pgmq|supabase_vault)[^;]*;/SELECT 1; -- [ci] stubbed \2/I' \
      "$1"
  }

  # Squash: el historial hasta SQUASH_CUTOFF está consolidado en un archivo.
  # Las bases limpias parten de ahí; las migraciones históricas se conservan en
  # supabase/migrations/ como bitácora, pero ya no se re-ejecutan.
  step "Aplicando baseline squash"
  squash_log="$LOGDIR/squash.log"
  if stub_ext "$SQUASH_FILE" | "${PSQL[@]}" --single-transaction > "$squash_log" 2>&1; then
    ok "squash aplicado ($(basename "$SQUASH_FILE"), corte $SQUASH_CUTOFF)"
  else
    fail "el baseline squash no aplica en base limpia — ver $squash_log"
    tail -n 30 "$squash_log" >&2
    exit 1
  fi

  step "Aplicando migraciones posteriores al corte"
  shopt -s nullglob
  migr_log="$LOGDIR/migrations.log"
  : > "$migr_log"
  total=0
  for f in $(printf '%s\n' supabase/migrations/*.sql | LC_ALL=C sort); do
    base="$(basename "$f")"
    ts="${base%%_*}"
    # Historial ya consolidado en el squash: no se re-ejecuta.
    [ "$ts" \> "$SQUASH_CUTOFF" ] || continue
    echo "▶ $base" >> "$migr_log"
    if stub_ext "$f" | "${PSQL[@]}" --single-transaction >> "$migr_log" 2>&1; then
      total=$((total + 1))
      continue
    fi

    fail "migración '$base' no aplica sobre el squash — ver $migr_log"
    tail -n 30 "$migr_log" >&2
    exit 1
  done
  ok "$total migraciones nuevas aplicadas"


  # Snapshot ANTES de _ci_post_migrate.sql: es el estado que producen sólo las
  # migraciones del repo (sin los GRANT masivos de CI). Es la fuente correcta
  # para consolidar (squash) el historial en una sola migración base.
  if [ -n "$SNAPSHOT_PRE_OUT" ]; then
    step "Snapshot pre-post-migrate → $SNAPSHOT_PRE_OUT"
    mkdir -p "$(dirname "$SNAPSHOT_PRE_OUT")"
    snap_pre_container=""
    [ "$BACKEND" = "docker" ] && snap_pre_container="$CONTAINER"
    if bash scripts/db/schema-snapshot.sh "$SNAPSHOT_PRE_OUT" "$snap_pre_container" 2> "$LOGDIR/snapshot-pre.log"; then
      ok "snapshot-pre ($(wc -l < "$SNAPSHOT_PRE_OUT") líneas)"
    else
      fail "no se pudo generar el snapshot-pre — ver $LOGDIR/snapshot-pre.log"
      cat "$LOGDIR/snapshot-pre.log" >&2
      exit 1
    fi
  fi



  # Orden idéntico a CI: el candado bidireccional corre ANTES del GRANT masivo
  # de _ci_post_migrate.sql (si no, los REVOKE faltantes quedan tapados).
  step "Candado service_role-only (bidireccional)"
  run_sql supabase/tests/rls/_ci_check_service_role_only.sql service_role_only || {
    echo "   → agregá la función con firma completa a supabase/tests/rls/_ci_service_role_only.sql" >&2
    exit 1
  }

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
  # Backend local: pg_dump del PATH (ya es 17.x, validado arriba).
  snap_container=""
  [ "$BACKEND" = "docker" ] && snap_container="$CONTAINER"
  if bash scripts/db/schema-snapshot.sh "$SNAPSHOT_OUT" "$snap_container" 2> "$LOGDIR/snapshot.log"; then
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
