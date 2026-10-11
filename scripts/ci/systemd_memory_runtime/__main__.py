"""Closed CLI and Linux bootstrap. Imports never run probes or create services.

The external keeper/distribution and physical reader are separate proposals.
Their concrete adapter factories must be installed in this package before run;
missing adapters are a reported dependency failure, never a mocked runtime.
"""
from __future__ import annotations

import argparse
import hashlib
import importlib
import json
import os
import select
import signal
import socket
import stat
import struct
import sys
import time
from typing import Any

from . import contracts as C
from .coordinator import Coordinator, PrivateSocketChannel, _ForkCustody
from .preflight import preflight

STORE_LIMIT = 524288


class _NativeCgroupPerimeter:
    """Read-only local perimeter under the explicitly trusted pilot scope.

    Permissions/credentials exclude the unprivileged load as a cgroup mutator.
    PID1/control and absence of outside administrative mutators (including
    ownership, ACL or delegation rights) are operator assumptions, not a global
    kernel guarantee. No FD crosses this API.
    """
    SCOPE = "Sentinel_5d6cf0688f788191ad0503a9a351e1a7"
    MEMBERSHIP = ("cgroup.procs", "cgroup.threads")

    def __init__(self, spec, backend, physical_module):
        # Composition only: no filesystem, procfs, D-Bus or process probe here.
        if spec.scope_ref != self.SCOPE:
            raise ValueError("Explicit operator pilot scope required")
        self.spec, self.backend, self.physical = spec, backend, physical_module
        self.fs = physical_module.LinuxFilesystem()
        self.clock = time.monotonic_ns
        self._captures = {}
        self._capture_attempts, self._capture_slots = {}, set()

    def _check(self, deadline_ns, *, work=False):
        if (sys.platform != "linux" or type(deadline_ns) is not int
                or not 0 < deadline_ns <= C.U64_MAX * 1000):
            raise ValueError("Native absolute deadline required")
        limit = self.spec.work_deadline_us if work else self.spec.cleanup_deadline_us
        end = min(deadline_ns // 1000, limit, self.backend.budget.lease)
        if self.clock() >= end * 1000:
            raise TimeoutError("Native perimeter deadline exceeded")
        self.backend._check(end, work=work)
        return end

    @staticmethod
    def _parts(path):
        if (type(path) is not str or not path.startswith("/") or path == "/"
                or len(path.encode("utf-8", "strict")) > 4096
                or any(ord(ch) < 32 or 127 <= ord(ch) <= 159 or ch in "\\\u2028\u2029" for ch in path)):
            raise ValueError("Canonical non-root cgroup path required")
        parts = tuple(path[1:].split("/"))
        if len(parts) > 64 or any(p in ("", ".", "..") for p in parts):
            raise ValueError("Cgroup path component budget exceeded")
        return parts

    @staticmethod
    def _data(value):
        from dataclasses import asdict
        return json.loads(json.dumps(asdict(value), sort_keys=True, allow_nan=False))

    @staticmethod
    def _copy(value):
        return json.loads(json.dumps(value, sort_keys=True, allow_nan=False))

    @staticmethod
    def _digest(value):
        import hashlib
        raw = json.dumps(value, ensure_ascii=False, sort_keys=True,
                         separators=(",", ":"), allow_nan=False).encode("utf-8")
        return hashlib.sha256(raw).hexdigest()

    def _context(self, deadline_ns):
        self._check(deadline_ns)
        value = self.fs.context(131072, deadline_ns)
        mounts = [m for m in value.mounts if m.mount_point == "/sys/fs/cgroup"]
        generation = self.backend.watchdog_generation
        if (len(mounts) != 1 or mounts[0].root != "/"
                or value.boot_id != generation["boot_id"]
                or "mnt:[%d]" % value.namespace_inode != generation["mount_namespace_ref"]):
            raise ValueError("Original cgroup mount context required")
        self._check(deadline_ns)
        return value, mounts[0]

    def _acl(self, fd, deadline_ns):
        import errno
        self._check(deadline_ns)
        try:
            raw = os.getxattr(fd, "system.posix_acl_access")
        except OSError as error:
            if error.errno == errno.ENODATA:
                result = {"status": "ABSENT", "errno": error.errno}
            elif error.errno in (errno.EOPNOTSUPP, errno.ENOTSUP):
                result = {"status": "NOT_SUPPORTED", "errno": error.errno}
            else:
                raise
        else:
            if type(raw) is not bytes or raw:
                raise ValueError("Unparsed POSIX ACL is not an exclusion proof")
            result = {"status": "EMPTY", "errno": None}
        self._check(deadline_ns)
        return result

    def _metadata(self, fd, deadline_ns, *, directory, node=None):
        import re
        self._check(deadline_ns)
        before = os.fstat(fd)
        expected_type = stat.S_ISDIR if directory else stat.S_ISREG
        if not expected_type(before.st_mode):
            raise ValueError("Original directory/regular membership file required")
        if directory:
            node = self.fs.identity(fd, deadline_ns) if node is None else node
            if (before.st_dev, before.st_ino) != (node.device, node.inode):
                raise ValueError("Directory metadata identity changed")
            mount_id = node.mount_id
        else:
            raw = self.fs._proc_read("/proc/thread-self/fdinfo/%d" % fd, 8192, deadline_ns)
            values = re.findall(rb"^mnt_id:\s*([0-9]+)$", raw, re.MULTILINE)
            if len(values) != 1 or int(values[0]) <= 0:
                raise ValueError("Membership descriptor mount identity unavailable")
            mount_id = int(values[0])
        acl = self._acl(fd, deadline_ns)
        mode = stat.S_IMODE(before.st_mode)
        if before.st_uid == self.spec.load_uid:
            raise ValueError("Load owner can change cgroup permissions or ACL")
        groups = {self.spec.load_gid, *self.spec.load_groups}
        shift = 6 if before.st_uid == self.spec.load_uid else 3 if before.st_gid in groups else 0
        if (mode >> shift) & 2:
            raise ValueError("Load can mutate cgroup directory or membership")
        after = os.fstat(fd)
        if ((before.st_dev, before.st_ino, before.st_uid, before.st_gid, before.st_mode)
                != (after.st_dev, after.st_ino, after.st_uid, after.st_gid, after.st_mode)):
            raise ValueError("Cgroup permissions changed during observation")
        self._check(deadline_ns)
        return {"dev": str(before.st_dev), "inode": str(before.st_ino),
                "mount_id": str(mount_id), "uid": before.st_uid, "gid": before.st_gid,
                "mode": mode, "acl": acl}

    def _group(self, fd, path, root, deadline_ns):
        self._check(deadline_ns)
        node = self.fs.identity(fd, deadline_ns)
        if (node.filesystem_magic != self.physical.CGROUP2_SUPER_MAGIC or node.nlink <= 0
                or node.device != root.device or node.mount_id != root.mount_id):
            raise ValueError("Original cgroup directory identity required")
        directory = self._metadata(fd, deadline_ns, directory=True, node=node)
        files = {}
        for name in self.MEMBERSHIP:
            self._check(deadline_ns)
            item = os.open(name, os.O_RDONLY | os.O_CLOEXEC | os.O_NOFOLLOW | os.O_NONBLOCK,
                           dir_fd=fd)
            try:
                metadata = self._metadata(item, deadline_ns, directory=False)
                if (metadata["dev"] != str(root.device)
                        or metadata["mount_id"] != str(root.mount_id)):
                    raise ValueError("Membership file crossed original cgroup mount")
                files[name] = metadata
            finally:
                os.close(item)
        return {"path": path, "node": self._data(node), "metadata": directory,
                "membership": files}

    @staticmethod
    def _same_group(first, second):
        return (first["path"] == second["path"] and first["metadata"] == second["metadata"]
                and first["membership"] == second["membership"]
                and all(first["node"][k] == second["node"][k]
                        for k in ("device", "inode", "mount_id", "filesystem_magic")))

    def _named_after(self, parts, groups, absent, deadline_ns):
        """Reopen each original name; these handles never replace retained FDs."""
        import errno
        expected = {group["path"]: group["node"] for group in groups}
        records, fd = [], self.fs.open_root(deadline_ns)
        try:
            for name in ("sys", "fs", "cgroup"):
                next_fd = self.fs.open_dir_at(fd, name, deadline_ns)
                previous, fd = fd, next_fd
                self.fs.close(previous)
            current = "/"
            for index in range(len(parts) + 1):
                self._check(deadline_ns)
                started = self.clock()
                if index:
                    current = "/" + "/".join(parts[:index])
                    try:
                        next_fd = self.fs.open_dir_at(fd, parts[index - 1], deadline_ns)
                    except OSError as error:
                        if absent and index == len(parts) and error.errno == errno.ENOENT:
                            records.append({"path": current, "node": None, "errno": error.errno,
                                            "started_ns": started, "finished_ns": self.clock()})
                            break
                        raise
                    previous, fd = fd, next_fd
                    self.fs.close(previous)
                    if absent and index == len(parts):
                        raise ValueError("Leaf name reappeared within perimeter bracket")
                node = self.fs.identity(fd, deadline_ns)
                value = expected[current]
                if (node.nlink <= 0 or node.key() != tuple(value[k] for k in
                        ("device", "inode", "mount_id", "filesystem_magic"))):
                    raise ValueError("Original cgroup ancestry name changed")
                self._check(deadline_ns)
                records.append({"path": current, "node": self._data(node), "errno": None,
                                "started_ns": started, "finished_ns": self.clock()})
            return records
        finally:
            self.fs.close(fd)

    def _walk(self, path, context, mount, deadline_ns, *, allow_absent=False):
        import errno
        parts = self._parts(path)
        fd = self.fs.open_root(deadline_ns)
        handles, groups, number = [], [], None
        bracket = {"started_ns": self.clock(), "observed_groups": {}, "before": [], "after": []}
        def observed(handle, current, root, stage):
            started = self.clock()
            group = self._group(handle, current, root, deadline_ns)
            reference = self._digest(group)
            bracket["observed_groups"].setdefault(reference, group)
            bracket[stage].append({"group_ref": reference, "started_ns": started,
                                   "finished_ns": self.clock()})
            return group
        try:
            for name in ("sys", "fs", "cgroup"):
                next_fd = self.fs.open_dir_at(fd, name, deadline_ns)
                previous, fd = fd, next_fd
                self.fs.close(previous)
            # Pin every cgroup component until both permission observations end.
            handles.append(fd)
            root = self.fs.identity(fd, deadline_ns)
            if (root.filesystem_magic != self.physical.CGROUP2_SUPER_MAGIC
                    or root.mount_id != mount.mount_id or root.nlink <= 0):
                raise ValueError("Named cgroup root does not match mount context")
            groups.append(observed(fd, "/", root, "before"))
            current = ""
            for index, name in enumerate(parts):
                self._check(deadline_ns)
                lookup_started = self.clock()
                try:
                    next_fd = self.fs.open_dir_at(fd, name, deadline_ns)
                except OSError as error:
                    if allow_absent and index == len(parts) - 1 and error.errno == errno.ENOENT:
                        number = error.errno
                        bracket["leaf_lookup"] = {"started_ns": lookup_started, "finished_ns": self.clock(),
                                                   "status": "ABSENT", "errno": number}
                        break
                    raise
                fd = next_fd
                handles.append(fd)
                current += "/" + name
                if index == len(parts) - 1:
                    bracket["leaf_lookup"] = {"started_ns": lookup_started, "finished_ns": self.clock(),
                                               "status": "PRESENT", "errno": None}
                groups.append(observed(fd, current, root, "before"))
            bracket["named_after"] = self._named_after(parts, groups, number is not None, deadline_ns)
            after = []
            for handle, group in zip(handles, groups):
                actual = observed(handle, group["path"], root, "after")
                if not self._same_group(group, actual):
                    raise ValueError("Cgroup permissions or identity changed within perimeter bracket")
                after.append(actual)
            self._check(deadline_ns)
            bracket["finished_ns"] = self.clock()
            return root, after if number is not None else after[:-1], None if number is not None else after[-1], number, bracket
        finally:
            close_error = None
            for handle in reversed(handles or [fd]):
                try:
                    self.fs.close(handle)
                except Exception as error:
                    close_error = close_error or error
            if close_error is not None:
                raise close_error

    def _state(self, unit):
        from .sd_bus_transport import ProcessPin
        value = dict(C.validate_unit_binding(unit))
        state = self.backend._slot(value["slot"])
        if (state.binding != value or state.generation is None or type(state.pin) is not ProcessPin
                or state.pin.closed or state.pin.generation != state.generation
                or value["keeper_generation_ref"] != C.digest_record(state.generation)):
            raise ValueError("Original native bound keeper required")
        return value, state

    def _snapshot(self, unit, deadline_ns):
        end = self._check(deadline_ns, work=True)
        snapshot = self.backend._snapshot(unit["slot"], end)
        self.backend._original(unit["slot"], snapshot, end)
        service, actual = snapshot["service"], snapshot["unit"]
        expected = {"User": str(self.spec.load_uid), "Group": str(self.spec.load_gid),
                    "NoNewPrivileges": True, "AmbientCapabilities": 0,
                    "Restart": "no", "KillMode": "control-group"}
        if (snapshot["object_path"] != unit["object_path"] or actual["Id"] != unit["name"]
                or actual["InvocationID"] != unit["invocation_id"]
                or service["MainPID"] != self.backend._slot(unit["slot"]).generation["pid"]
                or service["ControlGroup"] != unit["control_group"]
                or str(service["ControlGroupId"]) != unit["control_group_id"]
                or any(key not in service or type(service[key]) is not type(value)
                       or service[key] != value for key, value in expected.items())
                or service.get("SupplementaryGroups") != [str(g) for g in self.spec.load_groups]):
            raise ValueError("Fresh effective unit perimeter changed or unavailable")
        self._check(deadline_ns, work=True)
        return {**expected, "SupplementaryGroups": list(service["SupplementaryGroups"])}

    def _keeper(self, unit, state, deadline_ns):
        from .sd_bus_transport import process_generation
        from .watchdog import _credentials
        end = self._check(deadline_ns, work=True)
        started = self.clock()
        generation = C.validate_process_generation(state.generation)
        first = state.pin.released(self.backend.budget, end)
        if first["released"] or first["pid"] != generation["pid"] or process_generation(generation["pid"]) != generation:
            raise ValueError("Original live keeper generation required at capture")
        self.backend.identity.verify_workload(generation, self.backend.payload, unit["control_group"], end)
        credentials = _credentials(generation["pid"])
        if (credentials["uids"] != (self.spec.load_uid,) * 4
                or credentials["gids"] != (self.spec.load_gid,) * 4
                or credentials["groups"] != tuple(self.spec.load_groups)
                or credentials["no_new_privs"] is not True
                or any(credentials[key] != 0 for key in ("cap_eff", "cap_perm", "cap_inh", "cap_amb"))):
            raise ValueError("Keeper load credentials do not exclude privileged mutation")
        last = state.pin.released(self.backend.budget, end)
        if (last["released"] or last["pid"] != generation["pid"]
                or process_generation(generation["pid"]) != generation or state.generation != generation):
            raise ValueError("Keeper generation changed during credential capture")
        self._check(deadline_ns, work=True)
        return {"generation": generation, "credentials": self._copy(credentials),
                "pidfd_before": first, "pidfd_after": last,
                "started_ns": started, "finished_ns": self.clock()}

    def capture(self, unit_mapping, deadline_ns):
        # Consume the exact reserved slot/unit before any current-generation I/O.
        value = dict(C.validate_unit_binding(unit_mapping))
        unit_ref = C.digest_record(value)
        slot = value["slot"]
        if (len(self._capture_attempts) >= 3 or slot in self._capture_slots
                or unit_ref in self._capture_attempts):
            raise ValueError("Native perimeter capture is one-shot per reserved slot")
        if value["name"] != self.spec.slots[slot].unit_name:
            raise ValueError("Original reserved unit required")
        self._capture_attempts[unit_ref] = slot
        self._capture_slots.add(slot)
        deadline_ns = self._check(deadline_ns, work=True) * 1000
        started = self.clock()
        unit, state = self._state(value)
        effective = self._snapshot(unit, deadline_ns)
        delegation = self.backend.delegation_observation(unit, self._check(deadline_ns, work=True))
        expected_manager = self.backend.ready.manager_binding
        if (type(delegation) is not dict or set(delegation) != {"original_unit_binding",
                "current_manager_before", "current_manager_after", "properties", "before_us", "after_us"}
                or delegation["original_unit_binding"] != unit
                or delegation["current_manager_before"] != expected_manager
                or delegation["current_manager_after"] != expected_manager
                or type(delegation["properties"]) is not dict or set(delegation["properties"]) != {"Delegate"}
                or delegation["properties"]["Delegate"] is not False
                or not self.spec.t0_us <= C.parse_u64(delegation["before_us"])
                <= C.parse_u64(delegation["after_us"]) <= self.clock() // 1000):
            raise ValueError("Fresh effective non-delegation observation required")
        self._check(deadline_ns, work=True)
        keeper = self._keeper(unit, state, deadline_ns)
        context, mount = self._context(deadline_ns)
        root, ancestors, leaf, _, walk_bracket = self._walk(unit["control_group"], context, mount, deadline_ns)
        if self._snapshot(unit, deadline_ns) != effective or self._context(deadline_ns)[0] != context:
            raise ValueError("Perimeter context or unit changed during capture")
        keeper_after = self._keeper(unit, state, deadline_ns)
        if (keeper_after["generation"] != keeper["generation"]
                or keeper_after["credentials"] != keeper["credentials"]):
            raise ValueError("Keeper changed across perimeter capture")
        self._check(deadline_ns, work=True)
        record = {"kind": "NATIVE_CGROUP_PERIMETER", "phase": "CAPTURE", "run": self.spec.run,
            "scope_ref": self.spec.scope_ref,
            "operator_assumptions": ["PID1_AND_CONTROL_TRUSTED", "NO_PRIVILEGED_EXTERNAL_ACTOR",
                                     "NO_EXTERNAL_CGROUP_ADMINISTRATIVE_MUTATOR"],
            "kernel_global_exclusion_proven": False, "unit_binding": unit,
            "context": self._data(context), "root": self._data(root), "ancestors": ancestors,
            "walk_bracket": walk_bracket,
            "parent": ancestors[-1], "leaf": leaf, "leaf_named_status": "PRESENT",
            "leaf_lookup_errno": None, "leaf_metadata_origin": "OBSERVED_NAMED",
            "detached_proof": "REQUIRED_FROM_CORE",
            "effective_properties": effective, "delegate_observation": delegation,
            "keeper_capture": keeper, "keeper_after": keeper_after,
            "started_ns": started, "finished_ns": self.clock()}
        stored = self._copy(record)
        self._captures[unit_ref] = stored
        return self._copy(stored)

    def revalidate(self, captured, original_core_binding, deadline_ns):
        deadline_ns = self._check(deadline_ns) * 1000
        started = self.clock()
        key = C.digest_record(C.validate_unit_binding(captured["unit_binding"]))
        if key not in self._captures or self._captures[key] != captured:
            raise ValueError("Original locally captured perimeter required")
        original = self._captures[key]
        binding = original_core_binding
        unit = original["unit_binding"]
        manager = self.backend.ready.manager_binding
        if (type(binding) is not self.physical.Binding
                or binding.manager.unit_binding_ref != C.digest_record(unit)
                or binding.manager.run_id != self.spec.run or binding.manager.slot_id != unit["slot"]
                or binding.manager.unit != unit["name"] or binding.manager.invocation_id != unit["invocation_id"]
                or binding.manager.control_group != unit["control_group"]
                or str(binding.manager.control_group_id) != unit["control_group_id"]
                or binding.manager.manager_owner != manager["owner_unique_name"]
                or binding.manager.manager_guid != manager["bus_guid"]
                or self._data(binding.context) != original["context"]
                or self._data(binding.mount) != next((m for m in original["context"]["mounts"]
                                                     if m["mount_point"] == "/sys/fs/cgroup"), None)
                or binding.parent.key() != tuple(original["parent"]["node"][k] for k in ("device", "inode", "mount_id", "filesystem_magic"))
                or binding.leaf.key() != tuple(original["leaf"]["node"][k] for k in ("device", "inode", "mount_id", "filesystem_magic"))
                or binding.leaf_name != self._parts(original["unit_binding"]["control_group"])[-1]
                or binding.parent_path != "/sys/fs/cgroup" + (original["parent"]["path"] if original["parent"]["path"] != "/" else "")):
            raise ValueError("Original core physical binding changed")
        context, mount = self._context(deadline_ns)
        if self._data(context) != original["context"]:
            raise ValueError("Original boot/mount context changed")
        root, ancestors, leaf, number, walk_bracket = self._walk(original["unit_binding"]["control_group"], context, mount,
                                                                deadline_ns, allow_absent=True)
        if (root.key() != tuple(original["root"][k] for k in ("device", "inode", "mount_id", "filesystem_magic"))
                or len(ancestors) != len(original["ancestors"])
                or any(not self._same_group(a, b) for a, b in zip(ancestors, original["ancestors"]))
                or (leaf is not None and not self._same_group(leaf, original["leaf"]))
                or self._context(deadline_ns)[0] != context):
            raise ValueError("Original cgroup perimeter identity or permissions changed")
        self._check(deadline_ns)
        result = self._copy(original)
        result.update({"phase": "REVALIDATE", "context": self._data(context), "root": self._data(root),
                       "ancestors": ancestors, "parent": ancestors[-1],
                       "walk_bracket": walk_bracket,
                       "leaf": original["leaf"] if leaf is None else leaf,
                       "leaf_named_status": "ABSENT" if leaf is None else "PRESENT",
                       "leaf_metadata_origin": "CAPTURED_ORIGINAL" if leaf is None else "OBSERVED_NAMED",
                       "leaf_lookup_errno": number, "started_ns": started, "finished_ns": self.clock()})
        # For absent names, leaf metadata is explicitly the retained capture.
        # Only the core's original FD can subsequently establish detachment.
        return result


def monotonic_us():
    return time.monotonic_ns() // 1000


class _Parser(argparse.ArgumentParser):
    def error(self, message):
        raise ValueError(message)


def _pairs(items):
    result = {}
    for key, value in items:
        if key in result:
            raise ValueError("Duplicate JSON key")
        result[key] = value
    return result


def _no_float(_value):
    raise ValueError("Floating JSON forbidden")


def _decode(raw):
    return json.loads(raw.decode("utf-8", "strict"), object_pairs_hook=_pairs,
                      parse_float=_no_float, parse_constant=_no_float)


def _incomplete(code, *, mode="unavailable", preflight_result=None):
    result = {"status": "INCOMPLETE", "mode": mode, "samples": [],
              "slots": [{"slot": i, "leaf_status": "UNKNOWN"} for i in range(3)],
              "missing_evidence": [code], "certificate_verified": False,
              "memory_reclamation": "NOT_ESTABLISHED"}
    if preflight_result is not None:
        result["preflight"] = preflight_result
    return result


class _OriginalPin:
    """Own original pidfd plus immutable process generation, used locally only."""
    def __init__(self, retained, clock, deadline):
        self.retained, self.generation = retained, retained.generation
        self.clock, self.deadline = clock, deadline

    def same_generation_alive(self):
        from .sd_bus_transport import process_generation
        try:
            before = self.clock()
            if before >= self.deadline or self.retained.closed:
                return False
            st = os.fstat(self.retained.fd)
            if (st.st_dev, st.st_ino) != self.retained.fd_identity:
                return False
            poller = select.poll()
            poller.register(self.retained.fd, select.POLLIN | select.POLLERR | select.POLLHUP)
            if poller.poll(0):
                return False
            return process_generation(self.generation["pid"]) == self.generation and self.clock() < self.deadline
        except (OSError, ValueError, RuntimeError):
            return False


class RetainedEvidenceStore:
    """One root-owned, own-fork inherited descriptor; no received FD authority.

    The coordinator retains the same inode before the child can write. Digests
    check consistency; custody of this descriptor identifies the local producer.
    """
    def __init__(self, fd, *, clock_us, deadline_us, native_custody=False):
        self.fd, self.clock, self.deadline = fd, clock_us, deadline_us
        self.native_custody = native_custody
        st = os.fstat(fd)
        if not stat.S_ISREG(st.st_mode) or st.st_nlink != 1:
            raise ValueError("Retained regular evidence file required")
        self.identity = (st.st_dev, st.st_ino)

    def _check(self):
        st = os.fstat(self.fd)
        if (st.st_dev, st.st_ino) != self.identity or st.st_nlink != 1 or self.clock() >= self.deadline:
            raise ValueError("Evidence custody/deadline unavailable")
        if self.native_custody and (st.st_uid != 0 or stat.S_IMODE(st.st_mode) != 0o600):
            raise ValueError("Protected evidence file changed")

    def __call__(self, record):
        self._check()
        raw = json.dumps(record, ensure_ascii=False, sort_keys=True, separators=(",", ":"), allow_nan=False).encode("utf-8")
        if not 0 < len(raw) <= STORE_LIMIT:
            raise ValueError("Evidence store exceeds bound")
        # Only the watchdog writes. The coordinator reads after receiving FINAL.
        os.lseek(self.fd, 0, os.SEEK_SET)
        offset = 0
        while offset < len(raw):
            self._check()
            written = os.write(self.fd, raw[offset:])
            if written <= 0:
                raise OSError("Evidence write failed")
            offset += written
        os.ftruncate(self.fd, len(raw))
        os.fsync(self.fd)
        self._check()

    def read(self):
        self._check()
        os.lseek(self.fd, 0, os.SEEK_SET)
        raw = bytearray()
        while len(raw) <= STORE_LIMIT:
            self._check()
            part = os.read(self.fd, min(65536, STORE_LIMIT + 1 - len(raw)))
            if not part:
                break
            raw.extend(part)
        self._check()
        if len(raw) > STORE_LIMIT:
            raise ValueError("Evidence store exceeds bound")
        record = _decode(bytes(raw))
        self._check()  # Decoding also consumes the original custody/time budget.
        return record


class StoredFinalVerifier:
    """Recheck the complete retained certificate graph, never refs alone."""
    def __init__(self, store, *, fixture_only=False):
        self.store, self.fixture_only = store, fixture_only

    def verify(self, spec, final, transcript):
        if not self.fixture_only and not self.store.native_custody:
            return False
        record = self.store.read()
        if record.get("run") != spec.run or record.get("fixture_only") is not False or record.get("final") != final:
            return False
        if final["status"] != "COMPLETE" or final["missing_evidence"]:
            return False
        manager = C.validate_manager_binding(record["manager_binding"])
        payload = C.validate_payload_binding(record["payload_binding"])
        root = C.validate_observer_root_binding(record["observer_root_binding"])
        root_identity = root["original_root_identity"]
        armed = [p["body"] for p in transcript if p["event"] == "ARMED"]
        if (len(armed) != 1 or armed[0]["observer_root_binding"] != C.digest_record(root) or
                armed[0]["manager_binding"] != manager or armed[0]["payload_binding"] != payload or
                root["run"] != spec.run or root_identity["boot_id"] != manager["boot_id"] or
                root_identity["mount_namespace_ref"] != manager["manager_pid_generation"]["mount_namespace_ref"] or
                root_identity["mount_namespace_ref"] != armed[0]["watchdog_generation"]["mount_namespace_ref"] or
                not spec.t0_us <= C.parse_u64(root["before_us"]) <= C.parse_u64(root["after_us"]) < spec.work_deadline_us):
            return False
        if payload["sha256"] != spec.payload_expected_sha256:
            return False
        lease = C.parse_u64(manager["authority_lease_until_us"])
        if self.store.clock() >= min(lease, spec.cleanup_deadline_us):
            return False
        chain = record["ledger_records"]
        if type(chain) is not list or not 0 < len(chain) <= 512:
            return False
        previous, last_time = C.digest_record({"run": spec.run, "origin": str(spec.t0_us)}), spec.t0_us
        records = {}
        for item in chain:
            if set(item) != {"ref", "record"} or item["ref"] in records:
                return False
            entry = item["record"]
            timestamp = C.parse_u64(entry["mono_us"])
            if set(entry) != {"previous", "kind", "slot", "mono_us", "facts"} or entry["previous"] != previous or not last_time <= timestamp < min(lease, spec.cleanup_deadline_us):
                return False
            if C.digest_record(entry) != item["ref"]:
                return False
            records[item["ref"]] = entry
            previous, last_time = item["ref"], timestamp
            if entry["kind"] == "FAULT":
                return False
        if final["slot_ledger_ref"] != previous:
            return False
        slots = record["slots"]
        if type(slots) is not list or [s.get("slot") for s in slots] != [0, 1, 2]:
            return False
        samples, certificates = [], []
        for slot in slots:
            index = slot["slot"]
            unit = C.validate_unit_binding(slot["unit"])
            physical = C.validate_physical_binding(slot["physical"])
            if any(physical[k] != root_identity[k] for k in ("boot_id", "mount_namespace_ref", "mount_id", "fs_type", "dev")):
                return False
            keeper = C.validate_process_generation(slot["keeper"])
            sample = C.validate_memory_sample(slot["sample"])
            evidence = C.validate_cleanup_evidence(slot["cleanup_evidence"])
            binding_proof = C.validate_binding_proof(slot["binding_proof"], physical)
            closure_proof = C.validate_closure_proof(slot["closure_proof"], binding_proof, evidence, physical)
            if (C.parse_u64(binding_proof["before_us"]) < C.parse_u64(root["after_us"]) or
                    not C.parse_u64(binding_proof["after_us"]) <= C.parse_u64(sample["before_us"]) <= C.parse_u64(sample["after_us"]) < spec.work_deadline_us):
                return False
            unit_ref, physical_ref, keeper_ref = C.digest_record(unit), C.digest_record(physical), C.digest_record(keeper)
            if unit["slot"] != index or unit["name"] != spec.slots[index].unit_name or unit["keeper_generation_ref"] != keeper_ref or unit["manager_binding_ref"] != C.digest_record(manager):
                return False
            if (physical["run"] != spec.run or physical["slot"] != index or physical["unit_binding_ref"] != unit_ref or
                    physical["unit_name"] != unit["name"] or physical["manager_owner"] != manager["owner_unique_name"] or
                    physical["bus_guid"] != manager["bus_guid"] or physical["mount_namespace_ref"] != keeper["mount_namespace_ref"] or
                    any(physical[k] != unit[k] for k in ("invocation_id", "control_group", "control_group_id"))):
                return False
            if (sample["unit_binding_ref"] != unit_ref or sample["physical_binding_ref"] != physical_ref or
                    sample["identity_before_ref"] != physical_ref or sample["identity_after_ref"] != physical_ref or
                    sample["keeper_generation_ref"] != keeper_ref or C.parse_u64(sample["after_us"]) >= spec.work_deadline_us):
                return False
            if evidence["original_unit_binding_ref"] != unit_ref or evidence["original_physical_binding_ref"] != physical_ref or evidence["missing_evidence"] or C.parse_u64(evidence["observed_us"]) >= min(lease, spec.cleanup_deadline_us):
                return False
            if evidence["physical"]["tag"] != "OriginalAbsent" or slot["leaf_status"] != "CLOSED_REMOVED":
                return False
            receipts = slot["independent_receipts"]
            if receipts.get("test_boundary") is not False or receipts.get("missing_evidence") != [] or any(receipts.get(k) is not True for k in ("activations_settled", "stop_settled", "terminal_no_pending_execution", "keeper_reaped")):
                return False
            for key, refkey in (("start_receipt", "start_settlement_ref"), ("stop_receipt", "stop_settlement_ref"), ("final_unit_receipt", "final_unit_receipt_ref"), ("keeper_reap_receipt", "keeper_reap_receipt_ref")):
                if not isinstance(receipts.get(key), dict) or C.digest_record(receipts[key]) != receipts.get(refkey):
                    return False
            if evidence["start_settlement_ref"] != receipts["start_settlement_ref"] or evidence["stop_settlement_ref"] != receipts["stop_settlement_ref"] or evidence["final_unit_observation_ref"] != receipts["final_unit_receipt_ref"] or C.parse_u64(evidence["lease_until_us"]) != lease:
                return False
            main = receipts["keeper_reap_receipt"]
            C.validate_main_release_facts(main["systemd_main_exit"], main["pidfd_task_released"])
            for observed in (receipts["final_unit_receipt"], *main.values(), *slot["reaps"], *slot["threads"], *slot["joins"]):
                if not spec.t0_us <= C.parse_u64(observed["before_us"]) <= C.parse_u64(observed["after_us"]) <= C.parse_u64(evidence["observed_us"]):
                    return False
            if main["systemd_main_exit"]["original_process_generation"] != keeper or main["systemd_main_exit"]["invocation_id"] != unit["invocation_id"]:
                return False
            for kind in ("start", "stop"):
                receipt = receipts[kind + "_receipt"]
                event = receipt["event"]
                if set(receipt) != {"kind", "job_ref", "request_ref", "event"} or receipt["kind"] != kind or event["unit_name"] != unit["name"] or event["boot_id"] != manager["boot_id"] or event["bus_guid"] != manager["bus_guid"] or event["owner_unique_name"] != manager["owner_unique_name"]:
                    return False
                if event["result"] != "done" or type(event["job_id"]) is not int or not 0 < event["job_id"] <= 0xffffffff or event["job_path"] != "/org/freedesktop/systemd1/job/" + str(event["job_id"]) or not spec.t0_us <= C.parse_u64(str(event["observed_us"])) < min(lease, spec.cleanup_deadline_us):
                    return False
                expected_job = C.digest_record({"kind": kind, "slot": index, "boot_id": manager["boot_id"], "bus_guid": manager["bus_guid"], "owner": manager["owner_unique_name"], "job_id": event["job_id"], "job_path": event["job_path"], "unit_name": unit["name"]})
                outcomes = [r["facts"] for r in records.values() if r["kind"] == kind.upper() + "_OUTCOME" and r["slot"] == index]
                if len(outcomes) != 1 or outcomes[0].get("request_ref") != receipt["request_ref"] or outcomes[0].get("job_ref") != receipt["job_ref"] or receipt["job_ref"] != expected_job:
                    return False
            final_unit = receipts["final_unit_receipt"]
            if final_unit["original_unit_binding_ref"] != unit_ref or final_unit["invocation_id"] != unit["invocation_id"] or final_unit["manager_binding_ref"] != C.digest_record(manager):
                return False
            final_snapshot = final_unit["snapshot"]
            u, service = final_snapshot["unit"], final_snapshot["service"]
            if final_snapshot["object_path"] != unit["object_path"] or u["Id"] != unit["name"] or u["InvocationID"] != unit["invocation_id"] or u["Transient"] is not True or u["ActiveState"] not in ("inactive", "failed") or u["SubState"] not in ("dead", "failed") or list(u["Job"]) != [0, "/"] or type(service["MainPID"]) is not int or service["MainPID"] != 0 or type(service["ControlPID"]) is not int or service["ControlPID"] != 0:
                return False
            spawns = {C.digest_record(s["child_generation"]): s for s in slot["spawns"]}
            if len(spawns) != len(slot["spawns"]) or not 0 < len(spawns) <= 7 or any(s["parent_generation_ref"] != keeper_ref for s in spawns.values()):
                return False
            waits = {}
            for raw in slot["reaps"]:
                receipt = C.validate_reap_receipt(raw)
                if receipt["tag"] == "PTHREAD_JOINED":
                    return False
                child_ref = C.digest_record(receipt["child_generation"])
                if child_ref not in spawns or child_ref in waits:
                    return False
                waits[child_ref] = receipt
            if set(waits) != set(spawns) or not spawns:
                return False
            if any(r["reaper_generation"] != keeper for r in waits.values()):
                return False
            generations = {keeper_ref: keeper, **{key: body["child_generation"] for key, body in spawns.items()}}
            initial = {}
            for item in slot["initial_threads"]:
                if set(item) != {"owner_process_generation_ref", "thread_creation_record_ref", "thread_ref", "event", "body"}:
                    return False
                generation = generations.get(item["owner_process_generation_ref"])
                if generation is None or item["thread_ref"] != C.initial_thread_token(generation) or item["thread_ref"] in initial or item["thread_creation_record_ref"] != C.initial_thread_creation_ref(item["event"], item["body"]):
                    return False
                if generation == keeper:
                    hello = item["body"]
                    if item["event"] != "KEEPER_HELLO" or hello["pid"] != keeper["pid"] or hello["start_ticks"] != keeper["start_ticks"] or hello["exe_sha256"] != spec.payload_expected_sha256 or hello["uid"] != spec.load_uid or hello["gid"] != spec.load_gid or hello["groups"] != list(spec.load_groups):
                        return False
                elif item["event"] != "SPAWNED" or item["body"] != spawns[item["owner_process_generation_ref"]]:
                    return False
                initial[item["thread_ref"]] = item
            if {i["owner_process_generation_ref"] for i in initial.values()} != set(generations):
                return False
            threads = {}
            for raw in slot["threads"]:
                thread = C.validate_thread_created(raw)
                creator = threads.get(thread["creating_thread_ref"]) or initial.get(thread["creating_thread_ref"])
                if thread["thread_ref"] in threads or thread["thread_ref"] in initial or creator is None or creator["owner_process_generation_ref"] != thread["owner_process_generation_ref"]:
                    return False
                threads[thread["thread_ref"]] = thread
            joins = {}
            for raw in slot["joins"]:
                joined = C.validate_reap_receipt(raw)
                if joined["tag"] != "PTHREAD_JOINED" or joined["joined_thread_ref"] in joins:
                    return False
                thread = threads.get(joined["joined_thread_ref"]) or initial.get(joined["joined_thread_ref"])
                joining = threads.get(joined["joining_thread_ref"]) or initial.get(joined["joining_thread_ref"])
                if thread is None or joining is None or any(joined[k] != thread[k] for k in ("owner_process_generation_ref", "thread_creation_record_ref")) or joining["owner_process_generation_ref"] != thread["owner_process_generation_ref"]:
                    return False
                joins[joined["joined_thread_ref"]] = joined
            if any(tref not in joins and t["owner_process_generation_ref"] not in waits for tref, t in threads.items()):
                return False
            reap_ref = C.digest_record({"reaps": sorted(C.digest_record(r) for r in (*waits.values(), *joins.values()))})
            if sample["ledger_checkpoint_ref"] != reap_ref or evidence["reap_ledger_ref"] != reap_ref:
                return False
            certificate = records.get(slot["certificate"])
            if (certificate is None or C.parse_u64(certificate["mono_us"]) < C.parse_u64(evidence["observed_us"]) or
                    certificate["kind"] != "CLEANUP_CERTIFICATE" or certificate["slot"] != index or certificate["facts"] != {"evidence_ref": C.digest_record(evidence), "independent_receipts_ref": C.digest_record(receipts), "binding_proof_ref": C.digest_record(binding_proof), "closure_proof_ref": C.digest_record(closure_proof)}):
                return False
            if not any(p["event"] == "UNIT_BOUND" and p["slot"] == index and p["body"]["unit_binding"] == unit for p in transcript) or not any(p["event"] == "MEMORY_SAMPLE" and p["slot"] == index and p["body"]["sample"] == sample for p in transcript):
                return False
            samples.append(C.digest_record(sample))
            certificates.append(slot["certificate"])
        return (final["metric_records_ref"] == C.digest_record({"samples": samples}) and
                final["cleanup_records_ref"] == C.digest_record({"certificates": certificates}) and
                self.store.clock() < min(lease, spec.cleanup_deadline_us))


class NativeSettlementAuthority:
    """Local original backend custody, never a boolean or wire credential."""
    def __init__(self, spec):
        self.spec, self.backend = spec, None

    def attach_once(self, backend):
        from .systemd_backend import SystemdBackend
        if self.backend is not None or type(backend) is not SystemdBackend or backend.test_boundary or backend.spec != self.spec:
            raise ValueError("Original native backend custody required")
        self.backend = backend

    def prove_release_allowed(self, payload, deadline_us):
        if self.backend is None or sys.platform != "linux" or monotonic_us() >= min(deadline_us, self.spec.cleanup_deadline_us):
            raise ValueError("Settlement authority unavailable")
        backend = self.backend
        if C.digest_record(C.validate_payload_binding(payload)) != C.digest_record(backend.payload) or not backend.cleanup_started:
            raise ValueError("Original payload/cleanup custody required")
        receipts = []
        for slot in self.spec.slots:
            receipt = backend.release_receipt(slot.slot, deadline_us)
            if (receipt["test_boundary"] is not False or receipt["slot"] != slot.slot or
                    receipt["run"] != self.spec.run or receipt["payload_binding_ref"] != C.digest_record(payload) or
                    receipt["manager_binding_ref"] != C.digest_record(C.validate_manager_binding(backend.transport.binding)) or
                    receipt["no_future_own_exec"] is not True or
                    not self.spec.t0_us <= C.parse_u64(receipt["observed_us"]) <= monotonic_us() or
                    C.parse_u64(receipt["authority_lease_until_us"]) != backend.transport.budget.lease):
                raise ValueError("Original execution obligations remain")
            basis, graph = receipt["basis"], receipt["cleanup_receipts"]
            if basis in ("NOT_RESERVED_NOT_DISPATCHED", "RESERVED_NOT_DISPATCHED"):
                if graph is not None:
                    raise ValueError("Undispatched slot cannot invent a unit graph")
            elif basis == "START_DISPATCHED_BOUND":
                if (graph is None or graph["test_boundary"] is not False or graph.get("missing_evidence") != [] or
                        any(graph[k] is not True for k in ("activations_settled", "stop_settled", "terminal_no_pending_execution", "keeper_reaped"))):
                    raise ValueError("Original dispatched unit remains unsettled")
                for record_key, ref_key in (("start_receipt", "start_settlement_ref"), ("stop_receipt", "stop_settlement_ref"),
                                            ("final_unit_receipt", "final_unit_receipt_ref"), ("keeper_reap_receipt", "keeper_reap_receipt_ref")):
                    if not isinstance(graph.get(record_key), dict) or C.digest_record(graph[record_key]) != graph.get(ref_key):
                        raise ValueError("Original settlement graph is incomplete")
                if backend.validate_release_graph(slot.slot, graph, deadline_us) is not True:
                    raise ValueError("Original settlement graph conflicts with retained native facts")
            else:
                raise ValueError("Unknown dispatched activation remains an obligation")
            receipts.append(receipt)
        if monotonic_us() >= min(deadline_us, self.spec.cleanup_deadline_us):
            raise ValueError("Settlement authority expired")
        return {"run": self.spec.run, "payload_binding_ref": C.digest_record(payload), "slots": receipts}


class _OwnedFd:
    def __init__(self, fd):
        self.fd = fd

    def close(self):
        if self.fd is not None:
            fd, self.fd = self.fd, None
            os.close(fd)


def _watchdog_listener(distribution, endpoint):
    """Require the socket creator credentials of this watchdog, never its parent."""
    listener = distribution.keeper_listener()
    try:
        creator = struct.unpack("3i", listener.getsockopt(socket.SOL_SOCKET, socket.SO_PEERCRED, struct.calcsize("3i")))
        if (listener.family != socket.AF_UNIX or
                listener.type & 0xf != socket.SOCK_SEQPACKET or
                listener.getsockopt(socket.SOL_SOCKET, socket.SO_ACCEPTCONN) != 1 or
                listener.getsockname() != endpoint or
                creator != (os.getpid(), os.geteuid(), os.getegid()) or creator[1] != 0):
            raise ValueError("Listener must be created by the original root watchdog")
        return listener
    except BaseException:
        listener.close()
        raise


def create_runtime_observer(spec, *, observer_type, producer_factory=None):
    """Compose the external adapter with its local producer factory, without IPC.

    A missing native implementation is a dependency failure. This factory does
    not replace original retained handles with serialized identities or mocks.
    """
    observer = observer_type(spec, producer_factory=producer_factory)
    methods = ("preflight", "bind_leaf", "binding_proof", "sample_peak",
               "probe_cleanup", "cleanup_proof")
    if any(not callable(getattr(observer, name, None)) for name in methods):
        raise ValueError("Runtime physical observer adapter incomplete")
    exporter = getattr(producer_factory, "export_evidence", None)
    if callable(exporter):
        observer.export_producer_evidence = exporter
    if type(producer_factory) is _NativePhysicalProducerFactory:
        # The delivered adapter's _compose is pure. Establish the actual local
        # filesystem provenance before Watchdog snapshots its fixture boundary.
        compose = getattr(observer, "_compose", None)
        if not callable(compose):
            raise ValueError("Physical adapter pure composition hook missing")
        compose()
    return observer


class _NativeUnitIdentitySource:
    def __init__(self, factory, unit):
        self.factory, self.unit = factory, unit

    def snapshot(self, deadline_ns):
        return self.factory._unit_snapshot(self.unit, deadline_ns)

    def closure_snapshot(self, deadline_ns):
        # The physical owner calls this hook only from its allow_absent path.
        return self.factory._closure_snapshot(self.unit, deadline_ns)


class _TerminalIdentityRequired(ValueError):
    """An authenticated original unit cleared its cgroup pair during cleanup."""


class _NativePhysicalProducerFactory:
    """Child-local composition over the original authenticated backend.

    Construction and __call__ do not probe. Only the producer callbacks perform
    read-only observations under their original absolute monotonic deadlines.
    No external dict, hash, boolean or descriptor establishes this custody.
    """
    MAX_RECORDS = 512

    def __init__(self, spec, backend, physical_module):
        if sys.platform != "linux":
            raise ValueError("PLATFORM_LINUX")
        from .systemd_backend import SystemdBackend, _NativeIdentity
        from .sd_bus_transport import SdBusTransport, _NativeBus
        if (type(backend) is not SystemdBackend or backend.test_boundary
                or type(backend.identity) is not _NativeIdentity
                or type(backend.transport) is not SdBusTransport
                or backend.transport.test_boundary
                or type(backend.transport.driver) is not _NativeBus
                or backend.spec != spec):
            raise ValueError("Original native backend required")
        if (physical_module.__name__ != __package__ + ".physical_cgroup"
                or physical_module.PhysicalProducer.__module__ != physical_module.__name__
                or physical_module.LinuxFilesystem.__module__ != physical_module.__name__):
            raise ValueError("Original physical producer module required")
        self.spec, self.backend, self.physical = spec, backend, physical_module
        self.transport, self.identity, self.budget = backend.transport, backend.identity, backend.budget
        self.driver = self.transport.driver
        self.generation = C.validate_process_generation(backend.watchdog_generation)
        self.payload_ref = C.digest_record(C.validate_payload_binding(backend.payload))
        self.spec_ref = C.digest_record(spec.to_mapping())
        self.clock = time.monotonic_ns
        self.records, self.record_bytes = {}, 0
        self.perimeter = _NativeCgroupPerimeter(spec, backend, physical_module)
        self.perimeters, self.core_bindings = {}, {}

    def _original(self):
        if (sys.platform != "linux" or self.backend.closed or self.backend.invalid
                or self.backend.test_boundary or self.transport.test_boundary
                or self.backend.transport is not self.transport
                or self.backend.identity is not self.identity
                or self.backend.budget is not self.budget
                or self.transport.driver is not self.driver
                or self.backend.watchdog_generation != self.generation
                or C.digest_record(self.backend.spec.to_mapping()) != self.spec_ref
                or C.digest_record(self.spec.to_mapping()) != self.spec_ref
                or C.digest_record(C.validate_payload_binding(self.backend.payload)) != self.payload_ref):
            raise ValueError("Original native producer custody changed")

    def __call__(self, spec):
        self._original()
        if C.digest_record(spec.to_mapping()) != self.spec_ref:
            raise ValueError("Original physical producer RunSpec changed")
        return self.physical.PhysicalProducer(
            manager_binding=self.manager_binding, identity_source=self.identity_source,
            keeper_observation=self.keeper_observation, absence_policy=self.absence_policy,
            filesystem=self.physical.LinuxFilesystem(), clock=self.clock,
            budget=self.physical.Budget(), mount_point="/sys/fs/cgroup")

    def _deadline(self, deadline_ns):
        self._original()
        if type(deadline_ns) is not int or not 0 < deadline_ns <= C.U64_MAX * 1000:
            raise ValueError("Absolute monotonic nanosecond deadline required")
        # Reserve capacity before any new producer I/O. The retained final inode
        # remains capped at STORE_LIMIT; journal overflow never enables success.
        if len(self.records) >= self.MAX_RECORDS or self.record_bytes > STORE_LIMIT - 65536:
            raise ValueError("Native producer evidence capacity exhausted")
        deadline = min(deadline_ns // 1000, self.spec.cleanup_deadline_us, self.budget.lease)
        return self.backend._check(deadline)

    def _put(self, record):
        raw = json.dumps(record, ensure_ascii=False, sort_keys=True,
                         separators=(",", ":"), allow_nan=False).encode("utf-8")
        # Full local preimages can be deeper than the bounded IPC vocabulary.
        # The digest correlates those records; original local custody is the
        # authority. This does not relax any wire schema or storage bound.
        ref = hashlib.sha256(raw).hexdigest()
        if ref not in self.records:
            if len(self.records) >= self.MAX_RECORDS or self.record_bytes + len(raw) > STORE_LIMIT:
                raise ValueError("Native producer evidence capacity exhausted")
            self.records[ref] = raw
            self.record_bytes += len(raw)
        return ref

    def _put_perimeter_observation(self, record):
        """Retain each full preimage once while keeping every read's times.

        This changes only the local journal representation. The authenticated
        capture and revalidation objects remain complete in local custody.
        Stable metadata has the same reference across independently timed reads.
        """
        value = json.loads(json.dumps(record, ensure_ascii=False, allow_nan=False))
        for key in ("unit_binding", "context", "root", "parent", "leaf", "effective_properties",
                    "delegate_observation", "keeper_capture", "keeper_after"):
            if key in value:
                value[key + "_ref"] = self._put(value.pop(key))
        if "ancestors" in value:
            value["ancestor_refs"] = [self._put(group) for group in value.pop("ancestors")]
        bracket = value.get("walk_bracket")
        if bracket is not None:
            groups = bracket.pop("observed_groups")
            references = []
            for expected, group in groups.items():
                reference = self._put(group)
                if reference != expected:
                    raise ValueError("Original perimeter group preimage reference changed")
                references.append(reference)
            bracket["observed_group_refs"] = references
        return self._put(value)

    def _manager(self, deadline):
        if self.backend.ready is None or not self.backend.ready.jobs_listener_ready:
            raise ValueError("Original subscribed manager preflight required")
        actual = C.validate_manager_binding(self.transport.verify_identity(deadline))
        if actual != C.validate_manager_binding(self.backend.ready.manager_binding):
            self.backend.invalid = "MANAGER_IDENTITY_CHANGED"
            self._put({"kind": "NATIVE_MANAGER_BINDING_REJECTED", "run": self.spec.run,
                       "observed_binding": actual,
                       "original_binding": self.backend.ready.manager_binding,
                       "observed_ns": self.clock()})
            raise ValueError("Original manager binding changed")
        return actual

    def manager_binding(self, deadline_ns):
        deadline = self._deadline(deadline_ns)
        end = self.budget.begin(deadline)
        before = self.clock()
        manager = self._manager(end)
        self.backend._check(end)
        self.budget.end(end)
        self._put({"kind": "NATIVE_MANAGER_OBSERVATION", "run": self.spec.run,
                   "manager_binding": manager, "watchdog_generation": self.generation,
                   "started_ns": before, "finished_ns": self.clock()})
        return manager

    def _slot(self, unit):
        value = C.validate_unit_binding(unit)
        state = self.backend._slot(value["slot"])
        if (state.binding != value or state.generation is None or state.pin is None
                or state.pin.closed or state.pin.generation != state.generation
                or value["keeper_generation_ref"] != C.digest_record(state.generation)):
            raise ValueError("Original bound unit and retained keeper required")
        from .sd_bus_transport import ProcessPin
        if type(state.pin) is not ProcessPin:
            raise ValueError("Original native keeper pidfd required")
        return value, state

    def identity_source(self, unit, deadline_ns):
        deadline = self._deadline(deadline_ns)
        self._manager(deadline)
        value, _ = self._slot(unit)
        ref = C.digest_record(value)
        if ref not in self.perimeters:
            if self.backend.cleanup_started:
                raise ValueError("Perimeter capture requires the original live bind before cleanup")
            capture = self.perimeter.capture(value, deadline * 1000)
            if (capture.get("unit_binding") != value or type(capture.get("started_ns")) is not int
                    or type(capture.get("finished_ns")) is not int
                    or not self.spec.t0_us * 1000 <= capture["started_ns"] <= capture["finished_ns"]
                    < min(deadline, self.spec.work_deadline_us) * 1000):
                raise ValueError("Original pre-GO protection capture unavailable")
            self.perimeters[ref] = (json.loads(json.dumps(capture)), self._put_perimeter_observation(capture))
            self._manager(deadline)
            self.backend._check(deadline, work=True)
        return _NativeUnitIdentitySource(self, value)

    def _unit_snapshot(self, unit, deadline_ns):
        deadline = self._deadline(deadline_ns)
        end = self.budget.begin(deadline)
        before = self.clock()
        manager = self._manager(end)
        value, state = self._slot(unit)
        try:
            snapshot = self.backend._snapshot(value["slot"], end)
        except Exception as error:
            self._put({"kind": "NATIVE_UNIT_SNAPSHOT_UNAVAILABLE", "run": self.spec.run,
                "manager_binding": manager, "unit_binding": value,
                "error_type": type(error).__name__, "error_code": getattr(error, "code", "DEPENDENCY_UNAVAILABLE"),
                "remote_error_name": getattr(error, "name", None),
                "started_ns": before, "finished_ns": self.clock()})
            raise
        snapshot_ref = self._put({"kind": "NATIVE_UNIT_SNAPSHOT_READ", "run": self.spec.run,
            "manager_binding": manager, "unit_binding": value, "snapshot": snapshot,
            "started_ns": before, "finished_ns": self.clock()})
        self.backend._original(value["slot"], snapshot, end)
        service = snapshot["service"]
        actual = snapshot["unit"]
        if (service["ControlGroup"] == "" and type(service["ControlGroupId"]) is int
                and service["ControlGroupId"] == 0
                and actual["ActiveState"] in ("inactive", "failed")
                and actual["SubState"] in ("dead", "failed")
                and list(actual["Job"]) == [0, "/"] and type(actual["Job"][0]) is int
                and type(service["MainPID"]) is int and service["MainPID"] == 0
                and type(service["ControlPID"]) is int and service["ControlPID"] == 0):
            raise _TerminalIdentityRequired("Fresh original cgroup manager identity unavailable")
        # A terminal cleared pair or unloaded unit is not a fresh observation of
        # the original ControlGroupId. Never substitute the retained binding.
        if (snapshot["object_path"] != value["object_path"]
                or snapshot["unit"]["InvocationID"] != value["invocation_id"]
                or service["ControlGroup"] != value["control_group"]
                or str(service["ControlGroupId"]) != value["control_group_id"]):
            raise ValueError("Fresh original cgroup manager identity unavailable")
        after_manager = self._manager(end)
        if after_manager != manager or state.binding != value:
            raise ValueError("Original unit observation changed")
        self.backend._check(end)
        self.budget.end(end)
        source_ref = self._put({"kind": "NATIVE_UNIT_OBSERVATION", "run": self.spec.run,
            "manager_binding": manager, "unit_binding": value, "snapshot": snapshot,
            "snapshot_read_ref": snapshot_ref,
            "started_ns": before, "finished_ns": self.clock()})
        return self.physical.ManagerIdentity(self.spec.run, value["slot"],
            manager["owner_unique_name"], manager["bus_guid"], value["name"],
            value["invocation_id"], service["ControlGroup"], service["ControlGroupId"],
            C.digest_record(value), source_ref)

    def _terminal_record(self, value, deadline):
        """Authenticate settled execution independently of physical closure."""
        if not self.backend.cleanup_started:
            raise ValueError("Terminal identity requires irreversible cleanup")
        record = self.backend.terminal_observation(value["slot"], deadline)
        if (type(record) is not dict or set(record) != {
                "original_unit_binding", "current_manager_before", "current_manager_after",
                "cleanup_graph", "unit_state_read"} or record["original_unit_binding"] != value):
            raise ValueError("Original terminal wrapper preimage required")
        manager = self._manager(deadline)
        if (record["current_manager_before"] != manager or record["current_manager_after"] != manager
                or self.backend.validate_release_graph(value["slot"], record["cleanup_graph"], deadline)
                is not True):
            raise ValueError("Original pre-physical settlement graph unavailable")
        read = record["unit_state_read"]
        if type(read) is not dict:
            raise ValueError("Current terminal unit state read unavailable")
        if read.get("kind") == "NO_SUCH_UNIT":
            if read != {"kind": "NO_SUCH_UNIT", "error_name": "org.freedesktop.systemd1.NoSuchUnit",
                        "object_path": value["object_path"]}:
                raise ValueError("Actual original NoSuchUnit observation required")
        elif read.get("kind") == "TERMINAL_CLEARED":
            if set(read) != {"kind", "snapshot"}:
                raise ValueError("Closed terminal-cleared read required")
            snapshot = read["snapshot"]
            self.backend._original(value["slot"], snapshot, deadline)
            unit, service = snapshot["unit"], snapshot["service"]
            if (unit["ActiveState"] not in ("inactive", "failed")
                    or unit["SubState"] not in ("dead", "failed")
                    or list(unit["Job"]) != [0, "/"] or type(unit["Job"][0]) is not int
                    or type(service["MainPID"]) is not int or service["MainPID"] != 0
                    or type(service["ControlPID"]) is not int or service["ControlPID"] != 0
                    or service["ControlGroup"] != "" or type(service["ControlGroupId"]) is not int
                    or service["ControlGroupId"] != 0):
                raise ValueError("Fresh original terminal cleared pair required")
        else:
            raise ValueError("Unknown current terminal unit state")
        return record

    def _closure_snapshot(self, unit, deadline_ns):
        from .sd_bus_transport import BusRemoteError
        deadline = self._deadline(deadline_ns)
        try:
            # LIVE observations still come from current original cgroup facts.
            return self._unit_snapshot(unit, deadline_ns)
        except _TerminalIdentityRequired:
            pass
        except BusRemoteError as error:
            if error.name != "org.freedesktop.systemd1.NoSuchUnit":
                raise
        end = self.budget.begin(deadline)
        started = self.clock()
        value, _ = self._slot(unit)
        ref = C.digest_record(value)
        if ref not in self.perimeters or ref not in self.core_bindings:
            raise ValueError("Original pre-GO perimeter and core binding custody required")
        capture, capture_ref = self.perimeters[ref]
        binding_ref, binding = self.core_bindings[ref]
        before = self.perimeter.revalidate(capture, binding, end * 1000)
        terminal = self._terminal_record(value, end)
        after = self.perimeter.revalidate(capture, binding, end * 1000)
        self._manager(end)
        self.backend._check(end)
        self.budget.end(end)
        finished = self.clock()
        if not started <= finished < end * 1000:
            raise ValueError("Original terminal observation deadline expired")
        terminal_type = getattr(self.physical, "TerminalIdentityObservation", None)
        if terminal_type is None or terminal_type.__module__ != self.physical.__name__:
            raise ValueError("Original physical terminal identity hook unavailable")
        before_ref, after_ref = self._put_perimeter_observation(before), self._put_perimeter_observation(after)
        source_ref = self._put({"kind": "SETTLED_ORIGINAL", **terminal,
                              "started_ns": started, "finished_ns": finished})
        self._put({"kind": "NATIVE_TERMINAL_IDENTITY_OBSERVATION", "run": self.spec.run,
            "scope_ref": self.spec.scope_ref, "terminal_ref": source_ref, "binding_ref": binding_ref,
            "protection_capture_ref": capture_ref, "protection_before_ref": before_ref,
            "protection_after_ref": after_ref, "started_ns": started, "finished_ns": finished})
        return terminal_type(kind="SETTLED_ORIGINAL", **terminal, started_ns=started,
                             finished_ns=finished, source_ref=source_ref)

    def absence_policy(self, binding_ref, original_core_binding, deadline_ns):
        """Local sole-mutator exclusion; the core proves physical detachment."""
        from .systemd_backend import BackendError
        deadline = self._deadline(deadline_ns)
        end = self.budget.begin(deadline)
        started = self.clock()
        binding = original_core_binding
        if (type(binding) is not self.physical.Binding or type(binding_ref) is not str
                or len(binding_ref) != 32 or any(c not in "0123456789abcdef" for c in binding_ref)
                or self.spec.scope_ref != _NativeCgroupPerimeter.SCOPE
                or not self.backend.cleanup_started):
            raise ValueError("Original scoped cleanup binding required")
        ref = binding.manager.unit_binding_ref
        if ref not in self.perimeters:
            raise ValueError("Original pre-GO protection capture required")
        capture, capture_ref = self.perimeters[ref]
        value, _ = self._slot(capture["unit_binding"])
        manager = self._manager(end)
        expected = self.physical.ManagerIdentity(self.spec.run, value["slot"],
            manager["owner_unique_name"], manager["bus_guid"], value["name"],
            value["invocation_id"], value["control_group"], int(value["control_group_id"]), ref, capture_ref)
        if binding.manager.key() != expected.key():
            raise ValueError("Original physical binding manager identity changed")
        old = self.core_bindings.get(ref)
        if old is not None and (old[0] != binding_ref or old[1] is not binding):
            raise ValueError("Original retained core binding custody changed")
        before = self.perimeter.revalidate(capture, binding, end * 1000)
        self.core_bindings[ref] = (binding_ref, binding)
        try:
            terminal = self._terminal_record(value, end)
        except BackendError as error:
            if error.code != "TERMINAL_STATE_UNAVAILABLE":
                raise
            self._put({"kind": "NATIVE_ABSENCE_POLICY_UNAVAILABLE", "run": self.spec.run,
                "scope_ref": self.spec.scope_ref, "binding_ref": binding_ref,
                "protection_capture_ref": capture_ref,
                "protection_before_ref": self._put_perimeter_observation(before),
                "reason": error.code, "started_ns": started, "finished_ns": self.clock()})
            return None
        after = self.perimeter.revalidate(capture, binding, end * 1000)
        self._manager(end)
        self.backend._check(end)
        self.budget.end(end)
        finished = self.clock()
        valid_from = capture["finished_ns"]
        valid_until = min(self.budget.lease, self.spec.cleanup_deadline_us) * 1000
        if not valid_from <= started <= finished < min(end * 1000, valid_until):
            raise ValueError("Original sole-mutator protection interval expired")
        before_ref, after_ref = self._put_perimeter_observation(before), self._put_perimeter_observation(after)
        source_ref = self._put({"kind": "NATIVE_ABSENCE_POLICY", "run": self.spec.run,
            "scope_ref": self.spec.scope_ref, "policy_id": "sole-mutator-protected-cgroup-v1",
            "binding_ref": binding_ref, "original_core_binding": _NativeCgroupPerimeter._data(binding),
            "protection_capture_ref": capture_ref,
            "protection_before_ref": before_ref, "protection_after_ref": after_ref, **terminal,
            "cleanup_irreversible": True, "exclusions": ["rename", "replacement", "migration"],
            "valid_from_ns": valid_from, "valid_until_ns": valid_until,
            "started_ns": started, "finished_ns": finished})
        return self.physical.AbsencePolicy("sole-mutator-protected-cgroup-v1", source_ref,
            binding_ref, frozenset({"rename", "replacement", "migration"}), valid_from, valid_until)

    def keeper_observation(self, generation, deadline_ns):
        expected = C.validate_process_generation(generation)
        deadline = self._deadline(deadline_ns)
        end = self.budget.begin(deadline)
        before = self.clock()
        manager = self._manager(end)
        matches = [state for state in self.backend.slots if state.generation == expected]
        if len(matches) != 1 or matches[0].binding is None:
            raise ValueError("Original registered keeper generation required")
        unit, state = self._slot(matches[0].binding)
        first = state.pin.released(self.budget, end)
        first_ref = self._put({"kind": "NATIVE_KEEPER_PIDFD_READ", "position": "before",
            "run": self.spec.run, "unit_binding": unit, "generation": expected,
            "observation": first, "observed_ns": self.clock()})
        if first["released"] or first["pid"] != expected["pid"]:
            raise ValueError("Original keeper is no longer live")
        self.identity.verify_workload(expected, self.backend.payload, unit["control_group"], end)
        last = state.pin.released(self.budget, end)
        last_ref = self._put({"kind": "NATIVE_KEEPER_PIDFD_READ", "position": "after",
            "run": self.spec.run, "unit_binding": unit, "generation": expected,
            "observation": last, "observed_ns": self.clock()})
        if last["released"] or last["pid"] != expected["pid"]:
            raise ValueError("Original keeper changed during observation")
        if self._manager(end) != manager or state.generation != expected:
            raise ValueError("Original keeper authority changed")
        self.backend._check(end)
        self.budget.end(end)
        finished = self.clock()
        source_ref = self._put({"kind": "NATIVE_KEEPER_OBSERVATION", "run": self.spec.run,
            "manager_binding": manager, "unit_binding": unit, "generation": expected,
            "pidfd_before": first, "pidfd_after": last, "started_ns": before,
            "pidfd_before_ref": first_ref, "pidfd_after_ref": last_ref,
            "finished_ns": finished})
        return self.physical.KeeperObservation(expected, before, finished, source_ref)

    def export_evidence(self):
        return {"fixture_only": False, "records": [
            {"ref": ref, "record": _decode(raw)} for ref, raw in self.records.items()]}


def create_native_physical_producer_factory(spec, *, backend, physical_module):
    """Pure child-local factory; native observations remain deferred to callbacks."""
    return _NativePhysicalProducerFactory(spec, backend, physical_module)


def _export_unavailable(result, *, delivery_attempted=False):
    """Lose export authority without losing samples, faults or INVALID."""
    if result.get("status") != "INVALID":
        result["status"] = "INCOMPLETE"
    result["certificate_verified"] = False
    result["missing_evidence"] = sorted(set(result.get("missing_evidence", [])) |
                                         {"EVIDENCE_EXPORT_UNAVAILABLE"})
    result["evidence_export"] = {"status": "UNAVAILABLE", "delivery_attempted": delivery_attempted}
    return result


def _export_retained_evidence(spec, store, result, evidence_sink):
    """Deliver the original full graph before wait/close, never a new FD/path.

    The trusted in-process sink must finish within deadline_us. Checks bracket
    it; this synchronous interface does not preempt a blocking sink. Its copy
    is provisional until the caller receives the CLI's final watchdog wait.
    """
    attempted = False
    try:
        if result.get("claimed_status") not in {"COMPLETE", "INCOMPLETE", "INVALID"}:
            raise ValueError("Received FINAL required")
        store._check()
        before = store.clock()
        record = store.read()
        if type(record) is not dict or record.get("run") != spec.run or type(record.get("final")) is not dict:
            raise ValueError("Original run record required")
        # Serialization makes an independent graph and also bounds the entire
        # delivery, including metadata, without truncation or an increased cap.
        summary = _decode(json.dumps(result, ensure_ascii=False, sort_keys=True,
                                     separators=(",", ":"), allow_nan=False).encode("utf-8"))
        after = store.clock()
        snapshot = {"retained_record": record, "coordinator_result": summary,
                    "provenance": {"phase": "POST_COORDINATOR_PRE_WATCHDOG_WAIT",
                        "run": spec.run,
                        "original_store_identity": {"dev": str(store.identity[0]), "inode": str(store.identity[1])},
                        "captured_before_us": str(before), "captured_after_us": str(after),
                        "cleanup_deadline_us": str(spec.cleanup_deadline_us),
                        "watchdog_wait_pending": True,
                        "stored_final_status_matches_coordinator_claim": record["final"].get("status") == result["claimed_status"],
                        "stored_final_status_matches_coordinator_status": record["final"].get("status") == result.get("status")}}
        raw = json.dumps(snapshot, ensure_ascii=False, sort_keys=True,
                         separators=(",", ":"), allow_nan=False).encode("utf-8")
        if not 0 < len(raw) <= STORE_LIMIT:
            raise ValueError("Full evidence export exceeds bound")
        store._check()
        matches_claim = snapshot["provenance"]["stored_final_status_matches_coordinator_claim"]
        attempted = True
        accepted = evidence_sink(snapshot, deadline_us=spec.cleanup_deadline_us)
        store._check()
        if accepted is not True:
            raise ValueError("Evidence export acknowledgement required")
        if not matches_claim:
            # Retain the delivered raw FINAL unchanged, but never certify a
            # different received FINAL from this store.
            if result.get("status") != "INVALID":
                result["status"] = "INCOMPLETE"
            result["certificate_verified"] = False
            result["missing_evidence"] = sorted(set(result.get("missing_evidence", [])) | {"STORED_FINAL_STATUS_MISMATCH"})
        result["evidence_export"] = {"status": "EXPORTED", "delivery_attempted": True,
                                     "phase": "POST_COORDINATOR_PRE_WATCHDOG_WAIT"}
    except Exception:
        _export_unavailable(result, delivery_attempted=attempted)
    return result


def _native_runtime_unchecked(spec, *, source_elf, resources, launch_state,
                              evidence_sink=None, abort_requested=None):
    """Future Linux execution path. No native API is executed on Windows."""
    if sys.platform != "linux" or not hasattr(os, "fork") or not hasattr(os, "pidfd_open"):
        return _incomplete("PLATFORM_LINUX")
    if os.geteuid() != 0 or signal.getsignal(signal.SIGCHLD) != signal.SIG_DFL:
        return _incomplete("CONTROL_AUTHORITY_OR_OWN_REAPER_UNAVAILABLE")
    if not isinstance(source_elf, str) or not os.path.isabs(source_elf):
        return _incomplete("PAYLOAD_SOURCE_REQUIRED")
    try:
        distribution_type = getattr(importlib.import_module(__package__ + ".payload_distribution"), "RuntimeDistribution")
        physical_module = importlib.import_module(__package__ + ".physical_cgroup")
        observer_type = getattr(physical_module, "RuntimePhysicalObserver")
    except (ImportError, AttributeError):
        return _incomplete("RUNTIME_ADAPTERS_MISSING")
    from .sd_bus_transport import Budget, SdBusTransport, process_generation, pin_process
    from .systemd_backend import SystemdBackend
    from .watchdog import serve
    if monotonic_us() >= spec.work_deadline_us:
        return _incomplete("DEADLINE")
    settlement_authority = NativeSettlementAuthority(spec)
    distribution = distribution_type(source_elf=source_elf, control_uid=os.geteuid(), settlement_authority=settlement_authority)
    payload = distribution.prepare(spec, min(spec.work_deadline_us, monotonic_us() + 1_000_000))
    distribution.verify(payload, min(spec.work_deadline_us, monotonic_us() + 1_000_000))
    payload_mapping = payload.to_mapping() if callable(getattr(payload, "to_mapping", None)) else payload
    endpoint = "/run/elogistix-memory-" + spec.run + "/watchdog.sock"
    # Precreate the retained result inode before fork. An existing path is an error.
    directory_fd = os.open("/run/elogistix-memory-" + spec.run, os.O_DIRECTORY | os.O_CLOEXEC | os.O_NOFOLLOW)
    directory_owner = _OwnedFd(directory_fd)
    resources.append(directory_owner)
    directory_st = os.fstat(directory_fd)
    if directory_st.st_uid != 0 or directory_st.st_mode & 0o022:
        directory_owner.close()
        return _incomplete("AUTHENTICATION")
    try:
        result_fd = os.open("final-evidence.json", os.O_RDWR | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW | os.O_CLOEXEC, 0o600, dir_fd=directory_fd)
    finally:
        directory_owner.close()
    resources.append(_OwnedFd(result_fd))
    store = RetainedEvidenceStore(result_fd, clock_us=monotonic_us, deadline_us=spec.cleanup_deadline_us, native_custody=True)
    left, right = socket.socketpair(socket.AF_UNIX, socket.SOCK_SEQPACKET)
    resources.extend((left, right))
    coordinator_generation = process_generation(os.getpid())
    budget = Budget(monotonic_us, spec.cleanup_deadline_us)
    coordinator_pin = pin_process(coordinator_generation, budget, min(spec.work_deadline_us, monotonic_us() + 1_000_000))
    resources.append(coordinator_pin)
    child = os.fork()
    if child == 0:
        left.close()
        try:
            os.setsid()
            generation = process_generation(os.getpid())
            # SO_PEERCRED must identify this watchdog. Socket creation in the
            # parent would keep the parent's credentials after fork.
            listener = _watchdog_listener(distribution, endpoint)
            transport = SdBusTransport(authority_lease_until_us=spec.cleanup_deadline_us)
            backend = SystemdBackend(transport, spec, keeper_listener_path=endpoint,
                                     watchdog_generation=generation, payload_binding=payload_mapping)
            settlement_authority.attach_once(backend)
            try:
                producer_factory = create_native_physical_producer_factory(
                    spec, backend=backend, physical_module=physical_module)
                observer = create_runtime_observer(spec, observer_type=observer_type,
                                                   producer_factory=producer_factory)
                serve(right, spec, backend=backend, distribution=distribution, observer=observer,
                      coordinator_generation=coordinator_generation, coordinator_pidfd=coordinator_pin.fd,
                      keeper_listener=listener, keeper_listener_path=endpoint, result_sink=store)
            finally:
                backend.close()
                listener.close()
            os._exit(0)
        except BaseException:
            # If the child crashes, immutable manager timers remain only backup.
            # The coordinator cannot turn this branch into a cleanup certificate.
            os._exit(3)
    launch_state["child_pid"] = child
    right.close()
    coordinator_pin.close()
    retained = None
    try:
        generation = process_generation(child)
        retained = pin_process(generation, budget, min(spec.work_deadline_us, monotonic_us() + 1_000_000))
        resources.append(retained)
        pin = _OriginalPin(retained, monotonic_us, spec.cleanup_deadline_us)
        custody = _ForkCustody(left, pin, parent_pid=os.getpid(), child_pid=child)
        channel = PrivateSocketChannel(left, pin, bootstrap=custody)
        coordinator_kwargs = {"final_verifier": StoredFinalVerifier(store)}
        if abort_requested is not None:
            coordinator_kwargs["abort_requested"] = abort_requested
        result = Coordinator(spec, channel, **coordinator_kwargs).run().to_mapping()
        launch_state["coordinator_result"] = result
        if evidence_sink is not None:
            _export_retained_evidence(spec, store, result, evidence_sink)
        # Consume an actual own-child wait if already exited; never call pending reaped.
        returned_pid, raw_status = os.waitpid(child, os.WNOHANG)
        poller = select.poll()
        poller.register(retained.fd, select.POLLIN | select.POLLERR | select.POLLHUP)
        while returned_pid == 0 and monotonic_us() < spec.cleanup_deadline_us:
            poller.poll(max(1, min(50, (spec.cleanup_deadline_us - monotonic_us()) // 1000)))
            returned_pid, raw_status = os.waitpid(child, os.WNOHANG)
        result["watchdog_wait"] = {"requested_pid": child, "returned_pid": returned_pid,
                                   "raw_wait_status": raw_status if returned_pid == child else None,
                                   "consumed": returned_pid == child}
        launch_state["wait_consumed"] = returned_pid == child
        if returned_pid != child or not os.WIFEXITED(raw_status) or os.WEXITSTATUS(raw_status) != 0 or monotonic_us() >= spec.cleanup_deadline_us:
            if result.get("status") != "INVALID":
                result["status"] = "INCOMPLETE"
            result["certificate_verified"] = False
            result["missing_evidence"] = sorted(set(result["missing_evidence"]) | {"WATCHDOG_WAIT"})
        return result
    finally:
        left.close()
        if retained is not None:
            retained.close()


def _native_runtime(spec, *, source_elf=None, evidence_sink=None, abort_requested=None):
    resources, launch_state = [], {}
    try:
        result = _native_runtime_unchecked(spec, source_elf=source_elf, resources=resources, launch_state=launch_state,
                                          evidence_sink=evidence_sink, abort_requested=abort_requested)
        if evidence_sink is not None and "evidence_export" not in result:
            _export_unavailable(result)
        return result
    except Exception:
        # A post-FINAL wait/close failure must not erase already observed
        # samples/faults, INVALID, or an acknowledged pre-wait export.
        result = launch_state.get("coordinator_result")
        if type(result) is dict:
            if result.get("status") != "INVALID":
                result["status"] = "INCOMPLETE"
            result["certificate_verified"] = False
            result["missing_evidence"] = sorted(set(result.get("missing_evidence", [])) | {"WATCHDOG_WAIT"})
        else:
            result = _incomplete("BOOTSTRAP_OR_RUNTIME_IDENTITY_UNAVAILABLE")
        child = launch_state.get("child_pid")
        if child is not None and not launch_state.get("wait_consumed"):
            try:
                returned, status = os.waitpid(child, os.WNOHANG)
                result["watchdog_wait"] = {"requested_pid": child, "returned_pid": returned,
                                           "raw_wait_status": status if returned == child else None,
                                           "consumed": returned == child}
            except OSError:
                result["watchdog_wait"] = {"requested_pid": child, "consumed": False, "unavailable": True}
        result["staging_cleanup"] = "NOT_CERTIFIED"
        if evidence_sink is not None and "evidence_export" not in result:
            _export_unavailable(result)
        return result
    finally:
        for resource in reversed(resources):
            try:
                resource.close()
            except OSError:
                pass


def main(argv=None, *, preflight_fn=preflight, run_fn=None, evidence_sink=None, abort_requested=None):
    """Public invocation API; optional hooks confer no native authority.

    evidence_sink(snapshot, *, deadline_us) must return exactly True. The
    snapshot contains the full retained record and a provisional summary.
    abort_requested() must return an exact bool; unknown means cleanup.
    Both hooks are trusted, bounded, synchronous caller operations.
    """
    parser = _Parser(add_help=False)
    parser.add_argument("command", choices=("preflight", "run"))
    parser.add_argument("--spec", required=True)
    parser.add_argument("--source-elf")
    try:
        if any(hook is not None and not callable(hook) for hook in (evidence_sink, abort_requested)):
            raise ValueError("Callable invocation hooks required")
        args = parser.parse_args(argv)
        if args.command == "preflight" and args.source_elf is not None:
            raise ValueError("Source ELF belongs to run")
        with open(args.spec, "rb") as stream:
            raw = stream.read(C.MAX_PACKET_BYTES + 1)
        if len(raw) > C.MAX_PACKET_BYTES:
            raise ValueError("Spec exceeds bound")
        spec = C.RunSpec.from_mapping(_decode(raw))
    except (ValueError, OSError, UnicodeError, RecursionError):
        print(json.dumps({"status": "INVALID", "error": "INVALID_CLI_OR_SPEC"}))
        return 2
    try:
        inspected = preflight_fn(spec)
        inspected = inspected.to_mapping() if hasattr(inspected, "to_mapping") else inspected
        if args.command == "preflight":
            print(json.dumps(inspected, sort_keys=True))
            return 0 if inspected.get("passed") is True else 3
        if inspected.get("passed") is not True:
            result = _incomplete("PREFLIGHT", preflight_result=inspected)
        elif run_fn is not None:
            result = run_fn(spec)
            result = result.to_mapping() if hasattr(result, "to_mapping") else result
            result = dict(result, mode="hermetic")
        elif preflight_fn is not preflight:
            result = _incomplete("INJECTED_PREFLIGHT_CANNOT_AUTHORIZE_RUNTIME", mode="hermetic")
        else:
            result = _native_runtime(spec, source_elf=args.source_elf,
                                     evidence_sink=evidence_sink, abort_requested=abort_requested)
        if evidence_sink is not None and "evidence_export" not in result:
            _export_unavailable(result)
        print(json.dumps(result, sort_keys=True))
        return 0 if result.get("status") == "COMPLETE" else 3
    except (ValueError, OSError, RuntimeError, TypeError, KeyError, AttributeError):
        result = _incomplete("RUNTIME_DEPENDENCY_OR_IDENTITY_UNAVAILABLE")
        if evidence_sink is not None:
            _export_unavailable(result)
        print(json.dumps(result, sort_keys=True))
        return 3


if __name__ == "__main__":
    # python -m must use the same nominal classes as deferred sibling imports.
    # Importing the canonical module does not execute its guarded CLI branch.
    raise SystemExit(importlib.import_module(__package__ + ".__main__").main())
