#!/usr/bin/env bash
set -euo pipefail
# Typecheck the canonical disabled adapter as well as every deployable entrypoint.
deno cache --node-modules-dir=none supabase/functions/demo-access/index.ts
deno check --node-modules-dir=none supabase/functions/demo-access/index.ts

# Check all deployable Edge adapters
(
set -euo pipefail
bash scripts/check-edge-entrypoints.sh
)

# Deno tests (con typecheck, excluye smoke)
(
set -euo pipefail
export DENO_NO_PACKAGE_JSON='1'
set -uo pipefail
readarray -t tests < <(find supabase/functions -name '*_test.ts' ! -name 'smoke_test.ts')
if [ "${#tests[@]}" -eq 0 ]; then
  echo "::error::No se encontró ningún test Deno (patrón *_test.ts)."
  exit 1
fi
deno test \
  --sanitize-ops \
  --sanitize-resources \
  --node-modules-dir=none \
  --allow-env \
  --allow-net \
  --allow-read \
  "${tests[@]}"
)
