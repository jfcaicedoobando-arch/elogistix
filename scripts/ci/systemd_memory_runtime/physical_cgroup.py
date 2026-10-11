"""Read-only cgroup v2 evidence, Python 3.10+, standard library only.

Public entry points: bind_before_go, observe_limits, observe_census,
observe_memory_peak, observe_closure. No systemd transport or job acceptance.
All observations are interval observations, not atomic kernel snapshots.
Linux deadlines are cooperative: a stuck kernel syscall cannot be cancelled.
Injected filesystems produce simulated evidence, never Linux kernel evidence.
"""
from __future__ import annotations

from contextlib import contextmanager
import ctypes
import errno
import hashlib
import inspect
import json
import os
import re
import stat
import sys
import threading
import time
import uuid
from dataclasses import dataclass, field
from enum import Enum
from typing import Callable, Generic, Protocol, TypeVar

__all__ = [
    "bind_before_go", "observe_limits", "observe_census", "observe_memory_peak",
    "observe_closure", "BoundCgroup", "BindResult", "Observation", "Evidence",
    "Status", "ClosureKind", "Closure", "Limits", "Census", "Peak",
    "ManagerIdentity", "TerminalIdentityObservation", "IdentitySource", "Filesystem", "LinuxFilesystem",
    "NodeIdentity", "MountContext", "CgroupMount", "Budget", "AbsencePolicy",
    "Unbounded",
    "Binding",
]
CGROUP2_SUPER_MAGIC = 0x63677270
_CONSTRUCTION_TOKEN = object()
_TERMINAL_VALIDATED = "authenticated source terminal facts locally correlated; cleanup only"
T = TypeVar("T")


class Status(str, Enum):
    COMPLETE = "COMPLETE"
    INCOMPLETE = "INCOMPLETE"


class ClosureKind(str, Enum):
    PRESENT_EMPTY = "PresentEmpty"
    ORIGINAL_ABSENT = "OriginalAbsent"
    UNAVAILABLE = "Unavailable"


class Unbounded(str, Enum):
    MAX = "max"


@dataclass(frozen=True)
class Budget:
    timeout_ns: int = 1_000_000_000
    max_file_bytes: int = 65_536
    max_total_bytes: int = 4_194_304
    max_steps: int = 512
    max_pids: int = 8192

    def __post_init__(self):
        for value in vars(self).values():
            if type(value) is not int or value <= 0:
                raise ValueError("budget values must be positive integers")


@dataclass(frozen=True)
class ManagerIdentity:
    """Actual transport snapshot; source_ref identifies its external evidence.

    The provider must fetch a fresh snapshot for every call, under deadline_ns.
    Missing D-Bus units, disconnected owners and unknown values must raise.
    This module compares identifiers; it cannot authenticate a dishonest source.
    """
    run_id: str
    slot_id: int
    manager_owner: str
    manager_guid: str
    unit: str
    invocation_id: str
    control_group: str
    control_group_id: int
    unit_binding_ref: str
    source_ref: str

    def key(self):
        return tuple(value for key, value in vars(self).items() if key != "source_ref")


@dataclass(frozen=True)
class TerminalIdentityObservation:
    """Fresh cleanup-only capture around authenticated original execution facts.

    The source must authenticate cleanup_graph with the original backend's
    validate_release_graph BEFORE returning this record. Hashes and flags alone
    do not authenticate it. Mappings retain full facts, not a reconstructed LIVE
    identity. This observer checks consistency; the source owns authentication.
    Times are current monotonic ns, bracketing manager/unit/manager reads.
    """
    kind: str
    original_unit_binding: dict
    current_manager_before: dict
    current_manager_after: dict
    cleanup_graph: dict
    unit_state_read: dict
    started_ns: int
    finished_ns: int
    source_ref: str


class IdentitySource(Protocol):
    def snapshot(self, deadline_ns: int) -> ManagerIdentity: ...
    def closure_snapshot(self, deadline_ns: int) -> ManagerIdentity | TerminalIdentityObservation: ...


@dataclass(frozen=True)
class NodeIdentity:
    device: int
    inode: int
    mount_id: int
    filesystem_magic: int
    nlink: int
    bytes_read: int = field(default=0, compare=False)

    def key(self):
        return self.device, self.inode, self.mount_id, self.filesystem_magic


@dataclass(frozen=True)
class CgroupMount:
    mount_id: int
    parent_id: int
    device: str
    root: str
    mount_point: str
    options: str
    optional_fields: tuple[str, ...]
    source: str
    super_options: str


@dataclass(frozen=True)
class MountContext:
    boot_id: str
    namespace_device: int
    namespace_inode: int
    mounts: tuple[CgroupMount, ...]
    bytes_read: int = field(default=0, compare=False)


class Filesystem(Protocol):
    """Handles originate here; the public API never accepts message-supplied FDs.

    Each directory component must reject symlinks. identity() must use its
    handle, including mount ID and filesystem type. read_at is EOF-bounded.
    context reads boot ID, current-thread mount namespace and mountinfo.
    Backends must honour byte caps and cooperatively check deadline_ns.
    """
    def open_root(self, deadline_ns: int) -> object: ...
    def open_dir_at(self, parent: object, name: str, deadline_ns: int) -> object: ...
    def identity(self, handle: object, deadline_ns: int) -> NodeIdentity: ...
    def read_at(self, handle: object, name: str, cap: int, deadline_ns: int) -> bytes: ...
    def context(self, cap: int, deadline_ns: int) -> MountContext: ...
    def close(self, handle: object) -> None: ...


@dataclass(frozen=True)
class Evidence:
    ref: str
    operation: str
    started_ns: int
    finished_ns: int
    value: object = None
    error: str | None = None
    errno: int | None = None


@dataclass(frozen=True)
class Observation(Generic[T]):
    ref: str
    kind: str
    status: Status
    started_ns: int
    finished_ns: int
    binding_ref: str | None
    origin: str
    value: T | None
    evidence: tuple[Evidence, ...]
    issues: tuple[str, ...]
    references: tuple[str, ...] = ()


@dataclass(frozen=True)
class Limits:
    """Leaf controller values, not effective ancestor limits. None is unknown."""
    memory_max: int | Unbounded | None
    memory_high: int | Unbounded | None
    memory_swap_max: int | Unbounded | None


@dataclass(frozen=True)
class Census:
    populated: int | None
    pids: tuple[int, ...] | None
    events_ref: str | None
    procs_ref: str | None
    scope: str = "cgroup.procs lists direct members; populated covers descendants"


@dataclass(frozen=True)
class Peak:
    bytes: int | None
    reading_ref: str | None
    before: Census | None
    after: Census | None


@dataclass(frozen=True)
class AbsencePolicy:
    """External enforcement evidence, not a caller-provided success boolean.

    Must cover the entire interval, reference this binding, and explicitly
    exclude rename, replacement and process migration. This observer records
    the policy; enforcement and its trust belong to the coordinator.
    """
    policy_id: str
    source_ref: str
    binding_ref: str
    exclusions: frozenset[str]
    valid_from_ns: int
    valid_until_ns: int


@dataclass(frozen=True)
class Closure:
    kind: ClosureKind
    populated: int | None
    events_ref: str | None = None
    policy_ref: str | None = None
    meaning: str = "No conclusion about reap or full memory reclamation"


@dataclass(frozen=True)
class Binding:
    manager: ManagerIdentity
    context: MountContext
    mount: CgroupMount
    leaf: NodeIdentity
    parent: NodeIdentity
    parent_path: str
    leaf_name: str


@dataclass(frozen=True)
class BindResult:
    observation: Observation[Binding]
    observer: BoundCgroup | None


class _Failure(Exception):
    pass


class _IdentityChanged(ValueError):
    pass


class _Session:
    def __init__(self, kind, budget, clock, binding_ref, origin):
        self.started = clock()
        self.ref = uuid.uuid4().hex
        self.kind, self.budget, self.clock = kind, budget, clock
        self.deadline = self.started + budget.timeout_ns
        self.binding_ref, self.origin = binding_ref, origin
        self.records: list[Evidence] = []
        self.issues: list[str] = []
        self.total_bytes = 0

    def call(self, operation, function, *, resource_close=None, metadata_read=False):
        start = self.clock()
        value, error, number = None, None, None
        try:
            if start >= self.deadline:
                raise TimeoutError("cooperative observation deadline exceeded")
            if len(self.records) >= self.budget.max_steps:
                raise _Failure("operation budget exceeded")
            value = function()
            if isinstance(value, bytes):
                size = len(value)
                remaining = max(0, self.budget.max_total_bytes - self.total_bytes)
                value = value[:min(remaining, self.budget.max_file_bytes)]
                self.total_bytes += len(value)
                if size > len(value):
                    raise _Failure("total byte budget exceeded")
            if metadata_read and isinstance(value, NodeIdentity):
                if type(value.bytes_read) is not int or value.bytes_read < 0:
                    raise ValueError("invalid descriptor byte accounting")
                self.total_bytes += value.bytes_read
                if self.total_bytes > self.budget.max_total_bytes:
                    raise _Failure("descriptor read crossed total byte budget")
            if self.clock() >= self.deadline:
                raise TimeoutError("operation returned after deadline")
        except Exception as exc:
            partial = getattr(exc, "partial", None)
            if isinstance(partial, bytes):
                remaining = max(0, self.budget.max_total_bytes - self.total_bytes)
                value = partial[:min(remaining, self.budget.max_file_bytes)]
                self.total_bytes += len(value)
            error = f"{type(exc).__name__}: {str(exc)[:512]}"
            number = getattr(exc, "errno", None)
        recorded_value = "observer-owned handle" if resource_close is not None and value is not None else value
        record = Evidence(f"{self.ref}:{len(self.records)}", operation, start,
                          self.clock(), recorded_value, error, number)
        self.records.append(record)
        if error:
            self.issues.append(f"{record.ref} {operation}: {error}")
            if resource_close is not None and value is not None:
                try:
                    resource_close(value)
                except Exception as exc:
                    self.issues.append(f"late resource cleanup: {type(exc).__name__}")
            raise _Failure(record.ref)
        return value, record.ref

    def cleanup(self, filesystem, handle):
        """Always release owned handles, even after the observation deadline.

        Never retry close on Linux: EINTR can already have released the FD.
        Any ambiguous close is evidence and invalidates the result.
        """
        started, error, number = self.clock(), None, None
        try:
            filesystem.close(handle)
        except Exception as exc:
            error, number = f"{type(exc).__name__}: {str(exc)[:512]}", getattr(exc, "errno", None)
        record = Evidence(f"{self.ref}:{len(self.records)}", "close_internal_handle",
                          started, self.clock(), "observer-owned handle", error, number)
        self.records.append(record)
        if error:
            self.issues.append(f"{record.ref} descriptor close: {error}")

    def require(self, condition, description):
        def check():
            if not condition:
                raise ValueError(description)
            return description
        self.call("validate", check)

    def finish(self, value, references=()):
        finished = self.clock()
        if finished >= self.deadline and not any("deadline" in x for x in self.issues):
            self.issues.append("observation finished after deadline")
        return Observation(self.ref, self.kind,
                           Status.INCOMPLETE if self.issues else Status.COMPLETE,
                           self.started, finished, self.binding_ref, self.origin,
                           value, tuple(self.records), tuple(self.issues), tuple(references))


def _parts(path: str) -> tuple[str, ...]:
    if not isinstance(path, str) or not path.startswith("/") or "\x00" in path:
        raise ValueError("absolute canonical POSIX path required")
    parts = tuple(path[1:].split("/")) if path != "/" else ()
    if len(parts) > 64 or len(path.encode("utf-8")) > 4096:
        raise ValueError("path budget exceeded")
    if any(p in ("", ".", "..") or "\\" in p for p in parts):
        raise ValueError("noncanonical path component")
    return parts


def _validate_manager(value):
    if not isinstance(value, ManagerIdentity):
        raise ValueError("typed manager identity required")
    for name, field in vars(value).items():
        if name in ("slot_id", "control_group_id"):
            continue
        if not isinstance(field, str) or not field or len(field) > 4096 or "\x00" in field:
            raise ValueError("missing or invalid manager identity field")
    if not re.fullmatch(r"[0-9a-f]{32}", value.run_id):
        raise ValueError("run must be lowercase hex32")
    if type(value.slot_id) is not int or value.slot_id not in (0, 1, 2):
        raise ValueError("slot must be 0, 1 or 2")
    if type(value.control_group_id) is not int or not 0 <= value.control_group_id <= (1 << 64) - 1:
        raise ValueError("invalid ControlGroupId; it is not the filesystem inode")
    if not re.fullmatch(r"[0-9a-f]{64}", value.unit_binding_ref):
        raise ValueError("unit_binding_ref must be sha256")
    if not re.fullmatch(r":[0-9]+\.[0-9]+", value.manager_owner):
        raise ValueError("manager owner must be a unique D-Bus name")
    if not re.fullmatch(r"[0-9a-fA-F]{32}", value.manager_guid):
        raise ValueError("invalid D-Bus GUID")
    if not re.fullmatch(r"[0-9a-fA-F]{32}", value.invocation_id):
        raise ValueError("invalid InvocationID")
    if not _parts(value.control_group):
        raise ValueError("the cgroup mount root is not a run leaf")
    return value


def _same_node(actual, expected):
    return isinstance(actual, NodeIdentity) and actual.key() == expected.key()


def _validate_node(value, allow_detached=False):
    if not isinstance(value, NodeIdentity) or value.filesystem_magic != CGROUP2_SUPER_MAGIC:
        raise ValueError("directory is not on cgroup2")
    if type(value.nlink) is int and value.nlink == 0 and not allow_detached:
        raise _IdentityChanged("original directory is detached")
    if any(type(n) is not int or n <= 0 for n in (value.inode, value.mount_id)) or type(value.nlink) is not int or value.nlink < (0 if allow_detached else 1):
        raise ValueError("invalid or detached directory identity")
    if type(value.device) is not int or value.device < 0:
        raise ValueError("invalid device identity")
    return value


def _open_path(fs, path, session):
    """Open each component from /; never follow a directory symlink."""
    parts, _ = session.call("parse_path", lambda: _parts(path))
    handle, _ = session.call("open_root", lambda: fs.open_root(session.deadline), resource_close=fs.close)
    try:
        for component in parts:
            child, _ = session.call("open_component:" + component,
                                    lambda: fs.open_dir_at(handle, component, session.deadline), resource_close=fs.close)
            session.cleanup(fs, handle)
            handle = child
        return handle
    except Exception:
        session.cleanup(fs, handle)
        raise


def _context(fs, session):
    session.require(session.total_bytes < session.budget.max_total_bytes,
                    "total context/controller byte budget exhausted")
    context, ref = session.call("mount_context", lambda: fs.context(
        min(max(1, session.budget.max_total_bytes - session.total_bytes), 1_048_576), session.deadline))
    def validate():
        if not isinstance(context, MountContext):
            raise ValueError("typed mount context required")
        if str(uuid.UUID(context.boot_id)) != context.boot_id:
            raise ValueError("noncanonical boot ID")
        if type(context.namespace_device) is not int or context.namespace_device < 0 or type(context.namespace_inode) is not int or context.namespace_inode <= 0 or not isinstance(context.mounts, tuple) or not context.mounts:
            raise ValueError("unknown mount namespace or cgroup2 mounts")
        seen = set()
        for mount in context.mounts:
            if not isinstance(mount, CgroupMount) or type(mount.mount_id) is not int or mount.mount_id <= 0 or type(mount.parent_id) is not int or mount.parent_id <= 0 or mount.mount_id in seen:
                raise ValueError("invalid or ambiguous cgroup mount identity")
            if not re.fullmatch(r"[0-9]+:[0-9]+", mount.device):
                raise ValueError("invalid mount device")
            _parts(mount.root)
            _parts(mount.mount_point)
            seen.add(mount.mount_id)
        if type(context.bytes_read) is not int or context.bytes_read < 0:
            raise ValueError("invalid mount context byte accounting")
        session.total_bytes += context.bytes_read
        if session.total_bytes > session.budget.max_total_bytes:
            raise ValueError("total context/controller byte budget exceeded")
        return context
    session.call("validate_context", validate)
    return context, ref


def _terminal_digest(value):
    return hashlib.sha256(json.dumps(value, ensure_ascii=False, sort_keys=True,
        separators=(",", ":"), allow_nan=False).encode("utf-8")).hexdigest()


def _terminal_copy(value, session):
    """Detach bounded plain data before retaining it; never invoke copy hooks."""
    if isinstance(value, TerminalIdentityObservation) and type(value) is not TerminalIdentityObservation:
        raise ValueError("derived terminal observations cannot be retained as LIVE or terminal")
    if isinstance(value, ManagerIdentity):
        return value
    if type(value) is not TerminalIdentityObservation:
        raise ValueError("only LIVE ManagerIdentity or exact TerminalIdentityObservation may be retained")
    remaining = session.budget.max_total_bytes - session.total_bytes
    active, nodes, used = set(), 0, 0
    def copy(item, depth=0):
        nonlocal nodes, used
        nodes += 1
        if depth > 16 or nodes > session.budget.max_steps * 64:
            raise ValueError("terminal metadata depth/element budget exceeded")
        kind = type(item)
        if kind is str:
            if len(item) > remaining:
                raise ValueError("terminal metadata byte budget exceeded")
            used += len(json.dumps(item, ensure_ascii=False).encode("utf-8"))
        elif kind is int:
            if not -(1 << 64) <= item <= (1 << 64) - 1:
                raise ValueError("terminal metadata integer budget exceeded")
            used += 21
        elif item is None or kind is bool:
            used += 5
        elif kind in (dict, list, tuple):
            if id(item) in active:
                raise ValueError("cyclic terminal metadata")
            active.add(id(item))
            used += 2 + len(item)
            if used > remaining or len(item) > session.budget.max_steps * 64:
                raise ValueError("terminal metadata byte/element budget exceeded")
            try:
                if kind is dict:
                    if any(type(key) is not str for key in item):
                        raise ValueError("plain terminal mapping string keys required")
                    return {copy(key, depth + 1): copy(val, depth + 1) for key, val in item.items()}
                return [copy(val, depth + 1) for val in item]
            finally:
                active.remove(id(item))
        else:
            raise ValueError("terminal metadata must contain plain mappings and values")
        if used > remaining:
            raise ValueError("terminal metadata byte budget exceeded")
        return item
    try:
        fields = vars(value)
        if set(fields) != set(TerminalIdentityObservation.__dataclass_fields__):
            raise ValueError("closed terminal observation fields required")
        detached = copy(fields)
        encoded = json.dumps(detached, ensure_ascii=False, sort_keys=True,
                             separators=(",", ":"), allow_nan=False).encode("utf-8")
        if len(encoded) > remaining:
            raise ValueError("terminal metadata byte budget exceeded")
        session.total_bytes += len(encoded)
        return TerminalIdentityObservation(**detached)
    except Exception as exc:
        # A rejected capture retains a bounded diagnostic, never a partial record
        # masquerading as a complete graph. Controller budgets remain unchanged.
        source = value.source_ref if type(value.source_ref) is str else None
        exc.partial = json.dumps({"kind": "REJECTED_TERMINAL_CAPTURE",
            "source_ref": source[:4096] if source else None,
            "reason": str(exc)[:512]}, ensure_ascii=True).encode("utf-8")
        raise


def _terminal_closed(value, keys):
    if type(value) is not dict or set(value) != set(keys.split()):
        raise ValueError("missing or unknown terminal record fields")
    return value


def _terminal_u64(value):
    if type(value) is not str or not re.fullmatch(r"(?:0|[1-9][0-9]{0,19})", value) or int(value) > (1 << 64) - 1:
        raise ValueError("strict terminal u64 string required")
    return int(value)


def _terminal_ref(value):
    if type(value) is not str or not re.fullmatch(r"[0-9a-f]{64}", value):
        raise ValueError("terminal sha256 reference required")
    return value


def _terminal_generation(value, boot):
    value = _terminal_closed(value, "pid start_ticks boot_id pid_namespace_ref mount_namespace_ref")
    if type(value["pid"]) is not int or value["pid"] <= 0 or _terminal_u64(value["start_ticks"]) == 0 or value["boot_id"] != boot:
        raise _IdentityChanged("terminal process generation identity changed")
    for key in ("pid_namespace_ref", "mount_namespace_ref"):
        if type(value[key]) is not str or not value[key] or len(value[key]) > 4096:
            raise ValueError("missing original process namespace reference")
    return value


def _terminal_snapshot(value, unit, *, cleared=False):
    value = _terminal_closed(value, "object_path unit service")
    properties, service = value["unit"], value["service"]
    if type(properties) is not dict or type(service) is not dict:
        raise ValueError("full terminal unit/service snapshot required")
    if (value["object_path"] != unit["object_path"] or properties.get("Id") != unit["name"]
            or properties.get("InvocationID") != unit["invocation_id"]
            or properties.get("Transient") is not True or properties.get("DefaultDependencies") is not False):
        raise _IdentityChanged("terminal original unit/invocation identity changed")
    job = properties.get("Job")
    if (properties.get("ActiveState") not in ("inactive", "failed")
            or properties.get("SubState") not in ("dead", "failed")
            or type(job) is not list or len(job) != 2 or type(job[0]) is not int or job != [0, "/"]
            or type(service.get("MainPID")) is not int or service["MainPID"] != 0
            or type(service.get("ControlPID")) is not int or service["ControlPID"] != 0):
        raise ValueError("original terminal snapshot has pending execution")
    group, identifier = service.get("ControlGroup"), service.get("ControlGroupId")
    cleared_pair = group == "" and type(identifier) is int and identifier == 0
    original_pair = group == unit["control_group"] and (
        (type(identifier) is int and identifier == _terminal_u64(unit["control_group_id"]))
        or (type(identifier) is str and identifier == unit["control_group_id"]))
    if not (cleared_pair or (not cleared and original_pair)):
        raise _IdentityChanged("terminal ControlGroup pair changed")


def _validate_terminal(value, expected, boot, start, end, deadline):
    """Local consistency only. Source authenticity is a trusted producer boundary."""
    if type(value) is not TerminalIdentityObservation or value.kind != "SETTLED_ORIGINAL":
        raise ValueError("typed SETTLED_ORIGINAL cleanup observation required")
    if (type(value.started_ns) is not int or type(value.finished_ns) is not int
            or not start <= value.started_ns <= value.finished_ns <= end or value.finished_ns >= deadline):
        raise ValueError("terminal capture is stale or outside call/deadline")
    if type(value.source_ref) is not str or not value.source_ref or len(value.source_ref) > 4096 or "\x00" in value.source_ref:
        raise ValueError("terminal source evidence reference required")
    unit = _terminal_closed(value.original_unit_binding,
        "slot name object_path invocation_id manager_binding_ref control_group control_group_id keeper_generation_ref")
    if (_terminal_digest(unit) != expected.unit_binding_ref or type(unit["slot"]) is not int
            or (unit["slot"], unit["name"], unit["invocation_id"], unit["control_group"],
                _terminal_u64(unit["control_group_id"])) != (expected.slot_id, expected.unit,
                expected.invocation_id, expected.control_group, expected.control_group_id)):
        raise _IdentityChanged("terminal original unit binding identity changed")
    if type(unit["object_path"]) is not str or not re.fullmatch(r"/org/freedesktop/systemd1/unit/[A-Za-z0-9_]+", unit["object_path"]):
        raise ValueError("original D-Bus object path required")
    _terminal_ref(unit["manager_binding_ref"])
    _terminal_ref(unit["keeper_generation_ref"])
    manager = None
    for current in (value.current_manager_before, value.current_manager_after):
        _terminal_closed(current, "boot_id bus_guid owner_unique_name manager_pid_generation authority_lease_until_us")
        if (_terminal_digest(current) != unit["manager_binding_ref"]
                or (current["boot_id"], current["bus_guid"], current["owner_unique_name"]) !=
                    (boot, expected.manager_guid, expected.manager_owner)):
            raise _IdentityChanged("terminal current manager epoch identity changed")
        _terminal_generation(current["manager_pid_generation"], boot)
        if value.finished_ns >= _terminal_u64(current["authority_lease_until_us"]) * 1000:
            raise ValueError("terminal original manager lease expired")
        manager = current
    graph = _terminal_closed(value.cleanup_graph,
        "start_receipt stop_receipt final_unit_receipt keeper_reap_receipt start_settlement_ref stop_settlement_ref final_unit_receipt_ref keeper_reap_receipt_ref activations_settled stop_settled terminal_no_pending_execution keeper_reaped missing_evidence test_boundary")
    if (any(graph[key] is not True for key in ("activations_settled", "stop_settled", "terminal_no_pending_execution", "keeper_reaped"))
            or graph["missing_evidence"] != [] or type(graph["test_boundary"]) is not bool):
        raise ValueError("terminal authenticated execution facts incomplete")
    for record_key, ref_key in (("start_receipt", "start_settlement_ref"),
            ("stop_receipt", "stop_settlement_ref"), ("final_unit_receipt", "final_unit_receipt_ref"),
            ("keeper_reap_receipt", "keeper_reap_receipt_ref")):
        if type(graph[record_key]) is not dict or _terminal_ref(graph[ref_key]) != _terminal_digest(graph[record_key]):
            raise ValueError("terminal full receipt/reference mismatch")
    def stamp(raw):
        timestamp = _terminal_u64(raw)
        if timestamp * 1000 > value.finished_ns or timestamp * 1000 >= deadline:
            raise ValueError("terminal execution receipt outside capture/deadline")
        return timestamp
    for kind in ("start", "stop"):
        receipt = _terminal_closed(graph[kind + "_receipt"], "kind job_ref request_ref event")
        event = _terminal_closed(receipt["event"], "boot_id bus_guid owner_unique_name job_id job_path unit_name result observed_us")
        if (receipt["kind"] != kind or type(event["job_id"]) is not int or event["job_id"] <= 0
                or event["job_path"] != "/org/freedesktop/systemd1/job/" + str(event["job_id"])
                or (event["boot_id"], event["bus_guid"], event["owner_unique_name"], event["unit_name"], event["result"]) !=
                   (boot, expected.manager_guid, expected.manager_owner, expected.unit, "done")
                or type(event["observed_us"]) is not int):
            raise _IdentityChanged("terminal settled job identity changed")
        stamp(str(event["observed_us"]))
        _terminal_ref(receipt["request_ref"])
        job_identity = {"kind": kind, "slot": expected.slot_id, "boot_id": boot,
            "bus_guid": manager["bus_guid"], "owner": manager["owner_unique_name"],
            "job_id": event["job_id"], "job_path": event["job_path"], "unit_name": expected.unit}
        if _terminal_ref(receipt["job_ref"]) != _terminal_digest(job_identity):
            raise _IdentityChanged("terminal settled original job identity changed")
    final = _terminal_closed(graph["final_unit_receipt"], "original_unit_binding_ref manager_binding_ref invocation_id snapshot before_us after_us")
    if (final["original_unit_binding_ref"], final["manager_binding_ref"], final["invocation_id"]) != (
            expected.unit_binding_ref, unit["manager_binding_ref"], expected.invocation_id):
        raise _IdentityChanged("terminal retained snapshot binding identity changed")
    if stamp(final["before_us"]) > stamp(final["after_us"]):
        raise ValueError("terminal retained snapshot time reversed")
    _terminal_snapshot(final["snapshot"], unit)
    keeper = _terminal_closed(graph["keeper_reap_receipt"], "systemd_main_exit pidfd_task_released")
    exit_fact = _terminal_closed(keeper["systemd_main_exit"], "tag original_process_generation invocation_id exec_main_pid exec_main_code exec_main_status start_timestamp_us exit_timestamp_us before_us after_us")
    release = _terminal_closed(keeper["pidfd_task_released"], "tag original_process_generation pidfd_identity_ref procfs_namespace_ref fdinfo_pid retained_original not_closed_or_reused before_us after_us")
    generation = _terminal_generation(exit_fact["original_process_generation"], boot)
    if (_terminal_digest(generation) != unit["keeper_generation_ref"]
            or _terminal_digest(_terminal_generation(release["original_process_generation"], boot)) != _terminal_digest(generation)
            or (exit_fact["tag"], exit_fact["invocation_id"], exit_fact["exec_main_pid"]) !=
                ("SYSTEMD_MAIN_EXIT", expected.invocation_id, generation["pid"])
            or type(exit_fact["exec_main_pid"]) is not int
            or exit_fact["exec_main_code"] not in ("CLD_EXITED", "CLD_KILLED", "CLD_DUMPED")
            or type(exit_fact["exec_main_status"]) is not int
            or not (0 <= exit_fact["exec_main_status"] <= 255 if exit_fact["exec_main_code"] == "CLD_EXITED"
                    else 1 <= exit_fact["exec_main_status"] <= 64)
            or release["tag"] != "PIDFD_TASK_RELEASED" or type(release["fdinfo_pid"]) is not int
            or release["fdinfo_pid"] != -1 or release["retained_original"] is not True
            or release["not_closed_or_reused"] is not True
            or release["procfs_namespace_ref"] != generation["pid_namespace_ref"]):
        raise _IdentityChanged("terminal original keeper generation/release identity changed")
    if type(release["pidfd_identity_ref"]) is not str or not re.fullmatch(r"[a-z][a-z0-9_-]*:[A-Za-z0-9_.:\[\]-]{1,160}", release["pidfd_identity_ref"]):
        raise ValueError("retained original pidfd evidence required")
    for fact in (exit_fact, release):
        if stamp(fact["before_us"]) > stamp(fact["after_us"]):
            raise ValueError("terminal keeper fact time reversed")
    if not (0 < stamp(exit_fact["start_timestamp_us"]) <= stamp(exit_fact["exit_timestamp_us"]) <= stamp(exit_fact["after_us"])
            and stamp(exit_fact["exit_timestamp_us"]) <= stamp(release["after_us"])):
        raise ValueError("terminal original exit/release time contradiction")
    current = value.unit_state_read
    if type(current) is not dict:
        raise ValueError("current terminal unit read required")
    if current.get("kind") == "NO_SUCH_UNIT":
        _terminal_closed(current, "kind error_name object_path")
        if (current["error_name"], current["object_path"]) != ("org.freedesktop.systemd1.NoSuchUnit", unit["object_path"]):
            raise ValueError("exact current NoSuchUnit read required")
    elif current.get("kind") == "TERMINAL_CLEARED":
        _terminal_closed(current, "kind snapshot")
        _terminal_snapshot(current["snapshot"], unit, cleared=True)
    else:
        raise ValueError("unknown current terminal unit state")
    return _TERMINAL_VALIDATED


def _closure_snapshot(source, deadline):
    missing = object()
    supplied = inspect.getattr_static(source, "closure_snapshot", missing)
    if supplied is missing:
        # Compatibility only for a statically absent cleanup method. A failing
        # property or dynamic lookup is an unavailable supplied source, not LIVE.
        if any("__getattr__" in vars(cls) or (cls is not object and "__getattribute__" in vars(cls))
               for cls in type(source).__mro__):
            raise ValueError("dynamic cleanup identity source is unavailable")
        method = source.snapshot
    else:
        method = source.closure_snapshot
    if not callable(method):
        raise ValueError("closure_snapshot must be callable when supplied")
    return method(deadline)


def _manager(source, expected, session, *, allow_terminal=False, boot=None):
    call_start = session.clock() if allow_terminal else None
    # Legacy LIVE-only sources may omit closure_snapshot. A failed terminal
    # capture is never replaced by snapshot() or cached ManagerIdentity.
    actual, ref = session.call("closure_identity" if allow_terminal else "manager_identity",
        lambda: _terminal_copy(_closure_snapshot(source, session.deadline) if allow_terminal
                               else source.snapshot(session.deadline), session))
    call_end = session.clock() if allow_terminal else None
    if type(actual) is TerminalIdentityObservation and allow_terminal:
        session.call("validate_terminal_identity", lambda: _validate_terminal(
            actual, expected, boot, call_start, call_end, session.deadline))
        def retain_lease_cutoff():
            session.deadline = min(session.deadline,
                _terminal_u64(actual.current_manager_before["authority_lease_until_us"]) * 1000)
            return session.deadline
        session.call("terminal_original_lease_cutoff", retain_lease_cutoff)
    else:
        session.call("validate_manager", lambda: _validate_manager(actual))
        session.require(actual.key() == expected.key(), "manager/run/slot identity changed")
    return actual, ref


def _number(data, allow_max=False):
    if allow_max and data in (b"max", b"max\n"):
        return Unbounded.MAX
    if not re.fullmatch(rb"(?:0|[1-9][0-9]{0,19})\n?", data):
        raise ValueError("expected strict unsigned decimal")
    value = int(data)
    if value > (1 << 64) - 1:
        raise ValueError("unsigned integer overflow")
    return value


def _events(data):
    values = {}
    lines = data.split(b"\n")
    if lines[-1] == b"":
        lines.pop()
    for line in lines:
        if not re.fullmatch(rb"[a-z][a-z0-9_]* (?:0|[1-9][0-9]{0,19})", line):
            raise ValueError("malformed cgroup.events")
        key, number = line.split(b" ")
        if key in values:
            raise ValueError("duplicate cgroup.events key")
        values[key] = _number(number)
    if b"populated" not in values or values[b"populated"] not in (0, 1):
        raise ValueError("missing/invalid populated")
    if b"frozen" in values and values[b"frozen"] not in (0, 1):
        raise ValueError("invalid frozen")
    return values[b"populated"]


def _pids(data, cap):
    if not data:
        return ()
    lines = data.split(b"\n")
    if lines[-1] == b"":
        lines.pop()
    if len(lines) > cap:
        raise ValueError("PID census budget exceeded")
    pids = tuple(_number(line) for line in lines)
    if any(pid == 0 or pid > 2_147_483_647 for pid in pids):
        raise ValueError("invalid PID")
    # Kernel cgroup.procs may show a PID twice if it moves during iteration.
    # Preserve order and duplicates as physical evidence, not a set assertion.
    return pids


class BoundCgroup:
    """Owns original descriptors. Single-process, serialized observation API."""
    def __init__(self, fs, source, binding, leaf, parent, bind_ref, clock, budget, origin, *, _token=None):
        if _token is not _CONSTRUCTION_TOKEN:
            raise TypeError("BoundCgroup is constructed internally by bind_before_go; transported handles are forbidden")
        self._fs, self._source, self._binding = fs, source, binding
        self._leaf, self._parent = leaf, parent
        self._bind_ref, self._clock, self._budget, self._origin = bind_ref, clock, budget, origin
        self._closed, self._pid = False, os.getpid()
        self._invalid_ref = None
        self._name_absent_ref = None
        self._terminal_ref = None
        self._lock = threading.Lock()

    @property
    def binding_ref(self):
        return self._bind_ref

    @property
    def binding(self):
        return self._binding

    def close(self):
        session = self._session("close", None)
        with self._lock_scope(session) as acquired:
            if acquired and not self._closed:
                session.cleanup(self._fs, self._leaf)
                session.cleanup(self._fs, self._parent)
                self._closed = True
        return session.finish(None)

    def __enter__(self):
        return self

    def __exit__(self, *args):
        self.close()

    def _session(self, kind, budget):
        return _Session(kind, budget or self._budget, self._clock, self._bind_ref, self._origin)

    @contextmanager
    def _lock_scope(self, session):
        """Use the entry-time deadline for both lock waiting and observation."""
        acquired = False
        def acquire():
            nonlocal acquired
            remaining_ns = session.deadline - self._clock()
            if remaining_ns <= 0:
                raise TimeoutError("observation deadline elapsed before lock acquisition")
            acquired = self._lock.acquire(timeout=min(remaining_ns / 1_000_000_000,
                                                       threading.TIMEOUT_MAX))
            if not acquired:
                raise TimeoutError("observation deadline elapsed waiting for observer lock")
            return "observer lock acquired"
        try:
            try:
                session.call("acquire_observer_lock", acquire)
            except _Failure:
                yield False
            else:
                yield True
        finally:
            if acquired:
                # Releasing an acquired lock must run even after timeout. The
                # final interval includes this release, without resetting T0.
                started, error = self._clock(), None
                try:
                    self._lock.release()
                except Exception as exc:
                    error = f"{type(exc).__name__}: {str(exc)[:512]}"
                    session.issues.append(f"observer lock release: {error}")
                session.records.append(Evidence(f"{session.ref}:{len(session.records)}",
                    "release_observer_lock", started, self._clock(), "observer lock released", error))

    def _verify(self, session, allow_absent=False):
        session.require(self._invalid_ref is None,
                        f"identity invalidation is sticky: {self._invalid_ref}")
        try:
            return self._verify_impl(session, allow_absent)
        except _Failure:
            if allow_absent and any(record.operation == "validate_terminal_identity" and record.value == _TERMINAL_VALIDATED
                                    for record in session.records):
                # A valid terminal capture makes cleanup irreversible even if
                # its lease or a subsequent physical read becomes unavailable.
                self._terminal_ref = session.ref
            parent_path_changed = any(record.operation.startswith("open_component:")
                and record.errno in (errno.ENOENT, errno.ENOTDIR, errno.ELOOP)
                for record in session.records)
            if parent_path_changed or any(word in issue for issue in session.issues for word in
                   ("identity changed", "context changed", "parent changed", "path changed",
                    "handle changed", "substitute", "mount namespace changed", "_IdentityChanged")):
                self._invalid_ref = session.ref
            raise

    def _verify_impl(self, session, allow_absent=False):
        session.require(not self._closed and os.getpid() == self._pid,
                        "observer is closed or inherited across fork")
        session.require(allow_absent or self._terminal_ref is None,
                        "terminal identity is irreversible and cleanup-only")
        identity, identity_ref = _manager(self._source, self._binding.manager, session,
            allow_terminal=allow_absent, boot=self._binding.context.boot_id)
        if type(identity) is TerminalIdentityObservation:
            self._terminal_ref = identity_ref
        elif self._terminal_ref is not None:
            def reject_live():
                raise _IdentityChanged("LIVE identity returned after terminal cleanup phase")
            session.call("validate_terminal_phase", reject_live)
        context, _ = _context(self._fs, session)
        session.require(context == self._binding.context, "boot/mount namespace/mount context changed")
        parent_id, _ = session.call("retained_parent_identity", lambda: self._fs.identity(
            self._parent, session.deadline), metadata_read=True)
        session.call("validate_retained_parent", lambda: _validate_node(parent_id))
        session.require(_same_node(parent_id, self._binding.parent) and parent_id.nlink > 0,
                        "retained parent changed or disappeared")
        # Reopening only proves the retained parent still occupies its original
        # path. Ephemeral descriptors are never adopted as original handles.
        anchor = _open_path(self._fs, self._binding.parent_path, session)
        try:
            anchor_id, _ = session.call("parent_path_identity", lambda: self._fs.identity(
                anchor, session.deadline), metadata_read=True)
            session.call("validate_parent_path", lambda: _validate_node(anchor_id))
            session.require(_same_node(anchor_id, self._binding.parent) and anchor_id.nlink > 0,
                            "original parent path changed")
        finally:
            session.cleanup(self._fs, anchor)
        leaf_id, _ = session.call("retained_leaf_identity", lambda: self._fs.identity(
            self._leaf, session.deadline), metadata_read=True)
        session.call("validate_retained_leaf", lambda: _validate_node(leaf_id, True))
        session.require(_same_node(leaf_id, self._binding.leaf), "original leaf handle changed")
        try:
            named, _ = session.call("lookup_exact_leaf", lambda: self._fs.open_dir_at(
                self._parent, self._binding.leaf_name, session.deadline), resource_close=self._fs.close)
        except _Failure:
            last = session.records[-1]
            if last.operation == "lookup_exact_leaf" and last.errno == errno.ENOENT:
                if self._name_absent_ref is None:
                    self._name_absent_ref = last.ref
                lookup_issue_index = len(session.issues) - 1
                # Missing a name can mean rename. Only the retained original
                # object can independently show that it is actually unlinked.
                # Re-read AFTER ENOENT to retain evidence of that distinction.
                detached, _ = session.call("retained_leaf_after_enoent_identity",
                    lambda: self._fs.identity(self._leaf, session.deadline), metadata_read=True)
                def validate_detached():
                    _validate_node(detached, True)
                    if not _same_node(detached, self._binding.leaf):
                        raise _IdentityChanged("retained original leaf changed after name disappearance")
                    if detached.nlink != 0:
                        raise _IdentityChanged("original leaf name absent but retained object is still linked")
                    return "original retained leaf is detached"
                session.call("validate_original_detached", validate_detached)
                if allow_absent:
                    # Preserve the exact ENOENT record, removing only its
                    # expected issue after physical detachment was verified.
                    del session.issues[lookup_issue_index]
                    return "absent", last.ref
            raise
        try:
            def reject_reappearance():
                if self._name_absent_ref is not None:
                    raise _IdentityChanged("original leaf name reappeared after observed absence: "
                                           + self._name_absent_ref)
                return "original leaf name continuity retained"
            session.call("validate_name_continuity", reject_reappearance)
            named_id, ref = session.call("named_leaf_identity", lambda: self._fs.identity(
                named, session.deadline), metadata_read=True)
            session.call("validate_named_leaf", lambda: _validate_node(named_id))
            session.require(_same_node(named_id, self._binding.leaf) and named_id.nlink > 0,
                            "original leaf name now identifies a substitute")
            return "present", ref
        finally:
            session.cleanup(self._fs, named)

    def _read(self, name, parser, session):
        session.require(session.total_bytes < session.budget.max_total_bytes,
                        "total controller byte budget exhausted")
        cap = min(session.budget.max_file_bytes,
                  session.budget.max_total_bytes - session.total_bytes)
        data, ref = session.call("read:" + name, lambda: self._fs.read_at(
            self._leaf, name, cap, session.deadline))
        session.require(isinstance(data, bytes) and len(data) <= session.budget.max_file_bytes,
                        "backend returned an invalid or oversized reading")
        value, _ = session.call("parse:" + name, lambda: parser(data))
        return value, ref

    def _census(self, session):
        populated, events_ref = None, None
        pids, procs_ref = None, None
        for name in ("cgroup.events", "cgroup.procs"):
            try:
                if name == "cgroup.events":
                    populated, events_ref = self._read(name, _events, session)
                else:
                    pids, procs_ref = self._read(name, lambda data: _pids(data, session.budget.max_pids), session)
            except _Failure:
                pass
        return Census(populated, pids, events_ref, procs_ref)


def bind_before_go(expected: ManagerIdentity, identity_source: IdentitySource, *,
                   filesystem: Filesystem | None = None, mount_point: str = "/sys/fs/cgroup",
                   clock: Callable[[], int] = time.monotonic_ns, budget: Budget = Budget()) -> BindResult:
    """Acquire internal leaf/parent descriptors and bracket all identity checks.

    COMPLETE means identity was bound, not permission to GO. The coordinator
    must check limits, census, provenance, jobs and its own lifecycle contract.
    Unsupported cgroup mount roots fail closed; no guessed namespace mapping.
    """
    fs = filesystem if filesystem is not None else LinuxFilesystem()
    origin = "linux-kernel" if type(fs) is LinuxFilesystem else "injected-filesystem"
    session = _Session("bind_before_go", budget, clock, None, origin)
    parent, leaf, binding = None, None, None
    try:
        session.call("validate_expected", lambda: _validate_manager(expected))
        _manager(identity_source, expected, session)
        context, _ = _context(fs, session)
        session.call("validate_mount_path", lambda: _parts(mount_point))
        mounts = [m for m in context.mounts if m.mount_point == mount_point]
        session.require(len(mounts) == 1, "missing or ambiguous cgroup2 mount")
        mount = mounts[0]
        session.require(mount.root == "/", "non-root cgroup mount requires explicit transport mapping")
        components = _parts(expected.control_group)
        parent_path = mount_point.rstrip("/") + "/" + "/".join(components[:-1])
        parent_path = parent_path.rstrip("/") or "/"
        parent = _open_path(fs, parent_path, session)
        parent_id, _ = session.call("bind_parent_identity", lambda: fs.identity(parent, session.deadline), metadata_read=True)
        session.call("validate_parent", lambda: _validate_node(parent_id))
        session.require(parent_id.mount_id == mount.mount_id, "parent mount ID differs from mountinfo")
        leaf, _ = session.call("bind_exact_leaf", lambda: fs.open_dir_at(parent, components[-1], session.deadline), resource_close=fs.close)
        leaf_id, _ = session.call("bind_leaf_identity", lambda: fs.identity(leaf, session.deadline), metadata_read=True)
        session.call("validate_leaf", lambda: _validate_node(leaf_id))
        session.require(leaf_id.mount_id == mount.mount_id and leaf_id.device == parent_id.device,
                        "leaf crosses the bound mount")
        binding = Binding(expected, context, mount, leaf_id, parent_id, parent_path, components[-1])
        observer = BoundCgroup(fs, identity_source, binding, leaf, parent, session.ref, clock, budget, origin,
                               _token=_CONSTRUCTION_TOKEN)
        observer._verify(session)
        observation = session.finish(binding)
        if observation.status is Status.COMPLETE:
            return BindResult(observation, observer)
    except _Failure:
        pass
    finally:
        # Ownership transfers only with a COMPLETE result.
        if "observation" not in locals() or observation.status is not Status.COMPLETE:
            for handle in (leaf, parent):
                if handle is not None:
                    session.cleanup(fs, handle)
    return BindResult(session.finish(binding), None)


def observe_limits(observer: BoundCgroup, *, budget: Budget | None = None) -> Observation[Limits]:
    session, values = observer._session("limits", budget), [None, None, None]
    with observer._lock_scope(session) as acquired:
        if acquired:
            try:
                observer._verify(session)
                for index, name in enumerate(("memory.max", "memory.high", "memory.swap.max")):
                    try:
                        values[index], _ = observer._read(name, lambda data: _number(data, True), session)
                    except _Failure:
                        pass
            except _Failure:
                pass
            try:
                observer._verify(session)
            except _Failure:
                pass
    return session.finish(Limits(*values))


def observe_census(observer: BoundCgroup, *, budget: Budget | None = None) -> Observation[Census]:
    session, census = observer._session("census", budget), Census(None, None, None, None)
    with observer._lock_scope(session) as acquired:
        if acquired:
            try:
                observer._verify(session)
                census = observer._census(session)
            except _Failure:
                pass
            try:
                observer._verify(session)
            except _Failure:
                pass
    return session.finish(census)


def observe_memory_peak(observer: BoundCgroup, *, budget: Budget | None = None) -> Observation[Peak]:
    session = observer._session("memory_peak", budget)
    before = after = None
    value = reading_ref = None
    with observer._lock_scope(session) as acquired:
        if acquired:
            try:
                observer._verify(session)
                before = observer._census(session)
                try:
                    value, reading_ref = observer._read("memory.peak", _number, session)
                except _Failure:
                    pass
                after = observer._census(session)
            except _Failure:
                pass
            try:
                observer._verify(session)
            except _Failure:
                pass
    # Known raw readings survive even if post-validation failed.
    return session.finish(Peak(value, reading_ref, before, after))


def observe_closure(observer: BoundCgroup, *, policy: AbsencePolicy | None = None,
                    budget: Budget | None = None) -> Observation[Closure]:
    session = observer._session("closure", budget)
    result = Closure(ClosureKind.UNAVAILABLE, None)
    references = []
    with observer._lock_scope(session) as acquired:
        try:
            session.require(acquired, "observer lock unavailable within original deadline")
            before, before_ref = observer._verify(session, allow_absent=True)
            references.append(before_ref)
            if before == "present":
                populated, events_ref = observer._read("cgroup.events", _events, session)
                result = Closure(ClosureKind.UNAVAILABLE, None, events_ref)
                after, after_ref = observer._verify(session, allow_absent=True)
                references.append(after_ref)
                session.require(after == "present", "leaf disappeared during populated reading")
                session.require(populated == 0, "original cgroup is still populated")
                result = Closure(ClosureKind.PRESENT_EMPTY, populated, events_ref,
                                 meaning="No live processes in original cgroup at the direct populated reading; no reap/reclamation claim")
            else:
                def validate_policy():
                    if not isinstance(policy, AbsencePolicy):
                        raise ValueError("explicit external absence policy required")
                    if not isinstance(policy.policy_id, str) or not policy.policy_id or not isinstance(policy.source_ref, str) or not policy.source_ref:
                        raise ValueError("absence policy lacks evidence")
                    if policy.binding_ref != observer.binding_ref:
                        raise ValueError("absence policy refers to another binding")
                    if not isinstance(policy.exclusions, frozenset) or not {"rename", "replacement", "migration"} <= policy.exclusions:
                        raise ValueError("absence policy must exclude rename/replacement/migration")
                    if type(policy.valid_from_ns) is not int or type(policy.valid_until_ns) is not int or policy.valid_from_ns < 0:
                        raise ValueError("invalid absence policy times")
                    return policy
                session.call("absence_policy", validate_policy)
                after, after_ref = observer._verify(session, allow_absent=True)
                references.extend((after_ref, policy.source_ref))
                session.require(after == "absent", "leaf name reappeared during absence observation")
                session.require(policy.valid_from_ns <= session.started
                                and observer._clock() < policy.valid_until_ns,
                                "absence policy does not cover the observation interval")
                result = Closure(ClosureKind.ORIGINAL_ABSENT, None, policy_ref=policy.source_ref,
                                 meaning="Original leaf absent under recorded external policy: no live processes there; no reap/reclamation claim")
        except _Failure:
            pass
    observation = session.finish(result, references)
    if result.kind is ClosureKind.ORIGINAL_ABSENT and observation.finished_ns >= policy.valid_until_ns:
        session.issues.append("absence policy expired before the observation finished")
        result = Closure(ClosureKind.UNAVAILABLE, None, policy_ref=policy.source_ref)
        observation = session.finish(result, references)
    if observation.status is Status.INCOMPLETE and result.kind is not ClosureKind.UNAVAILABLE:
        result = Closure(ClosureKind.UNAVAILABLE, None, result.events_ref, result.policy_ref)
        observation = Observation(observation.ref, observation.kind, observation.status,
            observation.started_ns, observation.finished_ns, observation.binding_ref,
            observation.origin, result, observation.evidence, observation.issues, observation.references)
    return observation


class LinuxFilesystem:
    """Unprivileged Linux implementation. Every controller read is openat-based.

    Only read flags, no writes/reset of memory.peak. /proc/thread-self keeps
    mount evidence tied to the thread doing the observation. All file contents
    are capped, but blocking syscalls can only be detected after they return.
    """
    @staticmethod
    def _deadline(deadline):
        if time.monotonic_ns() >= deadline:
            raise TimeoutError("filesystem deadline exceeded")

    @staticmethod
    def _linux():
        if not sys.platform.startswith("linux"):
            raise OSError(errno.ENOSYS, "Linux backend unavailable; inject a filesystem for hermetic tests")

    def open_root(self, deadline_ns):
        self._linux()
        self._deadline(deadline_ns)
        return os.open("/", os.O_RDONLY | os.O_DIRECTORY | os.O_CLOEXEC | os.O_NOFOLLOW)

    def open_dir_at(self, parent, name, deadline_ns):
        self._linux()
        self._deadline(deadline_ns)
        if not name or name in (".", "..") or "/" in name or "\x00" in name:
            raise ValueError("one directory component required")
        return os.open(name, os.O_RDONLY | os.O_DIRECTORY | os.O_CLOEXEC | os.O_NOFOLLOW,
                       dir_fd=parent)

    def _read_fd(self, fd, cap, deadline):
        data = bytearray()
        while True:
            try:
                self._deadline(deadline)
            except TimeoutError as exc:
                raise _ReadError(errno.ETIMEDOUT, "filesystem deadline exceeded", bytes(data)) from exc
            chunk = os.read(fd, min(4096, cap + 1 - len(data)))
            try:
                self._deadline(deadline)
            except TimeoutError as exc:
                raise _ReadError(errno.ETIMEDOUT, "filesystem returned after deadline", bytes(data) + chunk) from exc
            if not chunk:
                return bytes(data)
            data.extend(chunk)
            if len(data) > cap:
                raise _ReadError(errno.EFBIG, "bounded read exceeded byte cap", bytes(data[:cap]))

    def _proc_read(self, path, cap, deadline):
        self._deadline(deadline)
        fd = os.open(path, os.O_RDONLY | os.O_CLOEXEC | os.O_NOFOLLOW | os.O_NONBLOCK)
        try:
            return self._read_fd(fd, cap, deadline)
        finally:
            os.close(fd)

    def identity(self, handle, deadline_ns):
        self._linux()
        self._deadline(deadline_ns)
        node = os.fstat(handle)
        if not stat.S_ISDIR(node.st_mode):
            raise ValueError("retained handle is not a directory")
        fdinfo = self._proc_read(f"/proc/thread-self/fdinfo/{handle}", 8192, deadline_ns)
        mount_ids = re.findall(rb"^mnt_id:\s*([0-9]+)$", fdinfo, re.MULTILINE)
        if len(mount_ids) != 1:
            raise ValueError("missing or ambiguous descriptor mount ID")
        # f_type is the first native long on Linux 32/64 bit. An oversized
        # aligned buffer avoids dependence on the remainder of struct statfs.
        buf = (ctypes.c_long * 64)()
        libc = ctypes.CDLL(None, use_errno=True)
        fstatfs = libc.fstatfs
        fstatfs.argtypes, fstatfs.restype = [ctypes.c_int, ctypes.c_void_p], ctypes.c_int
        if fstatfs(handle, ctypes.byref(buf)) != 0:
            number = ctypes.get_errno()
            raise OSError(number, os.strerror(number))
        self._deadline(deadline_ns)
        return NodeIdentity(node.st_dev, node.st_ino, int(mount_ids[0]), buf[0], node.st_nlink, len(fdinfo))

    def read_at(self, handle, name, cap, deadline_ns):
        self._linux()
        self._deadline(deadline_ns)
        if not re.fullmatch(r"[a-z][a-z0-9_.]*", name):
            raise ValueError("one controller filename required")
        fd = os.open(name, os.O_RDONLY | os.O_CLOEXEC | os.O_NOFOLLOW | os.O_NONBLOCK, dir_fd=handle)
        try:
            if not stat.S_ISREG(os.fstat(fd).st_mode):
                raise ValueError("controller is not a regular file")
            return self._read_fd(fd, cap, deadline_ns)
        finally:
            os.close(fd)

    @staticmethod
    def _unescape(value):
        if "\\" in re.sub(r"\\(?:040|011|012|134)", "", value):
            raise ValueError("invalid mountinfo escape")
        def replace(match):
            if match.group() not in (r"\040", r"\011", r"\012", r"\134"):
                raise ValueError("invalid mountinfo escape")
            return chr(int(match.group()[1:], 8))
        value = re.sub(r"\\[0-7]{3}", replace, value)
        if "\x00" in value:
            raise ValueError("NUL in mountinfo")
        return value

    @classmethod
    def _mounts(cls, data):
        mounts = []
        seen = set()
        for line in data.decode("utf-8", "strict").splitlines():
            left, separator, right = line.partition(" - ")
            fields, after = left.split(" "), right.split(" ")
            if not separator or len(fields) < 6 or len(after) != 3:
                raise ValueError("malformed mountinfo")
            mid, parent = _number(fields[0].encode("ascii")), _number(fields[1].encode("ascii"))
            if mid <= 0 or parent <= 0 or mid in seen or not re.fullmatch(r"[0-9]+:[0-9]+", fields[2]):
                raise ValueError("invalid mountinfo identity")
            seen.add(mid)
            if after[0] == "cgroup2":
                mounts.append(CgroupMount(mid, parent, fields[2], cls._unescape(fields[3]),
                    cls._unescape(fields[4]), fields[5], tuple(fields[6:]),
                    cls._unescape(after[1]), after[2]))
        return tuple(mounts)

    def context(self, cap, deadline_ns):
        self._linux()
        boot_bytes = self._proc_read("/proc/sys/kernel/random/boot_id", 128, deadline_ns)
        boot = boot_bytes.decode("ascii").strip()
        # This specific proc symlink must be followed to open the namespace.
        self._deadline(deadline_ns)
        ns = os.open("/proc/thread-self/ns/mnt", os.O_RDONLY | os.O_CLOEXEC)
        try:
            before = os.fstat(ns)
            mount_bytes = self._proc_read("/proc/thread-self/mountinfo", cap, deadline_ns)
            mounts = self._mounts(mount_bytes)
            current = os.stat("/proc/thread-self/ns/mnt")
            if (before.st_dev, before.st_ino) != (current.st_dev, current.st_ino):
                raise ValueError("mount namespace changed during context read")
            return MountContext(boot, before.st_dev, before.st_ino, mounts, len(boot_bytes) + len(mount_bytes))
        finally:
            os.close(ns)

    def close(self, handle):
        os.close(handle)


class _ReadError(OSError):
    def __init__(self, number, message, partial):
        super().__init__(number, message)
        self.partial = partial

# Candidate V3 adapter. The approved standalone core above is unchanged.
import dataclasses as _dc
import importlib as _importlib
import hashlib as _hashlib
import json as _json
from collections.abc import Mapping as _Mapping


def _runtime_contracts():
    return _importlib.import_module((__package__ + ".contracts") if __package__ else "contracts")


class AdapterError(RuntimeError):
    """Incomplete adapter operation. evidence_ref names a retained local record."""
    def __init__(self, code, detail, evidence_ref=None):
        self.code, self.evidence_ref = code, evidence_ref
        super().__init__(f"{code}: {detail}")


@dataclass(frozen=True)
class KeeperObservation:
    """Fresh local process identity supplied by the authenticated native producer.

    The producer checks its original retained process generation/procfs/pidfd.
    This adapter compares the record; census alone cannot establish generation.
    """
    generation: object
    started_ns: int
    finished_ns: int
    source_ref: str


@dataclass(frozen=True)
class PhysicalProducer:
    """Nonserialized local dependencies; the factory is pure composition.

    Callables use absolute CLOCK_MONOTONIC nanoseconds and must fail on unknown.
    manager_binding returns a fresh contracts.ManagerBinding/mapping.
    identity_source(unit_mapping, deadline_ns) returns the core IdentitySource.
    keeper_observation(generation_mapping, deadline_ns) returns KeeperObservation.
    absence_policy(binding_ref, original Binding, deadline_ns) returns the existing
    core AbsencePolicy or None. Its enforcement/authenticity remain external.
    No received FD, successful boolean, job settlement or reaper authority is used.
    """
    manager_binding: Callable
    identity_source: Callable
    keeper_observation: Callable
    absence_policy: Callable | None = None
    filesystem: Filesystem = field(default_factory=LinuxFilesystem)
    clock: Callable[[], int] = time.monotonic_ns
    budget: Budget = Budget()
    mount_point: str = "/sys/fs/cgroup"


def _adapter_plain(value):
    """Lossless local evidence representation, separate from closed wire records."""
    if isinstance(value, Enum):
        return value.value
    if value is None or type(value) in (str, bool):
        return value
    if type(value) is int:
        return str(value)
    if isinstance(value, bytes):
        return {"bytes_hex": value.hex()}
    if callable(getattr(value, "to_mapping", None)):
        return value.to_mapping()
    if _dc.is_dataclass(value):
        return {f.name: _adapter_plain(getattr(value, f.name)) for f in _dc.fields(value)}
    if isinstance(value, _Mapping):
        if not all(isinstance(k, str) for k in value):
            raise ValueError("evidence keys must be strings")
        return {k: _adapter_plain(v) for k, v in value.items()}
    if isinstance(value, (tuple, list)):
        return [_adapter_plain(v) for v in value]
    if isinstance(value, frozenset):
        return sorted(_adapter_plain(v) for v in value)
    raise ValueError("nonfactual object in local evidence")


class _AdapterGate:
    def __init__(self, clock, deadline_ns, started_ns):
        self.clock, self.deadline, self.started = clock, deadline_ns, started_ns
        self.last = started_ns

    def now(self):
        value = self.clock()
        if type(value) is not int or value < self.last:
            raise AdapterError("DEADLINE", "invalid or regressing monotonic clock")
        self.last = value
        if value >= self.deadline:
            raise AdapterError("DEADLINE", "original absolute deadline expired")
        return value

    def call(self, function, *args):
        self.now()
        result = function(*args)
        try:
            self.now()
        except AdapterError as error:
            if (_dc.is_dataclass(result) or isinstance(result, (_Mapping, bytes, str))
                    or result is None or type(result) in (int, bool)):
                error.partial_fact = result
            raise
        return result


class _DeadlineFilesystem:
    """Cap every native/injected call at the unchanged absolute adapter cutoff."""
    def __init__(self, filesystem, gate):
        self.original, self.gate = filesystem, gate

    def open_root(self, deadline_ns):
        return self._open(self.original.open_root, min(deadline_ns, self.gate.deadline))

    def _open(self, function, *args):
        self.gate.now()
        handle = function(*args)
        try:
            self.gate.now()
        except Exception as late_error:
            # A descriptor acquired late remains our resource; always close it.
            try:
                self.original.close(handle)
            except Exception as close_error:
                error = AdapterError(getattr(late_error, "code", "DEADLINE"),
                    str(late_error) + "; late owned handle close outcome unknown: " +
                    type(close_error).__name__ + ": " + str(close_error)[:512])
                error.partial_fact = {"kind": "LATE_OWNED_HANDLE_CLOSE",
                    "deadline_error": str(late_error), "close_error": str(close_error),
                    "close_errno": getattr(close_error, "errno", None),
                    "close_attempted": True, "close_outcome": "UNKNOWN"}
                raise error from close_error
            raise
        return handle

    def open_dir_at(self, parent, name, deadline_ns):
        return self._open(self.original.open_dir_at, parent, name,
                          min(deadline_ns, self.gate.deadline))

    def identity(self, handle, deadline_ns):
        self.gate.now()
        return self.original.identity(handle, min(deadline_ns, self.gate.deadline))

    def read_at(self, handle, name, cap, deadline_ns):
        self.gate.now()
        return self.original.read_at(handle, name, cap, min(deadline_ns, self.gate.deadline))

    def context(self, cap, deadline_ns):
        self.gate.now()
        return self.original.context(cap, min(deadline_ns, self.gate.deadline))

    def close(self, handle):
        self.original.close(handle)


class _DeadlineSource:
    def __init__(self, source, gate):
        self.original, self.gate = source, gate

    def snapshot(self, deadline_ns):
        self.gate.now()
        return self.original.snapshot(min(deadline_ns, self.gate.deadline))

    def closure_snapshot(self, deadline_ns):
        self.gate.now()
        return _closure_snapshot(self.original, min(deadline_ns, self.gate.deadline))


# Capture our actual implementations, rather than trusting a caller's native flag.
_PROVENANCE_LINUX_TYPE = LinuxFilesystem
_PROVENANCE_DEADLINE_TYPE = _DeadlineFilesystem
_PROVENANCE_METHODS = {
    cls: tuple((name, value, getattr(getattr(value, "__func__", value), "__code__", None))
               for name, value in vars(cls).items()
               if callable(value) or isinstance(value, (staticmethod, classmethod)))
    for cls in (_PROVENANCE_LINUX_TYPE, _PROVENANCE_DEADLINE_TYPE)
}
_PROVENANCE_CLASS_LAYOUT = {
    cls: (frozenset(vars(cls)), cls.__bases__) for cls in _PROVENANCE_METHODS
}


def _filesystem_provenance(filesystem):
    """Describe the actual filesystem code path, never native test certification.

    Only our unchanged exact deadline wrapper is transparent. Subclasses, unknown
    proxies, overridden methods and cycles remain injected. IdentitySource,
    keeper/manager providers and clocks are external and are not relabeled here.
    Inspecting a LinuxFilesystem instance does not execute a Linux syscall.
    """
    current, seen = filesystem, set()
    for _ in range(16):
        cls = type(current)
        if cls not in _PROVENANCE_METHODS or id(current) in seen:
            return "injected-filesystem"
        if (frozenset(vars(cls)), cls.__bases__) != _PROVENANCE_CLASS_LAYOUT[cls]:
            return "injected-filesystem"
        seen.add(id(current))
        methods = _PROVENANCE_METHODS[cls]
        if any(name in vars(current) or vars(cls).get(name) is not implementation
               or getattr(getattr(implementation, "__func__", implementation), "__code__", None) is not code
               for name, implementation, code in methods):
            return "injected-filesystem"
        if cls is _PROVENANCE_LINUX_TYPE:
            return "linux-kernel"
        current = vars(current).get("original")
    return "injected-filesystem"


@dataclass
class _RuntimeLeaf:
    observer: BoundCgroup
    source: IdentitySource
    unit: object
    keeper: object
    physical: object
    proof: object


class RuntimePhysicalObserver:
    """Candidate local V3 adapter over the immutable standalone core.

    producer_factory(spec) must return PhysicalProducer. None never creates a
    native fallback: preflight fails DEPENDENCY_MISSING without filesystem I/O.
    A future native factory must supply actual manager/process/policy producers.
    Injected filesystems always mark this adapter fixture_only/test_boundary.
    Full records are retained locally; hashes correlate them, never authenticate.
    Local raw observations may exceed wire shape bounds and are never IPC packets.
    Storage is capped at 512 records / 64 MiB; new I/O stops before exhaustion.
    """
    MAX_RECORDS = 512
    MAX_EVIDENCE_BYTES = 64 * 1024 * 1024

    def __init__(self, spec, *, producer_factory=None):
        self._c = _runtime_contracts()
        self.spec = spec if isinstance(spec, self._c.RunSpec) else self._c.RunSpec.from_mapping(spec)
        self._factory = producer_factory
        self._producer = None
        self._clock = time.monotonic_ns
        self._pid = os.getpid()
        self._lock = threading.Lock()
        self._manager = None
        self._root = self._root_context = self._root_node = None
        self._root_bad = self._closed = False
        self._leaves, self._closures, self._records = {}, {}, {}
        self._evidence_bytes = 0
        self._last_ns = None
        # Conservative until the actual local producer has been established.
        self.fixture_only = self.test_boundary = True

    @staticmethod
    def _mapping(value):
        if callable(getattr(value, "to_mapping", None)):
            return value.to_mapping()
        if isinstance(value, _Mapping):
            # Keep native ints/bools and reject objects/floats via canonical encoding.
            return _json.loads(_json.dumps(dict(value), allow_nan=False))
        raise AdapterError("PROTOCOL", "full typed record or mapping required")

    def _put(self, value, *, raw=False):
        record = _adapter_plain(value) if raw else self._mapping(value)
        payload = _json.dumps(record, ensure_ascii=False, sort_keys=True,
                              separators=(",", ":"), allow_nan=False).encode("utf-8")
        ref = _hashlib.sha256(payload).hexdigest()
        if ref not in self._records:
            if (len(self._records) >= self.MAX_RECORDS or
                    self._evidence_bytes + len(payload) > self.MAX_EVIDENCE_BYTES):
                raise AdapterError("DEPENDENCY_UNAVAILABLE", "local evidence capacity exhausted")
            self._records[ref] = payload
            self._evidence_bytes += len(payload)
        return ref

    def _failure(self, error):
        # Small record preserves the exception while previously observed facts remain.
        record = {"kind": "ADAPTER_INCOMPLETE", "run": self.spec.run,
                  "code": getattr(error, "code", "PHYSICAL_UNAVAILABLE"),
                  "detail": str(error)[:1024],
                  "cause_ref": getattr(error, "evidence_ref", None)}
        try:
            if hasattr(error, "partial_fact"):
                record["partial_fact_ref"] = self._put(error.partial_fact, raw=True)
            ref = self._put(record)
        except AdapterError:
            ref = None
        return AdapterError(record["code"], record["detail"], ref)

    def _compose(self):
        if self._producer is not None:
            return
        if not callable(self._factory):
            raise AdapterError("DEPENDENCY_MISSING", "local PhysicalProducer factory required")
        producer = self._factory(self.spec)
        if not isinstance(producer, PhysicalProducer):
            raise AdapterError("DEPENDENCY_UNAVAILABLE", "factory must return PhysicalProducer")
        if not all(callable(v) for v in (producer.manager_binding, producer.identity_source,
                                        producer.keeper_observation, producer.clock)):
            raise AdapterError("DEPENDENCY_MISSING", "native identity dependencies missing")
        if not isinstance(producer.budget, Budget):
            raise AdapterError("PROTOCOL", "typed core Budget required")
        _parts(producer.mount_point)
        self._producer, self._clock = producer, producer.clock
        self.fixture_only = self.test_boundary = (
            _filesystem_provenance(producer.filesystem) != "linux-kernel")

    @contextmanager
    def _operation(self, deadline_us=None, *, work=False, allow_invalid=False):
        acquired = False
        try:
            if self._closed or os.getpid() != self._pid or (self._root_bad and not allow_invalid):
                raise AdapterError("IDENTITY_CHANGED", "closed, inherited or invalidated observer")
            self._compose()
            started = self._monotonic()
            if type(started) is not int or started < self.spec.t0_us * 1000:
                raise AdapterError("DEADLINE", "clock precedes original origin")
            phase = self.spec.work_deadline_us if work else self.spec.cleanup_deadline_us
            if deadline_us is not None and (type(deadline_us) is not int or
                                           not 0 <= deadline_us <= self._c.U64_MAX):
                raise AdapterError("PROTOCOL", "absolute integer deadline_us required")
            cutoff = min(phase * 1000, started + self._c.RPC_MAX_US * 1000,
                         (deadline_us if deadline_us is not None else phase) * 1000)
            if self._manager is not None:
                cutoff = min(cutoff, int(self._manager["authority_lease_until_us"]) * 1000)
            gate = _AdapterGate(self._monotonic, cutoff, started)
            remaining = gate.deadline - gate.now()
            acquired = self._lock.acquire(timeout=min(remaining / 1e9, threading.TIMEOUT_MAX))
            gate.now()
            if not acquired:
                raise AdapterError("DEADLINE", "adapter lock unavailable before cutoff")
            # State can change while this operation waits for the original lock.
            if self._closed or os.getpid() != self._pid or (self._root_bad and not allow_invalid):
                raise AdapterError("IDENTITY_CHANGED", "observer invalidated while waiting for lock")
            # Reserve enough space for one bounded core observation and small proofs.
            reserve = self._producer.budget.max_total_bytes * 9 + 3_145_728
            if (len(self._records) > self.MAX_RECORDS - 16 or
                    self._evidence_bytes + reserve > self.MAX_EVIDENCE_BYTES):
                raise AdapterError("DEPENDENCY_UNAVAILABLE", "evidence capacity reserved; no new I/O")
            actual = self._c.validate_manager_binding(self._mapping(
                gate.call(self._producer.manager_binding, gate.deadline)))
            self._put(actual)
            if self._manager is not None and actual != self._manager:
                self._root_bad = True
                raise AdapterError("IDENTITY_CHANGED", "original manager binding/lease changed")
            gate.deadline = min(gate.deadline, int(actual["authority_lease_until_us"]) * 1000)
            gate.now()
            if self._manager is None:
                self._manager = actual
            yield gate
            gate.now()
        except Exception as error:
            raise self._failure(error) from error
        finally:
            if acquired:
                self._lock.release()

    def _budget(self, gate):
        remaining = gate.deadline - gate.now()
        return _dc.replace(self._producer.budget,
                           timeout_ns=min(remaining, self._producer.budget.timeout_ns))

    def _filesystem_origin(self, filesystem):
        origin = _filesystem_provenance(filesystem)
        if origin != "linux-kernel":
            self.fixture_only = self.test_boundary = True
        return origin

    def _monotonic(self):
        value = self._clock()
        if type(value) is not int or (self._last_ns is not None and value < self._last_ns):
            self._root_bad = True
            error = AdapterError("DEADLINE", "monotonic clock regressed between observations")
            error.partial_fact = {"previous_ns": self._last_ns, "observed_ns": value}
            raise error
        self._last_ns = value
        return value

    @staticmethod
    def _namespace(context):
        return f"mnt:[{context.namespace_inode}]"

    def _directory(self, node, context, cgroup_path):
        return self._c.validate_directory_identity({
            "boot_id": context.boot_id, "mount_namespace_ref": self._namespace(context),
            "mount_id": str(node.mount_id), "fs_type": "cgroup2",
            "dev": str(node.device), "inode": str(node.inode), "cgroup_path": cgroup_path})

    def _ready(self):
        if self._root is None:
            raise AdapterError("DEPENDENCY_MISSING", "successful preflight required")

    def _check_root(self, gate, session):
        fs = _DeadlineFilesystem(self._producer.filesystem, gate)
        context, _ = _context(fs, session)
        session.require(context == self._root_context, "original root mount context changed")
        identity, _ = session.call("adapter_retained_root_identity",
            lambda: fs.identity(self._root, session.deadline), metadata_read=True)
        session.call("adapter_validate_root", lambda: _validate_node(identity))
        session.require(_same_node(identity, self._root_node) and identity.nlink > 0,
                        "retained original root identity changed")
        named = _open_path(fs, self._producer.mount_point, session)
        try:
            node, _ = session.call("adapter_named_root_identity",
                lambda: fs.identity(named, session.deadline), metadata_read=True)
            session.call("adapter_validate_named_root", lambda: _validate_node(node))
            session.require(_same_node(node, self._root_node) and node.nlink > 0,
                            "original root path changed")
        finally:
            session.cleanup(fs, named)

    def _root_observation(self, gate):
        session = _Session("adapter_root_revalidation", self._budget(gate), self._clock,
                           None, self._filesystem_origin(
                               _DeadlineFilesystem(self._producer.filesystem, gate)))
        try:
            session.require(not self._root_bad, "original root identity invalidation is sticky")
            self._check_root(gate, session)
        except _Failure:
            pass
        observation = session.finish(None)
        ref = self._put(observation, raw=True)
        if observation.status is not Status.COMPLETE:
            self._root_bad = True
        gate.now()
        return observation, ref

    def _require_root(self, gate):
        observation, ref = self._root_observation(gate)
        if observation.status is not Status.COMPLETE:
            raise AdapterError("IDENTITY_CHANGED", "original retained root changed or unverifiable", ref)

    def preflight(self, run_spec):
        run = run_spec if isinstance(run_spec, self._c.RunSpec) else self._c.RunSpec.from_mapping(run_spec)
        if run.to_mapping() != self.spec.to_mapping():
            raise self._failure(AdapterError("IDENTITY_CHANGED", "immutable RunSpec changed"))
        with self._operation(work=True) as gate:
            fs = _DeadlineFilesystem(self._producer.filesystem, gate)
            session = _Session("adapter_preflight", self._budget(gate), self._clock,
                               None, self._filesystem_origin(fs))
            root = None
            try:
                if self._root is None:
                    context, _ = _context(fs, session)
                    mounts = [m for m in context.mounts if m.mount_point == self._producer.mount_point]
                    session.require(len(mounts) == 1 and mounts[0].root == "/",
                                    "unmapped or ambiguous original cgroup root")
                    session.require(context.boot_id == self._manager["boot_id"],
                                    "root and manager boot differ")
                    root = _open_path(fs, self._producer.mount_point, session)
                    node, _ = session.call("adapter_bind_root_identity",
                        lambda: fs.identity(root, session.deadline), metadata_read=True)
                    session.call("adapter_validate_root", lambda: _validate_node(node))
                    session.require(node.mount_id == mounts[0].mount_id, "root mount ID mismatch")
                    self._root, self._root_context, self._root_node = root, context, node
                self._check_root(gate, session)
                observation = session.finish(self._directory(self._root_node, self._root_context, "/"))
                raw_ref = self._put(observation, raw=True)
                if observation.status is not Status.COMPLETE:
                    raise AdapterError("PHYSICAL_UNAVAILABLE", "root observation incomplete", raw_ref)
                gate.now()
                record = self._c.ObserverRootBinding.from_mapping({
                    "run": self.spec.run, "original_root_identity": observation.value,
                    "before_us": str(observation.started_ns // 1000),
                    "after_us": str(observation.finished_ns // 1000)})
                self._put(record)
                return record
            except Exception:
                self._root_bad = True
                if root is not None:
                    session.cleanup(fs, root)
                    self._root = self._root_context = self._root_node = None
                observation = session.finish(None)
                try:
                    self._put(observation, raw=True)
                except AdapterError:
                    # Storage failure never prevents releasing owned descriptors.
                    pass
                raise

    def _leaf(self, physical, *, allow_invalid=False):
        self._ready()
        value = self._c.validate_physical_binding(self._mapping(physical))
        ref = self._c.digest_record(value)
        leaf = self._leaves.get(value["slot"])
        if leaf is None or value != leaf.physical.to_mapping() or ref != self._c.digest_record(leaf.physical):
            raise AdapterError("IDENTITY_CHANGED", "token/full binding absent from original local registry")
        if not allow_invalid and (leaf.observer._closed or leaf.observer._invalid_ref is not None):
            raise AdapterError("IDENTITY_CHANGED", "original leaf identity invalidation is sticky",
                               leaf.observer._invalid_ref)
        return leaf

    def _keeper(self, generation, gate):
        expected = self._c.validate_process_generation(self._mapping(generation))
        before = gate.now()
        observation = gate.call(self._producer.keeper_observation, expected, gate.deadline)
        raw_ref = self._put(observation, raw=True)
        if not isinstance(observation, KeeperObservation):
            raise AdapterError("IDENTITY_CHANGED", "typed fresh keeper observation required", raw_ref)
        actual = self._c.validate_process_generation(self._mapping(observation.generation))
        if (actual != expected or type(observation.started_ns) is not int or
                type(observation.finished_ns) is not int or
                not before <= observation.started_ns <= observation.finished_ns <= gate.now() or
                not isinstance(observation.source_ref, str) or not observation.source_ref):
            self._root_bad = True
            raise AdapterError("IDENTITY_CHANGED", "original keeper generation/freshness changed", raw_ref)
        return actual

    def _core_call(self, leaf, function, gate, **kwargs):
        # Only our registry owns these BoundCgroup objects; cap every operation.
        observer = leaf.observer
        original_fs, original_source = observer._fs, observer._source
        observer._fs = _DeadlineFilesystem(original_fs, gate)
        observer._source = _DeadlineSource(leaf.source, gate)
        try:
            observer._origin = self._filesystem_origin(observer._fs)
            observation = function(observer, budget=self._budget(gate), **kwargs)
            after_origin = self._filesystem_origin(observer._fs)
            origin = "injected-filesystem" if after_origin != observation.origin else after_origin
            observation = _dc.replace(observation, origin=origin)
            raw_ref = self._put(observation, raw=True)
            try:
                gate.now()
            except AdapterError as error:
                error.evidence_ref = raw_ref
                raise
            return observation
        finally:
            observer._fs, observer._source = original_fs, original_source

    def _verify_leaf(self, leaf, gate):
        observation = self._core_call(leaf, observe_census, gate)
        if observation.status is not Status.COMPLETE:
            raise AdapterError("PHYSICAL_UNAVAILABLE", "original physical identity/census incomplete",
                               self._put(observation, raw=True))
        return observation

    def bind_leaf(self, unit_binding, keeper_generation, deadline_us):
        with self._operation(deadline_us, work=True) as gate:
            self._ready()
            self._require_root(gate)
            unit = self._c.validate_unit_binding(self._mapping(unit_binding))
            keeper = self._keeper(keeper_generation, gate)
            slot = self.spec.slots[unit["slot"]]
            if (slot.unit_name != unit["name"] or unit["manager_binding_ref"] != self._c.digest_record(self._manager)
                    or unit["keeper_generation_ref"] != self._c.digest_record(keeper)
                    or unit["slot"] in self._leaves):
                raise AdapterError("IDENTITY_CHANGED", "original run/slot/unit/generation mismatch")
            source = gate.call(self._producer.identity_source, unit, gate.deadline)
            if not callable(getattr(source, "snapshot", None)):
                raise AdapterError("DEPENDENCY_MISSING", "fresh unit IdentitySource required")
            expected = ManagerIdentity(self.spec.run, unit["slot"],
                self._manager["owner_unique_name"], self._manager["bus_guid"], unit["name"],
                unit["invocation_id"], unit["control_group"], int(unit["control_group_id"]),
                self._c.digest_record(unit), "adapter:original-unit-binding")
            filesystem = _DeadlineFilesystem(self._producer.filesystem, gate)
            before_origin = self._filesystem_origin(filesystem)
            result = bind_before_go(expected, _DeadlineSource(source, gate),
                filesystem=filesystem,
                mount_point=self._producer.mount_point, clock=self._clock, budget=self._budget(gate))
            observer = result.observer
            try:
                # The frozen core sees the wrapper; preserve its actual underlying
                # path in both the capture record and all later owned observations.
                origin = self._filesystem_origin(filesystem)
                if origin != before_origin:
                    origin = "injected-filesystem"
                result = _dc.replace(result, observation=_dc.replace(result.observation, origin=origin))
                if observer is not None:
                    observer._origin = origin
                raw_ref = self._put(result.observation, raw=True)
                if observer is None:
                    raise AdapterError("PHYSICAL_UNAVAILABLE", "original leaf binding incomplete", raw_ref)
                binding = result.observation.value
                if (binding.context != self._root_context or
                        keeper["boot_id"] != binding.context.boot_id or
                        keeper["mount_namespace_ref"] != self._namespace(binding.context)):
                    raise AdapterError("IDENTITY_CHANGED", "keeper/root/leaf namespace differs")
                # Release the per-call gates. Future operations install their own.
                observer._fs, observer._source = self._producer.filesystem, source
                physical = self._c.PhysicalBinding.from_mapping({
                    "run": self.spec.run, "slot": unit["slot"], "boot_id": binding.context.boot_id,
                    "manager_owner": expected.manager_owner, "bus_guid": expected.manager_guid,
                    "unit_name": unit["name"], "invocation_id": unit["invocation_id"],
                    "control_group": unit["control_group"], "control_group_id": unit["control_group_id"],
                    "unit_binding_ref": expected.unit_binding_ref,
                    "physical_ref": "leaf:" + uuid.uuid4().hex,
                    "parent_ref": "parent:" + uuid.uuid4().hex,
                    "mount_namespace_ref": self._namespace(binding.context),
                    "mount_id": str(binding.leaf.mount_id), "fs_type": "cgroup2",
                    "dev": str(binding.leaf.device), "inode": str(binding.leaf.inode),
                    "leaf_basename": binding.leaf_name})
                proof = self._c.BindingProof.from_mapping({
                    "physical_binding_ref": self._c.digest_record(physical),
                    "original_leaf_identity": self._directory(binding.leaf, binding.context, unit["control_group"]),
                    "original_parent_identity": self._directory(binding.parent, binding.context,
                        unit["control_group"].rsplit("/", 1)[0] or "/"),
                    "before_us": str(result.observation.started_ns // 1000),
                    "after_us": str(result.observation.finished_ns // 1000)})
                self._c.validate_binding_proof(proof.to_mapping(), physical.to_mapping())
                self._put(unit); self._put(keeper); self._put(physical); self._put(proof)
                provisional = _RuntimeLeaf(observer, source, unit, keeper, physical, proof)
                census = self._verify_leaf(provisional, gate).value
                self._keeper(keeper, gate)
                if (census.populated != 1 or census.pids is None or keeper["pid"] not in census.pids):
                    raise AdapterError("IDENTITY_CHANGED", "keeper not resident at physical binding")
                self._require_root(gate)
                gate.now()
                self._leaves[unit["slot"]] = provisional
                return physical
            except Exception:
                if observer is not None:
                    close_observation = observer.close()
                    try:
                        self._put(close_observation, raw=True)
                    except AdapterError:
                        pass
                raise

    def binding_proof(self, physical_binding, deadline_us):
        with self._operation(deadline_us, work=True) as gate:
            leaf = self._leaf(physical_binding)
            self._require_root(gate)
            self._keeper(leaf.keeper, gate)
            census = self._verify_leaf(leaf, gate).value
            self._keeper(leaf.keeper, gate)
            if census.populated != 1 or census.pids is None or leaf.keeper["pid"] not in census.pids:
                raise AdapterError("IDENTITY_CHANGED", "keeper left before LOAD_PERMIT")
            self._require_root(gate)
            return leaf.proof

    def sample_peak(self, physical_binding, keeper_generation, reap_ledger_ref, deadline_us):
        with self._operation(deadline_us, work=True) as gate:
            leaf = self._leaf(physical_binding)
            self._require_root(gate)
            # Ref is an externally approved checkpoint; no reaper acceptance here.
            if not isinstance(reap_ledger_ref, str) or not re.fullmatch(r"[0-9a-f]{64}", reap_ledger_ref):
                raise AdapterError("PROTOCOL", "approved checkpoint reference required")
            keeper = self._keeper(keeper_generation, gate)
            if keeper != leaf.keeper:
                raise AdapterError("IDENTITY_CHANGED", "original keeper generation differs")
            observation = self._core_call(leaf, observe_memory_peak, gate)
            after_keeper = self._keeper(keeper_generation, gate)
            peak = observation.value
            if (observation.status is not Status.COMPLETE or peak.bytes is None or
                    after_keeper != keeper or peak.before is None or peak.after is None or
                    peak.before.pids is None or peak.after.pids is None or
                    keeper["pid"] not in peak.before.pids or keeper["pid"] not in peak.after.pids or
                    peak.before.populated != 1 or peak.after.populated != 1):
                raise AdapterError("MEMORY_UNKNOWN", "peak/identity/resident keeper census incomplete",
                                   self._put(observation, raw=True))
            ref = self._c.digest_record(leaf.physical)
            sample = self._c.MemorySample.from_mapping({
                "unit_binding_ref": self._c.digest_record(leaf.unit), "physical_binding_ref": ref,
                "keeper_generation_ref": self._c.digest_record(keeper), "ledger_checkpoint_ref": reap_ledger_ref,
                "metric": "memory.peak", "bytes": str(peak.bytes),
                "before_us": str(observation.started_ns // 1000),
                "after_us": str(observation.finished_ns // 1000),
                "identity_before_ref": ref, "identity_after_ref": ref})
            self._put(sample)
            self._require_root(gate)
            return sample

    @staticmethod
    def _reason(observation):
        issues = " ".join(observation.issues)
        if "deadline" in issues.lower() or any(r.errno == errno.ETIMEDOUT for r in observation.evidence):
            return "TIMEOUT"
        if any(r.errno in (errno.EACCES, errno.EPERM) for r in observation.evidence):
            return "PERMISSION"
        if any(word in issues.lower() for word in ("identity", "substitute", "context changed", "reappeared", "still linked")):
            return "IDENTITY_CHANGED"
        if "parent" in issues.lower() and ("disappeared" in issues or "ENOENT" in issues):
            return "PARENT_GONE"
        if any(r.errno not in (None, errno.ENOENT) for r in observation.evidence):
            return "IO"
        return "OTHER_UNCERTAINTY"

    def _closure_record(self, leaf, observation, raw_ref):
        physical = leaf.physical.to_mapping()
        binding = leaf.proof.to_mapping()
        kind = observation.value.kind
        if observation.status is not Status.COMPLETE or kind is ClosureKind.UNAVAILABLE:
            reason = self._reason(observation)
            proof = self._c.ClosureUnavailable.from_mapping({
                "tag": "Unavailable", "physical_binding_ref": self._c.digest_record(physical),
                "reason": reason, "observation_ref": raw_ref})
            return {"tag": "Unavailable", "populated": None,
                    "reason": reason, "observation_ref": raw_ref}, proof
        absent = kind is ClosureKind.ORIGINAL_ABSENT
        identity = binding["original_parent_identity" if absent else "original_leaf_identity"]
        operation_name = "lookup_exact_leaf" if absent else "read:cgroup.events"
        records = [r for r in observation.evidence if r.operation == operation_name and
                   (r.errno == errno.ENOENT if absent else r.error is None)]
        before_name = "retained_parent_identity" if absent else "retained_leaf_identity"
        identities = [r for r in observation.evidence if r.operation == before_name and r.error is None]
        if not records or len(identities) < 2:
            raise AdapterError("PHYSICAL_UNAVAILABLE", "same-operation identity evidence missing")
        operation_record = records[0]
        before = self._directory(identities[0].value, leaf.observer._binding.context, identity["cgroup_path"])
        after = self._directory(identities[-1].value, leaf.observer._binding.context, identity["cgroup_path"])
        operation = {"kind": "OPENAT_ORIGINAL_ABSENT" if absent else "DIRECT_EVENTS_EMPTY",
            "before_us": str(operation_record.started_ns // 1000),
            "after_us": str(operation_record.finished_ns // 1000)}
        if absent:
            operation.update(parent_identity_ref=self._c.digest_record(identity),
                             leaf_basename=physical["leaf_basename"], errno="ENOENT")
            fact = {"tag": "OriginalAbsent", "populated": None,
                "parent_original_identity_before_ref": self._c.digest_record(before),
                "parent_original_identity_after_ref": self._c.digest_record(after),
                "leaf_basename": physical["leaf_basename"], "openat_errno": "ENOENT",
                "probe_ref": self._c.digest_record(operation)}
        else:
            operation.update(leaf_identity_ref=self._c.digest_record(identity), populated=0)
            fact = {"tag": "PresentEmpty", "populated": 0,
                "read_before_us": operation["before_us"], "read_after_us": operation["after_us"],
                "original_identity_before_ref": self._c.digest_record(before),
                "original_identity_after_ref": self._c.digest_record(after),
                "direct_events_read_ref": self._c.digest_record(operation)}
        proof = self._c.ClosureProof.from_mapping({
            "physical_binding_ref": self._c.digest_record(physical), "original_identity": identity,
            "before_identity": before, "after_identity": after, "operation": operation})
        self._c.validate_closure_proof(proof.to_mapping(), binding, physical=physical)
        self._put(operation)
        return fact, proof

    def probe_cleanup(self, physical_binding, unit_binding, backend_receipts, reap_ledger_ref, deadline_us):
        with self._operation(deadline_us, allow_invalid=True) as gate:
            leaf = self._leaf(physical_binding, allow_invalid=True)
            unit = self._c.validate_unit_binding(self._mapping(unit_binding))
            if unit != leaf.unit:
                raise AdapterError("IDENTITY_CHANGED", "cleanup unit is not original")
            receipts = self._mapping(backend_receipts)
            self._put(receipts)
            if not isinstance(reap_ledger_ref, str) or not re.fullmatch(r"[0-9a-f]{64}", reap_ledger_ref):
                raise AdapterError("PROTOCOL", "approved reap ledger reference required")
            refs = {}
            # Equality/retention only; jobs/reap/terminal states are external policy.
            for record_name, ref_name in (("start_receipt", "start_settlement_ref"),
                    ("stop_receipt", "stop_settlement_ref"), ("final_unit_receipt", "final_unit_receipt_ref")):
                record = receipts.get(record_name)
                if not isinstance(record, dict) or receipts.get(ref_name) != self._c.digest_record(record):
                    raise AdapterError("TRANSPORT_UNKNOWN", "missing original full receipt/ref: " + record_name)
                refs[ref_name] = receipts[ref_name]
                self._put(record)
            root_before, root_ref = self._root_observation(gate)
            policy = None
            if self._producer.absence_policy is not None:
                policy = gate.call(self._producer.absence_policy, leaf.observer.binding_ref,
                                   leaf.observer._binding, gate.deadline)
            if root_before.status is Status.COMPLETE:
                observation = self._core_call(leaf, observe_closure, gate, policy=policy)
                root_after, root_ref = self._root_observation(gate)
                if root_after.status is not Status.COMPLETE:
                    observation = _dc.replace(observation, status=Status.INCOMPLETE,
                        value=Closure(ClosureKind.UNAVAILABLE, None,
                                      observation.value.events_ref, observation.value.policy_ref),
                        issues=observation.issues + root_after.issues,
                        references=observation.references + (root_ref,))
            else:
                observation = _dc.replace(root_before, kind="closure",
                    binding_ref=leaf.observer.binding_ref,
                    value=Closure(ClosureKind.UNAVAILABLE, None), references=(root_ref,))
            terminal_records = tuple(record for record in observation.evidence
                                     if type(record.value) is TerminalIdentityObservation)
            if any(_terminal_digest(record.value.cleanup_graph) != _terminal_digest(receipts)
                   for record in terminal_records):
                observation = _dc.replace(observation, status=Status.INCOMPLETE,
                    value=Closure(ClosureKind.UNAVAILABLE, None,
                        observation.value.events_ref, observation.value.policy_ref),
                    issues=observation.issues + ("cleanup caller graph differs from authenticated terminal source graph",),
                    references=observation.references + tuple(record.ref for record in terminal_records))
            raw_ref = self._put(observation, raw=True)
            fact, proof = self._closure_record(leaf, observation, raw_ref)
            self._put(proof)
            evidence = self._c.CleanupEvidence.from_mapping({
                "slot": unit["slot"], "original_unit_binding_ref": self._c.digest_record(unit),
                "original_physical_binding_ref": self._c.digest_record(leaf.physical),
                "start_settlement_ref": refs["start_settlement_ref"],
                "stop_settlement_ref": refs["stop_settlement_ref"], "reap_ledger_ref": reap_ledger_ref,
                "final_unit_observation_ref": refs["final_unit_receipt_ref"],
                "observed_us": str(observation.finished_ns // 1000),
                "lease_until_us": self._manager["authority_lease_until_us"], "physical": fact,
                "identity_brackets_ref": self._c.digest_record(proof),
                "missing_evidence": ["PHYSICAL_OBSERVATION"] if fact["tag"] == "Unavailable" else []})
            self._c.validate_cleanup_proof(proof.to_mapping(), leaf.proof.to_mapping(),
                                          evidence.to_mapping(), leaf.physical.to_mapping())
            ref = self._put(evidence)
            gate.now()
            self._closures[ref] = (evidence, proof, self._c.digest_record(leaf.physical), raw_ref)
            return evidence

    def cleanup_proof(self, evidence, physical_binding, deadline_us):
        with self._operation(deadline_us, allow_invalid=True) as gate:
            leaf = self._leaf(physical_binding, allow_invalid=True)
            record = self._c.validate_cleanup_evidence(self._mapping(evidence))
            ref = self._c.digest_record(record)
            retained = self._closures.get(ref)
            if (retained is None or record != retained[0].to_mapping() or
                    retained[2] != self._c.digest_record(leaf.physical)):
                raise AdapterError("IDENTITY_CHANGED", "closure was not produced by this original operation")
            if (not isinstance(retained[1], self._c.ClosureUnavailable) and
                    (self._root_bad or leaf.observer._closed or leaf.observer._invalid_ref is not None)):
                raise AdapterError("IDENTITY_CHANGED", "cached success cannot bypass observed invalidation")
            self._c.validate_cleanup_proof(retained[1].to_mapping(), leaf.proof.to_mapping(),
                                          record, leaf.physical.to_mapping())
            # No new filesystem observation and no latest-proof selection.
            return retained[1]

    def export_evidence(self):
        """Defensive copies of all full local records; includes injected provenance."""
        with self._lock:
            return {"fixture_only": self.fixture_only, "records": [
                {"ref": ref, "record": _json.loads(payload)} for ref, payload in self._records.items()]}

    def close(self):
        """Release only internally retained handles; errors remain local evidence."""
        with self._lock:
            self._closed = True
            observations, storage_errors = [], []
            for leaf in self._leaves.values():
                leaf.observer._origin = self._filesystem_origin(leaf.observer._fs)
                observation = leaf.observer.close()
                observations.append(observation)
                try:
                    self._put(observation, raw=True)
                except AdapterError as error:
                    storage_errors.append(str(error))
            if self._root is not None:
                session = _Session("adapter_close", self._producer.budget, self._clock,
                                   None, self._filesystem_origin(self._producer.filesystem))
                session.cleanup(self._producer.filesystem, self._root)
                self._root = None
                observation = session.finish(None)
                observations.append(observation)
                try:
                    self._put(observation, raw=True)
                except AdapterError as error:
                    storage_errors.append(str(error))
            if storage_errors:
                error = AdapterError("DEPENDENCY_UNAVAILABLE", "close evidence storage failed: " + storage_errors[0])
                error.partial_fact = tuple(observations)
                raise error
            return tuple(observations)


__all__ += ["RuntimePhysicalObserver", "PhysicalProducer", "KeeperObservation", "AdapterError"]

