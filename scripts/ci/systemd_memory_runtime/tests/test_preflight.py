"""Hermetic preflight fixtures; no Linux authority or host probes run here."""
from copy import deepcopy
from pathlib import Path
import sys
import unittest
from unittest.mock import patch
from contextlib import ExitStack


sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
from systemd_memory_runtime.contracts import RunSpec
from systemd_memory_runtime import contracts as C
from systemd_memory_runtime.preflight import ActualReadOnlyProbes, preflight
from systemd_memory_runtime import preflight as P


def spec_mapping():
    names = ("b" * 32, "c" * 32, "d" * 32)
    scenarios = ("OVERLAP", "LEADER_EXIT_THREAD_SURVIVES", "DESCENDANT_IGNORES_TERM")
    return {
        "run": "a" * 32, "t0_us": "1000000", "work_deadline_us": "51000000", "cleanup_deadline_us": "61000000",
        "slots": [{"slot": index, "unit_name": "elogistix-memory-adapter-" + names[index] + ".service",
                   "scenario": scenarios[index], "memory_max_bytes": C.MEMORY_MAX_BYTES, "tasks_max": 8} for index in range(3)],
        "load_uid": 2042, "load_gid": 2043, "load_groups": [44, 2043],
        "payload_expected_sha256": "f" * 64, "cleanup_policy_id": "physical-cleanup-union-v1",
        "scope_ref": "authorized-experiment:v3-fixture",
    }


class FakeClock:
    def __init__(self, value=1000000):
        self.value = value

    def __call__(self):
        return self.value


class FakeProbes:
    platform = "linux"

    def __init__(self, clock=None, changes=None, errors=None, after=None, sequences=None):
        self.clock = clock or FakeClock()
        self.calls = []
        self.errors = errors or {}
        self.after = after or {}
        self.sequences = {name: list(values) for name, values in (sequences or {}).items()}
        self.values = {
            "boot_id": "12345678-1234-4234-8234-123456789abc",
            "namespaces": {"pid": "pid:[4026531836]", "mnt": "mnt:[4026531841]"},
            "os_release": {"ID": "ubuntu", "VERSION_ID": "24.04"},
            "control_uid": 0,
            "load_identity": {"uid": 2042, "gid": 2043, "groups": [44, 2043]},
            "systemd_running": True,
            "cgroup_info": {"filesystem": "cgroup2", "mount_id": 42, "mount_root": "/",
                            "membership_path": "/control.slice/own-control", "controllers": ["memory", "pids"],
                            "subtree_control": ["memory", "pids"]},
            "dependencies": {"libsystemd": True, "compiler": "/usr/bin/cc", "physical_cgroup": True,
                             "payload_distribution": True},
        }
        self.values.update(changes or {})

    def read(self, name, *args):
        self.calls.append((name, args))
        if name in self.after:
            self.clock.value = self.after[name]
        if name in self.errors:
            raise self.errors[name]
        value = self.sequences[name].pop(0) if name in self.sequences and self.sequences[name] else self.values[name]
        return deepcopy(value)

    def boot_id(self):
        return self.read("boot_id")

    def namespaces(self):
        return self.read("namespaces")

    def os_release(self):
        return self.read("os_release")

    def control_uid(self):
        return self.read("control_uid")

    def load_identity(self, uid, gid):
        return self.read("load_identity", uid, gid)

    def systemd_running(self):
        return self.read("systemd_running")

    def cgroup_info(self):
        return self.read("cgroup_info")

    def dependencies(self):
        return self.read("dependencies")


class PreflightTest(unittest.TestCase):
    def fixture(self, **kwargs):
        clock = FakeClock()
        probes = FakeProbes(clock=clock, **kwargs)
        return RunSpec.from_mapping(spec_mapping()), probes, clock

    def test_complete_capability_fixtures_pass_without_mutating_probe_api(self):
        spec, probes, clock = self.fixture()
        result = preflight(spec, probes=probes, clock_us=clock)
        self.assertTrue(result.passed)
        self.assertEqual(result.missing, ())
        self.assertEqual(result.to_mapping()["passed"], True)
        self.assertEqual(result.facts["probe_mode"], "injected")
        self.assertEqual(result.facts["aggregate_memory_cap_bytes"], 100_663_296)
        self.assertEqual(result.facts["aggregate_task_cap"], 24)
        self.assertEqual((result.facts["unit_mutations"], result.facts["installations"], result.facts["privilege_changes"]), (0, 0, 0))
        self.assertEqual(result.facts["memory_reclamation"], "NOT_ESTABLISHED")
        self.assertEqual([args for name, args in probes.calls if name == "load_identity"], [(2042, 2043)])
        self.assertTrue(all(name in probes.values for name, _ in probes.calls))

    def test_nonlinux_platform_never_invokes_linux_or_authority_probes(self):
        spec, probes, clock = self.fixture()
        probes.platform = "win32"
        result = preflight(spec, probes=probes, clock_us=clock)
        self.assertFalse(result.passed)
        self.assertIn("PLATFORM_LINUX", result.missing)
        self.assertEqual(probes.calls, [])

    def test_concrete_probe_api_rejects_nonlinux_before_every_fixed_read(self):
        probe = ActualReadOnlyProbes()
        probe.platform = "win32"
        calls = ((probe.boot_id, ()), (probe.namespaces, ()), (probe.os_release, ()),
                 (probe.control_uid, ()), (probe.load_identity, (2042, 2043)),
                 (probe.systemd_running, ()), (probe.cgroup_info, ()), (probe.dependencies, ()))
        for method, args in calls:
            with self.subTest(method=method.__name__):
                with self.assertRaises(RuntimeError):
                    method(*args)

    def test_existing_dependency_absence_blocks_without_install_or_mutation(self):
        for field, value, expected in (("libsystemd", False, "LIBSYSTEMD"), ("compiler", None, "NATIVE_COMPILER"),
                                       ("physical_cgroup", False, "PHYSICAL_COMPONENT"), ("payload_distribution", False, "PAYLOAD_COMPONENT")):
            with self.subTest(field=field):
                spec, probes, clock = self.fixture()
                probes.values["dependencies"][field] = value
                result = preflight(spec, probes=probes, clock_us=clock)
                self.assertFalse(result.passed)
                self.assertIn(expected, result.missing)
                self.assertTrue(all(name in probes.values for name, _ in probes.calls))

    def test_identity_authority_and_manager_uncertainty_are_distinct_failures(self):
        cases = (("boot_id", "unknown", "BOOT_ID"), ("namespaces", {"pid": "", "mnt": ""}, "NAMESPACES"),
                 ("os_release", {"ID": "other", "VERSION_ID": "unknown"}, "UBUNTU_METADATA"),
                 ("control_uid", 2042, "CONTROL_AUTHORITY"),
                 ("load_identity", {"uid": 0, "gid": 2043, "groups": [44, 2043]}, "LOAD_IDENTITY"),
                 ("load_identity", {"uid": 2042, "gid": 2043, "groups": [2043]}, "LOAD_IDENTITY"),
                 ("systemd_running", False, "SYSTEMD_MANAGER"))
        for name, value, expected in cases:
            with self.subTest(name=name, value=value):
                spec, probes, clock = self.fixture(changes={name: value})
                result = preflight(spec, probes=probes, clock_us=clock)
                self.assertFalse(result.passed)
                self.assertIn(expected, result.missing)

    def test_cgroup_v1_or_missing_memory_or_pids_is_rejected_without_enabling_controllers(self):
        for changes, expected in (({"filesystem": "cgroup"}, "CGROUP2"),
                                  ({"mount_root": "/foreign-root"}, "CGROUP2"),
                                  ({"controllers": ["pids"]}, "MEMORY_CONTROLLER"),
                                  ({"controllers": ["memory"]}, "PIDS_CONTROLLER")):
            with self.subTest(changes=changes):
                spec, probes, clock = self.fixture()
                probes.values["cgroup_info"].update(changes)
                result = preflight(spec, probes=probes, clock_us=clock)
                self.assertFalse(result.passed)
                self.assertIn(expected, result.missing)
                self.assertNotIn("enable_controllers", [name for name, _ in probes.calls])

    def test_probe_exception_is_closed_failure_without_raw_private_message(self):
        for name, expected in (("boot_id", "BOOT_ID"), ("control_uid", "CONTROL_AUTHORITY"),
                               ("cgroup_info", "CGROUP2"), ("dependencies", "LIBSYSTEMD")):
            with self.subTest(name=name):
                spec, probes, clock = self.fixture(errors={name: PermissionError("PRIVATE_PATH_OR_ENVIRONMENT")})
                result = preflight(spec, probes=probes, clock_us=clock)
                self.assertFalse(result.passed)
                self.assertIn(expected, result.missing)
                self.assertNotIn("PRIVATE_PATH_OR_ENVIRONMENT", str(result.to_mapping()))

    def test_correct_probe_reply_after_work_cutoff_is_not_accepted(self):
        spec, probes, clock = self.fixture(after={"boot_id": 51000000})
        result = preflight(spec, probes=probes, clock_us=clock)
        self.assertFalse(result.passed)
        self.assertIn("DEADLINE", result.missing)
        self.assertEqual([name for name, _ in probes.calls], ["boot_id"])

    def test_original_deadline_is_checked_before_any_probe_and_never_reset(self):
        spec, probes, clock = self.fixture()
        clock.value = 51000000
        result = preflight(spec, probes=probes, clock_us=clock)
        self.assertFalse(result.passed)
        self.assertIn("DEADLINE", result.missing)
        self.assertEqual(probes.calls, [])

    def test_bool_float_negative_and_before_origin_clock_are_not_valid_monotonic_time(self):
        for value in (True, 1.5, -1, 999999):
            with self.subTest(value=value):
                spec, probes, clock = self.fixture()
                clock.value = value
                result = preflight(spec, probes=probes, clock_us=clock)
                self.assertFalse(result.passed)
                self.assertIn("CLOCK_VALID", result.missing)
                self.assertEqual(probes.calls, [])

    def test_boot_and_namespace_changes_at_final_read_fail_closed(self):
        baseline_boot = "12345678-1234-4234-8234-123456789abc"
        baseline_ns = {"pid": "pid:[4026531836]", "mnt": "mnt:[4026531841]"}
        for name, values, expected in (("boot_id", (baseline_boot, "22345678-1234-4234-8234-123456789abc"), "BOOT_ID"),
                                       ("namespaces", (baseline_ns, baseline_ns | {"mnt": "mnt:[4026531842]"}), "NAMESPACES")):
            with self.subTest(name=name):
                spec, probes, clock = self.fixture(sequences={name: values})
                result = preflight(spec, probes=probes, clock_us=clock)
                self.assertFalse(result.passed)
                self.assertIn(expected, result.missing)

    def test_external_component_presence_is_not_manager_authority_or_cleanup_evidence(self):
        spec, probes, clock = self.fixture()
        result = preflight(spec, probes=probes, clock_us=clock)
        self.assertTrue(result.passed)
        self.assertEqual(result.facts["manager_authority"], "not yet proven by persistent bus preflight")
        self.assertEqual(result.facts["physical_cleanup"], "not observed by preflight")
        self.assertEqual(result.facts["memory_reclamation"], "NOT_ESTABLISHED")

    def test_boolean_capabilities_and_root_authority_are_not_coerced_from_strings_or_numbers(self):
        for bad in (1, "true", None):
            for name, expected in (("systemd_running", "SYSTEMD_MANAGER"), ("control_uid", "CONTROL_AUTHORITY")):
                with self.subTest(name=name, bad=bad):
                    spec, probes, clock = self.fixture(changes={name: bad})
                    result = preflight(spec, probes=probes, clock_us=clock)
                    self.assertFalse(result.passed)
                    self.assertIn(expected, result.missing)
            for field, expected in (("libsystemd", "LIBSYSTEMD"), ("physical_cgroup", "PHYSICAL_COMPONENT"), ("payload_distribution", "PAYLOAD_COMPONENT")):
                with self.subTest(field=field, bad=bad):
                    spec, probes, clock = self.fixture()
                    probes.values["dependencies"][field] = bad
                    result = preflight(spec, probes=probes, clock_us=clock)
                    self.assertFalse(result.passed)
                    self.assertIn(expected, result.missing)

    def test_namespace_field_cannot_claim_the_other_namespace_type(self):
        spec, probes, clock = self.fixture(changes={"namespaces": {"pid": "mnt:[4026531836]", "mnt": "pid:[4026531841]"}})
        result = preflight(spec, probes=probes, clock_us=clock)
        self.assertFalse(result.passed)
        self.assertIn("NAMESPACES", result.missing)

    def test_clock_rollback_between_two_read_brackets_remains_invalid(self):
        spec, probes, _ = self.fixture()
        values = iter((1000000, 1000000, 1000010, 1000000))

        def clock():
            return next(values, 1000000)

        result = preflight(spec, probes=probes, clock_us=clock)
        self.assertFalse(result.passed)
        self.assertIn("CLOCK_VALID", result.missing)

    def test_load_identity_numeric_fields_require_exact_integers(self):
        for changes in ({"uid": 2042.0}, {"gid": 2043.0}, {"groups": [44.0, 2043]}, {"groups": [44, 2043.0]}):
            with self.subTest(changes=changes):
                spec, probes, clock = self.fixture()
                probes.values["load_identity"].update(changes)
                result = preflight(spec, probes=probes, clock_us=clock)
                self.assertFalse(result.passed)
                self.assertIn("LOAD_IDENTITY", result.missing)

    def test_ubuntu_version_is_exact_and_not_an_unreviewed_family_match(self):
        for version in ("22.04", "24", "24.10", "24.04-extra", "unknown"):
            with self.subTest(version=version):
                spec, probes, clock = self.fixture(changes={"os_release": {"ID": "ubuntu", "VERSION_ID": version}})
                result = preflight(spec, probes=probes, clock_us=clock)
                self.assertFalse(result.passed)
                self.assertIn("UBUNTU_METADATA", result.missing)


class BoundedNativeProbeTest(unittest.TestCase):
    def supervisor(self, clock):
        result = P._BoundedNativeProbes(RunSpec.from_mapping(spec_mapping()), clock)
        result.platform = "linux"
        return result

    def mocked_syscalls(self, stack, *, reads=(), waits=(), selector=None):
        stack.enter_context(patch.object(P.os, "O_CLOEXEC", 1, create=True))
        stack.enter_context(patch.object(P.os, "O_NONBLOCK", 2, create=True))
        stack.enter_context(patch.object(P.os, "WNOHANG", 1, create=True))
        stack.enter_context(patch.object(P.signal, "SIGKILL", 9, create=True))
        stack.enter_context(patch.object(P.signal, "SIGCHLD", 17, create=True))
        stack.enter_context(patch.object(P.signal, "getsignal", return_value=P.signal.SIG_DFL))
        stack.enter_context(patch.object(P.os, "pipe2", return_value=(10, 11), create=True))
        fork = stack.enter_context(patch.object(P.os, "fork", return_value=555, create=True))
        stack.enter_context(patch.object(P.os, "close"))
        stack.enter_context(patch.object(P.os, "read", side_effect=list(reads)))
        wait = stack.enter_context(patch.object(P.os, "waitpid", side_effect=list(waits)))
        kill = stack.enter_context(patch.object(P.os, "kill"))
        select = stack.enter_context(patch.object(P.select, "select", side_effect=selector if selector else None,
                                                return_value=([10], [], [])))
        stack.enter_context(patch.object(P.os, "WIFEXITED", return_value=True, create=True))
        stack.enter_context(patch.object(P.os, "WEXITSTATUS", return_value=0, create=True))
        return fork, wait, kill, select

    def test_mocked_supervisor_consumes_one_own_wait_and_returns_bounded_json(self):
        clock = FakeClock()
        with ExitStack() as stack:
            fork, wait, kill, _ = self.mocked_syscalls(stack, reads=(b'{"value":"fixture-boot"}', b""), waits=((555, 0),))
            probe = self.supervisor(clock)
            self.assertEqual(probe.boot_id(), "fixture-boot")
            self.assertFalse(probe.unavailable)
            self.assertEqual(probe.waits, [{"requested_pid": 555, "returned_pid": 555, "raw_wait_status": 0, "consumed": True}])
            fork.assert_called_once_with()
            wait.assert_called_once_with(555, P.os.WNOHANG)
            kill.assert_not_called()

    def test_hung_pending_child_is_signaled_once_and_blocks_every_later_probe(self):
        clock = FakeClock(50500000)

        def timeout(*args):
            clock.value = 51000000
            return [], [], []

        with ExitStack() as stack:
            fork, _, kill, selected = self.mocked_syscalls(stack, waits=((0, 0), (0, 0), (0, 0)), selector=timeout)
            probe = self.supervisor(clock)
            with self.assertRaises(RuntimeError):
                probe.boot_id()
            self.assertTrue(probe.unavailable)
            self.assertEqual(probe.waits[-1], {"requested_pid": 555, "returned_pid": 0, "raw_wait_status": None, "consumed": False})
            with self.assertRaises(RuntimeError):
                probe.dependencies()
            fork.assert_called_once_with()
            kill.assert_called_once_with(555, 9)
            self.assertLessEqual(selected.call_args.args[3], 0.05)

    def test_native_supervisor_never_forks_after_original_work_cutoff(self):
        with patch.object(P.os, "fork", create=True) as fork, patch.object(P.signal, "SIGCHLD", 17, create=True), patch.object(P.signal, "getsignal", return_value=P.signal.SIG_DFL):
            probe = self.supervisor(FakeClock(51000000))
            with self.assertRaises(RuntimeError):
                probe.boot_id()
            fork.assert_not_called()

    def test_correct_reply_and_consumed_wait_after_deadline_are_still_unavailable(self):
        clock = FakeClock(50500000)

        def timeout(*args):
            clock.value = 51000000
            return [10], [], []

        with ExitStack() as stack:
            _, wait, kill, _ = self.mocked_syscalls(stack, reads=(b'{"value":"late-boot"}', b""), waits=((555, 0),), selector=timeout)
            probe = self.supervisor(clock)
            with self.assertRaises(RuntimeError):
                probe.boot_id()
            self.assertTrue(probe.unavailable)
            self.assertTrue(probe.waits[-1]["consumed"])
            wait.assert_called_once_with(555, P.os.WNOHANG)
            kill.assert_not_called()

    def test_default_windows_guard_precedes_pipe_or_fork(self):
        with patch.object(P.os, "fork", create=True) as fork, patch.object(P.os, "pipe2", create=True) as pipe:
            probe = self.supervisor(FakeClock())
            probe.platform = "win32"
            with self.assertRaises(RuntimeError):
                probe.boot_id()
            fork.assert_not_called()
            pipe.assert_not_called()

    def test_custom_or_ignored_sigchld_handler_blocks_fork_without_changing_the_handler(self):
        for handler in (P.signal.SIG_IGN, lambda *_: None):
            with self.subTest(handler=handler), patch.object(P.signal, "SIGCHLD", 17, create=True), patch.object(P.signal, "getsignal", return_value=handler), patch.object(P.signal, "signal") as change, patch.object(P.os, "fork", create=True) as fork:
                probe = self.supervisor(FakeClock())
                with self.assertRaises(RuntimeError):
                    probe.boot_id()
                fork.assert_not_called()
                change.assert_not_called()

    def test_echild_rejects_without_signaling_a_possibly_reused_numeric_pid(self):
        with ExitStack() as stack:
            fork, wait, kill, _ = self.mocked_syscalls(stack, reads=(b'{"value":"boot"}',), waits=(ChildProcessError("ECHILD"),))
            probe = self.supervisor(FakeClock())
            with self.assertRaises(RuntimeError):
                probe.boot_id()
            self.assertTrue(probe.unavailable)
            kill.assert_not_called()
            wait.assert_called_once_with(555, P.os.WNOHANG)
            with self.assertRaises(RuntimeError):
                probe.namespaces()
            fork.assert_called_once_with()

    def test_failed_fork_closes_both_pipe_descriptors_without_waiting_or_signaling(self):
        with ExitStack() as stack:
            fork, wait, kill, _ = self.mocked_syscalls(stack)
            close = stack.enter_context(patch.object(P.os, "close"))
            fork.side_effect = OSError("fixture fork unavailable")
            probe = self.supervisor(FakeClock())
            with self.assertRaises(OSError):
                probe.boot_id()
            self.assertEqual([call.args for call in close.call_args_list], [(10,), (11,)])
            wait.assert_not_called()
            kill.assert_not_called()


if __name__ == "__main__":
    unittest.main()
