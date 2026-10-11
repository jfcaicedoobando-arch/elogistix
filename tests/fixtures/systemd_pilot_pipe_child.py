"""Closed local pipe fixture; never imports or executes the native runtime."""
from __future__ import annotations

import argparse
import importlib.abc
import importlib.util
import json
import os
from pathlib import Path
import struct
import sys
import time


class _NoRuntimeImports(importlib.abc.MetaPathFinder):
    def find_spec(self, fullname, path=None, target=None):
        if fullname.split(".", 1)[0] in {
            "systemd_memory_runtime", "physical_cgroup", "payload_distribution"
        }:
            raise AssertionError("Native runtime import forbidden in pipe fixture")
        return None


sys.meta_path.insert(0, _NoRuntimeImports())
_WRAPPER_PATH = (Path(__file__).resolve().parents[2] / "scripts" / "ci"
                 / "invoke-systemd-synthetic-pilot.py")
_SPEC = importlib.util.spec_from_file_location("_own_pipe_fixture_wrapper", _WRAPPER_PATH)
if _SPEC is None or _SPEC.loader is None:
    raise RuntimeError("Own wrapper unavailable")
PILOT = importlib.util.module_from_spec(_SPEC)
sys.modules[_SPEC.name] = PILOT
_SPEC.loader.exec_module(PILOT)

RUN = "a" * 32
CONSTANTS = {"WORK_US": 50_000_000, "CLEANUP_US": 60_000_000,
             "MEMORY_MAX_BYTES": 33_554_432, "TASKS_MAX": 8}
MODES = ("valid", "binary", "exact_evidence", "exit_nonzero", "invalid_evidence",
         "truncated_evidence", "oversized_evidence", "wrong_deadline",
         "duplicate_evidence", "noncanonical_evidence", "no_eof", "hold",
         "backpressure", "ack_missing", "control_probe")
HEADER = struct.Struct("!IQ")
BINARY_STDOUT = b"\r\n\x1a\x00\xff" * 6000
BINARY_STDERR = b"\xff\x00\x1a\n\r" * 6000


def clock_us():
    return time.monotonic_ns() // 1000


def canonical(value):
    return json.dumps(value, ensure_ascii=False, sort_keys=True,
                      separators=(",", ":"), allow_nan=False).encode("utf-8")


def snapshot(deadline_us, *, padding=0):
    now = clock_us()
    return {"retained_record": {"run": RUN, "final": {"status": "COMPLETE"},
                                "samples": [], "faults": [],
                                "fixture_padding": "x" * padding},
            "coordinator_result": {"status": "INCOMPLETE", "claimed_status": "COMPLETE",
                                   "certificate_verified": False},
            "provenance": {"phase": "POST_COORDINATOR_PRE_WATCHDOG_WAIT",
                "run": RUN, "original_store_identity": {"dev": "23", "inode": "456"},
                "captured_before_us": str(now), "captured_after_us": str(now),
                "cleanup_deadline_us": str(deadline_us), "watchdog_wait_pending": True,
                "stored_final_status_matches_coordinator_claim": True,
                "stored_final_status_matches_coordinator_status": False}}


def write_all(fd, data):
    # Small fault-injection frames and alternating stream writes. The parent's
    # real pump drains these pipes; the adapter owns bounded evidence relay.
    offset = 0
    while offset < len(data):
        count = os.write(fd, data[offset:])
        if count <= 0:
            raise RuntimeError("Fixture pipe write did not advance")
        offset += count


def stdout_bytes(count):
    base = b'{"status":"INCOMPLETE","certificate_verified":false}\n'
    if count < len(base):
        return base[:count]
    return base + b" " * (count - len(base))


def emit_streams(stdout, stderr):
    # No helper thread: alternate writes so both channels remain active.
    for offset in range(0, max(len(stdout), len(stderr)), 4096):
        write_all(1, stdout[offset:offset + 4096])
        write_all(2, stderr[offset:offset + 4096])


def decimal(raw):
    if not raw.isascii() or not raw.isdecimal() or raw != str(int(raw)):
        raise argparse.ArgumentTypeError("Canonical nonnegative decimal required")
    return int(raw)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--mode", required=True, choices=MODES)
    parser.add_argument("--evidence-handle", required=True, type=decimal)
    parser.add_argument("--deadline-us", required=True, type=decimal)
    parser.add_argument("--stdout-bytes", type=decimal, default=64)
    parser.add_argument("--stderr-bytes", type=decimal, default=0)
    args = parser.parse_args()
    if not 0 < args.deadline_us < (1 << 64) or any(
            value > 131072 for value in (args.stdout_bytes, args.stderr_bytes)):
        parser.error("Fixture bounds exceeded")

    if os.name == "nt":
        import msvcrt
        for fd in (0, 1, 2):
            msvcrt.setmode(fd, os.O_BINARY)
        evidence_fd = msvcrt.open_osfhandle(args.evidence_handle, os.O_WRONLY | os.O_BINARY)
    else:
        evidence_fd = args.evidence_handle
    control_fd = 0
    consumer = PILOT.V5InvocationConsumer(
        run=RUN, cleanup_deadline_us=args.deadline_us, clock_us=clock_us,
        shared_constants=CONSTANTS)
    binding_calls = 0
    sink_result = None
    started = clock_us()

    def bound_fixture(*, evidence_sink, abort_requested):
        nonlocal binding_calls, sink_result
        binding_calls += 1
        graph = snapshot(args.deadline_us, padding=400000 if args.mode == "backpressure" else 0)
        raw = canonical(graph)
        if args.mode == "exact_evidence":
            graph["retained_record"]["fixture_padding"] = "x" * (PILOT.V5_SNAPSHOT_BYTES - len(raw))
            raw = canonical(graph)
            if len(raw) != PILOT.V5_SNAPSHOT_BYTES:
                raise RuntimeError("Exact-size evidence fixture bound changed")
        if args.mode in {"invalid_evidence", "truncated_evidence", "oversized_evidence",
                         "wrong_deadline", "duplicate_evidence", "noncanonical_evidence"}:
            if args.mode == "invalid_evidence":
                raw = b"{not-json"
                frame = HEADER.pack(len(raw), args.deadline_us) + raw
            elif args.mode == "truncated_evidence":
                frame = HEADER.pack(len(raw), args.deadline_us) + raw[:13]
            elif args.mode == "oversized_evidence":
                frame = HEADER.pack(524289, args.deadline_us)
            elif args.mode == "wrong_deadline":
                frame = HEADER.pack(len(raw), args.deadline_us + 1) + raw
            elif args.mode == "duplicate_evidence":
                frame = (HEADER.pack(len(raw), args.deadline_us) + raw) * 2
            else:
                raw = json.dumps(graph, indent=2).encode("utf-8")
                frame = HEADER.pack(len(raw), args.deadline_us) + raw
            write_all(evidence_fd, frame)
        else:
            sink_result = evidence_sink(graph, deadline_us=args.deadline_us)
            if sink_result is not True:
                return 3
        if args.mode in {"backpressure", "ack_missing", "control_probe"}:
            return 0
        if args.mode == "binary":
            emit_streams(BINARY_STDOUT, BINARY_STDERR)
        else:
            emit_streams(stdout_bytes(args.stdout_bytes), b"e" * args.stderr_bytes)
        if args.mode in {"no_eof", "hold"}:
            # Deliberately leave all output channels open until the parent ends
            # the original budget. Synchronization uses a pipe read, no sleep.
            os.set_blocking(control_fd, True)
            try:
                while True:
                    token = os.read(control_fd, 1)
                    if args.mode != "hold" or not token:
                        break
            finally:
                os.set_blocking(control_fd, False)
            return 3
        return 3 if args.mode == "exit_nonzero" else 0

    try:
        result = PILOT.invoke_bound_with_pipes(
            consumer, bound_fixture, evidence_write_fd=evidence_fd,
            control_read_fd=control_fd)
        if args.mode in {"backpressure", "ack_missing", "control_probe"}:
            # Small diagnostic object fits a pipe buffer even when the harness
            # waits for process exit without draining evidence or spawning readers.
            write_all(1, canonical({"adapter": result, "binding_calls": binding_calls,
                "sink_result": sink_result, "elapsed_us": clock_us() - started,
                "consumer_abort": consumer.abort_requested()}) + b"\n")
        code = result["exit_main"]
        return code if type(code) is int and code in (0, 2, 3) else 3
    finally:
        os.close(evidence_fd)


if __name__ == "__main__":
    raise SystemExit(main())
