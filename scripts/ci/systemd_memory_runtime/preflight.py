"""Read-only capability inventory. No escalation, installation or unit mutation."""
from __future__ import annotations

import ctypes
import importlib.util
import os
from pathlib import Path, PurePosixPath
import re
import shutil
import signal
import select
import json
import sys
import time
from dataclasses import dataclass
from typing import Any

from .contracts import ContractError, RunSpec


@dataclass(frozen=True)
class PreflightResult:
    passed: bool
    facts: dict[str, Any]
    missing: tuple[str, ...]

    def to_mapping(self) -> dict[str, Any]:
        return {"passed": self.passed, "facts": self.facts, "missing": list(self.missing)}


class ActualReadOnlyProbes:
    """Fixed local Linux reads; this class never invokes sudo, systemctl or a shell."""

    platform = sys.platform

    def _linux(self) -> None:
        if self.platform != "linux":
            raise RuntimeError("Linux capability probe unavailable")

    def boot_id(self) -> str:
        self._linux()
        return Path("/proc/sys/kernel/random/boot_id").read_text().strip()

    def namespaces(self) -> dict[str, str]:
        self._linux()
        return {"pid": os.readlink("/proc/self/ns/pid"), "mnt": os.readlink("/proc/self/ns/mnt")}

    def os_release(self) -> dict[str, str]:
        self._linux()
        result: dict[str, str] = {}
        for line in Path("/etc/os-release").read_text().splitlines():
            if line.startswith(("ID=", "VERSION_ID=")):
                key, value = line.split("=", 1)
                result[key] = value.strip('"')
        return result

    def control_uid(self) -> int:
        self._linux()
        return os.geteuid()

    def load_identity(self, uid: int, gid: int) -> dict[str, Any]:
        self._linux()
        import pwd
        entry = pwd.getpwuid(uid)
        return {"uid": entry.pw_uid, "gid": entry.pw_gid,
                "groups": sorted(set(os.getgrouplist(entry.pw_name, entry.pw_gid)))}

    def systemd_running(self) -> bool:
        self._linux()
        return Path("/run/systemd/system").is_dir()

    def cgroup_info(self) -> dict[str, Any]:
        self._linux()
        membership = [line[3:] for line in Path("/proc/self/cgroup").read_text().splitlines()
                      if line.startswith("0::")]
        if len(membership) != 1:
            raise RuntimeError("Unified membership unavailable")
        path = membership[0]
        if not path.startswith("/") or ".." in PurePosixPath(path).parts:
            raise RuntimeError("Invalid unified membership")
        mounts = []
        for line in Path("/proc/self/mountinfo").read_text().splitlines():
            fields = line.split()
            if "-" in fields:
                separator = fields.index("-")
                if len(fields) > separator + 1 and fields[separator + 1] == "cgroup2":
                    mounts.append(fields)
        if len(mounts) != 1:
            raise RuntimeError("A unique cgroup2 mount is required")
        fields = mounts[0]
        # First pilot accepts an unambiguous root mount; the physical reader owns richer binding.
        if fields[3] != "/" or "\\" in fields[4]:
            raise RuntimeError("Unsupported cgroup2 mount topology")
        mount = Path(fields[4])
        current = mount / path.lstrip("/")
        return {"filesystem": "cgroup2", "mount_id": fields[0], "mount_root": fields[3],
                "membership_path": path,
                "controllers": (current / "cgroup.controllers").read_text().split(),
                "subtree_control": (current / "cgroup.subtree_control").read_text().split()}

    def dependencies(self) -> dict[str, Any]:
        self._linux()
        library = False
        try:
            ctypes.CDLL("libsystemd.so.0")
            library = True
        except OSError:
            pass
        namespace = __package__
        return {"libsystemd": library, "compiler": shutil.which("cc") or shutil.which("gcc"),
                "physical_cgroup": importlib.util.find_spec(namespace + ".physical_cgroup") is not None,
                "payload_distribution": importlib.util.find_spec(namespace + ".payload_distribution") is not None}


class _BoundedNativeProbes:
    """Supervise each fixed read in an own child; a stuck native/NSS call is bounded.

    An unconsumed wait is unavailable, never reaped. No later probe child is
    created after an uncertain outcome. This creates no systemd services.
    """
    platform = sys.platform
    _methods = frozenset(("boot_id", "namespaces", "os_release", "control_uid", "load_identity", "systemd_running", "cgroup_info", "dependencies"))

    def __init__(self, spec, clock):
        self.spec, self.clock, self.source = spec, clock, ActualReadOnlyProbes()
        self.unavailable = False
        self.waits = []

    def __getattr__(self, name):
        if name not in self._methods:
            raise AttributeError(name)
        return lambda *args: self._read(name, args)

    def _read(self, name, args):
        if self.platform != "linux" or self.unavailable or signal.getsignal(signal.SIGCHLD) != signal.SIG_DFL:
            raise RuntimeError("Native probe unavailable")
        deadline = min(self.spec.work_deadline_us, self.clock() + 1_000_000)
        if self.clock() >= deadline:
            raise RuntimeError("Native probe deadline")
        reader, writer = os.pipe2(os.O_CLOEXEC | os.O_NONBLOCK)
        try:
            child = os.fork()
        except OSError:
            os.close(reader)
            os.close(writer)
            raise
        if child == 0:
            os.close(reader)
            try:
                value = getattr(self.source, name)(*args)
                raw = json.dumps({"value": value}, separators=(",", ":"), allow_nan=False).encode("utf-8")
                if len(raw) > 32768:
                    os._exit(3)
                offset = 0
                while offset < len(raw):
                    offset += os.write(writer, raw[offset:])
                os.close(writer)
                os._exit(0)
            except BaseException:
                os._exit(3)
        os.close(writer)
        raw, consumed, status, killed = bytearray(), 0, None, False
        try:
            eof = False
            while self.clock() < deadline:
                ready, _, _ = select.select([reader], [], [], min(0.05, (deadline - self.clock()) / 1_000_000))
                if ready and not eof:
                    part = os.read(reader, 32769 - len(raw))
                    if not part:
                        eof = True
                    raw.extend(part)
                    if len(raw) > 32768:
                        break
                consumed, status = os.waitpid(child, os.WNOHANG)
                if consumed == child and eof:
                    break
                # A consumed own-child wait cannot be requested a second time.
                if consumed == child:
                    while len(raw) <= 32768:
                        try:
                            part = os.read(reader, 32769 - len(raw))
                        except BlockingIOError:
                            break
                        if not part:
                            eof = True
                            break
                        raw.extend(part)
                    break
            if consumed == 0:
                self.unavailable = True
                # This original child cannot be reused while its wait is pending.
                try:
                    killed = True
                    os.kill(child, signal.SIGKILL)
                except ProcessLookupError:
                    pass
                consumed, status = os.waitpid(child, os.WNOHANG)
            self.waits.append({"requested_pid": child, "returned_pid": consumed,
                               "raw_wait_status": status if consumed == child else None,
                               "consumed": consumed == child})
            if consumed != child or not os.WIFEXITED(status) or os.WEXITSTATUS(status) != 0 or len(raw) > 32768 or self.clock() >= deadline:
                self.unavailable = True
                raise RuntimeError("Native probe result/reap/deadline unavailable")
            result = json.loads(raw.decode("utf-8", "strict"))
            if type(result) is not dict or set(result) != {"value"}:
                raise RuntimeError("Native probe result unavailable")
            return result["value"]
        except ChildProcessError:
            self.unavailable = True
            # ECHILD supplies no safe authority to signal a possibly reused PID.
            raise RuntimeError("Original probe child wait unavailable") from None
        except BaseException:
            self.unavailable = True
            if consumed == 0 and not killed:
                try:
                    os.kill(child, signal.SIGKILL)
                except ProcessLookupError:
                    pass
                os.waitpid(child, os.WNOHANG)
            raise
        finally:
            os.close(reader)


def preflight(run_spec: RunSpec | dict[str, Any], *, probes: Any = None,
              clock_us: Any = None) -> PreflightResult:
    """Inspect fixed capabilities. Injected probes are explicitly reported as hermetic."""
    spec = RunSpec.from_mapping(run_spec.to_mapping() if isinstance(run_spec, RunSpec) else run_spec)
    clock = clock_us or (lambda: time.monotonic_ns() // 1000)
    probe = _BoundedNativeProbes(spec, clock) if probes is None else probes
    facts: dict[str, Any] = {"probe_mode": "actual_read_only" if probes is None else "injected",
                             "platform": probe.platform, "unit_mutations": 0,
                             "installations": 0, "privilege_changes": 0,
                             "memory_reclamation": "NOT_ESTABLISHED"}
    missing: list[str] = []
    previous_now: int | None = None

    def fail(code: str) -> None:
        if code not in missing:
            missing.append(code)

    def now() -> int | None:
        nonlocal previous_now
        value = clock()
        if type(value) is not int or value < spec.t0_us or (previous_now is not None and value < previous_now):
            fail("CLOCK_VALID")
            return None
        previous_now = value
        if value >= spec.work_deadline_us:
            fail("DEADLINE")
        return value

    def read(label: str, code: str, method: Any) -> Any:
        before = now()
        if before is None or before >= spec.work_deadline_us:
            fail("DEADLINE")
            return None
        try:
            value = method()
        except (OSError, RuntimeError, ValueError, KeyError, TypeError, AttributeError) as exc:
            facts[label + "_error"] = type(exc).__name__
            fail(code)
            value = None
        after = now()
        if after is None or after >= spec.work_deadline_us:
            fail("DEADLINE")
        if after is not None and before is not None and after < before:
            fail("CLOCK_VALID")
        facts[label] = value
        return value

    initial = now()
    if probe.platform != "linux":
        fail("PLATFORM_LINUX")
        return PreflightResult(False, facts, tuple(missing))
    if initial is None or initial >= spec.work_deadline_us:
        return PreflightResult(False, facts, tuple(missing))
    boot = read("boot_id", "BOOT_ID", probe.boot_id)
    if not isinstance(boot, str) or not re.fullmatch(r"[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}", boot):
        fail("BOOT_ID")
    namespaces = read("namespaces", "NAMESPACES", probe.namespaces)
    if not isinstance(namespaces, dict) or set(namespaces) != {"pid", "mnt"} or any(
            not isinstance(value, str) or not re.fullmatch(re.escape(key) + r":\[[0-9]+\]", value)
            for key, value in (namespaces or {}).items()):
        fail("NAMESPACES")
    release = read("os_release", "UBUNTU_METADATA", probe.os_release)
    if not isinstance(release, dict) or release.get("ID") != "ubuntu" or release.get("VERSION_ID") != "24.04":
        fail("UBUNTU_METADATA")
    control = read("control_uid", "CONTROL_AUTHORITY", probe.control_uid)
    # This is a prerequisite for existing control authority, never an escalation request.
    if type(control) is not int or control != 0 or control == spec.load_uid:
        fail("CONTROL_AUTHORITY")
    load = read("load_identity", "LOAD_IDENTITY", lambda: probe.load_identity(spec.load_uid, spec.load_gid))
    if not isinstance(load, dict) or type(load.get("uid")) is not int or type(load.get("gid")) is not int or (
            load.get("uid") != spec.load_uid or load.get("gid") != spec.load_gid or
            not isinstance(load.get("groups"), list) or any(type(group) is not int for group in load["groups"]) or
            load.get("groups") != list(spec.load_groups)):
        fail("LOAD_IDENTITY")
    if read("systemd_running", "SYSTEMD_MANAGER", probe.systemd_running) is not True:
        fail("SYSTEMD_MANAGER")
    cgroup = read("cgroup_info", "CGROUP2", probe.cgroup_info)
    if not isinstance(cgroup, dict) or cgroup.get("filesystem") != "cgroup2" or cgroup.get("mount_root") != "/":
        fail("CGROUP2")
    else:
        controllers = cgroup.get("controllers")
        if not isinstance(controllers, list) or "memory" not in controllers:
            fail("MEMORY_CONTROLLER")
        if not isinstance(controllers, list) or "pids" not in controllers:
            fail("PIDS_CONTROLLER")
        facts["ancestor_controller_activation"] = "manager_may_enable_authorized_controllers; no direct writes here"
    dependencies = read("dependencies", "LIBSYSTEMD", probe.dependencies)
    if not isinstance(dependencies, dict):
        dependencies = {}
    for key, code in (("libsystemd", "LIBSYSTEMD"), ("physical_cgroup", "PHYSICAL_COMPONENT"),
                      ("payload_distribution", "PAYLOAD_COMPONENT")):
        if dependencies.get(key) is not True:
            fail(code)
    if not isinstance(dependencies.get("compiler"), str) or not dependencies["compiler"]:
        fail("NATIVE_COMPILER")
    final_boot = read("boot_id_after", "BOOT_ID", probe.boot_id)
    final_ns = read("namespaces_after", "NAMESPACES", probe.namespaces)
    if final_boot != boot:
        fail("BOOT_ID")
    if final_ns != namespaces:
        fail("NAMESPACES")
    facts["aggregate_memory_cap_bytes"] = sum(slot.memory_max_bytes for slot in spec.slots)
    facts["aggregate_task_cap"] = sum(slot.tasks_max for slot in spec.slots)
    facts["manager_authority"] = "not yet proven by persistent bus preflight"
    facts["physical_cleanup"] = "not observed by preflight"
    if probes is None:
        facts["native_probe_waits"] = probe.waits
        facts["probe_deadline_policy"] = "own-child supervision; <=1s each, original work deadline"
    return PreflightResult(not missing, facts, tuple(missing))
