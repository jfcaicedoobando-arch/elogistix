#!/usr/bin/env bash
# Check every deployable adapter, including those not imported by unit tests.
set -euo pipefail
export DENO_NO_PACKAGE_JSON=1
readarray -t entrypoints < <(find supabase/functions -mindepth 2 -maxdepth 2 -name index.ts | sort)
if [ "${#entrypoints[@]}" -eq 0 ]; then
  echo 'No deployable Edge entrypoints found.' >&2
  exit 1
fi
printf 'Checking %s Edge entrypoints\n' "${#entrypoints[@]}"
printf '  %s\n' "${entrypoints[@]}"
deno check --node-modules-dir=none "${entrypoints[@]}"
