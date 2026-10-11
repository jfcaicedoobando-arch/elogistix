"""Pure, candidate V3 contracts. Shape validation never authenticates a receipt.

No function here opens a descriptor, contacts a manager, starts a load, or certifies
cleanup. Local handle labels must resolve in the observer's retained registry;
neither a label nor a digest grants authority over a descriptor received over IPC.
"""
from __future__ import annotations

from dataclasses import dataclass
import hashlib
import json
import re
from types import MappingProxyType
from typing import ClassVar, Mapping

VERSION = 3
CONTRACT_STATUS = "CANDIDATE_PENDING_REVIEW"
MAX_PACKET_BYTES = 16384
MAX_DEPTH = 6
MAX_ARRAY_ITEMS = 32
U64_MAX = (1 << 64) - 1
U32_MAX = (1 << 32) - 1
WORK_US = 50_000_000
CLEANUP_US = 60_000_000
RPC_MAX_US = 1_000_000
START_MAX_US = STOP_MAX_US = 2_000_000
OBSERVATION_MARGIN_US = 500_000
DELIVERY_MARGIN_US = 1_000_000
START_MARGIN_US = 5_500_000
RUNTIME_MAX_US = 40_000_000
MEMORY_MAX_BYTES = 33_554_432
TASKS_MAX = 8
CLEANUP_POLICY_ID = "physical-cleanup-union-v1"
MEMORY_RECLAMATION = "NOT_ESTABLISHED"
SCENARIOS = frozenset(("OVERLAP", "LEADER_EXIT_THREAD_SURVIVES", "DESCENDANT_IGNORES_TERM"))
SENDERS = frozenset(("COORDINATOR", "WATCHDOG", "KEEPER"))
FAULT_CODES = frozenset(("PROTOCOL", "IDENTITY_CHANGED", "DEADLINE", "PEER_CLOSED", "AUTHORITY", "MEMORY_UNKNOWN", "REAP_UNKNOWN", "TRANSPORT_UNKNOWN", "PHYSICAL_UNAVAILABLE", "INTERNAL", "WATCHDOG_DIED", "DEPENDENCY_MISSING", "MANAGER_REAP_POLICY_PENDING", "UNKNOWN_OUTCOME", "DEPENDENCY_UNAVAILABLE", "AUTHENTICATION", "REAP_POLICY_PENDING"))
MISSING_EVIDENCE_CODES = frozenset(("START_SETTLEMENT", "STOP_SETTLEMENT", "REAP_LEDGER", "FINAL_UNIT_OBSERVATION", "PHYSICAL_IDENTITY", "PHYSICAL_OBSERVATION", "AUTHORITY", "DEADLINE", "KEEPER_REAP", "PAYLOAD_BINDING", "MEMORY_SAMPLE"))
UNAVAILABLE_REASONS = frozenset(("PARENT_GONE", "PERMISSION", "IO", "TIMEOUT", "IDENTITY_CHANGED", "OTHER_UNCERTAINTY"))
_HEX32 = re.compile(r"[0-9a-f]{32}\Z")
_HEX64 = re.compile(r"[0-9a-f]{64}\Z")
_UUID = re.compile(r"[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\Z")
_U64 = re.compile(r"(?:0|[1-9][0-9]*)\Z")
_UNIT = re.compile(r"elogistix-memory-adapter-[0-9a-f]{32}\.service\Z")
_OBJECT = re.compile(r"/org/freedesktop/systemd1/unit/[A-Za-z0-9_]+\Z")
_OWNER = re.compile(r":[0-9]+\.[0-9]+\Z")
_LOCAL = re.compile(r"[a-z][a-z0-9_-]*:[A-Za-z0-9_.:\[\]-]{1,160}\Z")


class ContractError(ValueError):
    def __init__(self, code: str = "PROTOCOL", detail: str = "invalid contract"):
        self.code = code
        super().__init__(f"{code}: {detail}")


def _fail(detail: str, code: str = "PROTOCOL"):
    raise ContractError(code, detail)


def parse_u64(value: object) -> int:
    if type(value) is not str or len(value) > 20 or not _U64.fullmatch(value):
        _fail("canonical uint64 string required")
    result = int(value)
    if result > U64_MAX:
        _fail("uint64 overflow")
    return result


def _integer(value, low=0, high=U32_MAX):
    if type(value) is not int or not low <= value <= high:
        _fail("integer outside closed range")
    return value


def _clock_int(value):
    return _integer(value, 0, U64_MAX)


def _text(value, pattern=None):
    if type(value) is not str or not value:
        _fail("bounded text required")
    try:
        size = len(value.encode("utf-8", "strict"))
    except UnicodeError:
        _fail("invalid Unicode text")
    if size > 1024:
        _fail("bounded text required")
    if any(ord(c) < 32 or 127 <= ord(c) <= 159 or c in "\u2028\u2029" for c in value):
        _fail("control character in text")
    if pattern is not None and not pattern.fullmatch(value):
        _fail("text outside closed syntax")
    return value


def _hex(value, size=64):
    return _text(value, _HEX64 if size == 64 else _HEX32)


def _enum(value, values):
    if type(value) is not str or value not in values:
        _fail("unknown enum")
    return value


def _bool(value, required=None):
    if type(value) is not bool or (required is not None and value is not required):
        _fail("boolean required")
    return value


def _closed(value, keys):
    if not isinstance(value, Mapping) or set(value) != set(keys):
        _fail("exact object fields required")
    return dict(value)


def _array(value, max_items=MAX_ARRAY_ITEMS):
    if type(value) not in (list, tuple) or len(value) > max_items:
        _fail("bounded array required")
    return list(value)


def _groups(value):
    values = [_integer(v) for v in _array(value)]
    if values != sorted(set(values)):
        _fail("sorted distinct groups required")
    return values


def _codes(value):
    result = [_enum(v, MISSING_EVIDENCE_CODES) for v in _array(value)]
    if len(result) != len(set(result)):
        _fail("duplicate missing-evidence code")
    return result


def _path(value, *, basename=False):
    _text(value)
    if basename:
        if value in (".", "..") or "/" in value or "\\" in value:
            _fail("exact leaf basename required")
    elif not value.startswith("/") or "\\" in value or "//" in value or any(c in (".", "..", "") for c in value.split("/")[1:]):
        _fail("canonical absolute path required")
    return value


def _local_ref(value):
    # This labels a separately retained LOCAL object. It is never an FD number.
    return _text(value, _LOCAL)


def _times(record, before="before_us", after="after_us"):
    if parse_u64(record[before]) > parse_u64(record[after]):
        _fail("reversed observation bracket")


def validate_process_generation(value):
    r = _closed(value, ("pid", "start_ticks", "boot_id", "pid_namespace_ref", "mount_namespace_ref"))
    _integer(r["pid"], 1)
    if parse_u64(r["start_ticks"]) == 0:
        _fail("unknown process generation")
    _text(r["boot_id"], _UUID)
    for k in ("pid_namespace_ref", "mount_namespace_ref"):
        _text(r[k])
    return r


def validate_manager_binding(value):
    r = _closed(value, ("boot_id", "bus_guid", "owner_unique_name", "manager_pid_generation", "authority_lease_until_us"))
    _text(r["boot_id"], _UUID)
    _hex(r["bus_guid"], 32)
    _text(r["owner_unique_name"], _OWNER)
    r["manager_pid_generation"] = validate_process_generation(r["manager_pid_generation"])
    if r["boot_id"] != r["manager_pid_generation"]["boot_id"]:
        _fail("manager boot mismatch", "IDENTITY_CHANGED")
    parse_u64(r["authority_lease_until_us"])
    return r


def _unit_base(value, candidate=False):
    keys = ("slot", "name", "object_path", "invocation_id", "manager_binding_ref", "control_group", "control_group_id", "main_pid" if candidate else "keeper_generation_ref")
    r = _closed(value, keys)
    _integer(r["slot"], 0, 2)
    _text(r["name"], _UNIT)
    _text(r["object_path"], _OBJECT)
    if _hex(r["invocation_id"], 32) == "0" * 32:
        _fail("unknown invocation")
    _hex(r["manager_binding_ref"])
    _path(r["control_group"])
    if parse_u64(r["control_group_id"]) == 0:
        _fail("unknown cgroup id")
    if candidate:
        _integer(r["main_pid"], 1)
    else:
        _hex(r["keeper_generation_ref"])
    return r


def validate_unit_candidate(value):
    return _unit_base(value, True)


def validate_unit_binding(value):
    return _unit_base(value)


def validate_physical_binding(value):
    keys = ("run", "slot", "boot_id", "manager_owner", "bus_guid", "unit_name", "invocation_id", "control_group", "control_group_id", "unit_binding_ref", "physical_ref", "mount_namespace_ref", "mount_id", "fs_type", "dev", "inode", "parent_ref", "leaf_basename")
    r = _closed(value, keys)
    _hex(r["run"], 32)
    _integer(r["slot"], 0, 2)
    _text(r["boot_id"], _UUID)
    _text(r["manager_owner"], _OWNER)
    _hex(r["bus_guid"], 32)
    _text(r["unit_name"], _UNIT)
    _hex(r["invocation_id"], 32)
    _hex(r["unit_binding_ref"])
    _path(r["control_group"])
    for k in ("control_group_id", "mount_id", "dev", "inode"):
        parse_u64(r[k])
    for k in ("physical_ref", "parent_ref"):
        _local_ref(r[k])
    _text(r["mount_namespace_ref"])
    _enum(r["fs_type"], ("cgroup2",))
    _path(r["leaf_basename"], basename=True)
    if r["leaf_basename"] != r["control_group"].rsplit("/", 1)[-1]:
        _fail("physical leaf mismatch", "IDENTITY_CHANGED")
    return r


def validate_payload_binding(value):
    keys = ("kind", "sha256", "absolute_path", "dev", "inode", "mount_namespace_ref", "owner_uid", "protected_ancestor_refs", "exec_identity_proof_ref")
    r = _closed(value, keys)
    _enum(r["kind"], ("VERIFIED_STAGED_ELF",))
    _hex(r["sha256"])
    _path(r["absolute_path"])
    if not re.fullmatch(r"/run/elogistix-memory-[0-9a-f]{32}/[A-Za-z0-9_.-]+", r["absolute_path"]):
        _fail("payload outside closed staging directory")
    for k in ("dev", "inode"):
        parse_u64(r[k])
    _text(r["mount_namespace_ref"])
    _integer(r["owner_uid"])
    r["protected_ancestor_refs"] = [_local_ref(v) for v in _array(r["protected_ancestor_refs"])]
    if not r["protected_ancestor_refs"]:
        _fail("protected ancestors missing")
    if r["exec_identity_proof_ref"] != "PENDING_BEFORE_EXEC":
        _hex(r["exec_identity_proof_ref"])
    return r


@dataclass(frozen=True)
class SlotSpec:
    slot: int
    unit_name: str
    scenario: str
    memory_max_bytes: int = MEMORY_MAX_BYTES
    tasks_max: int = TASKS_MAX

    def __post_init__(self):
        _integer(self.slot, 0, 2)
        _text(self.unit_name, _UNIT)
        _enum(self.scenario, SCENARIOS)
        _integer(self.memory_max_bytes, MEMORY_MAX_BYTES, MEMORY_MAX_BYTES)
        _integer(self.tasks_max, TASKS_MAX, TASKS_MAX)

    @classmethod
    def from_mapping(cls, value):
        return cls(**_closed(value, ("slot", "unit_name", "scenario", "memory_max_bytes", "tasks_max")))

    def to_mapping(self):
        return {"slot": self.slot, "unit_name": self.unit_name, "scenario": self.scenario, "memory_max_bytes": self.memory_max_bytes, "tasks_max": self.tasks_max}


@dataclass(frozen=True)
class RunSpec:
    run: str
    t0_us: int
    work_deadline_us: int
    cleanup_deadline_us: int
    slots: tuple[SlotSpec, ...]
    load_uid: int
    load_gid: int
    load_groups: tuple[int, ...]
    payload_expected_sha256: str
    cleanup_policy_id: str
    scope_ref: str

    def __post_init__(self):
        _hex(self.run, 32)
        for k in ("t0_us", "work_deadline_us", "cleanup_deadline_us"):
            _clock_int(getattr(self, k))
        if self.t0_us > U64_MAX - CLEANUP_US or self.work_deadline_us != self.t0_us + WORK_US or self.cleanup_deadline_us != self.t0_us + CLEANUP_US:
            _fail("immutable original deadlines required", "DEADLINE")
        slots = tuple(sorted((s if isinstance(s, SlotSpec) else SlotSpec.from_mapping(s) for s in _array(self.slots)), key=lambda s: s.slot))
        if len(slots) != 3 or tuple(s.slot for s in slots) != (0, 1, 2) or len({s.unit_name for s in slots}) != 3:
            _fail("exactly three unique reserved slots required")
        object.__setattr__(self, "slots", slots)
        _integer(self.load_uid, 1)
        _integer(self.load_gid)
        object.__setattr__(self, "load_groups", tuple(_groups(self.load_groups)))
        _hex(self.payload_expected_sha256)
        _enum(self.cleanup_policy_id, (CLEANUP_POLICY_ID,))
        _text(self.scope_ref)

    @classmethod
    def from_mapping(cls, value):
        r = _closed(value, ("run", "t0_us", "work_deadline_us", "cleanup_deadline_us", "slots", "load_uid", "load_gid", "load_groups", "payload_expected_sha256", "cleanup_policy_id", "scope_ref"))
        for k in ("t0_us", "work_deadline_us", "cleanup_deadline_us"):
            r[k] = parse_u64(r[k])
        return cls(**r)

    def to_mapping(self):
        return {"run": self.run, "t0_us": str(self.t0_us), "work_deadline_us": str(self.work_deadline_us), "cleanup_deadline_us": str(self.cleanup_deadline_us), "slots": [s.to_mapping() for s in self.slots], "load_uid": self.load_uid, "load_gid": self.load_gid, "load_groups": list(self.load_groups), "payload_expected_sha256": self.payload_expected_sha256, "cleanup_policy_id": self.cleanup_policy_id, "scope_ref": self.scope_ref}


def operation_budget_us(spec: RunSpec, now_us: int, lease_until_us: int, *, work=False, max_us=RPC_MAX_US):
    if not isinstance(spec, RunSpec):
        _fail("RunSpec required")
    _clock_int(now_us)
    _clock_int(lease_until_us)
    _integer(max_us, 1, RPC_MAX_US)
    _bool(work)
    if now_us < spec.t0_us:
        _fail("clock before immutable origin", "DEADLINE")
    budget = min(max_us, (spec.work_deadline_us if work else spec.cleanup_deadline_us) - now_us, lease_until_us - now_us)
    if budget <= 0:
        _fail("deadline or authority lease expired", "DEADLINE")
    return budget


def runtime_max_us(spec: RunSpec, now_us: int):
    _clock_int(now_us)
    if now_us < spec.t0_us:
        _fail("clock before immutable origin", "DEADLINE")
    remaining = spec.work_deadline_us - now_us - START_MARGIN_US
    if remaining <= 0:
        _fail("insufficient original work margin", "DEADLINE")
    return min(RUNTIME_MAX_US, remaining)


def validate_memory_sample(value):
    r = _closed(value, ("unit_binding_ref", "physical_binding_ref", "keeper_generation_ref", "ledger_checkpoint_ref", "metric", "bytes", "before_us", "after_us", "identity_before_ref", "identity_after_ref"))
    for k in ("unit_binding_ref", "physical_binding_ref", "keeper_generation_ref", "ledger_checkpoint_ref", "identity_before_ref", "identity_after_ref"):
        _hex(r[k])
    _enum(r["metric"], ("memory.peak",))
    parse_u64(r["bytes"])
    _times(r)
    return r


def validate_cleanup_physical(value):
    if not isinstance(value, Mapping):
        _fail("physical tagged union required")
    tag = value.get("tag")
    if tag == "PresentEmpty":
        r = _closed(value, ("tag", "populated", "read_before_us", "read_after_us", "original_identity_before_ref", "original_identity_after_ref", "direct_events_read_ref"))
        _integer(r["populated"], 0, 0)
        _times(r, "read_before_us", "read_after_us")
        for k in ("original_identity_before_ref", "original_identity_after_ref", "direct_events_read_ref"):
            _hex(r[k])
    elif tag == "OriginalAbsent":
        r = _closed(value, ("tag", "populated", "parent_original_identity_before_ref", "parent_original_identity_after_ref", "leaf_basename", "openat_errno", "probe_ref"))
        if r["populated"] is not None:
            _fail("absence is not a fabricated populated zero")
        for k in ("parent_original_identity_before_ref", "parent_original_identity_after_ref", "probe_ref"):
            _hex(r[k])
        _path(r["leaf_basename"], basename=True)
        _enum(r["openat_errno"], ("ENOENT",))
    elif tag == "Unavailable":
        r = _closed(value, ("tag", "populated", "reason", "observation_ref"))
        if r["populated"] is not None:
            _fail("unknown population must be null")
        _enum(r["reason"], UNAVAILABLE_REASONS)
        _hex(r["observation_ref"])
    else:
        _fail("unknown physical observation tag")
    return r


def validate_cleanup_evidence(value):
    keys = ("slot", "original_unit_binding_ref", "original_physical_binding_ref", "start_settlement_ref", "stop_settlement_ref", "reap_ledger_ref", "final_unit_observation_ref", "observed_us", "lease_until_us", "physical", "identity_brackets_ref", "missing_evidence")
    r = _closed(value, keys)
    _integer(r["slot"], 0, 2)
    for k in ("original_unit_binding_ref", "original_physical_binding_ref", "start_settlement_ref", "stop_settlement_ref", "reap_ledger_ref", "final_unit_observation_ref", "identity_brackets_ref"):
        _hex(r[k])
    observed, lease = parse_u64(r["observed_us"]), parse_u64(r["lease_until_us"])
    if observed >= lease:
        _fail("cleanup observation outside authority lease", "DEADLINE")
    r["physical"] = validate_cleanup_physical(r["physical"])
    if r["physical"]["tag"] == "PresentEmpty" and parse_u64(r["physical"]["read_after_us"]) > observed:
        _fail("cleanup observation predates physical read")
    r["missing_evidence"] = _codes(r["missing_evidence"])
    return r


def physical_leaf_status(physical):
    # Classification of a fact only. All authentic independent receipts and
    # required removal must still be checked by the watchdog certificate policy.
    tag = validate_cleanup_physical(physical)["tag"]
    return {"PresentEmpty": "CLOSED_EMPTY", "OriginalAbsent": "CLOSED_REMOVED", "Unavailable": "UNKNOWN"}[tag]


def validate_directory_identity(value):
    r = _closed(value, ("boot_id", "mount_namespace_ref", "mount_id", "fs_type", "dev", "inode", "cgroup_path"))
    _text(r["boot_id"], _UUID)
    _text(r["mount_namespace_ref"])
    _enum(r["fs_type"], ("cgroup2",))
    for k in ("mount_id", "inode"):
        if parse_u64(r[k]) == 0:
            _fail("unknown directory identity")
    parse_u64(r["dev"])
    if r["cgroup_path"] != "/":
        _path(r["cgroup_path"])
    return r


def validate_observer_root_binding(value):
    r = _closed(value, ("run", "original_root_identity", "before_us", "after_us"))
    _hex(r["run"], 32)
    r["original_root_identity"] = validate_directory_identity(r["original_root_identity"])
    if r["original_root_identity"]["cgroup_path"] != "/":
        _fail("observer root must be original cgroup root", "IDENTITY_CHANGED")
    _times(r)
    return r


def validate_binding_proof(value, physical=None):
    """Candidate full identities; local retained producer authentication is external."""
    r = _closed(value, ("physical_binding_ref", "original_leaf_identity", "original_parent_identity", "before_us", "after_us"))
    _hex(r["physical_binding_ref"])
    leaf = r["original_leaf_identity"] = validate_directory_identity(r["original_leaf_identity"])
    parent = r["original_parent_identity"] = validate_directory_identity(r["original_parent_identity"])
    _times(r)
    if leaf["cgroup_path"] == "/" or parent["cgroup_path"] != (leaf["cgroup_path"].rsplit("/", 1)[0] or "/"):
        _fail("binding parent is not original leaf parent", "IDENTITY_CHANGED")
    for k in ("boot_id", "mount_namespace_ref", "mount_id", "fs_type", "dev"):
        if leaf[k] != parent[k]:
            _fail("binding leaf and parent epoch/mount mismatch", "IDENTITY_CHANGED")
    if leaf["inode"] == parent["inode"]:
        _fail("leaf aliases parent identity", "IDENTITY_CHANGED")
    if physical is not None:
        p = validate_physical_binding(physical)
        if r["physical_binding_ref"] != digest_record(p):
            _fail("binding physical digest mismatch", "IDENTITY_CHANGED")
        for k in ("boot_id", "mount_namespace_ref", "mount_id", "fs_type", "dev", "inode"):
            if leaf[k] != p[k]:
                _fail("binding does not match original physical identity", "IDENTITY_CHANGED")
        if leaf["cgroup_path"] != p["control_group"]:
            _fail("binding cgroup path mismatch", "IDENTITY_CHANGED")
    return r


def validate_closure_operation(value):
    if not isinstance(value, Mapping):
        _fail("closure operation tagged union required")
    kind = value.get("kind")
    if kind == "OPENAT_ORIGINAL_ABSENT":
        r = _closed(value, ("kind", "parent_identity_ref", "leaf_basename", "errno", "before_us", "after_us"))
        _hex(r["parent_identity_ref"])
        _path(r["leaf_basename"], basename=True)
        _enum(r["errno"], ("ENOENT",))
    elif kind == "DIRECT_EVENTS_EMPTY":
        r = _closed(value, ("kind", "leaf_identity_ref", "populated", "before_us", "after_us"))
        _hex(r["leaf_identity_ref"])
        _integer(r["populated"], 0, 0)
    else:
        _fail("unknown closure operation")
    _times(r)
    return r


def validate_closure_proof(value, binding_proof=None, evidence=None, physical=None):
    """Compare facts with original capture; this cannot attest actual openat/read."""
    r = _closed(value, ("physical_binding_ref", "original_identity", "before_identity", "after_identity", "operation"))
    _hex(r["physical_binding_ref"])
    for k in ("original_identity", "before_identity", "after_identity"):
        r[k] = validate_directory_identity(r[k])
    identity = r["original_identity"]
    if identity != r["before_identity"] or identity != r["after_identity"]:
        _fail("closure identity changed", "IDENTITY_CHANGED")
    operation = r["operation"] = validate_closure_operation(r["operation"])
    absent = operation["kind"] == "OPENAT_ORIGINAL_ABSENT"
    if operation["parent_identity_ref" if absent else "leaf_identity_ref"] != digest_record(identity):
        _fail("closure operation identity mismatch", "IDENTITY_CHANGED")
    if physical is not None:
        p = validate_physical_binding(physical)
        if r["physical_binding_ref"] != digest_record(p):
            _fail("closure physical binding mismatch", "IDENTITY_CHANGED")
    if binding_proof is not None:
        b = validate_binding_proof(binding_proof, physical)
        expected = b["original_parent_identity" if absent else "original_leaf_identity"]
        if r["physical_binding_ref"] != b["physical_binding_ref"] or identity != expected:
            _fail("closure adopted identity instead of original capture", "IDENTITY_CHANGED")
        if parse_u64(operation["before_us"]) < parse_u64(b["after_us"]):
            _fail("closure predates original binding")
        if absent and operation["leaf_basename"] != b["original_leaf_identity"]["cgroup_path"].rsplit("/", 1)[-1]:
            _fail("closure opened another leaf", "IDENTITY_CHANGED")
    if evidence is not None:
        e = validate_cleanup_evidence(evidence)
        if e["identity_brackets_ref"] != digest_record(r):
            _fail("closure evidence bracket digest mismatch", "IDENTITY_CHANGED")
        if r["physical_binding_ref"] != e["original_physical_binding_ref"]:
            _fail("closure evidence physical binding mismatch", "IDENTITY_CHANGED")
        fact = e["physical"]
        if parse_u64(operation["after_us"]) > parse_u64(e["observed_us"]):
            _fail("closure operation after evidence observation")
        if absent:
            if fact["tag"] != "OriginalAbsent" or fact["parent_original_identity_before_ref"] != digest_record(identity) or fact["parent_original_identity_after_ref"] != digest_record(identity) or fact["leaf_basename"] != operation["leaf_basename"] or fact["openat_errno"] != operation["errno"] or fact["probe_ref"] != digest_record(operation):
                _fail("absence evidence does not describe original operation", "IDENTITY_CHANGED")
        elif fact["tag"] != "PresentEmpty" or fact["original_identity_before_ref"] != digest_record(identity) or fact["original_identity_after_ref"] != digest_record(identity) or fact["direct_events_read_ref"] != digest_record(operation) or fact["read_before_us"] != operation["before_us"] or fact["read_after_us"] != operation["after_us"]:
            _fail("empty evidence does not describe original direct read", "IDENTITY_CHANGED")
    return r


def validate_closure_unavailable(value, evidence=None, physical=None):
    r = _closed(value, ("tag", "physical_binding_ref", "reason", "observation_ref"))
    _enum(r["tag"], ("Unavailable",))
    _hex(r["physical_binding_ref"])
    _enum(r["reason"], UNAVAILABLE_REASONS)
    _hex(r["observation_ref"])
    if physical is not None and r["physical_binding_ref"] != digest_record(validate_physical_binding(physical)):
        _fail("unavailable physical binding mismatch", "IDENTITY_CHANGED")
    if evidence is not None:
        e = validate_cleanup_evidence(evidence)
        fact = e["physical"]
        if e["identity_brackets_ref"] != digest_record(r):
            _fail("unavailable closure evidence digest mismatch", "IDENTITY_CHANGED")
        if r["physical_binding_ref"] != e["original_physical_binding_ref"] or fact["tag"] != "Unavailable" or fact["reason"] != r["reason"] or fact["observation_ref"] != r["observation_ref"]:
            _fail("unavailable closure fact mismatch", "IDENTITY_CHANGED")
    return r


def validate_cleanup_proof(value, binding_proof=None, evidence=None, physical=None):
    """Record either a full closure proof or failure. Failure never certifies closure."""
    if isinstance(value, Mapping) and value.get("tag") == "Unavailable":
        return validate_closure_unavailable(value, evidence, physical)
    return validate_closure_proof(value, binding_proof, evidence, physical)


def initial_thread_token(generation):
    return digest_record({"generation": validate_process_generation(generation), "role": "INITIAL_THREAD"})


def initial_thread_creation_ref(event, body):
    _enum(event, ("KEEPER_HELLO", "SPAWNED"))
    return digest_record(_validate_body(event, body))


def validate_thread_created(value):
    r = _closed(value, ("owner_process_generation_ref", "thread_creation_record_ref", "thread_ref", "creating_thread_ref", "before_us", "after_us"))
    for k in ("owner_process_generation_ref", "thread_creation_record_ref", "thread_ref", "creating_thread_ref"):
        _hex(r[k])
    if r["thread_ref"] == r["creating_thread_ref"]:
        _fail("new thread cannot be its own creator")
    _times(r)
    return r


def validate_reap_receipt(value):
    if not isinstance(value, Mapping):
        _fail("reap tagged union required")
    tag = value.get("tag")
    common = ("tag", "child_generation", "reaper_generation", "before_us", "after_us")
    if tag == "WAITPID_CONSUMED":
        r = _closed(value, (*common, "requested_pid", "options", "returned_pid", "raw_wait_status"))
        _enum(r["options"], ("WNOHANG",))
        _integer(r["requested_pid"], 1)
        _integer(r["returned_pid"], 1)
        status = _integer(r["raw_wait_status"], 0, 65535)
        signal = status & 127
        if signal == 127 or (signal == 0 and status & 0xff) or (signal != 0 and (signal > 64 or status & 0xff00)):
            _fail("waitpid did not consume an exited/signaled child")
    elif tag == "WAITID_CONSUMED":
        r = _closed(value, (*common, "idtype", "target_ref", "options", "return_code", "si_pid", "si_code", "si_status"))
        _enum(r["idtype"], ("P_PID", "P_PIDFD"))
        (_hex if r["idtype"] == "P_PID" else _local_ref)(r["target_ref"])
        _enum(r["options"], ("WEXITED_WNOHANG",))
        _integer(r["return_code"], 0, 0)
        _integer(r["si_pid"], 1)
        _enum(r["si_code"], ("CLD_EXITED", "CLD_KILLED", "CLD_DUMPED"))
        _integer(r["si_status"], 0 if r["si_code"] == "CLD_EXITED" else 1, 255 if r["si_code"] == "CLD_EXITED" else 64)
    elif tag == "PTHREAD_JOINED":
        r = _closed(value, ("tag", "owner_process_generation_ref", "thread_creation_record_ref", "joined_thread_ref", "joining_thread_ref", "return_code", "outcome", "before_us", "after_us"))
        for k in ("owner_process_generation_ref", "thread_creation_record_ref", "joined_thread_ref", "joining_thread_ref"):
            _hex(r[k])
        if r["joined_thread_ref"] == r["joining_thread_ref"]:
            _fail("self join is not a receipt")
        _integer(r["return_code"], 0, 0)
        _enum(r["outcome"], ("RETURNED", "CANCELED"))
        _times(r)
        return r
    else:
        _fail("legacy or unknown reap receipt", "REAP_POLICY_PENDING")
    r["child_generation"] = validate_process_generation(r["child_generation"])
    r["reaper_generation"] = validate_process_generation(r["reaper_generation"])
    child, reaper = r["child_generation"], r["reaper_generation"]
    if child["boot_id"] != reaper["boot_id"] or child["pid_namespace_ref"] != reaper["pid_namespace_ref"] or child["pid"] == reaper["pid"]:
        _fail("impossible own reaper generations")
    if tag == "WAITPID_CONSUMED" and not (r["requested_pid"] == r["returned_pid"] == child["pid"]):
        _fail("waitpid returned another child", "IDENTITY_CHANGED")
    if tag == "WAITID_CONSUMED":
        if r["si_pid"] != child["pid"] or (r["idtype"] == "P_PID" and r["target_ref"] != digest_record(child)):
            _fail("waitid target does not match original child", "IDENTITY_CHANGED")
    _times(r)
    return r


def validate_systemd_main_exit(value):
    # Fields must come ONLY from ExecMainStart/ExitTimestampMonotonic, never the
    # realtime variants. Authentic manager capture before unload is external.
    keys = ("tag", "original_process_generation", "invocation_id", "exec_main_pid", "exec_main_code", "exec_main_status", "start_timestamp_us", "exit_timestamp_us", "before_us", "after_us")
    r = _closed(value, keys)
    _enum(r["tag"], ("SYSTEMD_MAIN_EXIT",))
    r["original_process_generation"] = validate_process_generation(r["original_process_generation"])
    _hex(r["invocation_id"], 32)
    if _integer(r["exec_main_pid"], 1) != r["original_process_generation"]["pid"]:
        _fail("manager exit PID mismatch", "IDENTITY_CHANGED")
    _enum(r["exec_main_code"], ("CLD_EXITED", "CLD_KILLED", "CLD_DUMPED"))
    _integer(r["exec_main_status"], 0 if r["exec_main_code"] == "CLD_EXITED" else 1, 255 if r["exec_main_code"] == "CLD_EXITED" else 64)
    start, end = parse_u64(r["start_timestamp_us"]), parse_u64(r["exit_timestamp_us"])
    if not 0 < start <= end <= parse_u64(r["after_us"]):
        _fail("manager terminal timestamps unavailable or inconsistent")
    _times(r)
    return r


def validate_pidfd_task_released(value):
    keys = ("tag", "original_process_generation", "pidfd_identity_ref", "procfs_namespace_ref", "fdinfo_pid", "retained_original", "not_closed_or_reused", "before_us", "after_us")
    r = _closed(value, keys)
    _enum(r["tag"], ("PIDFD_TASK_RELEASED",))
    r["original_process_generation"] = validate_process_generation(r["original_process_generation"])
    _local_ref(r["pidfd_identity_ref"])
    _text(r["procfs_namespace_ref"])
    if r["procfs_namespace_ref"] != r["original_process_generation"]["pid_namespace_ref"]:
        _fail("original procfs PID namespace mismatch", "IDENTITY_CHANGED")
    _integer(r["fdinfo_pid"], -1, -1)
    _bool(r["retained_original"], True)
    _bool(r["not_closed_or_reused"], True)
    _times(r)
    return r


def validate_main_release_facts(exit_fact, release_fact):
    """Check consistency, not authenticity; retained fdinfo may follow unit unload."""
    a, b = validate_systemd_main_exit(exit_fact), validate_pidfd_task_released(release_fact)
    if a["original_process_generation"] != b["original_process_generation"]:
        _fail("release generation mismatch", "IDENTITY_CHANGED")
    if parse_u64(b["after_us"]) < parse_u64(a["exit_timestamp_us"]):
        _fail("release predates termination")
    return {"exit": a, "release": b}


def _freeze(value):
    if isinstance(value, Mapping):
        return MappingProxyType({k: _freeze(v) for k, v in value.items()})
    if type(value) in (list, tuple):
        return tuple(_freeze(v) for v in value)
    return value


def _plain(value):
    if isinstance(value, Mapping):
        return {k: _plain(v) for k, v in value.items()}
    if type(value) in (list, tuple):
        return [_plain(v) for v in value]
    return value


@dataclass(frozen=True)
class _Record:
    values: Mapping
    validator: ClassVar = None

    def __post_init__(self):
        object.__setattr__(self, "values", _freeze(type(self).validator(self.values)))

    @classmethod
    def from_mapping(cls, value):
        return cls(value)

    def to_mapping(self):
        return _plain(self.values)


@dataclass(frozen=True)
class ProcessGeneration(_Record):
    validator = staticmethod(validate_process_generation)


@dataclass(frozen=True)
class ManagerBinding(_Record):
    validator = staticmethod(validate_manager_binding)


@dataclass(frozen=True)
class UnitBinding(_Record):
    validator = staticmethod(validate_unit_binding)


@dataclass(frozen=True)
class UnitCandidate(_Record):
    validator = staticmethod(validate_unit_candidate)


@dataclass(frozen=True)
class PayloadBinding(_Record):
    validator = staticmethod(validate_payload_binding)


@dataclass(frozen=True)
class PhysicalBinding(_Record):
    validator = staticmethod(validate_physical_binding)


@dataclass(frozen=True)
class MemorySample(_Record):
    validator = staticmethod(validate_memory_sample)


@dataclass(frozen=True)
class CleanupEvidence(_Record):
    validator = staticmethod(validate_cleanup_evidence)


@dataclass(frozen=True)
class DirectoryIdentity(_Record):
    validator = staticmethod(validate_directory_identity)


@dataclass(frozen=True)
class ObserverRootBinding(_Record):
    validator = staticmethod(validate_observer_root_binding)


@dataclass(frozen=True)
class BindingProof(_Record):
    validator = staticmethod(validate_binding_proof)


@dataclass(frozen=True)
class ClosureProof(_Record):
    validator = staticmethod(validate_closure_proof)


@dataclass(frozen=True)
class ClosureUnavailable(_Record):
    validator = staticmethod(validate_closure_unavailable)


def _validate_body(event, value):
    fields = {
        "ARM": ("run_spec", "payload_expected_sha256"),
        "ARMED": ("watchdog_generation", "manager_binding", "observer_root_binding", "payload_binding", "slots_ledger_ref", "work_deadline_us", "cleanup_deadline_us"),
        "RUN_SLOT": ("slot_spec_sha256",),
        "START_DISPATCHED": ("slot_record_ref", "start_request_ref", "deadline_us"),
        "UNIT_BOUND": ("unit_binding", "start_job_ref"),
        "KEEPER_HELLO": ("pid", "start_ticks", "exe_sha256", "uid", "gid", "groups", "no_new_privs", "cap_eff", "cap_perm", "cap_inh", "cap_amb"),
        "LOAD_PERMIT": ("unit_binding_ref", "physical_binding_ref", "scenario", "work_deadline_us", "cleanup_deadline_us"),
        "SPAWNED": ("child_generation", "parent_generation_ref", "role", "spawn_record_ref"),
        "THREAD_CREATED": ("owner_process_generation_ref", "thread_creation_record_ref", "thread_ref", "creating_thread_ref", "before_us", "after_us"),
        "REAPED": ("receipt",),
        "CHECKPOINT_READY": ("spawn_ledger_ref", "reap_ledger_ref", "keeper_generation_ref"),
        "MEMORY_SAMPLE": ("sample",),
        "BEGIN_CLEANUP": ("reason",),
        "QUIESCE": ("reason", "cleanup_deadline_us"),
        "STOP_DISPATCHED": ("original_unit_binding_ref", "stop_request_ref", "deadline_us"),
        "CLEANUP_EVIDENCE": ("evidence",),
        "FINAL": ("status", "slots", "metric_records_ref", "slot_ledger_ref", "cleanup_records_ref", "memory_reclamation", "missing_evidence"),
        "FAULT": ("code", "at_event", "identity_ref", "missing_evidence"),
        "ACK": ("accepted_seq", "ledger_record_sha256"),
    }
    r = _closed(value, fields[event])
    for k in r:
        if k.endswith("_ref") or k.endswith("_sha256"):
            _hex(r[k])
        elif k.endswith("_us"):
            parse_u64(r[k])
    if event == "ARM":
        spec = RunSpec.from_mapping(r["run_spec"])
        r["run_spec"] = spec.to_mapping()
        if r["payload_expected_sha256"] != spec.payload_expected_sha256:
            _fail("ARM payload digest mismatch", "IDENTITY_CHANGED")
    elif event == "ARMED":
        r["watchdog_generation"] = validate_process_generation(r["watchdog_generation"])
        r["manager_binding"] = validate_manager_binding(r["manager_binding"])
        # The observer root is an identity digest, not a received directory FD.
        _hex(r["observer_root_binding"])
        r["payload_binding"] = validate_payload_binding(r["payload_binding"])
        if parse_u64(r["work_deadline_us"]) >= parse_u64(r["cleanup_deadline_us"]):
            _fail("ARMED deadline order")
    elif event == "UNIT_BOUND":
        r["unit_binding"] = validate_unit_binding(r["unit_binding"])
    elif event == "KEEPER_HELLO":
        _integer(r["pid"], 1)
        if parse_u64(r["start_ticks"]) == 0:
            _fail("unknown keeper generation")
        _integer(r["uid"], 1)
        _integer(r["gid"])
        r["groups"] = _groups(r["groups"])
        _bool(r["no_new_privs"], True)
        for k in ("cap_eff", "cap_perm", "cap_inh", "cap_amb"):
            if parse_u64(r[k]) != 0:
                _fail("keeper capability forbidden", "AUTHORITY")
    elif event == "LOAD_PERMIT":
        _enum(r["scenario"], SCENARIOS)
        if parse_u64(r["work_deadline_us"]) >= parse_u64(r["cleanup_deadline_us"]):
            _fail("permit deadline order")
    elif event == "SPAWNED":
        r["child_generation"] = validate_process_generation(r["child_generation"])
        _enum(r["role"], ("LOAD", "SURVIVOR", "DESCENDANT"))
    elif event == "THREAD_CREATED":
        r = validate_thread_created(r)
    elif event == "REAPED":
        r["receipt"] = validate_reap_receipt(r["receipt"])
    elif event == "MEMORY_SAMPLE":
        r["sample"] = validate_memory_sample(r["sample"])
    elif event in ("BEGIN_CLEANUP", "QUIESCE"):
        _enum(r["reason"], ("NORMAL", "FAULT", "DEADLINE"))
    elif event == "CLEANUP_EVIDENCE":
        r["evidence"] = validate_cleanup_evidence(r["evidence"])
    elif event == "FINAL":
        _enum(r["status"], ("COMPLETE", "INCOMPLETE", "INVALID"))
        statuses = _array(r["slots"])
        if len(statuses) != 3:
            _fail("FINAL requires exact reserved slots")
        result = []
        for item in statuses:
            item = _closed(item, ("slot", "leaf_status"))
            _integer(item["slot"], 0, 2)
            _enum(item["leaf_status"], ("CLOSED_EMPTY", "CLOSED_REMOVED", "UNKNOWN"))
            result.append(item)
        if [v["slot"] for v in result] != [0, 1, 2]:
            _fail("FINAL slot order/uniqueness")
        r["slots"] = result
        _enum(r["memory_reclamation"], (MEMORY_RECLAMATION,))
        r["missing_evidence"] = _codes(r["missing_evidence"])
        if r["status"] == "COMPLETE" and (r["missing_evidence"] or any(s["leaf_status"] != "CLOSED_REMOVED" for s in result)):
            _fail("COMPLETE contradicts removal/evidence obligations")
    elif event == "FAULT":
        _enum(r["code"], FAULT_CODES)
        _enum(r["at_event"], EVENTS)
        r["missing_evidence"] = _codes(r["missing_evidence"])
    elif event == "ACK":
        _integer(r["accepted_seq"], 1, U64_MAX)
    return r


EVENT_SENDERS = {
    "ARM": "COORDINATOR", "ARMED": "WATCHDOG", "RUN_SLOT": "COORDINATOR",
    "START_DISPATCHED": "WATCHDOG", "UNIT_BOUND": "WATCHDOG", "KEEPER_HELLO": "KEEPER",
    "LOAD_PERMIT": "WATCHDOG", "SPAWNED": "KEEPER", "THREAD_CREATED": "KEEPER", "REAPED": "KEEPER",
    "CHECKPOINT_READY": "KEEPER", "MEMORY_SAMPLE": "WATCHDOG", "BEGIN_CLEANUP": "COORDINATOR",
    "QUIESCE": "WATCHDOG", "STOP_DISPATCHED": "WATCHDOG", "CLEANUP_EVIDENCE": "WATCHDOG",
    "FINAL": "WATCHDOG", "FAULT": None, "ACK": "WATCHDOG",
}
EVENTS = frozenset(EVENT_SENDERS)
RUN_LEVEL_EVENTS = frozenset(("ARM", "ARMED", "BEGIN_CLEANUP", "FINAL"))


@dataclass(frozen=True)
class Envelope:
    v: int
    run: str
    sender: str
    seq: int
    slot: int | None
    event: str
    request: int | None
    mono_us: int
    body: Mapping

    def __post_init__(self):
        _integer(self.v, VERSION, VERSION)
        _hex(self.run, 32)
        _enum(self.sender, SENDERS)
        _integer(self.seq, 1, U64_MAX)
        _enum(self.event, EVENTS)
        if EVENT_SENDERS[self.event] is not None and self.sender != EVENT_SENDERS[self.event]:
            _fail("event sender mismatch", "AUTHENTICATION")
        if self.event in RUN_LEVEL_EVENTS:
            if self.slot is not None:
                _fail("run-level slot must be null")
        elif self.event not in ("FAULT", "ACK") or self.slot is not None:
            _integer(self.slot, 0, 2)
        if self.request is not None:
            _integer(self.request, 1, U64_MAX)
        _clock_int(self.mono_us)
        body = _validate_body(self.event, self.body)
        if self.event == "ARM" and body["run_spec"]["run"] != self.run:
            _fail("ARM run mismatch", "IDENTITY_CHANGED")
        if self.event == "UNIT_BOUND" and body["unit_binding"]["slot"] != self.slot:
            _fail("unit slot mismatch", "IDENTITY_CHANGED")
        if self.event == "CLEANUP_EVIDENCE" and body["evidence"]["slot"] != self.slot:
            _fail("evidence slot mismatch", "IDENTITY_CHANGED")
        if self.event == "ACK" and self.request != body["accepted_seq"]:
            _fail("ACK request mismatch")
        object.__setattr__(self, "body", _freeze(body))
        _json_shape(self.to_mapping())

    @classmethod
    def from_mapping(cls, value):
        r = _closed(value, ("v", "run", "sender", "seq", "slot", "event", "request", "mono_us", "body"))
        r["mono_us"] = parse_u64(r["mono_us"])
        return cls(**r)

    def to_mapping(self):
        return {"v": self.v, "run": self.run, "sender": self.sender, "seq": self.seq, "slot": self.slot, "event": self.event, "request": self.request, "mono_us": str(self.mono_us), "body": _plain(self.body)}


def _json_shape(value, depth=0):
    if isinstance(value, Mapping):
        if depth > MAX_DEPTH or any(type(k) is not str for k in value):
            _fail("JSON object depth/key rejected")
        for v in value.values():
            _json_shape(v, depth + 1)
    elif type(value) in (list, tuple):
        if depth > MAX_DEPTH or len(value) > MAX_ARRAY_ITEMS:
            _fail("JSON array limit exceeded")
        for v in value:
            _json_shape(v, depth + 1)
    elif type(value) is str:
        try:
            value.encode("utf-8", "strict")
        except UnicodeError:
            _fail("invalid Unicode text")
    elif value is not None and type(value) not in (bool, int):
        _fail("non-JSON or floating value forbidden")


def _pairs(pairs):
    result = {}
    for key, value in pairs:
        if key in result:
            _fail("duplicate JSON key")
        result[key] = value
    return result


def _reject_float(_value):
    _fail("floating/nonfinite JSON forbidden")


def decode_packet(packet: bytes) -> Envelope:
    if type(packet) is not bytes or not 0 < len(packet) <= MAX_PACKET_BYTES:
        _fail("packet size/type rejected")
    try:
        value = json.loads(packet.decode("utf-8", "strict"), object_pairs_hook=_pairs, parse_float=_reject_float, parse_constant=_reject_float)
    except ContractError:
        raise
    except (UnicodeError, ValueError, RecursionError, OverflowError):
        _fail("invalid JSON packet")
    _json_shape(value)
    return Envelope.from_mapping(value)


def encode_packet(value: Envelope | Mapping) -> bytes:
    envelope = value if isinstance(value, Envelope) else Envelope.from_mapping(value)
    result = json.dumps(envelope.to_mapping(), ensure_ascii=False, sort_keys=True, separators=(",", ":"), allow_nan=False).encode("utf-8")
    if len(result) > MAX_PACKET_BYTES:
        _fail("packet size exceeded")
    return result


def digest_record(value) -> str:
    if isinstance(value, (RunSpec, SlotSpec, Envelope, _Record)):
        value = value.to_mapping()
    _json_shape(value)
    try:
        raw = json.dumps(_plain(value), ensure_ascii=False, sort_keys=True, separators=(",", ":"), allow_nan=False).encode("utf-8")
    except (ValueError, TypeError, UnicodeError):
        _fail("record cannot be canonically encoded")
    return hashlib.sha256(raw).hexdigest()


class SequenceGuard:
    """Per-channel strict sequence and one-shot acceptance; authentication is external."""
    def __init__(self):
        self._last = 0

    def accept(self, sequence: int):
        _integer(sequence, 1, U64_MAX)
        if sequence != self._last + 1:
            _fail("sequence replay or gap")
        self._last = sequence

    @property
    def last(self):
        return self._last
