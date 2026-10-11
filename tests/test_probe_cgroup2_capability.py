"""Hermetic stdlib tests for the separate, read-only cgroup v2 proposal."""
import importlib.util
import errno
from contextlib import redirect_stdout
import io
import json
import os
from pathlib import Path
import stat
import subprocess
from types import SimpleNamespace
import unittest
from unittest import mock


ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / "scripts/ci/probe-cgroup2-capability.py"
if not SCRIPT.is_file():
    SCRIPT = ROOT / "proposed/scripts/ci/probe-cgroup2-capability.py"
SPEC = importlib.util.spec_from_file_location("probe_cgroup2_capability", SCRIPT)
probe = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(probe)

MOUNT = "36 29 0:32 / /sys/fs/cgroup rw,nosuid,nodev,noexec,relatime - cgroup2 cgroup rw,nsdelegate\n"
META_KEYS = {"status", "modeOctal", "ownerMatchesEuid", "readable", "writable", "searchable"}
ROOT_KEYS = {"schemaVersion", "probe", "status", "host", "identity", "membership", "mount", "groups", "memoryPeak", "userManager", "assessment", "limits"}
PRIVATE = "private-secret-948257 /private/tenant/948257"


class FakeIO:
    def __init__(self):
        self.clock = 0.0
        self.calls = []
        self.system = {
            "/proc/self/cgroup": "0::/tenant/job\n",
            "/proc/self/mountinfo": MOUNT,
            "/etc/os-release": 'ID=ubuntu\nVERSION_ID="24.04"\n',
        }
        self.files = {}
        self.errors = {}
        self.metadata_value = {"status": "ok", "modeOctal": "0755", "ownerMatchesEuid": True, "readable": True, "writable": False, "searchable": True}
        self.marker = {"status": "unsupported", "value": None}
        self.manager = {"status": "unavailable", "nameOwned": None}

    def now(self):
        return self.clock

    def identity(self):
        return (1000, 1000)

    def kernel_release(self):
        return "6.8.0-1018-azure"

    def _read(self, key, value, limit):
        self.calls.append(("read", key, limit))
        if key in self.errors:
            raise self.errors[key]
        if len(value.encode("utf-8")) > limit:
            raise probe.ProbeError("oversize")
        return value

    def read_system_file(self, path, limit):
        return self._read(path, self.system[path], limit)

    def metadata(self, components, name):
        self.calls.append(("metadata", components, name))
        return dict(self.metadata_value)

    def read_cgroup_file(self, components, name, limit):
        defaults = {"cgroup.controllers": "cpu memory pids\n", "cgroup.subtree_control": "memory\n", "cgroup.type": "domain\n", "memory.peak": "49152\n"}
        key = (components, name)
        return self._read(key, self.files.get(key, defaults[name]), limit)

    def delegate_marker(self, components):
        self.calls.append(("delegate_marker", components))
        return dict(self.marker)

    def user_manager(self, euid):
        self.calls.append(("user_manager", euid))
        return dict(self.manager)

    def group_identity(self, components):
        self.calls.append(("group_identity", components))
        return (17, 41)


class ProbeTest(unittest.TestCase):
    def collect(self, io=None, values=None):
        io = io or FakeIO()
        requested = []
        def getenv(name):
            requested.append(name)
            return (values or {}).get(name)
        result = probe.collect_probe(io=io, getenv=getenv)
        self.assertTrue(set(requested).issubset({"ImageOS", "ImageVersion"}))
        return result

    def test_closed_structure_and_no_numeric_peak_or_private_paths(self):
        result = self.collect(values={"ImageOS": "ubuntu24", "ImageVersion": "20261010.1.0", "SECRET_TOKEN": PRIVATE})
        self.assertEqual(set(result), ROOT_KEYS)
        self.assertEqual(result["schemaVersion"], 1)
        self.assertEqual(result["probe"], "cgroup2-capability-read-only")
        self.assertEqual(result["status"], "observed")
        self.assertEqual(set(result["host"]), {"kernelRelease", "osId", "osVersionId", "pythonVersion", "imageOS", "imageVersion"})
        self.assertEqual(set(result["identity"]), {"uid", "euid"})
        self.assertEqual(set(result["membership"]), {"status", "depth", "stableAfterProbe"})
        self.assertEqual(set(result["mount"]), {"status", "filesystemType", "readOnly", "nsDelegate", "visibleRootDepth"})
        self.assertEqual(set(result["memoryPeak"]), {"exists", "readStatus", "numericValid"})
        self.assertEqual(result["memoryPeak"], {"exists": True, "readStatus": "ok", "numericValid": True})
        self.assertEqual(set(result["userManager"]), {"status", "nameOwned"})
        self.assertEqual(result["assessment"], {"writeAuthority": "not_tested", "isolation": "not_established", "delegation": "not_established_read_only"})
        self.assertEqual(set(result["limits"]), {"maxGroups", "truncated", "deadlineSeconds"})
        for group in result["groups"]:
            self.assertEqual(set(group), {"label", "directory", "files", "controllers", "subtreeControl", "type", "delegationMarker"})
            self.assertEqual(set(group["directory"]), META_KEYS)
            self.assertEqual(set(group["files"]), {"cgroup.procs", "cgroup.threads", "cgroup.subtree_control"})
            self.assertTrue(all(set(metadata) == META_KEYS for metadata in group["files"].values()))
            self.assertEqual(set(group["controllers"]), {"status", "values", "unknownPresent"})
            self.assertEqual(set(group["subtreeControl"]), {"status", "values", "unknownPresent"})
            self.assertEqual(set(group["type"]), {"status", "value"})
            self.assertEqual(set(group["delegationMarker"]), {"status", "value"})
        serialized = json.dumps(result)
        for private in (PRIVATE, "/sys/fs/cgroup", "/tenant/job", "49152"):
            self.assertNotIn(private, serialized)

    def test_read_allowlist_and_file_caps_without_reading_process_membership(self):
        io = FakeIO()
        self.collect(io)
        reads = [call for call in io.calls if call[0] == "read"]
        for _, target, limit in reads:
            if isinstance(target, str):
                self.assertIn(target, {"/proc/self/cgroup", "/proc/self/mountinfo", "/etc/os-release"})
                self.assertEqual(limit, 128 * 1024 if target == "/proc/self/mountinfo" else 4096)
            else:
                self.assertIn(target[1], {"cgroup.controllers", "cgroup.subtree_control", "cgroup.type", "memory.peak"})
                self.assertEqual(limit, 4096)
        peak_reads = [call for call in reads if isinstance(call[1], tuple) and call[1][1] == "memory.peak"]
        self.assertEqual(len(peak_reads), 1)
        self.assertEqual(peak_reads[0][1][0], ("tenant", "job"))
        self.assertEqual([group["label"] for group in self.collect()["groups"]], ["self", "parent-1", "parent-2"])

    def test_delegated_escaped_mount_root_maps_only_visible_hierarchy(self):
        io = FakeIO()
        io.system["/proc/self/cgroup"] = "0::/delegated space\\root/team\n"
        io.system["/proc/self/mountinfo"] = MOUNT.replace(" / /sys/fs/cgroup ", " /delegated\\040space\\134root /sys/fs/cgroup ")
        result = self.collect(io)
        self.assertEqual(result["membership"]["depth"], 2)
        self.assertEqual(result["mount"]["visibleRootDepth"], 1)
        self.assertEqual([group["label"] for group in result["groups"]], ["self", "parent-1"])
        inspected = [call[1] for call in io.calls if call[0] == "metadata"]
        self.assertEqual(set(inspected), {("team",), ()})
        self.assertNotIn("delegated", json.dumps(result))

    def test_mount_options_and_writable_metadata_do_not_certify_authority(self):
        io = FakeIO()
        io.system["/proc/self/mountinfo"] = MOUNT.replace(" rw,nosuid", " ro,nosuid")
        io.metadata_value["writable"] = True
        io.marker = {"status": "ok", "value": "1"}
        io.manager = {"status": "ok", "nameOwned": True}
        result = self.collect(io)
        self.assertTrue(result["mount"]["readOnly"])
        self.assertTrue(result["mount"]["nsDelegate"])
        self.assertEqual(result["assessment"]["writeAuthority"], "not_tested")
        self.assertEqual(result["assessment"]["delegation"], "not_established_read_only")
        self.assertEqual(result["assessment"]["isolation"], "not_established")

    def test_unknown_controllers_and_type_are_categorical_without_echoing_tokens(self):
        io = FakeIO()
        io.files[(("tenant", "job"), "cgroup.controllers")] = "memory cpu secret-controller-948257\n"
        io.files[(("tenant", "job"), "cgroup.subtree_control")] = "memory secret-controller-948257\n"
        io.files[(("tenant", "job"), "cgroup.type")] = "secret-type-948257\n"
        result = self.collect(io)
        group = result["groups"][0]
        self.assertEqual(set(group["controllers"]["values"]), {"cpu", "memory"})
        self.assertTrue(group["controllers"]["unknownPresent"])
        self.assertTrue(group["subtreeControl"]["unknownPresent"])
        self.assertIsNone(group["type"]["value"])
        self.assertNotIn("948257", json.dumps(result))

    def test_missing_denied_oversize_and_malformed_peak_remain_unknown(self):
        for code in ("absent", "denied", "oversize", "error"):
            with self.subTest(code=code):
                io = FakeIO()
                error = probe.ProbeError(code)
                error.args = (PRIVATE,)
                io.errors[(("tenant", "job"), "memory.peak")] = error
                result = self.collect(io)
                self.assertEqual(result["memoryPeak"]["readStatus"], code)
                self.assertIsNot(result["memoryPeak"]["numericValid"], True)
                self.assertNotIn(PRIVATE, json.dumps(result))
        for value in ("", "max\n", "-1\n", "1.5\n", "NaN\n", "12 34\n", "1\n2\n", "\uff19\n"):
            with self.subTest(value=value):
                io = FakeIO()
                io.files[(("tenant", "job"), "memory.peak")] = value
                result = self.collect(io)
                self.assertEqual(result["memoryPeak"]["readStatus"], "invalid")
                self.assertFalse(result["memoryPeak"]["numericValid"])
        for value in ("0\n", "9\n", "49152\n"):
            with self.subTest(valid_numeric=value):
                io = FakeIO()
                io.files[(("tenant", "job"), "memory.peak")] = value
                self.assertEqual(self.collect(io)["memoryPeak"], {"exists": True, "readStatus": "ok", "numericValid": True})

    def test_eight_group_bound_and_truncation(self):
        io = FakeIO()
        io.system["/proc/self/cgroup"] = "0::/" + "/".join("g" + str(i) for i in range(12)) + "\n"
        result = self.collect(io)
        self.assertEqual(len(result["groups"]), 8)
        self.assertEqual([group["label"] for group in result["groups"]], ["self"] + ["parent-" + str(i) for i in range(1, 8)])
        self.assertEqual(result["limits"], {"maxGroups": 8, "truncated": True, "deadlineSeconds": 20})
        self.assertEqual(len({call[1] for call in io.calls if call[0] == "metadata"}), 8)

    def test_system_file_failure_never_walks_an_unverified_hierarchy(self):
        for path in ("/proc/self/cgroup", "/proc/self/mountinfo"):
            for code in ("absent", "denied", "oversize", "error"):
                with self.subTest(path=path, code=code):
                    io = FakeIO()
                    io.errors[path] = probe.ProbeError(code)
                    result = self.collect(io)
                    self.assertEqual(result["status"], "unavailable")
                    self.assertEqual(result["groups"], [])
                    self.assertIsNot(result["memoryPeak"]["numericValid"], True)
                    self.assertEqual([call for call in io.calls if call[0] == "metadata"], [])

    def test_membership_outside_delegated_mount_is_not_resolved_into_another_cgroup(self):
        io = FakeIO()
        io.system["/proc/self/mountinfo"] = MOUNT.replace(" / /sys/fs/cgroup ", " /another /sys/fs/cgroup ")
        result = self.collect(io)
        self.assertEqual(result["status"], "unavailable")
        self.assertEqual(result["groups"], [])
        self.assertEqual([call for call in io.calls if call[0] in {"metadata", "delegate_marker"}], [])

    def test_unknown_effective_permission_results_are_not_replaced_with_mode_bits(self):
        io = FakeIO()
        io.metadata_value.update({"modeOctal": "0777", "readable": None, "writable": None, "searchable": None})
        result = self.collect(io)
        for group in result["groups"]:
            for metadata in [group["directory"], *group["files"].values()]:
                self.assertIsNone(metadata["readable"])
                self.assertIsNone(metadata["writable"])
                self.assertIsNone(metadata["searchable"])
        self.assertEqual(result["assessment"]["writeAuthority"], "not_tested")

    def test_global_deadline_clears_incomplete_hierarchy_and_prevents_manager_query(self):
        io = FakeIO()
        original = io.read_cgroup_file
        def read(components, name, limit):
            value = original(components, name, limit)
            io.clock = 20.001
            return value
        io.read_cgroup_file = read
        result = self.collect(io)
        self.assertEqual(result["status"], "partial")
        self.assertEqual(result["groups"], [])
        self.assertEqual(result["memoryPeak"], {"exists": None, "readStatus": "timeout", "numericValid": None})
        self.assertEqual([call for call in io.calls if call[0] == "user_manager"], [])
        cgroup_reads = [call for call in io.calls if call[0] == "read" and isinstance(call[1], tuple)]
        self.assertEqual(len(cgroup_reads), 1)

    def test_changed_membership_or_mount_invalidates_observations(self):
        for target, replacement in (("/proc/self/cgroup", "0::/tenant/other\n"), ("/proc/self/mountinfo", MOUNT.replace(" rw,nosuid", " ro,nosuid"))):
            with self.subTest(target=target):
                io = FakeIO()
                original = io.read_system_file
                reads = 0
                def read(path, limit):
                    nonlocal reads
                    if path == target:
                        reads += 1
                        if reads == 2:
                            io.system[target] = replacement
                    return original(path, limit)
                io.read_system_file = read
                result = self.collect(io)
                self.assertEqual(result["status"], "partial")
                self.assertEqual(result["groups"], [])
                self.assertIsNot(result["memoryPeak"]["numericValid"], True)

    def test_changed_directory_inode_invalidates_even_identical_membership_and_mount_text(self):
        io = FakeIO()
        identities = iter(((17, 41), (17, 42)))
        io.group_identity = lambda components: next(identities)
        result = self.collect(io)
        self.assertEqual(result["status"], "partial")
        self.assertEqual(result["groups"], [])
        self.assertIsNot(result["memoryPeak"]["numericValid"], True)
        self.assertNotIn("inode", json.dumps(result))

    def test_image_metadata_is_individually_allowlisted_not_environment_dumped(self):
        good = self.collect(values={"ImageOS": "ubuntu24", "ImageVersion": "20261010.1.0"})
        self.assertEqual(good["host"]["imageOS"], "ubuntu24")
        self.assertEqual(good["host"]["imageVersion"], "20261010.1.0")
        for image_os, image_version in (("ubuntu24\n" + PRIVATE, "1.2"), ("ubuntu22", "1.2"), ("ubuntu24", "1.2\n"), ("ubuntu24", "9" * 65), ("ubuntu24", PRIVATE)):
            with self.subTest(image_os=image_os, image_version=image_version):
                result = self.collect(values={"ImageOS": image_os, "ImageVersion": image_version, "SECRET_TOKEN": PRIVATE})
                self.assertNotIn(PRIVATE, json.dumps(result))
                if image_os != "ubuntu24":
                    self.assertIsNone(result["host"]["imageOS"])
                if image_version not in {"1.2"}:
                    self.assertIsNone(result["host"]["imageVersion"])

    def test_untrusted_metadata_and_manager_fields_cannot_expand_the_output_or_leak_values(self):
        io = FakeIO()
        io.metadata_value.update({"status": PRIVATE, "modeOctal": PRIVATE, "ownerMatchesEuid": 1000, "readable": PRIVATE, "pid": 948257, "path": PRIVATE, "environment": {"SECRET_TOKEN": PRIVATE}})
        io.marker = {"status": "ok", "value": PRIVATE, "path": PRIVATE}
        io.manager = {"status": PRIVATE, "nameOwned": PRIVATE, "stdout": PRIVATE}
        io.kernel_release = lambda: PRIVATE
        io.system["/etc/os-release"] = "ID=ubuntu\nVERSION_ID=" + PRIVATE + "\n"
        result = self.collect(io)
        self.assertEqual(set(result), ROOT_KEYS)
        self.assertEqual(result["status"], "partial")
        self.assertIsNone(result["host"]["kernelRelease"])
        self.assertIsNone(result["host"]["osVersionId"])
        self.assertEqual(result["userManager"], {"status": "invalid", "nameOwned": None})
        for group in result["groups"]:
            for metadata in [group["directory"], *group["files"].values()]:
                self.assertEqual(set(metadata), META_KEYS)
                self.assertEqual(metadata["status"], "invalid")
                self.assertIsNone(metadata["modeOctal"])
                self.assertIsNone(metadata["ownerMatchesEuid"])
                self.assertIsNone(metadata["readable"])
            self.assertEqual(group["delegationMarker"], {"status": "invalid", "value": None})
        self.assertNotIn(PRIVATE, json.dumps(result))
        self.assertNotIn("948257", json.dumps(result))


class ParserTest(unittest.TestCase):
    def assert_invalid(self, function, text, code="invalid"):
        with self.assertRaises(probe.ProbeError) as caught:
            function(text)
        self.assertEqual(caught.exception.code, code)

    def test_unified_membership_and_component_limit(self):
        self.assertEqual(probe.parse_membership("2:cpu:/legacy\n0::/tenant/job\n"), ("tenant", "job"))
        self.assertEqual(probe.parse_membership("0::/\n"), ())
        self.assertEqual(len(probe.parse_membership("0::/" + "/".join(["g"] * 128))), 128)
        self.assert_invalid(probe.parse_membership, "0::/" + "/".join(["g"] * 129), "oversize")

    def test_rejects_ambiguous_deleted_control_and_traversal_membership(self):
        for text in ("", "2:cpu:/legacy"):
            with self.subTest(absent_unified=text):
                self.assert_invalid(probe.parse_membership, text, "absent")
        for text in ("0::/one\n0::/two\n", "0::relative", "0::/tenant/../job", "0::/tenant/./job", "0::/tenant//job", "0::/tenant/job (deleted)", "0::/tenant/\x00job", "0::/tenant/\tjob", "0::/tenant\x85job", "0::/tenant\u2028job"):
            with self.subTest(text=text):
                self.assert_invalid(probe.parse_membership, text)

    def test_fixed_cgroup2_mount_and_escaped_root(self):
        parsed = probe.parse_mountinfo(MOUNT.replace(" / /sys/fs/cgroup ", " /delegated\\040space\\134root /sys/fs/cgroup "))
        self.assertEqual(parsed["root"], ("delegated space\\root",))
        self.assertFalse(parsed["readOnly"])
        self.assertTrue(parsed["nsDelegate"])
        for text in (MOUNT + MOUNT, MOUNT.replace(" - cgroup2 ", " - cgroup "), MOUNT.replace(" /sys/fs/cgroup ", " /other "), MOUNT.replace(" / /sys/fs/cgroup ", " /tenant/../job /sys/fs/cgroup "), MOUNT.replace(" / /sys/fs/cgroup ", " /bad\\011name /sys/fs/cgroup ")):
            with self.subTest(text=text):
                with self.assertRaises(probe.ProbeError):
                    probe.parse_mountinfo(text)


class NativeIOTest(unittest.TestCase):
    def setUp(self):
        flags = mock.patch.multiple(probe.os, O_NOFOLLOW=0x100000, O_DIRECTORY=0x200000, O_CLOEXEC=0x400000, O_NONBLOCK=0x800000, create=True)
        flags.start()
        self.addCleanup(flags.stop)
        self.native = probe.NativeIO()
        self.native.now = lambda: 0.0
        for name in ("write", "mkdir", "makedirs", "rmdir", "unlink", "remove", "rename", "replace", "chmod", "chown", "setxattr", "removexattr"):
            patcher = mock.patch.object(probe.os, name, side_effect=AssertionError("mutating operation: " + name), create=True)
            operation = patcher.start()
            self.addCleanup(patcher.stop)
            self.addCleanup(operation.assert_not_called)

    def test_directory_walk_is_componentwise_readonly_nofollow_and_closes_intermediate_descriptors(self):
        with mock.patch.object(probe.os, "open", side_effect=range(101, 107)) as opened, mock.patch.object(probe.os, "close") as closed:
            descriptor = self.native._open_directory(("tenant", "job"))
            self.assertEqual(descriptor, 106)
            self.assertEqual([call.args[0] for call in opened.call_args_list], ["/", "sys", "fs", "cgroup", "tenant", "job"])
            for index, call in enumerate(opened.call_args_list):
                flags = call.args[1]
                self.assertEqual(flags & (os.O_WRONLY | os.O_RDWR | os.O_CREAT | os.O_TRUNC | os.O_APPEND), 0)
                self.assertEqual(flags & (os.O_NOFOLLOW | os.O_DIRECTORY | os.O_CLOEXEC), os.O_NOFOLLOW | os.O_DIRECTORY | os.O_CLOEXEC)
                if index:
                    self.assertEqual(call.kwargs, {"dir_fd": 100 + index})
                else:
                    self.assertEqual(call.kwargs, {})
            self.assertEqual([call.args[0] for call in closed.call_args_list], list(range(101, 106)))

    def test_symlink_and_denied_components_stop_the_walk_and_close_the_live_descriptor(self):
        for error_number in (errno.ELOOP, errno.ENOTDIR, errno.EACCES, errno.ENOENT):
            with self.subTest(errno=error_number):
                error = OSError(error_number, PRIVATE)
                with mock.patch.object(probe.os, "open", side_effect=[101, error]) as opened, mock.patch.object(probe.os, "close") as closed:
                    with self.assertRaises(OSError):
                        self.native._open_directory(("tenant", "job"))
                    self.assertEqual(opened.call_count, 2)
                    closed.assert_called_once_with(101)

    def test_traversal_components_and_unapproved_files_are_rejected_before_open(self):
        with mock.patch.object(probe.os, "open") as opened:
            for components in (("..",), ("tenant/job",), ("bad\x00name",), ["tenant"], ("g",) * 129):
                with self.subTest(components=components), self.assertRaises(probe.ProbeError):
                    self.native._open_directory(components)
            for name in ("cgroup.procs", "cgroup.threads", "../memory.peak", "other"):
                with self.subTest(name=name), self.assertRaises(probe.ProbeError):
                    self.native.read_cgroup_file(("tenant",), name, 4096)
            with self.assertRaises(probe.ProbeError):
                self.native.read_system_file("/proc/self/environ", 4096)
            with self.assertRaises(probe.ProbeError):
                self.native.read_system_file("/proc/self/mountinfo", 4096)
            opened.assert_not_called()

    def test_cgroup_content_opens_only_a_readonly_nofollow_leaf_under_the_guarded_descriptor(self):
        with mock.patch.object(self.native, "_open_directory", return_value=41) as directory, mock.patch.object(probe.os, "open", return_value=42) as opened, mock.patch.object(self.native, "_read_fd", return_value="9\n") as read, mock.patch.object(probe.os, "close") as closed:
            self.assertEqual(self.native.read_cgroup_file(("tenant", "job"), "memory.peak", 4096), "9\n")
            directory.assert_called_once_with(("tenant", "job"))
            self.assertEqual(opened.call_args.args[0], "memory.peak")
            self.assertEqual(opened.call_args.kwargs, {"dir_fd": 41})
            self.assertTrue(opened.call_args.args[1] & os.O_NOFOLLOW)
            self.assertEqual(opened.call_args.args[1] & (os.O_WRONLY | os.O_RDWR | os.O_CREAT | os.O_TRUNC | os.O_APPEND), 0)
            read.assert_called_once_with(42, 4096)
            self.assertEqual([call.args[0] for call in closed.call_args_list], [42, 41])

    def test_fd_reads_stop_at_the_byte_cap_and_require_regular_utf8_content(self):
        record = SimpleNamespace(st_mode=stat.S_IFREG | 0o444)
        with mock.patch.object(probe.os, "fstat", return_value=record), mock.patch.object(probe.os, "read", side_effect=[b"x" * 4097]) as read:
            with self.assertRaises(probe.ProbeError) as caught:
                self.native._read_fd(42, 4096)
            self.assertEqual(caught.exception.code, "oversize")
            read.assert_called_once_with(42, 4097)
        with mock.patch.object(probe.os, "fstat", return_value=record), mock.patch.object(probe.os, "read", side_effect=[b"\xff", b""]):
            with self.assertRaises(probe.ProbeError) as caught:
                self.native._read_fd(42, 4096)
            self.assertEqual(caught.exception.code, "invalid")
        with mock.patch.object(probe.os, "fstat", return_value=SimpleNamespace(st_mode=stat.S_IFIFO)), mock.patch.object(probe.os, "read") as read:
            with self.assertRaises(probe.ProbeError):
                self.native._read_fd(42, 4096)
            read.assert_not_called()

    def test_unsupported_effective_access_does_not_infer_permission_from_mode_bits(self):
        record = SimpleNamespace(st_mode=stat.S_IFDIR | 0o777, st_uid=1000)
        with mock.patch.object(self.native, "_open_directory", return_value=41), mock.patch.object(probe.os, "stat", return_value=record) as stated, mock.patch.object(probe.os, "geteuid", return_value=1000, create=True), mock.patch.object(probe.os, "supports_effective_ids", set()), mock.patch.object(probe.os, "access") as access, mock.patch.object(probe.os, "close") as closed:
            result = self.native.metadata(("tenant", "job"))
            self.assertEqual(result, {"status": "unsupported", "modeOctal": "0777", "ownerMatchesEuid": True, "readable": None, "writable": None, "searchable": None})
            stated.assert_called_once_with(".", dir_fd=41, follow_symlinks=False)
            access.assert_not_called()
            closed.assert_called_once_with(41)

    def test_effective_access_uses_guarded_dirfd_without_following_symlinks(self):
        record = SimpleNamespace(st_mode=stat.S_IFDIR | 0o755, st_uid=1000)
        with mock.patch.object(self.native, "_open_directory", return_value=41), mock.patch.object(probe.os, "stat", return_value=record), mock.patch.object(probe.os, "geteuid", return_value=1000, create=True), mock.patch.object(probe.os, "access", side_effect=[True, False, True]) as access, mock.patch.object(probe.os, "close"):
            with mock.patch.object(probe.os, "supports_effective_ids", {access}), mock.patch.object(probe.os, "supports_dir_fd", {access}):
                result = self.native.metadata(("tenant", "job"))
            self.assertEqual(result, {"status": "ok", "modeOctal": "0755", "ownerMatchesEuid": True, "readable": True, "writable": False, "searchable": True})
            self.assertEqual(access.call_args_list, [mock.call(".", mode, dir_fd=41, effective_ids=True, follow_symlinks=False) for mode in (os.R_OK, os.W_OK, os.X_OK)])
        with mock.patch.object(self.native, "_open_directory", return_value=41), mock.patch.object(probe.os, "stat", return_value=SimpleNamespace(st_mode=stat.S_IFLNK | 0o777)), mock.patch.object(probe.os, "access") as access, mock.patch.object(probe.os, "close"):
            with self.assertRaises(probe.ProbeError):
                self.native.metadata(("tenant", "job"), "cgroup.procs")
            access.assert_not_called()

    def test_os_release_symlink_exception_is_only_the_fixed_ubuntu_target(self):
        for target in ("../usr/lib/os-release", "/usr/lib/os-release"):
            with self.subTest(target=target), mock.patch.object(probe.os, "open", side_effect=[OSError(errno.ELOOP, PRIVATE), 42]) as opened, mock.patch.object(probe.os, "readlink", return_value=target), mock.patch.object(self.native, "_open_directory", return_value=41) as directory, mock.patch.object(self.native, "_read_fd", return_value="ID=ubuntu\n") as read, mock.patch.object(probe.os, "close"):
                self.assertEqual(self.native.read_system_file("/etc/os-release", 4096), "ID=ubuntu\n")
                directory.assert_called_once_with((), ("usr", "lib"))
                self.assertEqual(opened.call_args.args[0], "os-release")
                self.assertEqual(opened.call_args.kwargs, {"dir_fd": 41})
                read.assert_called_once_with(42, 4096)
        with mock.patch.object(probe.os, "open", side_effect=OSError(errno.ELOOP, PRIVATE)), mock.patch.object(probe.os, "readlink", return_value="/private/os-release"), mock.patch.object(self.native, "_open_directory") as directory:
            with self.assertRaises(probe.ProbeError):
                self.native.read_system_file("/etc/os-release", 4096)
            directory.assert_not_called()

    def test_delegate_marker_only_accepts_exact_one_and_is_read_from_a_descriptor(self):
        for value in (b"1", b"0", b"true", b"1\n", b"1\x00", b"", PRIVATE.encode()):
            with self.subTest(value=value), mock.patch.object(self.native, "_open_directory", return_value=41), mock.patch.object(self.native, "_read_delegate_xattr", return_value=value) as read_xattr, mock.patch.object(probe.os, "close") as closed:
                result = self.native.delegate_marker(("tenant", "job"))
                self.assertEqual(result, {"status": "ok" if value == b"1" else "invalid", "value": "1" if value == b"1" else None})
                read_xattr.assert_called_once_with(41)
                closed.assert_called_once_with(41)

    def test_native_xattr_has_a_two_byte_buffer_and_never_requests_unbounded_size(self):
        def read_xattr(descriptor, name, buffer, limit):
            buffer.raw = b"1\x00"
            return 1
        function = mock.Mock(side_effect=read_xattr)
        library = SimpleNamespace(fgetxattr=function)
        with mock.patch.object(probe.ctypes, "CDLL", return_value=library) as loaded:
            self.assertEqual(self.native._read_delegate_xattr(41), b"1")
            loaded.assert_called_once_with(None, use_errno=True)
            self.assertEqual(function.call_count, 1)
            self.assertEqual(function.call_args.args[:2], (41, b"user.delegate"))
            self.assertEqual(function.call_args.args[3], 2)
            self.assertEqual(probe.ctypes.sizeof(function.call_args.args[2]), 2)
        function = mock.Mock(return_value=-1)
        with mock.patch.object(probe.ctypes, "CDLL", return_value=SimpleNamespace(fgetxattr=function)), mock.patch.object(probe.ctypes, "get_errno", return_value=errno.ERANGE):
            with self.assertRaises(probe.ProbeError) as caught:
                self.native._read_delegate_xattr(41)
            self.assertEqual(caught.exception.code, "oversize")
            self.assertEqual(function.call_count, 1)
            self.assertEqual(function.call_args.args[3], 2)

    def test_self_reads_remain_on_pinned_descriptor_and_final_identity_reopens_the_current_path(self):
        records = [SimpleNamespace(st_dev=17, st_ino=41), SimpleNamespace(st_dev=17, st_ino=42)]
        with mock.patch.object(self.native, "_open_directory", side_effect=[41, 42]) as directory, mock.patch.object(probe.os, "fstat", side_effect=records), mock.patch.object(probe.os, "dup", return_value=43) as duplicated, mock.patch.object(probe.os, "open", return_value=44) as opened, mock.patch.object(self.native, "_read_fd", return_value="9\n"), mock.patch.object(probe.os, "close") as closed:
            self.assertEqual(self.native.group_identity(("tenant", "job")), (17, 41))
            closed.assert_not_called()
            self.assertEqual(self.native.read_cgroup_file(("tenant", "job"), "memory.peak", 4096), "9\n")
            duplicated.assert_called_once_with(41)
            self.assertEqual(opened.call_args.kwargs, {"dir_fd": 43})
            self.assertEqual(self.native.group_identity(("tenant", "job")), (17, 42))
            self.assertEqual(directory.call_count, 2)
            self.native.close()
            self.native.close()
            self.assertEqual([call.args[0] for call in closed.call_args_list], [44, 43, 42, 41])

    def test_bus_query_is_fixed_nonactivating_shell_free_and_uses_sterile_environment(self):
        process = mock.Mock()
        process.stdout.fileno.return_value = 51
        process.poll.return_value = 0
        process.wait.return_value = 0
        selector = mock.Mock()
        selector.select.return_value = [(object(), 1)]
        with mock.patch.object(probe.subprocess, "Popen", return_value=process) as popped, mock.patch.object(probe.selectors, "DefaultSelector", return_value=selector), mock.patch.object(probe.os, "read", side_effect=[b"b true\n", b""]) as read, mock.patch.object(probe.os, "getenv", side_effect=AssertionError("environment read")):
            self.assertEqual(self.native._run_busctl("unix:path=/run/user/1000/bus"), {"status": "ok", "nameOwned": True})
            self.assertEqual(popped.call_args.args[0], ["/usr/bin/busctl", "--address=unix:path=/run/user/1000/bus", "--auto-start=no", "--allow-interactive-authorization=no", "--timeout=2s", "--no-pager", "call", "org.freedesktop.DBus", "/org/freedesktop/DBus", "org.freedesktop.DBus", "NameHasOwner", "s", "org.freedesktop.systemd1"])
            self.assertEqual(popped.call_args.kwargs, {"stdin": subprocess.DEVNULL, "stdout": subprocess.PIPE, "stderr": subprocess.DEVNULL, "shell": False, "env": {"PATH": "/usr/bin:/bin", "LC_ALL": "C"}, "close_fds": True})
            self.assertTrue(all(call.args[1] <= 4097 for call in read.call_args_list))
            self.assertTrue(all(0 < call.args[0] <= 2 for call in selector.select.call_args_list))
            process.wait.assert_called_once_with(timeout=2.0)
            process.kill.assert_not_called()
            process.stdout.close.assert_called_once()
            selector.close.assert_called_once()

    def test_bus_output_is_bounded_and_malformed_reply_never_enters_the_report(self):
        for output, expected in ((b"x" * 4097, "oversize"), (PRIVATE.encode(), "invalid"), (b"b true\nprivate", "invalid")):
            with self.subTest(expected=expected):
                process = mock.Mock()
                process.stdout.fileno.return_value = 51
                process.poll.return_value = None
                process.wait.return_value = 0
                selector = mock.Mock()
                selector.select.return_value = [(object(), 1)]
                with mock.patch.object(probe.subprocess, "Popen", return_value=process), mock.patch.object(probe.selectors, "DefaultSelector", return_value=selector), mock.patch.object(probe.os, "read", side_effect=[output, b""]) as read:
                    result = self.native._run_busctl("unix:path=/run/user/1000/bus")
                    self.assertEqual(result, {"status": expected, "nameOwned": None})
                    self.assertNotIn(PRIVATE, json.dumps(result))
                    self.assertTrue(all(call.args[1] <= 4097 for call in read.call_args_list))
                    process.kill.assert_called_once()
                    self.assertTrue(all(call.kwargs.get("timeout", 0) <= 2 for call in process.wait.call_args_list))
                    process.stdout.close.assert_called_once()

    def test_bus_timeout_and_absent_or_foreign_bus_do_not_activate_a_manager(self):
        process = mock.Mock()
        process.stdout.fileno.return_value = 51
        process.poll.return_value = None
        process.wait.return_value = 0
        selector = mock.Mock()
        selector.select.return_value = []
        with mock.patch.object(probe.subprocess, "Popen", return_value=process), mock.patch.object(probe.selectors, "DefaultSelector", return_value=selector), mock.patch.object(probe.os, "read") as read:
            self.assertEqual(self.native._run_busctl("unix:path=/run/user/1000/bus"), {"status": "timeout", "nameOwned": None})
            read.assert_not_called()
            process.kill.assert_called_once()
        for bus_mode, owner in ((stat.S_IFREG, 1000), (stat.S_IFSOCK, 999)):
            with self.subTest(bus_mode=bus_mode, owner=owner), mock.patch.object(probe.os, "stat", side_effect=[SimpleNamespace(st_mode=stat.S_IFREG | 0o755), SimpleNamespace(st_mode=bus_mode, st_uid=owner)]), mock.patch.object(probe.os, "fstat", return_value=SimpleNamespace(st_uid=1000)), mock.patch.object(self.native, "_open_directory", return_value=41), mock.patch.object(probe.os, "close"), mock.patch.object(self.native, "_run_busctl") as query:
                result = self.native.user_manager(1000)
                self.assertIn(result["status"], {"invalid", "denied"})
                self.assertIsNone(result["nameOwned"])
                query.assert_not_called()
        with mock.patch.object(probe.os, "stat", side_effect=FileNotFoundError(errno.ENOENT, PRIVATE)), mock.patch.object(self.native, "_run_busctl") as query:
            result = self.native.user_manager(1000)
            self.assertEqual(result, {"status": "unavailable", "nameOwned": None})
            self.assertNotIn(PRIVATE, json.dumps(result))
            query.assert_not_called()

    def test_manager_timeout_does_not_add_cleanup_wait_after_the_global_deadline(self):
        clock = 0.0
        self.native.now = lambda: clock
        self.native.deadline = 0.025
        process = mock.Mock()
        process.stdout.fileno.return_value = 51
        process.poll.return_value = None
        selector = mock.Mock()
        def expires(timeout):
            nonlocal clock
            clock = 0.026
            return []
        selector.select.side_effect = expires
        with mock.patch.object(probe.subprocess, "Popen", return_value=process), mock.patch.object(probe.selectors, "DefaultSelector", return_value=selector), mock.patch.object(probe.os, "read") as read:
            self.assertEqual(self.native._run_busctl("unix:path=/run/user/1000/bus"), {"status": "timeout", "nameOwned": None})
            selector.select.assert_called_once_with(0.025)
            process.kill.assert_called_once()
            process.wait.assert_not_called()
            read.assert_not_called()
            process.stdout.close.assert_called_once()


class MainTest(unittest.TestCase):
    def test_main_alarm_is_bounded_and_restored_without_running_a_native_probe(self):
        report = probe.collect_probe(io=FakeIO(), getenv=lambda name: None)
        old_handler = object()
        stdout = io.StringIO()
        with mock.patch.object(probe.sys, "argv", ["probe"]), mock.patch.object(probe.sys, "platform", "linux"), mock.patch.object(probe.signal, "SIGALRM", 14, create=True), mock.patch.object(probe.signal, "signal", return_value=old_handler) as set_handler, mock.patch.object(probe.signal, "alarm", create=True) as alarm, mock.patch.object(probe, "collect_probe", return_value=report) as collect, redirect_stdout(stdout):
            self.assertEqual(probe.main(), 0)
            collect.assert_called_once_with()
            alarm.assert_has_calls([mock.call(20), mock.call(0)])
            self.assertEqual(alarm.call_count, 2)
            self.assertEqual(set_handler.call_count, 2)
            self.assertEqual(set_handler.call_args_list[1], mock.call(14, old_handler))
            expire = set_handler.call_args_list[0].args[1]
            with self.assertRaises(probe.ProbeError) as caught:
                expire(14, None)
            self.assertEqual(caught.exception.code, "timeout")
        self.assertEqual(json.loads(stdout.getvalue()), report)
        self.assertEqual(len(stdout.getvalue().splitlines()), 1)

    def test_unsupported_platform_or_arguments_never_read_native_files_or_query_a_bus(self):
        for platform, args in (("win32", ["probe"]), ("linux", ["probe", "--unapproved"])):
            with self.subTest(platform=platform, args=args):
                stdout = io.StringIO()
                with mock.patch.object(probe.sys, "platform", platform), mock.patch.object(probe.sys, "argv", args), mock.patch.object(probe, "collect_probe") as collect, mock.patch.object(probe.os, "open") as opened, mock.patch.object(probe.subprocess, "Popen") as popped, redirect_stdout(stdout):
                    self.assertEqual(probe.main(), 0)
                    collect.assert_not_called()
                    opened.assert_not_called()
                    popped.assert_not_called()
                self.assertEqual(json.loads(stdout.getvalue())["status"], "unavailable")


if __name__ == "__main__":
    unittest.main()
