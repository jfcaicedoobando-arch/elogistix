"""Native composition fixtures, with all external I/O replaced on Windows.

Nominal native classes are allocated without their constructors. Passing these
hermetic tests establishes no Linux capability, custody or runtime certificate.
"""
from contextlib import ExitStack, contextmanager
from copy import deepcopy
from dataclasses import replace
from pathlib import Path
from types import SimpleNamespace
import json
import sys
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
sys.path.insert(0, str(Path(__file__).resolve().parent))
from systemd_memory_runtime import __main__ as M
from systemd_memory_runtime import contracts as C
from systemd_memory_runtime import physical_cgroup as P
from systemd_memory_runtime import sd_bus_transport as T
from systemd_memory_runtime import systemd_backend as B
from systemd_memory_runtime.watchdog import Watchdog
import test_backend_faults as F


class NativeCompositionTests(unittest.TestCase):
    def setUp(self):
        self.patches = ExitStack()
        self.addCleanup(self.patches.close)
        self.clock = F.Clock()
        self.spec = replace(F.spec(), scope_ref=M._NativeCgroupPerimeter.SCOPE)
        self.manager = {
            "boot_id": F.BOOT, "bus_guid": "b" * 32,
            "owner_unique_name": ":1.2",
            "manager_pid_generation": {**F.WATCHDOG, "pid": 1, "start_ticks": "10"},
            "authority_lease_until_us": "60000000"}
        self.actual_manager = deepcopy(self.manager)
        # Explicit nominal fixtures: no native constructor, bus open or pidfd.
        self.driver = T._NativeBus.__new__(T._NativeBus)
        self.transport = T.SdBusTransport.__new__(T.SdBusTransport)
        self.transport._initialize(self.driver, self.clock, 60_000_000, False)
        self.transport.binding = deepcopy(self.manager)
        self.transport.units = F.NAMES
        self.transport.subscribed = True
        self.identity = B._NativeIdentity.__new__(B._NativeIdentity)
        self.backend = B.SystemdBackend.__new__(B.SystemdBackend)
        self.backend.spec = self.spec
        self.backend.transport, self.backend.identity = self.transport, self.identity
        self.backend.budget = self.transport.budget
        self.backend.watchdog_generation = deepcopy(F.WATCHDOG)
        self.backend.payload = deepcopy(F.PAYLOAD)
        self.backend.closed = self.backend.test_boundary = False
        self.backend.cleanup_started = False
        self.backend.invalid = None
        self.backend.manager_environment_fact = {"names": [], "assignments_ref": C.digest_record({"assignments": []})}
        self.backend.slots = [B._Slot() for _ in range(3)]
        self.backend.ready = B.BackendReady(deepcopy(self.manager), True, "a" * 64)
        self.pin = T.ProcessPin.__new__(T.ProcessPin)
        self.pin.generation = deepcopy(F.KEEPER)
        self.pin.closed = False
        self.pin.fd, self.pin.fd_identity = 99, (1, 2)
        self.pin.proc_identity = (3, 4)
        self.pin.ns = (F.KEEPER["pid_namespace_ref"], F.KEEPER["mount_namespace_ref"])
        self.unit = {
            "slot": 0, "name": F.NAMES[0], "object_path": T.unit_path(F.NAMES[0]),
            "invocation_id": "d" * 32, "manager_binding_ref": C.digest_record(self.manager),
            "control_group": "/system.slice/" + F.NAMES[0], "control_group_id": "1234",
            "keeper_generation_ref": C.digest_record(F.KEEPER)}
        state = self.backend.slots[0]
        state.binding, state.generation, state.pin = deepcopy(self.unit), deepcopy(F.KEEPER), self.pin
        state.expected_argv = (F.PAYLOAD["absolute_path"], "--fixture-only")
        # This nominal allocation bypasses constructors only for hermetic I/O.
        # Preserve the policy readbacks a real StartRequest would have fixed.
        state.expected_properties = (
            ("Environment", "as", T.SERVICE_ENVIRONMENT),
            ("PassEnvironment", "as", ()),
            ("EnvironmentFiles", "a(sb)", ()),
            ("PAMName", "s", ""),
            ("UnsetEnvironment", "as", T.SERVICE_UNSET_ENVIRONMENT),
        )
        self.snapshot = {
            "object_path": self.unit["object_path"],
            "unit": {"Id": F.NAMES[0], "InvocationID": self.unit["invocation_id"],
                     "ActiveState": "active", "SubState": "running", "Job": (0, "/"), "Transient": True},
            "service": {"MainPID": F.KEEPER["pid"], "ControlPID": 0,
                        "ControlGroup": self.unit["control_group"], "ControlGroupId": 1234,
                        "ExecStart": [{"path": F.PAYLOAD["absolute_path"],
                                       "argv": list(state.expected_argv), "ignore_failure": False}],
                        "ExecStartPre": [], "ExecStartPost": [], "ExecStop": [], "ExecStopPost": [],
                        "Type": "exec", "Restart": "no", "RemainAfterExit": False,
                        "NotifyAccess": "none", "KillMode": "control-group",
                        "Environment": list(T.SERVICE_ENVIRONMENT), "PassEnvironment": [],
                        "EnvironmentFiles": [], "PAMName": "",
                        "UnsetEnvironment": list(T.SERVICE_UNSET_ENVIRONMENT)}}
        self.patches.enter_context(patch.object(M.sys, "platform", "linux"))
        self.current_generation = self.patches.enter_context(patch.object(
            B._NativeIdentity, "current_generation", autospec=True, return_value=deepcopy(F.WATCHDOG)))
        self.workload = self.patches.enter_context(patch.object(
            B._NativeIdentity, "verify_workload", autospec=True))
        self.epoch = self.patches.enter_context(patch.object(
            T._NativeBus, "epoch", autospec=True,
            side_effect=lambda _driver, deadline: deepcopy(self.actual_manager)))
        self.request = self.patches.enter_context(patch.object(
            T._NativeBus, "request", autospec=True,
            side_effect=lambda _driver, request, deadline: deepcopy(self.snapshot)))
        self.io = {}
        original_stat = M.os.stat
        def deny_native_stat(path, *args, **kwargs):
            # unittest may stat source files while formatting an assertion. Those
            # Windows harness reads confer no native producer authority.
            if str(path).endswith(".py"):
                return original_stat(path, *args, **kwargs)
            raise AssertionError("forbidden native I/O: stat")
        self.io["stat"] = self.patches.enter_context(patch.object(M.os, "stat", side_effect=deny_native_stat))
        for name in ("open", "lstat", "fstat", "read", "write"):
            self.io[name] = self.patches.enter_context(patch.object(
                M.os, name, side_effect=AssertionError("forbidden native I/O: " + name)))
        self.cdll = self.patches.enter_context(patch.object(
            T.C, "CDLL", side_effect=AssertionError("forbidden libsystemd load")))
        self.capture = self.patches.enter_context(patch.object(
            M._NativeCgroupPerimeter, "capture", autospec=True,
            side_effect=lambda _perimeter, unit, deadline: {
                "kind": "FIXTURE_PROTECTION_CAPTURE", "unit_binding": deepcopy(unit),
                "started_ns": self.clock.value * 1000, "finished_ns": self.clock.value * 1000}))
        self.factory = self.make_factory()

    def make_factory(self):
        factory = M.create_native_physical_producer_factory(
            self.spec, backend=self.backend, physical_module=P)
        factory.clock = lambda: self.clock.value * 1000
        return factory

    def deadline_ns(self):
        return 50_000_000 * 1000

    @contextmanager
    def fresh_environment_case(self):
        """Each mismatch has independent, never-reset custody and sticky state."""
        # Autospec must target original functions rather than another fixture's
        # Mock. This case replaces the enclosing hermetic patch stack entirely.
        self.patches.close()
        fixture = NativeCompositionTests()
        fixture.setUp()
        try:
            yield fixture
        finally:
            fixture.doCleanups()

    def records(self, kind):
        return [item for item in self.factory.export_evidence()["records"]
                if item["record"].get("kind") == kind]

    def assert_no_external_io(self):
        for call in self.io.values():
            call.assert_not_called()
        self.cdll.assert_not_called()

    def pidfd_reads(self, readings=("Pid:\t33\n", "Pid:\t33\n")):
        """Replace syscalls below the original ProcessPin.released method."""
        stack = ExitStack()
        stack.enter_context(patch.object(T.os, "fstat", return_value=SimpleNamespace(st_dev=1, st_ino=2)))
        stack.enter_context(patch.object(T.os, "stat", return_value=SimpleNamespace(st_dev=3, st_ino=4)))
        stack.enter_context(patch.object(T, "_self_namespaces", return_value=self.pin.ns))
        stack.enter_context(patch.object(T, "_boot_id", return_value=F.BOOT))
        reads = stack.enter_context(patch.object(T, "bounded_read", side_effect=list(readings)))
        return stack, reads

    def test_construction_and_call_are_pure_exact_native_composition(self):
        factory = self.make_factory()
        producer = factory(self.spec)
        self.assertIs(type(producer), P.PhysicalProducer)
        self.assertIs(type(producer.filesystem), P.LinuxFilesystem)
        self.assertIs(producer.manager_binding.__self__, factory)
        self.assertIs(producer.identity_source.__self__, factory)
        self.assertIs(producer.keeper_observation.__self__, factory)
        self.assertIs(producer.absence_policy.__self__, factory)
        self.assertEqual(factory.export_evidence(), {"fixture_only": False, "records": []})
        self.epoch.assert_not_called()
        self.request.assert_not_called()
        self.current_generation.assert_not_called()
        self.assert_no_external_io()

    def test_windows_rejects_factory_before_probe(self):
        with patch.object(M.sys, "platform", "win32"):
            with self.assertRaisesRegex(ValueError, "PLATFORM_LINUX"):
                self.make_factory()
        self.epoch.assert_not_called()
        self.current_generation.assert_not_called()
        self.assert_no_external_io()

    def test_fake_boundary_and_nonnative_components_cannot_compose(self):
        cases = ((self.backend, "test_boundary", True),
                 (self.transport, "test_boundary", True),
                 (self.backend, "identity", object()),
                 (self.backend, "transport", object()),
                 (self.transport, "driver", object()),
                 (self.backend, "spec", None))
        for target, name, value in cases:
            with self.subTest(name=name), patch.object(target, name, value):
                with self.assertRaisesRegex(ValueError, "Original native backend"):
                    self.make_factory()
        fake_module = SimpleNamespace(__name__="foreign.physical", PhysicalProducer=P.PhysicalProducer,
                                      LinuxFilesystem=P.LinuxFilesystem)
        with self.assertRaisesRegex(ValueError, "Original physical producer module"):
            M.create_native_physical_producer_factory(self.spec, backend=self.backend, physical_module=fake_module)
        self.assert_no_external_io()

    def test_native_subclasses_do_not_supply_original_custody(self):
        class BackendSubclass(B.SystemdBackend):
            pass
        imposter = BackendSubclass.__new__(BackendSubclass)
        imposter.__dict__.update(self.backend.__dict__)
        with self.assertRaisesRegex(ValueError, "Original native backend"):
            M.create_native_physical_producer_factory(self.spec, backend=imposter, physical_module=P)
        self.assert_no_external_io()

    def test_manager_callback_is_lazy_and_requires_subscribed_preflight(self):
        for ready in (None, B.BackendReady(self.manager, False, "a" * 64)):
            self.backend.ready = ready
            with self.subTest(ready=ready), self.assertRaisesRegex(ValueError, "subscribed manager preflight"):
                self.factory.manager_binding(self.deadline_ns())
        self.epoch.assert_not_called()
        self.assertFalse(self.factory.records)
        self.assert_no_external_io()

    def test_manager_records_full_observation_and_returns_defensive_identity(self):
        observed = self.factory.manager_binding(self.deadline_ns())
        self.assertEqual(observed, self.manager)
        observed["owner_unique_name"] = ":1.99"
        record = self.factory.export_evidence()["records"][0]
        self.assertEqual(record["ref"], C.digest_record(record["record"]))
        self.assertEqual(record["record"]["manager_binding"], self.manager)
        self.assertEqual(record["record"]["watchdog_generation"], F.WATCHDOG)
        self.assertEqual(record["record"]["kind"], "NATIVE_MANAGER_OBSERVATION")
        self.assert_no_external_io()

    def test_manager_epoch_change_is_sticky_even_after_owner_returns(self):
        self.actual_manager["owner_unique_name"] = ":1.99"
        with self.assertRaisesRegex(T.TransportError, "MANAGER_IDENTITY_CHANGED"):
            self.factory.manager_binding(self.deadline_ns())
        self.actual_manager = deepcopy(self.manager)
        with self.assertRaisesRegex(B.BackendError, "MANAGER_IDENTITY_CHANGED"):
            self.factory.manager_binding(self.deadline_ns())
        self.assertEqual(self.backend.invalid, "MANAGER_IDENTITY_CHANGED")
        self.assertFalse(self.factory.records)

    def test_preflight_binding_mismatch_latches_backend_invalid(self):
        self.backend.ready = B.BackendReady({**self.manager, "owner_unique_name": ":1.99"}, True, "a" * 64)
        with self.assertRaisesRegex(ValueError, "Original manager binding changed"):
            self.factory.manager_binding(self.deadline_ns())
        rejected = self.records("NATIVE_MANAGER_BINDING_REJECTED")[0]
        self.assertEqual(rejected["record"]["observed_binding"], self.manager)
        self.assertEqual(rejected["ref"], C.digest_record(rejected["record"]))
        self.backend.ready = B.BackendReady(self.manager, True, "a" * 64)
        with self.assertRaisesRegex(ValueError, "custody changed"):
            self.factory.manager_binding(self.deadline_ns())
        self.assertEqual(self.backend.invalid, "MANAGER_IDENTITY_CHANGED")

    def test_original_backend_custody_changes_fail_before_observation(self):
        for target, name, value in ((self.backend, "identity", object()),
                                    (self.transport, "driver", object()),
                                    (self.backend, "closed", True),
                                    (self.backend, "watchdog_generation", {**F.WATCHDOG, "start_ticks": "91"}),
                                    (self.backend, "payload", {**F.PAYLOAD, "inode": "6"})):
            with self.subTest(name=name), patch.object(target, name, value):
                with self.assertRaisesRegex(ValueError, "custody changed"):
                    self.factory.manager_binding(self.deadline_ns())
        self.epoch.assert_not_called()
        self.assert_no_external_io()

    def test_deadline_shape_and_expired_budget_fail_before_manager_io(self):
        for deadline in (True, 0, -1, 100.0, C.U64_MAX * 1000 + 1, self.clock.value * 1000 + 999):
            with self.subTest(deadline=deadline), self.assertRaises((ValueError, T.TransportError)):
                self.factory.manager_binding(deadline)
        self.epoch.assert_not_called()
        self.assertFalse(self.factory.records)
        self.assert_no_external_io()

    def test_deadline_clamps_to_original_lease_and_cleanup_budget(self):
        self.backend.budget.lease = 1000
        self.factory.manager_binding(70_000_000 * 1000)
        self.assertEqual(self.epoch.call_args.args[1], 1000)
        self.clock.value = 1000
        with self.assertRaisesRegex(T.TransportError, "DEADLINE"):
            self.factory.manager_binding(70_000_000 * 1000)

    def test_deadline_exceeded_during_observation_never_records_success(self):
        def too_late(_driver, deadline):
            self.clock.value = deadline
            return deepcopy(self.manager)
        self.epoch.side_effect = too_late
        with self.assertRaisesRegex(T.TransportError, "DEADLINE"):
            self.factory.manager_binding(self.deadline_ns())
        self.assertFalse(self.factory.records)

    def test_unit_source_fetches_each_fresh_original_snapshot(self):
        source = self.factory.identity_source(self.unit, self.deadline_ns())
        self.request.assert_not_called()
        first = source.snapshot(self.deadline_ns())
        self.clock.value += 1
        second = source.snapshot(self.deadline_ns())
        self.assertIs(type(first), P.ManagerIdentity)
        self.assertEqual(first.control_group_id, 1234)
        self.assertEqual(first.unit_binding_ref, C.digest_record(self.unit))
        self.assertEqual(first.key(), second.key())
        self.assertNotEqual(first.source_ref, second.source_ref)
        self.assertEqual(self.request.call_count, 2)
        records = {item["ref"]: item["record"] for item in self.factory.export_evidence()["records"]}
        expected_snapshot = json.loads(json.dumps(self.snapshot))
        self.assertEqual(records[first.source_ref]["snapshot"], expected_snapshot)
        self.assertEqual(records[second.source_ref]["unit_binding"], self.unit)
        for observation in (first, second):
            successful = records[observation.source_ref]
            self.assertEqual(C.digest_record(successful), observation.source_ref)
            self.assertEqual(records[successful["snapshot_read_ref"]]["kind"], "NATIVE_UNIT_SNAPSHOT_READ")
            self.assertEqual(records[successful["snapshot_read_ref"]]["snapshot"], expected_snapshot)
        self.assert_no_external_io()

    def test_native_environment_readback_rejects_before_new_workload_observation(self):
        replacements = {
            "Environment": ["PATH=/PRIVATE-NATIVE-ENVIRONMENT"],
            "PassEnvironment": ["LD_PRELOAD"],
            "EnvironmentFiles": [["/PRIVATE-NATIVE-ENVIRONMENT", False]],
            "PAMName": "PRIVATE-NATIVE-ENVIRONMENT",
            "UnsetEnvironment": [],
        }
        for field, value in replacements.items():
            for missing in (True, False):
                with self.subTest(field=field, missing=missing), self.fresh_environment_case() as fixture:
                    source = fixture.factory.identity_source(fixture.unit, fixture.deadline_ns())
                    if missing:
                        fixture.snapshot["service"].pop(field)
                    else:
                        fixture.snapshot["service"][field] = value
                    expected_code = "UNIT_SNAPSHOT" if missing else "UNEXPECTED_EXECUTION_POLICY"
                    with self.assertRaisesRegex(B.BackendError, expected_code) as rejected:
                        source.snapshot(fixture.deadline_ns())
                    fixture.workload.assert_not_called()
                    fixture.capture.assert_called_once()
                    self.assertFalse(fixture.records("NATIVE_UNIT_OBSERVATION"))
                    self.assertNotIn("PRIVATE-NATIVE-ENVIRONMENT", str(rejected.exception))
                    self.assertNotIn("PRIVATE-NATIVE-ENVIRONMENT", json.dumps(fixture.factory.export_evidence()))
                    fixture.assert_no_external_io()

    def test_changed_environment_after_valid_snapshot_has_no_cached_success(self):
        source = self.factory.identity_source(self.unit, self.deadline_ns())
        source.snapshot(self.deadline_ns())
        original = deepcopy(self.records("NATIVE_UNIT_OBSERVATION"))
        self.clock.value += 1
        self.snapshot["service"]["Environment"] = ["PATH=/PRIVATE-NATIVE-ENVIRONMENT"]
        with self.assertRaisesRegex(B.BackendError, "UNEXPECTED_EXECUTION_POLICY"):
            source.snapshot(self.deadline_ns())
        self.assertEqual(self.records("NATIVE_UNIT_OBSERVATION"), original)
        self.assertEqual(self.request.call_count, 2)
        self.assertEqual(self.workload.call_count, 1)
        self.assertEqual(self.capture.call_count, 1)
        self.assertNotIn("PRIVATE-NATIVE-ENVIRONMENT", json.dumps(self.factory.export_evidence()))
        self.assert_no_external_io()

    def test_native_environment_array_readback_cannot_be_tuple_shaped(self):
        for field in ("Environment", "PassEnvironment", "EnvironmentFiles", "UnsetEnvironment"):
            with self.subTest(field=field), self.fresh_environment_case() as fixture:
                source = fixture.factory.identity_source(fixture.unit, fixture.deadline_ns())
                fixture.snapshot["service"][field] = tuple(fixture.snapshot["service"][field])
                with self.assertRaisesRegex(B.BackendError, "UNEXPECTED_EXECUTION_POLICY"):
                    source.snapshot(fixture.deadline_ns())
                fixture.workload.assert_not_called()
                fixture.capture.assert_called_once()
                fixture.assert_no_external_io()

    def test_native_environment_guard_is_required_without_cached_expected_properties(self):
        replacements = {"Environment": ["LD_PRELOAD=/fixture/not-read"], "PassEnvironment": ["LANG"],
                        "EnvironmentFiles": [["/fixture/not-read", True]], "PAMName": "fixture-pam",
                        "UnsetEnvironment": []}
        for field, value in replacements.items():
            for missing in (True, False):
                with self.subTest(field=field, missing=missing), self.fresh_environment_case() as fixture:
                    fixture.backend.slots[0].expected_properties = None
                    source = fixture.factory.identity_source(fixture.unit, fixture.deadline_ns())
                    if missing:
                        fixture.snapshot["service"].pop(field)
                    else:
                        fixture.snapshot["service"][field] = value
                    expected_code = "UNIT_SNAPSHOT" if missing else "UNEXPECTED_EXECUTION_POLICY"
                    with self.assertRaisesRegex(B.BackendError, expected_code):
                        source.snapshot(fixture.deadline_ns())
                    fixture.workload.assert_not_called()
                    fixture.capture.assert_called_once()
                    self.assertFalse(fixture.records("NATIVE_UNIT_OBSERVATION"))
                    fixture.assert_no_external_io()

    def test_cleared_group_after_valid_sample_fails_without_cached_fallback(self):
        source = self.factory.identity_source(self.unit, self.deadline_ns())
        source.snapshot(self.deadline_ns())
        count = len(self.factory.records)
        self.snapshot["unit"].update(ActiveState="inactive", SubState="dead")
        self.snapshot["service"].update(MainPID=0, ControlGroup="", ControlGroupId=0)
        with self.assertRaisesRegex(ValueError, "Fresh original cgroup manager identity unavailable"):
            source.snapshot(self.deadline_ns())
        self.assertEqual(len(self.factory.records), count + 1)
        self.assertEqual(len(self.records("NATIVE_UNIT_OBSERVATION")), 1)
        rejected = self.records("NATIVE_UNIT_SNAPSHOT_READ")[-1]
        self.assertEqual(rejected["record"]["snapshot"]["service"]["ControlGroup"], "")
        self.assertEqual(rejected["ref"], C.digest_record(rejected["record"]))
        self.assertEqual(self.request.call_count, 2)
        self.assertIsNone(self.backend.invalid)

    def test_no_such_unit_after_valid_sample_fails_without_cached_fallback(self):
        source = self.factory.identity_source(self.unit, self.deadline_ns())
        source.snapshot(self.deadline_ns())
        count = len(self.factory.records)
        self.request.side_effect = T.BusRemoteError("org.freedesktop.systemd1.NoSuchUnit")
        with self.assertRaises(T.BusRemoteError):
            source.snapshot(self.deadline_ns())
        self.assertEqual(len(self.factory.records), count + 1)
        self.assertEqual(len(self.records("NATIVE_UNIT_OBSERVATION")), 1)
        rejected = self.records("NATIVE_UNIT_SNAPSHOT_UNAVAILABLE")[0]
        self.assertEqual(rejected["record"]["error_type"], "BusRemoteError")
        self.assertEqual(rejected["ref"], C.digest_record(rejected["record"]))

    def test_replacement_invocation_latches_identity_failure(self):
        source = self.factory.identity_source(self.unit, self.deadline_ns())
        self.snapshot["unit"]["InvocationID"] = "f" * 32
        with self.assertRaisesRegex(B.BackendError, "UNIT_IDENTITY_CHANGED"):
            source.snapshot(self.deadline_ns())
        self.snapshot["unit"]["InvocationID"] = self.unit["invocation_id"]
        with self.assertRaisesRegex(ValueError, "custody changed"):
            source.snapshot(self.deadline_ns())
        self.assertFalse(self.records("NATIVE_UNIT_OBSERVATION"))
        self.assertEqual(self.records("NATIVE_UNIT_SNAPSHOT_READ")[0]["record"]["snapshot"]["unit"]["InvocationID"], "f" * 32)

    def test_manager_replaced_after_unit_read_retains_raw_snapshot_only(self):
        source = self.factory.identity_source(self.unit, self.deadline_ns())
        def replace_after_read(_identity, generation, payload, group, deadline):
            self.actual_manager["owner_unique_name"] = ":1.99"
        self.workload.side_effect = replace_after_read
        with self.assertRaisesRegex(T.TransportError, "MANAGER_IDENTITY_CHANGED"):
            source.snapshot(self.deadline_ns())
        self.assertFalse(self.records("NATIVE_UNIT_OBSERVATION"))
        self.assertEqual(len(self.records("NATIVE_UNIT_SNAPSHOT_READ")), 1)
        self.actual_manager = deepcopy(self.manager)
        with self.assertRaisesRegex(B.BackendError, "MANAGER_IDENTITY_CHANGED"):
            source.snapshot(self.deadline_ns())

    def test_run_spec_changed_at_pure_call_is_rejected_without_probe(self):
        changed = C.RunSpec.from_mapping({**self.spec.to_mapping(), "scope_ref": "different-fixture-scope"})
        with self.assertRaisesRegex(ValueError, "RunSpec changed"):
            self.factory(changed)
        self.epoch.assert_not_called()
        self.request.assert_not_called()
        self.assert_no_external_io()

    def test_keeper_requires_original_pin_on_both_sides_and_workload_verification(self):
        stack, reads = self.pidfd_reads()
        with stack:
            result = self.factory.keeper_observation(F.KEEPER, self.deadline_ns())
        self.assertIs(type(result), P.KeeperObservation)
        self.assertEqual(result.generation, F.KEEPER)
        self.assertEqual(reads.call_count, 2)
        for call in reads.call_args_list:
            self.assertEqual(call.args, ("/proc/self/fdinfo/99", 4096))
        self.workload.assert_called_once_with(self.identity, F.KEEPER, self.backend.payload,
                                             self.unit["control_group"], 1_000_100)
        record = self.records("NATIVE_KEEPER_OBSERVATION")[0]
        self.assertEqual(record["ref"], result.source_ref)
        self.assertEqual(record["ref"], C.digest_record(record["record"]))
        self.assertFalse(record["record"]["pidfd_before"]["released"])
        self.assertFalse(record["record"]["pidfd_after"]["released"])
        self.assertEqual(record["record"]["unit_binding"], self.unit)
        records = {item["ref"]: item["record"] for item in self.factory.export_evidence()["records"]}
        for position in ("before", "after"):
            raw = records[record["record"]["pidfd_" + position + "_ref"]]
            self.assertEqual(raw["kind"], "NATIVE_KEEPER_PIDFD_READ")
            self.assertEqual(raw["position"], position)
            self.assertEqual(raw["observation"], record["record"]["pidfd_" + position])

    def test_keeper_release_before_or_after_workload_is_not_live_success(self):
        for readings, expected_workload_calls in ((("Pid:\t-1\n",), 0),
                                                  (("Pid:\t33\n", "Pid:\t-1\n"), 1)):
            self.workload.reset_mock()
            stack, _ = self.pidfd_reads(readings)
            with self.subTest(readings=readings), stack, self.assertRaisesRegex(ValueError, "no longer live|changed during"):
                self.factory.keeper_observation(F.KEEPER, self.deadline_ns())
            self.assertEqual(self.workload.call_count, expected_workload_calls)
            self.assertFalse(self.records("NATIVE_KEEPER_OBSERVATION"))
            raw = self.records("NATIVE_KEEPER_PIDFD_READ")[-1]
            self.assertTrue(raw["record"]["observation"]["released"])
            self.assertEqual(raw["ref"], C.digest_record(raw["record"]))

    def test_keeper_generation_changed_during_verification_is_not_accepted(self):
        def replace(_identity, generation, payload, group, deadline):
            self.backend.slots[0].generation = {**F.KEEPER, "start_ticks": "96"}
        self.workload.side_effect = replace
        stack, _ = self.pidfd_reads()
        with stack, self.assertRaisesRegex(ValueError, "Original keeper authority changed"):
            self.factory.keeper_observation(F.KEEPER, self.deadline_ns())
        self.assertFalse(self.records("NATIVE_KEEPER_OBSERVATION"))
        self.assertEqual(len(self.records("NATIVE_KEEPER_PIDFD_READ")), 2)

    def test_keeper_exec_or_original_pidfd_failure_cannot_make_evidence(self):
        self.workload.side_effect = B.BackendError("KEEPER_EXEC_IDENTITY")
        stack, reads = self.pidfd_reads(("Pid:\t33\n",))
        with stack, self.assertRaisesRegex(B.BackendError, "KEEPER_EXEC_IDENTITY"):
            self.factory.keeper_observation(F.KEEPER, self.deadline_ns())
        self.assertEqual(reads.call_count, 1)
        self.workload.side_effect = None
        stack, _ = self.pidfd_reads(("Pid:\t99\n",))
        with stack, self.assertRaisesRegex(T.TransportError, "PIDFD_IDENTITY"):
            self.factory.keeper_observation(F.KEEPER, self.deadline_ns())
        self.assertFalse(self.records("NATIVE_KEEPER_OBSERVATION"))
        self.assertEqual(len(self.records("NATIVE_KEEPER_PIDFD_READ")), 1)

    def test_unregistered_closed_or_foreign_keeper_pin_is_rejected_before_read(self):
        for generation in ({**F.KEEPER, "start_ticks": "96"}, {**F.KEEPER, "pid": 99}):
            with self.subTest(generation=generation), self.assertRaisesRegex(ValueError, "registered keeper"):
                self.factory.keeper_observation(generation, self.deadline_ns())
        for pin in (SimpleNamespace(closed=False, generation=F.KEEPER), None):
            with self.subTest(pin=pin), patch.object(self.backend.slots[0], "pin", pin):
                with self.assertRaisesRegex(ValueError, "native keeper pidfd|retained keeper"):
                    self.factory.keeper_observation(F.KEEPER, self.deadline_ns())
        self.pin.closed = True
        with self.assertRaisesRegex(ValueError, "retained keeper"):
            self.factory.keeper_observation(F.KEEPER, self.deadline_ns())
        self.assert_no_external_io()

    def test_exporter_keeps_full_records_digest_and_defensive_copies(self):
        source = {"kind": "FIXTURE_LOCAL_RECORD", "nested": {"values": [1, "ñ"]}}
        ref = self.factory._put(source)
        count = self.factory.record_bytes
        self.assertEqual(self.factory._put(deepcopy(source)), ref)
        self.assertEqual(self.factory.record_bytes, count)
        source["nested"]["values"].append("caller-change")
        exported = self.factory.export_evidence()
        self.assertEqual(exported["records"][0]["ref"], C.digest_record(exported["records"][0]["record"]))
        exported["records"][0]["record"]["nested"]["values"].append("export-change")
        retained = self.factory.export_evidence()["records"][0]["record"]
        self.assertEqual(retained["nested"]["values"], [1, "ñ"])

    def test_evidence_capacity_stops_before_new_native_observation(self):
        self.factory.records = {str(i): b"{}" for i in range(self.factory.MAX_RECORDS)}
        with self.assertRaisesRegex(ValueError, "capacity exhausted"):
            self.factory.manager_binding(self.deadline_ns())
        self.epoch.assert_not_called()
        self.factory.records = {}
        self.factory.record_bytes = M.STORE_LIMIT - 65536 + 1
        with self.assertRaisesRegex(ValueError, "capacity exhausted"):
            self.factory.manager_binding(self.deadline_ns())
        self.epoch.assert_not_called()
        self.assert_no_external_io()

    def test_pure_compose_sets_filesystem_provenance_before_watchdog_snapshot(self):
        uncomposed = P.RuntimePhysicalObserver(self.spec, producer_factory=self.factory)
        self.assertTrue(uncomposed.fixture_only)
        self.assertIsNone(uncomposed._producer)
        observer = M.create_runtime_observer(self.spec, observer_type=P.RuntimePhysicalObserver,
                                             producer_factory=self.factory)
        self.assertIs(type(observer._producer.filesystem), P.LinuxFilesystem)
        self.assertFalse(observer.fixture_only)
        self.assertFalse(observer.test_boundary)
        watchdog = Watchdog(self.spec, backend=self.backend, observer=observer, clock=self.clock)
        self.assertFalse(watchdog.fixture_only)
        self.assertEqual(watchdog.state, "PRECHECK")
        self.assertIsNone(observer._root)
        self.assertIsNone(observer._manager)
        self.assertEqual(observer.export_producer_evidence(), self.factory.export_evidence())
        self.epoch.assert_not_called()
        self.request.assert_not_called()
        self.assert_no_external_io()

    def test_injected_filesystem_stays_fixture_even_with_all_callback_names(self):
        class FilesystemSubclass(P.LinuxFilesystem):
            pass
        producer = P.PhysicalProducer(self.factory.manager_binding, self.factory.identity_source,
                                      self.factory.keeper_observation, filesystem=FilesystemSubclass())
        observer = P.RuntimePhysicalObserver(self.spec, producer_factory=lambda _spec: producer)
        observer._compose()
        self.assertTrue(observer.fixture_only)
        self.assertTrue(observer.test_boundary)
        self.assertTrue(Watchdog(self.spec, observer=observer, clock=self.clock).fixture_only)
        self.assert_no_external_io()


if __name__ == "__main__":
    unittest.main()
