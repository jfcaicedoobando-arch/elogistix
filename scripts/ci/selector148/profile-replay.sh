#!/usr/bin/env bash
# Sourced after the existing replay safety checks. Metrics never decide SQL status.
# Bash builtins only per phase; EPOCHREALTIME is wall-clock time, not monotonic.
replay_profile_disable() {
  REPLAY_PROFILE_ENABLED=0
  if [[ "${REPLAY_PROFILE_WARNED:-0}" == 0 ]]; then
    REPLAY_PROFILE_WARNED=1
    printf '%s\n' 'WARNING: selector148 replay profiling incomplete; timing data must not be used as a complete measurement.' >&2 || :
  fi
  return 0
}

replay_profile_now() {
  REPLAY_PROFILE_NOW="${EPOCHREALTIME:-}"
  REPLAY_PROFILE_NOW="${REPLAY_PROFILE_NOW/./}"
  if [[ ! "$REPLAY_PROFILE_NOW" =~ ^[0-9]+$ ]]; then replay_profile_disable; fi
  return 0
}

replay_profile_init() {
  REPLAY_PROFILE_ENABLED=1
  REPLAY_PROFILE_WARNED=0
  REPLAY_PROFILE_PHASE=""
  REPLAY_PROFILE_FILE=.selector148-logs/replay-profile.jsonl
  if ! { mkdir -p .selector148-logs && : > "$REPLAY_PROFILE_FILE"; } 2>/dev/null; then
    replay_profile_disable
  fi
  replay_profile_now
  REPLAY_PROFILE_STARTED="$REPLAY_PROFILE_NOW"
  return 0
}

replay_profile_end() {
  local status="$1" elapsed valid=true
  [[ "$REPLAY_PROFILE_ENABLED" == 1 && -n "$REPLAY_PROFILE_PHASE" ]] || return 0
  replay_profile_now
  [[ "$REPLAY_PROFILE_ENABLED" == 1 ]] || return 0
  elapsed=$((REPLAY_PROFILE_NOW - REPLAY_PROFILE_PHASE_STARTED))
  if [[ "$elapsed" -lt 0 ]]; then valid=false; fi
  if ! { printf '{"schema_version":1,"phase":"%s","duration_us":%s,"exit_code":%s,"clock_valid":%s}\n' \
    "$REPLAY_PROFILE_PHASE" "$elapsed" "$status" "$valid" >> "$REPLAY_PROFILE_FILE"; } 2>/dev/null; then
    replay_profile_disable
  fi
  REPLAY_PROFILE_PHASE=""
  return 0
}

replay_profile_begin() {
  [[ "$REPLAY_PROFILE_ENABLED" == 1 ]] || return 0
  replay_profile_end 0
  [[ "$REPLAY_PROFILE_ENABLED" == 1 ]] || return 0
  # Invalid telemetry labels disable telemetry, never the replay operation.
  if [[ ! "$1" =~ ^[a-zA-Z0-9_./-]+$ ]]; then replay_profile_disable; return 0; fi
  replay_profile_now
  REPLAY_PROFILE_PHASE="$1"
  REPLAY_PROFILE_PHASE_STARTED="$REPLAY_PROFILE_NOW"
  return 0
}

replay_profile_finish() {
  local status="$1" elapsed valid=true
  replay_profile_end "$status"
  replay_profile_now
  if [[ "$REPLAY_PROFILE_ENABLED" == 1 ]]; then
    elapsed=$((REPLAY_PROFILE_NOW - REPLAY_PROFILE_STARTED))
    if [[ "$elapsed" -lt 0 ]]; then valid=false; fi
    # A missing complete total row means the JSONL is incomplete, even when
    # earlier phase records were written successfully. The warning is always fixed.
    if ! { printf '{"schema_version":1,"phase":"total","duration_us":%s,"exit_code":%s,"clock_valid":%s,"profiling_complete":true}\n' \
      "$elapsed" "$status" "$valid" >> "$REPLAY_PROFILE_FILE"; } 2>/dev/null; then
      replay_profile_disable
    fi
  fi
  return "$status"
}
