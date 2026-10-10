#!/usr/bin/env bash
# Detector de áreas cambiadas para CI (extraído de ci.yml para poder probarlo).
#
# - pull_request: base.sha vs HEAD.
# - push a main:  github.event.before vs github.sha.
# - dispatch / diff ausente o `git diff` fallido: se corre TODO (conservador).
#
# El diff se lee con `--name-only -z` porque `git diff --name-only` entrecomilla
# rutas con acentos o espacios (core.quotePath) y entonces un archivo
# `...del-día-anterior.md` llega como `"...\303\255a-anterior.md"`, es decir
# terminado en comilla: el patrón `\.md$` no coincidía y se activaba el camino
# de frontend por un cambio de documentación.
set -uo pipefail

base=""
case "${EVENT_NAME:-}" in
  pull_request) base="${BASE_SHA:-}" ;;
  push) base="${BEFORE_SHA:-}" ;;
esac

head_sha="${HEAD_SHA:-HEAD}"
out="${GITHUB_OUTPUT:-/dev/stdout}"

diff=""
if [ -n "$base" ] && [ "$base" != "0000000000000000000000000000000000000000" ] \
  && git cat-file -e "$base^{commit}" 2>/dev/null; then
  # El estado de `git diff` se captura explícitamente: con `set -e` del shell de
  # Actions una asignación fallida abortaría antes del fallback.
  # `sed '/^$/d'` quita la línea vacía final que deja `tr` (si no, `grep -v`
  # la contaría como "ruta fuera de docs" y activaría frontend siempre).
  if salida="$(git diff --name-only -z "$base" "$head_sha" | tr '\0' '\n' | sed '/^$/d')"; then
    diff="$salida"
  else
    echo "git diff falló: se ejecuta TODO."
  fi
fi

if [ -z "$diff" ]; then
  echo "Sin diff utilizable (${EVENT_NAME:-sin evento}): se ejecuta TODO."
  {
    echo "frontend=true"
    echo "edge=true"
    echo "database=true"
    echo "workflows=true"
  } >> "$out"
  exit 0
fi

echo "$diff"
frontend=false
edge=false
database=false
workflows=false
# here-string en vez de `printf | grep -q`: sin SIGPIPE con diffs grandes.
# Sólo SQL conocido evita lint/build/PDF. Vitest sigue probando sus contratos.
# Rutas desconocidas conservan frontend=true por seguridad.
if grep -qvE '^(docs/|\.github/ISSUE_TEMPLATE/)|\.md$|^(supabase/(migrations|schema|tests)/|drizzle/migrations/).*\.sql$' <<<"$diff"; then
  frontend=true
fi
if grep -qE '^\.github/(workflows/|actions/|dependabot\.yml$)|^scripts/ci/(detect-areas|lint-workflows)\.sh$' <<<"$diff"; then
  workflows=true
fi
if grep -qE '^supabase/functions/|^tests/contracts/|^scripts/check-edge-entrypoints\.sh$|^deno\.(json|jsonc|lock)$|^\.github/workflows/ci\.yml$|^\.github/actions/setup-bun/|^scripts/ci/detect-areas\.sh$' <<<"$diff"; then
  edge=true
fi
if grep -qE '^scripts/db/|^supabase/(migrations|schema|tests|releases)/|^drizzle/|^drizzle\.config\.ts$|^scripts/audit-|^scripts/lib/|^scripts/ci/detect-areas\.sh$|^src/constants/appVersion\.ts$|^package\.json$|^bun\.lock$|^\.github/workflows/ci\.yml$|^\.github/actions/setup-bun/' <<<"$diff"; then
  database=true
fi
{
  echo "frontend=$frontend"
  echo "edge=$edge"
  echo "database=$database"
  echo "workflows=$workflows"
} >> "$out"
