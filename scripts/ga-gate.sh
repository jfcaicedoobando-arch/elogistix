#!/usr/bin/env bash
# scripts/ga-gate.sh — Gate de verificación pre-GA para Libre Carga
# Uso: bash scripts/ga-gate.sh
# Sale con código 0 si todos los checks pasan, !=0 si algo bloquea el corte.

set -u
cd "$(dirname "$0")/.."

PASS=0
FAIL=0
declare -a RESULTS

check() {
  local name="$1"
  local status="$2"
  local detail="${3:-}"
  if [ "$status" = "ok" ]; then
    RESULTS+=("✓  $name")
    PASS=$((PASS+1))
  else
    RESULTS+=("✗  $name${detail:+ — $detail}")
    FAIL=$((FAIL+1))
  fi
}

echo "→ Ejecutando gate pre-GA (12.0.0)…"
echo

# 1. Tests
if bun test >/tmp/ga-gate-tests.log 2>&1; then
  check "1. bun test (770/770)" ok
else
  check "1. bun test" fail "ver /tmp/ga-gate-tests.log"
fi

# 2. Lint
if bun run lint >/tmp/ga-gate-lint.log 2>&1; then
  check "2. bun run lint (0 errores)" ok
else
  check "2. bun run lint" fail "ver /tmp/ga-gate-lint.log"
fi

# 3-4. APP_VERSION es 12.0.0 sin sufijo pre-release
VERSION_LINE=$(grep -E 'APP_VERSION\s*=' src/constants/appVersion.ts || true)
if echo "$VERSION_LINE" | grep -q '"12\.0\.0"'; then
  check "3. APP_VERSION = \"12.0.0\" exacto" ok
elif echo "$VERSION_LINE" | grep -q '12\.0\.0-rc'; then
  check "3. APP_VERSION" fail "aún es pre-release ($VERSION_LINE) — bump pendiente"
else
  check "3. APP_VERSION" fail "no encontrado o versión inesperada"
fi

# 5. CHANGELOG tiene entrada [12.0.0] fechada (no rc)
if grep -qE '^## \[12\.0\.0\] - [0-9]{4}-[0-9]{2}-[0-9]{2}' CHANGELOG.md; then
  check "4. CHANGELOG.md tiene entrada [12.0.0]" ok
else
  check "4. CHANGELOG.md" fail "falta '## [12.0.0] - YYYY-MM-DD'"
fi

# 6. rc-qa-checklist sin ❌ ni ⏳ pendientes
if [ -f docs/rc-qa-checklist.md ]; then
  PENDING=$(grep -cE '❌|⏳|\[ \]' docs/rc-qa-checklist.md || true)
  if [ "$PENDING" -eq 0 ]; then
    check "5. docs/rc-qa-checklist.md sin pendientes" ok
  else
    check "5. docs/rc-qa-checklist.md" fail "$PENDING marcador(es) pendiente(s)"
  fi
else
  check "5. docs/rc-qa-checklist.md" fail "archivo no encontrado"
fi

# 7. rc-perf sin placeholders
if [ -f docs/rc-perf.md ]; then
  PH=$(grep -ciE 'TODO|<pendiente>|pendiente de medir' docs/rc-perf.md || true)
  if [ "$PH" -eq 0 ]; then
    check "6. docs/rc-perf.md sin placeholders" ok
  else
    check "6. docs/rc-perf.md" fail "$PH placeholder(s) — ejecutar smoke"
  fi
else
  check "6. docs/rc-perf.md" fail "archivo no encontrado"
fi

# 8. release-notes-12.0 sin "rc" en el título
if [ -f docs/release-notes-12.0.md ]; then
  if head -5 docs/release-notes-12.0.md | grep -qi 'rc'; then
    check "7. docs/release-notes-12.0.md sin 'rc' en encabezado" fail "quitar sufijo rc.x"
  else
    check "7. docs/release-notes-12.0.md sin 'rc' en encabezado" ok
  fi
else
  check "7. docs/release-notes-12.0.md" fail "archivo no encontrado"
fi

echo
printf '%s\n' "${RESULTS[@]}"
echo
echo "Resumen: $PASS pasados · $FAIL bloqueando"
echo

if [ "$FAIL" -gt 0 ]; then
  echo "❌ GA bloqueado. Resuelve los checks marcados ✗ antes de cortar 12.0.0."
  exit 1
fi

echo "✅ Gate OK. Procede con docs/ga-cutover.md a partir del paso 7 (Publish)."
exit 0
