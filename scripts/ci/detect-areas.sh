#!/usr/bin/env bash
# Detector de áreas cambiadas para CI (extraído de ci.yml para poder probarlo).
#
# - pull_request: base.sha vs HEAD.
# - push a main:  github.event.before vs github.sha.
# - diff calculado correctamente sin rutas: todas las áreas quedan inactivas.
# - dispatch / evento desconocido / base ausente / error: TODO (conservador).
#
# El diff se lee con `--name-only -z` porque `git diff --name-only` entrecomilla
# rutas con acentos o espacios (core.quotePath) y entonces un archivo
# `...del-día-anterior.md` llega como `"...\303\255a-anterior.md"`, es decir
# terminado en comilla: el patrón `\.md$` no coincidía y se activaba el camino
# de frontend por un cambio de documentación.
set -uo pipefail

out="${GITHUB_OUTPUT:-/dev/stdout}"

full_run() {
  echo "$1: se ejecuta TODO."
  {
    echo "frontend=true"
    echo "edge=true"
    echo "database=true"
    echo "workflows=true"
  } >> "$out"
  exit 0
}

base=""
case "${EVENT_NAME:-}" in
  pull_request) base="${BASE_SHA:-}" ;;
  push) base="${BEFORE_SHA:-}" ;;
  *) full_run "Evento sin selección incremental (${EVENT_NAME:-sin evento})" ;;
esac

head_sha="${HEAD_SHA:-HEAD}"
if [ -z "$base" ] || [ "$base" = "0000000000000000000000000000000000000000" ] \
  || ! git cat-file -e "$base^{commit}" 2>/dev/null; then
  full_run "Base ausente o inválida"
fi
if ! git cat-file -e "$head_sha^{commit}" 2>/dev/null; then
  full_run "Head ausente o inválido"
fi

# Conservar el resultado binario hasta comprobar el exit code. Ni una salida
# parcial de git ni la falta de archivo temporal pueden parecer un diff vacío.
if ! diff_file="$(mktemp)"; then
  full_run "No se pudo preparar el diff"
fi
trap 'rm -f -- "$diff_file"' EXIT
# --no-renames incluye origen y destino: mover SQL/código a docs sigue
# activando las comprobaciones del área eliminada. -- termina las revisiones.
if ! git diff --no-ext-diff --no-textconv --no-renames --name-only -z "$base" "$head_sha" -- > "$diff_file"; then
  full_run "git diff falló"
fi

frontend=false
edge=false
database=false
workflows=false
# Sólo SQL conocido evita lint/build/PDF. Vitest sigue probando sus contratos.
# Rutas desconocidas conservan frontend=true. Leer NUL preserva incluso rutas
# con saltos de línea y evita SIGPIPE o truncar el resultado en el primer match.
while IFS= read -r -d '' path; do
  printf '%q\n' "$path"
  if [[ ! "$path" =~ ^(docs/|\.github/ISSUE_TEMPLATE/)|\.md$|^(supabase/(migrations|schema|tests)/|drizzle/migrations/).*\.sql$ ]]; then
    frontend=true
  fi
  if [[ "$path" =~ ^\.github/(workflows/|actions/|dependabot\.yml$)|^scripts/ci/(detect-areas|lint-workflows)\.sh$ ]]; then
    workflows=true
  fi
  if [[ "$path" =~ ^supabase/functions/|^tests/contracts/|^scripts/check-edge-entrypoints\.sh$|^deno\.(json|jsonc|lock)$|^\.github/workflows/ci\.yml$|^\.github/actions/setup-bun/|^scripts/ci/detect-areas\.sh$ ]]; then
    edge=true
  fi
  if [[ "$path" =~ ^scripts/db/|^supabase/(migrations|schema|tests|releases)/|^drizzle/|^drizzle\.config\.ts$|^scripts/audit-|^scripts/lib/|^scripts/ci/detect-areas\.sh$|^src/constants/appVersion\.ts$|^package\.json$|^bun\.lock$|^\.github/workflows/ci\.yml$|^\.github/actions/setup-bun/ ]]; then
    database=true
  fi
done < "$diff_file"
if [ ! -s "$diff_file" ]; then
  echo "Diff válido vacío: no hay áreas que comprobar."
fi
{
  echo "frontend=$frontend"
  echo "edge=$edge"
  echo "database=$database"
  echo "workflows=$workflows"
} >> "$out"
