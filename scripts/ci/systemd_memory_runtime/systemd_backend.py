"""Sole-watchdog transient service backend, original identity and receipt capture.

No certificate is inferred from a missing unit, job completion or readable pidfd.
Native Linux operation has not been exercised by the Windows hermetic tests.
"""
from __future__ import annotations

import copy
import hashlib
import os
import re
import stat
import sys
from dataclasses import dataclass, field
from typing import Any

from .contracts import (RunSpec, ContractError, digest_record, validate_process_generation,
                        validate_manager_binding, validate_payload_binding,
                        validate_unit_candidate, validate_unit_binding,
                        validate_systemd_main_exit, validate_main_release_facts, parse_u64)
from .sd_bus_transport import (Budget, BusRemoteError, TransportError, SdBusTransport,
                               StartRequest, StopRequest, SnapshotRequest, ManagerPolicyRequest,
                               JobEvent, monotonic_us, process_generation, pin_process,
                               bounded_read, unit_path, job_id, record_ref, start_properties,
                               SERVICE_ENVIRONMENT, SERVICE_UNSET_ENVIRONMENT)


class BackendError(RuntimeError):
    def __init__(self, code: str):
        self.code = code
        super().__init__(code)


@dataclass(frozen=True)
class BackendReady:
    manager_binding: dict[str, Any]
    jobs_listener_ready: bool
    ref: str


@dataclass(frozen=True)
class OperationOutcome:
    state: str
    slot: int
    request_ref: str
    job_ref: str | None
    reason: str | None


StartOutcome = StopOutcome = OperationOutcome


@dataclass
class _Slot:
    reservation: str | None = None
    start_attempted: bool = False
    stop_attempted: bool = False
    start_request_ref: str | None = None
    stop_request_ref: str | None = None
    start_job_path: str | None = None
    stop_job_path: str | None = None
    candidate: dict[str, Any] | None = None
    binding: dict[str, Any] | None = None
    generation: dict[str, Any] | None = None
    pin: Any = None
    expected_argv: tuple[str, ...] | None = None
    expected_properties: tuple[tuple[str, str, Any], ...] | None = None
    events: dict[str, JobEvent] = field(default_factory=dict)
    final_receipt: dict[str, Any] | None = None
    exit_fact: dict[str, Any] | None = None
    release_fact: dict[str, Any] | None = None


class _NativeIdentity:
    MAX_ELF = 16 * 1024 * 1024
    UNIT_PATHS = frozenset({"/etc/systemd/system.control", "/run/systemd/system.control",
                           "/etc/systemd/system.attached", "/run/systemd/system.attached",
                           "/run/systemd/transient", "/run/systemd/generator.early",
                           "/etc/systemd/system", "/run/systemd/system", "/run/systemd/generator",
                           "/usr/local/lib/systemd/system", "/usr/lib/systemd/system",
                           "/lib/systemd/system", "/run/systemd/generator.late"})

    def __init__(self, budget: Budget, load_uid: int, load_groups: tuple[int, ...]):
        self.budget, self.elf_fd, self.elf_identity = budget, None, None
        self.load_uid, self.load_groups = load_uid, load_groups

    def _load_permission(self, st: os.stat_result, owner_bit: int, group_bit: int, other_bit: int) -> bool:
        return bool(st.st_mode & (owner_bit if st.st_uid == self.load_uid else group_bit if st.st_gid in self.load_groups else other_bit))

    def current_generation(self) -> dict[str, Any]:
        return process_generation(os.getpid())

    def _protected(self, path: str, *, regular: bool = False) -> os.stat_result:
        result = os.lstat(path)
        if result.st_uid != 0 or result.st_mode & 0o022 or stat.S_ISLNK(result.st_mode) or not (stat.S_ISREG(result.st_mode) if regular else stat.S_ISDIR(result.st_mode)):
            raise BackendError("UNPROTECTED_PATH")
        return result

    def policy(self, paths: Any, names: tuple[str, ...], deadline: int) -> dict[str, Any]:
        end = self.budget.begin(deadline)
        if os.geteuid() != 0 or not isinstance(paths, list) or not paths or len(paths) > 32 or len(set(paths)) != len(paths) or any(x not in self.UNIT_PATHS for x in paths):
            raise BackendError("MANAGER_AUTHORITY_POLICY")
        facts = []
        for path in paths:
            self.budget.end(end)
            canonical = os.path.realpath(path)
            if canonical not in self.UNIT_PATHS:
                raise BackendError("MANAGER_UNIT_PATH")
            parent = canonical
            while parent != "/":
                if os.path.exists(parent):
                    self._protected(parent)
                parent = os.path.dirname(parent)
            self._protected("/")
            if not os.path.exists(canonical):
                # Original manager's fixed search directory may legitimately not exist.
                continue
            st = self._protected(canonical)
            for name in names:
                prefixes = ("service.d", "elogistix-.service.d", "elogistix-memory-.service.d",
                            "elogistix-memory-adapter-.service.d", name + ".d", name)
                for component in prefixes:
                    # Reject any matching config; this first adapter does not merge drop-ins.
                    if os.path.lexists(canonical + "/" + component):
                        raise BackendError("INHERITED_UNIT_CONFIGURATION")
            facts.append({"path": canonical, "dev": str(st.st_dev), "inode": str(st.st_ino), "uid": st.st_uid, "mode": stat.S_IMODE(st.st_mode)})
        self.budget.end(end)
        return {"existing_euid": 0, "unit_path_facts": facts, "matching_configuration": "ABSENT", "observed_us": str(self.budget.now())}

    def _hash_fd(self, fd: int, deadline: int) -> str:
        end = self.budget.begin(deadline)
        st = os.fstat(fd)
        if not stat.S_ISREG(st.st_mode) or not 0 < st.st_size <= self.MAX_ELF:
            raise BackendError("ELF_BOUND")
        digest, offset = hashlib.sha256(), 0
        while offset < st.st_size:
            self.budget.end(end)
            chunk = os.pread(fd, min(65536, st.st_size - offset), offset)
            if not chunk:
                raise BackendError("ELF_CHANGED")
            if offset == 0 and chunk[:4] != b"\x7fELF":
                raise BackendError("ELF_FORMAT")
            digest.update(chunk)
            offset += len(chunk)
        after = os.fstat(fd)
        if (st.st_dev, st.st_ino, st.st_size, st.st_mtime_ns, st.st_ctime_ns) != (after.st_dev, after.st_ino, after.st_size, after.st_mtime_ns, after.st_ctime_ns):
            raise BackendError("ELF_CHANGED")
        self.budget.end(end)
        return digest.hexdigest()

    def verify_payload(self, binding: dict[str, Any], run: str, expected_sha: str, deadline: int) -> None:
        end = self.budget.begin(deadline)
        path = binding["absolute_path"]
        if not re.fullmatch(r"/run/elogistix-memory-" + run + r"/[A-Za-z0-9_.-]+", path) or binding["sha256"] != expected_sha or binding["owner_uid"] != 0:
            raise BackendError("PAYLOAD_BINDING")
        for parent in ("/", "/run", "/run/elogistix-memory-" + run):
            ps = self._protected(parent)
            if not self._load_permission(ps, stat.S_IXUSR, stat.S_IXGRP, stat.S_IXOTH):
                raise BackendError("PAYLOAD_LOAD_ACCESS")
        st = self._protected(path, regular=True)
        if not self._load_permission(st, stat.S_IXUSR, stat.S_IXGRP, stat.S_IXOTH) or (str(st.st_dev), str(st.st_ino)) != (binding["dev"], binding["inode"]) or os.readlink("/proc/self/ns/mnt") != binding["mount_namespace_ref"]:
            raise BackendError("PAYLOAD_IDENTITY")
        if self.elf_fd is None:
            self.elf_fd = os.open(path, os.O_RDONLY | os.O_CLOEXEC | os.O_NOFOLLOW)
            self.elf_identity = (st.st_dev, st.st_ino)
        fs = os.fstat(self.elf_fd)
        if (fs.st_dev, fs.st_ino) != self.elf_identity or self.elf_identity != (st.st_dev, st.st_ino) or self._hash_fd(self.elf_fd, deadline) != expected_sha:
            raise BackendError("PAYLOAD_IDENTITY")
        self.budget.end(end)

    def verify_listener(self, path: str, run: str, deadline: int) -> None:
        end = self.budget.begin(deadline)
        if not re.fullmatch(r"/run/elogistix-memory-" + run + r"/[A-Za-z0-9_.-]+", path):
            raise BackendError("KEEPER_LISTENER_PATH")
        for parent in ("/", "/run", "/run/elogistix-memory-" + run):
            ps = self._protected(parent)
            if not self._load_permission(ps, stat.S_IXUSR, stat.S_IXGRP, stat.S_IXOTH):
                raise BackendError("KEEPER_LISTENER_ACCESS")
        st = os.lstat(path)
        # Write permission permits connect(), not replacement of this directory entry.
        if not stat.S_ISSOCK(st.st_mode) or st.st_uid != 0 or st.st_gid not in self.load_groups or not st.st_mode & stat.S_IWGRP or st.st_mode & stat.S_IWOTH:
            raise BackendError("KEEPER_LISTENER_AUTHORITY")
        self.budget.end(end)

    def verify_workload(self, generation: dict[str, Any], payload: dict[str, Any], control_group: str, deadline: int) -> None:
        end = self.budget.begin(deadline)
        pid = generation["pid"]
        if process_generation(pid) != generation:
            raise BackendError("KEEPER_GENERATION")
        # Only derived authentic MainPID procfs paths, never a caller executable path.
        fd = os.open("/proc/%d/exe" % pid, os.O_RDONLY | os.O_CLOEXEC)
        try:
            st = os.fstat(fd)
            if (str(st.st_dev), str(st.st_ino)) != (payload["dev"], payload["inode"]) or self._hash_fd(fd, deadline) != payload["sha256"]:
                raise BackendError("KEEPER_EXEC_IDENTITY")
        finally:
            os.close(fd)
        lines = bounded_read("/proc/%d/cgroup" % pid, 4096).splitlines()
        if [line[3:] for line in lines if line.startswith("0::")] != [control_group] or process_generation(pid) != generation:
            raise BackendError("KEEPER_PHYSICAL_IDENTITY")
        self.budget.end(end)

    def pin(self, generation: dict[str, Any], deadline: int) -> Any:
        return pin_process(generation, self.budget, deadline)

    def release_fact(self, pin: Any, deadline: int) -> dict[str, Any] | None:
        before = self.budget.now()
        result = pin.released(self.budget, deadline)
        if not result["released"]:
            return None
        return {"tag": "PIDFD_TASK_RELEASED", "original_process_generation": pin.generation,
                "pidfd_identity_ref": "pidfd:" + record_ref({"generation": pin.generation, "fd_identity": list(pin.fd_identity)}),
                "procfs_namespace_ref": pin.generation["pid_namespace_ref"],
                "fdinfo_pid": -1, "retained_original": True, "not_closed_or_reused": True,
                "before_us": str(before), "after_us": str(self.budget.now())}

    def close(self) -> None:
        if self.elf_fd is not None:
            os.close(self.elf_fd)
            self.elf_fd = None


class SystemdBackend:
    def __init__(self, transport: SdBusTransport, run_spec: RunSpec | dict[str, Any], *,
                 keeper_listener_path: str, watchdog_generation: dict[str, Any],
                 payload_binding: dict[str, Any], clock_us: Any = monotonic_us):
        if sys.platform != "linux" or transport.test_boundary:
            raise BackendError("PLATFORM_LINUX")
        self._initialize(transport, run_spec, keeper_listener_path, watchdog_generation, payload_binding,
                         clock_us, None, False)

    def _initialize(self, transport: SdBusTransport, spec: Any, listener: str, generation: Any,
                    payload: Any, clock: Any, identity: Any, test_boundary: bool) -> None:
        self.spec = RunSpec.from_mapping(spec.to_mapping() if isinstance(spec, RunSpec) else spec)
        self.transport, self.listener = transport, listener
        self.watchdog_generation = validate_process_generation(generation)
        self.payload = validate_payload_binding(payload)
        self.budget = Budget(clock, min(self.spec.cleanup_deadline_us, transport.budget.lease))
        self.identity = identity or _NativeIdentity(self.budget, self.spec.load_uid, self.spec.load_groups)
        self.test_boundary = test_boundary
        self.ready: BackendReady | None = None
        self.slots = [_Slot() for _ in self.spec.slots]
        self.invalid: str | None = None
        self.cleanup_started = False
        self.policy_fact: dict[str, Any] | None = None
        self.manager_environment_fact: dict[str, Any] | None = None
        self.closed = False
        if self.watchdog_generation != self.identity.current_generation():
            raise BackendError("WATCHDOG_GENERATION")
        if transport.budget.lease > self.spec.cleanup_deadline_us:
            raise BackendError("AUTHORITY_LEASE_EXTENSION")

    @classmethod
    def for_test_boundary(cls, transport: SdBusTransport, run_spec: Any, *, keeper_listener_path: str,
                          watchdog_generation: Any, payload_binding: Any, identity: Any, clock_us: Any) -> "SystemdBackend":
        if not transport.test_boundary:
            raise BackendError("TEST_BOUNDARY_TRANSPORT")
        result = cls.__new__(cls)
        result._initialize(transport, run_spec, keeper_listener_path, watchdog_generation, payload_binding,
                           clock_us, identity, True)
        return result

    def _check(self, deadline: int, *, work: bool = False) -> int:
        if self.transport.invalid:
            self.invalid = self.transport.invalid
        if self.invalid or self.closed:
            raise BackendError(self.invalid or "BACKEND_CLOSED")
        applicable = min(deadline, self.spec.work_deadline_us if work else self.spec.cleanup_deadline_us)
        end = self.budget.begin(applicable)
        if self.identity.current_generation() != self.watchdog_generation:
            self.invalid = "WATCHDOG_GENERATION"
            raise BackendError(self.invalid)
        self.budget.end(end)
        return applicable

    def _slot(self, slot: int) -> _Slot:
        if type(slot) is not int or not 0 <= slot < 3:
            raise BackendError("SLOT")
        return self.slots[slot]

    def preflight(self, run_spec: Any, deadline_us: int) -> BackendReady:
        if RunSpec.from_mapping(run_spec.to_mapping() if isinstance(run_spec, RunSpec) else run_spec) != self.spec or self.ready is not None:
            raise BackendError("PREFLIGHT_SPEC")
        deadline = self._check(deadline_us, work=True)
        self.identity.verify_payload(self.payload, self.spec.run, self.spec.payload_expected_sha256, deadline)
        self.identity.verify_listener(self.listener, self.spec.run, deadline)
        names = tuple(s.unit_name for s in self.spec.slots)
        self.transport.authorize_units(names)
        manager = validate_manager_binding(self.transport.open(deadline))
        if manager["boot_id"] != self.watchdog_generation["boot_id"] or manager["manager_pid_generation"]["pid_namespace_ref"] != self.watchdog_generation["pid_namespace_ref"] or manager["manager_pid_generation"]["mount_namespace_ref"] != self.watchdog_generation["mount_namespace_ref"]:
            self.invalid = "MANAGER_NAMESPACE"
            raise BackendError(self.invalid)
        policy = self.transport.call_closed(ManagerPolicyRequest(), deadline).value
        environment = self._manager_environment(policy, deadline)
        paths = policy.get("UnitPath")
        self.policy_fact = self.identity.policy(paths, names, deadline)
        self.manager_environment_fact = environment
        self.policy_fact = dict(self.policy_fact, manager_environment=environment)
        listener = self.transport.subscribe(deadline)
        self._check(deadline, work=True)
        self.ready = BackendReady(manager, listener.jobs_listener_ready, digest_record({"manager": manager, "policy": self.policy_fact, "payload": self.payload, "listener": self.listener, "test_boundary": self.test_boundary}))
        return self.ready

    def reserve_start(self, slot: int, ledger_record_ref: str) -> None:
        state = self._slot(slot)
        if state.reservation is not None or state.start_attempted or not re.fullmatch(r"[0-9a-f]{64}", ledger_record_ref):
            raise BackendError("SLOT_RESERVATION")
        state.reservation = ledger_record_ref

    def _manager_environment(self, policy: Any, deadline: int) -> dict[str, Any]:
        """Validate authenticated manager globals without publishing values.

        PID1's service environment is distinct from the launcher's environment.
        Only these three names may be present, and the service overwrites all
        three. A read plus Start is not atomic: PID1 and absence of concurrent
        administrative environment setters remain trusted pilot assumptions.
        """
        self._check(deadline, work=True)
        entries = policy.get("Environment") if type(policy) is dict else None
        allowed = {"PATH", "LANG", "LC_ALL"}
        names, assignments = set(), []
        valid = type(entries) is list and len(entries) <= len(allowed)
        if valid:
            for entry in entries:
                if (type(entry) is not str or len(entry) > 4096 or "=" not in entry
                        or any(ord(ch) < 32 or ord(ch) > 126 for ch in entry)):
                    valid = False
                    break
                name = entry.split("=", 1)[0]
                if name not in allowed or name in names:
                    valid = False
                    break
                names.add(name)
                assignments.append(entry)
        self._check(deadline, work=True)
        if not valid:
            self.invalid = "MANAGER_ENVIRONMENT_POLICY"
            raise BackendError(self.invalid)
        return {"names": sorted(names), "assignments_ref": digest_record({"assignments": sorted(assignments)})}

    def _argv(self, slot: int) -> tuple[str, ...]:
        return (self.payload["absolute_path"], "--run", self.spec.run, "--slot", str(slot), "--ipc", self.listener,
                "--t0-us", str(self.spec.t0_us), "--work-deadline-us", str(self.spec.work_deadline_us),
                "--cleanup-deadline-us", str(self.spec.cleanup_deadline_us), "--watchdog-pid", str(self.watchdog_generation["pid"]),
                "--watchdog-start-ticks", self.watchdog_generation["start_ticks"])

    def start_reserved(self, slot_id: int, payload_binding: Any, deadline_us: int) -> StartOutcome:
        state = self._slot(slot_id)
        deadline = self._check(deadline_us, work=True)
        if self.ready is None or not self.ready.jobs_listener_ready or self.cleanup_started or state.reservation is None or state.start_attempted:
            raise BackendError("START_NOT_ALLOWED")
        if validate_payload_binding(payload_binding) != self.payload:
            raise BackendError("PAYLOAD_BINDING")
        now = self.budget.now()
        runtime = min(40_000_000, self.spec.work_deadline_us - now - 5_500_000)
        if runtime <= 0:
            raise BackendError("NO_START_BUDGET")
        self.identity.verify_payload(self.payload, self.spec.run, self.spec.payload_expected_sha256, deadline)
        # Recheck inherited configuration before the irreversible one-shot send.
        policy = self.transport.call_closed(ManagerPolicyRequest(), deadline).value
        environment = self._manager_environment(policy, deadline)
        if self.manager_environment_fact is None or environment != self.manager_environment_fact:
            self.invalid = "MANAGER_ENVIRONMENT_CHANGED"
            raise BackendError(self.invalid)
        paths = policy.get("UnitPath")
        self.identity.policy(paths, (self.spec.slots[slot_id].unit_name,), deadline)
        # Bracket filesystem policy checks with a fresh authenticated manager
        # capture immediately before the one-shot Start. This is still not an
        # atomic Get+Start or a guarantee against trusted-host admin mutations.
        confirmed = self.transport.call_closed(ManagerPolicyRequest(), deadline).value
        if self._manager_environment(confirmed, deadline) != self.manager_environment_fact:
            self.invalid = "MANAGER_ENVIRONMENT_CHANGED"
            raise BackendError(self.invalid)
        if confirmed.get("UnitPath") != paths:
            self.invalid = "MANAGER_AUTHORITY_POLICY"
            raise BackendError(self.invalid)
        now = self.budget.now()
        runtime = min(40_000_000, self.spec.work_deadline_us - now - 5_500_000)
        if runtime <= 0:
            raise BackendError("NO_START_BUDGET")
        request = StartRequest(self.spec.slots[slot_id].unit_name, self._argv(slot_id), self.spec.load_uid,
                               self.spec.load_gid, self.spec.load_groups, runtime)
        state.expected_argv = request.argv
        state.expected_properties = start_properties(request)
        state.start_request_ref = digest_record({"slot": slot_id, "reservation": state.reservation,
                                                "argv": list(request.argv), "runtime_max_us": str(runtime), "ready_ref": self.ready.ref})
        state.start_attempted = True  # Consumed before invocation; never restored on uncertainty.
        try:
            path = self.transport.call_closed(request, deadline).value
            state.start_job_path = path
            ref = self._job_ref(slot_id, path, "start")
            return StartOutcome("ACCEPTED", slot_id, state.start_request_ref, ref, None)
        except BusRemoteError as exc:
            return StartOutcome("REJECTED", slot_id, state.start_request_ref, None, exc.name)
        except (TransportError, OSError, ValueError) as exc:
            if self.transport.invalid:
                self.invalid = self.transport.invalid
            return StartOutcome("UNKNOWN", slot_id, state.start_request_ref, None, getattr(exc, "code", type(exc).__name__))

    def _job_ref(self, slot: int, path: str, kind: str) -> str:
        return digest_record({"kind": kind, "slot": slot, "boot_id": self.ready.manager_binding["boot_id"],
                              "bus_guid": self.ready.manager_binding["bus_guid"], "owner": self.ready.manager_binding["owner_unique_name"],
                              "job_id": job_id(path), "job_path": path, "unit_name": self.spec.slots[slot].unit_name})

    def _snapshot(self, slot: int, deadline: int) -> dict[str, Any]:
        value = self.transport.call_closed(SnapshotRequest(self.spec.slots[slot].unit_name), deadline).value
        unit, service = value["unit"], value["service"]
        needed_unit = {"Id", "InvocationID", "ActiveState", "SubState", "Job", "Transient"}
        needed_service = {"MainPID", "ControlPID", "ControlGroup", "ControlGroupId", "ExecStart", "ExecStartPre", "ExecStartPost", "ExecStop", "ExecStopPost", "Type", "Restart", "RemainAfterExit", "NotifyAccess", "KillMode",
                          "Environment", "PassEnvironment", "EnvironmentFiles", "PAMName", "UnsetEnvironment"}
        if not needed_unit <= set(unit) or not needed_service <= set(service) or value["object_path"] != unit_path(self.spec.slots[slot].unit_name) or unit["Id"] != self.spec.slots[slot].unit_name or unit["Transient"] is not True or not re.fullmatch(r"[0-9a-f]{32}", unit["InvocationID"]) or unit["InvocationID"] == "0" * 32:
            raise BackendError("UNIT_SNAPSHOT")
        if any(service[k] for k in ("ExecStartPre", "ExecStartPost", "ExecStop", "ExecStopPost")) or any(service[k] != v for k, v in {"Type": "exec", "Restart": "no", "RemainAfterExit": False, "NotifyAccess": "none", "KillMode": "control-group"}.items()):
            self.invalid = "UNEXPECTED_EXECUTION_POLICY"
            raise BackendError(self.invalid)
        environment_profile = {"Environment": list(SERVICE_ENVIRONMENT), "PassEnvironment": [],
                               "EnvironmentFiles": [], "PAMName": "", "UnsetEnvironment": list(SERVICE_UNSET_ENVIRONMENT)}
        if any(service[name] != expected for name, expected in environment_profile.items()):
            self.invalid = "UNEXPECTED_EXECUTION_POLICY"
            raise BackendError(self.invalid)
        entries = service["ExecStart"]
        state = self._slot(slot)
        for name, signature, expected in state.expected_properties or ():
            if name == "ExecStart":
                continue
            if signature in ("as", "a(sb)"):
                expected = list(expected)
            actual = unit if name == "DefaultDependencies" else service
            if name not in actual or actual[name] != expected:
                self.invalid = "UNEXPECTED_EXECUTION_POLICY"
                raise BackendError(self.invalid)
        if len(entries) != 1 or entries[0].get("argv") != list(state.expected_argv or ()) or entries[0].get("path") != self.payload["absolute_path"] or entries[0].get("ignore_failure") is not False:
            self.invalid = "UNEXPECTED_EXECUTION_POLICY"
            raise BackendError(self.invalid)
        return value

    def _candidate(self, slot: int, snapshot: dict[str, Any]) -> dict[str, Any]:
        unit, service = snapshot["unit"], snapshot["service"]
        return validate_unit_candidate({"slot": slot, "name": self.spec.slots[slot].unit_name, "object_path": snapshot["object_path"],
                                        "invocation_id": unit["InvocationID"], "manager_binding_ref": digest_record(self.ready.manager_binding),
                                        "control_group": service["ControlGroup"], "control_group_id": str(service["ControlGroupId"]), "main_pid": service["MainPID"]})

    def observe_candidate(self, slot_id: int, deadline_us: int) -> dict[str, Any]:
        deadline = self._check(deadline_us, work=True)
        state = self._slot(slot_id)
        if not state.start_attempted:
            raise BackendError("UNIT_NOT_STARTED")
        candidate = self._candidate(slot_id, self._snapshot(slot_id, deadline))
        if state.candidate is not None and state.candidate != candidate:
            self.invalid = "UNIT_IDENTITY_CHANGED"
            raise BackendError(self.invalid)
        state.candidate = candidate
        return dict(candidate)

    def bind_unit(self, slot_id: int, authenticated_keeper_generation: Any, deadline_us: int) -> dict[str, Any]:
        deadline = self._check(deadline_us, work=True)
        state = self._slot(slot_id)
        if state.binding is not None or state.candidate is None:
            raise BackendError("KEEPER_BIND_ORDER")
        generation = validate_process_generation(authenticated_keeper_generation)
        candidate = self._candidate(slot_id, self._snapshot(slot_id, deadline))
        if candidate != state.candidate or generation["pid"] != candidate["main_pid"] or generation["boot_id"] != self.ready.manager_binding["boot_id"]:
            self.invalid = "KEEPER_UNIT_IDENTITY_CHANGED"
            raise BackendError(self.invalid)
        try:
            self.identity.verify_workload(generation, self.payload, candidate["control_group"], deadline)
        except (BackendError, TransportError) as exc:
            if getattr(exc, "code", "") in {"KEEPER_GENERATION", "KEEPER_EXEC_IDENTITY", "KEEPER_PHYSICAL_IDENTITY", "PROCESS_GENERATION", "PROCFS_IDENTITY"}:
                self.invalid = exc.code
            raise
        pin = self.identity.pin(generation, deadline)
        try:
            final = self._candidate(slot_id, self._snapshot(slot_id, deadline))
            if final != candidate:
                self.invalid = "KEEPER_UNIT_IDENTITY_CHANGED"
                raise BackendError(self.invalid)
            binding = dict(candidate)
            del binding["main_pid"]
            binding["keeper_generation_ref"] = digest_record(generation)
            state.binding = validate_unit_binding(binding)
            state.generation, state.pin = generation, pin
            return dict(state.binding)
        except BaseException:
            pin.close()
            raise

    def begin_cleanup(self) -> None:
        self.cleanup_started = True

    def _original(self, slot: int, snapshot: dict[str, Any], deadline: int) -> None:
        state = self._slot(slot)
        if state.binding is None:
            raise BackendError("ORIGINAL_BINDING_MISSING")
        unit, service = snapshot["unit"], snapshot["service"]
        same_group = service["ControlGroup"] == state.binding["control_group"] and str(service["ControlGroupId"]) == state.binding["control_group_id"]
        terminal = unit["ActiveState"] in ("inactive", "failed") and unit["SubState"] in ("dead", "failed") and tuple(unit["Job"]) == (0, "/") and service["MainPID"] == 0 and service["ControlPID"] == 0
        cleared_pair = terminal and service["ControlGroup"] == "" and service["ControlGroupId"] == 0
        # A paired clear in this exact same invocation is a manager terminal fact.
        # It provides no physical empty/removed observation; the observer remains separate.
        if snapshot["object_path"] != state.binding["object_path"] or unit["InvocationID"] != state.binding["invocation_id"] or not (same_group or cleared_pair) or service["MainPID"] not in (0, state.generation["pid"]):
            self.invalid = "UNIT_IDENTITY_CHANGED"
            raise BackendError(self.invalid)
        if service["MainPID"]:
            try:
                self.identity.verify_workload(state.generation, self.payload, state.binding["control_group"], deadline)
            except (BackendError, TransportError) as exc:
                if getattr(exc, "code", "") in {"KEEPER_GENERATION", "KEEPER_EXEC_IDENTITY", "KEEPER_PHYSICAL_IDENTITY", "PROCESS_GENERATION", "PROCFS_IDENTITY"}:
                    self.invalid = exc.code
                raise

    def capture_main_exit(self, slot_id: int, deadline_us: int) -> dict[str, Any] | None:
        deadline = self._check(deadline_us)
        state = self._slot(slot_id)
        if state.binding is None:
            return None
        before = self.budget.now()
        snapshot = self._snapshot(slot_id, deadline)
        self._original(slot_id, snapshot, deadline)
        return self._capture_exit_from_snapshot(slot_id, snapshot, before, deadline)

    def _capture_exit_from_snapshot(self, slot_id: int, snapshot: dict[str, Any],
                                    before: int, deadline: int) -> dict[str, Any] | None:
        """Retain exit facts from an already authenticated original snapshot.

        No second unit lookup is needed: GC may unload the original unit after
        this read. The original manager/keeper facts remain separate from any
        subsequent physical observation.
        """
        state = self._slot(slot_id)
        service = snapshot["service"]
        if service.get("ExecMainCode") not in (1, 2, 3):
            return None
        fact = validate_systemd_main_exit({"tag": "SYSTEMD_MAIN_EXIT", "original_process_generation": state.generation,
                                           "invocation_id": state.binding["invocation_id"], "exec_main_pid": service.get("ExecMainPID"),
                                           "exec_main_code": {1: "CLD_EXITED", 2: "CLD_KILLED", 3: "CLD_DUMPED"}[service["ExecMainCode"]],
                                           "exec_main_status": service.get("ExecMainStatus"), "start_timestamp_us": str(service.get("ExecMainStartTimestampMonotonic")),
                                           "exit_timestamp_us": str(service.get("ExecMainExitTimestampMonotonic")), "before_us": str(before), "after_us": str(self.budget.now())})
        self._check(deadline)
        state.exit_fact = fact
        return dict(fact)

    def stop_once(self, unit_binding: Any, deadline_us: int) -> StopOutcome:
        deadline = self._check(deadline_us)
        binding = validate_unit_binding(unit_binding)
        state = self._slot(binding["slot"])
        if state.binding != binding or state.stop_attempted:
            raise BackendError("STOP_NOT_ALLOWED")
        self.cleanup_started = True
        # Capture original snapshot before Stop can unload/clear service fields.
        before = self.budget.now()
        snapshot = self._snapshot(binding["slot"], deadline)
        self._original(binding["slot"], snapshot, deadline)
        if snapshot["service"].get("ExecMainCode") in (1, 2, 3):
            self._capture_exit_from_snapshot(binding["slot"], snapshot, before, deadline)
        state.stop_request_ref = digest_record({"binding": binding, "before_us": str(self.budget.now()), "ready_ref": self.ready.ref})
        state.stop_attempted = True
        try:
            path = self.transport.call_closed(StopRequest(binding["name"]), deadline).value
            state.stop_job_path = path
            return StopOutcome("ACCEPTED", binding["slot"], state.stop_request_ref, self._job_ref(binding["slot"], path, "stop"), None)
        except BusRemoteError as exc:
            return StopOutcome("REJECTED", binding["slot"], state.stop_request_ref, None, exc.name)
        except (TransportError, OSError, ValueError) as exc:
            if self.transport.invalid:
                self.invalid = self.transport.invalid
            return StopOutcome("UNKNOWN", binding["slot"], state.stop_request_ref, None, getattr(exc, "code", type(exc).__name__))

    def poll_events(self, deadline_us: int) -> list[JobEvent]:
        deadline = self._check(deadline_us)
        try:
            events = self.transport.poll_events(deadline)
        except TransportError:
            if self.transport.invalid:
                self.invalid = self.transport.invalid
            raise
        for event in events:
            slot = next(s.slot for s in self.spec.slots if s.unit_name == event.unit_name)
            state = self._slot(slot)
            previous = state.events.get(event.job_path)
            if previous is not None and previous != event:
                self.invalid = "JOB_RECEIPT_CONFLICT"
                raise BackendError(self.invalid)
            state.events[event.job_path] = event
        return events

    def _settlement(self, slot: int, kind: str) -> dict[str, Any] | None:
        state = self._slot(slot)
        path = state.start_job_path if kind == "start" else state.stop_job_path
        event = state.events.get(path) if path else None
        if event is None:
            return None
        manager = self.ready.manager_binding
        if (event.boot_id, event.bus_guid, event.owner_unique_name, event.unit_name, event.job_id) != (manager["boot_id"], manager["bus_guid"], manager["owner_unique_name"], self.spec.slots[slot].unit_name, job_id(path)):
            self.invalid = "JOB_CORRELATION"
            raise BackendError(self.invalid)
        return {"kind": kind, "job_ref": self._job_ref(slot, path, kind), "request_ref": state.start_request_ref if kind == "start" else state.stop_request_ref, "event": event.to_mapping()}

    def cleanup_receipts(self, slot: int, deadline_us: int) -> dict[str, Any]:
        deadline = self._check(deadline_us)
        state = self._slot(slot)
        self.poll_events(deadline)
        start, stop = self._settlement(slot, "start"), self._settlement(slot, "stop")
        before = self.budget.now()
        missing: list[str] = []
        if state.binding is not None:
            try:
                snapshot = self._snapshot(slot, deadline)
                self._original(slot, snapshot, deadline)
                unit, service = snapshot["unit"], snapshot["service"]
                if service.get("ExecMainCode") in (1, 2, 3):
                    self._capture_exit_from_snapshot(slot, snapshot, before, deadline)
                if unit["ActiveState"] in ("inactive", "failed") and unit["SubState"] in ("dead", "failed") and tuple(unit["Job"]) == (0, "/") and service["MainPID"] == 0 and service["ControlPID"] == 0:
                    state.final_receipt = {"original_unit_binding_ref": digest_record(state.binding), "manager_binding_ref": digest_record(self.ready.manager_binding), "invocation_id": state.binding["invocation_id"], "snapshot": copy.deepcopy(snapshot), "before_us": str(before), "after_us": str(self.budget.now())}
                else:
                    state.final_receipt = None
                    missing.append("FINAL_UNIT_TERMINAL")
            except BusRemoteError as exc:
                if exc.name != "org.freedesktop.systemd1.NoSuchUnit":
                    raise
                # A terminal snapshot captured from the original manager before
                # unload remains evidence. Absence cannot create that snapshot.
                if not self._valid_final_receipt(slot, state.final_receipt, deadline):
                    missing.append("FINAL_UNIT_UNAVAILABLE")
            if state.pin is not None:
                state.release_fact = self.identity.release_fact(state.pin, deadline)
        keeper = None
        if state.exit_fact is not None and state.release_fact is not None:
            validate_main_release_facts(state.exit_fact, state.release_fact)
            keeper = {"systemd_main_exit": state.exit_fact, "pidfd_task_released": state.release_fact}
        self._check(deadline)
        records = {"start_receipt": start, "stop_receipt": stop, "final_unit_receipt": state.final_receipt, "keeper_reap_receipt": keeper}
        return copy.deepcopy({**records, "start_settlement_ref": digest_record(start) if start else None,
                "stop_settlement_ref": digest_record(stop) if stop else None,
                "final_unit_receipt_ref": digest_record(state.final_receipt) if state.final_receipt else None,
                "keeper_reap_receipt_ref": digest_record(keeper) if keeper else None,
                "activations_settled": start is not None, "stop_settled": stop is not None,
                "terminal_no_pending_execution": state.final_receipt is not None,
                "keeper_reaped": keeper is not None, "missing_evidence": missing,
                "test_boundary": self.test_boundary})

    job_receipts = cleanup_receipts

    def delegation_observation(self, unit_mapping: Any, deadline_us: int) -> dict[str, Any]:
        """Read the actual Delegate property through the original native driver.

        The property is never defaulted, and fixed GetAll reads grant no manager
        mutation or physical authority. Original invocation checks bracket it.
        """
        from .sd_bus_transport import _NativeBus
        if (sys.platform != "linux" or type(self) is not SystemdBackend
                or self.test_boundary or type(self.identity) is not _NativeIdentity
                or type(self.transport) is not SdBusTransport or self.transport.test_boundary
                or type(self.transport.driver) is not _NativeBus):
            raise BackendError("NATIVE_DELEGATION_OBSERVER_REQUIRED")
        deadline = self._check(deadline_us)
        original = validate_unit_binding(unit_mapping)
        state = self._slot(original["slot"])
        if state.binding != original:
            raise BackendError("ORIGINAL_BINDING_MISSING")
        if self.ready is None or self.transport.binding is None:
            raise BackendError("MANAGER_AUTHORITY_UNAVAILABLE")
        end = self.budget.begin(deadline)
        before = self.budget.now()
        before_manager = validate_manager_binding(self.transport.verify_identity(end))
        if before_manager != self.ready.manager_binding or self.transport.driver.owner != before_manager["owner_unique_name"]:
            self.invalid = "MANAGER_IDENTITY_CHANGED"
            raise BackendError(self.invalid)
        snapshot = self._snapshot(original["slot"], end)
        self._original(original["slot"], snapshot, end)
        properties = self.transport.driver._rpc(before_manager["owner_unique_name"],
            original["object_path"], "org.freedesktop.DBus.Properties", "GetAll",
            (("s", "org.freedesktop.systemd1.Service"),), end, fields={"Delegate": "b"})
        if type(properties) is not dict or set(properties) != {"Delegate"} or type(properties["Delegate"]) is not bool:
            raise BackendError("DELEGATE_PROPERTY_UNAVAILABLE")
        snapshot = self._snapshot(original["slot"], end)
        self._original(original["slot"], snapshot, end)
        after_manager = validate_manager_binding(self.transport.verify_identity(end))
        if after_manager != before_manager or after_manager != self.ready.manager_binding:
            self.invalid = "MANAGER_IDENTITY_CHANGED"
            raise BackendError(self.invalid)
        if state.binding != original:
            self.invalid = "UNIT_IDENTITY_CHANGED"
            raise BackendError(self.invalid)
        self._check(end)
        self.budget.end(end)
        return copy.deepcopy({"original_unit_binding": original,
                              "current_manager_before": before_manager,
                              "current_manager_after": after_manager, "properties": properties,
                              "before_us": str(before), "after_us": str(self.budget.now())})

    def terminal_observation(self, slot_id: int, deadline_us: int) -> dict[str, Any]:
        """Original settled manager facts, before an independent physical probe.

        A current absent/cleared unit cannot create missing terminal or keeper
        release evidence. This read-only record has no physical closure or
        distribution-release dependency.
        """
        deadline = self._check(deadline_us)
        state = self._slot(slot_id)
        if not self.cleanup_started:
            raise BackendError("TERMINAL_REQUIRES_CLEANUP")
        if state.binding is None:
            raise BackendError("ORIGINAL_BINDING_MISSING")
        if self.ready is None or self.transport.binding is None:
            raise BackendError("MANAGER_AUTHORITY_UNAVAILABLE")
        original = validate_unit_binding(state.binding)
        before_manager = validate_manager_binding(self.transport.verify_identity(deadline))
        if before_manager != self.ready.manager_binding:
            self.invalid = "MANAGER_IDENTITY_CHANGED"
            raise BackendError(self.invalid)
        graph = self.cleanup_receipts(slot_id, deadline)
        if self.validate_release_graph(slot_id, graph, deadline) is not True:
            raise BackendError("TERMINAL_GRAPH_INCOMPLETE")
        try:
            snapshot = self._snapshot(slot_id, deadline)
        except BusRemoteError as error:
            if error.name != "org.freedesktop.systemd1.NoSuchUnit":
                raise
            unit_state_read = {"kind": "NO_SUCH_UNIT", "error_name": error.name,
                               "object_path": original["object_path"]}
        else:
            self._original(slot_id, snapshot, deadline)
            unit, service = snapshot["unit"], snapshot["service"]
            if (unit["ActiveState"] not in ("inactive", "failed")
                    or unit["SubState"] not in ("dead", "failed")
                    or tuple(unit["Job"]) != (0, "/") or type(unit["Job"][0]) is not int
                    or type(service["MainPID"]) is not int or service["MainPID"] != 0
                    or type(service["ControlPID"]) is not int or service["ControlPID"] != 0
                    or service["ControlGroup"] != ""
                    or type(service["ControlGroupId"]) is not int or service["ControlGroupId"] != 0):
                raise BackendError("TERMINAL_STATE_UNAVAILABLE")
            unit_state_read = {"kind": "TERMINAL_CLEARED", "snapshot": snapshot}
        after_manager = validate_manager_binding(self.transport.verify_identity(deadline))
        if after_manager != before_manager or after_manager != self.ready.manager_binding:
            self.invalid = "MANAGER_IDENTITY_CHANGED"
            raise BackendError(self.invalid)
        if state.binding != original:
            self.invalid = "UNIT_IDENTITY_CHANGED"
            raise BackendError(self.invalid)
        self._check(deadline)
        return copy.deepcopy({"original_unit_binding": original,
                              "current_manager_before": before_manager,
                              "current_manager_after": after_manager,
                              "cleanup_graph": graph, "unit_state_read": unit_state_read})

    def _receipt_time(self, value: Any, deadline: int) -> int:
        stamp = parse_u64(value)
        if not self.spec.t0_us <= stamp < min(deadline, self.budget.lease, self.spec.cleanup_deadline_us) or stamp > self.budget.now():
            raise ValueError("RECEIPT_TIME")
        return stamp

    def _valid_final_receipt(self, slot: int, receipt: Any, deadline: int) -> bool:
        """Check a retained manager snapshot; never derive one from NoSuchUnit."""
        state = self._slot(slot)
        try:
            if state.binding is None or self.ready is None or type(receipt) is not dict or set(receipt) != {"original_unit_binding_ref", "manager_binding_ref", "invocation_id", "snapshot", "before_us", "after_us"}:
                return False
            binding = validate_unit_binding(state.binding)
            if (receipt["original_unit_binding_ref"], receipt["manager_binding_ref"], receipt["invocation_id"]) != (digest_record(binding), digest_record(self.ready.manager_binding), binding["invocation_id"]):
                return False
            before, after = self._receipt_time(receipt["before_us"], deadline), self._receipt_time(receipt["after_us"], deadline)
            if before > after:
                return False
            snapshot = receipt["snapshot"]
            if type(snapshot) is not dict or set(snapshot) != {"object_path", "unit", "service"}:
                return False
            unit, service = snapshot["unit"], snapshot["service"]
            if type(unit) is not dict or type(service) is not dict:
                return False
            if snapshot["object_path"] != binding["object_path"] or unit["Id"] != binding["name"] or unit["InvocationID"] != binding["invocation_id"] or unit["Transient"] is not True or unit["DefaultDependencies"] is not False:
                return False
            if unit["ActiveState"] not in ("inactive", "failed") or unit["SubState"] not in ("dead", "failed") or tuple(unit["Job"]) != (0, "/") or type(unit["Job"][0]) is not int or type(service["MainPID"]) is not int or service["MainPID"] != 0 or type(service["ControlPID"]) is not int or service["ControlPID"] != 0:
                return False
            same_group = service["ControlGroup"] == binding["control_group"] and str(service["ControlGroupId"]) == binding["control_group_id"]
            cleared_pair = service["ControlGroup"] == "" and type(service["ControlGroupId"]) is int and service["ControlGroupId"] == 0
            return same_group or cleared_pair
        except (ContractError, KeyError, TypeError, ValueError):
            return False

    def validate_release_graph(self, slot_id: int, graph: Any, deadline_us: int) -> bool:
        """Authenticate a bound graph against this backend's original producers.

        Caller flags and well-formed hashes grant no authority. Manager/lease
        failures still raise; malformed or contradictory caller evidence is false.
        Physical removal is a separate observer obligation.
        """
        deadline = self._check(deadline_us)
        state = self._slot(slot_id)
        if self.ready is None or self.transport.binding is None:
            raise BackendError("MANAGER_AUTHORITY_UNAVAILABLE")
        manager = validate_manager_binding(self.transport.verify_identity(deadline))
        if manager != self.ready.manager_binding:
            self.invalid = "MANAGER_IDENTITY_CHANGED"
            raise BackendError(self.invalid)
        keys = {"start_receipt", "stop_receipt", "final_unit_receipt", "keeper_reap_receipt",
                "start_settlement_ref", "stop_settlement_ref", "final_unit_receipt_ref", "keeper_reap_receipt_ref",
                "activations_settled", "stop_settled", "terminal_no_pending_execution", "keeper_reaped",
                "missing_evidence", "test_boundary"}
        try:
            if not self.cleanup_started or type(graph) is not dict or set(graph) != keys or graph["test_boundary"] is not self.test_boundary or graph["missing_evidence"] != []:
                return False
            if any(graph[key] is not True for key in ("activations_settled", "stop_settled", "terminal_no_pending_execution", "keeper_reaped")):
                return False
            if not state.start_attempted or not state.stop_attempted or state.binding is None or state.generation is None or state.pin is None or state.pin.closed or state.pin.generation != state.generation:
                return False
            binding = validate_unit_binding(state.binding)
            generation = validate_process_generation(state.generation)
            if binding["slot"] != slot_id or binding["name"] != self.spec.slots[slot_id].unit_name or binding["object_path"] != unit_path(binding["name"]) or binding["manager_binding_ref"] != digest_record(manager) or binding["keeper_generation_ref"] != digest_record(generation) or generation["boot_id"] != manager["boot_id"]:
                return False
            if not state.start_job_path or not state.stop_job_path or not state.start_request_ref or not state.stop_request_ref:
                return False
            original = {"start_receipt": self._settlement(slot_id, "start"),
                        "stop_receipt": self._settlement(slot_id, "stop"),
                        "final_unit_receipt": state.final_receipt,
                        "keeper_reap_receipt": {"systemd_main_exit": state.exit_fact, "pidfd_task_released": state.release_fact}}
            pairs = (("start_receipt", "start_settlement_ref"), ("stop_receipt", "stop_settlement_ref"),
                     ("final_unit_receipt", "final_unit_receipt_ref"), ("keeper_reap_receipt", "keeper_reap_receipt_ref"))
            for record_key, ref_key in pairs:
                record = graph[record_key]
                if type(record) is not dict or record != original[record_key] or graph[ref_key] != digest_record(record):
                    return False
            for kind in ("start", "stop"):
                receipt = graph[kind + "_receipt"]
                path = state.start_job_path if kind == "start" else state.stop_job_path
                request_ref = state.start_request_ref if kind == "start" else state.stop_request_ref
                if set(receipt) != {"kind", "job_ref", "request_ref", "event"} or receipt["kind"] != kind or receipt["job_ref"] != self._job_ref(slot_id, path, kind) or receipt["request_ref"] != request_ref or not re.fullmatch(r"[0-9a-f]{64}", request_ref):
                    return False
                event = receipt["event"]
                if type(event) is not dict or set(event) != {"boot_id", "bus_guid", "owner_unique_name", "job_id", "job_path", "unit_name", "result", "observed_us"}:
                    return False
                if (event["boot_id"], event["bus_guid"], event["owner_unique_name"], event["job_path"], event["unit_name"], event["job_id"], event["result"]) != (manager["boot_id"], manager["bus_guid"], manager["owner_unique_name"], path, binding["name"], job_id(path), "done") or type(event["job_id"]) is not int or type(event["observed_us"]) is not int:
                    return False
                self._receipt_time(str(event["observed_us"]), deadline)
            if not self._valid_final_receipt(slot_id, graph["final_unit_receipt"], deadline):
                return False
            keeper = graph["keeper_reap_receipt"]
            if set(keeper) != {"systemd_main_exit", "pidfd_task_released"}:
                return False
            facts = validate_main_release_facts(keeper["systemd_main_exit"], keeper["pidfd_task_released"])
            exit_fact, release_fact = facts["exit"], facts["release"]
            if exit_fact["original_process_generation"] != generation or release_fact["original_process_generation"] != generation or exit_fact["invocation_id"] != binding["invocation_id"] or release_fact["procfs_namespace_ref"] != generation["pid_namespace_ref"]:
                return False
            for fact in (exit_fact, release_fact):
                if self._receipt_time(fact["before_us"], deadline) > self._receipt_time(fact["after_us"], deadline):
                    return False
            self._receipt_time(exit_fact["start_timestamp_us"], deadline)
            self._receipt_time(exit_fact["exit_timestamp_us"], deadline)
        except (ContractError, KeyError, TypeError, ValueError):
            return False
        self._check(deadline)
        return True

    def release_receipt(self, slot_id: int, deadline_us: int) -> dict[str, Any]:
        """Local custody proof; an unstarted reservation needs no invented unit graph.

        A consumed Start with no original correlated reply remains an obligation.
        This records future own execution, not physical removal or memory reclamation.
        """
        deadline = self._check(deadline_us)
        state = self._slot(slot_id)
        if not self.cleanup_started:
            raise BackendError("RELEASE_REQUIRES_CLEANUP")
        if self.transport.binding is None:
            raise BackendError("MANAGER_AUTHORITY_UNAVAILABLE")
        manager = validate_manager_binding(self.transport.verify_identity(deadline))
        if self.ready is not None and manager != self.ready.manager_binding:
            self.invalid = "MANAGER_IDENTITY_CHANGED"
            raise BackendError(self.invalid)
        receipts = None
        if not state.start_attempted:
            basis = "RESERVED_NOT_DISPATCHED" if state.reservation is not None else "NOT_RESERVED_NOT_DISPATCHED"
            no_future = True  # Irreversible cleanup forbids every subsequent own Start.
        elif state.start_job_path is None:
            basis, no_future = "START_DISPATCHED_UNKNOWN", False
        else:
            basis = "START_DISPATCHED_BOUND"
            receipts = self.cleanup_receipts(slot_id, deadline)
            no_future = self.validate_release_graph(slot_id, receipts, deadline)
        self._check(deadline)
        return {"slot": slot_id, "run": self.spec.run, "reservation_ref": state.reservation,
                "payload_binding_ref": digest_record(self.payload), "manager_binding_ref": digest_record(manager),
                "basis": basis, "no_future_own_exec": no_future, "observed_us": str(self.budget.now()),
                "authority_lease_until_us": str(self.budget.lease), "cleanup_receipts": receipts,
                "test_boundary": self.test_boundary}

    def close(self) -> None:
        if not self.closed:
            for state in self.slots:
                if state.pin is not None:
                    state.pin.close()
            self.identity.close()
            self.transport.close()
            self.closed = True
