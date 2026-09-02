#!/usr/bin/env bash
# Corre los audits de arquitectura según el área modificada en el PR.
# En push a main o cuando no se puede determinar el diff, corre todo.
# Uso:
#   FRONTEND_CHANGED=true BACKEND_CHANGED=false bash scripts/run-audits-conditional.sh
#
# R13.823.17 · Reduce wall-clock de CI para PRs que sólo tocan frontend o
# backend, sin quitar guardrails de seguridad/integridad.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

FRONTEND_CHANGED="${FRONTEND_CHANGED:-false}"
BACKEND_CHANGED="${BACKEND_CHANGED:-false}"
GITHUB_REF="${GITHUB_REF:-}"

correr_siempre=(manifest)
correr_frontend=(arch casts tests sonner no-env soft-delete)
correr_backend=(schema schema-functions migrations replay-mirror rpc-sync)

# En main, o si no sabemos qué cambió, corremos todo por seguridad.
if [[ "$GITHUB_REF" == "refs/heads/main" ]] || { [[ "$FRONTEND_CHANGED" != "true" ]] && [[ "$BACKEND_CHANGED" != "true" ]]; }; then
  audits=("${correr_siempre[@]}" "${correr_frontend[@]}" "${correr_backend[@]}")
else
  audits=("${correr_siempre[@]}")
  if [[ "$FRONTEND_CHANGED" == "true" ]]; then
    audits+=("${correr_frontend[@]}")
  fi
  if [[ "$BACKEND_CHANGED" == "true" ]]; then
    audits+=("${correr_backend[@]}")
  fi
fi

mkdir -p /tmp/audits
pids=()
log_files=()
fail=0

for audit in "${audits[@]}"; do
  log="/tmp/audits/$audit.log"
  echo "[audits] iniciando audit:$audit"
  bun run "audit:$audit" > "$log" 2>&1 &
  pids+=("$!")
  log_files+=("$log")
done

for i in "${!pids[@]}"; do
  pid="${pids[$i]}"
  audit="${audits[$i]}"
  if ! wait "$pid"; then
    echo "❌ audit:$audit" >&2
    cat "${log_files[$i]}" >&2
    fail=1
  fi
done

exit "$fail"
