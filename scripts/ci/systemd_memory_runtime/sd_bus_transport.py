"""Closed systemd sd-bus ABI. Native Linux code; hermetic tests are not Linux proof.

No variadic ctypes calls, shell, arbitrary destination/member, policy alteration or
bus reconnection. One connection and its signal slots live until close().
ABI reference: systemd v255 src/systemd/sd-bus.h and D-Bus interface XML.
"""
from __future__ import annotations

import ctypes as C
import errno
import hashlib
import json
import os
import re
import select
import socket
import stat
import struct
import sys
import time
from dataclasses import dataclass
from typing import Any

RPC_MAX_US = 1_000_000
UNIT_RE = re.compile(r"elogistix-memory-adapter-[0-9a-f]{32}\.service\Z")
MANAGER_PATH = "/org/freedesktop/systemd1"
MANAGER_INTERFACE = "org.freedesktop.systemd1.Manager"
DESTINATION = "org.freedesktop.systemd1"
BROKER = "org.freedesktop.DBus"
BROKER_PATH = "/org/freedesktop/DBus"
BROKER_INTERFACE = "org.freedesktop.DBus"
RESULTS = frozenset({"done", "canceled", "timeout", "failed", "dependency", "skipped", "invalid", "assert", "unsupported", "collected", "once"})
# Closed per-service profile. Manager globals are independently allowlisted;
# this finite deny list is additional defence, not a wildcard or all-risk claim.
SERVICE_ENVIRONMENT = ("PATH=/usr/bin:/bin", "LANG=C", "LC_ALL=C")
SERVICE_UNSET_ENVIRONMENT = (
    "GCONV_PATH", "GLIBC_TUNABLES", "LD_AUDIT", "LD_ASSUME_KERNEL", "LD_BIND_NOT", "LD_BIND_NOW",
    "LD_DEBUG", "LD_DEBUG_OUTPUT", "LD_DYNAMIC_WEAK", "LD_HWCAP_MASK", "LD_LIBRARY_PATH", "LD_NOSEGNEG",
    "LD_ORIGIN_PATH", "LD_POINTER_GUARD", "LD_PREFER_MAP_32BIT_EXEC", "LD_PRELOAD", "LD_PROFILE",
    "LD_PROFILE_OUTPUT", "LD_SHOW_AUXV", "LD_TRACE_LOADED_OBJECTS", "LD_TRACE_PRELINKING", "LD_USE_LOAD_BIAS",
    "LD_VERBOSE", "LD_WARN", "LOCPATH", "MALLOC_TRACE", "NLSPATH")


def monotonic_us() -> int:
    return time.monotonic_ns() // 1000


def record_ref(record: Any) -> str:
    return hashlib.sha256(json.dumps(record, sort_keys=True, separators=(",", ":"), allow_nan=False).encode()).hexdigest()


class TransportError(RuntimeError):
    def __init__(self, code: str, *, uncertain: bool = False):
        self.code, self.uncertain = code, uncertain
        super().__init__(code)


class BusRemoteError(TransportError):
    def __init__(self, name: str):
        self.name = name
        super().__init__("DBUS_REMOTE_ERROR")


class Budget:
    def __init__(self, clock: Any, lease: int):
        if type(lease) is not int or lease <= 0:
            raise TransportError("AUTHORITY_LEASE")
        self.clock, self.lease, self.last = clock, lease, -1

    def now(self) -> int:
        value = self.clock()
        if type(value) is not int or value < 0 or value < self.last:
            raise TransportError("CLOCK_INVALID")
        self.last = value
        return value

    def begin(self, deadline: int, max_us: int = RPC_MAX_US) -> int:
        now = self.now()
        if type(deadline) is not int or deadline <= now or self.lease <= now:
            raise TransportError("DEADLINE")
        return min(deadline, self.lease, now + max_us)

    def end(self, operation_end: int) -> None:
        if self.now() >= min(operation_end, self.lease):
            raise TransportError("DEADLINE", uncertain=True)


def _text(value: Any, limit: int = 4096) -> str:
    if not isinstance(value, str) or len(value.encode("utf-8")) > limit or "\x00" in value:
        raise TransportError("MALFORMED_TEXT")
    return value


def unit_path(name: str) -> str:
    if not isinstance(name, str) or not UNIT_RE.fullmatch(name):
        raise TransportError("UNIT_NAME")
    return "/org/freedesktop/systemd1/unit/" + "".join(chr(b) if (48 <= b <= 57 or 65 <= b <= 90 or 97 <= b <= 122) else "_%02x" % b for b in name.encode("ascii"))


def job_id(path: str) -> int:
    match = re.fullmatch(r"/org/freedesktop/systemd1/job/([1-9][0-9]*)", _text(path))
    if not match or int(match[1]) > 0xffffffff:
        raise TransportError("JOB_ID_PATH")
    return int(match[1])


@dataclass(frozen=True)
class SubscribeRequest:
    pass


@dataclass(frozen=True)
class StartRequest:
    name: str
    argv: tuple[str, ...]
    uid: int
    gid: int
    groups: tuple[int, ...]
    runtime_max_us: int


@dataclass(frozen=True)
class StopRequest:
    name: str


@dataclass(frozen=True)
class SnapshotRequest:
    name: str


@dataclass(frozen=True)
class ManagerPolicyRequest:
    pass


@dataclass(frozen=True)
class TypedReply:
    value: Any


@dataclass(frozen=True)
class ObserverReady:
    manager_binding_ref: str
    jobs_listener_ready: bool


@dataclass(frozen=True)
class JobEvent:
    boot_id: str
    bus_guid: str
    owner_unique_name: str
    job_id: int
    job_path: str
    unit_name: str
    result: str
    observed_us: int

    def to_mapping(self) -> dict[str, Any]:
        return dict(self.__dict__)


def start_properties(request: StartRequest) -> tuple[tuple[str, str, Any], ...]:
    unit_path(request.name)
    if type(request.uid) is not int or not 0 < request.uid <= 0xffffffff or type(request.gid) is not int or not 0 <= request.gid <= 0xffffffff:
        raise TransportError("LOAD_IDENTITY")
    if not isinstance(request.groups, tuple) or not request.groups or len(request.groups) > 32 or tuple(sorted(set(request.groups))) != request.groups or any(type(x) is not int or not 0 <= x <= 0xffffffff for x in request.groups):
        raise TransportError("LOAD_GROUPS")
    if type(request.runtime_max_us) is not int or not 0 < request.runtime_max_us <= 40_000_000:
        raise TransportError("RUNTIME_TIMER")
    if not isinstance(request.argv, tuple) or len(request.argv) != 17:
        raise TransportError("KEEPER_ARGV")
    argv = tuple(_text(x) for x in request.argv)
    if tuple(argv[i] for i in range(1, 17, 2)) != ("--run", "--slot", "--ipc", "--t0-us", "--work-deadline-us", "--cleanup-deadline-us", "--watchdog-pid", "--watchdog-start-ticks"):
        raise TransportError("KEEPER_ARGV")
    if not re.fullmatch(r"[0-9a-f]{32}", argv[2]) or argv[4] not in ("0", "1", "2"):
        raise TransportError("KEEPER_ARGV")
    prefix = "/run/elogistix-memory-" + argv[2] + "/"
    for path in (argv[0], argv[6]):
        if not path.startswith(prefix) or any(p in (".", "..", "") for p in path[len(prefix):].split("/")) or any(c in path for c in "$%\n\r"):
            raise TransportError("KEEPER_PATH")
    for value in (argv[8], argv[10], argv[12], argv[14], argv[16]):
        if not re.fullmatch(r"0|[1-9][0-9]*", value) or int(value) > 0xffffffffffffffff:
            raise TransportError("KEEPER_ARGV")
    if not 0 < int(argv[14]) <= 0xffffffff or not int(argv[16]):
        raise TransportError("KEEPER_ARGV")
    if int(argv[10]) != int(argv[8]) + 50_000_000 or int(argv[12]) != int(argv[8]) + 60_000_000:
        raise TransportError("ORIGINAL_DEADLINES")
    return (
        ("DefaultDependencies", "b", False),
        ("Type", "s", "exec"), ("Restart", "s", "no"), ("RemainAfterExit", "b", False),
        ("NotifyAccess", "s", "none"), ("MemoryAccounting", "b", True),
        ("MemoryMax", "t", 33_554_432), ("TasksMax", "t", 8),
        ("RuntimeMaxUSec", "t", request.runtime_max_us), ("RuntimeRandomizedExtraUSec", "t", 0),
        ("TimeoutStartUSec", "t", 2_000_000), ("TimeoutStopUSec", "t", 2_000_000),
        ("TimeoutStartFailureMode", "s", "kill"), ("TimeoutStopFailureMode", "s", "kill"),
        ("KillMode", "s", "control-group"), ("SendSIGKILL", "b", True), ("FinalKillSignal", "i", 9),
        ("User", "s", str(request.uid)), ("Group", "s", str(request.gid)),
        ("SupplementaryGroups", "as", tuple(str(x) for x in request.groups)),
        ("NoNewPrivileges", "b", True), ("AmbientCapabilities", "t", 0),
        ("Environment", "as", SERVICE_ENVIRONMENT), ("PassEnvironment", "as", ()),
        ("EnvironmentFiles", "a(sb)", ()), ("PAMName", "s", ""),
        ("UnsetEnvironment", "as", SERVICE_UNSET_ENVIRONMENT),
        ("ExecStart", "a(sasb)", ((argv[0], argv, False),)),
    )


class ProcessPin:
    """Private original pidfd; never serialized as a supplied FD or reference."""
    def __init__(self, generation: dict[str, Any], fd: int, proc_identity: tuple[int, int], ns: tuple[str, str]):
        self.generation, self.fd = generation, fd
        st = os.fstat(fd)
        self.fd_identity = (st.st_dev, st.st_ino)
        self.proc_identity, self.ns = proc_identity, ns
        self.closed = False

    def released(self, budget: Budget, deadline: int) -> dict[str, Any]:
        end = budget.begin(deadline)
        if self.closed or (os.fstat(self.fd).st_dev, os.fstat(self.fd).st_ino) != self.fd_identity:
            raise TransportError("PIDFD_IDENTITY")
        pst = os.stat("/proc")
        if (pst.st_dev, pst.st_ino) != self.proc_identity or _self_namespaces() != self.ns or _boot_id() != self.generation["boot_id"]:
            raise TransportError("PROCFS_IDENTITY")
        raw = bounded_read("/proc/self/fdinfo/" + str(self.fd), 4096)
        values = [x[4:].strip() for x in raw.splitlines() if x.startswith("Pid:")]
        if len(values) != 1 or not re.fullmatch(r"-1|[1-9][0-9]*", values[0]):
            raise TransportError("PIDFD_FDINFO")
        value = int(values[0])
        if value not in (-1, self.generation["pid"]):
            raise TransportError("PIDFD_IDENTITY")
        after_proc = os.stat("/proc")
        if (os.fstat(self.fd).st_dev, os.fstat(self.fd).st_ino) != self.fd_identity or (after_proc.st_dev, after_proc.st_ino) != self.proc_identity or _self_namespaces() != self.ns or _boot_id() != self.generation["boot_id"]:
            raise TransportError("PIDFD_IDENTITY")
        budget.end(end)
        return {"kind": "PIDFD_TASK_RELEASED", "generation_ref": record_ref(self.generation), "pid": value,
                "released": value == -1, "observed_us": str(budget.now()), "procfs_identity": list(self.proc_identity)}

    def close(self) -> None:
        if not self.closed:
            os.close(self.fd)
            self.closed = True


def bounded_read(path: str, maximum: int) -> str:
    fd = os.open(path, os.O_RDONLY | os.O_CLOEXEC | os.O_NOFOLLOW)
    try:
        data = os.read(fd, maximum + 1)
        if len(data) > maximum:
            raise TransportError("READ_BOUND")
        return data.decode("ascii", "strict")
    finally:
        os.close(fd)


def _boot_id() -> str:
    value = bounded_read("/proc/sys/kernel/random/boot_id", 64).strip()
    if not re.fullmatch(r"[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}", value):
        raise TransportError("BOOT_ID")
    return value


def _self_namespaces() -> tuple[str, str]:
    return os.readlink("/proc/self/ns/pid"), os.readlink("/proc/self/ns/mnt")


def _system_bus_path_identity() -> tuple[int, int, int]:
    for path in ("/", "/run", "/run/dbus"):
        st = os.lstat(path)
        if not stat.S_ISDIR(st.st_mode) or st.st_uid != 0 or st.st_mode & 0o022:
            raise TransportError("BUS_SOCKET_AUTHORITY")
    st = os.lstat("/run/dbus/system_bus_socket")
    if not stat.S_ISSOCK(st.st_mode):
        raise TransportError("BUS_SOCKET_AUTHORITY")
    return st.st_dev, st.st_ino, st.st_uid


def _broker_peer_allowed(peer: tuple[int, int, int], broker_pid: int, broker_uid: int, socket_uid: int) -> bool:
    pid, uid, gid = peer
    # Root-owned/activated listen sockets can retain the original root credentials.
    # Otherwise require the actual broker PID/UID reported on this same fixed bus.
    return pid > 0 and gid >= 0 and socket_uid in (0, broker_uid) and (uid == 0 or (pid == broker_pid and uid == broker_uid))


def process_generation(pid: int) -> dict[str, Any]:
    if type(pid) is not int or not 0 < pid <= 0xffffffff:
        raise TransportError("PROCESS_ID")
    raw = bounded_read("/proc/%d/stat" % pid, 4096)
    close = raw.rfind(")")
    fields = raw[close + 2:].split()
    if close < 0 or raw.split(" ", 1)[0] != str(pid) or len(fields) < 20 or fields[0] in ("Z", "X", "x") or not fields[19].isdigit():
        raise TransportError("PROCESS_GENERATION")
    return {"pid": pid, "start_ticks": str(int(fields[19])), "boot_id": _boot_id(),
            "pid_namespace_ref": os.readlink("/proc/%d/ns/pid" % pid),
            "mount_namespace_ref": os.readlink("/proc/%d/ns/mnt" % pid)}


def pin_process(generation: dict[str, Any], budget: Budget, deadline: int) -> ProcessPin:
    end = budget.begin(deadline)
    before = process_generation(generation["pid"])
    if before != generation:
        raise TransportError("PROCESS_GENERATION")
    fd = os.pidfd_open(generation["pid"], 0)
    try:
        if process_generation(generation["pid"]) != before:
            raise TransportError("PROCESS_GENERATION")
        pst = os.stat("/proc")
        pin = ProcessPin(before, fd, (pst.st_dev, pst.st_ino), _self_namespaces())
        budget.end(end)
        return pin
    except BaseException:
        os.close(fd)
        raise


class _Error(C.Structure):
    _fields_ = [("name", C.c_char_p), ("message", C.c_char_p), ("need_free", C.c_int)]


class _Id128(C.Structure):
    _fields_ = [("bytes", C.c_ubyte * 16)]


_HANDLER = C.CFUNCTYPE(C.c_int, C.c_void_p, C.c_void_p, C.POINTER(_Error))


class _NativeBus:
    """Private ABI; all routing strings originate in the closed methods below."""
    UNIT_FIELDS = {"Id": "s", "InvocationID": "ay", "ActiveState": "s", "SubState": "s", "Job": "(uo)", "Transient": "b", "DefaultDependencies": "b"}
    SERVICE_FIELDS = {"MainPID": "u", "ControlPID": "u", "ControlGroup": "s", "ControlGroupId": "t",
                      "ExecMainPID": "u", "ExecMainCode": "i", "ExecMainStatus": "i",
                      "ExecMainStartTimestampMonotonic": "t", "ExecMainExitTimestampMonotonic": "t",
                      "ExecStart": "a(sasbttttuii)", "ExecStartPre": "a(sasbttttuii)", "ExecStartPost": "a(sasbttttuii)",
                      "ExecStop": "a(sasbttttuii)", "ExecStopPost": "a(sasbttttuii)",
                      "Type": "s", "Restart": "s", "RemainAfterExit": "b", "NotifyAccess": "s", "KillMode": "s",
                      "MemoryAccounting": "b", "MemoryMax": "t", "TasksMax": "t", "RuntimeMaxUSec": "t", "RuntimeRandomizedExtraUSec": "t",
                      "TimeoutStartUSec": "t", "TimeoutStopUSec": "t", "TimeoutStartFailureMode": "s", "TimeoutStopFailureMode": "s",
                      "SendSIGKILL": "b", "FinalKillSignal": "i", "User": "s", "Group": "s", "SupplementaryGroups": "as",
                      "NoNewPrivileges": "b", "AmbientCapabilities": "t",
                      "Environment": "as", "PassEnvironment": "as", "UnsetEnvironment": "as",
                      "EnvironmentFiles": "a(sb)", "PAMName": "s"}

    def __init__(self, budget: Budget):
        self.budget, self.bus, self.slots, self.handlers = budget, C.c_void_p(), [], []
        self.events: list[dict[str, Any]] = []
        self.fault: str | None = None
        self.owner: str | None = None
        self.manager_pin: ProcessPin | None = None
        self.lib = C.CDLL("libsystemd.so.0")
        ptr = C.c_void_p
        declarations = {
            "sd_bus_new": ([C.POINTER(ptr)], C.c_int), "sd_bus_set_address": ([ptr, C.c_char_p], C.c_int),
            "sd_bus_set_bus_client": ([ptr, C.c_int], C.c_int), "sd_bus_set_allow_interactive_authorization": ([ptr, C.c_int], C.c_int),
            "sd_bus_set_method_call_timeout": ([ptr, C.c_uint64], C.c_int), "sd_bus_start": ([ptr], C.c_int),
            "sd_bus_is_ready": ([ptr], C.c_int), "sd_bus_get_bus_id": ([ptr, C.POINTER(_Id128)], C.c_int),
            "sd_bus_get_fd": ([ptr], C.c_int), "sd_bus_call": ([ptr, ptr, C.c_uint64, C.POINTER(_Error), C.POINTER(ptr)], C.c_int),
            "sd_bus_process": ([ptr, C.POINTER(ptr)], C.c_int), "sd_bus_wait": ([ptr, C.c_uint64], C.c_int),
            "sd_bus_add_match": ([ptr, C.POINTER(ptr), C.c_char_p, _HANDLER, ptr], C.c_int),
            "sd_bus_slot_unref": ([ptr], ptr), "sd_bus_message_unref": ([ptr], ptr), "sd_bus_close_unref": ([ptr], ptr),
            "sd_bus_error_free": ([C.POINTER(_Error)], None),
            "sd_bus_message_new_method_call": ([ptr, C.POINTER(ptr), C.c_char_p, C.c_char_p, C.c_char_p, C.c_char_p], C.c_int),
            "sd_bus_message_set_auto_start": ([ptr, C.c_int], C.c_int),
            "sd_bus_message_set_allow_interactive_authorization": ([ptr, C.c_int], C.c_int),
            "sd_bus_message_append_basic": ([ptr, C.c_char, ptr], C.c_int),
            "sd_bus_message_open_container": ([ptr, C.c_char, C.c_char_p], C.c_int),
            "sd_bus_message_close_container": ([ptr], C.c_int),
            "sd_bus_message_read_basic": ([ptr, C.c_char, ptr], C.c_int),
            "sd_bus_message_enter_container": ([ptr, C.c_char, C.c_char_p], C.c_int),
            "sd_bus_message_exit_container": ([ptr], C.c_int),
            "sd_bus_message_skip": ([ptr, C.c_char_p], C.c_int), "sd_bus_message_at_end": ([ptr, C.c_int], C.c_int),
            "sd_bus_message_read_array": ([ptr, C.c_char, C.POINTER(ptr), C.POINTER(C.c_size_t)], C.c_int),
        }
        for name in ("sender", "path", "interface", "member"):
            declarations["sd_bus_message_get_" + name] = ([ptr], C.c_char_p)
        declarations["sd_bus_message_get_signature"] = ([ptr, C.c_int], C.c_char_p)
        for name, (args, ret) in declarations.items():
            fn = getattr(self.lib, name)
            fn.argtypes, fn.restype = args, ret

    @staticmethod
    def _check(result: int, *, positive: bool = False) -> int:
        if result < 0 or (positive and result == 0):
            raise TransportError("SD_BUS_%d" % abs(result), uncertain=result in (-errno.ETIMEDOUT, -errno.ECONNRESET, -errno.ENOTCONN))
        return result

    def _append(self, msg: Any, sig: str, value: Any) -> None:
        if sig in ("s", "o"):
            ptr = C.cast(C.c_char_p(_text(value).encode()), C.c_void_p)
        else:
            typ = {"u": C.c_uint32, "i": C.c_int32, "t": C.c_uint64, "b": C.c_int}[sig]
            scalar = typ(value)
            ptr = C.cast(C.byref(scalar), C.c_void_p)
        self._check(self.lib.sd_bus_message_append_basic(msg, sig.encode(), ptr))

    def _open(self, msg: Any, typ: str, contents: str) -> None:
        self._check(self.lib.sd_bus_message_open_container(msg, typ.encode(), contents.encode()))

    def _close(self, msg: Any) -> None:
        self._check(self.lib.sd_bus_message_close_container(msg))

    def _read(self, msg: Any, sig: str) -> Any:
        typ = C.c_char_p if sig in ("s", "o") else {"u": C.c_uint32, "i": C.c_int32, "t": C.c_uint64, "b": C.c_int}[sig]
        out = typ()
        self._check(self.lib.sd_bus_message_read_basic(msg, sig.encode(), C.byref(out)), positive=True)
        if sig in ("s", "o"):
            if out.value is None:
                raise TransportError("MALFORMED_REPLY")
            return _text(out.value.decode("utf-8", "strict"))
        if sig == "b":
            if out.value not in (0, 1):
                raise TransportError("MALFORMED_BOOLEAN")
            return bool(out.value)
        return out.value

    def _enter(self, msg: Any, typ: str, contents: str) -> None:
        self._check(self.lib.sd_bus_message_enter_container(msg, typ.encode(), contents.encode()), positive=True)

    def _exit(self, msg: Any) -> None:
        self._check(self.lib.sd_bus_message_exit_container(msg))

    def _end(self, msg: Any) -> bool:
        return bool(self._check(self.lib.sd_bus_message_at_end(msg, 0)))

    def _signature(self, msg: Any, expected: str) -> None:
        value = self.lib.sd_bus_message_get_signature(msg, 1)
        if value != expected.encode():
            raise TransportError("REPLY_SIGNATURE")

    def _value(self, msg: Any, signature: str) -> Any:
        if signature in ("s", "o", "u", "i", "t", "b"):
            return self._read(msg, signature)
        if signature == "ay":
            pointer, size = C.c_void_p(), C.c_size_t()
            self._check(self.lib.sd_bus_message_read_array(msg, b"y", C.byref(pointer), C.byref(size)), positive=True)
            if size.value != 16:
                raise TransportError("INVOCATION_ID")
            return C.string_at(pointer, size.value).hex()
        if signature == "as":
            self._enter(msg, "a", "s")
            values = []
            while not self._end(msg):
                if len(values) >= 32:
                    raise TransportError("ARRAY_BOUND")
                values.append(self._read(msg, "s"))
            self._exit(msg)
            return values
        if signature == "a(sb)":
            # The closed profile permits no files, including optional files.
            # Reject an entry without reading its pathname or file contents.
            self._enter(msg, "a", "(sb)")
            if not self._end(msg):
                raise TransportError("ENVIRONMENT_FILES_NOT_EMPTY")
            self._exit(msg)
            return []
        if signature == "(uo)":
            self._enter(msg, "r", "uo")
            value = (self._read(msg, "u"), self._read(msg, "o"))
            self._exit(msg)
            return value
        if signature == "a(sasbttttuii)":
            self._enter(msg, "a", "(sasbttttuii)")
            values = []
            while not self._end(msg):
                if len(values) >= 1:
                    raise TransportError("AUXILIARY_EXECUTION")
                self._enter(msg, "r", "sasbttttuii")
                path = self._read(msg, "s")
                argv = self._value(msg, "as")
                ignore = self._read(msg, "b")
                times = [self._read(msg, "t") for _ in range(4)]
                pid, code, status = self._read(msg, "u"), self._read(msg, "i"), self._read(msg, "i")
                self._exit(msg)
                values.append({"path": path, "argv": argv, "ignore_failure": ignore, "timestamps": times, "pid": pid, "code": code, "status": status})
            self._exit(msg)
            return values
        raise TransportError("UNSUPPORTED_SIGNATURE")

    def _properties(self, msg: Any, fields: dict[str, str]) -> dict[str, Any]:
        self._signature(msg, "a{sv}")
        self._enter(msg, "a", "{sv}")
        output, count = {}, 0
        while not self._end(msg):
            count += 1
            if count > 512:
                raise TransportError("PROPERTY_BOUND")
            self._enter(msg, "e", "sv")
            name = self._read(msg, "s")
            if name in fields:
                if name in output:
                    raise TransportError("DUPLICATE_PROPERTY")
                self._enter(msg, "v", fields[name])
                output[name] = self._value(msg, fields[name])
                self._exit(msg)
            else:
                self._check(self.lib.sd_bus_message_skip(msg, b"v"), positive=True)
            self._exit(msg)
        self._exit(msg)
        if not self._end(msg):
            raise TransportError("MALFORMED_REPLY")
        return output

    def _rpc(self, dest: str, path: str, interface: str, member: str, args: tuple[tuple[str, Any], ...], deadline: int, *, start: StartRequest | None = None, fields: dict[str, str] | None = None, output: str = "") -> Any:
        end = self.budget.begin(deadline)
        msg, reply, error = C.c_void_p(), C.c_void_p(), _Error()
        try:
            self._check(self.lib.sd_bus_message_new_method_call(self.bus, C.byref(msg), dest.encode(), path.encode(), interface.encode(), member.encode()))
            self._check(self.lib.sd_bus_message_set_auto_start(msg, 0))
            self._check(self.lib.sd_bus_message_set_allow_interactive_authorization(msg, 0))
            for sig, value in args:
                self._append(msg, sig, value)
            if start is not None:
                self._append_start(msg, start)
            remaining = end - self.budget.now()
            if remaining <= 0:
                raise TransportError("DEADLINE")
            result = self.lib.sd_bus_call(self.bus, msg, remaining, C.byref(error), C.byref(reply))
            self.budget.end(end)
            if result < 0:
                if error.name and error.name.decode() not in ("org.freedesktop.DBus.Error.NoReply", "org.freedesktop.DBus.Error.Disconnected", "org.freedesktop.DBus.Error.Timeout"):
                    raise BusRemoteError(_text(error.name.decode()))
                self._check(result)
            sender = self.lib.sd_bus_message_get_sender(reply)
            expected = BROKER.encode() if dest == BROKER else dest.encode()
            if sender != expected:
                raise TransportError("REPLY_SENDER", uncertain=True)
            if fields is not None:
                value = self._properties(reply, fields)
            else:
                self._signature(reply, output)
                value = self._read(reply, output) if output else None
                if not self._end(reply):
                    raise TransportError("MALFORMED_REPLY")
            self.budget.end(end)
            return value
        finally:
            self.lib.sd_bus_error_free(C.byref(error))
            if reply:
                self.lib.sd_bus_message_unref(reply)
            if msg:
                self.lib.sd_bus_message_unref(msg)

    def _append_start(self, msg: Any, request: StartRequest) -> None:
        self._open(msg, "a", "(sv)")
        for name, sig, value in start_properties(request):
            self._open(msg, "r", "sv")
            self._append(msg, "s", name)
            self._open(msg, "v", sig)
            if sig == "as":
                self._open(msg, "a", "s")
                for item in value:
                    self._append(msg, "s", item)
                self._close(msg)
            elif sig == "a(sb)":
                if type(value) not in (tuple, list) or len(value) != 0:
                    raise TransportError("ENVIRONMENT_FILES_NOT_EMPTY")
                self._open(msg, "a", "(sb)")
                self._close(msg)
            elif sig == "a(sasb)":
                self._open(msg, "a", "(sasb)")
                for path, argv, ignore in value:
                    self._open(msg, "r", "sasb")
                    self._append(msg, "s", path)
                    self._open(msg, "a", "s")
                    for arg in argv:
                        self._append(msg, "s", arg)
                    self._close(msg)
                    self._append(msg, "b", ignore)
                    self._close(msg)
                self._close(msg)
            else:
                self._append(msg, sig, value)
            self._close(msg)
            self._close(msg)
        self._close(msg)
        self._open(msg, "a", "(sa(sv))")  # Empty auxiliary-unit list.
        self._close(msg)

    def _guid(self) -> str:
        out = _Id128()
        self._check(self.lib.sd_bus_get_bus_id(self.bus, C.byref(out)))
        return bytes(out.bytes).hex()

    def open(self, deadline: int) -> dict[str, Any]:
        end = self.budget.begin(deadline)
        socket_identity = _system_bus_path_identity()
        self._check(self.lib.sd_bus_new(C.byref(self.bus)))
        self._check(self.lib.sd_bus_set_address(self.bus, b"unix:path=/run/dbus/system_bus_socket"))
        self._check(self.lib.sd_bus_set_bus_client(self.bus, 1))
        self._check(self.lib.sd_bus_set_allow_interactive_authorization(self.bus, 0))
        self._check(self.lib.sd_bus_set_method_call_timeout(self.bus, RPC_MAX_US))
        self._check(self.lib.sd_bus_start(self.bus))
        while self._check(self.lib.sd_bus_is_ready(self.bus)) == 0:
            self.budget.end(end)
            processed = self._check(self.lib.sd_bus_process(self.bus, None))
            if not processed:
                self._check(self.lib.sd_bus_wait(self.bus, max(1, end - self.budget.now())))
        busfd = self._check(self.lib.sd_bus_get_fd(self.bus))
        with socket.socket(fileno=os.dup(busfd)) as peer:
            peer_credentials = struct.unpack("3i", peer.getsockopt(socket.SOL_SOCKET, socket.SO_PEERCRED, 12))
        self.budget.end(end)
        broker_pid = self._rpc(BROKER, BROKER_PATH, BROKER_INTERFACE, "GetConnectionUnixProcessID", (("s", BROKER),), deadline, output="u")
        broker_uid = self._rpc(BROKER, BROKER_PATH, BROKER_INTERFACE, "GetConnectionUnixUser", (("s", BROKER),), deadline, output="u")
        end = self.budget.begin(deadline)
        if _system_bus_path_identity() != socket_identity or not _broker_peer_allowed(peer_credentials, broker_pid, broker_uid, socket_identity[2]):
            raise TransportError("BUS_PEER_AUTHORITY")
        self.budget.end(end)
        owner = self._rpc(BROKER, BROKER_PATH, BROKER_INTERFACE, "GetNameOwner", (("s", DESTINATION),), deadline, output="s")
        if not re.fullmatch(r":[0-9]+\.[0-9]+", owner):
            raise TransportError("MANAGER_OWNER")
        manager_pid = self._rpc(BROKER, BROKER_PATH, BROKER_INTERFACE, "GetConnectionUnixProcessID", (("s", owner),), deadline, output="u")
        if manager_pid != 1 or os.geteuid() != 0:
            raise TransportError("MANAGER_AUTHORITY")
        end = self.budget.begin(deadline)
        status = bounded_read("/proc/1/status", 16384)
        uidlines = [x.split()[1:] for x in status.splitlines() if x.startswith("Uid:")]
        if uidlines != [["0", "0", "0", "0"]]:
            raise TransportError("MANAGER_AUTHORITY")
        generation = process_generation(manager_pid)
        self.budget.end(end)
        self.manager_pin = pin_process(generation, self.budget, deadline)
        self.owner = owner
        return {"boot_id": generation["boot_id"], "bus_guid": self._guid(), "owner_unique_name": owner,
                "manager_pid_generation": generation, "authority_lease_until_us": str(self.budget.lease)}

    def epoch(self, deadline: int) -> dict[str, Any]:
        if self.fault:
            raise TransportError(self.fault)
        owner = self._rpc(BROKER, BROKER_PATH, BROKER_INTERFACE, "GetNameOwner", (("s", DESTINATION),), deadline, output="s")
        end = self.budget.begin(deadline)
        generation = process_generation(1)
        if self.manager_pin is None or self.manager_pin.released(self.budget, deadline)["released"]:
            raise TransportError("MANAGER_EXITED")
        value = {"boot_id": generation["boot_id"], "bus_guid": self._guid(), "owner_unique_name": owner,
                 "manager_pid_generation": generation, "authority_lease_until_us": str(self.budget.lease)}
        self.budget.end(end)
        if self.fault:
            raise TransportError(self.fault)
        return value

    def _match(self, expression: str, handler: Any, deadline: int) -> None:
        end = self.budget.begin(deadline)
        callback = _HANDLER(handler)
        slot = C.c_void_p()
        self.handlers.append(callback)  # Keep strong references before registration.
        self._check(self.lib.sd_bus_add_match(self.bus, C.byref(slot), expression.encode(), callback, None))
        self.slots.append(slot)
        self.budget.end(end)

    def subscribe(self, deadline: int) -> None:
        def changed(msg: Any, userdata: Any, error: Any) -> int:
            try:
                if self.lib.sd_bus_message_get_sender(msg) != BROKER.encode():
                    raise TransportError("OWNER_SIGNAL_SENDER")
                self._signature(msg, "sss")
                name, old, new = [self._read(msg, "s") for _ in range(3)]
                if name == DESTINATION and old != new:
                    self.fault = "MANAGER_OWNER_CHANGED"
            except BaseException:
                self.fault = "OWNER_SIGNAL_INVALID"
            return 0

        def removed(msg: Any, userdata: Any, error: Any) -> int:
            try:
                if self.lib.sd_bus_message_get_sender(msg) != self.owner.encode():
                    raise TransportError("JOB_SIGNAL_SENDER")
                self._signature(msg, "uoss")
                value = {"job_id": self._read(msg, "u"), "job_path": self._read(msg, "o"), "unit_name": self._read(msg, "s"), "result": self._read(msg, "s"), "owner_unique_name": self.owner, "observed_us": self.budget.now()}
                if len(self.events) >= 256:
                    raise TransportError("EVENT_QUEUE_BOUND")
                self.events.append(value)
            except BaseException:
                self.fault = "JOB_SIGNAL_INVALID"
            return 0
        self._match("type='signal',sender='org.freedesktop.DBus',path='/org/freedesktop/DBus',interface='org.freedesktop.DBus',member='NameOwnerChanged',arg0='org.freedesktop.systemd1'", changed, deadline)
        self._match("type='signal',sender='%s',path='%s',interface='%s',member='JobRemoved'" % (self.owner, MANAGER_PATH, MANAGER_INTERFACE), removed, deadline)
        self._rpc(self.owner, MANAGER_PATH, MANAGER_INTERFACE, "Subscribe", (), deadline)

    def request(self, request: Any, deadline: int) -> Any:
        if isinstance(request, StartRequest):
            return self._rpc(self.owner, MANAGER_PATH, MANAGER_INTERFACE, "StartTransientUnit", (("s", request.name), ("s", "fail")), deadline, start=request, output="o")
        if isinstance(request, StopRequest):
            return self._rpc(self.owner, MANAGER_PATH, MANAGER_INTERFACE, "StopUnit", (("s", request.name), ("s", "fail")), deadline, output="o")
        if isinstance(request, ManagerPolicyRequest):
            return self._rpc(self.owner, MANAGER_PATH, "org.freedesktop.DBus.Properties", "GetAll", (("s", MANAGER_INTERFACE),), deadline, fields={"UnitPath": "as", "Environment": "as"})
        if isinstance(request, SnapshotRequest):
            path = self._rpc(self.owner, MANAGER_PATH, MANAGER_INTERFACE, "GetUnit", (("s", request.name),), deadline, output="o")
            if path != unit_path(request.name):
                raise TransportError("UNIT_OBJECT_PATH")
            unit = self._rpc(self.owner, path, "org.freedesktop.DBus.Properties", "GetAll", (("s", "org.freedesktop.systemd1.Unit"),), deadline, fields=self.UNIT_FIELDS)
            service = self._rpc(self.owner, path, "org.freedesktop.DBus.Properties", "GetAll", (("s", "org.freedesktop.systemd1.Service"),), deadline, fields=self.SERVICE_FIELDS)
            after = self._rpc(self.owner, path, "org.freedesktop.DBus.Properties", "GetAll", (("s", "org.freedesktop.systemd1.Unit"),), deadline, fields=self.UNIT_FIELDS)
            if any(unit.get(key) != after.get(key) for key in ("Id", "InvocationID", "Transient")):
                raise TransportError("UNIT_IDENTITY_CHANGED")
            if unit != after:
                raise TransportError("UNIT_OBSERVATION_CHANGED")
            return {"object_path": path, "unit": unit, "service": service}
        raise TransportError("CLOSED_REQUEST")

    def poll(self, deadline: int) -> list[dict[str, Any]]:
        end = self.budget.begin(deadline)
        for _ in range(32):
            self.budget.end(end)
            if self._check(self.lib.sd_bus_process(self.bus, None)) == 0:
                break
        self.budget.end(end)
        if self.fault:
            raise TransportError(self.fault)
        events, self.events = self.events, []
        return events

    def close(self) -> None:
        for slot in self.slots:
            self.lib.sd_bus_slot_unref(slot)
        self.slots.clear()
        if self.bus:
            self.lib.sd_bus_close_unref(self.bus)
            self.bus = C.c_void_p()
        self.handlers.clear()
        if self.manager_pin:
            self.manager_pin.close()


class SdBusTransport:
    def __init__(self, *, authority_lease_until_us: int, clock_us: Any = monotonic_us):
        if sys.platform != "linux":
            raise TransportError("PLATFORM_LINUX")
        self._initialize(_NativeBus(Budget(clock_us, authority_lease_until_us)), clock_us, authority_lease_until_us, False)

    def _initialize(self, driver: Any, clock: Any, lease: int, test_boundary: bool) -> None:
        self.driver, self.budget = driver, Budget(clock, lease)
        self.test_boundary = test_boundary
        self.binding: dict[str, Any] | None = None
        self.units: tuple[str, ...] = ()
        self.subscribed = False
        self.invalid: str | None = None
        self.closed = False

    @classmethod
    def for_test_boundary(cls, driver: Any, *, authority_lease_until_us: int, clock_us: Any) -> "SdBusTransport":
        result = cls.__new__(cls)
        result._initialize(driver, clock_us, authority_lease_until_us, True)
        return result

    def authorize_units(self, names: tuple[str, ...]) -> None:
        if self.units or len(names) != 3 or len(set(names)) != 3:
            raise TransportError("UNIT_RESERVATIONS")
        for name in names:
            unit_path(name)
        self.units = tuple(names)

    def _valid(self) -> None:
        if self.invalid or self.closed:
            raise TransportError(self.invalid or "TRANSPORT_CLOSED")

    def open(self, deadline_us: int) -> dict[str, Any]:
        self._valid()
        if self.binding is not None:
            raise TransportError("CONNECTION_ALREADY_OPEN")
        end = self.budget.begin(deadline_us)
        value = self.driver.open(deadline_us)
        self.budget.end(end)
        if set(value) != {"boot_id", "bus_guid", "owner_unique_name", "manager_pid_generation", "authority_lease_until_us"} or value["authority_lease_until_us"] != str(self.budget.lease):
            raise TransportError("MANAGER_BINDING")
        if not re.fullmatch(r"[0-9a-f]{32}", value["bus_guid"]) or not re.fullmatch(r":[0-9]+\.[0-9]+", value["owner_unique_name"]) or value["manager_pid_generation"].get("pid") != 1:
            raise TransportError("MANAGER_BINDING")
        self.binding = dict(value)
        self._epoch(deadline_us)
        return dict(value)

    def _epoch(self, deadline: int) -> None:
        self._valid()
        if self.binding is None:
            raise TransportError("CONNECTION_NOT_OPEN")
        end = self.budget.begin(deadline)
        try:
            value = self.driver.epoch(deadline)
        except TransportError as exc:
            if exc.code in {"MANAGER_OWNER_CHANGED", "OWNER_SIGNAL_INVALID", "JOB_SIGNAL_INVALID", "MANAGER_EXITED", "PROCFS_IDENTITY", "PIDFD_IDENTITY", "PROCESS_GENERATION", "REPLY_SENDER"}:
                self.invalid = exc.code
            raise
        self.budget.end(end)
        if value != self.binding:
            self.invalid = "MANAGER_IDENTITY_CHANGED"
            raise TransportError(self.invalid)

    def subscribe(self, deadline_us: int) -> ObserverReady:
        self._epoch(deadline_us)
        if self.subscribed:
            raise TransportError("ALREADY_SUBSCRIBED")
        end = self.budget.begin(deadline_us)
        self.driver.subscribe(deadline_us)
        self.budget.end(end)
        self._epoch(deadline_us)
        self.subscribed = True
        return ObserverReady(record_ref(self.binding), True)

    def verify_identity(self, deadline_us: int) -> dict[str, Any]:
        """Read-only original manager epoch proof, also usable before Subscribe."""
        self._epoch(deadline_us)
        return dict(self.binding)

    def call_closed(self, request: Any, deadline_us: int) -> TypedReply:
        if type(request) not in (StartRequest, StopRequest, SnapshotRequest, ManagerPolicyRequest):
            raise TransportError("CLOSED_REQUEST")
        if isinstance(request, (StartRequest, StopRequest, SnapshotRequest)) and request.name not in self.units:
            raise TransportError("UNRESERVED_UNIT")
        if isinstance(request, (StartRequest, StopRequest)) and not self.subscribed:
            raise TransportError("OBSERVER_NOT_READY")
        if isinstance(request, StartRequest):
            start_properties(request)
        self._epoch(deadline_us)
        end = self.budget.begin(deadline_us)
        try:
            value = self.driver.request(request, deadline_us)
        except TransportError as exc:
            if exc.code in {"REPLY_SENDER", "UNIT_IDENTITY_CHANGED"}:
                self.invalid = exc.code
            raise
        self.budget.end(end)
        self._epoch(deadline_us)
        if isinstance(request, (StartRequest, StopRequest)):
            job_id(value)
        return TypedReply(value)

    def poll_events(self, deadline_us: int) -> list[JobEvent]:
        self._epoch(deadline_us)
        end = self.budget.begin(deadline_us)
        raw = self.driver.poll(deadline_us)
        self.budget.end(end)
        self._epoch(deadline_us)
        output = []
        for event in raw:
            if event.get("owner_unique_name") != self.binding["owner_unique_name"] or type(event.get("job_id")) is not int or job_id(event.get("job_path")) != event.get("job_id") or event.get("result") not in RESULTS:
                self.invalid = "JOB_SIGNAL_INVALID"
                raise TransportError(self.invalid)
            # System-wide observer may see other units; only reserved names matter.
            if event.get("unit_name") not in self.units:
                continue
            observed = event.get("observed_us")
            if type(observed) is not int or observed < 0 or observed >= min(deadline_us, self.budget.lease):
                raise TransportError("EVENT_DEADLINE")
            output.append(JobEvent(self.binding["boot_id"], self.binding["bus_guid"], self.binding["owner_unique_name"], event["job_id"], event["job_path"], event["unit_name"], event["result"], observed))
        return output

    def close(self) -> None:
        if not self.closed:
            self.driver.close()
            self.closed = True
