"""V3 ELF distribution. No systemd, cgroup authority, compiler or executor.

The caller supplies an existing control identity and an already-built ELF. Real
staging is Linux-only and defaults to /run/elogistix-memory-<run>/keeper.elf.
``allow_test_root`` permits a different *protected* root for Linux filesystem
tests; it does not waive the identity, ACL or ownership checks.

SettlementAuthority is the explicit adapter boundary to the watchdog. Its
owner must validate authentic job, child-reap, manager/pidfd and physical
receipts before issuing a token. Distribution validates its typed scope and
local issuer provenance; it does not observe cgroups or certify process exit.
That legacy local capability is an explicit review adapter, not the v3 native
production authority. RuntimeDistribution requires the exact local
__main__.NativeSettlementAuthority and obtains its complete original
release graph afresh; a registry-issued token cannot enable production release.
Its parent prepares only the image. The own-fork watchdog child creates the
protected watchdog.sock listener, so its kernel peer credentials name the child.
No numeric descriptor is accepted from or exported to a peer. The retained
read descriptor pins the exact object hashed; protected path entries retain
its identity until the external authority settles every possible activation.
"""

from __future__ import annotations

import errno
import hashlib
import importlib
import json
import os
import re
import socket
import stat
import struct
import sys
import time
from dataclasses import dataclass, fields
from pathlib import PurePosixPath
from types import MappingProxyType
from typing import Iterator, Mapping


CONTRACT_LIBRARY_VERSION = 3
CONTRACT_SHA256 = "ecf42be8ad6850810efbb73408d16347fdac2891e3562b0e00495030c4615ee8"
CLEANUP_POLICY = "physical-cleanup-union-v1"
PENDING_EXEC_IDENTITY = "PENDING_BEFORE_EXEC"
KEEPER_LISTENER_BASENAME = "watchdog.sock"
MAX_ELF_BYTES = 16 * 1024 * 1024  # Same bound as the native backend verifier.
_HEX32 = re.compile(r"[0-9a-f]{32}\Z")
_HEX64 = re.compile(r"[0-9a-f]{64}\Z")
_U64 = re.compile(r"(?:0|[1-9][0-9]*)\Z")
_UNIT = re.compile(r"elogistix-memory-adapter-[0-9a-f]{32}\.service\Z")
_SCENARIOS = frozenset(("OVERLAP", "LEADER_EXIT_THREAD_SURVIVES", "DESCENDANT_IGNORES_TERM"))


class DistributionError(RuntimeError):
    """A closed failure code and detail; never an implicit fallback."""

    def __init__(self, code: str, detail: str):
        self.code = code
        self.detail = detail
        super().__init__(f"{code}: {detail}")


def _fail(code: str, detail: str) -> None:
    raise DistributionError(code, detail)


def _uint(value: object, bits: int, name: str, *, decimal: bool = False) -> int:
    # Typed internal dataclasses may use integers; wire decimal strings remain
    # canonical. bool is never an integer in the ABI.
    if isinstance(value, str) and decimal:
        if len(value) > 20 or not _U64.fullmatch(value):
            _fail("INVALID_SPEC", f"{name} is not a canonical decimal")
        value = int(value)
    if type(value) is not int or not 0 <= value < (1 << bits):
        _fail("INVALID_SPEC", f"{name} exceeds uint{bits}")
    return value


def _ref(value: object, name: str) -> str:
    if not isinstance(value, str) or not _HEX64.fullmatch(value):
        _fail("INVALID_RECEIPT", f"{name} is not a sha256 reference")
    return value


def _record_ref(record: object) -> str:
    encoded = json.dumps(record, sort_keys=True, separators=(",", ":"),
                         ensure_ascii=False, allow_nan=False).encode("utf-8")
    return hashlib.sha256(encoded).hexdigest()


def canonical_digest(record: object) -> str:
    """Contract-v3 canonical digest; equality/correlation, no authenticity."""
    return _record_ref(record)


def _as_fields(value: object, expected: set[str], name: str) -> dict[str, object]:
    if isinstance(value, Mapping):
        data = dict(value)
    else:
        # Shared contracts are immutable dataclasses; do not accept dynamic
        # attribute bags as an alternative message parser.
        try:
            data = {field.name: getattr(value, field.name) for field in fields(value)}
        except (TypeError, AttributeError):
            _fail("INVALID_SPEC", f"{name} must be a mapping or dataclass")
    if set(data) != expected:
        _fail("INVALID_SPEC", f"{name} has missing or additional fields")
    return data


@dataclass(frozen=True, slots=True)
class PayloadBinding(Mapping[str, object]):
    kind: str
    sha256: str
    absolute_path: str
    dev: str
    inode: str
    mount_namespace_ref: str
    owner_uid: int
    protected_ancestor_refs: tuple[str, ...]
    exec_identity_proof_ref: str

    def __getitem__(self, key: str) -> object:
        if key not in {field.name for field in fields(self)}:
            raise KeyError(key)
        return getattr(self, key)

    def __iter__(self) -> Iterator[str]:
        return iter(field.name for field in fields(self))

    def __len__(self) -> int:
        return len(fields(self))

    def to_mapping(self) -> dict[str, object]:
        result = dict(self)
        result["protected_ancestor_refs"] = list(self.protected_ancestor_refs)
        return result

    @property
    def reference(self) -> str:
        return _record_ref({field.name: getattr(self, field.name) for field in fields(self)})


@dataclass(frozen=True, slots=True)
class VerifiedPayload:
    """Pre-exec hash/path proof only; not proof that this image was executed.

    exec_identity_proof_ref remains pending until the watchdog authenticates
    the kernel peer generation and its /proc executable dev/inode/hash against
    this retained image in the original mount namespace.
    """

    binding: PayloadBinding
    verified_us: str
    valid_until_us: str
    proof_ref: str


@dataclass(frozen=True, slots=True)
class SettledSlotEvidence:
    """External validated receipt references, not self-reap or booleans.

    keeper_exit_ref combines authentic SYSTEMD_MAIN_EXIT for the original
    InvocationID/ExecMain identity with PIDFD_TASK_RELEASED from the retained
    original pidfd (fdinfo Pid:-1). The authentic manager snapshot must be
    obtained before unit unload; the original retained pidfd observation may
    follow unload. POLLIN, Pid:0 or a guessed death are not
    process-release receipts. The watchdog does not waitpid a service parented
    by PID1. reap_ledger_ref covers actual owned children/thread joins and
    cannot be replaced by leaf disappearance.
    """

    slot: int
    original_unit_binding_ref: str
    original_physical_binding_ref: str
    start_settlement_ref: str
    stop_settlement_ref: str
    activation_settlement_ref: str
    reap_ledger_ref: str
    keeper_exit_ref: str
    final_unit_observation_ref: str
    physical_observation_ref: str
    physical_tag: str
    leaf_status: str
    observed_us: str
    lease_until_us: str


@dataclass(frozen=True, slots=True)
class NeverActivatedSlotEvidence:
    """External proof of an irreversibly closed, undispatched reservation.

    A consumed allowance, dropped Start reply, uncertain outcome, or possible
    later activation cannot use this variant. It carries no fictional unit,
    physical-leaf, keeper-exit or child-reap identities.
    """

    slot: int
    reservation_ref: str
    dispatch_state: str
    activation_settlement_ref: str
    no_future_exec_ref: str
    observed_us: str
    lease_until_us: str


@dataclass(frozen=True, slots=True)
class SettlementFacts:
    run: str
    payload_binding_ref: str
    cleanup_policy_id: str
    cleanup_deadline_us: str
    authority_binding_ref: str
    slot_ledger_ref: str
    slots: tuple[SettledSlotEvidence | NeverActivatedSlotEvidence, ...]
    # A separate receipt settles pending/future own exec after every activation
    # and terminal original-unit observation. It is never a guessed boolean.
    no_future_exec_ref: str
    observed_us: str
    lease_until_us: str


class SettledCleanupReceipt:
    """Opaque local token. Only an injected external authority can issue it."""

    __slots__ = ("_issuer", "_token")

    def __init__(self, *_args: object, **_kwargs: object):
        _fail("INVALID_RECEIPT", "receipt must be issued by the watchdog authority")

    def __setattr__(self, _name: str, _value: object) -> None:
        raise AttributeError("settlement tokens are immutable")


class SettlementAuthority:
    """Local capability owned by the independent watchdog verifier.

    ``issue`` is called only after that verifier has authenticated the facts.
    This module does not claim a sha256 string alone authenticates a receipt.
    Keep this object within trusted control code; never expose it to workload
    messages or reconstruct it from a received dictionary.
    """

    def __init__(self):
        self._issued: dict[object, tuple[SettledCleanupReceipt, SettlementFacts]] = {}

    def issue(self, facts: SettlementFacts) -> SettledCleanupReceipt:
        _validate_facts(facts)
        receipt = object.__new__(SettledCleanupReceipt)
        object.__setattr__(receipt, "_issuer", self)
        object.__setattr__(receipt, "_token", object())
        self._issued[receipt._token] = (receipt, facts)
        return receipt

    def _consume(self, receipt: SettledCleanupReceipt) -> None:
        del self._issued[receipt._token]

    def _facts_for(self, receipt: object) -> SettlementFacts:
        if type(receipt) is not SettledCleanupReceipt:
            _fail("INVALID_RECEIPT", "foreign, fabricated or consumed settlement token")
        try:
            retained = self._issued.get(receipt._token)
            if receipt._issuer is not self or retained is None or retained[0] is not receipt:
                _fail("INVALID_RECEIPT", "foreign, fabricated or consumed settlement token")
        except AttributeError:
            _fail("INVALID_RECEIPT", "uninitialized settlement token")
        return retained[1]


@dataclass(frozen=True, slots=True)
class ReleaseReceipt:
    run: str
    payload_binding_ref: str
    settlement_receipt_ref: str
    released_us: str
    status: str = "RELEASED"


@dataclass(frozen=True, slots=True)
class RetainedReleaseEvidence:
    """Local full image-identity facts; not a new wire receipt-graph ABI.

    The original binding and before/after actual descriptor metadata remain
    available after handles close. This proves image-object correlation only;
    process/job/physical settlement is still the external authority's duty.
    """

    original_binding: PayloadBinding
    original_snapshot: tuple[int, ...]
    descriptor_after_unlink_snapshot: tuple[int, ...]
    before_us: str
    after_us: str
    receipt: ReleaseReceipt


def _validate_facts(facts: object) -> None:
    if type(facts) is not SettlementFacts:
        _fail("INVALID_RECEIPT", "settlement facts must be typed")
    if not isinstance(facts.run, str) or not _HEX32.fullmatch(facts.run):
        _fail("INVALID_RECEIPT", "run is invalid")
    if facts.cleanup_policy_id != CLEANUP_POLICY:
        _fail("INVALID_RECEIPT", "cleanup policy is not the reviewed union")
    for name in ("payload_binding_ref", "authority_binding_ref", "slot_ledger_ref", "no_future_exec_ref"):
        _ref(getattr(facts, name), name)
    observed = _uint(facts.observed_us, 64, "observed_us", decimal=True)
    lease = _uint(facts.lease_until_us, 64, "lease_until_us", decimal=True)
    deadline = _uint(facts.cleanup_deadline_us, 64, "cleanup_deadline_us", decimal=True)
    if not observed < lease <= deadline:
        _fail("INVALID_RECEIPT", "settlement observation/lease exceeds deadline")
    if type(facts.slots) is not tuple or len(facts.slots) != 3:
        _fail("INVALID_RECEIPT", "exactly three original slot receipts are required")
    if any(type(item) not in (SettledSlotEvidence, NeverActivatedSlotEvidence) for item in facts.slots):
        _fail("INVALID_RECEIPT", "slots must use a closed typed settlement variant")
    if tuple(item.slot for item in facts.slots) != (0, 1, 2):
        _fail("INVALID_RECEIPT", "slots must be ordered and exactly 0,1,2")
    for item in facts.slots:
        _uint(item.slot, 32, "slot.slot")
        for field in fields(item):
            if field.name.endswith("_ref"):
                _ref(getattr(item, field.name), field.name)
        if type(item) is NeverActivatedSlotEvidence:
            if item.dispatch_state != "NOT_DISPATCHED":
                _fail("INVALID_RECEIPT", "unknown or consumed activation cannot use the never-activated variant")
        elif ((item.physical_tag, item.leaf_status) not in
              (("PresentEmpty", "CLOSED_EMPTY"), ("OriginalAbsent", "CLOSED_REMOVED"))):
            _fail("INVALID_RECEIPT", "physical uncertainty cannot release an ELF")
        before = _uint(item.observed_us, 64, "slot.observed_us", decimal=True)
        until = _uint(item.lease_until_us, 64, "slot.lease_until_us", decimal=True)
        if not before <= observed < lease <= until <= deadline:
            _fail("INVALID_RECEIPT", "slot evidence is stale or outside its lease")
    # Closed slots cannot reuse one original identity as evidence for several
    # units. Other receipt references may legitimately cover multiple slots;
    # their independent correlation remains the external verifier's job.
    created = tuple(item for item in facts.slots if type(item) is SettledSlotEvidence)
    for name in ("original_unit_binding_ref", "original_physical_binding_ref"):
        references = tuple(getattr(item, name) for item in created)
        if len(set(references)) != len(references):
            _fail("INVALID_RECEIPT", f"created slots reuse {name}")
    never = tuple(item for item in facts.slots if type(item) is NeverActivatedSlotEvidence)
    reservations = tuple(item.reservation_ref for item in never)
    if len(set(reservations)) != len(reservations):
        _fail("INVALID_RECEIPT", "never-activated slots reuse reservation_ref")


@dataclass(frozen=True, slots=True)
class _Spec:
    run: str
    t0_us: int
    work_deadline_us: int
    cleanup_deadline_us: int
    load_uid: int
    load_gid: int
    load_group_ids: tuple[int, ...]
    sha256: str


def _contract_slot_spec_class() -> type:
    """Resolve the verified sibling policy's nominal class without a quota knob.

    The assembled contract owns the fixed memory/task profile. Distribution
    retains its own closed RunSpec parser and exact original slot ordering.
    Standalone pure imports do not import a CLI or perform native operations.
    """
    if not __package__:
        _fail("AUTHORITY_ABI_PENDING", "slot policy requires the installed sibling contracts")
    try:
        module = importlib.import_module(__package__ + ".contracts")
        slot_type = module.SlotSpec
    except (ImportError, AttributeError) as exc:
        raise DistributionError("AUTHORITY_ABI_PENDING", "nominal sibling SlotSpec policy is unavailable") from exc
    if (type(slot_type) is not type or slot_type.__module__ != module.__name__
            or slot_type.__name__ != "SlotSpec"):
        _fail("INVALID_SPEC", "contracts does not expose its original nominal SlotSpec")
    return slot_type


def _validate_slot_policy(item: Mapping[str, object]) -> None:
    memory = _uint(item["memory_max_bytes"], 64, "memory_max_bytes")
    tasks = _uint(item["tasks_max"], 32, "tasks_max")
    slot_type = _contract_slot_spec_class()
    try:
        slot = slot_type(slot=item["slot"], unit_name=item["unit_name"], scenario=item["scenario"],
                         memory_max_bytes=memory, tasks_max=tasks)
    except (TypeError, ValueError) as exc:
        raise DistributionError("INVALID_SPEC", "slot policy conflicts with the fixed nominal contract") from exc
    if type(slot) is not slot_type:
        _fail("INVALID_SPEC", "slot policy did not construct the original nominal SlotSpec")


def validate_run_spec(run_spec: object) -> _Spec:
    """Pure parser, usable on Windows without claiming Linux validation."""
    data = _as_fields(run_spec, {"run", "t0_us", "work_deadline_us", "cleanup_deadline_us", "slots",
                                  "load_uid", "load_gid", "load_groups", "payload_expected_sha256",
                                  "cleanup_policy_id", "scope_ref"}, "RunSpec")
    run = data["run"]
    sha = data["payload_expected_sha256"]
    if not isinstance(run, str) or not _HEX32.fullmatch(run):
        _fail("INVALID_SPEC", "run must be 32 lowercase hex characters")
    if not isinstance(sha, str) or not _HEX64.fullmatch(sha):
        _fail("INVALID_SPEC", "payload_expected_sha256 must be 64 lowercase hex characters")
    t0 = _uint(data["t0_us"], 64, "t0_us", decimal=True)
    work = _uint(data["work_deadline_us"], 64, "work_deadline_us", decimal=True)
    cleanup = _uint(data["cleanup_deadline_us"], 64, "cleanup_deadline_us", decimal=True)
    if work != t0 + 50_000_000 or cleanup != t0 + 60_000_000:
        _fail("INVALID_SPEC", "deadlines must preserve the original 50s/60s origin")
    uid = _uint(data["load_uid"], 32, "load_uid")
    gid = _uint(data["load_gid"], 32, "load_gid")
    if uid == 0:
        _fail("INVALID_SPEC", "workload UID must be normal and nonzero")
    groups = data["load_groups"]
    if type(groups) not in (list, tuple) or len(groups) > 32:
        _fail("INVALID_SPEC", "load_groups must be a bounded array")
    parsed_groups = tuple(_uint(group, 32, "load_groups") for group in groups)
    if tuple(sorted(set(parsed_groups))) != parsed_groups:
        _fail("INVALID_SPEC", "load_groups must be sorted and distinct")
    if data["cleanup_policy_id"] != CLEANUP_POLICY:
        _fail("INVALID_SPEC", "cleanup policy must be the reviewed union")
    scope = data["scope_ref"]
    if not isinstance(scope, str) or not scope or len(scope) > 512 or "\x00" in scope:
        _fail("INVALID_SPEC", "scope_ref is required")
    slots = data["slots"]
    if type(slots) not in (tuple, list) or len(slots) != 3:
        _fail("INVALID_SPEC", "RunSpec must reserve exactly three slots")
    names: set[str] = set()
    for position, value in enumerate(slots):
        item = _as_fields(value, {"slot", "unit_name", "scenario", "memory_max_bytes", "tasks_max"}, "SlotSpec")
        if _uint(item["slot"], 32, "slot") != position:
            _fail("INVALID_SPEC", "slots must be ordered exactly 0,1,2")
        name = item["unit_name"]
        if not isinstance(name, str) or not _UNIT.fullmatch(name) or name in names:
            _fail("INVALID_SPEC", "unit_name is outside the closed unique prefix")
        names.add(name)
        if not isinstance(item["scenario"], str) or item["scenario"] not in _SCENARIOS:
            _fail("INVALID_SPEC", "scenario is outside the closed enum")
        _validate_slot_policy(item)
    return _Spec(run, t0, work, cleanup, uid, gid, tuple(sorted(set((gid, *parsed_groups)))), sha)


def run_spec_fingerprint(run_spec: object) -> str:
    """Snapshot every immutable field, canonicalizing internal u64 integers.

    This is a pure equality check, not approval of scope or native authority.
    Caller-owned mutable mappings are copied rather than retained by reference.
    """
    spec = validate_run_spec(run_spec)
    data = _as_fields(run_spec, {"run", "t0_us", "work_deadline_us", "cleanup_deadline_us", "slots",
                                  "load_uid", "load_gid", "load_groups", "payload_expected_sha256",
                                  "cleanup_policy_id", "scope_ref"}, "RunSpec")
    result = dict(data)
    result["t0_us"] = str(spec.t0_us)
    result["work_deadline_us"] = str(spec.work_deadline_us)
    result["cleanup_deadline_us"] = str(spec.cleanup_deadline_us)
    result["load_groups"] = list(data["load_groups"])
    result["slots"] = []
    for slot in data["slots"]:
        item = _as_fields(slot, {"slot", "unit_name", "scenario", "memory_max_bytes", "tasks_max"}, "SlotSpec")
        item["memory_max_bytes"] = str(_uint(item["memory_max_bytes"], 64, "memory_max_bytes", decimal=True))
        result["slots"].append(item)
    return canonical_digest(result)


def _linux() -> None:
    if sys.platform != "linux":
        _fail("UNSUPPORTED_PLATFORM", "real protected ELF staging requires Linux; no kernel result established")
    for constant in ("O_DIRECTORY", "O_NOFOLLOW", "O_CLOEXEC"):
        if not hasattr(os, constant):
            _fail("UNSUPPORTED_PLATFORM", f"Linux {constant} is unavailable")


def _now_us() -> int:
    return time.clock_gettime_ns(time.CLOCK_MONOTONIC) // 1000


def _namespace() -> str:
    try:
        value = os.readlink("/proc/self/ns/mnt")
    except OSError as exc:
        _fail("IDENTITY_CHANGED", f"cannot bind mount namespace: errno={exc.errno}")
    if not re.fullmatch(r"mnt:\[[1-9][0-9]*\]", value):
        _fail("IDENTITY_CHANGED", "mount namespace cannot be bound")
    return value


def _mount_id(fd: int) -> int:
    with open(f"/proc/self/fdinfo/{fd}", "rt", encoding="ascii") as stream:
        entries = [line.split(":", 1)[1].strip() for line in stream if line.startswith("mnt_id:")]
    if len(entries) != 1 or not entries[0].isdigit():
        _fail("IDENTITY_CHANGED", "retained object has no unique mount id")
    return int(entries[0])


def _identity(fd: int) -> tuple[int, ...]:
    item = os.fstat(fd)
    return (item.st_dev, item.st_ino, _mount_id(fd), item.st_uid, item.st_gid, stat.S_IMODE(item.st_mode))


def _no_acl(fd: int) -> None:
    try:
        attributes = os.listxattr(fd)
    except OSError as exc:
        _fail("ACL_UNCERTAIN", f"cannot inspect access ACLs: errno={exc.errno}")
    if "system.posix_acl_access" in attributes or "system.posix_acl_default" in attributes:
        _fail("ACL_UNCERTAIN", "extended access/default ACL requires an external reviewed proof")
    if "security.capability" in attributes:
        _fail("INVALID_ELF", "file capabilities are forbidden")


def _check_directory(fd: int, control_uid: int, load_uid: int,
                     load_group_ids: tuple[int, ...]) -> tuple[int, ...]:
    item = os.fstat(fd)
    if not stat.S_ISDIR(item.st_mode):
        _fail("UNPROTECTED_PATH", "ancestor is not a directory")
    if item.st_uid == load_uid or item.st_uid not in (0, control_uid):
        _fail("UNPROTECTED_PATH", "ancestor owner is not a trusted control identity")
    if stat.S_IMODE(item.st_mode) & 0o022:
        _fail("UNPROTECTED_PATH", "ancestor is writable outside its owner")
    execute_bit = stat.S_IXGRP if item.st_gid in load_group_ids else stat.S_IXOTH
    if not item.st_mode & execute_bit:
        _fail("UNEXECUTABLE_PATH", "workload identity cannot traverse a protected ancestor")
    _no_acl(fd)
    return _identity(fd)


@dataclass(slots=True)
class _Directory:
    fd: int
    name: str
    identity: tuple[int, ...]


def _absolute_path(value: object, name: str) -> PurePosixPath:
    try:
        text = os.fspath(value)
    except TypeError:
        _fail("INVALID_PATH", f"{name} must be an absolute canonical POSIX path")
    if not isinstance(text, str):
        _fail("INVALID_PATH", f"{name} must be a text path")
    path = PurePosixPath(text)
    if not path.is_absolute() or "\x00" in text or ".." in path.parts or "." in text.split("/"):
        _fail("INVALID_PATH", f"{name} must be an absolute canonical path")
    # Path normalizes duplicate separators; reject them before filesystem use.
    if str(path) != text or text.startswith("//"):
        _fail("INVALID_PATH", f"{name} must not contain redundant separators")
    return path


def _walk(parent: PurePosixPath, control_uid: int, load_uid: int,
          load_group_ids: tuple[int, ...]) -> list[_Directory]:
    if len(parent.parts) + 1 > 32:
        _fail("INVALID_PATH", "protected ancestors exceed the V3 array bound")
    result: list[_Directory] = []
    flags = os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW | os.O_CLOEXEC
    try:
        fd = os.open("/", flags)
        try:
            identity = _check_directory(fd, control_uid, load_uid, load_group_ids)
        except BaseException:
            os.close(fd)
            raise
        result.append(_Directory(fd, "/", identity))
        for name in parent.parts[1:]:
            fd = os.open(name, flags, dir_fd=result[-1].fd)
            try:
                identity = _check_directory(fd, control_uid, load_uid, load_group_ids)
            except BaseException:
                os.close(fd)
                raise
            result.append(_Directory(fd, name, identity))
        return result
    except BaseException:
        for item in reversed(result):
            os.close(item.fd)
        raise


def _file_snapshot(fd: int) -> tuple[int, ...]:
    item = os.fstat(fd)
    if not stat.S_ISREG(item.st_mode) or item.st_nlink != 1:
        _fail("INVALID_ELF", "ELF must be a regular file with one link")
    if not 64 <= item.st_size <= MAX_ELF_BYTES:
        _fail("INVALID_ELF", "ELF size is outside the explicit distribution bound")
    if item.st_mode & (stat.S_ISUID | stat.S_ISGID):
        _fail("INVALID_ELF", "setuid/setgid executable is forbidden")
    _no_acl(fd)
    return (*_identity(fd), item.st_size, item.st_nlink, item.st_mtime_ns, item.st_ctime_ns)


def _hash_elf(fd: int, deadline_us: int) -> tuple[str, tuple[int, ...]]:
    before = _file_snapshot(fd)
    digest = hashlib.sha256()
    offset = 0
    header = b""
    while True:
        if _now_us() >= deadline_us:
            _fail("DEADLINE", "ELF verification exhausted its original absolute deadline")
        chunk = os.pread(fd, 128 * 1024, offset)
        if not chunk:
            break
        if offset == 0:
            header = chunk[:64]
        digest.update(chunk)
        offset += len(chunk)
        if offset > MAX_ELF_BYTES:
            _fail("INVALID_ELF", "ELF grew past its explicit bound")
    if (len(header) < 64 or header[:4] != b"\x7fELF" or header[4] not in (1, 2)
            or header[5] not in (1, 2) or header[6] != 1):
        _fail("INVALID_ELF", "payload is not an ELF image")
    endian = "little" if header[5] == 1 else "big"
    if int.from_bytes(header[16:18], endian) not in (2, 3) or int.from_bytes(header[18:20], endian) == 0:
        _fail("INVALID_ELF", "ELF must be an executable or position-independent executable")
    after = _file_snapshot(fd)
    if before != after or offset != before[6]:
        _fail("IDENTITY_CHANGED", "ELF changed while being hashed")
    if _now_us() >= deadline_us:
        _fail("DEADLINE", "ELF verification completed after its original deadline")
    return digest.hexdigest(), after


def _check_executable_mount(fd: int) -> None:
    if not hasattr(os, "ST_NOEXEC"):
        _fail("UNSUPPORTED_PLATFORM", "cannot inspect the mount's executable flag")
    if os.fstatvfs(fd).f_flag & os.ST_NOEXEC:
        _fail("UNEXECUTABLE_PATH", "the original ELF mount is noexec; no fallback")


class PayloadDistributor:
    def __init__(self, staging_parent: os.PathLike[str] | str, source_elf: os.PathLike[str] | str,
                 control_uid: int, *, settlement_authority: SettlementAuthority,
                 allow_test_root: bool = False):
        self._parent = _absolute_path(staging_parent, "staging_parent")
        self._source = _absolute_path(source_elf, "source_elf")
        self._control_uid = _uint(control_uid, 32, "control_uid")
        if type(allow_test_root) is not bool:
            _fail("INVALID_SPEC", "allow_test_root must be an explicit bool")
        if self._parent != PurePosixPath("/run") and not allow_test_root:
            _fail("INVALID_PATH", "production staging parent is exactly /run")
        self._validate_authority(settlement_authority)
        self._authority = settlement_authority
        self._state = "NEW"
        self._spec: _Spec | None = None
        self._spec_fingerprint: str | None = None
        self._binding: PayloadBinding | None = None
        self._dirs: list[_Directory] = []
        self._elf_fd: int | None = None
        self._file_identity: tuple[int, ...] | None = None
        self._created_file_key: tuple[int, ...] | None = None
        self._namespace_ref: str | None = None
        self._stage_name: str | None = None
        self._ancestor_registry: dict[str, _Directory] = {}
        self._listener: socket.socket | None = None
        self._listener_path: str | None = None
        self._listener_identity: tuple[int, ...] | None = None
        self._listener_fd_identity: tuple[int, ...] | None = None
        self._listener_creator_pid: int | None = None
        self._listener_lazy = False
        self._listener_mode = 0o622  # Explicit legacy review access policy.
        self._listener_gid: int | None = None
        self._release_evidence: RetainedReleaseEvidence | None = None

    def _validate_authority(self, authority: object) -> None:
        if type(authority) is not SettlementAuthority:
            _fail("INVALID_RECEIPT", "an independent legacy review settlement authority is required")

    def prepare(self, run_spec: object, deadline_us: object | None = None) -> PayloadBinding:
        spec = validate_run_spec(run_spec)
        fingerprint = run_spec_fingerprint(run_spec)
        deadline = spec.work_deadline_us if deadline_us is None else _uint(deadline_us, 64, "deadline_us", decimal=True)
        if deadline > spec.work_deadline_us:
            _fail("DEADLINE", "preparation cannot extend the original work deadline")
        _linux()
        if self._state == "PREPARED":
            if fingerprint != self._spec_fingerprint:
                _fail("INVALID_STATE", "idempotent preparation requires the entire original immutable RunSpec")
            assert self._binding is not None
            self.verify(self._binding, str(deadline))
            return self._binding
        if self._state != "NEW":
            _fail("INVALID_STATE", "a distributor retains exactly one original run")
        if os.geteuid() != self._control_uid or self._control_uid == spec.load_uid:
            _fail("UNPROTECTED_PATH", "existing control identity must own staging and differ from load UID")
        now = _now_us()
        if not spec.t0_us <= now < deadline:
            _fail("DEADLINE", "preparation is outside the original origin/work deadline")
        self._spec = spec
        self._spec_fingerprint = fingerprint
        self._namespace_ref = _namespace()
        stage_created = False
        try:
            self._dirs = _walk(self._parent, self._control_uid, spec.load_uid, spec.load_group_ids)
            self._stage_name = f"elogistix-memory-{spec.run}"
            # EEXIST is fatal: never adopt or overwrite another run's staging.
            os.mkdir(self._stage_name, 0o711, dir_fd=self._dirs[-1].fd)
            stage_created = True
            stage_fd = os.open(self._stage_name, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW | os.O_CLOEXEC,
                               dir_fd=self._dirs[-1].fd)
            try:
                os.fchmod(stage_fd, 0o711)
                identity = _check_directory(stage_fd, self._control_uid, spec.load_uid, spec.load_group_ids)
            except BaseException:
                os.close(stage_fd)
                raise
            self._dirs.append(_Directory(stage_fd, self._stage_name, identity))
            source_fd = os.open(self._source, os.O_RDONLY | os.O_NOFOLLOW | os.O_CLOEXEC | os.O_NONBLOCK)
            write_fd: int | None = None
            try:
                source_hash, source_identity = _hash_elf(source_fd, deadline)
                if source_hash != spec.sha256:
                    _fail("HASH_MISMATCH", "source ELF does not match RunSpec")
                write_fd = os.open("keeper.elf", os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW | os.O_CLOEXEC,
                                   0o500, dir_fd=stage_fd)
                self._created_file_key = _identity(write_fd)[:3]
                offset = 0
                while offset < source_identity[6]:
                    if _now_us() >= deadline:
                        _fail("DEADLINE", "staging copy crossed the original work deadline")
                    chunk = os.pread(source_fd, min(128 * 1024, source_identity[6] - offset), offset)
                    if not chunk:
                        _fail("IDENTITY_CHANGED", "source ELF truncated during staging")
                    pending = memoryview(chunk)
                    while pending:
                        written = os.write(write_fd, pending)
                        if written <= 0:
                            _fail("IO", "staging write made no progress")
                        pending = pending[written:]
                    offset += len(chunk)
                if _file_snapshot(source_fd) != source_identity:
                    _fail("IDENTITY_CHANGED", "source ELF changed during copy")
                os.fchmod(write_fd, 0o555)
                os.fsync(write_fd)
            finally:
                if write_fd is not None:
                    os.close(write_fd)
                os.close(source_fd)
            self._elf_fd = os.open("keeper.elf", os.O_RDONLY | os.O_NOFOLLOW | os.O_CLOEXEC, dir_fd=stage_fd)
            _check_executable_mount(self._elf_fd)
            actual_hash, snapshot = _hash_elf(self._elf_fd, deadline)
            if actual_hash != spec.sha256:
                _fail("HASH_MISMATCH", "staged ELF does not match RunSpec")
            if snapshot[3] != self._control_uid or snapshot[5] != 0o555:
                _fail("UNPROTECTED_PATH", "staged ELF ownership or executable mode changed")
            self._file_identity = snapshot
            os.fsync(stage_fd)
            os.fsync(self._dirs[-2].fd)
            if _namespace() != self._namespace_ref:
                _fail("IDENTITY_CHANGED", "mount namespace changed during preparation")
            refs = tuple("ancestor:" + _record_ref({"namespace": self._namespace_ref, "identity": item.identity}) for item in self._dirs)
            self._ancestor_registry = dict(zip(refs, self._dirs))
            if len(self._ancestor_registry) != len(self._dirs):
                _fail("IDENTITY_CHANGED", "protected ancestor tokens are not unique local retained identities")
            if not self._listener_lazy:
                self._bind_keeper_listener()
            self._binding = PayloadBinding("VERIFIED_STAGED_ELF", actual_hash,
                                           str(self._parent / self._stage_name / "keeper.elf"),
                                           str(snapshot[0]), str(snapshot[1]), self._namespace_ref,
                                           self._control_uid, refs, PENDING_EXEC_IDENTITY)
            self._state = "PREPARED"
            self.verify(self._binding, str(deadline))
            return self._binding
        except BaseException as exc:
            self._state = "INVALID"
            # A failed pre-activation prepare may clean only objects it just
            # created. No activation has been exposed and no foreign path is
            # ever removed. Identity uncertainty intentionally retains bytes.
            self._rollback_unpublished(stage_created)
            if isinstance(exc, OSError):
                _fail("IO", f"protected staging failed: errno={exc.errno}")
            raise

    @staticmethod
    def _socket_path_identity(path: str) -> tuple[int, ...]:
        item = os.stat(path, follow_symlinks=False)
        if not stat.S_ISSOCK(item.st_mode) or item.st_nlink != 1:
            _fail("IDENTITY_CHANGED", "keeper listener pathname is not the original socket")
        attributes = os.listxattr(path, follow_symlinks=False)
        if "system.posix_acl_access" in attributes or "system.posix_acl_default" in attributes:
            _fail("ACL_UNCERTAIN", "keeper socket has an unreviewed extended ACL")
        return (item.st_dev, item.st_ino, item.st_uid, item.st_gid,
                stat.S_IMODE(item.st_mode), item.st_nlink, item.st_mtime_ns, item.st_ctime_ns)

    def _bind_keeper_listener(self) -> None:
        assert self._stage_name is not None and self._dirs
        if not hasattr(socket, "AF_UNIX") or not hasattr(socket, "SOCK_SEQPACKET"):
            _fail("UNSUPPORTED_PLATFORM", "AF_UNIX SOCK_SEQPACKET is unavailable")
        path = str(self._parent / self._stage_name / KEEPER_LISTENER_BASENAME)
        if len(os.fsencode(path)) > 107:
            _fail("INVALID_PATH", "keeper listener exceeds the Linux UNIX pathname bound")
        listener = socket.socket(socket.AF_UNIX, socket.SOCK_SEQPACKET)
        self._listener = listener
        self._listener_creator_pid = os.getpid()
        listener.set_inheritable(False)
        listener.setblocking(False)
        listener.setsockopt(socket.SOL_SOCKET, socket.SO_PASSCRED, 1)
        self._listener_path = path
        listener.bind(path)
        # Distinct normal workload users need connect/write permission on this
        # socket. They cannot alter its protected directory entry; SO_PEERCRED
        # authentication by the watchdog remains mandatory before any permit.
        initial = self._socket_path_identity(path)
        self._listener_identity = initial
        if self._listener_gid is not None:
            # Change only the own socket entry's group under existing control
            # authority. Never change process groups, elevate, or invoke sudo.
            os.chown(KEEPER_LISTENER_BASENAME, -1, self._listener_gid,
                     dir_fd=self._dirs[-1].fd, follow_symlinks=False)
        os.chmod(KEEPER_LISTENER_BASENAME, self._listener_mode, dir_fd=self._dirs[-1].fd)
        self._listener_identity = self._socket_path_identity(path)
        if (self._listener_identity[:2] != initial[:2] or self._listener_identity[2] != self._control_uid
                or self._listener_identity[4] != self._listener_mode
                or (self._listener_gid is not None and self._listener_identity[3] != self._listener_gid)):
            _fail("IDENTITY_CHANGED", "keeper socket was replaced or changed owner during binding")
        listener.listen(3)
        item = os.fstat(listener.fileno())
        self._listener_fd_identity = (item.st_dev, item.st_ino, item.st_uid, item.st_gid)
        os.fsync(self._dirs[-1].fd)

    def _check_keeper_listener(self) -> None:
        if self._listener_creator_pid != os.getpid():
            _fail("IDENTITY_CHANGED", "prebound keeper listener belongs to a different process generation")
        if self._listener is None or self._listener_path is None or self._listener.fileno() < 0:
            _fail("IDENTITY_CHANGED", "original owned keeper listener is unavailable")
        item = os.fstat(self._listener.fileno())
        if ((item.st_dev, item.st_ino, item.st_uid, item.st_gid) != self._listener_fd_identity
                or self._listener.getsockname() != self._listener_path
                or self._listener.getsockopt(socket.SOL_SOCKET, socket.SO_TYPE) != socket.SOCK_SEQPACKET
                or self._listener.getsockopt(socket.SOL_SOCKET, socket.SO_ACCEPTCONN) != 1
                or self._listener.get_inheritable()):
            _fail("IDENTITY_CHANGED", "owned keeper listener generation or flags changed")
        creator = struct.unpack("3i", self._listener.getsockopt(socket.SOL_SOCKET, socket.SO_PEERCRED,
                                                               struct.calcsize("3i")))
        if creator != (os.getpid(), os.geteuid(), os.getegid()):
            _fail("IDENTITY_CHANGED", "listener kernel credentials do not name the actual creator")
        current = self._socket_path_identity(self._listener_path)
        if (current != self._listener_identity or current[2] != self._control_uid
                or current[4] != self._listener_mode
                or (self._listener_gid is not None and current[3] != self._listener_gid)):
            _fail("IDENTITY_CHANGED", "protected keeper socket entry changed identity or permissions")

    def keeper_listener(self) -> socket.socket:
        """Borrow the original prebound listener; caller must not close it.

        Peer authentication is performed by the watchdog, not by this accessor.
        The borrowed object is never reconstructed from a path or incoming FD.
        Prepare/listen must happen in the actual watchdog process; passing the
        inherited listener across fork does not change its kernel peer identity.
        """
        if self._state != "PREPARED" or self._binding is None or self._spec is None:
            _fail("INVALID_STATE", "keeper listener requires prepared original retained staging")
        self.verify(self._binding, str(self._spec.work_deadline_us))
        assert self._listener is not None
        return self._listener

    @property
    def keeper_listener_path(self) -> str:
        if self._state != "PREPARED" or self._listener_path is None:
            _fail("INVALID_STATE", "keeper listener has not been prepared")
        return self._listener_path

    def _known(self, binding: object) -> tuple[_Spec, PayloadBinding]:
        if self._state != "PREPARED" or binding is not self._binding or type(binding) is not PayloadBinding:
            _fail("INVALID_STATE", "binding is not the retained original prepared image")
        assert self._spec is not None
        return self._spec, binding

    def _check_retained_paths(self) -> None:
        assert self._spec is not None and self._elf_fd is not None
        if _namespace() != self._namespace_ref:
            _fail("IDENTITY_CHANGED", "original mount namespace changed")
        flags = os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW | os.O_CLOEXEC
        root_fd = os.open("/", flags)
        try:
            if _check_directory(root_fd, self._control_uid, self._spec.load_uid, self._spec.load_group_ids) != self._dirs[0].identity:
                _fail("IDENTITY_CHANGED", "root pathname no longer reaches the retained object")
        finally:
            os.close(root_fd)
        for index, item in enumerate(self._dirs):
            if _check_directory(item.fd, self._control_uid, self._spec.load_uid, self._spec.load_group_ids) != item.identity:
                _fail("IDENTITY_CHANGED", "retained ancestor changed identity or permissions")
            if index:
                current = os.open(item.name, flags, dir_fd=self._dirs[index - 1].fd)
                try:
                    if _identity(current) != item.identity:
                        _fail("IDENTITY_CHANGED", "ancestor entry no longer reaches the retained object")
                finally:
                    os.close(current)
        assert self._binding is not None
        if (len(self._binding.protected_ancestor_refs) != len(self._dirs)
                or any(self._ancestor_registry.get(token) is not item
                       for token, item in zip(self._binding.protected_ancestor_refs, self._dirs))):
            _fail("IDENTITY_CHANGED", "ancestor tokens do not resolve to the original local registry")
        current = os.open("keeper.elf", os.O_RDONLY | os.O_NOFOLLOW | os.O_CLOEXEC, dir_fd=self._dirs[-1].fd)
        try:
            if _file_snapshot(current) != self._file_identity or _file_snapshot(self._elf_fd) != self._file_identity:
                _fail("IDENTITY_CHANGED", "ELF pathname or held descriptor changed identity")
        finally:
            os.close(current)
        _check_executable_mount(self._elf_fd)
        if self._listener is not None or not self._listener_lazy:
            self._check_keeper_listener()

    def verify(self, binding: PayloadBinding, deadline_us: object) -> VerifiedPayload:
        spec, original = self._known(binding)
        deadline = _uint(deadline_us, 64, "deadline_us", decimal=True)
        if deadline > spec.cleanup_deadline_us:
            _fail("DEADLINE", "verification cannot extend the original cleanup deadline")
        try:
            if _now_us() >= deadline:
                _fail("DEADLINE", "verification started after its absolute deadline")
            self._check_retained_paths()
            assert self._elf_fd is not None
            actual_hash, snapshot = _hash_elf(self._elf_fd, deadline)
            if actual_hash != original.sha256 or snapshot != self._file_identity:
                _fail("HASH_MISMATCH", "held ELF hash or generation changed")
            self._check_retained_paths()
            observed = _now_us()
            if observed >= deadline:
                _fail("DEADLINE", "verification finished after its absolute deadline")
            proof = _record_ref({"payload": original.reference, "namespace": self._namespace_ref,
                                 "snapshot": snapshot, "observed_us": str(observed)})
            return VerifiedPayload(original, str(observed), str(deadline), proof)
        except BaseException as exc:
            self._state = "INVALID"
            if isinstance(exc, OSError):
                _fail("IDENTITY_CHANGED", f"cannot revalidate original protected path: errno={exc.errno}")
            raise

    def release(self, binding: PayloadBinding, settled_cleanup_receipt: object,
                deadline_us: object | None = None) -> ReleaseReceipt:
        spec, original = self._known(binding)
        facts = self._authority._facts_for(settled_cleanup_receipt)
        _validate_facts(facts)
        if (facts.run != spec.run or facts.payload_binding_ref != original.reference
                or _uint(facts.cleanup_deadline_us, 64, "cleanup_deadline_us", decimal=True) != spec.cleanup_deadline_us):
            _fail("INVALID_RECEIPT", "settlement token is not bound to this original run and ELF")
        requested_deadline = spec.cleanup_deadline_us if deadline_us is None else _uint(deadline_us, 64, "deadline_us", decimal=True)
        if requested_deadline > spec.cleanup_deadline_us:
            _fail("DEADLINE", "release cannot extend the original cleanup deadline")
        deadline = min(requested_deadline, int(facts.lease_until_us))
        now = _now_us()
        if not _uint(facts.observed_us, 64, "observed_us", decimal=True) <= now < deadline:
            _fail("DEADLINE", "settlement token is stale, future-dated or outside the original lease")
        # No unlink before authentic settlement. This validation is deliberately
        # separate from physical observation and never certifies process reap.
        result = self._release_settled_image(original, deadline, _record_ref(_facts_record(facts)))
        self._authority._consume(settled_cleanup_receipt)
        return result

    def _release_settled_image(self, original: PayloadBinding, deadline: int,
                               settlement_ref: str) -> ReleaseReceipt:
        """Private image mutation after the caller authenticated native/legacy custody.

        The reference records the already-authenticated full graph; this helper
        is not an alternate public authorization route for caller hashes.
        """
        spec, _ = self._known(original)
        self.verify(original, str(deadline))
        assert self._elf_fd is not None and self._stage_name is not None
        assert self._file_identity is not None
        release_before = _now_us()
        try:
            if release_before >= deadline:
                _fail("DEADLINE", "image release mutation cannot start after its original lease/deadline")
            if self._listener is not None:
                self._unlink_owned_listener()
            if _now_us() >= deadline:
                _fail("DEADLINE", "image unlink cannot start after its original lease/deadline")
            os.unlink("keeper.elf", dir_fd=self._dirs[-1].fd)
            final_stat = os.fstat(self._elf_fd)
            final_identity = _identity(self._elf_fd)
            if (final_identity != self._file_identity[:6] or not stat.S_ISREG(final_stat.st_mode)
                    or final_stat.st_size != self._file_identity[6] or final_stat.st_nlink != 0
                    or final_stat.st_mtime_ns != self._file_identity[8]
                    or _namespace() != self._namespace_ref):
                _fail("IDENTITY_CHANGED", "original ELF descriptor changed across image release")
            final_snapshot = (*final_identity, final_stat.st_size, final_stat.st_nlink,
                              final_stat.st_mtime_ns, final_stat.st_ctime_ns)
            os.fsync(self._dirs[-1].fd)
            # Do not recursively delete staging or touch other retained files;
            # leave any nonempty directory for its owners' scoped final cleanup.
            try:
                os.rmdir(self._stage_name, dir_fd=self._dirs[-2].fd)
            except OSError as exc:
                if exc.errno not in (errno.ENOTEMPTY, errno.EEXIST):
                    raise
            os.fsync(self._dirs[-2].fd)
            released = _now_us()
            if released >= deadline:
                self._state = "INVALID"
                self._close_handles()
                _fail("DEADLINE", "payload release finished after settlement lease; no on-time receipt")
            receipt = ReleaseReceipt(spec.run, original.reference, settlement_ref, str(released))
            self._release_evidence = RetainedReleaseEvidence(original, self._file_identity, final_snapshot,
                                                            str(release_before), str(released), receipt)
            self._close_handles()
            self._state = "RELEASED"
            return receipt
        except DistributionError:
            # Once mutation begins, a changed/uncertain original identity is
            # sticky. Preserve remaining objects and handles for investigation;
            # a later token must never rehabilitate this prepared binding.
            self._state = "INVALID"
            raise
        except OSError as exc:
            self._state = "INVALID"
            _fail("IO", f"scoped settled image release failed: errno={exc.errno}")

    @property
    def release_evidence(self) -> RetainedReleaseEvidence:
        if self._state != "RELEASED" or self._release_evidence is None:
            _fail("INVALID_STATE", "no successful original image release evidence is retained")
        return self._release_evidence

    def _rollback_unpublished(self, stage_created: bool) -> None:
        if stage_created and self._dirs and self._stage_name:
            try:
                if self._dirs[-1].name == self._stage_name:
                    stage = self._dirs[-1]
                    parent = self._dirs[-2]
                    check = os.open(self._stage_name, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW | os.O_CLOEXEC,
                                    dir_fd=parent.fd)
                    try:
                        if _identity(check) != stage.identity:
                            self._close_handles()
                            return
                    finally:
                        os.close(check)
                    if self._listener_identity is not None:
                        self._unlink_owned_listener()
                    try:
                        image = os.open("keeper.elf", os.O_RDONLY | os.O_NOFOLLOW | os.O_CLOEXEC | os.O_NONBLOCK,
                                        dir_fd=stage.fd)
                        try:
                            current = os.fstat(image)
                            if (stat.S_ISREG(current.st_mode) and current.st_nlink == 1
                                    and _identity(image)[:3] == self._created_file_key):
                                os.unlink("keeper.elf", dir_fd=stage.fd)
                        finally:
                            os.close(image)
                    except FileNotFoundError:
                        pass
                    os.rmdir(self._stage_name, dir_fd=parent.fd)
            except (OSError, DistributionError):
                # Preserve uncertainty. Never use recursive removal/fallback.
                pass
        self._close_handles()

    def _unlink_owned_listener(self) -> None:
        if self._listener_creator_pid != os.getpid():
            _fail("IDENTITY_CHANGED", "refusing listener release from a different process generation")
        if self._listener_path is None or self._listener_identity is None or not self._dirs:
            _fail("IDENTITY_CHANGED", "original listener pathname identity is unavailable")
        if self._socket_path_identity(self._listener_path) != self._listener_identity:
            _fail("IDENTITY_CHANGED", "refusing to unlink a changed keeper socket entry")
        os.unlink(KEEPER_LISTENER_BASENAME, dir_fd=self._dirs[-1].fd)
        self._listener_identity = None

    def _close_handles(self) -> None:
        if self._listener is not None:
            self._listener.close()
            self._listener = None
        self._listener_creator_pid = None
        if self._elf_fd is not None:
            os.close(self._elf_fd)
            self._elf_fd = None
        for item in reversed(self._dirs):
            os.close(item.fd)
        self._dirs.clear()
        self._ancestor_registry.clear()


def _facts_record(facts: SettlementFacts) -> dict[str, object]:
    result = {field.name: getattr(facts, field.name) for field in fields(facts) if field.name != "slots"}
    result["slots"] = [{field.name: getattr(item, field.name) for field in fields(item)} for item in facts.slots]
    return result


def _native_authority_class() -> type:
    """Resolve the sibling's nominal implementation; never a method-shaped duck.

    Imports are deferred until explicit native configuration. Standalone pure
    validator imports require no coordinator/backend or Linux dependency.
    The qualified __main__ import does not trigger its __name__ CLI guard.
    The delivered python -m guard delegates to that canonical module's main,
    so its authority is always the canonical class, never the entry alias.
    """
    if not __package__:
        _fail("AUTHORITY_ABI_PENDING", "native authority requires the installed sibling __main__")
    qualified_name = __package__ + ".__main__"
    try:
        module = importlib.import_module(qualified_name)
        authority_type = module.NativeSettlementAuthority
    except (ImportError, AttributeError) as exc:
        raise DistributionError("AUTHORITY_ABI_PENDING", "nominal sibling __main__ authority is unavailable") from exc
    if (type(authority_type) is not type or authority_type.__module__ != module.__name__
            or authority_type.__name__ != "NativeSettlementAuthority"):
        _fail("UNBOUND_AUTHORITY", "sibling __main__ does not expose its original nominal authority")
    return authority_type


def _require_native_authority(authority: object) -> type:
    authority_type = _native_authority_class()
    if type(authority) is not authority_type:
        _fail("UNBOUND_AUTHORITY", "exact original NativeSettlementAuthority is required")
    return authority_type


def _freeze_record(value: object) -> object:
    if type(value) is dict:
        return MappingProxyType({key: _freeze_record(item) for key, item in value.items()})
    if type(value) is list:
        return tuple(_freeze_record(item) for item in value)
    return value


def _plain_record(value: object) -> object:
    if isinstance(value, Mapping):
        return {key: _plain_record(item) for key, item in value.items()}
    if type(value) in (tuple, list):
        return [_plain_record(item) for item in value]
    return value


@dataclass(frozen=True, slots=True)
class NativeReleaseProof:
    """Immutable full native-returned record; shape alone grants no authority."""

    record: Mapping[str, object]
    lease_until_us: int
    observed_us: int

    def to_mapping(self) -> dict[str, object]:
        return _plain_record(self.record)

    @property
    def reference(self) -> str:
        return _record_ref(self.to_mapping())


def validate_native_release_proof(value: object, *, run: str, payload_binding_ref: str,
                                  t0_us: object, cleanup_deadline_us: object,
                                  deadline_us: object, observed_now_us: object) -> NativeReleaseProof:
    """Pure closed correlation checks on a full result of the nominal producer.

    This function does not authenticate a dict or certify a kernel/manager
    operation. RuntimeDistribution calls the exact native class's original
    prove_release_allowed first; backend validate_release_graph authenticates
    the full Start/Stop/final snapshot/MainPID-release graph against retained
    native producers. Never-dispatched slots carry no fabricated unit graph.
    """
    origin = _uint(t0_us, 64, "t0_us", decimal=True)
    cleanup = _uint(cleanup_deadline_us, 64, "cleanup_deadline_us", decimal=True)
    deadline = _uint(deadline_us, 64, "deadline_us", decimal=True)
    now = _uint(observed_now_us, 64, "observed_now_us", decimal=True)
    if not origin <= now < deadline <= cleanup:
        _fail("DEADLINE", "native proof is outside the original cleanup deadline")
    _ref(payload_binding_ref, "payload_binding_ref")
    if type(run) is not str or not _HEX32.fullmatch(run):
        _fail("INVALID_RECEIPT", "native release run is invalid")
    if type(value) is not dict:
        _fail("INVALID_RECEIPT", "full native result must be an exact local record")
    try:
        encoded = json.dumps(value, ensure_ascii=False, sort_keys=True,
                             separators=(",", ":"), allow_nan=False).encode("utf-8")
        if not 0 < len(encoded) <= 262144:
            _fail("INVALID_RECEIPT", "full native release proof exceeds its bound")
        record = json.loads(encoded)
    except (TypeError, ValueError, UnicodeError, RecursionError) as exc:
        raise DistributionError("INVALID_RECEIPT", "native graph cannot be canonically copied") from exc
    if set(record) != {"run", "payload_binding_ref", "slots"}:
        _fail("INVALID_RECEIPT", "native proof requires its exact original fields")
    if record["run"] != run or record["payload_binding_ref"] != payload_binding_ref:
        _fail("INVALID_RECEIPT", "native release proof names another run or image")
    slots = record["slots"]
    if type(slots) is not list or len(slots) != 3:
        _fail("INVALID_RECEIPT", "native release needs all three original slot receipts")
    slot_keys = {"slot", "run", "reservation_ref", "payload_binding_ref", "manager_binding_ref",
                 "basis", "no_future_own_exec", "observed_us", "authority_lease_until_us",
                 "cleanup_receipts", "test_boundary"}
    graph_keys = {"start_receipt", "stop_receipt", "final_unit_receipt", "keeper_reap_receipt",
                  "start_settlement_ref", "stop_settlement_ref", "final_unit_receipt_ref", "keeper_reap_receipt_ref",
                  "activations_settled", "stop_settled", "terminal_no_pending_execution", "keeper_reaped",
                  "missing_evidence", "test_boundary"}
    pairs = (("start_receipt", "start_settlement_ref"), ("stop_receipt", "stop_settlement_ref"),
             ("final_unit_receipt", "final_unit_receipt_ref"), ("keeper_reap_receipt", "keeper_reap_receipt_ref"))
    manager_refs: set[str] = set()
    reservations: set[str] = set()
    bound_refs: set[str] = set()
    leases: set[int] = set()
    latest = origin
    for index, slot in enumerate(slots):
        if type(slot) is not dict or set(slot) != slot_keys:
            _fail("INVALID_RECEIPT", "slot release receipt has missing or additional fields")
        if _uint(slot["slot"], 32, "slot") != index:
            _fail("INVALID_RECEIPT", "native slot receipts must be ordered exactly 0,1,2")
        if (slot["run"] != run or slot["payload_binding_ref"] != payload_binding_ref
                or slot["test_boundary"] is not False or slot["no_future_own_exec"] is not True):
            _fail("INVALID_RECEIPT", "native slot receipt has uncertain original execution custody")
        manager_refs.add(_ref(slot["manager_binding_ref"], "manager_binding_ref"))
        observed = _uint(slot["observed_us"], 64, "slot.observed_us", decimal=True)
        lease = _uint(slot["authority_lease_until_us"], 64, "authority_lease_until_us", decimal=True)
        if not origin <= observed <= now < min(lease, deadline) or lease > cleanup:
            _fail("DEADLINE", "native slot receipt is outside its original authority lease")
        leases.add(lease)
        latest = max(latest, observed)
        reservation, basis, graph = slot["reservation_ref"], slot["basis"], slot["cleanup_receipts"]
        if basis == "NOT_RESERVED_NOT_DISPATCHED":
            if reservation is not None or graph is not None:
                _fail("INVALID_RECEIPT", "unreserved undispatched slot cannot invent reservation/unit facts")
        elif basis in ("RESERVED_NOT_DISPATCHED", "START_DISPATCHED_BOUND"):
            reservation = _ref(reservation, "reservation_ref")
            if reservation in reservations:
                _fail("INVALID_RECEIPT", "native slots reuse one original reservation")
            reservations.add(reservation)
            if basis == "RESERVED_NOT_DISPATCHED":
                if graph is not None:
                    _fail("INVALID_RECEIPT", "undispatched slot cannot invent a unit graph")
                continue
        else:
            _fail("INVALID_RECEIPT", "unknown dispatched activation remains an obligation")
        if basis != "START_DISPATCHED_BOUND":
            continue
        if type(graph) is not dict or set(graph) != graph_keys:
            _fail("INVALID_RECEIPT", "bound native slot requires the complete settlement graph")
        if (graph["test_boundary"] is not False or graph["missing_evidence"] != []
                or any(graph[key] is not True for key in
                       ("activations_settled", "stop_settled", "terminal_no_pending_execution", "keeper_reaped"))):
            _fail("INVALID_RECEIPT", "bound native unit remains unsettled")
        for record_key, ref_key in pairs:
            if (type(graph[record_key]) is not dict
                    or _ref(graph[ref_key], ref_key) != _record_ref(graph[record_key])):
                _fail("INVALID_RECEIPT", "full graph record/reference correlation failed")
        final = graph["final_unit_receipt"]
        if set(final) != {"original_unit_binding_ref", "manager_binding_ref", "invocation_id", "snapshot", "before_us", "after_us"}:
            _fail("INVALID_RECEIPT", "complete original manager snapshot is required")
        unit_ref = _ref(final["original_unit_binding_ref"], "original_unit_binding_ref")
        if unit_ref in bound_refs or final["manager_binding_ref"] != slot["manager_binding_ref"]:
            _fail("INVALID_RECEIPT", "bound slots alias original identity or manager")
        bound_refs.add(unit_ref)
        keeper = graph["keeper_reap_receipt"]
        if set(keeper) != {"systemd_main_exit", "pidfd_task_released"}:
            _fail("INVALID_RECEIPT", "full manager exit and original pidfd release facts are required")
        for fact in (final, *keeper.values()):
            if type(fact) is not dict or "before_us" not in fact or "after_us" not in fact:
                _fail("INVALID_RECEIPT", "native fact lacks its original observation bracket")
            before = _uint(fact["before_us"], 64, "before_us", decimal=True)
            after = _uint(fact["after_us"], 64, "after_us", decimal=True)
            if not origin <= before <= after <= observed:
                _fail("INVALID_RECEIPT", "full native fact is outside its receipt observation bracket")
    if len(manager_refs) != 1 or len(leases) != 1:
        _fail("INVALID_RECEIPT", "native slots do not share the original manager authority lease")
    return NativeReleaseProof(_freeze_record(record), next(iter(leases)), latest)


@dataclass(frozen=True, slots=True)
class DistributionConfig:
    """Explicit existing native dependencies, supplied by the trusted launcher.

    Construction is pure. No source ELF, control identity or settlement
    authority is inferred from RunSpec, environment, UID defaults or paths.
    ``allow_test_root`` remains a Linux-only test opt-in, not a waiver.
    """

    source_elf: str
    control_uid: int
    settlement_authority: object
    staging_parent: str = "/run"
    allow_test_root: bool = False

    def __post_init__(self) -> None:
        object.__setattr__(self, "source_elf", str(_absolute_path(self.source_elf, "source_elf")))
        object.__setattr__(self, "staging_parent", str(_absolute_path(self.staging_parent, "staging_parent")))
        _uint(self.control_uid, 32, "control_uid")
        if type(self.settlement_authority) is not SettlementAuthority:
            _require_native_authority(self.settlement_authority)
        if type(self.allow_test_root) is not bool:
            _fail("INVALID_SPEC", "allow_test_root must be an explicit bool")
        if self.staging_parent != "/run" and not self.allow_test_root:
            _fail("INVALID_PATH", "production staging parent is exactly /run")


class RuntimeDistribution(PayloadDistributor):
    """V3 keyword factory with explicit source/control/local authority.

    RunSpec is supplied to prepare(spec, deadline), never used to infer source
    or control authority. The optional spec/config form is a compatibility
    adapter for the earlier configured callable(spec), with the same complete
    immutable fingerprint. Only the sibling __main__'s exact nominal
    NativeSettlementAuthority can stage production images. It may be unbound
    before fork; release requires its original attached native backend and a
    fresh full graph from its original prove_release_allowed method.
    Parent prepare retains only the image. The direct own-fork child creates
    watchdog.sock lazily, binding SO_PEERCRED to the actual watchdog process.
    """

    def __init__(self, spec: object | None = None, *, source_elf: str | None = None,
                 control_uid: int | None = None,
                 settlement_authority: object | None = None,
                 staging_parent: str = "/run", allow_test_root: bool = False,
                 config: DistributionConfig | None = None):
        if config is not None:
            if (type(config) is not DistributionConfig or source_elf is not None
                    or control_uid is not None or settlement_authority is not None
                    or staging_parent != "/run" or allow_test_root is not False):
                _fail("CONFIG_REQUIRED", "do not mix explicit native configuration with a config adapter")
        else:
            if source_elf is None or control_uid is None or settlement_authority is None:
                _fail("CONFIG_REQUIRED", "RuntimeDistribution requires explicit source/control/local settlement authority")
            config = DistributionConfig(source_elf, control_uid, settlement_authority,
                                        staging_parent, allow_test_root)
        self._constructor_spec_fingerprint = None if spec is None else run_spec_fingerprint(spec)
        super().__init__(config.staging_parent, config.source_elf, config.control_uid,
                         settlement_authority=config.settlement_authority,
                         allow_test_root=config.allow_test_root)
        self._listener_lazy = True
        self._listener_mode = 0o620
        self._preparing_pid: int | None = None
        self._native_release_proof: NativeReleaseProof | None = None
        self._authority_spec_fingerprint: str | None = None
        if type(self._authority) is not SettlementAuthority:
            try:
                self._authority_spec_fingerprint = run_spec_fingerprint(self._authority.spec)
            except AttributeError as exc:
                raise DistributionError("UNBOUND_AUTHORITY", "native authority lacks its original immutable RunSpec") from exc

    def _validate_authority(self, authority: object) -> None:
        # Preserve pure configured legacy review construction, but its issuer
        # registry can never enable this class's production prepare or release.
        if type(authority) is not SettlementAuthority:
            _require_native_authority(authority)

    def _production_authority(self) -> type:
        if type(self._authority) is SettlementAuthority:
            _fail("AUTHORITY_ABI_PENDING", "legacy local issuer is not native production authority")
        authority_type = _require_native_authority(self._authority)
        if run_spec_fingerprint(self._authority.spec) != self._authority_spec_fingerprint:
            _fail("UNBOUND_AUTHORITY", "native authority changed its original immutable RunSpec")
        return authority_type

    def prepare(self, run_spec: object, deadline_us: object | None = None) -> PayloadBinding:
        if (self._constructor_spec_fingerprint is not None
                and run_spec_fingerprint(run_spec) != self._constructor_spec_fingerprint):
            _fail("INVALID_STATE", "RuntimeDistribution cannot prepare a changed constructor RunSpec")
        spec = validate_run_spec(run_spec)
        deadline = spec.work_deadline_us if deadline_us is None else _uint(deadline_us, 64, "deadline_us", decimal=True)
        if deadline > spec.work_deadline_us:
            _fail("DEADLINE", "preparation cannot extend the original work deadline")
        self._production_authority()
        fingerprint = run_spec_fingerprint(run_spec)
        if fingerprint != self._authority_spec_fingerprint:
            _fail("UNBOUND_AUTHORITY", "native authority and preparation do not share the original RunSpec")
        if self._control_uid != 0:
            _fail("UNPROTECTED_PATH", "native launcher requires its existing root control identity")
        # The backend's fixed listener policy grants access through load_groups.
        # Do not silently add the primary group or change any process groups.
        original_groups = (run_spec["load_groups"] if isinstance(run_spec, Mapping)
                           else run_spec.load_groups)
        if spec.load_gid not in original_groups:
            _fail("INVALID_SPEC", "native socket group must already belong to explicit load_groups")
        first = self._state == "NEW"
        binding = super().prepare(run_spec, str(deadline))
        if first:
            self._preparing_pid = os.getpid()
        return binding

    def keeper_listener(self) -> socket.socket:
        """Borrow the own watchdog child's lazily-created original listener.

        No inherited parent listener is adopted. Kernel parent PID and local
        inherited image handles establish the direct own-fork bootstrap; the
        nominal backend later binds the complete watchdog process generation.
        """
        if self._state != "PREPARED" or self._binding is None or self._spec is None:
            _fail("INVALID_STATE", "keeper listener requires the original prepared image")
        self._production_authority()
        _linux()
        if self._listener is None:
            if (self._preparing_pid is None or os.getpid() == self._preparing_pid
                    or os.getppid() != self._preparing_pid):
                _fail("IDENTITY_CHANGED", "listener must be created by the direct own-fork watchdog child")
            if os.geteuid() != self._control_uid:
                _fail("UNPROTECTED_PATH", "watchdog lost the original control identity")
            self.verify(self._binding, str(self._spec.work_deadline_us))
            self._listener_gid = self._spec.load_gid
            try:
                if _now_us() >= self._spec.work_deadline_us:
                    _fail("DEADLINE", "listener creation cannot start after the original work deadline")
                self._bind_keeper_listener()
                self.verify(self._binding, str(self._spec.work_deadline_us))
            except BaseException as exc:
                self._state = "INVALID"
                # Remove only a positively identified own new socket. Keep the
                # image/result inode and all uncertain entries for their owners.
                try:
                    if self._listener_identity is not None:
                        self._unlink_owned_listener()
                except (OSError, DistributionError):
                    pass
                if self._listener is not None:
                    self._listener.close()
                    self._listener = None
                if isinstance(exc, OSError):
                    _fail("IO", f"own watchdog listener creation failed: errno={exc.errno}")
                raise
        else:
            self.verify(self._binding, str(self._spec.work_deadline_us))
        assert self._listener is not None
        return self._listener

    def release(self, payload_binding: PayloadBinding, cleanup_facts: object,
                deadline_us: object) -> ReleaseReceipt:
        """Obtain fresh original native receipts; cleanup_facts grants no authority.

        The caller's cleanup_facts is context only. It is never a substitute for
        prove_release_allowed, even if it contains booleans or well-formed refs.
        Physical cleanup certificates remain the external observer's obligation.
        """
        deadline = _uint(deadline_us, 64, "deadline_us", decimal=True)
        authority_type = self._production_authority()
        spec, original = self._known(payload_binding)
        if deadline > spec.cleanup_deadline_us:
            _fail("DEADLINE", "native release cannot extend the original cleanup deadline")
        try:
            backend = self._authority.backend
            if backend is None:
                _fail("UNBOUND_AUTHORITY", "native authority has no original attached backend")
            backend_module = importlib.import_module(__package__ + ".systemd_backend")
            if (type(backend) is not backend_module.SystemdBackend or backend.test_boundary is not False
                    or run_spec_fingerprint(backend.spec) != self._authority_spec_fingerprint):
                _fail("UNBOUND_AUTHORITY", "native authority does not retain the exact original backend")
            if self._listener_creator_pid != os.getpid():
                _fail("IDENTITY_CHANGED", "release does not belong to the original watchdog listener creator")
            # Invoke the original nominal class method, not an instance callback.
            # Its backend rechecks native custody, all three Start/Stop obligations,
            # terminal manager snapshots and original pidfd task-release facts.
            result = authority_type.prove_release_allowed(self._authority, original.to_mapping(), deadline)
            proof = validate_native_release_proof(result, run=spec.run, payload_binding_ref=original.reference,
                        t0_us=spec.t0_us, cleanup_deadline_us=spec.cleanup_deadline_us,
                        deadline_us=deadline, observed_now_us=_now_us())
        except DistributionError:
            raise
        except (ImportError, AttributeError, ValueError, RuntimeError, TypeError, KeyError, OSError) as exc:
            raise DistributionError("UNBOUND_AUTHORITY", "fresh original native release proof unavailable") from exc
        effective = min(deadline, proof.lease_until_us)
        self._native_release_proof = proof
        return self._release_settled_image(original, effective, proof.reference)

    @property
    def native_release_proof(self) -> NativeReleaseProof:
        """Full immutable native evidence retained locally, including failed mutation.

        This record alone is not an image release receipt or a physical cleanup
        certificate. Successful original image facts are in release_evidence.
        """
        if self._native_release_proof is None:
            _fail("INVALID_STATE", "no fresh full native release proof has been retained")
        return self._native_release_proof


@dataclass(frozen=True, slots=True)
class RuntimeDistributionFactory:
    config: DistributionConfig

    def __post_init__(self) -> None:
        if type(self.config) is not DistributionConfig:
            _fail("CONFIG_REQUIRED", "factory requires an explicit immutable DistributionConfig")

    def __call__(self, spec: object) -> RuntimeDistribution:
        return RuntimeDistribution(spec, config=self.config)


def make_runtime_distribution_factory(config: DistributionConfig) -> RuntimeDistributionFactory:
    return RuntimeDistributionFactory(config)


def prepare(run_spec: object, deadline_us: object | None = None, *, distributor: PayloadDistributor) -> PayloadBinding:
    """Explicit-context module adapter; no process-global configuration."""
    return distributor.prepare(run_spec, deadline_us)


def verify(payload_binding: PayloadBinding, deadline_us: object, *, distributor: PayloadDistributor) -> VerifiedPayload:
    return distributor.verify(payload_binding, deadline_us)


def release(payload_binding: PayloadBinding, settled_cleanup_receipt: object,
            deadline_us: object | None = None, *, distributor: PayloadDistributor) -> ReleaseReceipt:
    return distributor.release(payload_binding, settled_cleanup_receipt, deadline_us)
