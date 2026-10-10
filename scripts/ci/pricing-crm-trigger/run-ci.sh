#!/usr/bin/env bash
# CI-only two-arm test. No production endpoints, secrets, deployment or database options.
set -euo pipefail
umask 077
[[ $# == 0 && "${GITHUB_ACTIONS:-}" == true ]] || { echo 'GitHub Actions only.' >&2; exit 64; }
PLAN="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
ROOT="$(cd "$PLAN/../../.." && pwd -P)"
BUNDLE="$ROOT/scripts/ci/pricing-rpc-bounded"
IMAGE=postgres@sha256:66b6a97eac1771fc78bd201b918b4253859f436c6913aeede97bd5366cce89ae
EVIDENCE="$ROOT/pricing-crm-trigger-evidence"
mkdir "$EVIDENCE"
CONTAINER=''
ARM_DIR=''
cleanup_active() {
  [[ -n "$CONTAINER" ]] || return 0
  local failed=0 disposed=false volumes_disposed=true remaining volume
  docker logs "$CONTAINER" > "$ARM_DIR/container.log" 2>&1 || failed=1
  # Keep the container until evidence is copied, including failed SQL/migration output.
  docker cp "$CONTAINER:/tmp/replay-evidence/." "$ARM_DIR/" 2>"$ARM_DIR/evidence-copy.log" || failed=1
  docker inspect --format '{{json .State.ExitCode}} {{json .State.OOMKilled}} {{json .State.Error}}' "$CONTAINER" > "$ARM_DIR/container-state.txt" || failed=1
  if docker rm --force --volumes "$CONTAINER" > "$ARM_DIR/disposal.log" 2>&1; then
    if remaining=$(docker container ls --all --no-trunc --quiet --filter "id=$CONTAINER") && [[ -z "$remaining" ]]; then disposed=true; fi
  fi
  if [[ -f "$ARM_DIR/anonymous-volumes.txt" ]]; then
    while IFS= read -r volume; do
      [[ -z "$volume" ]] && continue
      if [[ ! "$volume" =~ ^[a-f0-9]{64}$ ]]; then volumes_disposed=false; continue; fi
      if ! remaining=$(docker volume ls --quiet --filter "name=^$volume$") || [[ -n "$remaining" ]]; then volumes_disposed=false; fi
    done < "$ARM_DIR/anonymous-volumes.txt"
  else
    volumes_disposed=false
  fi
  printf 'container_disposed=%s\nanonymous_volumes_disposed=%s\n' "$disposed" "$volumes_disposed" > "$ARM_DIR/disposal-status.txt"
  CONTAINER=''
  [[ "$failed" == 0 && "$disposed" == true && "$volumes_disposed" == true ]]
}
cleanup() {
  code=$?
  trap - EXIT INT TERM
  cleanup_active || code=70
  printf 'exit_code=%s\n' "$code" > "$EVIDENCE/runner-status.txt"
  exit "$code"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
[[ "${GITHUB_SHA:-}" =~ ^[a-f0-9]{40}$ ]] || exit 64
printf '%s\n' "$GITHUB_SHA" > "$EVIDENCE/checkout-commit.txt"
printf '%s\n' "$IMAGE" > "$EVIDENCE/postgres-image.txt"
python3 -B "$PLAN/verify-inputs.py" > "$EVIDENCE/input-verification.json" 2>"$EVIDENCE/input-verification.log"
python3 -B "$PLAN/tests.py" > "$EVIDENCE/static-mocked-tests.log" 2>&1
python3 -B "$PLAN/build-overlay.py" --bundle "$BUNDLE" --output "$EVIDENCE/overlay" > "$EVIDENCE/overlay-build.json" 2>"$EVIDENCE/overlay-build.log"
python3 -B "$PLAN/verify-overlay.py" "$EVIDENCE/overlay" --write-manifest > "$EVIDENCE/overlay-verification.json" 2>"$EVIDENCE/overlay-verification.log"
docker pull "$IMAGE" > "$EVIDENCE/image-pull.log" 2>&1
run_arm() {
  local arm=$1 start_code
  ARM_DIR="$EVIDENCE/$arm"
  mkdir "$ARM_DIR"
  # A distinct owned container and cluster for each arm. Never mount the checkout,
  # Docker socket, credentials, host database directories or external SQL inputs.
  CONTAINER=$(docker create --network none --user postgres --cap-drop ALL \
    --security-opt no-new-privileges --pids-limit 128 --memory 1g --cpus 2 \
    --mount "type=bind,src=$BUNDLE,dst=/bundle,readonly" \
    --mount "type=bind,src=$PLAN,dst=/candidate,readonly" \
    --mount "type=bind,src=$EVIDENCE/overlay,dst=/overlay,readonly" \
    --env PRICING_CRM_ISOLATED_CONTAINER=1 --entrypoint /bin/bash \
    "$IMAGE" /candidate/run-arm.sh "$arm" 2>"$ARM_DIR/container-create.log")
  [[ "$CONTAINER" =~ ^[a-f0-9]{64}$ ]] || exit 70
  printf '%s\n' "$CONTAINER" > "$ARM_DIR/container-id.txt"
  docker inspect --format '{{range .Mounts}}{{if eq .Type "volume"}}{{println .Name}}{{end}}{{end}}' "$CONTAINER" > "$ARM_DIR/anonymous-volumes.txt"
  docker inspect "$CONTAINER" > "$ARM_DIR/container-inspect.json"
  python3 -B "$PLAN/verify-container.py" "$ARM_DIR/container-inspect.json" "$arm" "$BUNDLE" "$PLAN" "$EVIDENCE/overlay" "$CONTAINER" > "$ARM_DIR/isolation.json" 2>"$ARM_DIR/isolation-validation.log"
  if docker start --attach "$CONTAINER" > "$ARM_DIR/start.log" 2>&1; then start_code=0; else start_code=$?; fi
  printf '%s\n' "$start_code" > "$ARM_DIR/docker-start-exit.txt"
  # Disposal must succeed before the next arm is created. SQL validity is checked
  # after collecting both independent arms, so an unexpected baseline stays red.
  cleanup_active || exit 70
}
run_arm baseline
run_arm candidate
python3 -B "$PLAN/verify-evidence.py" "$EVIDENCE" > "$EVIDENCE/assertion-summary.json" 2>"$EVIDENCE/assertion-validation.log"
