#!/usr/bin/env bash
# CI-only, no production connection options, credentials, or arbitrary SQL inputs.
set -euo pipefail
umask 077
[[ $# == 0 && "${GITHUB_ACTIONS:-}" == true ]] || { echo 'GitHub Actions only.' >&2; exit 64; }
PLAN="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
ROOT="$(cd "$PLAN/../../.." && pwd -P)"
IMAGE=postgres@sha256:66b6a97eac1771fc78bd201b918b4253859f436c6913aeede97bd5366cce89ae
# Explicit allowlisted artifact directory; no source dump or database files.
EVIDENCE="$ROOT/pricing-rpc-evidence"
mkdir "$EVIDENCE"
CONTAINER=''
cleanup() {
  code=$?
  trap - EXIT INT TERM
  disposed=not-created
  if [[ -n "$CONTAINER" ]]; then
    docker logs "$CONTAINER" > "$EVIDENCE/container.log" 2>&1 || true
    # --rm is deliberately absent: collect SQL/server evidence after failure.
    docker cp "$CONTAINER:/tmp/replay-evidence/." "$EVIDENCE/" 2>"$EVIDENCE/evidence-copy.log" || code=70
    docker inspect --format '{{json .State.ExitCode}} {{json .State.OOMKilled}} {{json .State.Error}}' "$CONTAINER" > "$EVIDENCE/container-state.txt" || code=70
    if docker rm --force --volumes "$CONTAINER" > "$EVIDENCE/disposal.log" 2>&1; then
      disposed=true
    else
      disposed=false
      code=70
    fi
  fi
  if [[ "$code" == 0 ]]; then
    python3 "$PLAN/verify-evidence.py" "$EVIDENCE" > "$EVIDENCE/assertion-summary.json" 2>"$EVIDENCE/assertion-validation.log" || code=1
  fi
  printf 'exit_code=%s\ncontainer_disposed=%s\n' "$code" "$disposed" > "$EVIDENCE/runner-status.txt"
  exit "$code"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
python3 "$PLAN/verify-bundle.py" > "$EVIDENCE/bundle-verification.json"
printf '%s\n' "$IMAGE" > "$EVIDENCE/postgres-image.txt"
# Official upstream image already pinned by this repository's rls-tests workflow.
docker pull "$IMAGE" > "$EVIDENCE/image-pull.log" 2>&1
# Only the reviewed bundle is mounted, read-only. No repository checkout, host
# socket, database volume, host networking, secret, or inherited environment.
CONTAINER=$(docker create --network none --user postgres --cap-drop ALL \
  --security-opt no-new-privileges --pids-limit 128 --memory 1g --cpus 2 \
  --mount "type=bind,src=$PLAN,dst=/bundle,readonly" \
  --env PRICING_RPC_ISOLATED_CONTAINER=1 --entrypoint /bin/bash \
  "$IMAGE" /bundle/run.sh)
[[ "$CONTAINER" =~ ^[a-f0-9]{64}$ ]] || exit 70
docker start --attach "$CONTAINER"
