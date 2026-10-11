"""Review validators, V5 consumer and private bounded process capture.

Caller-provided context, bytes, schema profiles and constants are data. Their
consistency never authenticates authorization, custody or measured consumption.
"""
from __future__ import annotations

from collections.abc import Mapping
from dataclasses import dataclass
import hashlib
import json
import re
from types import MappingProxyType
import io
import os
import signal
import stat
import struct
import subprocess
import sys
import time

MAX_DOCUMENT_BYTES = 65536
MAX_JSON_DEPTH = 6
MAX_MANIFEST_FILES = 128
MAX_CAPTURE_BYTES = 65536
MAX_CAPTURE_CHUNK_BYTES = 8192
MAX_CAPTURE_COUNTER = (1 << 64) - 1
AUTHORIZED_MEMORY_BYTES = 256 * 1024 * 1024
AUTHORIZED_TASKS = 32
SERVICE_MEMORY_BYTES = 33_554_432
SERVICE_TASKS = 8
AUXILIARY_MEMORY_BYTES = 160 * 1024 * 1024
AUXILIARY_TASKS = 8
EVIDENCE_ALLOCATION_BYTES = 64 * 1024 * 1024
PADDING_ALLOCATION_BYTES = 39 * 1024 * 1024
CONTROL_MARGIN_BYTES = 57 * 1024 * 1024
KEEPER_LOAD_BYTES = 8 * 1024 * 1024
OVERLAP_TOUCHED_BYTES = 2 * KEEPER_LOAD_BYTES
WORK_US = 50_000_000
CLEANUP_US = 60_000_000
REPOSITORY = "jfcaicedoobando-arch/elogistix"
SCHEMA = "elogistix.systemd-pilot.approved-scope.v2"
AUTHORIZATION_SCOPE_REF = "Sentinel_5d6cf0688f788191ad0503a9a351e1a7"
SCOPE_KEYS = frozenset(("schema", "repository", "source_commit", "yaml_sha256",
                        "branch", "limits", "manifest", "authorization_ref",
                        "scope_ref"))
LIMIT_KEYS = frozenset((
    "vm_count", "runner", "max_services", "max_start_requests",
    "memory_max_bytes_per_service", "tasks_max_per_service",
    "authorized_memory_ceiling_bytes", "authorized_tasks_ceiling",
    "auxiliary_memory_budget_bytes", "auxiliary_tasks_budget",
    "work_duration_us", "cleanup_duration_us", "capture_bytes_per_stream",
    "capture_chunk_bytes",
))
CONTEXT_KEYS = frozenset(("repository", "event_name", "ref_type", "event_ref",
                          "ref", "run_attempt", "workflow_commit", "source_commit"))
SHARED_CONSTANT_KEYS = frozenset(("WORK_US", "CLEANUP_US",
                                  "MEMORY_MAX_BYTES", "TASKS_MAX"))


class PilotValidationError(ValueError):
    def __init__(self, code: str):
        self.code = code
        super().__init__(code)


def _require(condition, code):
    if not condition:
        raise PilotValidationError(code)


def _text(value, *, maximum=1024):
    _require(type(value) is str and bool(value), "TEXT_TYPE_OR_EMPTY")
    try:
        encoded = value.encode("utf-8", "strict")
    except UnicodeError as exc:
        raise PilotValidationError("INVALID_UNICODE") from exc
    _require(len(encoded) <= maximum, "TEXT_BOUND")
    _require(not any(ord(c) < 32 or 127 <= ord(c) <= 159 for c in value),
             "TEXT_CONTROL")
    _require(not value.startswith("PENDING_"), "UNRESOLVED_PLACEHOLDER")
    return value


def _integer(value, *, minimum=0, maximum=MAX_CAPTURE_COUNTER):
    _require(type(value) is int and minimum <= value <= maximum, "INTEGER_BOUND")
    return value


def _closed(value, keys):
    _require(isinstance(value, Mapping) and set(value) == set(keys), "CLOSED_SCHEMA")
    return value


def _hex(value, length):
    _text(value, maximum=length)
    _require(re.fullmatch("[0-9a-f]{%d}" % length, value) is not None, "HEX_SYNTAX")
    _require(value != "0" * length, "ZERO_IDENTIFIER")
    return value


def _path(value):
    _text(value)
    _require(not value.startswith("/") and "\\" not in value and ":" not in value,
             "MANIFEST_PATH")
    _require(all(part not in ("", ".", "..") for part in value.split("/")),
             "MANIFEST_PATH")
    return value


def _branch(value):
    _text(value, maximum=255)
    _require(value != "@" and not value.startswith("/") and not value.endswith("/"),
             "BRANCH_SYNTAX")
    _require(not any(c.isspace() or c in "~^:?*[\\"
                     for c in value) and ".." not in value and "@{" not in value,
             "BRANCH_SYNTAX")
    _require(all(part and not part.startswith(".") and not part.endswith((".", ".lock"))
                 for part in value.split("/")), "BRANCH_SYNTAX")
    return value


def _freeze(value):
    if type(value) is dict:
        return MappingProxyType({k: _freeze(v) for k, v in value.items()})
    if type(value) is list:
        return tuple(_freeze(v) for v in value)
    return value


def parse_strict_json(raw: bytes, max_bytes=MAX_DOCUMENT_BYTES,
                      max_depth=MAX_JSON_DEPTH):
    """Bounded JSON data; duplicate decoded keys and non-integers are rejected."""
    _require(type(raw) is bytes, "BYTES_REQUIRED")
    _integer(max_bytes, minimum=1, maximum=MAX_DOCUMENT_BYTES)
    _integer(max_depth, minimum=1, maximum=MAX_JSON_DEPTH)
    _require(len(raw) <= max_bytes, "JSON_BYTES_BOUND")

    def pairs(items):
        result = {}
        for key, value in items:
            _require(key not in result, "DUPLICATE_JSON_KEY")
            result[key] = value
        return result

    def integer(token):
        _require(len(token.lstrip("-")) <= 20, "JSON_INTEGER_BOUND")
        result = int(token)
        _require(abs(result) <= MAX_CAPTURE_COUNTER, "JSON_INTEGER_BOUND")
        return result

    def noninteger(_):
        raise PilotValidationError("JSON_NONINTEGER")

    try:
        value = json.loads(raw.decode("utf-8", "strict"), object_pairs_hook=pairs,
                           parse_int=integer, parse_float=noninteger,
                           parse_constant=noninteger)
    except (UnicodeError, json.JSONDecodeError, RecursionError, ValueError) as exc:
        if isinstance(exc, PilotValidationError):
            raise
        raise PilotValidationError("INVALID_JSON") from exc
    stack = [(value, 0)]
    while stack:
        item, depth = stack.pop()
        if type(item) in (dict, list):
            _require(depth < max_depth, "JSON_DEPTH_BOUND")
            if type(item) is dict:
                for key in item:
                    try:
                        key.encode("utf-8", "strict")
                    except UnicodeError as exc:
                        raise PilotValidationError("INVALID_UNICODE") from exc
                stack.extend((v, depth + 1) for v in item.values())
            else:
                stack.extend((v, depth + 1) for v in item)
        elif type(item) is str:
            try:
                item.encode("utf-8", "strict")
            except UnicodeError as exc:
                raise PilotValidationError("INVALID_UNICODE") from exc
    return value


@dataclass(frozen=True)
class ParsedScope:
    values: Mapping
    json_bytes: bytes
    approved_scope_sha256: str


def extract_approved_scope(document: bytes) -> ParsedScope:
    """Hash bytes after the opening LF through the LF before the closing fence."""
    _require(type(document) is bytes, "BYTES_REQUIRED")
    _require(len(document) <= MAX_DOCUMENT_BYTES, "DOCUMENT_BYTES_BOUND")
    _require(not document.startswith(b"\xef\xbb\xbf") and b"\r" not in document,
             "DOCUMENT_ENCODING")
    try:
        document.decode("utf-8", "strict")
    except UnicodeError as exc:
        raise PilotValidationError("DOCUMENT_ENCODING") from exc
    opening = b"\x60\x60\x60json approved-scope\n"
    active = None
    found = []
    payload = []
    for line in document.splitlines(keepends=True):
        lookalike = re.match(rb"^[ \t]*[\x60~]{3,}[^\n]*approved-scope", line)
        if lookalike:
            _require(line == opening and active is None, "SCOPE_FENCE_SYNTAX")
            active = (b"\x60", 3, True)
            payload = []
            continue
        fence = re.match(rb"^ {0,3}([\x60]{3,}|~{3,})([^\n]*)\n?$", line)
        if active is not None:
            marker, width, approved = active
            if fence and fence.group(1)[:1] == marker and len(fence.group(1)) >= width and not fence.group(2).strip():
                if approved:
                    _require(line in (b"\x60\x60\x60\n", b"\x60\x60\x60"),
                             "SCOPE_FENCE_SYNTAX")
                    found.append(b"".join(payload))
                active = None
                continue
            if approved:
                payload.append(line)
        elif fence:
            active = (fence.group(1)[:1], len(fence.group(1)), False)
    _require(active is None, "UNCLOSED_FENCE")
    _require(len(found) == 1, "SCOPE_FENCE_COUNT")
    raw = found[0]
    value = parse_strict_json(raw)
    _closed(value, SCOPE_KEYS)
    return ParsedScope(_freeze(value), raw, hashlib.sha256(raw).hexdigest())


def check_budget(limits: Mapping) -> dict:
    """Arithmetic allocation only, not enforcement or a consumption measurement."""
    _closed(limits, LIMIT_KEYS)
    for key in LIMIT_KEYS - {"runner"}:
        _integer(limits[key], minimum=1)
    _require(limits["runner"] == "ubuntu-24.04", "RUNNER")
    exact = {"vm_count": 1, "max_services": 3, "max_start_requests": 3,
             "memory_max_bytes_per_service": SERVICE_MEMORY_BYTES,
             "tasks_max_per_service": SERVICE_TASKS,
             "auxiliary_memory_budget_bytes": AUXILIARY_MEMORY_BYTES,
             "auxiliary_tasks_budget": AUXILIARY_TASKS,
             "authorized_memory_ceiling_bytes": AUTHORIZED_MEMORY_BYTES,
             "authorized_tasks_ceiling": AUTHORIZED_TASKS,
             "work_duration_us": WORK_US, "cleanup_duration_us": CLEANUP_US,
             "capture_bytes_per_stream": MAX_CAPTURE_BYTES,
             "capture_chunk_bytes": MAX_CAPTURE_CHUNK_BYTES}
    _require(all(limits[k] == v for k, v in exact.items()), "SCOPE_MAXIMA")
    memory = 3 * limits["memory_max_bytes_per_service"] + limits["auxiliary_memory_budget_bytes"]
    tasks = 3 * limits["tasks_max_per_service"] + limits["auxiliary_tasks_budget"]
    _require(memory <= AUTHORIZED_MEMORY_BYTES and tasks <= AUTHORIZED_TASKS,
             "AGGREGATE_BUDGET")
    _require(EVIDENCE_ALLOCATION_BYTES + PADDING_ALLOCATION_BYTES
             + CONTROL_MARGIN_BYTES == AUXILIARY_MEMORY_BYTES, "AUXILIARY_ALLOCATION")
    _require(limits["capture_bytes_per_stream"] <= MAX_CAPTURE_BYTES
             and limits["capture_chunk_bytes"] <= MAX_CAPTURE_CHUNK_BYTES,
             "CAPTURE_BUDGET")
    return {"allocated_memory_bytes": memory, "allocated_tasks": tasks,
            "consumption_measured": False, "keeper_profile_verified": False,
            "declared_keeper_load_bytes": KEEPER_LOAD_BYTES,
            "declared_overlap_touched_bytes": OVERLAP_TOUCHED_BYTES}


def validate_shared_constants(limits: Mapping, constants: Mapping) -> None:
    """Consistency with data supplied by reviewed integration; no module imports."""
    _closed(constants, SHARED_CONSTANT_KEYS)
    for value in constants.values():
        _integer(value, minimum=1)
    expected = {"WORK_US": limits["work_duration_us"],
                "CLEANUP_US": limits["cleanup_duration_us"],
                "MEMORY_MAX_BYTES": limits["memory_max_bytes_per_service"],
                "TASKS_MAX": limits["tasks_max_per_service"]}
    _require(dict(constants) == expected, "SHARED_CONSTANT_MISMATCH")


def _profile(keys, required):
    _require(type(keys) is frozenset and required <= keys
             and all(type(k) is str and k for k in keys), "MANIFEST_PROFILE")


def validate_manifest(raw: bytes, expected_sha256: str, source_files: Mapping,
                      *, manifest_keys: frozenset, entry_keys: frozenset) -> dict:
    """Check closed entry consistency against an explicit owner-schema profile.

    The profile is supplied by reviewed integration, never inferred from raw.
    Semantics of additional owner fields and original file custody are pending.
    """
    _profile(manifest_keys, frozenset(("files",)))
    _profile(entry_keys, frozenset(("path", "sha256")))
    _hex(expected_sha256, 64)
    _require(type(raw) is bytes, "BYTES_REQUIRED")
    _require(len(raw) <= MAX_DOCUMENT_BYTES, "JSON_BYTES_BOUND")
    _require(hashlib.sha256(raw).hexdigest() == expected_sha256, "MANIFEST_HASH")
    value = parse_strict_json(raw)
    _closed(value, manifest_keys)
    files = value["files"]
    _require(type(files) is list and 1 <= len(files) <= MAX_MANIFEST_FILES,
             "MANIFEST_FILES_BOUND")
    _require(isinstance(source_files, Mapping), "SOURCE_FILES_MAPPING")
    _require(len(source_files) <= MAX_MANIFEST_FILES, "MANIFEST_FILES_BOUND")
    for path, data in source_files.items():
        _path(path)
        _require(type(data) is bytes, "SOURCE_FILE_BYTES")
    paths = set()
    for item in files:
        _closed(item, entry_keys)
        path = _path(item["path"])
        _require(path not in paths, "DUPLICATE_MANIFEST_PATH")
        paths.add(path)
        expected = _hex(item["sha256"], 64)
        _require(path in source_files, "MISSING_SOURCE_FILE")
        _require(hashlib.sha256(source_files[path]).hexdigest() == expected,
                 "SOURCE_FILE_HASH")
    _require(paths == set(source_files), "SOURCE_FILE_SET")
    return {"manifest_sha256": expected_sha256, "files_verified": len(paths),
            "schema_semantics_verified": False, "custody_authenticated": False}


def validate_scope(parsed: ParsedScope, *, context: Mapping,
                   expected_branch: str, expected_source_commit: str,
                   yaml_bytes: bytes, manifest_bytes: bytes,
                   manifest_path: str, source_files: Mapping, manifest_keys: frozenset,
                   entry_keys: frozenset, shared_constants=None) -> dict:
    _require(type(parsed) is ParsedScope, "PARSED_SCOPE_REQUIRED")
    raw_value = parse_strict_json(parsed.json_bytes)
    _closed(raw_value, SCOPE_KEYS)
    _require(parsed.values == _freeze(raw_value), "PARSED_SCOPE_MUTATION")
    approved_scope_sha256 = hashlib.sha256(parsed.json_bytes).hexdigest()
    _hex(parsed.approved_scope_sha256, 64)
    _require(parsed.approved_scope_sha256 == approved_scope_sha256,
             "APPROVED_SCOPE_SHA256")
    scope = parsed.values
    _require(scope["schema"] == SCHEMA and scope["repository"] == REPOSITORY,
             "SCOPE_IDENTITY")
    _hex(scope["source_commit"], 40)
    _hex(scope["yaml_sha256"], 64)
    _branch(scope["branch"])
    _text(scope["authorization_ref"])
    _require(scope["scope_ref"] == AUTHORIZATION_SCOPE_REF,
             "AUTHORIZATION_SCOPE_REF")
    _closed(scope["manifest"], frozenset(("path", "sha256")))
    _path(scope["manifest"]["path"])
    _require(scope["manifest"]["path"] == _path(manifest_path), "MANIFEST_PATH_CONTEXT")
    _hex(scope["manifest"]["sha256"], 64)
    _closed(context, CONTEXT_KEYS)
    for value in context.values():
        _text(value)
    _hex(context["workflow_commit"], 40)
    _hex(context["source_commit"], 40)
    _hex(expected_source_commit, 40)
    _branch(expected_branch)
    _require(context["repository"] == REPOSITORY and context["event_name"] == "create"
             and context["ref_type"] == "branch" and context["run_attempt"] == "1",
             "EVENT_CONTEXT")
    _require(scope["branch"] == expected_branch == context["event_ref"]
             and context["ref"] == "refs/heads/" + expected_branch, "BRANCH_CONTEXT")
    _require(scope["source_commit"] == expected_source_commit == context["source_commit"]
             and context["workflow_commit"] != context["source_commit"], "SOURCE_CONTEXT")
    _require(type(yaml_bytes) is bytes, "BYTES_REQUIRED")
    _require(len(yaml_bytes) <= MAX_DOCUMENT_BYTES, "YAML_BYTES_BOUND")
    _require(hashlib.sha256(yaml_bytes).hexdigest() == scope["yaml_sha256"], "YAML_HASH")
    budget = check_budget(scope["limits"])
    manifest = validate_manifest(manifest_bytes, scope["manifest"]["sha256"],
                                 source_files, manifest_keys=manifest_keys,
                                 entry_keys=entry_keys)
    if shared_constants is not None:
        validate_shared_constants(scope["limits"], shared_constants)
    return {**budget, **manifest, "scope_ref": scope["scope_ref"],
            "approved_scope_sha256": approved_scope_sha256,
            "workflow_commit": context["workflow_commit"],
            "source_commit": context["source_commit"],
            "shared_constants_consistent": shared_constants is not None,
            "authorization_authenticated": False, "runtime_ready": False,
            "status": "CONSISTENT_DATA_ONLY"}


class CaptureAccumulator:
    """Bounded raw prefix and incremental hash; no pipes, waits, threads or I/O."""
    def __init__(self, limit_bytes=MAX_CAPTURE_BYTES,
                 chunk_bytes=MAX_CAPTURE_CHUNK_BYTES):
        _integer(limit_bytes, minimum=1, maximum=MAX_CAPTURE_BYTES)
        _integer(chunk_bytes, minimum=1, maximum=MAX_CAPTURE_CHUNK_BYTES)
        self.limit_bytes, self.chunk_bytes = limit_bytes, chunk_bytes
        self._prefix = bytearray()
        self._full_hash = hashlib.sha256()
        self._observed = 0
        self._eof = False
        self._error = None
        self._overflow = False

    @property
    def retained(self) -> bytes:
        return bytes(self._prefix)

    def mark_error(self, reason="READ_ERROR"):
        _require(type(reason) is str and re.fullmatch("[A-Z][A-Z0-9_]{0,63}", reason)
                 is not None, "CAPTURE_REASON")
        if self._error is None:
            self._error = reason

    def feed(self, chunk: bytes):
        if type(chunk) is not bytes:
            self.mark_error("BYTES_REQUIRED")
            raise PilotValidationError("BYTES_REQUIRED")
        if self._eof:
            self.mark_error("FEED_AFTER_EOF")
            raise PilotValidationError("FEED_AFTER_EOF")
        if self._error is not None:
            raise PilotValidationError("CAPTURE_ALREADY_FAILED")
        if len(chunk) > self.chunk_bytes:
            self.mark_error("READ_CHUNK_LIMIT")
            raise PilotValidationError("READ_CHUNK_LIMIT")
        if len(chunk) > MAX_CAPTURE_COUNTER - self._observed:
            self.mark_error("CAPTURE_COUNTER_OVERFLOW")
            raise PilotValidationError("CAPTURE_COUNTER_OVERFLOW")
        self._observed += len(chunk)
        self._full_hash.update(chunk)
        room = self.limit_bytes - len(self._prefix)
        self._prefix.extend(chunk[:room])
        self._overflow = self._observed > self.limit_bytes

    def eof(self):
        self._eof = True

    def receipt(self) -> dict:
        if self._error is not None:
            status, reason = "INCOMPLETE", self._error
        elif not self._eof:
            status, reason = "INCOMPLETE", "EOF_NOT_OBSERVED"
        elif self._overflow:
            status, reason = "OVERFLOW", "CAPTURE_LIMIT"
        else:
            status, reason = "COMPLETE", None
        return {"retained_bytes": len(self._prefix), "observed_bytes": self._observed,
                "discarded_observed_bytes": self._observed - len(self._prefix),
                "eof": self._eof, "overflow": self._overflow,
                "sha256_retained": hashlib.sha256(self._prefix).hexdigest(),
                "sha256_full": self._full_hash.hexdigest()
                if self._eof and self._error is None else None,
                "status": status, "reason": reason}


def capture_outcome(stdout: CaptureAccumulator, stderr: CaptureAccumulator,
                    exit_code: int | None) -> str:
    _require(type(stdout) is CaptureAccumulator and type(stderr) is CaptureAccumulator,
             "CAPTURE_ACCUMULATOR")
    _require(exit_code is None or type(exit_code) is int, "EXIT_CODE")
    if any(stream.receipt()["status"] != "COMPLETE" for stream in (stdout, stderr)):
        return "INCOMPLETE"
    if exit_code is None:
        return "INCOMPLETE"
    return "CAPTURE_COMPLETE" if exit_code == 0 else "RUNTIME_FAILED"


# V5 composition delta. The pure validators above retain their reviewed bodies.
# The caller must supply the canonical main/clock from protected reviewed code.
# This object is not a launcher, a certificate verifier or an authority gate.
V5_SNAPSHOT_BYTES = 524288
V5_GRAPH_NODES = 32768
V5_GRAPH_DEPTH = 64
V5_PROVENANCE_KEYS = frozenset((
    "phase", "run", "original_store_identity", "captured_before_us",
    "captured_after_us", "cleanup_deadline_us", "watchdog_wait_pending",
    "stored_final_status_matches_coordinator_claim",
    "stored_final_status_matches_coordinator_status",
))


class V5InvocationConsumer:
    """One invocation, bounded data callbacks, irreversible negative guard.

    No imports, files, subprocesses, sockets, waits or reads are performed here.
    Feed actual pipe reads/EOF through capture_* from the reviewed supervisor.
    Missing physical capture remains INCOMPLETE; main return is not pipe EOF.
    """
    def __init__(self, *, run, cleanup_deadline_us, clock_us, shared_constants):
        self.run = _text(run, maximum=128)
        self.deadline_us = _integer(cleanup_deadline_us, minimum=1)
        _require(callable(clock_us), "CLOCK_REQUIRED")
        validate_shared_constants(
            {"work_duration_us": WORK_US, "cleanup_duration_us": CLEANUP_US,
             "memory_max_bytes_per_service": SERVICE_MEMORY_BYTES,
             "tasks_max_per_service": SERVICE_TASKS}, shared_constants)
        self._clock = clock_us
        self._last_clock = None
        self.stdout, self.stderr = CaptureAccumulator(), CaptureAccumulator()
        self._abort = False
        self._reason = None
        self._invocation_claimed = False
        self._supervised_child_permit = None
        self._invoked = False
        self._bound_main_called = False
        self._sink_called = False
        self._acknowledged = False
        self._evidence_bytes = None
        self._exit_code = None
        self._invocation_error = None

    @property
    def evidence_bytes(self):
        return self._evidence_bytes

    def _fail(self, reason):
        self._abort = True
        if self._reason is None:
            self._reason = reason

    def request_abort(self, reason="SUPERVISOR_ABORT"):
        valid = type(reason) is str and re.fullmatch("[A-Z][A-Z0-9_]{0,63}", reason) is not None
        self._fail(reason if valid else "SUPERVISOR_ABORT")
        return valid

    def _claim_invocation(self, bound_main=None):
        """One reservation across APIs; only the planned child may consume it.

        The private permit exists only in the pid==0 branch, is tied to that
        child's PID and exact local binding, and is discarded before any call.
        _invoked and _process_supervised are observation markers, not locks.
        """
        permit = self._supervised_child_permit
        self._supervised_child_permit = None
        if not self._invocation_claimed:
            self._invocation_claimed = True
            return True
        return (bound_main is not None and type(permit) is tuple and
                len(permit) == 2 and permit[0] == os.getpid() and
                permit[1] is bound_main)

    def _now(self):
        value = self._clock()
        _integer(value)
        _require(self._last_clock is None or value >= self._last_clock, "CLOCK_REGRESSION")
        self._last_clock = value
        _require(value < self.deadline_us, "ORIGINAL_DEADLINE")
        return value

    def abort_requested(self):
        if self._abort:
            return True
        try:
            self._now()
        except Exception:
            self._fail("CLOCK_OR_DEADLINE")
        return self._abort

    def _stream(self, name):
        _require(type(name) is str and name in ("stdout", "stderr"), "STREAM_NAME")
        return self.stdout if name == "stdout" else self.stderr

    def capture_chunk(self, stream, chunk):
        target = None
        try:
            target = self._stream(stream)
            self._now()
            target.feed(chunk)
            if target.receipt()["overflow"]:
                self._fail("CAPTURE_LIMIT")
        except Exception:
            # The accumulator retains the original prefix even when reading fails.
            if target is not None:
                target.mark_error("CAPTURE_READ_OR_DEADLINE")
            self._fail("CAPTURE_READ_OR_DEADLINE")
            return False
        return True

    def capture_eof(self, stream):
        target = None
        try:
            target = self._stream(stream)
            target.eof()  # An explicit caller observation, never main-return inference.
            self._now()
            return True
        except Exception:
            if target is not None:
                target.mark_error("CAPTURE_READ_OR_DEADLINE")
            self._fail("CAPTURE_READ_OR_DEADLINE")
            return False

    def capture_error(self, stream, reason="READ_ERROR"):
        self._fail("CAPTURE_ERROR")
        try:
            self._stream(stream).mark_error(reason)
            return True
        except Exception:
            return False

    def _serialize_snapshot(self, snapshot):
        # Bound the entire graph BEFORE JSONEncoder can sort/encode containers.
        # Builtin-only input prevents caller conversion methods from running.
        stack, seen, nodes, minimum_bytes = [(snapshot, 0)], set(), 0, 0
        while stack:
            self._now()
            item, depth = stack.pop()
            nodes += 1
            _require(nodes <= V5_GRAPH_NODES, "V5_GRAPH_NODES")
            kind = type(item)
            if kind in (dict, list):
                _require(depth < V5_GRAPH_DEPTH and id(item) not in seen,
                         "V5_GRAPH_DEPTH_OR_ALIAS")
                seen.add(id(item))
                _require(len(item) <= V5_GRAPH_NODES - nodes - len(stack),
                         "V5_GRAPH_NODES")
                minimum_bytes += 2 + max(0, len(item) - 1)
                if kind is dict:
                    for key, value in item.items():
                        self._now()
                        _require(type(key) is str and len(key) <= V5_SNAPSHOT_BYTES,
                                 "V5_GRAPH_KEY")
                        minimum_bytes += len(key.encode("utf-8", "strict")) + 3
                        _require(minimum_bytes <= V5_SNAPSHOT_BYTES, "V5_SNAPSHOT_BOUND")
                        stack.append((value, depth + 1))
                else:
                    stack.extend((value, depth + 1) for value in item)
            elif kind is str:
                _require(len(item) <= V5_SNAPSHOT_BYTES, "V5_GRAPH_STRING")
                minimum_bytes += len(item.encode("utf-8", "strict")) + 2
            elif kind is int:
                _require(abs(item) <= MAX_CAPTURE_COUNTER, "V5_GRAPH_INTEGER")
                minimum_bytes += len(str(item))
            elif item is None or kind is bool:
                minimum_bytes += 4
            else:
                raise PilotValidationError("V5_GRAPH_TYPE")
            _require(minimum_bytes <= V5_SNAPSHOT_BYTES, "V5_SNAPSHOT_BOUND")
        output = bytearray()
        encoder = json.JSONEncoder(ensure_ascii=False, sort_keys=True,
                                   separators=(",", ":"), allow_nan=False)
        for text in encoder.iterencode(snapshot):
            self._now()
            part = text.encode("utf-8", "strict")
            _require(len(part) <= V5_SNAPSHOT_BYTES - len(output), "V5_SNAPSHOT_BOUND")
            output.extend(part)
        self._now()
        return bytes(output)

    def _provenance(self, snapshot, deadline_us):
        _require(type(snapshot) is dict and set(snapshot) ==
                 {"retained_record", "coordinator_result", "provenance"}, "V5_SNAPSHOT_SCHEMA")
        _require(type(deadline_us) is int and deadline_us == self.deadline_us,
                 "V5_ORIGINAL_DEADLINE")
        record, provisional, provenance = (snapshot["retained_record"],
            snapshot["coordinator_result"], snapshot["provenance"])
        _require(type(record) is dict and record.get("run") == self.run
                 and type(record.get("final")) is dict and type(provisional) is dict,
                 "V5_RECORD")
        _require(type(provenance) is dict and set(provenance) == V5_PROVENANCE_KEYS,
                 "V5_PROVENANCE_SCHEMA")
        _require(provenance["run"] == self.run and
                 provenance["phase"] == "POST_COORDINATOR_PRE_WATCHDOG_WAIT"
                 and provenance["watchdog_wait_pending"] is True,
                 "V5_PROVENANCE_PHASE")
        identity = provenance["original_store_identity"]
        _require(type(identity) is dict and set(identity) == {"dev", "inode"}, "V5_STORE_IDENTITY")

        def decimal(value, minimum=0):
            _require(type(value) is str and re.fullmatch("0|[1-9][0-9]{0,19}", value)
                     is not None, "V5_DECIMAL")
            return _integer(int(value), minimum=minimum)

        decimal(identity["dev"])
        decimal(identity["inode"], minimum=1)
        before = decimal(provenance["captured_before_us"])
        after = decimal(provenance["captured_after_us"])
        end = decimal(provenance["cleanup_deadline_us"], minimum=1)
        _require(end == self.deadline_us and before <= after <= self._now(),
                 "V5_CAPTURE_BRACKET")
        _require(all(type(provenance[key]) is bool for key in (
            "stored_final_status_matches_coordinator_claim",
            "stored_final_status_matches_coordinator_status")), "V5_STATUS_FLAGS")
        # These flags are metadata only; the central verifier owns graph equality.

    def evidence_sink(self, snapshot, *, deadline_us):
        if self._sink_called:
            self._fail("V5_DUPLICATE_DELIVERY")
            return False
        self._sink_called = True
        try:
            self._now()
            raw = self._serialize_snapshot(snapshot)
            # Preserve the first whole graph even if provenance is inconsistent.
            self._evidence_bytes = raw
            self._provenance(snapshot, deadline_us)
            self._now()
            if self._abort:
                return False
            self._acknowledged = True
            return True
        except Exception:
            self._fail("V5_DELIVERY_UNAVAILABLE")
            return False

    def invoke(self, reviewed_main, *, spec_path, source_elf_path):
        """Fixture/data adapter; production uses invoke_bound without paths.

        No preflight_fn/run_fn override is accepted or passed. Fixtures may supply
        a fake main for nonprivileged tests; that never authorizes native work.
        """
        def bound_main(*, evidence_sink, abort_requested):
            _require(callable(reviewed_main), "V5_MAIN_REQUIRED")
            for value in (spec_path, source_elf_path):
                _text(value)
                _require(value.startswith("/") and "\\" not in value and
                         all(part not in ("", ".", "..") for part in value[1:].split("/")),
                         "V5_ABSOLUTE_PATH")
            return reviewed_main(["run", "--spec", spec_path, "--source-elf", source_elf_path],
                                 evidence_sink=evidence_sink, abort_requested=abort_requested)
        return self.invoke_bound(bound_main)

    def invoke_bound(self, bound_main):
        """Only production entry: no path, argv, factory or run override input.

        The protected launcher owns this fixed callable and its canonical M.main
        binding. It must accept only these two keyword callbacks and call real
        preflight/run once with its own closed argv. This method grants no custody.
        """
        if not self._claim_invocation(bound_main):
            self._fail("V5_REPEATED_INVOCATION")
            return None
        self._invoked = True
        try:
            _require(callable(bound_main), "V5_BOUND_MAIN_REQUIRED")
            if self.abort_requested():
                return None
            self._bound_main_called = True
            code = bound_main(evidence_sink=self.evidence_sink,
                              abort_requested=self.abort_requested)
            _require(type(code) is int and code in (0, 2, 3), "V5_EXIT_CODE")
            self._exit_code = code
            if code != 0:
                self._fail("RUNTIME_FAILED")
            self.abort_requested()
            return code
        except Exception as error:
            self._invocation_error = type(error).__name__
            self._fail("V5_INVOCATION_UNAVAILABLE")
            return None

    def runtime_result(self):
        """Parse only a whole stdout stream; never parse a truncated prefix."""
        if self.stdout.receipt()["status"] != "COMPLETE":
            return None
        try:
            def pairs(items):
                value = {}
                for key, item in items:
                    _require(key not in value, "DUPLICATE_JSON_KEY")
                    value[key] = item
                return value

            def integer(token):
                _require(len(token.lstrip("-")) <= 20, "JSON_INTEGER_BOUND")
                value = int(token)
                _require(abs(value) <= MAX_CAPTURE_COUNTER, "JSON_INTEGER_BOUND")
                return value

            def noninteger(_):
                raise PilotValidationError("JSON_NONINTEGER")

            result = json.loads(self.stdout.retained.decode("utf-8", "strict"),
                object_pairs_hook=pairs, parse_int=integer, parse_float=noninteger,
                parse_constant=noninteger)
            _require(type(result) is dict, "V5_RUNTIME_RESULT")
            self._serialize_snapshot(result)  # Same bounded builtin graph walk; no verifier.
            return result
        except Exception:
            self._fail("RUNTIME_RESULT_UNAVAILABLE")
            return None

    def receipt(self):
        aborted = self.abort_requested()
        captured = capture_outcome(self.stdout, self.stderr, self._exit_code)
        return {"run": self.run, "cleanup_deadline_us": self.deadline_us,
                "invocation_attempted": self._invoked, "exit_code": self._exit_code,
                "bound_main_called": self._bound_main_called,
                "invocation_error": self._invocation_error,
                "stdout": self.stdout.receipt(), "stderr": self.stderr.receipt(),
                "capture_outcome": captured,
                "composition_status": "DATA_OBSERVED_ONLY" if not aborted and
                self._acknowledged and captured == "CAPTURE_COMPLETE" else "INCOMPLETE",
                "evidence_delivery_attempted": self._sink_called,
                "evidence_acknowledged": self._acknowledged,
                "evidence_bytes": len(self._evidence_bytes) if self._evidence_bytes is not None else None,
                "evidence_sha256": hashlib.sha256(self._evidence_bytes).hexdigest()
                if self._evidence_bytes is not None else None,
                "abort_requested": aborted, "first_failure": self._reason,
                "authorization_authenticated": False, "custody_authenticated": False,
                "certificate_verified_by_wrapper": False, "runtime_ready": False}


# V8: private inherited pipes carry DATA and negative authority only. No IPC
# message selects a callable, imports code, supplies argv or grants permission.
PIPE_POLL_SECONDS = 0.001
PIPE_CALLBACK_US = 250_000
PIPE_CLOSE_RESERVE_US = 500_000
PIPE_HEADER = struct.Struct("!IQ")  # canonical-byte length, ORIGINAL deadline
PIPE_ACK = b"K"
PIPE_ABORT = b"X"


def _pipe_fd(fd, *, minimum=0):
    _require(type(fd) is int and fd >= minimum, "PIPE_FD")
    _require(stat.S_ISFIFO(os.fstat(fd).st_mode), "PIPE_REQUIRED")
    os.set_blocking(fd, False)
    return fd


def _decode_pipe_snapshot(raw):
    _require(type(raw) is bytes and 0 < len(raw) <= V5_SNAPSHOT_BYTES,
             "PIPE_SNAPSHOT_BOUND")

    def pairs(items):
        result = {}
        for key, value in items:
            _require(key not in result, "DUPLICATE_JSON_KEY")
            result[key] = value
        return result

    def integer(token):
        _require(len(token.lstrip("-")) <= 20, "JSON_INTEGER_BOUND")
        value = int(token)
        _require(abs(value) <= MAX_CAPTURE_COUNTER, "JSON_INTEGER_BOUND")
        return value

    def reject(_):
        raise PilotValidationError("JSON_NONINTEGER")

    return json.loads(raw.decode("utf-8", "strict"), object_pairs_hook=pairs,
                      parse_int=integer, parse_float=reject, parse_constant=reject)


def invoke_bound_with_pipes(consumer, bound_main, *, evidence_write_fd,
                            control_read_fd):
    """Child-local binding; one invoke_bound, no callable or paths from IPC.

    Caller owns both private pipe endpoints. Close unused ends before main;
    close these ends after return. SIGCHLD and central watchdog remain untouched.
    The local sink ACK means a copy; only remote ACK acknowledges parent delivery.
    All channel waits share a 250ms sub-bound inside the ORIGINAL deadline.
    """
    _require(type(consumer) is V5InvocationConsumer, "V5_CONSUMER_REQUIRED")
    _require(callable(bound_main), "V5_BOUND_MAIN_REQUIRED")
    _require(evidence_write_fd != control_read_fd, "PIPE_DISTINCT")
    remote_ack = False
    error = None
    try:
        _pipe_fd(evidence_write_fd)
        _pipe_fd(control_read_fd)
    except Exception:
        consumer.request_abort("BRIDGE_SETUP")
        return {"exit_main": None, "remote_acknowledged": False,
                "bridge_error": "BRIDGE_SETUP"}

    def fail(reason):
        nonlocal error
        if error is None:
            error = reason
        consumer.request_abort(reason)

    def control(*, awaiting_ack=False):
        nonlocal remote_ack
        try:
            data = os.read(control_read_fd, 3)
        except BlockingIOError:
            return
        except OSError:
            fail("BRIDGE_CONTROL_READ")
            return
        if not data:
            fail("BRIDGE_CONTROL_EOF")
            return
        # A coalesced ACK+ABORT still aborts. Duplicate/unsolicited ACK is invalid.
        for token in data:
            if token == PIPE_ABORT[0]:
                fail("SUPERVISOR_ABORT")
            elif token == PIPE_ACK[0] and awaiting_ack and not remote_ack:
                remote_ack = True
            else:
                fail("BRIDGE_CONTROL_PROTOCOL")

    def relay_abort(local_abort):
        control()
        return True if error is not None else local_abort()

    def relay_sink(local_sink, local_abort, snapshot, *, deadline_us):
        nonlocal remote_ack
        try:
            if relay_abort(local_abort) is not False:
                return False
            if local_sink(snapshot, deadline_us=deadline_us) is not True:
                return False
            raw = consumer.evidence_bytes
            _require(type(raw) is bytes and 0 < len(raw) <= V5_SNAPSHOT_BYTES,
                     "PIPE_SNAPSHOT_BOUND")
            frame = PIPE_HEADER.pack(len(raw), deadline_us) + raw
            offset = 0
            end_us = min(consumer.deadline_us, consumer._now() + PIPE_CALLBACK_US)
            wall_end = time.monotonic_ns() + PIPE_CALLBACK_US * 1000
            while True:
                control(awaiting_ack=(offset == len(frame)))
                if error is not None or local_abort() is not False:
                    return False
                if consumer._now() >= end_us or time.monotonic_ns() >= wall_end:
                    fail("BRIDGE_DELIVERY_TIMEOUT")
                    return False
                if offset < len(frame):
                    try:
                        count = os.write(evidence_write_fd,
                                         frame[offset:offset + MAX_CAPTURE_CHUNK_BYTES])
                        _require(type(count) is int and 0 <= count <=
                                 min(MAX_CAPTURE_CHUNK_BYTES, len(frame) - offset),
                                 "BRIDGE_WRITE_COUNT")
                        offset += count
                    except BlockingIOError:
                        pass
                elif remote_ack:
                    return local_abort() is False
                remaining = min((end_us - consumer._now()) / 1_000_000,
                                (wall_end - time.monotonic_ns()) / 1_000_000_000)
                time.sleep(max(0, min(PIPE_POLL_SECONDS, remaining)))
        except Exception:
            fail("BRIDGE_DELIVERY_ERROR")
            return False

    def channel_bound(*, evidence_sink, abort_requested):
        if relay_abort(abort_requested) is not False:
            return 3
        return bound_main(
            evidence_sink=lambda snapshot, *, deadline_us: relay_sink(
                evidence_sink, abort_requested, snapshot, deadline_us=deadline_us),
            abort_requested=lambda: relay_abort(abort_requested))

    # The reviewed bridge wraps the exact child binding with pipe callbacks.
    # Transfer its local permit only after checking the original PID/binding;
    # invoke_bound then consumes it before calling this specific closure.
    permit = consumer._supervised_child_permit
    if (type(permit) is tuple and len(permit) == 2 and
            permit[0] == os.getpid() and permit[1] is bound_main):
        consumer._supervised_child_permit = (permit[0], channel_bound)
    exit_main = consumer.invoke_bound(channel_bound)
    return {"exit_main": exit_main, "remote_acknowledged": remote_ack,
            "bridge_error": error}


class _ForkChild:
    """Wait only our original child; never waitpid(-1) or the central watchdog."""
    __slots__ = ("_pid", "returncode")

    def __init__(self, pid):
        _require(type(pid) is int and pid > 0, "OWN_CHILD_PID")
        self._pid, self.returncode = pid, None

    @property
    def pid(self):
        return self._pid

    @classmethod
    def allocate_for_fork(cls):
        owned = object.__new__(cls)  # allocation happens BEFORE creating a child
        owned._pid, owned.returncode = 0, None
        return owned

    def poll(self):
        _require(self._pid > 0, "OWN_CHILD_PID_UNBOUND")
        if self.returncode is None:
            pid, status = os.waitpid(self.pid, os.WNOHANG)
            if pid == self.pid:
                self.returncode = os.waitstatus_to_exitcode(status)
        return self.returncode

    def kill(self):
        if self.poll() is None:
            os.kill(self.pid, signal.SIGKILL)


def supervise_bound_process(consumer, *, process, stdout_fd, stderr_fd,
                            evidence_read_fd, control_write_fd,
                            abort_cutoff_us=None, stop_cutoff_us=None):
    """Concurrent bounded pump over an already-created OWNED child and pipes.

    Popen is the nonprivileged fixture seam; _ForkChild is the Linux production
    adapter. No spawning, killing, closing caller FDs, threads or blocking wait.
    poll() reaps the original child on normal exit. A live child at the deadline
    is explicitly incomplete; the production entry handles only that owned PID.
    """
    _require(type(consumer) is V5InvocationConsumer, "V5_CONSUMER_REQUIRED")
    _require(type(process) in (subprocess.Popen, _ForkChild), "OWN_PROCESS_REQUIRED")
    if abort_cutoff_us is not None or stop_cutoff_us is not None:
        _require(type(abort_cutoff_us) is int and type(stop_cutoff_us) is int and
                 0 <= abort_cutoff_us <= stop_cutoff_us < consumer.deadline_us,
                 "EARLIER_SUPERVISOR_CUTOFFS")
    fds = (stdout_fd, stderr_fd, evidence_read_fd, control_write_fd)
    _require(len(set(fds)) == 4, "PIPE_DISTINCT")
    child_exit, reaped, ack_sent, abort_sent = None, False, False, False
    control_error, evidence_eof, evidence_complete = None, False, False
    evidence_failed = False
    delivery_attempted = False
    setup_failed, control_ready = False, False
    buffer = bytearray()
    wire_prefix = bytearray()
    expected = None
    frame_deadline = None
    open_streams = {"stdout": stdout_fd, "stderr": stderr_fd}

    def fail(reason):
        consumer.request_abort(reason)

    def send(token):
        nonlocal control_error
        try:
            _require(control_ready, "CONTROL_NOT_READY")
            _require(os.write(control_write_fd, token) == 1, "CONTROL_WRITE_COUNT")
            return True
        except Exception:
            if control_error is None:
                control_error = "CONTROL_WRITE_ERROR"
            fail("CONTROL_WRITE_ERROR")
            return False

    try:
        _pipe_fd(control_write_fd, minimum=3)
        control_ready = True
        for fd in fds[:3]:
            _pipe_fd(fd, minimum=3)
        if type(process) is subprocess.Popen:
            _require(process.stdout is not None and process.stderr is not None and
                     process.stdout.fileno() == stdout_fd and
                     process.stderr.fileno() == stderr_fd, "PROCESS_PIPE_BINDING")
    except Exception:
        fail("SUPERVISOR_PIPE_SETUP")
        for name in open_streams:
            consumer.capture_error(name, "PIPE_SETUP")
        open_streams.clear()
        evidence_failed = True
        setup_failed = True

    while not setup_failed:
        progressed = False
        aborted = consumer.abort_requested()
        if aborted and not abort_sent and control_error is None:
            abort_sent = send(PIPE_ABORT)
        try:
            now = consumer._now()
            if abort_cutoff_us is not None and now >= abort_cutoff_us:
                fail("SUPERVISOR_CLOSE_RESERVE")
                if not abort_sent and control_error is None:
                    abort_sent = send(PIPE_ABORT)
            if stop_cutoff_us is not None and now >= stop_cutoff_us:
                fail("SUPERVISOR_REAP_RESERVE")
                break
        except Exception:
            fail("SUPERVISOR_DEADLINE_OR_CLOCK")
            # One nonblocking negative signal, no new wait beyond original end.
            if not abort_sent and control_error is None:
                abort_sent = send(PIPE_ABORT)
            break
        for name, fd in tuple(open_streams.items()):
            try:
                data = os.read(fd, MAX_CAPTURE_CHUNK_BYTES)
                if data:
                    progressed = True
                    consumer.capture_chunk(name, data)
                    # True from capture_chunk only means consumed; inspect latch.
                    consumer.abort_requested()
                else:
                    consumer.capture_eof(name)
                    del open_streams[name]
                    progressed = True
            except BlockingIOError:
                if reaped:
                    consumer.capture_error(name, "EOF_NOT_OBSERVED")
                    fail("STREAM_HELD_AFTER_CHILD_EXIT")
            except OSError:
                consumer.capture_error(name, "PIPE_READ_ERROR")
                del open_streams[name]
                progressed = True
        if not evidence_eof:
            try:
                data = os.read(evidence_read_fd, MAX_CAPTURE_CHUNK_BYTES)
                room = PIPE_HEADER.size + V5_SNAPSHOT_BYTES - len(wire_prefix)
                wire_prefix.extend(data[:room])
                if not data:
                    evidence_eof = True
                    progressed = True
                    if not evidence_complete:
                        fail("EVIDENCE_EOF_INCOMPLETE")
                elif evidence_complete:
                    fail("EVIDENCE_TRAILING_BYTES")
                    evidence_failed = True
                elif evidence_failed:
                    progressed = True  # discard bounded chunks; still seek REAL EOF
                else:
                    progressed = True
                    room = PIPE_HEADER.size + V5_SNAPSHOT_BYTES - len(buffer)
                    if len(data) > room:
                        fail("EVIDENCE_FRAME_BOUND")
                        evidence_failed = True
                    else:
                        buffer.extend(data)
                        if expected is None and len(buffer) >= PIPE_HEADER.size:
                            expected, frame_deadline = PIPE_HEADER.unpack_from(buffer)
                            if not 0 < expected <= V5_SNAPSHOT_BYTES or frame_deadline != consumer.deadline_us:
                                fail("EVIDENCE_HEADER")
                                evidence_failed = True
                        if expected is not None and not evidence_failed and len(buffer) >= PIPE_HEADER.size + expected:
                            delivery_attempted = True
                            if len(buffer) != PIPE_HEADER.size + expected:
                                fail("EVIDENCE_TRAILING_BYTES")
                            else:
                                raw = bytes(buffer[PIPE_HEADER.size:])
                                try:
                                    graph = _decode_pipe_snapshot(raw)
                                    evidence_complete = consumer.evidence_sink(
                                        graph, deadline_us=frame_deadline) is True
                                    _require(consumer.evidence_bytes == raw,
                                             "EVIDENCE_NONCANONICAL")
                                    if evidence_complete and not consumer.abort_requested():
                                        ack_sent = send(PIPE_ACK)
                                except Exception:
                                    fail("EVIDENCE_DECODE_OR_DELIVERY")
                            buffer.clear()
                            # Only one graph. Further bytes/second frame abort.
                            if not evidence_complete:
                                fail("EVIDENCE_DELIVERY_FAILED")
                                evidence_failed = True
            except BlockingIOError:
                if reaped:
                    fail("EVIDENCE_HELD_AFTER_CHILD_EXIT")
            except OSError:
                fail("EVIDENCE_READ_ERROR")
                evidence_failed = True
                # FD error is not evidence EOF. Stop attempting this bad FD.
                break
        try:
            child_exit = process.poll()
            reaped = child_exit is not None
            if reaped and child_exit != 0:
                fail("RUNTIME_PROCESS_FAILED")
        except Exception:
            fail("OWN_CHILD_REAP_ERROR")
            break
        if reaped and not open_streams and evidence_eof:
            break
        if not progressed:
            time.sleep(min(PIPE_POLL_SECONDS, max(0, consumer.deadline_us - now) / 1_000_000))

    for name in open_streams:
        if not consumer._stream(name).receipt()["eof"]:
            consumer.capture_error(name, "EOF_NOT_OBSERVED")
    if not evidence_eof:
        fail("EVIDENCE_EOF_NOT_OBSERVED")
    if not reaped:
        fail("OWN_CHILD_NOT_REAPED")
    if not ack_sent:
        fail("REMOTE_EVIDENCE_NOT_ACKNOWLEDGED")
    aborted = consumer.abort_requested()
    if aborted and not abort_sent and control_error is None:
        abort_sent = send(PIPE_ABORT)
    capture = capture_outcome(consumer.stdout, consumer.stderr, child_exit)
    final_receipt = consumer.receipt()
    aborted = final_receipt["abort_requested"]
    return {"process_exit_code": child_exit, "process_reaped": reaped,
            "capture_outcome": capture,
            "supervision_status": "DATA_OBSERVED_ONLY" if not aborted and
            ack_sent and evidence_eof and reaped and capture == "CAPTURE_COMPLETE"
            else "INCOMPLETE", "consumer": final_receipt,
            "remote_ack_sent": ack_sent, "abort_sent": abort_sent,
            "control_error": control_error, "evidence_eof": evidence_eof,
            "evidence_frame_consumed": delivery_attempted,
            "evidence_wire_prefix": bytes(wire_prefix),
            "runtime_ready": False, "certificate_verified": False}


def _close_own_fds(fds):
    closed = True
    for fd in fds:
        try:
            os.close(fd)
        except BaseException:
            closed = False
    return closed


def _kill_and_poll_own(child, consumer, *, stop_us=None, stop_wall_ns=None):
    """Wait only in remaining original budget; return custody if still pending."""
    try:
        child.kill()
        end_us = consumer.deadline_us if stop_us is None else min(stop_us, consumer.deadline_us)
        now = consumer._now()
        wall_end = time.monotonic_ns() + min(PIPE_CALLBACK_US, max(0, end_us - now)) * 1000
        if stop_wall_ns is not None:
            wall_end = min(wall_end, stop_wall_ns)
        while True:
            now = consumer._now()
            if now >= end_us or time.monotonic_ns() >= wall_end:
                # One WNOHANG observation only; no wait outside the sub-bound.
                child.poll()
                return child.returncode is not None, "OWN_CHILD_REAP_CUTOFF"
            reaped = child.poll() is not None
            after = consumer._now()
            if after >= end_us or time.monotonic_ns() >= wall_end:
                return child.returncode is not None, "OWN_CHILD_REAP_CUTOFF"
            if reaped:
                return True, None
            time.sleep(min(PIPE_POLL_SECONDS,
                           (end_us - now) / 1_000_000))
    except BaseException as error:
        return child.returncode is not None, type(error).__name__


def _publish_auxiliary(consumer, *, output_dir_fd, result):
    """Owned writer isolates potentially blocking regular-file I/O.

    Fixed EXCL/NOFOLLOW names, no replace/unlink/glob/fsync or keeper store.
    The parent only polls its writer, under min(original end, 250ms).
    Partial files are preserved on failure; a receipt file is not a certificate.
    """
    summary = {key: value for key, value in result.items()
               if key not in ("evidence_wire_prefix", "pending_owned_children")}
    summary["receipt_phase"] = "PRE_PUBLICATION"
    summary["publication_result_recorded_in_return_only"] = True
    raw_receipt = json.dumps(summary, ensure_ascii=True, sort_keys=True,
                             separators=(",", ":"), allow_nan=False).encode()
    _require(len(raw_receipt) <= MAX_DOCUMENT_BYTES, "PUBLICATION_RECEIPT_BOUND")
    artifacts = {"stdout.bin": consumer.stdout.retained,
                 "stderr.bin": consumer.stderr.retained,
                 "bridge-evidence.bin": result["evidence_wire_prefix"]}
    if consumer.evidence_bytes is not None:
        artifacts["evidence.json"] = consumer.evidence_bytes
    artifacts["receipt.json"] = raw_receipt  # write last, no completeness marker
    start = consumer._now()
    end_us = min(consumer.deadline_us, start + PIPE_CALLBACK_US)
    wall_end = time.monotonic_ns() + PIPE_CALLBACK_US * 1000
    writer = _ForkChild.allocate_for_fork()
    pid = os.fork()
    if pid == 0:
        try:
            _require(_close_own_fds((0, 1, 2)), "PUBLICATION_FD_CLOSE")
            for name, data in artifacts.items():
                fd = os.open(name, os.O_WRONLY | os.O_CREAT | os.O_EXCL |
                             os.O_NOFOLLOW | os.O_CLOEXEC, 0o600,
                             dir_fd=output_dir_fd)
                try:
                    offset = 0
                    while offset < len(data):
                        count = os.write(fd, data[offset:offset + MAX_CAPTURE_CHUNK_BYTES])
                        if count <= 0:
                            raise OSError("No write progress")
                        offset += count
                finally:
                    os.close(fd)
            os._exit(0)
        except BaseException:
            os._exit(3)
    writer._pid = pid  # existing object/slot: no post-fork custody allocation
    status, reaped, error = None, False, None
    while True:
        try:
            now = consumer._now()
            if now >= end_us or time.monotonic_ns() >= wall_end:
                error = "PUBLICATION_SUBDEADLINE"
                break
            status = writer.poll()
            now = consumer._now()
            if now >= end_us or time.monotonic_ns() >= wall_end:
                error = "PUBLICATION_SUBDEADLINE"
                break
            if status is not None:
                reaped = True
                break
            time.sleep(min(PIPE_POLL_SECONDS, (end_us - now) / 1_000_000))
        except BaseException:
            error = "PUBLICATION_DEADLINE_OR_REAP"
            break
    if not reaped:
        reaped, kill_error = _kill_and_poll_own(writer, consumer,
                                              stop_us=end_us, stop_wall_ns=wall_end)
        status = writer.returncode
        if kill_error is not None:
            error = kill_error
    complete = status == 0 and reaped and error is None
    if not complete:
        consumer.request_abort("AUXILIARY_PUBLICATION_FAILED")
    return {"status": "FILES_WRITTEN" if complete else "INCOMPLETE",
            "writer_pid": pid, "writer_reaped": reaped,
            "writer_exit_code": status, "error": error,
            "pending_owned_child": writer if writer.returncode is None else None,
            "durability_guaranteed": False, "custody_authenticated": False}


def _prepare_supervised_entry(consumer, bound_main, output_dir_fd):
    _require(callable(bound_main), "V5_BOUND_MAIN_REQUIRED")
    _require(sys.platform == "linux" and hasattr(os, "fork"), "LINUX_FORK_REQUIRED")
    _require(signal.getsignal(signal.SIGCHLD) == signal.SIG_DFL, "SIGCHLD_DEFAULT_REQUIRED")
    _require(len(os.listdir("/proc/self/task")) == 1, "SINGLE_THREAD_REQUIRED")
    _require(type(output_dir_fd) is int and output_dir_fd >= 3, "AUXILIARY_DIRECTORY_FD")
    info = os.fstat(output_dir_fd)
    _require(stat.S_ISDIR(info.st_mode) and info.st_uid == os.geteuid() and
             info.st_mode & 0o022 == 0, "AUXILIARY_DIRECTORY_MODE")
    _require(consumer.abort_requested() is False, "ORIGINAL_DEADLINE")
    for standard_fd in (0, 1, 2):
        os.fstat(standard_fd)  # require open stdio before allocating private pipes
    stdin_info = os.fstat(0)
    null_info = os.stat("/dev/null", follow_symlinks=False)
    _require(stat.S_ISCHR(stdin_info.st_mode) and stat.S_ISCHR(null_info.st_mode)
             and stdin_info.st_rdev == null_info.st_rdev, "STDIN_DEV_NULL_REQUIRED")
    _require(consumer._now() < consumer.deadline_us - PIPE_CLOSE_RESERVE_US,
             "INSUFFICIENT_ORIGINAL_CLOSE_BUDGET")
    # Fork does not honor CLOEXEC. Require the launcher to close every other FD,
    # including its protected-input readers, before entering this function.
    allowed_fds = {0, 1, 2, output_dir_fd}
    for entry in os.listdir("/proc/self/fd"):
        fd = int(entry)
        try:
            os.fstat(fd)
        except OSError:
            continue  # transient descriptor opened/closed by listdir itself
        _require(fd in allowed_fds, "UNLISTED_INHERITED_FD")


def supervise_bound(consumer, bound_main, *, output_dir_fd):
    """Linux protected entry; fork occurs BEFORE canonical main/preflight.

    SAME protected RunSpec/clock/constant bindings and original deadlines.
    Single thread, SIGCHLD default, closed inherited FD inventory. No runtime,
    socket/pidfd/watchdog preconstruction. Four streaming pipes and one <=256B
    return pipe. Consumer copies use explicit data/ACK/negative-control bridges.
    output_dir_fd is protected auxiliary output, never keeper's store.
    Max own concurrency: launcher + runtime child OR publication child; central
    probe/watchdog and every other auxiliary still count in the 8-task budget.
    """
    _require(type(consumer) is V5InvocationConsumer, "V5_CONSUMER_REQUIRED")
    if not consumer._claim_invocation():
        consumer.request_abort("REPEATED_PROCESS_INVOCATION")
        raise PilotValidationError("REPEATED_PROCESS_INVOCATION")
    consumer._process_supervised = True  # observation; reservation already consumed
    try:
        _prepare_supervised_entry(consumer, bound_main, output_dir_fd)
    except BaseException:
        consumer.request_abort("SUPERVISOR_SETUP_FAILURE")
        raise
    pipes = []
    try:
        child = _ForkChild.allocate_for_fork()
        for _ in range(5):
            pipes.append(os.pipe())
        (out_r, out_w), (err_r, err_w), (evi_r, evi_w), (ctl_r, ctl_w), (ret_r, ret_w) = pipes
        pid = os.fork()
    except BaseException:
        consumer.request_abort("SUPERVISOR_FORK_FAILURE")
        _close_own_fds([fd for pair in pipes for fd in pair])
        raise
    if pid == 0:
        try:
            _require(_close_own_fds((out_r, err_r, evi_r, ctl_w, ret_r, output_dir_fd)), "CHILD_FD_CLOSE")
            delivered = {"exit_main": None, "remote_acknowledged": False,
                         "bridge_error": "CHILD_BINDING_UNAVAILABLE"}
            os.dup2(out_w, 1)
            os.dup2(err_w, 2)
            _require(_close_own_fds((out_w, err_w)), "CHILD_FD_CLOSE")
            sys.stdout = io.TextIOWrapper(io.FileIO(1, "wb", closefd=False),
                                         encoding="utf-8", errors="strict", write_through=True)
            sys.stderr = io.TextIOWrapper(io.FileIO(2, "wb", closefd=False),
                                         encoding="utf-8", errors="strict", write_through=True)
            consumer._supervised_child_permit = (os.getpid(), bound_main)
            try:
                delivered = invoke_bound_with_pipes(consumer, bound_main,
                    evidence_write_fd=evi_w, control_read_fd=ctl_r)
            finally:
                consumer._supervised_child_permit = None
            code = delivered["exit_main"]
            if type(code) is not int or code not in (0, 2, 3):
                code = 3
        except BaseException:
            code = 3
        try:
            # <256B fits Linux PIPE_BUF (>=512). One nonblocking atomic write.
            metadata = json.dumps(delivered, sort_keys=True,
                                  separators=(",", ":")).encode("ascii")
            _require(len(metadata) <= 256, "CHILD_RETURN_BOUND")
            _pipe_fd(ret_w)
            _require(os.write(ret_w, metadata) == len(metadata), "CHILD_RETURN_WRITE")
        except BaseException:
            code = 3
        if not _close_own_fds((evi_w, ctl_r, ret_w)):
            code = 3
        os._exit(code)
    child._pid = pid  # preallocated before fork; custody exists before any close
    fd_cleanup_complete = True
    try:
        fd_cleanup_complete = _close_own_fds((out_w, err_w, evi_w, ctl_r, ret_w))
        if not fd_cleanup_complete:
            consumer.request_abort("PARENT_PIPE_CLOSE_FAILED")
        result = supervise_bound_process(consumer, process=child,
            stdout_fd=out_r, stderr_fd=err_r, evidence_read_fd=evi_r,
            control_write_fd=ctl_w,
            abort_cutoff_us=consumer.deadline_us - PIPE_CLOSE_RESERVE_US,
            stop_cutoff_us=consumer.deadline_us - PIPE_CALLBACK_US)
    except BaseException as failure:
        consumer.request_abort("SUPERVISOR_UNAVAILABLE")
        result = {"process_exit_code": child.returncode,
                  "process_reaped": child.returncode is not None,
                  "capture_outcome": "INCOMPLETE", "supervision_status": "INCOMPLETE",
                  "consumer": consumer.receipt(), "remote_ack_sent": False,
                  "abort_sent": False, "control_error": type(failure).__name__,
                  "evidence_eof": False, "evidence_frame_consumed": False,
                  "evidence_wire_prefix": b"", "runtime_ready": False,
                  "certificate_verified": False}
    finally:
        fd_cleanup_complete = _close_own_fds((out_r, err_r, evi_r, ctl_w)) and fd_cleanup_complete
        if not fd_cleanup_complete:
            consumer.request_abort("PARENT_PIPE_CLOSE_FAILED")
    result["runtime_child_pid"] = pid
    result["exit_main"] = None
    result["child_return"] = None
    try:
        _pipe_fd(ret_r, minimum=3)
        metadata = os.read(ret_r, 257)
        _require(0 < len(metadata) <= 256 and os.read(ret_r, 1) == b"",
                 "CHILD_RETURN_BOUND_OR_EOF")
        decoded = _decode_pipe_snapshot(metadata)
        _require(type(decoded) is dict and set(decoded) ==
                 {"exit_main", "remote_acknowledged", "bridge_error"}, "CHILD_RETURN_SCHEMA")
        code = decoded["exit_main"]
        _require(code is None or type(code) is int and code in (0, 2, 3), "CHILD_MAIN_EXIT")
        _require(type(decoded["remote_acknowledged"]) is bool and
                 (decoded["bridge_error"] is None or
                  type(decoded["bridge_error"]) is str and
                  re.fullmatch("[A-Z][A-Z0-9_]{0,63}", decoded["bridge_error"]) is not None),
                 "CHILD_RETURN_METADATA")
        result["child_return"] = decoded
        result["exit_main"] = code
        if code != result["process_exit_code"] or code != 0 or not decoded["remote_acknowledged"] or decoded["bridge_error"] is not None:
            consumer.request_abort("CHILD_RETURN_INCOMPLETE")
    except BaseException:
        consumer.request_abort("CHILD_RETURN_UNAVAILABLE")
    finally:
        fd_cleanup_complete = _close_own_fds((ret_r,)) and fd_cleanup_complete
        if not fd_cleanup_complete:
            consumer.request_abort("PARENT_PIPE_CLOSE_FAILED")
    result["forced_stop_requested"] = False
    result["forced_stop_reaped"] = False
    result["forced_stop_error"] = None
    result["forced_stop_exit_code"] = None
    pending_children = []
    if not result["process_reaped"]:
        result["forced_stop_requested"] = True
        reaped, error = _kill_and_poll_own(child, consumer)
        result["forced_stop_reaped"] = reaped
        result["forced_stop_error"] = error
        result["forced_stop_exit_code"] = child.returncode
        # A forced stop never converts the earlier failure to completion.
        result["supervision_status"] = "INCOMPLETE"
    result["publication"] = {"status": "INCOMPLETE", "writer_pid": None,
                              "writer_reaped": False, "writer_exit_code": None,
                              "error": "ORIGINAL_DEADLINE_OR_CHILD_NOT_REAPED",
                              "durability_guaranteed": False,
                              "custody_authenticated": False}
    if child.returncode is None:
        pending_children.append(child)
    result["owned_child_reaped"] = child.returncode is not None
    result["fd_cleanup_complete"] = fd_cleanup_complete
    result["local_consumer_receipt_scope"] = "PARENT_CAPTURE_COPY_NO_LOCAL_INVOCATION"
    if result["owned_child_reaped"] and fd_cleanup_complete:
        try:
            result["publication"] = _publish_auxiliary(
                consumer, output_dir_fd=output_dir_fd, result=result)
        except BaseException:
            consumer.request_abort("AUXILIARY_PUBLICATION_UNAVAILABLE")
            result["publication"]["error"] = "AUXILIARY_PUBLICATION_UNAVAILABLE"
    pending_writer = result["publication"].pop("pending_owned_child", None)
    if pending_writer is not None:
        pending_children.append(pending_writer)
    # Live custody objects are local-only, never IPC/JSON/native authorization.
    # Launcher retains each original child object; poll/kill cannot select a PID.
    result["pending_owned_children"] = tuple(pending_children)
    result["pending_owned_child_pids"] = [handle.pid for handle in pending_children]
    result["consumer"] = consumer.receipt()
    if result["publication"]["status"] != "FILES_WRITTEN" or result["consumer"]["abort_requested"]:
        result["supervision_status"] = "INCOMPLETE"
    return result


def main(argv=None) -> int:
    """CLI stays closed; protected launcher integration and Linux review pending."""
    print(json.dumps({"status": "BLOCKED", "pilot_executed": False,
                      "reason": "PROTECTED_LAUNCHER_AND_LINUX_REVIEW_PENDING"},
                     sort_keys=True))
    return 3


if __name__ == "__main__":
    raise SystemExit(main())
