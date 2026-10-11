"""Hermetic native-perimeter regressions; no kernel, bus or services execute.

The real component walk and permission checks run against a virtual filesystem.
Every native observation is explicitly a fixture; these tests certify no runtime.
"""
import copy
from contextlib import ExitStack
from dataclasses import replace
import errno
import importlib
from pathlib import Path
import stat
import sys
from types import SimpleNamespace
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
sys.path.insert(0, str(Path(__file__).resolve().parent))
import test_backend_faults as F

M = importlib.import_module("systemd_memory_runtime.__main__")
P = importlib.import_module("systemd_memory_runtime.physical_cgroup")
W = importlib.import_module("systemd_memory_runtime.watchdog")
B, T, C = F.B, F.T, F.K


class VirtualFilesystem:
    """Closed FD/path table. All opens and closes stay inside this fixture."""
    ROOT = "/sys/fs/cgroup"

    def __init__(self, name):
        self.parent = self.ROOT + "/system.slice"
        self.leaf = self.parent + "/" + name
        self.entries, self.nodes, self.handles = {}, {}, {}
        self.opened, self.closed, self.open_calls = [], [], []
        self.errors, self.acls, self.fdinfo = {}, {}, {}
        self.stat_hook = self.open_hook = self.acl_hook = None
        self.stat_counts = {}
        for index, path in enumerate(("/", "/sys", "/sys/fs", self.ROOT, self.parent, self.leaf)):
            self.entries[path] = dict(st_dev=2, st_ino=100 + index, st_uid=0,
                st_gid=0, st_mode=stat.S_IFDIR | 0o755, st_nlink=2)
            self.nodes[path] = P.NodeIdentity(2, 100 + index, 11, P.CGROUP2_SUPER_MAGIC, 2)
        for index, directory in enumerate((self.ROOT, self.parent, self.leaf)):
            for offset, name in enumerate(("cgroup.procs", "cgroup.threads")):
                path = directory + "/" + name
                self.entries[path] = dict(st_dev=2, st_ino=500 + index * 2 + offset,
                    st_uid=0, st_gid=0, st_mode=stat.S_IFREG | 0o644, st_nlink=1)

    def open(self, name, flags, *, dir_fd=None):
        if dir_fd is None:
            if name != "/":
                raise AssertionError("Non-relative native open escaped virtual root")
            path = name
        else:
            if dir_fd not in self.handles or "/" in name or name in ("", ".", ".."):
                raise AssertionError("Invalid openat fixture request")
            path = self.handles[dir_fd].rstrip("/") + "/" + name
        self.open_calls.append((path, flags, dir_fd))
        if self.open_hook:
            self.open_hook(path)
        if path in self.errors:
            raise OSError(self.errors[path], "fixture open failure")
        if path not in self.entries:
            raise OSError(errno.ENOENT, "fixture name absent")
        fd = 1000 + len(self.opened)
        self.handles[fd] = path
        self.opened.append(fd)
        return fd

    def close(self, fd):
        if fd not in self.handles:
            raise AssertionError("Unknown or duplicate close")
        del self.handles[fd]
        self.closed.append(fd)

    def fstat(self, fd):
        path = self.handles[fd]
        self.stat_counts[path] = self.stat_counts.get(path, 0) + 1
        if self.stat_hook:
            self.stat_hook(path, self.stat_counts[path])
        return SimpleNamespace(**self.entries[path])

    def identity(self, fd, deadline_ns):
        return self.nodes[self.handles[fd]]

    def getxattr(self, fd, name):
        if name != "system.posix_acl_access":
            raise AssertionError("Unexpected xattr")
        path = self.handles[fd]
        if self.acl_hook:
            self.acl_hook(path)
        value = self.acls.get(path, errno.ENODATA)
        if type(value) is int:
            raise OSError(value, "fixture ACL observation")
        return value

    def proc_read(self, path, cap, deadline_ns):
        prefix = "/proc/thread-self/fdinfo/"
        if not path.startswith(prefix) or cap != 8192:
            raise AssertionError("Unexpected or unbounded procfs read")
        fd = int(path[len(prefix):])
        return self.fdinfo.get(self.handles[fd], b"mnt_id:\t11\n")


class NativePerimeterTests(unittest.TestCase):
    def setUp(self):
        self.stack = ExitStack()
        self.addCleanup(self.stack.close)
        self.now_ns = 1_000_000_000
        self.spec = C.RunSpec.from_mapping({**F.spec().to_mapping(),
            "scope_ref": M._NativeCgroupPerimeter.SCOPE})
        self.tree = VirtualFilesystem(F.NAMES[0])
        self.mount = P.CgroupMount(11, 1, "0:2", "/", "/sys/fs/cgroup", "rw", (), "cgroup2", "rw")
        self.context = P.MountContext(F.BOOT, 1, 2, (self.mount,))
        self.context_values = []
        self.context_deadlines = []
        self.manager = {"boot_id": F.BOOT, "bus_guid": "b" * 32,
            "owner_unique_name": ":1.2", "manager_pid_generation": {**F.WATCHDOG,
            "pid": 1, "start_ticks": "10"}, "authority_lease_until_us": "60000000"}
        self.unit = {"slot": 0, "name": F.NAMES[0], "object_path": T.unit_path(F.NAMES[0]),
            "invocation_id": "d" * 32, "manager_binding_ref": C.digest_record(self.manager),
            "control_group": "/system.slice/" + F.NAMES[0], "control_group_id": "1234",
            "keeper_generation_ref": C.digest_record(F.KEEPER)}
        self.backend = B.SystemdBackend.__new__(B.SystemdBackend)
        self.backend.spec = self.spec
        self.backend.transport = SimpleNamespace(invalid=None)
        self.backend.identity = B._NativeIdentity.__new__(B._NativeIdentity)
        self.backend.budget = T.Budget(lambda: self.now_ns // 1000, 60_000_000)
        self.backend.watchdog_generation = copy.deepcopy(F.WATCHDOG)
        self.backend.payload = copy.deepcopy(F.PAYLOAD)
        self.backend.closed, self.backend.invalid = False, None
        self.backend.test_boundary = True
        self.backend.ready = SimpleNamespace(manager_binding=copy.deepcopy(self.manager))
        pin = T.ProcessPin.__new__(T.ProcessPin)
        pin.generation, pin.closed = copy.deepcopy(F.KEEPER), False
        self.pin = pin
        self.state = SimpleNamespace(binding=copy.deepcopy(self.unit),
            generation=copy.deepcopy(F.KEEPER), pin=pin)
        self.backend.slots = [self.state, None, None]
        self.snapshot = {"object_path": self.unit["object_path"], "unit": {
            "Id": F.NAMES[0], "InvocationID": "d" * 32, "ActiveState": "active",
            "SubState": "running", "Job": (0, "/"), "Transient": True}, "service": {
            "MainPID": 33, "ControlPID": 0, "ControlGroup": self.unit["control_group"],
            "ControlGroupId": 1234, "User": "1001", "Group": "1001",
            "SupplementaryGroups": ["1001"], "NoNewPrivileges": True,
            "AmbientCapabilities": 0, "Restart": "no", "KillMode": "control-group"}}
        self.snapshot_values = []
        self.credentials = {"uids": (1001,) * 4, "gids": (1001,) * 4,
            "groups": (1001,), "no_new_privs": True,
            "cap_eff": 0, "cap_perm": 0, "cap_inh": 0, "cap_amb": 0}
        self.credentials_values, self.release_values, self.generation_values = [], [], []
        self.delegation = {"original_unit_binding": copy.deepcopy(self.unit),
            "current_manager_before": copy.deepcopy(self.manager),
            "current_manager_after": copy.deepcopy(self.manager), "properties": {"Delegate": False},
            "before_us": "1000000", "after_us": "1000000"}
        self.stack.enter_context(patch.object(M.sys, "platform", "linux"))
        self.stack.enter_context(patch.object(M.time, "monotonic_ns", side_effect=lambda: self.now_ns))
        # Windows has no Linux open flags/getxattr. Fixture values never reach a syscall.
        for name, value in (("O_DIRECTORY", 0x10000), ("O_CLOEXEC", 0x80000),
                ("O_NOFOLLOW", 0x20000), ("O_NONBLOCK", 0x800)):
            self.stack.enter_context(patch.object(M.os, name, value, create=True))
        self.stack.enter_context(patch.object(M.os, "open", side_effect=self.tree.open))
        self.stack.enter_context(patch.object(M.os, "close", side_effect=self.tree.close))
        self.stack.enter_context(patch.object(M.os, "fstat", side_effect=self.tree.fstat))
        self.stack.enter_context(patch.object(M.os, "getxattr", side_effect=self.tree.getxattr, create=True))
        self.native_forbidden = []
        for name in ("read", "write", "pwrite", "ftruncate", "chmod", "fchmod", "chown",
                "fchown", "mkdir", "unlink", "rmdir", "rename", "kill", "setns"):
            mock = self.stack.enter_context(patch.object(M.os, name,
                side_effect=AssertionError("Native operation forbidden: " + name), create=True))
            self.native_forbidden.append(mock)
        self.stack.enter_context(patch.object(T.C, "CDLL", side_effect=AssertionError("Native library forbidden")))
        self.stack.enter_context(patch.object(P.LinuxFilesystem, "identity",
            autospec=True, side_effect=lambda _fs, fd, deadline: self.tree.identity(fd, deadline)))
        self.stack.enter_context(patch.object(P.LinuxFilesystem, "context",
            autospec=True, side_effect=self._context_fixture))
        self.stack.enter_context(patch.object(P.LinuxFilesystem, "_proc_read",
            autospec=True, side_effect=lambda _fs, path, cap, deadline: self.tree.proc_read(path, cap, deadline)))
        self.current_generation = self.stack.enter_context(patch.object(B._NativeIdentity, "current_generation",
            autospec=True, side_effect=lambda _identity: copy.deepcopy(F.WATCHDOG)))
        self.workload = self.stack.enter_context(patch.object(B._NativeIdentity,
            "verify_workload", autospec=True))
        self.stack.enter_context(patch.object(B.SystemdBackend, "_snapshot",
            autospec=True, side_effect=self._snapshot_fixture))
        self.delegate_call = self.stack.enter_context(patch.object(B.SystemdBackend,
            "delegation_observation", autospec=True, side_effect=lambda *_: copy.deepcopy(self.delegation)))
        self.stack.enter_context(patch.object(T.ProcessPin, "released",
            autospec=True, side_effect=self._release_fixture))
        self.stack.enter_context(patch.object(T, "process_generation", side_effect=self._generation_fixture))
        self.stack.enter_context(patch.object(W, "_credentials", side_effect=self._credentials_fixture))
        self.perimeter = M._NativeCgroupPerimeter(self.spec, self.backend, P)
        self.addCleanup(self._assert_hermetic)

    def _context_fixture(self, _fs, cap, deadline):
        self.assertEqual(cap, 131072)
        self.context_deadlines.append(deadline)
        return self.context_values.pop(0) if self.context_values else self.context

    def _snapshot_fixture(self, _backend, slot, deadline):
        self.assertEqual(slot, self.unit["slot"])
        return copy.deepcopy(self.snapshot_values.pop(0) if self.snapshot_values else self.snapshot)

    def _release_fixture(self, _pin, _budget, deadline):
        default = {"kind": "PIDFD_TASK_RELEASED", "generation_ref": C.digest_record(F.KEEPER),
            "pid": 33, "released": False, "observed_us": str(self.now_ns // 1000),
            "procfs_identity": [3, 4]}
        return copy.deepcopy(self.release_values.pop(0) if self.release_values else default)

    def _generation_fixture(self, pid):
        self.assertEqual(pid, 33)
        return copy.deepcopy(self.generation_values.pop(0) if self.generation_values else F.KEEPER)

    def _credentials_fixture(self, pid):
        self.assertEqual(pid, 33)
        return copy.deepcopy(self.credentials_values.pop(0) if self.credentials_values else self.credentials)

    def _assert_hermetic(self):
        self.assertFalse(self.tree.handles, "An owned fixture descriptor leaked")
        self.assertCountEqual(self.tree.opened, self.tree.closed)
        for mock in self.native_forbidden:
            mock.assert_not_called()

    def capture(self, deadline_ns=50_000_000_000):
        return self.perimeter.capture(self.unit, deadline_ns)

    def new_capture_fixture(self):
        """An independent capture experiment, never a retry on one-shot state."""
        self.perimeter = M._NativeCgroupPerimeter(self.spec, self.backend, P)

    def binding(self):
        manager = P.ManagerIdentity(self.spec.run, 0, ":1.2", "b" * 32, F.NAMES[0],
            "d" * 32, self.unit["control_group"], 1234, C.digest_record(self.unit), "fixture:manager")
        return P.Binding(manager, self.context, self.mount, self.tree.nodes[self.tree.leaf],
            self.tree.nodes[self.tree.parent], self.tree.parent, F.NAMES[0])

    def observation_counts(self):
        return (self.current_generation.call_count, self.workload.call_count,
            self.delegate_call.call_count, len(self.context_deadlines), len(self.tree.open_calls))

    def test_constructor_is_pure_and_scope_is_explicit(self):
        M._NativeCgroupPerimeter(self.spec, self.backend, P)
        wrong = C.RunSpec.from_mapping({**self.spec.to_mapping(), "scope_ref": "scope:other"})
        with self.assertRaisesRegex(ValueError, "operator pilot scope"):
            M._NativeCgroupPerimeter(wrong, self.backend, P)
        self.assertFalse(self.tree.open_calls)
        self.assertFalse(self.context_deadlines)
        self.workload.assert_not_called()
        self.delegate_call.assert_not_called()

    def test_capture_records_assumptions_and_brackets_actual_keeper(self):
        record = self.capture()
        self.assertEqual(record["kind"], "NATIVE_CGROUP_PERIMETER")
        self.assertEqual(record["phase"], "CAPTURE")
        self.assertEqual(record["unit_binding"], self.unit)
        self.assertEqual(record["operator_assumptions"],
            ["PID1_AND_CONTROL_TRUSTED", "NO_PRIVILEGED_EXTERNAL_ACTOR",
             "NO_EXTERNAL_CGROUP_ADMINISTRATIVE_MUTATOR"])
        self.assertIs(record["kernel_global_exclusion_proven"], False)
        self.assertEqual(record["leaf_metadata_origin"], "OBSERVED_NAMED")
        self.assertEqual(record["detached_proof"], "REQUIRED_FROM_CORE")
        self.assertEqual(record["delegate_observation"], self.delegation)
        self.assertEqual(record["keeper_capture"]["generation"], F.KEEPER)
        self.assertEqual(record["keeper_after"]["credentials"], record["keeper_capture"]["credentials"])
        self.assertEqual([group["path"] for group in record["ancestors"]], ["/", "/system.slice"])
        self.assertEqual(set(record["leaf"]["membership"]), {"cgroup.procs", "cgroup.threads"})
        self.assertNotIn("Delegate", record["effective_properties"])

    def test_every_component_is_nofollow_and_all_opens_are_read_only(self):
        self.capture()
        for path, flags, dir_fd in self.tree.open_calls:
            self.assertTrue(flags & M.os.O_NOFOLLOW, path)
            self.assertTrue(flags & M.os.O_CLOEXEC, path)
            self.assertFalse(flags & (M.os.O_WRONLY | M.os.O_RDWR | M.os.O_CREAT | M.os.O_TRUNC), path)
            if path.endswith(("cgroup.procs", "cgroup.threads")):
                self.assertTrue(flags & M.os.O_NONBLOCK, path)
            else:
                self.assertTrue(flags & M.os.O_DIRECTORY, path)
            self.assertEqual(dir_fd is None, path == "/")

    def test_symlink_error_at_root_parent_leaf_or_membership_is_fatal(self):
        for path in ("/sys", self.tree.ROOT, self.tree.parent, self.tree.leaf,
                self.tree.leaf + "/cgroup.procs"):
            with self.subTest(path=path):
                self.new_capture_fixture()
                self.tree.errors[path] = errno.ELOOP
                with self.assertRaises(OSError) as error:
                    self.capture()
                self.assertEqual(error.exception.errno, errno.ELOOP)
                self.assertFalse(self.tree.handles)
                self.tree.errors.clear()

    def test_acl_absent_unsupported_and_empty_are_distinct_allowed_observations(self):
        path = self.tree.leaf + "/cgroup.threads"
        for raw, status in ((errno.ENODATA, "ABSENT"), (errno.EOPNOTSUPP, "NOT_SUPPORTED"), (b"", "EMPTY")):
            with self.subTest(status=status):
                self.new_capture_fixture()
                self.tree.acls[path] = raw
                record = self.capture()
                self.assertEqual(record["leaf"]["membership"]["cgroup.threads"]["acl"]["status"], status)

    def test_nonempty_acl_cannot_be_treated_as_no_grants(self):
        for path in (self.tree.ROOT, self.tree.parent, self.tree.leaf + "/cgroup.procs"):
            with self.subTest(path=path):
                self.new_capture_fixture()
                self.tree.acls[path] = b"unparsed ACL containing possible grants"
                with self.assertRaisesRegex(ValueError, "ACL"):
                    self.capture()
                self.tree.acls.clear()

    def test_acl_permission_failure_is_unknown_and_fatal(self):
        self.tree.acls[self.tree.parent] = errno.EACCES
        with self.assertRaises(OSError) as error:
            self.capture()
        self.assertEqual(error.exception.errno, errno.EACCES)
        self.assertFalse(self.perimeter._captures)

    def test_owner_group_supplementary_and_other_write_permissions_rejected(self):
        self.spec = C.RunSpec.from_mapping({**self.spec.to_mapping(), "load_groups": [1001, 1002]})
        self.perimeter.spec = self.backend.spec = self.spec
        self.snapshot["service"]["SupplementaryGroups"] = ["1001", "1002"]
        self.credentials["groups"] = (1001, 1002)
        cases = ((1001, 0, 0o755), (0, 1001, 0o775), (0, 1002, 0o775), (0, 0, 0o777))
        for path in (self.tree.ROOT, self.tree.parent, self.tree.leaf + "/cgroup.threads"):
            original = self.tree.entries[path].copy()
            for uid, gid, mode in cases:
                with self.subTest(path=path, uid=uid, gid=gid, mode=mode):
                    self.new_capture_fixture()
                    self.tree.entries[path].update(st_uid=uid, st_gid=gid,
                        st_mode=stat.S_IFMT(original["st_mode"]) | mode)
                    with self.assertRaisesRegex(ValueError, "Load (can mutate|owner)"):
                        self.capture()
            self.tree.entries[path] = original

    def test_permission_class_is_selected_instead_of_union_of_mode_bits(self):
        # The load matches the group; other write bits do not grant that group write.
        self.tree.entries[self.tree.parent].update(st_uid=0, st_gid=1001,
            st_mode=stat.S_IFDIR | 0o757)
        self.capture()

    def test_load_ownership_is_rejected_even_without_write_permission(self):
        for path in (self.tree.ROOT, self.tree.parent, self.tree.leaf,
                self.tree.leaf + "/cgroup.procs", self.tree.parent + "/cgroup.threads"):
            with self.subTest(path=path):
                self.new_capture_fixture()
                original = self.tree.entries[path].copy()
                self.tree.entries[path].update(st_uid=1001,
                    st_mode=stat.S_IFMT(original["st_mode"]) | 0o555)
                with self.assertRaisesRegex(ValueError, "Load owner"):
                    self.capture()
                self.tree.entries[path] = original

    def test_permission_metadata_change_inside_acl_bracket_rejected(self):
        def change(path, count):
            if path == self.tree.parent and count == 2:
                self.tree.entries[path]["st_uid"] = 99
        self.tree.stat_hook = change
        with self.assertRaisesRegex(ValueError, "permissions changed"):
            self.capture()

    def test_membership_requires_regular_file_and_original_mount(self):
        path = self.tree.leaf + "/cgroup.procs"
        original = self.tree.entries[path].copy()
        for mutation, fdinfo in (({"st_mode": stat.S_IFDIR | 0o755}, b"mnt_id:\t11\n"),
                ({"st_dev": 9}, b"mnt_id:\t11\n"), ({}, b"mnt_id:\t12\n"),
                ({}, b"mnt_id: 11\nmnt_id: 11\n"), ({}, b"mnt_id: 0\n"), ({}, b"no mount identity\n")):
            with self.subTest(mutation=mutation, fdinfo=fdinfo):
                self.new_capture_fixture()
                self.tree.entries[path] = {**original, **mutation}
                self.tree.fdinfo[path] = fdinfo
                with self.assertRaises(ValueError):
                    self.capture()
        self.tree.entries[path] = original

    def test_directory_requires_cgroup2_positive_links_and_same_device_mount(self):
        original = self.tree.nodes[self.tree.parent]
        for change in ({"filesystem_magic": 1}, {"nlink": 0}, {"device": 9}, {"mount_id": 12}):
            with self.subTest(change=change):
                self.new_capture_fixture()
                self.tree.nodes[self.tree.parent] = replace(original, **change)
                with self.assertRaises(ValueError):
                    self.capture()

    def test_effective_unit_properties_have_closed_types_and_values(self):
        original = copy.deepcopy(self.snapshot["service"])
        cases = {"User": 1001, "Group": "1002", "NoNewPrivileges": 1,
            "AmbientCapabilities": False, "Restart": "always", "KillMode": "process",
            "SupplementaryGroups": [1001], "MainPID": 0}
        for key, value in cases.items():
            with self.subTest(key=key):
                self.new_capture_fixture()
                self.snapshot["service"] = {**original, key: value}
                with self.assertRaisesRegex(ValueError, "unit perimeter"):
                    self.capture()
        self.snapshot["service"] = original

    def test_missing_or_true_delegate_never_defaults_to_false(self):
        for properties in ({}, {"Delegate": True}, {"Delegate": 0}, {"Delegate": None}):
            with self.subTest(properties=properties):
                self.new_capture_fixture()
                self.delegation["properties"] = properties
                with self.assertRaisesRegex(ValueError, "non-delegation"):
                    self.capture()
                self.assertFalse(self.tree.open_calls)

    def test_delegation_requires_original_unit_manager_and_bounded_observation_times(self):
        original = copy.deepcopy(self.delegation)
        cases = ({"original_unit_binding": {**self.unit, "invocation_id": "f" * 32}},
            {"current_manager_before": {**self.manager, "owner_unique_name": ":1.8"}},
            {"current_manager_after": {**self.manager, "bus_guid": "f" * 32}},
            {"properties": {"Delegate": False, "InventedAuthority": True}},
            {"before_us": "1000001", "after_us": "1000000"},
            {"after_us": "1000001"}, {"unexpected": "fixture field"})
        for change in cases:
            with self.subTest(change=change):
                self.new_capture_fixture()
                self.delegation = {**original, **change}
                with self.assertRaisesRegex(ValueError, "non-delegation"):
                    self.capture()
                self.assertFalse(self.tree.open_calls)
        self.delegation = original

    def test_delegation_interval_cannot_precede_original_t0(self):
        spec = C.RunSpec.from_mapping({**self.spec.to_mapping(), "t0_us": "500000",
            "work_deadline_us": "50500000", "cleanup_deadline_us": "60500000"})
        self.perimeter.spec = self.backend.spec = spec
        self.delegation["before_us"] = "499999"
        with self.assertRaisesRegex(ValueError, "non-delegation"):
            self.capture()
        self.assertFalse(self.tree.open_calls)

    def test_missing_or_replaced_retained_pin_is_not_an_original_keeper(self):
        cases = (SimpleNamespace(generation=F.KEEPER, closed=False), None)
        for pin in cases:
            with self.subTest(pin=pin):
                self.new_capture_fixture()
                self.state.pin = pin
                with self.assertRaisesRegex(ValueError, "native bound keeper"):
                    self.capture()
        self.state.pin = self.pin
        self.new_capture_fixture()
        self.pin.closed = True
        with self.assertRaisesRegex(ValueError, "native bound keeper"):
            self.capture()
        self.pin.closed = False
        self.new_capture_fixture()
        self.pin.generation = {**F.KEEPER, "start_ticks": "96"}
        with self.assertRaisesRegex(ValueError, "native bound keeper"):
            self.capture()
        self.assertFalse(self.tree.open_calls)

    def test_actual_uid_gid_groups_nnp_or_capability_mismatch_rejected(self):
        original = self.credentials.copy()
        cases = {"uids": (1001, 1001, 1001, 0), "gids": (1001, 0, 1001, 1001),
            "groups": (1001, 27), "no_new_privs": False,
            "cap_eff": 1, "cap_perm": 1, "cap_inh": 1, "cap_amb": 1}
        for key, value in cases.items():
            with self.subTest(key=key):
                self.new_capture_fixture()
                self.credentials = {**original, key: value}
                with self.assertRaisesRegex(ValueError, "credentials"):
                    self.capture()
                self.assertFalse(self.tree.open_calls)
        self.credentials = original

    def test_released_or_wrong_pid_pin_and_generation_change_fail_capture(self):
        for value in ({"released": True, "pid": 33}, {"released": False, "pid": 99}):
            with self.subTest(value=value):
                self.new_capture_fixture()
                self.release_values = [value]
                with self.assertRaisesRegex(ValueError, "live keeper generation"):
                    self.capture()
        self.new_capture_fixture()
        self.generation_values = [{**F.KEEPER, "start_ticks": "96"}]
        with self.assertRaisesRegex(ValueError, "live keeper generation"):
            self.capture()
        self.assertFalse(self.tree.open_calls)

    def test_pin_release_after_credentials_and_after_metadata_prevents_capture(self):
        live = {"released": False, "pid": 33}
        for index in (1, 3):
            with self.subTest(release_index=index):
                self.new_capture_fixture()
                self.release_values = [live] * index + [{"released": True, "pid": 33}]
                with self.assertRaisesRegex(ValueError, "generation changed"):
                    self.capture()
                self.assertFalse(self.perimeter._captures)

    def test_keeper_generation_changed_after_filesystem_capture_is_rejected(self):
        self.generation_values = [F.KEEPER, F.KEEPER, {**F.KEEPER, "start_ticks": "96"}]
        with self.assertRaisesRegex(ValueError, "live keeper generation"):
            self.capture()
        self.assertTrue(self.tree.open_calls)
        self.assertFalse(self.perimeter._captures)

    def test_credentials_are_checked_again_after_filesystem_capture(self):
        self.credentials_values = [self.credentials, {**self.credentials, "cap_eff": 1}]
        with self.assertRaisesRegex(ValueError, "credentials"):
            self.capture()
        self.assertTrue(self.tree.open_calls)
        self.assertFalse(self.perimeter._captures)

    def test_unit_or_context_changing_across_capture_fails(self):
        self.snapshot_values = [self.snapshot, {**self.snapshot, "service": {
            **self.snapshot["service"], "NoNewPrivileges": False}}]
        with self.assertRaises(ValueError):
            self.capture()
        self.snapshot_values = []
        self.new_capture_fixture()
        self.context_values = [self.context, replace(self.context, namespace_device=9)]
        with self.assertRaisesRegex(ValueError, "context or unit changed"):
            self.capture()
        self.assertFalse(self.perimeter._captures)

    def test_boot_namespace_mount_root_and_unique_mount_required(self):
        original = self.context
        cases = (replace(original, boot_id="22222222-2222-3333-4444-555555555555"),
            replace(original, namespace_inode=3), replace(original, mounts=()),
            replace(original, mounts=(self.mount, self.mount)),
            replace(original, mounts=(replace(self.mount, root="/delegated"),)))
        for context in cases:
            with self.subTest(context=context):
                self.new_capture_fixture()
                self.context = context
                with self.assertRaisesRegex(ValueError, "mount context"):
                    self.capture()
        self.context = original

    def test_present_revalidation_uses_original_normalized_context(self):
        captured, binding = self.capture(), self.binding()
        self.assertIsInstance(binding.context.mounts, tuple)
        result = self.perimeter.revalidate(captured, binding, 60_000_000_000)
        self.assertEqual(result["phase"], "REVALIDATE")
        self.assertEqual(result["context"], captured["context"])
        self.assertEqual(result["leaf_named_status"], "PRESENT")
        self.assertEqual(result["leaf_metadata_origin"], "OBSERVED_NAMED")

    def test_absent_leaf_keeps_historical_metadata_and_requires_core_detachment(self):
        captured, binding = self.capture(), self.binding()
        self.assertGreater(binding.leaf.nlink, 0)
        self.tree.errors[self.tree.leaf] = errno.ENOENT
        result = self.perimeter.revalidate(captured, binding, 60_000_000_000)
        self.assertEqual(result["leaf_named_status"], "ABSENT")
        self.assertEqual(result["leaf_lookup_errno"], errno.ENOENT)
        self.assertEqual(result["leaf_metadata_origin"], "CAPTURED_ORIGINAL")
        self.assertEqual(result["leaf"], captured["leaf"])
        self.assertGreater(result["leaf"]["node"]["nlink"], 0)
        self.assertEqual(result["detached_proof"], "REQUIRED_FROM_CORE")
        self.assertNotIn("populated", result)

    def test_absence_only_allowed_for_final_leaf_during_revalidation(self):
        captured, binding = self.capture(), self.binding()
        for path, number in ((self.tree.parent, errno.ENOENT), (self.tree.leaf, errno.EACCES)):
            with self.subTest(path=path, errno=number):
                self.tree.errors[path] = number
                with self.assertRaises(OSError) as error:
                    self.perimeter.revalidate(captured, binding, 60_000_000_000)
                self.assertEqual(error.exception.errno, number)
                self.tree.errors.clear()
        self.tree.errors[self.tree.leaf] = errno.ENOENT
        self.new_capture_fixture()
        with self.assertRaises(OSError):
            self.capture()

    def test_parent_permissions_changed_during_enoent_lookup_rejected(self):
        captured, binding = self.capture(), self.binding()
        self.tree.errors[self.tree.leaf] = errno.ENOENT
        reached = []
        def change_during_lookup(path):
            if path == self.tree.leaf:
                reached.append(path)
                self.tree.entries[self.tree.parent]["st_mode"] = stat.S_IFDIR | 0o777
        self.tree.open_hook = change_during_lookup
        with self.assertRaises(ValueError):
            self.perimeter.revalidate(captured, binding, 60_000_000_000)
        self.assertGreaterEqual(len(reached), 2)
        self.assertTrue(all(path == self.tree.leaf for path in reached))
        self.assertFalse(self.tree.handles)

    def test_original_ancestor_fds_remain_owned_across_leaf_lookup_and_reread(self):
        retained = []
        def at_lookup(path):
            if path != self.tree.leaf:
                return
            original_fds = {name: [fd for fd, named in self.tree.handles.items() if named == name]
                for name in (self.tree.ROOT, self.tree.parent)}
            for fds in original_fds.values():
                self.assertTrue(fds, "Original ancestor descriptor was closed before leaf lookup")
            if retained:
                for name, fds in retained[0][0].items():
                    self.assertTrue(set(fds) <= set(original_fds[name]),
                        "Retained original descriptor was replaced during named lookup")
            retained.append((original_fds, {name: self.tree.stat_counts[name] for name in original_fds}))
        self.tree.open_hook = at_lookup
        self.capture()
        self.assertGreaterEqual(len(retained), 2)
        for name, count in retained[0][1].items():
            self.assertGreater(self.tree.stat_counts[name], count,
                "Original ancestor metadata was not read after leaf lookup")
        self.assertFalse(self.tree.handles)

    def test_walk_bracket_records_before_lookup_named_and_after_observations(self):
        captured = self.capture()
        for record in (captured, self.perimeter.revalidate(captured, self.binding(), 60_000_000_000)):
            with self.subTest(phase=record["phase"]):
                bracket = record["walk_bracket"]
                self.assertEqual(set(bracket), {"started_ns", "finished_ns", "before",
                    "leaf_lookup", "named_after", "after", "observed_groups"})
                self.assertEqual(bracket["leaf_lookup"]["status"], "PRESENT")
                self.assertIsNone(bracket["leaf_lookup"]["errno"])
                groups = bracket["observed_groups"]
                for reference, group in groups.items():
                    self.assertEqual(reference, self.perimeter._digest(group))
                before = {groups[item["group_ref"]]["path"]: item for item in bracket["before"]}
                after = {groups[item["group_ref"]]["path"]: item for item in bracket["after"]}
                self.assertEqual(set(before), set(after))
                self.assertTrue({"/", "/system.slice"} <= set(before))
                named = {item["path"]: item for item in bracket["named_after"]}
                self.assertTrue({"/", "/system.slice"} <= set(named))
                for path in before:
                    self.assertEqual(groups[before[path]["group_ref"]], groups[after[path]["group_ref"]])
                for observation in bracket["before"] + bracket["named_after"] + bracket["after"] + [bracket["leaf_lookup"]]:
                    self.assertLessEqual(bracket["started_ns"], observation["started_ns"])
                    self.assertLessEqual(observation["started_ns"], observation["finished_ns"])
                    self.assertLessEqual(observation["finished_ns"], bracket["finished_ns"])
                self.assertLessEqual(bracket["finished_ns"], record["finished_ns"])

    def test_named_leaf_cannot_appear_between_absence_lookups(self):
        captured, binding = self.capture(), self.binding()
        self.tree.errors[self.tree.leaf] = errno.ENOENT
        lookups = []
        def switch_after_first_absence(path):
            if path == self.tree.leaf:
                lookups.append(path)
                if len(lookups) > 1:
                    self.tree.errors.pop(path, None)
        self.tree.open_hook = switch_after_first_absence
        with self.assertRaises(ValueError):
            self.perimeter.revalidate(captured, binding, 60_000_000_000)
        self.assertGreaterEqual(len(lookups), 2)

    def test_parent_acl_changed_during_enoent_lookup_rejected(self):
        captured, binding = self.capture(), self.binding()
        self.tree.errors[self.tree.leaf] = errno.ENOENT
        reached = []
        def change_during_lookup(path):
            if path == self.tree.leaf:
                reached.append(path)
                self.tree.acls[self.tree.parent] = b"new possible write grant"
        self.tree.open_hook = change_during_lookup
        with self.assertRaisesRegex(ValueError, "ACL"):
            self.perimeter.revalidate(captured, binding, 60_000_000_000)
        self.assertGreaterEqual(len(reached), 2)
        self.assertTrue(all(path == self.tree.leaf for path in reached))
        self.assertFalse(self.tree.handles)

    def test_parent_acl_status_change_after_lookup_is_not_a_stable_bracket(self):
        captured, binding = self.capture(), self.binding()
        self.tree.errors[self.tree.leaf] = errno.ENOENT
        self.tree.open_hook = lambda path: self.tree.acls.update(
            {self.tree.parent: b""}) if path == self.tree.leaf else None
        with self.assertRaises(ValueError):
            self.perimeter.revalidate(captured, binding, 60_000_000_000)

    def test_parent_membership_permissions_changed_during_enoent_are_reread(self):
        captured, binding = self.capture(), self.binding()
        self.tree.errors[self.tree.leaf] = errno.ENOENT
        membership = self.tree.parent + "/cgroup.threads"
        def change_during_lookup(path):
            if path == self.tree.leaf:
                self.tree.entries[membership]["st_mode"] = stat.S_IFREG | 0o666
        self.tree.open_hook = change_during_lookup
        with self.assertRaisesRegex(ValueError, "Load can mutate"):
            self.perimeter.revalidate(captured, binding, 60_000_000_000)

    def test_close_error_for_one_original_ancestor_still_closes_the_others(self):
        original_parent = []
        def identify_retained_parent(path):
            if path == self.tree.leaf and not original_parent:
                original_parent.extend(fd for fd, name in self.tree.handles.items()
                    if name == self.tree.parent)
        self.tree.open_hook = identify_retained_parent
        original_close = self.tree.close
        def close_with_reported_error(fd):
            original_close(fd)
            if original_parent and fd == original_parent[0]:
                raise OSError(errno.EIO, "fixture close outcome reported as failed")
        with patch.object(M.os, "close", side_effect=close_with_reported_error):
            with self.assertRaises(OSError) as error:
                self.capture()
        self.assertEqual(error.exception.errno, errno.EIO)
        self.assertFalse(self.tree.handles)
        self.assertFalse(self.perimeter._captures)

    def test_successful_capture_is_one_shot_before_any_new_observation(self):
        self.capture()
        counts = self.observation_counts()
        with self.assertRaises(ValueError):
            self.capture()
        self.assertEqual(self.observation_counts(), counts)
        self.assertEqual(len(self.perimeter._captures), 1)

    def test_failed_capture_consumes_slot_and_cannot_retry_observation(self):
        self.delegation["properties"] = {"Delegate": True}
        with self.assertRaisesRegex(ValueError, "non-delegation"):
            self.capture()
        self.delegation["properties"] = {"Delegate": False}
        counts = self.observation_counts()
        with self.assertRaises(ValueError):
            self.capture()
        self.assertEqual(self.observation_counts(), counts)
        self.assertFalse(self.perimeter._captures)

    def test_distinct_unit_reference_cannot_reopen_a_consumed_slot(self):
        self.capture()
        replacement = {**self.unit, "invocation_id": "f" * 32}
        self.state.binding = replacement
        self.unit = replacement
        self.snapshot["unit"]["InvocationID"] = replacement["invocation_id"]
        self.delegation["original_unit_binding"] = replacement
        counts = self.observation_counts()
        with self.assertRaises(ValueError):
            self.capture()
        self.assertEqual(self.observation_counts(), counts)
        self.assertEqual(len(self.perimeter._captures), 1)

    def test_three_fixed_slots_are_consumed_even_when_observation_fails(self):
        self.delegation["properties"] = {"Delegate": True}
        original = copy.deepcopy(self.unit)
        units = []
        for slot in range(3):
            self.unit = {**original, "slot": slot, "name": F.NAMES[slot],
                "object_path": T.unit_path(F.NAMES[slot]),
                "control_group": "/system.slice/" + F.NAMES[slot]}
            units.append(copy.deepcopy(self.unit))
            self.backend.slots[slot] = SimpleNamespace(binding=copy.deepcopy(self.unit),
                generation=copy.deepcopy(F.KEEPER), pin=self.pin)
            self.snapshot["object_path"] = self.unit["object_path"]
            self.snapshot["unit"]["Id"] = self.unit["name"]
            self.snapshot["service"]["ControlGroup"] = self.unit["control_group"]
            self.delegation["original_unit_binding"] = copy.deepcopy(self.unit)
            with self.subTest(slot=slot):
                with self.assertRaisesRegex(ValueError, "non-delegation"):
                    self.capture()
        self.assertEqual(self.delegate_call.call_count, 3)
        counts = self.observation_counts()
        for unit in units + [{**original, "slot": 3}]:
            with self.subTest(rejected_slot=unit["slot"]):
                with self.assertRaises(ValueError):
                    self.perimeter.capture(unit, 50_000_000_000)
                self.assertEqual(self.observation_counts(), counts)
        self.assertFalse(self.perimeter._captures)
        self.assertFalse(self.tree.open_calls)

    def test_many_distinct_references_for_consumed_slot_cannot_grow_capture_state(self):
        self.capture()
        counts = self.observation_counts()
        for index in range(64):
            unit = {**self.unit, "invocation_id": "%032x" % (index + 1)}
            with self.subTest(index=index):
                with self.assertRaises(ValueError):
                    self.perimeter.capture(unit, 50_000_000_000)
                self.assertEqual(self.observation_counts(), counts)
        self.assertEqual(len(self.perimeter._captures), 1)
        self.assertEqual(len(self.perimeter._capture_attempts), 1)
        self.assertEqual(len(self.perimeter._capture_slots), 1)

    def test_parent_root_or_leaf_replacement_rejected_even_with_same_permissions(self):
        captured, binding = self.capture(), self.binding()
        for path in (self.tree.ROOT, self.tree.parent, self.tree.leaf):
            with self.subTest(path=path):
                node, metadata = self.tree.nodes[path], self.tree.entries[path].copy()
                self.tree.nodes[path] = replace(node, inode=node.inode + 900)
                self.tree.entries[path]["st_ino"] += 900
                with self.assertRaisesRegex(ValueError, "identity or permissions"):
                    self.perimeter.revalidate(captured, binding, 60_000_000_000)
                self.tree.nodes[path], self.tree.entries[path] = node, metadata

    def test_changed_context_or_membership_permissions_rejected_at_cleanup(self):
        captured, binding = self.capture(), self.binding()
        self.context = replace(self.context, namespace_device=9)
        with self.assertRaisesRegex(ValueError, "context changed"):
            self.perimeter.revalidate(captured, binding, 60_000_000_000)
        self.context = binding.context
        self.tree.entries[self.tree.parent + "/cgroup.threads"]["st_uid"] = 77
        with self.assertRaisesRegex(ValueError, "identity or permissions"):
            self.perimeter.revalidate(captured, binding, 60_000_000_000)

    def test_cleanup_rechecks_context_after_walk(self):
        captured, binding = self.capture(), self.binding()
        self.context_values = [self.context, replace(self.context, namespace_device=9)]
        with self.assertRaisesRegex(ValueError, "identity or permissions"):
            self.perimeter.revalidate(captured, binding, 60_000_000_000)

    def test_nonidentity_link_and_byte_counters_may_change(self):
        captured, binding = self.capture(), self.binding()
        for path in (self.tree.ROOT, self.tree.parent, self.tree.leaf):
            self.tree.nodes[path] = replace(self.tree.nodes[path], nlink=3, bytes_read=88)
        result = self.perimeter.revalidate(captured, binding, 60_000_000_000)
        self.assertEqual(result["leaf_named_status"], "PRESENT")
        self.assertEqual(result["leaf"]["node"]["nlink"], 3)

    def test_capture_is_local_original_and_returned_records_do_not_mutate_registry(self):
        captured, binding = self.capture(), self.binding()
        edited = copy.deepcopy(captured)
        edited["leaf"]["metadata"]["uid"] = 9
        with self.assertRaisesRegex(ValueError, "locally captured"):
            self.perimeter.revalidate(edited, binding, 60_000_000_000)
        other = M._NativeCgroupPerimeter(self.spec, self.backend, P)
        with self.assertRaisesRegex(ValueError, "locally captured"):
            other.revalidate(captured, binding, 60_000_000_000)
        self.perimeter.revalidate(captured, binding, 60_000_000_000)

    def test_core_binding_must_match_context_parent_leaf_path_and_name(self):
        captured, binding = self.capture(), self.binding()
        cases = (replace(binding, context=replace(binding.context, namespace_device=9)),
            replace(binding, parent=replace(binding.parent, inode=999)),
            replace(binding, leaf=replace(binding.leaf, mount_id=99)),
            replace(binding, mount=replace(binding.mount, mount_id=99)),
            replace(binding, manager=replace(binding.manager, run_id="c" * 32)),
            replace(binding, manager=replace(binding.manager, slot_id=1)),
            replace(binding, manager=replace(binding.manager, manager_guid="f" * 32)),
            replace(binding, manager=replace(binding.manager, manager_owner=":1.99")),
            replace(binding, manager=replace(binding.manager, invocation_id="f" * 32)),
            replace(binding, manager=replace(binding.manager, unit_binding_ref="f" * 64)),
            replace(binding, manager=replace(binding.manager, unit=F.NAMES[1])),
            replace(binding, manager=replace(binding.manager, control_group="/foreign")),
            replace(binding, manager=replace(binding.manager, control_group_id=1235)),
            replace(binding, parent_path="/sys/fs/cgroup/foreign"),
            replace(binding, leaf_name="foreign.service"), SimpleNamespace(**vars(binding)))
        for bad in cases:
            with self.subTest(binding=bad):
                with self.assertRaisesRegex(ValueError, "physical binding changed"):
                    self.perimeter.revalidate(captured, bad, 60_000_000_000)

    def test_work_cleanup_and_authority_deadlines_cannot_be_extended(self):
        self.now_ns = 50_000_000_000
        with self.assertRaises(TimeoutError):
            self.capture(100_000_000_000)
        self.assertFalse(self.tree.open_calls)
        self.now_ns = 1_000_000_000
        self.new_capture_fixture()
        captured, binding = self.capture(100_000_000_000), self.binding()
        self.assertTrue(all(d == 50_000_000_000 for d in self.context_deadlines))
        self.now_ns = 60_000_000_000
        with self.assertRaises(TimeoutError):
            self.perimeter.revalidate(captured, binding, 100_000_000_000)
        self.now_ns = 20_000_000_000
        self.backend.budget.lease = 20_000_000
        self.new_capture_fixture()
        with self.assertRaises(TimeoutError):
            self.capture()

    def test_revalidation_after_work_cutoff_uses_original_cleanup_deadline(self):
        captured, binding = self.capture(), self.binding()
        self.now_ns = 55_000_000_000
        self.context_deadlines.clear()
        result = self.perimeter.revalidate(captured, binding, 100_000_000_000)
        self.assertEqual(result["leaf_named_status"], "PRESENT")
        self.assertTrue(self.context_deadlines)
        self.assertTrue(all(d == 60_000_000_000 for d in self.context_deadlines))
        self.assertEqual(result["started_ns"], 55_000_000_000)

    def test_earlier_caller_deadline_and_shorter_lease_are_forwarded_to_filesystem(self):
        self.capture(2_000_000_000)
        self.assertTrue(all(d == 2_000_000_000 for d in self.context_deadlines))
        self.context_deadlines.clear()
        self.backend.budget.lease = 3_000_000
        self.new_capture_fixture()
        self.capture()
        self.assertTrue(all(d == 3_000_000_000 for d in self.context_deadlines))

    def test_late_acl_observation_rejected_and_owned_fds_closed(self):
        def late(path):
            if path == self.tree.parent:
                self.now_ns = 50_000_000_000
        self.tree.acl_hook = late
        with self.assertRaises(TimeoutError):
            self.capture()
        self.assertFalse(self.perimeter._captures)

    def test_native_platform_and_deadline_types_fail_before_observation(self):
        with patch.object(M.sys, "platform", "win32"):
            with self.assertRaisesRegex(ValueError, "absolute deadline"):
                self.capture()
        for deadline in (True, 0, -1, "50000000000", C.U64_MAX * 1000 + 1):
            with self.subTest(deadline=deadline):
                self.new_capture_fixture()
                with self.assertRaises(ValueError):
                    self.capture(deadline)
        self.assertFalse(self.tree.open_calls)

    def test_noncanonical_or_unbounded_paths_rejected_before_walk(self):
        for path in ("/", "relative", "/a//b", "/a/../b", "/a/./b", "/a\\b",
                "/a\x00b", "/a\u2028b", "/" + "/".join("a" for _ in range(65)), "/" + "a" * 4096):
            with self.subTest(path=path):
                with self.assertRaises(ValueError):
                    self.perimeter._walk(path, self.context, self.mount, 50_000_000_000)
        self.assertFalse(self.tree.open_calls)


if __name__ == "__main__":
    unittest.main()
