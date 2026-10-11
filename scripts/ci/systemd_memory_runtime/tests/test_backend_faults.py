"""Explicit fake-boundary fault cases. No native units or Linux probes run."""
import copy
from contextlib import ExitStack
import importlib
import json
from pathlib import Path
import sys
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
sys.path.insert(0, str(Path(__file__).resolve().parent))
from test_transport import FakeBusTestBoundary, Clock, BOOT, RUN, NAMES, T
B = importlib.import_module("systemd_memory_runtime.systemd_backend")
K = importlib.import_module("systemd_memory_runtime.contracts")

WATCHDOG = {"pid": 22, "start_ticks": "90", "boot_id": BOOT, "pid_namespace_ref": "pid:[1]", "mount_namespace_ref": "mnt:[2]"}
KEEPER = {**WATCHDOG, "pid": 33, "start_ticks": "95"}
PAYLOAD = {"kind": "VERIFIED_STAGED_ELF", "sha256": "e" * 64, "absolute_path": "/run/elogistix-memory-" + RUN + "/keeper", "dev": "4", "inode": "5", "mount_namespace_ref": "mnt:[2]", "owner_uid": 0, "protected_ancestor_refs": ["ancestor:root"], "exec_identity_proof_ref": "PENDING_BEFORE_EXEC"}


def spec():
    return K.RunSpec.from_mapping({"run": RUN, "t0_us": "0", "work_deadline_us": "50000000", "cleanup_deadline_us": "60000000", "slots": [{"slot": i, "unit_name": NAMES[i], "scenario": scenario, "memory_max_bytes": K.MEMORY_MAX_BYTES, "tasks_max": 8} for i, scenario in enumerate(("OVERLAP", "LEADER_EXIT_THREAD_SURVIVES", "DESCENDANT_IGNORES_TERM"))], "load_uid": 1001, "load_gid": 1001, "load_groups": [1001], "payload_expected_sha256": "e" * 64, "cleanup_policy_id": "physical-cleanup-union-v1", "scope_ref": "scope:authorized-test"})


class FakePinTestBoundary:
    def __init__(self, generation):
        self.generation = generation
        self.closed = False
    def close(self): self.closed = True


class FakeIdentityTestBoundary:
    """No authenticity asserted. Native methods are separately tested with fakes."""
    def __init__(self, clock):
        self.clock, self.current = clock, copy.deepcopy(WATCHDOG)
        self.released = False
        self.workload_error = None
        self.payload_error = None
        self.pins, self.calls = [], []
    def current_generation(self): return copy.deepcopy(self.current)
    def verify_payload(self, binding, run, expected, deadline):
        self.calls.append("payload")
        if self.payload_error: raise B.BackendError(self.payload_error)
    def verify_listener(self, path, run, deadline): self.calls.append("listener")
    def policy(self, paths, names, deadline):
        self.calls.append(("policy", names))
        return {"fake_policy": "hermetic-only"}
    def verify_workload(self, generation, payload, group, deadline):
        self.calls.append("workload")
        if self.workload_error: raise B.BackendError(self.workload_error)
    def pin(self, generation, deadline):
        pin = FakePinTestBoundary(generation)
        self.pins.append(pin)
        return pin
    def release_fact(self, pin, deadline):
        if not self.released: return None
        return {"tag": "PIDFD_TASK_RELEASED", "original_process_generation": pin.generation, "pidfd_identity_ref": "pidfd:test:33", "procfs_namespace_ref": pin.generation["pid_namespace_ref"], "fdinfo_pid": -1, "retained_original": True, "not_closed_or_reused": True, "before_us": str(self.clock.value), "after_us": str(self.clock.value)}
    def close(self): self.calls.append("close")


class BackendFaultTests(unittest.TestCase):
    def setUp(self):
        self.clock, self.driver = Clock(), None
        self.driver = FakeBusTestBoundary(self.clock)
        self.transport = T.SdBusTransport.for_test_boundary(self.driver, authority_lease_until_us=60_000_000, clock_us=self.clock)
        self.identity = FakeIdentityTestBoundary(self.clock)
        self.backend = B.SystemdBackend.for_test_boundary(self.transport, spec(), keeper_listener_path="/run/elogistix-memory-" + RUN + "/keeper.sock", watchdog_generation=WATCHDOG, payload_binding=PAYLOAD, identity=self.identity, clock_us=self.clock)
        self.backend.preflight(spec(), 50_000_000)
        for slot in range(3): self.backend.reserve_start(slot, str(slot + 1) * 64)

    def start(self, slot=0):
        self.driver.reply = "/org/freedesktop/systemd1/job/" + str(slot + 1)
        return self.backend.start_reserved(slot, PAYLOAD, 50_000_000)

    def _snapshot_without_limits(self, *, terminal=False):
        return {"object_path": T.unit_path(NAMES[0]), "unit": {"Id": NAMES[0], "InvocationID": "d" * 32, "ActiveState": "inactive" if terminal else "active", "SubState": "dead" if terminal else "running", "Job": (0, "/"), "Transient": True}, "service": {"MainPID": 0 if terminal else 33, "ControlPID": 0, "ControlGroup": "/system.slice/" + NAMES[0], "ControlGroupId": 1234, "ExecStart": [{"path": PAYLOAD["absolute_path"], "argv": list(self.backend._argv(0)), "ignore_failure": False}], "ExecStartPre": [], "ExecStartPost": [], "ExecStop": [], "ExecStopPost": [], "Type": "exec", "Restart": "no", "RemainAfterExit": False, "NotifyAccess": "none", "KillMode": "control-group", "ExecMainPID": 33, "ExecMainCode": 1 if terminal else 0, "ExecMainStatus": 0, "ExecMainStartTimestampMonotonic": 50, "ExecMainExitTimestampMonotonic": 90 if terminal else 0}}

    def snapshot(self, *, terminal=False, backend=None):
        result = self._snapshot_without_limits(terminal=terminal)
        for name, signature, value in (backend or self.backend).slots[0].expected_properties or ():
            if name != "ExecStart":
                target = result["unit"] if name == "DefaultDependencies" else result["service"]
                target[name] = list(value) if signature in ("as", "a(sb)") else value
        return result

    def unarmed_with_policy(self, policy):
        """A fresh explicit fake boundary; no previous policy may authorize it."""
        clock = Clock()
        driver = FakeBusTestBoundary(clock)
        route = driver.request
        def request(value, deadline):
            reply = route(value, deadline)
            return copy.deepcopy(policy) if isinstance(value, T.ManagerPolicyRequest) else reply
        driver.request = request
        transport = T.SdBusTransport.for_test_boundary(driver, authority_lease_until_us=60_000_000,
                                                      clock_us=clock)
        identity = FakeIdentityTestBoundary(clock)
        backend = B.SystemdBackend.for_test_boundary(
            transport, spec(), keeper_listener_path="/run/elogistix-memory-" + RUN + "/keeper.sock",
            watchdog_generation=WATCHDOG, payload_binding=PAYLOAD, identity=identity, clock_us=clock)
        return backend, driver, identity, clock

    @staticmethod
    def manager_policy(environment):
        return {"UnitPath": ["/etc/systemd/system"], "Environment": environment}

    def bind(self):
        self.start()
        self.driver.reply = self.snapshot()
        candidate = self.backend.observe_candidate(0, 50_000_000)
        binding = self.backend.bind_unit(0, KEEPER, 50_000_000)
        return candidate, binding

    def events(self, *ids):
        self.driver.events += [{"job_id": i, "job_path": "/org/freedesktop/systemd1/job/" + str(i), "unit_name": NAMES[0], "result": "done", "owner_unique_name": ":1.2", "observed_us": self.clock.value} for i in ids]

    def test_no_native_backend_on_windows_or_fake_transport(self):
        with patch.object(B.sys, "platform", "win32"):
            with self.assertRaisesRegex(B.BackendError, "PLATFORM_LINUX"):
                B.SystemdBackend(self.transport, spec(), keeper_listener_path="x", watchdog_generation=WATCHDOG, payload_binding=PAYLOAD)

    def test_start_unknown_consumes_slot_no_retry_no_fourth(self):
        self.driver.request_error = T.TransportError("NO_REPLY", uncertain=True)
        # Manager policy must succeed; fault only the mutating RPC.
        original = self.driver.request
        def route(request, deadline):
            if isinstance(request, T.ManagerPolicyRequest): return {"UnitPath": ["/etc/systemd/system"], "Environment": []}
            return original(request, deadline)
        self.driver.request = route
        outcome = self.start()
        self.assertEqual(outcome.state, "UNKNOWN")
        self.assertTrue(self.backend.slots[0].start_attempted)
        self.assertIsNone(outcome.job_ref)
        with self.assertRaisesRegex(B.BackendError, "START_NOT_ALLOWED"): self.start()
        with self.assertRaisesRegex(B.BackendError, "SLOT"): self.start(3)

    def test_reservation_required_before_mutation(self):
        self.backend.slots[0].reservation = None
        with self.assertRaisesRegex(B.BackendError, "START_NOT_ALLOWED"): self.start()
        self.assertNotIn("StartRequest", self.driver.log)

    def test_budget_cutoff_and_original_runtime_timer(self):
        self.clock.value = 10_000_000
        self.start()
        self.assertEqual(self.backend.slots[0].expected_argv[8:13], ("0", "--work-deadline-us", "50000000", "--cleanup-deadline-us", "60000000"))
        self.clock.value = 44_500_000
        with self.assertRaisesRegex(B.BackendError, "NO_START_BUDGET"): self.start(1)
        self.assertFalse(self.backend.slots[1].start_attempted)

    def test_cleanup_irreversible_and_same_watchdog_generation(self):
        self.backend.begin_cleanup()
        with self.assertRaisesRegex(B.BackendError, "START_NOT_ALLOWED"): self.start()
        self.identity.current["start_ticks"] = "91"
        with self.assertRaisesRegex(B.BackendError, "WATCHDOG_GENERATION"): self.backend.poll_events(60_000_000)
        self.identity.current = WATCHDOG.copy()
        with self.assertRaisesRegex(B.BackendError, "WATCHDOG_GENERATION"): self.backend.poll_events(60_000_000)

    def test_candidate_has_real_pid_before_authenticated_binding(self):
        candidate, binding = self.bind()
        self.assertEqual(candidate["main_pid"], 33)
        self.assertNotIn("keeper_generation_ref", candidate)
        self.assertNotIn("main_pid", binding)
        self.assertEqual(binding["keeper_generation_ref"], K.digest_record(KEEPER))
        self.assertEqual(binding["control_group_id"], "1234")
        self.assertNotEqual(binding["control_group_id"], PAYLOAD["inode"])

    def test_bind_rejects_claimed_peer_pid_or_executable(self):
        self.start()
        self.driver.reply = self.snapshot()
        self.backend.observe_candidate(0, 50_000_000)
        with self.assertRaisesRegex(B.BackendError, "KEEPER_UNIT_IDENTITY_CHANGED"):
            self.backend.bind_unit(0, {**KEEPER, "pid": 99}, 50_000_000)

    def test_executable_generation_failure_before_pin(self):
        self.start()
        self.driver.reply = self.snapshot()
        self.backend.observe_candidate(0, 50_000_000)
        self.identity.workload_error = "KEEPER_EXEC_IDENTITY"
        with self.assertRaisesRegex(B.BackendError, "KEEPER_EXEC_IDENTITY"):
            self.backend.bind_unit(0, KEEPER, 50_000_000)
        self.assertFalse(self.identity.pins)

    def test_early_job_removed_is_retained_then_correlated(self):
        self.events(1)
        self.backend.poll_events(50_000_000)
        self.start()
        receipt = self.backend._settlement(0, "start")
        self.assertEqual(receipt["event"]["job_id"], 1)
        self.assertEqual(receipt["request_ref"], self.backend.slots[0].start_request_ref)

    def test_foreign_job_not_original_settlement(self):
        self.start()
        self.events(17)
        self.backend.poll_events(50_000_000)
        self.assertIsNone(self.backend._settlement(0, "start"))

    def test_conflicting_job_receipt_sticky_invalid(self):
        self.start()
        self.events(1)
        self.backend.poll_events(50_000_000)
        self.clock.value = 101
        self.events(1)
        with self.assertRaisesRegex(B.BackendError, "JOB_RECEIPT_CONFLICT"):
            self.backend.poll_events(50_000_000)

    def test_replacement_invocation_sticky_invalid(self):
        _, binding = self.bind()
        self.driver.reply["unit"]["InvocationID"] = "f" * 32
        with self.assertRaisesRegex(B.BackendError, "UNIT_IDENTITY_CHANGED"):
            self.backend.stop_once(binding, 60_000_000)
        self.driver.reply["unit"]["InvocationID"] = "d" * 32
        with self.assertRaisesRegex(B.BackendError, "UNIT_IDENTITY_CHANGED"):
            self.backend.cleanup_receipts(0, 60_000_000)

    def test_stop_one_shot_unknown_is_consumed(self):
        _, binding = self.bind()
        original = self.driver.request
        def route(request, deadline):
            if isinstance(request, T.StopRequest): raise T.TransportError("NO_REPLY", uncertain=True)
            return original(request, deadline)
        self.driver.request = route
        outcome = self.backend.stop_once(binding, 60_000_000)
        self.assertEqual(outcome.state, "UNKNOWN")
        self.assertTrue(self.backend.slots[0].stop_attempted)
        with self.assertRaisesRegex(B.BackendError, "STOP_NOT_ALLOWED"):
            self.backend.stop_once(binding, 60_000_000)

    def test_main_exit_snapshot_is_not_reaping(self):
        self.bind()
        self.driver.reply = self.snapshot(terminal=True)
        self.events(1)
        result = self.backend.cleanup_receipts(0, 60_000_000)
        self.assertIsNotNone(self.backend.slots[0].exit_fact)
        self.assertTrue(result["terminal_no_pending_execution"])
        self.assertFalse(result["keeper_reaped"])
        self.assertIsNone(result["keeper_reap_receipt"])

    def test_combined_original_exit_and_fdinfo_release_fact(self):
        self.bind()
        self.driver.reply = self.snapshot(terminal=True)
        self.identity.released = True
        self.events(1)
        result = self.backend.cleanup_receipts(0, 60_000_000)
        self.assertTrue(result["keeper_reaped"])
        facts = result["keeper_reap_receipt"]
        K.validate_main_release_facts(facts["systemd_main_exit"], facts["pidfd_task_released"])
        self.assertFalse(result["stop_settled"])

    def test_no_such_unit_is_not_final_terminal_or_reap(self):
        self.bind()
        original = self.driver.request
        def route(request, deadline):
            if isinstance(request, T.SnapshotRequest): raise T.BusRemoteError("org.freedesktop.systemd1.NoSuchUnit")
            return original(request, deadline)
        self.driver.request = route
        result = self.backend.cleanup_receipts(0, 60_000_000)
        self.assertFalse(result["terminal_no_pending_execution"])
        self.assertFalse(result["keeper_reaped"])
        self.assertIn("FINAL_UNIT_UNAVAILABLE", result["missing_evidence"])

    def test_pending_job_or_control_process_not_terminal(self):
        self.bind()
        self.driver.reply = self.snapshot(terminal=True)
        self.driver.reply["unit"]["Job"] = (4, "/org/freedesktop/systemd1/job/4")
        result = self.backend.cleanup_receipts(0, 60_000_000)
        self.assertFalse(result["terminal_no_pending_execution"])

    def test_same_invocation_terminal_paired_clear_is_only_manager_fact(self):
        self.bind()
        self.driver.reply = self.snapshot(terminal=True)
        self.driver.reply["service"]["ControlGroup"] = ""
        self.driver.reply["service"]["ControlGroupId"] = 0
        result = self.backend.cleanup_receipts(0, 60_000_000)
        self.assertTrue(result["terminal_no_pending_execution"])
        self.assertFalse(result["keeper_reaped"])
        self.assertNotIn("physical", result)
        self.assertIsNone(self.backend.invalid)

    def test_partial_clear_or_nonempty_replacement_invalid(self):
        self.bind()
        self.driver.reply = self.snapshot(terminal=True)
        self.driver.reply["service"]["ControlGroup"] = ""
        with self.assertRaisesRegex(B.BackendError, "UNIT_IDENTITY_CHANGED"):
            self.backend.cleanup_receipts(0, 60_000_000)
        self.assertEqual(self.backend.invalid, "UNIT_IDENTITY_CHANGED")

    def test_actual_memory_tasks_and_timer_must_match_before_binding(self):
        self.start()
        self.driver.reply = self.snapshot()
        self.driver.reply["service"]["MemoryMax"] = K.MEMORY_MAX_BYTES + 1
        with self.assertRaisesRegex(B.BackendError, "UNEXPECTED_EXECUTION_POLICY"):
            self.backend.observe_candidate(0, 50_000_000)
        self.assertIsNone(self.backend.slots[0].binding)

    def test_previous_80_mib_readback_cannot_bind_when_32_mib_was_requested(self):
        self.start()
        requested = {name: (signature, value) for name, signature, value in self.backend.slots[0].expected_properties}
        self.assertEqual(requested["MemoryMax"], ("t", 33_554_432))
        self.driver.reply = self.snapshot()
        self.driver.reply["service"]["MemoryMax"] = 83_886_080
        with self.assertRaisesRegex(B.BackendError, "UNEXPECTED_EXECUTION_POLICY"):
            self.backend.observe_candidate(0, 50_000_000)
        slot = self.backend.slots[0]
        self.assertIsNone(slot.candidate)
        self.assertIsNone(slot.binding)
        self.assertIsNone(slot.generation)
        self.assertIsNone(slot.pin)
        self.assertEqual(self.identity.pins, [])
        self.assertNotIn("workload", self.identity.calls)
        with self.assertRaisesRegex(B.BackendError, "UNEXPECTED_EXECUTION_POLICY"):
            self.backend.bind_unit(0, KEEPER, 50_000_000)

    def test_default_dependencies_readback_is_required_on_unit_not_service(self):
        self.start()
        self.driver.reply = self.snapshot()
        self.driver.reply["unit"]["DefaultDependencies"] = True
        self.driver.reply["service"]["DefaultDependencies"] = False
        with self.assertRaisesRegex(B.BackendError, "UNEXPECTED_EXECUTION_POLICY"):
            self.backend.observe_candidate(0, 50_000_000)
        self.assertIsNone(self.backend.slots[0].binding)

    def test_reserved_cancelled_before_start_can_release_without_unit_graph(self):
        self.backend.begin_cleanup()
        receipt = self.backend.release_receipt(0, 60_000_000)
        self.assertEqual(receipt["basis"], "RESERVED_NOT_DISPATCHED")
        self.assertTrue(receipt["no_future_own_exec"])
        self.assertIsNone(receipt["cleanup_receipts"])
        self.assertEqual(receipt["payload_binding_ref"], K.digest_record(PAYLOAD))
        self.assertNotIn("SnapshotRequest", self.driver.log)
        self.assertNotIn("StartRequest", self.driver.log)
        self.assertNotIn("StopRequest", self.driver.log)

    def test_prearm_failure_after_auth_preserves_undispatched_basis(self):
        self.backend.ready = None
        self.backend.slots[0].reservation = None
        self.backend.begin_cleanup()
        receipt = self.backend.release_receipt(0, 60_000_000)
        self.assertEqual(receipt["basis"], "NOT_RESERVED_NOT_DISPATCHED")
        self.assertTrue(receipt["no_future_own_exec"])

    def test_unknown_start_cannot_be_called_undispatched_or_released(self):
        original = self.driver.request
        def route(request, deadline):
            if isinstance(request, T.StartRequest): raise T.TransportError("NO_REPLY", uncertain=True)
            return original(request, deadline)
        self.driver.request = route
        self.start()
        self.backend.begin_cleanup()
        receipt = self.backend.release_receipt(0, 60_000_000)
        self.assertEqual(receipt["basis"], "START_DISPATCHED_UNKNOWN")
        self.assertFalse(receipt["no_future_own_exec"])
        self.assertIsNone(receipt["cleanup_receipts"])

    def test_release_requires_irreversible_cleanup_and_live_manager_authority(self):
        with self.assertRaisesRegex(B.BackendError, "RELEASE_REQUIRES_CLEANUP"):
            self.backend.release_receipt(0, 60_000_000)
        self.backend.begin_cleanup()
        self.transport.binding = None
        with self.assertRaisesRegex(B.BackendError, "MANAGER_AUTHORITY_UNAVAILABLE"):
            self.backend.release_receipt(0, 60_000_000)

    def test_release_expired_or_replaced_manager_never_accepted(self):
        self.backend.begin_cleanup()
        self.driver.binding["owner_unique_name"] = ":1.99"
        with self.assertRaisesRegex(T.TransportError, "MANAGER_IDENTITY_CHANGED"):
            self.backend.release_receipt(0, 60_000_000)

    def test_dispatched_bound_release_requires_full_original_graph(self):
        self.bind()
        self.driver.reply = self.snapshot(terminal=True)
        self.identity.released = True
        self.backend.begin_cleanup()
        self.events(1)
        receipt = self.backend.release_receipt(0, 60_000_000)
        self.assertEqual(receipt["basis"], "START_DISPATCHED_BOUND")
        self.assertFalse(receipt["no_future_own_exec"])
        self.assertTrue(receipt["cleanup_receipts"]["keeper_reaped"])
        self.assertFalse(receipt["cleanup_receipts"]["stop_settled"])

    def test_dispatched_bound_release_accepts_only_full_original_graph(self):
        _, binding = self.bind()
        original = self.driver.request
        def route(request, deadline):
            if isinstance(request, T.StopRequest): return "/org/freedesktop/systemd1/job/2"
            return original(request, deadline)
        self.driver.request = route
        self.backend.stop_once(binding, 60_000_000)
        self.driver.reply = self.snapshot(terminal=True)
        self.identity.released = True
        self.events(1, 2)
        receipt = self.backend.release_receipt(0, 60_000_000)
        self.assertEqual(receipt["basis"], "START_DISPATCHED_BOUND")
        self.assertTrue(receipt["no_future_own_exec"])
        self.assertTrue(all(receipt["cleanup_receipts"][key] for key in ("activations_settled", "stop_settled", "terminal_no_pending_execution", "keeper_reaped")))

    def full_cleanup_graph(self):
        _, binding = self.bind()
        original = self.driver.request
        def route(request, deadline):
            if isinstance(request, T.StopRequest): return "/org/freedesktop/systemd1/job/2"
            return original(request, deadline)
        self.driver.request = route
        self.backend.stop_once(binding, 60_000_000)
        self.driver.reply = self.snapshot(terminal=True)
        self.identity.released = True
        self.events(1, 2)
        return self.backend.cleanup_receipts(0, 60_000_000)

    def test_original_terminal_retained_after_unload_has_no_missing_evidence(self):
        graph = self.full_cleanup_graph()
        retained = copy.deepcopy(graph["final_unit_receipt"])
        self.assertTrue(self.backend.validate_release_graph(0, graph, 60_000_000))
        original = self.driver.request
        def route(request, deadline):
            if isinstance(request, T.SnapshotRequest): raise T.BusRemoteError("org.freedesktop.systemd1.NoSuchUnit")
            return original(request, deadline)
        self.driver.request = route
        self.clock.value = 120
        receipt = self.backend.release_receipt(0, 60_000_000)
        self.assertTrue(receipt["no_future_own_exec"])
        self.assertEqual(receipt["cleanup_receipts"]["missing_evidence"], [])
        self.assertEqual(receipt["cleanup_receipts"]["final_unit_receipt"], retained)
        self.assertEqual(receipt["cleanup_receipts"]["keeper_reap_receipt"]["pidfd_task_released"]["after_us"], "120")
        self.assertTrue(self.backend.validate_release_graph(0, receipt["cleanup_receipts"], 60_000_000))

    def test_unload_without_original_terminal_never_creates_release_graph(self):
        graph = self.full_cleanup_graph()
        self.backend.slots[0].final_receipt = None
        original = self.driver.request
        def route(request, deadline):
            if isinstance(request, T.SnapshotRequest): raise T.BusRemoteError("org.freedesktop.systemd1.NoSuchUnit")
            return original(request, deadline)
        self.driver.request = route
        receipt = self.backend.release_receipt(0, 60_000_000)
        self.assertFalse(receipt["no_future_own_exec"])
        self.assertEqual(receipt["cleanup_receipts"]["missing_evidence"], ["FINAL_UNIT_UNAVAILABLE"])
        self.assertIsNone(receipt["cleanup_receipts"]["final_unit_receipt"])
        self.assertFalse(self.backend.validate_release_graph(0, graph, 60_000_000))

    def no_such_unit(self):
        original = self.driver.request
        def route(request, deadline):
            if isinstance(request, T.SnapshotRequest):
                raise T.BusRemoteError("org.freedesktop.systemd1.NoSuchUnit")
            return original(request, deadline)
        self.driver.request = route

    def cleared_snapshot(self):
        snapshot = self.snapshot(terminal=True)
        snapshot["service"].update(ControlGroup="", ControlGroupId=0)
        return snapshot

    def test_cleanup_retains_exit_and_terminal_from_single_snapshot_before_gc(self):
        self.full_cleanup_graph()
        state = self.backend.slots[0]
        state.exit_fact = state.final_receipt = None
        original = self.driver.request
        reads = []
        def gc_after_first_read(request, deadline):
            if isinstance(request, T.SnapshotRequest):
                reads.append(request)
                if len(reads) > 1:
                    raise T.BusRemoteError("org.freedesktop.systemd1.NoSuchUnit")
                return self.snapshot(terminal=True)
            return original(request, deadline)
        self.driver.request = gc_after_first_read
        graph = self.backend.cleanup_receipts(0, 60_000_000)
        self.assertEqual(len(reads), 1)
        self.assertIsNotNone(state.exit_fact)
        self.assertIsNotNone(state.final_receipt)
        self.assertTrue(self.backend.validate_release_graph(0, graph, 60_000_000))
        observation = self.backend.terminal_observation(0, 60_000_000)
        self.assertEqual(observation["unit_state_read"]["kind"], "NO_SUCH_UNIT")
        self.assertEqual(observation["cleanup_graph"]["final_unit_receipt"], graph["final_unit_receipt"])
        self.assertEqual(observation["cleanup_graph"]["keeper_reap_receipt"]["systemd_main_exit"], state.exit_fact)

    def test_stop_captures_existing_exit_without_second_unit_lookup(self):
        _, binding = self.bind()
        original = self.driver.request
        reads = []
        def route(request, deadline):
            if isinstance(request, T.SnapshotRequest):
                reads.append(request)
                if len(reads) > 1:
                    raise T.BusRemoteError("org.freedesktop.systemd1.NoSuchUnit")
                return self.snapshot(terminal=True)
            if isinstance(request, T.StopRequest):
                return "/org/freedesktop/systemd1/job/2"
            return original(request, deadline)
        self.driver.request = route
        outcome = self.backend.stop_once(binding, 60_000_000)
        self.assertEqual(outcome.state, "ACCEPTED")
        self.assertEqual(len(reads), 1)
        self.assertIsNotNone(self.backend.slots[0].exit_fact)

    def test_terminal_observation_no_such_unit_keeps_complete_original_graph(self):
        original_graph = self.full_cleanup_graph()
        self.no_such_unit()
        result = self.backend.terminal_observation(0, 60_000_000)
        self.assertEqual(set(result), {"original_unit_binding", "current_manager_before",
                                     "current_manager_after", "cleanup_graph", "unit_state_read"})
        self.assertEqual(result["original_unit_binding"], self.backend.slots[0].binding)
        self.assertEqual(result["current_manager_before"], self.backend.ready.manager_binding)
        self.assertEqual(result["current_manager_after"], result["current_manager_before"])
        self.assertEqual(result["cleanup_graph"], original_graph)
        self.assertEqual(result["unit_state_read"], {"kind": "NO_SUCH_UNIT",
                          "error_name": "org.freedesktop.systemd1.NoSuchUnit",
                          "object_path": self.backend.slots[0].binding["object_path"]})
        result["original_unit_binding"]["invocation_id"] = "f" * 32
        result["cleanup_graph"]["final_unit_receipt"]["snapshot"]["service"]["MainPID"] = 33
        self.assertTrue(self.backend.validate_release_graph(0, original_graph, 60_000_000))

    def test_terminal_observation_cleared_same_invocation_is_fresh_prephysical(self):
        self.full_cleanup_graph()
        self.driver.reply = self.cleared_snapshot()
        before = list(self.driver.log)
        with patch.object(self.backend, "release_receipt", side_effect=AssertionError("physical release cycle")):
            result = self.backend.terminal_observation(0, 60_000_000)
        self.assertEqual(result["unit_state_read"], {"kind": "TERMINAL_CLEARED", "snapshot": self.driver.reply})
        self.assertEqual(result["cleanup_graph"]["missing_evidence"], [])
        self.assertTrue(self.backend.validate_release_graph(0, result["cleanup_graph"], 60_000_000))
        self.assertEqual(before.count("StartRequest"), self.driver.log.count("StartRequest"))
        self.assertEqual(before.count("StopRequest"), self.driver.log.count("StopRequest"))
        self.assertFalse({"physical", "Closure", "release_ready", "distribution"} & set(result))
        self.assertFalse({"physical", "Closure", "release_ready", "distribution"} & set(result["cleanup_graph"]))

    def test_terminal_observation_requires_cleanup_original_binding_and_preflight(self):
        self.bind()
        with self.assertRaisesRegex(B.BackendError, "TERMINAL_REQUIRES_CLEANUP"):
            self.backend.terminal_observation(0, 60_000_000)
        self.backend.begin_cleanup()
        with self.assertRaisesRegex(B.BackendError, "ORIGINAL_BINDING_MISSING"):
            self.backend.terminal_observation(1, 60_000_000)
        self.backend.ready = None
        with self.assertRaisesRegex(B.BackendError, "MANAGER_AUTHORITY_UNAVAILABLE"):
            self.backend.terminal_observation(0, 60_000_000)

    def test_terminal_observation_absence_cannot_create_missing_original_graph(self):
        self.full_cleanup_graph()
        self.backend.slots[0].final_receipt = None
        self.no_such_unit()
        with patch.object(self.backend, "_snapshot", wraps=self.backend._snapshot) as reads:
            with self.assertRaisesRegex(B.BackendError, "TERMINAL_GRAPH_INCOMPLETE"):
                self.backend.terminal_observation(0, 60_000_000)
        self.assertEqual(reads.call_count, 1)
        self.assertIsNone(self.backend.slots[0].final_receipt)

    def test_terminal_observation_does_not_replace_missing_reap_with_unit_absence(self):
        self.full_cleanup_graph()
        self.backend.slots[0].exit_fact = None
        self.no_such_unit()
        with self.assertRaisesRegex(B.BackendError, "TERMINAL_GRAPH_INCOMPLETE"):
            self.backend.terminal_observation(0, 60_000_000)

    def test_terminal_observation_live_or_uncleared_current_unit_is_not_absence(self):
        self.full_cleanup_graph()
        with self.assertRaisesRegex(B.BackendError, "TERMINAL_STATE_UNAVAILABLE"):
            self.backend.terminal_observation(0, 60_000_000)

    def test_terminal_observation_foreign_current_invocation_is_sticky_invalid(self):
        self.full_cleanup_graph()
        original = self.driver.request
        reads = []
        def route(request, deadline):
            if isinstance(request, T.SnapshotRequest):
                reads.append(request)
                snapshot = self.cleared_snapshot()
                if len(reads) == 2:
                    snapshot["unit"]["InvocationID"] = "f" * 32
                return snapshot
            return original(request, deadline)
        self.driver.request = route
        with self.assertRaisesRegex(B.BackendError, "UNIT_IDENTITY_CHANGED"):
            self.backend.terminal_observation(0, 60_000_000)
        self.driver.request = original
        with self.assertRaisesRegex(B.BackendError, "UNIT_IDENTITY_CHANGED"):
            self.backend.terminal_observation(0, 60_000_000)

    def test_terminal_observation_wrong_cleared_pair_rejects_original_identity(self):
        self.full_cleanup_graph()
        self.driver.reply = self.cleared_snapshot()
        self.driver.reply["service"]["ControlGroupId"] = 987
        with self.assertRaisesRegex(B.BackendError, "UNIT_IDENTITY_CHANGED"):
            self.backend.terminal_observation(0, 60_000_000)

    def test_terminal_observation_unknown_unit_read_never_certifies_absence(self):
        self.full_cleanup_graph()
        original = self.driver.request
        def route(request, deadline):
            if isinstance(request, T.SnapshotRequest):
                raise T.BusRemoteError("org.freedesktop.DBus.Error.AccessDenied")
            return original(request, deadline)
        self.driver.request = route
        with self.assertRaises(T.BusRemoteError):
            self.backend.terminal_observation(0, 60_000_000)

    def test_terminal_observation_manager_changed_after_graph_rejects(self):
        self.full_cleanup_graph()
        self.no_such_unit()
        actual = self.transport.verify_identity
        calls = []
        def changed_after_graph(deadline):
            calls.append(deadline)
            manager = actual(deadline)
            if len(calls) == 3:
                manager["owner_unique_name"] = ":1.99"
            return manager
        with patch.object(self.transport, "verify_identity", side_effect=changed_after_graph):
            with self.assertRaisesRegex(B.BackendError, "MANAGER_IDENTITY_CHANGED"):
                self.backend.terminal_observation(0, 60_000_000)
        self.assertEqual(len(calls), 3)
        with self.assertRaisesRegex(B.BackendError, "MANAGER_IDENTITY_CHANGED"):
            self.backend.terminal_observation(0, 60_000_000)

    def test_terminal_observation_manager_changed_before_graph_is_sticky(self):
        self.full_cleanup_graph()
        self.driver.binding["owner_unique_name"] = ":1.99"
        with self.assertRaisesRegex(T.TransportError, "MANAGER_IDENTITY_CHANGED"):
            self.backend.terminal_observation(0, 60_000_000)
        self.driver.binding["owner_unique_name"] = ":1.2"
        with self.assertRaisesRegex(B.BackendError, "MANAGER_IDENTITY_CHANGED"):
            self.backend.terminal_observation(0, 60_000_000)

    def test_terminal_observation_original_deadline_rejects(self):
        self.full_cleanup_graph()
        self.clock.value = 60_000_000
        with self.assertRaisesRegex(T.TransportError, "DEADLINE"):
            self.backend.terminal_observation(0, 60_000_001)

    def test_terminal_observation_current_read_exceeding_budget_cannot_return(self):
        self.full_cleanup_graph()
        original = self.driver.request
        reads = []
        def route(request, deadline):
            if isinstance(request, T.SnapshotRequest):
                reads.append(request)
                if len(reads) == 2:
                    self.clock.value = deadline
                return self.cleared_snapshot()
            return original(request, deadline)
        self.driver.request = route
        with self.assertRaisesRegex(T.TransportError, "DEADLINE"):
            self.backend.terminal_observation(0, 1000)
        self.assertEqual(len(reads), 2)

    def test_terminal_observation_unsettled_stop_is_not_hidden_by_absence(self):
        self.full_cleanup_graph()
        state = self.backend.slots[0]
        del state.events[state.stop_job_path]
        self.no_such_unit()
        with self.assertRaisesRegex(B.BackendError, "TERMINAL_GRAPH_INCOMPLETE"):
            self.backend.terminal_observation(0, 60_000_000)

    def native_delegation_fixture(self, properties):
        """Nominal native instances only; methods and syscalls are explicit mocks."""
        if self.backend.slots[0].binding is None:
            self.bind()
        native = B.SystemdBackend.__new__(B.SystemdBackend)
        native.__dict__.update(self.backend.__dict__)
        native.test_boundary = False
        driver = T._NativeBus.__new__(T._NativeBus)
        driver.owner = self.backend.ready.manager_binding["owner_unique_name"]
        native.transport = T.SdBusTransport.__new__(T.SdBusTransport)
        native.transport._initialize(driver, self.clock, 60_000_000, False)
        native.transport.binding = copy.deepcopy(self.backend.ready.manager_binding)
        native.transport.units, native.transport.subscribed = NAMES, True
        native.budget = native.transport.budget
        native.identity = B._NativeIdentity.__new__(B._NativeIdentity)
        stack = ExitStack()
        stack.enter_context(patch.object(B.sys, "platform", "linux"))
        stack.enter_context(patch.object(B._NativeIdentity, "current_generation", autospec=True, return_value=WATCHDOG))
        stack.enter_context(patch.object(B._NativeIdentity, "verify_workload", autospec=True))
        stack.enter_context(patch.object(T._NativeBus, "epoch", autospec=True,
                                         side_effect=lambda _driver, deadline: copy.deepcopy(native.transport.binding)))
        stack.enter_context(patch.object(T._NativeBus, "request", autospec=True,
                                         side_effect=lambda _driver, request, deadline: self.snapshot()))
        rpc = stack.enter_context(patch.object(T._NativeBus, "_rpc", autospec=True, return_value=properties))
        for name in ("open", "stat", "lstat", "fstat"):
            stack.enter_context(patch.object(B.os, name, side_effect=AssertionError("native I/O forbidden")))
        stack.enter_context(patch.object(T.C, "CDLL", side_effect=AssertionError("libsystemd load forbidden")))
        return stack, native, rpc

    def test_delegation_observation_reads_fixed_actual_boolean_without_io(self):
        for delegated in (False, True):
            stack, native, rpc = self.native_delegation_fixture({"Delegate": delegated})
            with self.subTest(delegated=delegated), stack:
                binding = native.slots[0].binding
                result = native.delegation_observation(binding, 50_000_000)
                self.assertEqual(set(result), {"original_unit_binding", "current_manager_before",
                    "current_manager_after", "properties", "before_us", "after_us"})
                self.assertEqual(result["properties"], {"Delegate": delegated})
                self.assertEqual(result["current_manager_before"], native.ready.manager_binding)
                self.assertEqual(result["current_manager_before"], result["current_manager_after"])
                rpc.assert_called_once_with(native.transport.driver, ":1.2", binding["object_path"],
                    "org.freedesktop.DBus.Properties", "GetAll",
                    (("s", "org.freedesktop.systemd1.Service"),), 1_000_100, fields={"Delegate": "b"})
                result["original_unit_binding"]["invocation_id"] = "f" * 32
                self.assertEqual(native.slots[0].binding["invocation_id"], "d" * 32)

    def test_delegation_observation_rejects_fixture_boundary_and_unknown_property(self):
        self.bind()
        with self.assertRaisesRegex(B.BackendError, "NATIVE_DELEGATION_OBSERVER_REQUIRED"):
            self.backend.delegation_observation(self.backend.slots[0].binding, 50_000_000)
        for properties in ({}, {"Delegate": None}, {"Delegate": 0}, {"Delegate": "false"},
                           {"Delegate": False, "unknown": True}):
            stack, native, rpc = self.native_delegation_fixture(properties)
            with self.subTest(properties=properties), stack:
                with self.assertRaisesRegex(B.BackendError, "DELEGATE_PROPERTY_UNAVAILABLE"):
                    native.delegation_observation(native.slots[0].binding, 50_000_000)
                self.assertEqual(rpc.call_count, 1)

    def test_delegation_observation_foreign_invocation_after_property_is_rejected(self):
        stack, native, rpc = self.native_delegation_fixture({"Delegate": False})
        with stack:
            reads = []
            def replace_after_rpc(_driver, request, deadline):
                reads.append(request)
                snapshot = self.snapshot()
                if len(reads) == 2:
                    snapshot["unit"]["InvocationID"] = "f" * 32
                return snapshot
            T._NativeBus.request.side_effect = replace_after_rpc
            with self.assertRaisesRegex(B.BackendError, "UNIT_IDENTITY_CHANGED"):
                native.delegation_observation(native.slots[0].binding, 50_000_000)
            self.assertEqual(rpc.call_count, 1)
            self.assertEqual(native.invalid, "UNIT_IDENTITY_CHANGED")
            with self.assertRaisesRegex(B.BackendError, "UNIT_IDENTITY_CHANGED"):
                native.delegation_observation(native.slots[0].binding, 50_000_000)

    def test_release_graph_missing_records_hashes_flags_or_missing_evidence_fail(self):
        original = self.full_cleanup_graph()
        edits = [("start_receipt", None), ("stop_receipt", None), ("final_unit_receipt", None), ("keeper_reap_receipt", None),
                 ("start_settlement_ref", "0" * 64), ("stop_settlement_ref", "0" * 64), ("final_unit_receipt_ref", "0" * 64), ("keeper_reap_receipt_ref", "0" * 64),
                 ("activations_settled", False), ("stop_settled", False), ("terminal_no_pending_execution", False), ("keeper_reaped", False),
                 ("missing_evidence", ["FINAL_UNIT_UNAVAILABLE"]), ("test_boundary", False)]
        for key, value in edits:
            with self.subTest(key=key):
                graph = copy.deepcopy(original)
                graph[key] = value
                self.assertFalse(self.backend.validate_release_graph(0, graph, 60_000_000))
        graph = copy.deepcopy(original)
        del graph["missing_evidence"]
        self.assertFalse(self.backend.validate_release_graph(0, graph, 60_000_000))
        self.assertTrue(self.backend.validate_release_graph(0, original, 60_000_000))

    def test_release_graph_rehashed_forged_events_or_terminal_identity_fail(self):
        original = self.full_cleanup_graph()
        cases = [("start_receipt", "start_settlement_ref", ("event", "result"), "failed"),
                 ("stop_receipt", "stop_settlement_ref", ("event", "job_path"), "/org/freedesktop/systemd1/job/3"),
                 ("stop_receipt", "stop_settlement_ref", ("event", "owner_unique_name"), ":1.99"),
                 ("start_receipt", "start_settlement_ref", ("request_ref",), "0" * 64),
                 ("final_unit_receipt", "final_unit_receipt_ref", ("snapshot", "unit", "InvocationID"), "f" * 32),
                 ("final_unit_receipt", "final_unit_receipt_ref", ("snapshot", "service", "MainPID"), 33),
                 ("keeper_reap_receipt", "keeper_reap_receipt_ref", ("pidfd_task_released", "procfs_namespace_ref"), "pid:[99]")]
        for key, ref, path, value in cases:
            with self.subTest(path=path):
                graph = copy.deepcopy(original)
                node = graph[key]
                for part in path[:-1]: node = node[part]
                node[path[-1]] = value
                graph[ref] = K.digest_record(graph[key])
                self.assertFalse(self.backend.validate_release_graph(0, graph, 60_000_000))
        # A consumer cannot change the producer's originals through returned records.
        self.assertTrue(self.backend.validate_release_graph(0, original, 60_000_000))

    def test_actual_failed_job_event_cannot_release_even_with_four_flags_true(self):
        graph = self.full_cleanup_graph()
        state = self.backend.slots[0]
        state.events[state.stop_job_path] = T.JobEvent(**{**state.events[state.stop_job_path].to_mapping(), "result": "failed"})
        graph = self.backend.cleanup_receipts(0, 60_000_000)
        self.assertTrue(all(graph[key] is True for key in ("activations_settled", "stop_settled", "terminal_no_pending_execution", "keeper_reaped")))
        self.assertFalse(self.backend.validate_release_graph(0, graph, 60_000_000))
        self.assertFalse(self.backend.release_receipt(0, 60_000_000)["no_future_own_exec"])

    def test_release_graph_requires_original_pin_and_generation(self):
        graph = self.full_cleanup_graph()
        pin = self.backend.slots[0].pin
        pin.closed = True
        self.assertFalse(self.backend.validate_release_graph(0, graph, 60_000_000))
        pin.closed = False
        pin.generation = {**KEEPER, "start_ticks": "96"}
        self.assertFalse(self.backend.validate_release_graph(0, graph, 60_000_000))
        pin.generation = KEEPER.copy()
        self.assertTrue(self.backend.validate_release_graph(0, graph, 60_000_000))

    def test_release_graph_producer_timestamp_outside_original_window_rejected(self):
        graph = self.full_cleanup_graph()
        state = self.backend.slots[0]
        # Rehash an internally retained but temporally impossible fact: shape alone
        # does not prove the observation happened in the original authority window.
        state.final_receipt["after_us"] = "60000000"
        graph["final_unit_receipt"] = copy.deepcopy(state.final_receipt)
        graph["final_unit_receipt_ref"] = K.digest_record(graph["final_unit_receipt"])
        self.assertFalse(self.backend.validate_release_graph(0, graph, 60_000_000))
        state.final_receipt["after_us"] = "101"
        graph["final_unit_receipt"] = copy.deepcopy(state.final_receipt)
        graph["final_unit_receipt_ref"] = K.digest_record(graph["final_unit_receipt"])
        self.assertFalse(self.backend.validate_release_graph(0, graph, 60_000_000))

    def test_release_graph_manager_epoch_change_or_expired_budget_raises(self):
        graph = self.full_cleanup_graph()
        self.clock.value = 60_000_000
        with self.assertRaisesRegex(T.TransportError, "DEADLINE"):
            self.backend.validate_release_graph(0, graph, 60_000_001)

    def test_release_never_accepts_original_deadline_or_expired_lease(self):
        self.backend.begin_cleanup()
        self.clock.value = 60_000_000
        with self.assertRaisesRegex(T.TransportError, "DEADLINE"):
            self.backend.release_receipt(0, 60_000_001)

    def test_preflight_namespace_authority_failure_cannot_release_undispatched(self):
        clock = Clock()
        driver = FakeBusTestBoundary(clock)
        driver.binding["manager_pid_generation"]["pid_namespace_ref"] = "pid:[77]"
        transport = T.SdBusTransport.for_test_boundary(driver, authority_lease_until_us=60_000_000, clock_us=clock)
        backend = B.SystemdBackend.for_test_boundary(transport, spec(), keeper_listener_path="/run/elogistix-memory-" + RUN + "/keeper.sock", watchdog_generation=WATCHDOG, payload_binding=PAYLOAD, identity=FakeIdentityTestBoundary(clock), clock_us=clock)
        with self.assertRaisesRegex(B.BackendError, "MANAGER_NAMESPACE"):
            backend.preflight(spec(), 50_000_000)
        backend.begin_cleanup()
        with self.assertRaisesRegex(B.BackendError, "MANAGER_NAMESPACE"):
            backend.release_receipt(0, 60_000_000)

    def test_native_listener_connect_permission_is_not_dirent_write(self):
        import stat
        identity = B._NativeIdentity(T.Budget(self.clock, 60_000_000), 1001, (1001,))
        class D: st_uid = 0; st_gid = 1001; st_mode = stat.S_IFDIR | 0o750
        class S: st_uid = 0; st_gid = 1001; st_mode = stat.S_IFSOCK | 0o620
        with patch.object(identity, "_protected", return_value=D()), patch.object(B.os, "lstat", return_value=S()):
            identity.verify_listener("/run/elogistix-memory-" + RUN + "/keeper.sock", RUN, 50_000_000)
        class Closed: st_uid = 0; st_gid = 0; st_mode = stat.S_IFSOCK | 0o600
        with patch.object(identity, "_protected", return_value=D()), patch.object(B.os, "lstat", return_value=Closed()):
            with self.assertRaisesRegex(B.BackendError, "KEEPER_LISTENER_AUTHORITY"):
                identity.verify_listener("/run/elogistix-memory-" + RUN + "/keeper.sock", RUN, 50_000_000)
        class Public: st_uid = 0; st_gid = 1001; st_mode = stat.S_IFSOCK | 0o622
        with patch.object(identity, "_protected", return_value=D()), patch.object(B.os, "lstat", return_value=Public()):
            with self.assertRaisesRegex(B.BackendError, "KEEPER_LISTENER_AUTHORITY"):
                identity.verify_listener("/run/elogistix-memory-" + RUN + "/keeper.sock", RUN, 50_000_000)

    def test_native_typical_unit_search_paths_with_absent_attached_dirs(self):
        identity = B._NativeIdentity(T.Budget(self.clock, 60_000_000), 1001, (1001,))
        paths = ["/etc/systemd/system.control", "/run/systemd/system.control", "/run/systemd/transient", "/run/systemd/generator.early", "/etc/systemd/system", "/etc/systemd/system.attached", "/run/systemd/system", "/run/systemd/system.attached", "/run/systemd/generator", "/usr/local/lib/systemd/system", "/usr/lib/systemd/system", "/run/systemd/generator.late"]
        with patch.object(B.os, "geteuid", create=True, return_value=0), patch.object(B.os.path, "realpath", side_effect=lambda p:p), patch.object(B.os.path, "exists", return_value=False), patch.object(identity, "_protected") as protected:
            result = identity.policy(paths, NAMES, 50_000_000)
        self.assertEqual(result["matching_configuration"], "ABSENT")
        self.assertEqual(result["unit_path_facts"], [])
        self.assertEqual(protected.call_args_list, [unittest.mock.call("/")] * len(paths))

    def test_native_attached_path_keeps_protection_and_inherited_config_guard(self):
        import stat
        identity = B._NativeIdentity(T.Budget(self.clock, 60_000_000), 1001, (1001,))
        class D: st_uid=0; st_gid=0; st_mode=stat.S_IFDIR|0o755; st_dev=4; st_ino=5
        path = "/etc/systemd/system.attached"
        for inherited in ("service.d", NAMES[0]+".d", NAMES[0]):
            with self.subTest(inherited=inherited), patch.object(B.os, "geteuid", create=True, return_value=0), patch.object(B.os.path, "realpath", side_effect=lambda p:p), patch.object(B.os.path, "exists", return_value=True), patch.object(identity, "_protected", return_value=D()) as protected, patch.object(B.os.path, "lexists", side_effect=lambda p:p==path+"/"+inherited):
                with self.assertRaisesRegex(B.BackendError, "INHERITED_UNIT_CONFIGURATION"):
                    identity.policy([path], NAMES, 50_000_000)
                self.assertIn(unittest.mock.call(path), protected.call_args_list)

    def test_native_unknown_unit_search_path_still_rejected(self):
        identity = B._NativeIdentity(T.Budget(self.clock, 60_000_000), 1001, (1001,))
        with patch.object(B.os, "geteuid", create=True, return_value=0), patch.object(B.os.path, "exists", return_value=False):
            with self.assertRaisesRegex(B.BackendError, "MANAGER_AUTHORITY_POLICY"):
                identity.policy(["/caller/arbitrary/unit/path"], NAMES, 50_000_000)
    def test_native_pidfd_zero_is_invalid_and_pollin_not_used(self):
        pin = T.ProcessPin.__new__(T.ProcessPin)
        pin.generation, pin.fd, pin.fd_identity, pin.proc_identity, pin.ns, pin.closed = KEEPER, 9, (4,5), (6,7), ("pid:[1]", "mnt:[2]"), False
        class S: st_dev = 4; st_ino = 5
        class P: st_dev = 6; st_ino = 7
        with patch.object(T.os, "fstat", return_value=S()), patch.object(T.os, "stat", return_value=P()), patch.object(T, "_self_namespaces", return_value=pin.ns), patch.object(T, "_boot_id", return_value=BOOT), patch.object(T, "bounded_read", return_value="Pid:\t0\n"), patch.object(T.select, "poll", create=True) as poll:
            with self.assertRaisesRegex(T.TransportError, "PIDFD_FDINFO"):
                pin.released(T.Budget(self.clock, 60_000_000), 60_000_000)
            poll.assert_not_called()

    def test_native_fdinfo_minus_one_released_original_no_hup_required(self):
        pin = T.ProcessPin.__new__(T.ProcessPin)
        pin.generation, pin.fd, pin.fd_identity, pin.proc_identity, pin.ns, pin.closed = KEEPER, 9, (4,5), (6,7), ("pid:[1]", "mnt:[2]"), False
        class S: st_dev = 4; st_ino = 5
        class P: st_dev = 6; st_ino = 7
        with patch.object(T.os, "fstat", return_value=S()), patch.object(T.os, "stat", return_value=P()), patch.object(T, "_self_namespaces", return_value=pin.ns), patch.object(T, "_boot_id", return_value=BOOT), patch.object(T, "bounded_read", return_value="Pid:\t-1\n"), patch.object(T.select, "poll", create=True) as poll:
            self.assertTrue(pin.released(T.Budget(self.clock, 60_000_000), 60_000_000)["released"])
            poll.assert_not_called()

    def test_native_release_producer_joins_watchdog_original_pid_namespace(self):
        pin = T.ProcessPin.__new__(T.ProcessPin)
        pin.generation, pin.fd, pin.fd_identity, pin.proc_identity, pin.ns, pin.closed = KEEPER, 9, (4,5), (6,7), ("pid:[1]", "mnt:[2]"), False
        class S: st_dev = 4; st_ino = 5
        class P: st_dev = 6; st_ino = 7
        identity = B._NativeIdentity(T.Budget(self.clock, 60_000_000), 1001, (1001,))
        with patch.object(T.os, "fstat", return_value=S()), patch.object(T.os, "stat", return_value=P()), patch.object(T, "_self_namespaces", return_value=pin.ns), patch.object(T, "_boot_id", return_value=BOOT), patch.object(T, "bounded_read", return_value="Pid:\t-1\n") as read:
            fact = identity.release_fact(pin, 60_000_000)
        self.assertEqual(fact["procfs_namespace_ref"], KEEPER["pid_namespace_ref"])
        self.assertEqual(fact["original_process_generation"], KEEPER)
        self.assertEqual(fact["fdinfo_pid"], -1)
        K.validate_pidfd_task_released(fact)
        read.assert_called_once_with("/proc/self/fdinfo/9", 4096)

    def test_retained_pins_close_only_when_backend_closed(self):
        self.bind()
        pin = self.backend.slots[0].pin
        self.assertFalse(pin.closed)
        self.backend.close()
        self.assertTrue(pin.closed)
        self.assertEqual(self.driver.log.count("close"), 1)

    def test_manager_environment_captures_preflight_and_both_start_checks(self):
        for entries in ([], ["PATH=/manager/bin", "LANG=POSIX", "LC_ALL=C"], ["PATH=" + "x" * 4091]):
            with self.subTest(names=[value.split("=", 1)[0] for value in entries]):
                backend, driver, _identity, _clock = self.unarmed_with_policy(self.manager_policy(entries))
                backend.preflight(spec(), 50_000_000)
                expected = {"names": sorted(value.split("=", 1)[0] for value in entries),
                            "assignments_ref": K.digest_record({"assignments": sorted(entries)})}
                self.assertEqual(backend.manager_environment_fact, expected)
                self.assertEqual(backend.policy_fact["manager_environment"], expected)
                backend.reserve_start(0, "1" * 64)
                outcome = backend.start_reserved(0, PAYLOAD, 50_000_000)
                self.assertEqual(outcome.state, "ACCEPTED")
                self.assertEqual(driver.log.count("ManagerPolicyRequest"), 3)
                self.assertLess(max(i for i, value in enumerate(driver.log) if value == "ManagerPolicyRequest"),
                                driver.log.index("StartRequest"))

    def test_manager_environment_unknown_names_never_arm_or_dispatch(self):
        for name in ("LD_FUTURE", "LD_PRELOAD", "GLIBC_TUNABLES", "GCONV_PATH", "TZ", "LC_TIME", "path"):
            with self.subTest(name=name):
                backend, driver, identity, _clock = self.unarmed_with_policy(
                    self.manager_policy([name + "=PRIVATE-MANAGER-VALUE"]))
                with self.assertRaisesRegex(B.BackendError, "MANAGER_ENVIRONMENT_POLICY") as rejected:
                    backend.preflight(spec(), 50_000_000)
                self.assertIsNone(backend.ready)
                self.assertEqual(backend.invalid, "MANAGER_ENVIRONMENT_POLICY")
                self.assertNotIn("subscribe", driver.log)
                self.assertNotIn("StartRequest", driver.log)
                self.assertNotIn("PRIVATE-MANAGER-VALUE", str(rejected.exception))
                self.assertEqual(identity.pins, [])

    def test_manager_environment_missing_nonlist_or_malformed_is_not_empty(self):
        policies = [{"UnitPath": ["/etc/systemd/system"]}]
        policies += [self.manager_policy(value) for value in (None, (), "PATH=/bin", {}, False)]
        policies += [self.manager_policy(value) for value in (
            [None], [1], [False], [b"PATH=/bin"], [{}], ["PATH"], ["=value"],
            ["PATH=/bin", "PATH=/bin"], ["LANG=C", "LANG=POSIX"],
            ["PATH=/bin", "LANG=C", "LC_ALL=C", "LANG=POSIX"],
            ["PATH=private\x00value"], ["LANG=private\tvalue"], ["LANG=private\nvalue"],
            ["PATH=private\x7fvalue"], ["LANG=caf\u00e9"], ["PATH=" + "x" * 4092])]
        for index, policy in enumerate(policies):
            with self.subTest(case=index):
                backend, driver, _identity, _clock = self.unarmed_with_policy(policy)
                with self.assertRaisesRegex(B.BackendError, "MANAGER_ENVIRONMENT_POLICY"):
                    backend.preflight(spec(), 50_000_000)
                self.assertIsNone(backend.ready)
                self.assertNotIn("StartRequest", driver.log)
                self.assertFalse(any(slot.start_attempted for slot in backend.slots))

    def test_manager_environment_canonical_order_does_not_change_authority(self):
        entries = ["PATH=/manager/bin", "LANG=POSIX", "LC_ALL=C"]
        policy = self.manager_policy(entries)
        backend, driver, _identity, _clock = self.unarmed_with_policy(policy)
        backend.preflight(spec(), 50_000_000)
        original = copy.deepcopy(backend.manager_environment_fact)
        policy["Environment"] = list(reversed(entries))
        backend.reserve_start(0, "1" * 64)
        self.assertEqual(backend.start_reserved(0, PAYLOAD, 50_000_000).state, "ACCEPTED")
        self.assertEqual(backend.manager_environment_fact, original)
        self.assertEqual(driver.log.count("ManagerPolicyRequest"), 3)

    def test_allowed_manager_value_change_is_rejected_before_start(self):
        for original_entries, changed_entries in ((["LANG=C"], ["LANG=POSIX"]),
                                                   ([], ["PATH=/bin"]),
                                                   (["PATH=/manager/bin"], ["PATH=/changed/bin"])):
            with self.subTest(names=[value.split("=", 1)[0] for value in changed_entries]):
                policy = self.manager_policy(original_entries)
                backend, driver, _identity, _clock = self.unarmed_with_policy(policy)
                backend.preflight(spec(), 50_000_000)
                original = copy.deepcopy(backend.manager_environment_fact)
                policy["Environment"] = changed_entries
                backend.reserve_start(0, "1" * 64)
                with self.assertRaisesRegex(B.BackendError, "MANAGER_ENVIRONMENT_CHANGED"):
                    backend.start_reserved(0, PAYLOAD, 50_000_000)
                self.assertEqual(backend.manager_environment_fact, original)
                self.assertEqual(driver.log.count("ManagerPolicyRequest"), 2)
                self.assertNotIn("StartRequest", driver.log)
                self.assertFalse(backend.slots[0].start_attempted)
                policy["Environment"] = original_entries
                with self.assertRaisesRegex(B.BackendError, "MANAGER_ENVIRONMENT_CHANGED"):
                    backend.start_reserved(0, PAYLOAD, 50_000_000)
                self.assertNotIn("StartRequest", driver.log)

    def test_new_manager_environment_hazard_or_missing_fact_blocks_start(self):
        for changed in (None, ["LD_FUTURE=private"], ["LANG=C", "LANG=C"]):
            with self.subTest(case=type(changed).__name__):
                policy = self.manager_policy([])
                backend, driver, _identity, _clock = self.unarmed_with_policy(policy)
                backend.preflight(spec(), 50_000_000)
                policy["Environment"] = changed
                backend.reserve_start(0, "1" * 64)
                with self.assertRaisesRegex(B.BackendError, "MANAGER_ENVIRONMENT_POLICY"):
                    backend.start_reserved(0, PAYLOAD, 50_000_000)
                self.assertNotIn("StartRequest", driver.log)
                self.assertFalse(backend.slots[0].start_attempted)
        backend, driver, _identity, _clock = self.unarmed_with_policy(self.manager_policy([]))
        backend.preflight(spec(), 50_000_000)
        backend.reserve_start(0, "1" * 64)
        backend.manager_environment_fact = None
        with self.assertRaisesRegex(B.BackendError, "MANAGER_ENVIRONMENT_CHANGED"):
            backend.start_reserved(0, PAYLOAD, 50_000_000)
        self.assertNotIn("StartRequest", driver.log)

    def test_environment_policy_publishes_names_and_digest_without_private_values(self):
        secret = "PRIVATE-MANAGER-ENVIRONMENT-SENTINEL"
        entries = ["PATH=/" + secret, "LANG=C", "LC_ALL=C"]
        backend, driver, _identity, _clock = self.unarmed_with_policy(self.manager_policy(entries))
        ready = backend.preflight(spec(), 50_000_000)
        backend.reserve_start(0, "1" * 64)
        backend.start_reserved(0, PAYLOAD, 50_000_000)
        published = {"ready": ready.__dict__, "policy": backend.policy_fact,
                     "environment": backend.manager_environment_fact, "log": driver.log,
                     "start_ref": backend.slots[0].start_request_ref}
        self.assertNotIn(secret, json.dumps(published))
        self.assertEqual(set(backend.manager_environment_fact), {"names", "assignments_ref"})
        self.assertEqual(backend.manager_environment_fact["names"], ["LANG", "LC_ALL", "PATH"])

    def test_all_five_environment_readbacks_are_required_before_candidate_or_pin(self):
        for field in ("Environment", "PassEnvironment", "EnvironmentFiles", "PAMName", "UnsetEnvironment"):
            for missing in (True, False):
                with self.subTest(field=field, missing=missing):
                    backend, driver, identity, _clock = self.unarmed_with_policy(self.manager_policy([]))
                    backend.preflight(spec(), 50_000_000)
                    backend.reserve_start(0, "1" * 64)
                    backend.start_reserved(0, PAYLOAD, 50_000_000)
                    snapshot = self.snapshot(backend=backend)
                    if missing:
                        snapshot["service"].pop(field)
                    else:
                        snapshot["service"][field] = {
                            "Environment": ["PATH=/PRIVATE-READBACK"],
                            "PassEnvironment": ["LD_PRELOAD"],
                            "EnvironmentFiles": [["/PRIVATE-READBACK", True]],
                            "PAMName": "PRIVATE-READBACK",
                            "UnsetEnvironment": [],
                        }[field]
                    driver.reply = snapshot
                    expected_code = "UNIT_SNAPSHOT" if missing else "UNEXPECTED_EXECUTION_POLICY"
                    with self.assertRaisesRegex(B.BackendError, expected_code) as rejected:
                        backend.observe_candidate(0, 50_000_000)
                    self.assertIsNone(backend.slots[0].candidate)
                    self.assertIsNone(backend.slots[0].generation)
                    self.assertIsNone(backend.slots[0].pin)
                    self.assertEqual(identity.pins, [])
                    self.assertNotIn("workload", identity.calls)
                    self.assertNotIn("PRIVATE-READBACK", str(rejected.exception))

    def test_array_environment_readback_types_are_strict(self):
        for field in ("Environment", "PassEnvironment", "EnvironmentFiles", "UnsetEnvironment"):
            with self.subTest(field=field):
                backend, driver, identity, _clock = self.unarmed_with_policy(self.manager_policy([]))
                backend.preflight(spec(), 50_000_000)
                backend.reserve_start(0, "1" * 64)
                backend.start_reserved(0, PAYLOAD, 50_000_000)
                driver.reply = self.snapshot(backend=backend)
                driver.reply["service"][field] = tuple(driver.reply["service"][field])
                with self.assertRaisesRegex(B.BackendError, "UNEXPECTED_EXECUTION_POLICY"):
                    backend.observe_candidate(0, 50_000_000)
                self.assertEqual(identity.pins, [])

    def test_valid_environment_files_readback_normalizes_empty_array(self):
        self.start()
        self.driver.reply = self.snapshot()
        self.assertEqual(self.driver.reply["service"]["Environment"], ["PATH=/usr/bin:/bin", "LANG=C", "LC_ALL=C"])
        self.assertEqual(self.driver.reply["service"]["EnvironmentFiles"], [])
        self.assertEqual(self.driver.reply["service"]["PassEnvironment"], [])
        self.assertEqual(self.driver.reply["service"]["PAMName"], "")
        self.assertEqual(self.driver.reply["service"]["UnsetEnvironment"], list(T.SERVICE_UNSET_ENVIRONMENT))
        candidate = self.backend.observe_candidate(0, 50_000_000)
        self.assertEqual(candidate["main_pid"], KEEPER["pid"])

    def test_environment_change_during_pin_cannot_bind_and_closes_original_pin(self):
        self.start()
        self.driver.reply = self.snapshot()
        self.backend.observe_candidate(0, 50_000_000)
        original = self.identity.pin
        def tamper(generation, deadline):
            pin = original(generation, deadline)
            self.driver.reply["service"]["Environment"] = ["PATH=/PRIVATE-LATE-ENVIRONMENT"]
            return pin
        self.identity.pin = tamper
        with self.assertRaisesRegex(B.BackendError, "UNEXPECTED_EXECUTION_POLICY") as rejected:
            self.backend.bind_unit(0, KEEPER, 50_000_000)
        self.assertEqual(len(self.identity.pins), 1)
        self.assertTrue(self.identity.pins[0].closed)
        self.assertIsNone(self.backend.slots[0].binding)
        self.assertIsNone(self.backend.slots[0].generation)
        self.assertIsNone(self.backend.slots[0].pin)
        self.assertNotIn("PRIVATE-LATE-ENVIRONMENT", str(rejected.exception))

    def test_manager_change_between_both_start_captures_blocks_dispatch(self):
        for field, replacement, expected_code in (
                ("Environment", ["LC_ALL=POSIX"], "MANAGER_ENVIRONMENT_CHANGED"),
                ("Environment", ["LD_FUTURE=private"], "MANAGER_ENVIRONMENT_POLICY"),
                ("UnitPath", ["/run/systemd/system"], "MANAGER_AUTHORITY_POLICY")):
            with self.subTest(field=field, expected_code=expected_code):
                policy = self.manager_policy([])
                backend, driver, identity, _clock = self.unarmed_with_policy(policy)
                backend.preflight(spec(), 50_000_000)
                backend.reserve_start(0, "1" * 64)
                original = identity.policy
                def mutate(paths, names, deadline):
                    observed = original(paths, names, deadline)
                    policy[field] = replacement
                    return observed
                identity.policy = mutate
                with self.assertRaisesRegex(B.BackendError, expected_code):
                    backend.start_reserved(0, PAYLOAD, 50_000_000)
                self.assertEqual(driver.log.count("ManagerPolicyRequest"), 3)
                self.assertNotIn("StartRequest", driver.log)
                self.assertFalse(backend.slots[0].start_attempted)
                self.assertEqual(identity.pins, [])


if __name__ == "__main__":
    unittest.main()
