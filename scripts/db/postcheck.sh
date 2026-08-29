#!/usr/bin/env bash
# db:postcheck — cierre obligatorio de TODO cambio de base de datos.
#
# Corre, en el mismo orden que el workflow `rls-tests`, los cuatro candados que
# provocan casi todos los rojos de CI:
#
#   1. migraciones en base limpia + _ci_verify_rls + candado service_role-only
#   2. regeneración de supabase/schema/baseline.sql (job `schema-baseline`)
#   3. guards conductuales (scripts/ci/run-guards.sh)
#   4. suite RLS mínima
#
# Uso:
#   bun run db:postcheck              # todo (regenera baseline si cambió)
#   bun run db:postcheck -- --check   # NO escribe baseline; sólo diff (modo CI)
#   bun run db:postcheck -- --port 55441
#
# Requisitos: psql 17 + pg_dump 17; Docker o initdb/pg_ctl (autodetectado).

set -uo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

PORT=55441
CHECK_ONLY=0
BACKEND_ARG=()

while [ $# -gt 0 ]; do
  case "$1" in
    --check)      CHECK_ONLY=1 ;;
    --port)       PORT="${2:-}"; shift ;;
    --port=*)     PORT="${1#--port=}" ;;
    --backend)    BACKEND_ARG=(--backend "${2:-}"); shift ;;
    --backend=*)  BACKEND_ARG=(--backend "${1#--backend=}") ;;
    -h|--help)    sed -n '2,19p' "$0"; exit 0 ;;
    *) echo "⚠️  flag desconocido: $1" >&2; exit 2 ;;
  esac
  shift
done

BASELINE="supabase/schema/baseline.sql"
ACTUAL="$(mktemp /tmp/schema.actual.XXXXXX.sql)"
step() { printf '\n\033[1m▶ %s\033[0m\n' "$1"; }
fail() { printf '\033[31m❌ %s\033[0m\n' "$1" >&2; }
ok()   { printf '\033[32m✓ %s\033[0m\n' "$1"; }

FAILED=()

# ---------- 1+2) Migraciones, candados de esquema y snapshot ----------
step "Migraciones en base limpia + candados de esquema + snapshot"
if bash scripts/db/local-verify.sh --only-schema --keep --port "$PORT" \
     --snapshot "$ACTUAL" "${BACKEND_ARG[@]}"; then
  ok "esquema y candados"
else
  fail "esquema/candados en rojo (ver .db-verify-logs/)"
  FAILED+=("esquema")
fi

# ---------- 2b) Baseline ----------
if [ -s "$ACTUAL" ]; then
  step "Baseline de esquema"
  if diff -u "$BASELINE" "$ACTUAL" > /tmp/schema.diff 2>/dev/null; then
    ok "baseline sin cambios"
  elif [ "$CHECK_ONLY" = "1" ]; then
    fail "drift contra $BASELINE (corré 'bun run db:postcheck' sin --check para regenerarla)"
    head -n 40 /tmp/schema.diff >&2
    FAILED+=("baseline")
  else
    cp "$ACTUAL" "$BASELINE"
    ok "baseline REGENERADA ($(wc -l < "$BASELINE") líneas) — committeala junto a la migración"
  fi
fi

# ---------- 3) Guards conductuales ----------
step "Guards conductuales (run-guards.sh)"
if PGHOST=127.0.0.1 PGPORT="$PORT" PGUSER=postgres PGPASSWORD=postgres \
   PGDATABASE=postgres PGSSLMODE=disable bash scripts/ci/run-guards.sh; then
  ok "guards"
else
  fail "guards en rojo"
  FAILED+=("guards")
fi

# ---------- 4) Suite RLS mínima ----------
step "Suite RLS mínima"
if bash scripts/db/local-verify.sh --reuse --no-behavioral --port "$PORT" "${BACKEND_ARG[@]}"; then
  ok "suites RLS"
else
  fail "suites RLS en rojo"
  FAILED+=("rls")
fi

rm -f "$ACTUAL"

printf '\n────────────────────────────────\n'
if [ "${#FAILED[@]}" -eq 0 ]; then
  ok "db:postcheck en verde — listo para pushear"
  exit 0
fi
fail "db:postcheck falló en: ${FAILED[*]}"
exit 1
