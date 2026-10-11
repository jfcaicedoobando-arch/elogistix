"""Hermetic terminal closure composition; no native Linux I/O or authority."""
from copy import deepcopy
from dataclasses import replace
from pathlib import Path
import errno
import hashlib
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
import test_backend_faults as F
import test_native_composition as N
import test_native_perimeter as PN
import test_watchdog as WD

_NATIVE_CAPTURE = M._NativeCgroupPerimeter.capture
_NATIVE_REVALIDATE = M._NativeCgroupPerimeter.revalidate
_NATIVE_GENERATION = B._NativeIdentity.current_generation
_NATIVE_WORKLOAD = B._NativeIdentity.verify_workload


class BackendTerminalObservationTests(unittest.TestCase):
    def harness(self, *, retain_terminal=True, state="absent"):
        h = F.BackendFaultTests()
        h.setUp()
        self.addCleanup(h.doCleanups)
        _, binding = h.bind()
        h.backend.begin_cleanup()
        original_request = h.driver.request

        def request(value, deadline):
            if isinstance(value, T.StopRequest):
                h.driver.log.append("StopRequest")
                return "/org/freedesktop/systemd1/job/2"
            return original_request(value, deadline)

        h.driver.request = request
        h.driver.reply = h.snapshot()
        h.backend.stop_once(binding, 60_000_000)
        h.clock.value = 100  # Terminal timestamps 50/90 precede the observed settlement.
        h.events(1, 2)
        h.identity.released = True
        if retain_terminal:
            h.driver.reply = h.snapshot(terminal=True)
            graph = h.backend.cleanup_receipts(0, 60_000_000)
            self.assertEqual(graph["missing_evidence"], [])
        else:
            graph = None

        def terminal_request(value, deadline):
            if isinstance(value, T.SnapshotRequest) and state == "absent":
                raise T.BusRemoteError("org.freedesktop.systemd1.NoSuchUnit")
            return request(value, deadline)

        h.driver.request = terminal_request
        h.driver.reply = h.snapshot(terminal=True)
        if state == "cleared":
            h.driver.reply["service"].update(ControlGroup="", ControlGroupId=0)
        return h, binding, graph

    def test_retained_terminal_then_no_such_unit_exports_actual_original_graph(self):
        h, binding, retained = self.harness()
        observed = h.backend.terminal_observation(0, 60_000_000)
        self.assertEqual(set(observed), {"original_unit_binding", "current_manager_before",
                                       "current_manager_after", "cleanup_graph", "unit_state_read"})
        self.assertEqual(observed["original_unit_binding"], binding)
        self.assertEqual(observed["current_manager_before"], h.backend.ready.manager_binding)
        self.assertEqual(observed["current_manager_after"], h.backend.ready.manager_binding)
        self.assertEqual(observed["unit_state_read"], {"kind": "NO_SUCH_UNIT",
                         "error_name": "org.freedesktop.systemd1.NoSuchUnit", "object_path": binding["object_path"]})
        graph = observed["cleanup_graph"]
        self.assertEqual(graph["final_unit_receipt"], retained["final_unit_receipt"])
        self.assertEqual(graph["keeper_reap_receipt"]["systemd_main_exit"]["original_process_generation"], F.KEEPER)
        self.assertEqual(graph["missing_evidence"], [])
        self.assertTrue(h.backend.validate_release_graph(0, graph, 60_000_000))
        observed["original_unit_binding"]["invocation_id"] = "e" * 32
        graph["final_unit_receipt"]["snapshot"]["unit"]["InvocationID"] = "e" * 32
        self.assertEqual(h.backend.slots[0].binding["invocation_id"], binding["invocation_id"])
        self.assertEqual(h.backend.slots[0].final_receipt["snapshot"]["unit"]["InvocationID"], binding["invocation_id"])
        self.assertEqual(h.driver.log.count("StartRequest"), 1)
        self.assertEqual(h.driver.log.count("StopRequest"), 1)

    def test_cleared_terminal_pair_is_reported_as_terminal_not_retained_live_cgroup(self):
        h, binding, _ = self.harness(state="cleared")
        observed = h.backend.terminal_observation(0, 60_000_000)
        current = observed["unit_state_read"]
        self.assertEqual(current["kind"], "TERMINAL_CLEARED")
        self.assertEqual(current["snapshot"]["service"]["ControlGroup"], "")
        self.assertEqual(current["snapshot"]["service"]["ControlGroupId"], 0)
        self.assertEqual(observed["original_unit_binding"]["control_group"], binding["control_group"])
        self.assertEqual(observed["cleanup_graph"]["missing_evidence"], [])

    def test_no_such_unit_cannot_create_missing_terminal_graph(self):
        h, _, _ = self.harness(retain_terminal=False)
        with self.assertRaisesRegex(B.BackendError, "TERMINAL_GRAPH_INCOMPLETE"):
            h.backend.terminal_observation(0, 60_000_000)
        self.assertIsNone(h.backend.slots[0].final_receipt)

    def test_each_missing_original_settlement_remains_incomplete(self):
        for field in ("start_job_path", "stop_job_path", "exit_fact", "final_receipt"):
            with self.subTest(field=field):
                h, _, _ = self.harness()
                setattr(h.backend.slots[0], field, None)
                with self.assertRaisesRegex(B.BackendError, "TERMINAL_GRAPH_INCOMPLETE"):
                    h.backend.terminal_observation(0, 60_000_000)

    def test_original_manager_change_is_sticky_and_cannot_use_retained_terminal(self):
        h, _, _ = self.harness()
        h.driver.binding["owner_unique_name"] = ":1.99"
        with self.assertRaises((B.BackendError, T.TransportError)):
            h.backend.terminal_observation(0, 60_000_000)
        h.driver.binding["owner_unique_name"] = ":1.2"
        with self.assertRaises((B.BackendError, T.TransportError)):
            h.backend.terminal_observation(0, 60_000_000)
        self.assertTrue(h.backend.invalid or h.transport.invalid)

    def test_cleanup_phase_and_original_deadline_guard_every_observation(self):
        h, _, _ = self.harness()
        h.backend.cleanup_started = False
        calls = len(h.driver.log)
        with self.assertRaisesRegex(B.BackendError, "TERMINAL_REQUIRES_CLEANUP"):
            h.backend.terminal_observation(0, 60_000_000)
        self.assertEqual(len(h.driver.log), calls)
        h.backend.cleanup_started = True
        h.clock.value = 60_000_000
        with self.assertRaises((B.BackendError, T.TransportError)):
            h.backend.terminal_observation(0, 60_000_000)
        self.assertEqual(len(h.driver.log), calls)

    def test_callback_crossing_original_deadline_cannot_complete_terminal_observation(self):
        h, _, _ = self.harness()
        original_epoch = h.driver.epoch

        def late_epoch(deadline):
            value = original_epoch(deadline)
            h.clock.value = deadline
            return value

        h.driver.epoch = late_epoch
        with self.assertRaises((B.BackendError, T.TransportError)):
            h.backend.terminal_observation(0, 60_000_000)


class CgroupFilesystemFixture:
    """Pure handle registry, separate from every nominal native filesystem."""
    def __init__(self, unit):
        self.unit, self.present, self.detached, self.closed = unit, True, False, []
        self.root = P.NodeIdentity(4, 3, 11, P.CGROUP2_SUPER_MAGIC, 1)
        self.parent = P.NodeIdentity(4, 4, 11, P.CGROUP2_SUPER_MAGIC, 1)
        self.leaf = P.NodeIdentity(4, 5, 11, P.CGROUP2_SUPER_MAGIC, 1)
        self.mount = P.CgroupMount(11, 1, "0:4", "/", "/sys/fs/cgroup", "rw", (), "cgroup2", "rw")
        self.current_context = P.MountContext(F.BOOT, 1, 2, (self.mount,))

    def open_root(self, deadline):
        return "/"

    def open_dir_at(self, parent, name, deadline):
        path = parent.rstrip("/") + "/" + name
        if path == "/sys/fs/cgroup" + self.unit["control_group"] and not self.present:
            raise FileNotFoundError(errno.ENOENT, "fixture original leaf absent")
        return path

    def identity(self, handle, deadline):
        if handle == "/sys/fs/cgroup" + self.unit["control_group"]:
            return replace(self.leaf, nlink=0) if self.detached else self.leaf
        if handle == "/sys/fs/cgroup/system.slice":
            return self.parent
        return self.root

    def context(self, cap, deadline):
        return self.current_context

    def read_at(self, handle, name, cap, deadline):
        return {"memory.peak": b"49152\n", "cgroup.events": b"populated 1\n",
                "cgroup.procs": b"33\n"}[name]

    def close(self, handle):
        self.closed.append(handle)


class FactoryTerminalClosureTests(unittest.TestCase):
    def setUp(self):
        self.h = N.NativeCompositionTests()
        self.h.setUp()
        self.addCleanup(self.h.doCleanups)
        self.factory, self.clock = self.h.factory, self.h.clock
        self.fs = CgroupFilesystemFixture(self.h.unit)
        self.source = self.factory.identity_source(self.h.unit, self.h.deadline_ns())
        expected = self.source.snapshot(self.h.deadline_ns())
        bound = P.bind_before_go(expected, self.source, filesystem=self.fs, clock=self.factory.clock)
        self.assertEqual(bound.observation.status, P.Status.COMPLETE, bound.observation.issues)
        self.core = bound.observer
        self.bound_observation = bound.observation
        self.addCleanup(self.core.close)
        self.revalidate = self.h.patches.enter_context(patch.object(
            M._NativeCgroupPerimeter, "revalidate", autospec=True,
            side_effect=lambda perimeter, capture, binding, deadline: {
                "kind": "FIXTURE_PERIMETER_REVALIDATED", "unit_binding": deepcopy(self.h.unit),
                "started_ns": self.clock.value * 1000, "finished_ns": self.clock.value * 1000}))
        self.h.patches.enter_context(patch.object(T._NativeBus, "poll", autospec=True, return_value=[]))
        self.h.identity.budget = self.h.backend.budget
        self.h.snapshot["unit"]["DefaultDependencies"] = False

    def terminal(self, kind="absent"):
        h, state = self.h, self.h.backend.slots[0]
        self.clock.value = max(self.clock.value, 100)
        state.reservation, state.start_request_ref, state.stop_request_ref = "a" * 64, "b" * 64, "c" * 64
        state.start_attempted = state.stop_attempted = True
        state.start_job_path, state.stop_job_path = "/org/freedesktop/systemd1/job/1", "/org/freedesktop/systemd1/job/2"
        for number in (1, 2):
            event = T.JobEvent(F.BOOT, h.manager["bus_guid"], h.manager["owner_unique_name"], number,
                               "/org/freedesktop/systemd1/job/" + str(number), h.unit["name"], "done", self.clock.value)
            state.events[event.job_path] = event
        release = {"tag": "PIDFD_TASK_RELEASED", "original_process_generation": deepcopy(F.KEEPER),
                   "pidfd_identity_ref": "pidfd:fixture", "procfs_namespace_ref": F.KEEPER["pid_namespace_ref"],
                   "fdinfo_pid": -1, "retained_original": True, "not_closed_or_reused": True,
                   "before_us": str(self.clock.value), "after_us": str(self.clock.value)}
        self.h.patches.enter_context(patch.object(B._NativeIdentity, "release_fact", autospec=True, return_value=release))
        h.backend.begin_cleanup()
        h.snapshot["unit"].update(ActiveState="inactive", SubState="dead")
        h.snapshot["service"].update(MainPID=0, ControlPID=0, ExecMainPID=F.KEEPER["pid"], ExecMainCode=1,
                                      ExecMainStatus=0, ExecMainStartTimestampMonotonic=50,
                                      ExecMainExitTimestampMonotonic=90)
        graph = h.backend.cleanup_receipts(0, 60_000_000)
        self.assertEqual(graph["missing_evidence"], [])
        self.assertTrue(h.backend.validate_release_graph(0, graph, 60_000_000))
        if kind == "absent":
            h.request.side_effect = T.BusRemoteError("org.freedesktop.systemd1.NoSuchUnit")
        else:
            h.snapshot["service"].update(ControlGroup="", ControlGroupId=0)
        return graph

    def policy(self):
        return self.factory.absence_policy(self.core.binding_ref, self.core.binding, self.h.deadline_ns())

    def journal(self):
        records = {item["ref"]: item["record"] for item in self.factory.export_evidence()["records"]}
        for ref, record in records.items():
            raw = json.dumps(record, ensure_ascii=False, sort_keys=True,
                             separators=(",", ":"), allow_nan=False).encode("utf-8")
            self.assertEqual(ref, hashlib.sha256(raw).hexdigest())
        return records

    @staticmethod
    def perimeter_preimage(records, ref):
        """Resolve journal projections back to every original observed field."""
        value = deepcopy(records[ref])
        for key in ("unit_binding", "context", "root", "parent", "leaf", "effective_properties",
                    "delegate_observation", "keeper_capture", "keeper_after"):
            if key + "_ref" in value:
                value[key] = deepcopy(records[value.pop(key + "_ref")])
        if "ancestor_refs" in value:
            value["ancestors"] = [deepcopy(records[item]) for item in value.pop("ancestor_refs")]
        bracket = value.get("walk_bracket")
        if bracket is not None:
            bracket["observed_groups"] = {item: deepcopy(records[item])
                                          for item in bracket.pop("observed_group_refs")}
        return value

    def typed_closure(self, observation):
        """Use the delivered adapter's real proof boundary, with injected provenance."""
        adapter = P.RuntimePhysicalObserver(self.h.spec)
        binding, unit = self.core.binding, self.h.unit
        physical = C.PhysicalBinding.from_mapping({
            "run": self.h.spec.run, "slot": unit["slot"], "boot_id": binding.context.boot_id,
            "manager_owner": binding.manager.manager_owner, "bus_guid": binding.manager.manager_guid,
            "unit_name": unit["name"], "invocation_id": unit["invocation_id"],
            "control_group": unit["control_group"], "control_group_id": unit["control_group_id"],
            "unit_binding_ref": C.digest_record(unit), "physical_ref": "leaf:fixture-original",
            "parent_ref": "parent:fixture-original", "mount_namespace_ref": "mnt:[2]",
            "mount_id": str(binding.leaf.mount_id), "fs_type": "cgroup2",
            "dev": str(binding.leaf.device), "inode": str(binding.leaf.inode),
            "leaf_basename": binding.leaf_name})
        proof = C.BindingProof.from_mapping({
            "physical_binding_ref": C.digest_record(physical),
            "original_leaf_identity": adapter._directory(binding.leaf, binding.context, unit["control_group"]),
            "original_parent_identity": adapter._directory(binding.parent, binding.context, "/system.slice"),
            "before_us": str(self.clock.value), "after_us": str(self.clock.value)})
        C.validate_binding_proof(proof.to_mapping(), physical.to_mapping())
        leaf = P._RuntimeLeaf(self.core, self.source, unit, F.KEEPER, physical, proof)
        raw_ref = adapter._put(observation, raw=True)
        fact, closure_proof = adapter._closure_record(leaf, observation, raw_ref)
        C.validate_cleanup_proof(closure_proof.to_mapping(), proof.to_mapping(),
                                 physical=physical.to_mapping())
        self.assertTrue(adapter.fixture_only)
        self.assertTrue(adapter.export_evidence()["fixture_only"])
        self.closure_adapter = adapter
        return fact, closure_proof

    def test_live_bind_and_sample_still_require_fresh_original_identity(self):
        peak = P.observe_memory_peak(self.core)
        self.assertEqual(peak.status, P.Status.COMPLETE, peak.issues)
        self.assertEqual(peak.value.bytes, 49152)
        self.assertEqual(peak.origin, "injected-filesystem")
        self.assertIs(type(self.source.snapshot(self.h.deadline_ns())), P.ManagerIdentity)
        self.assertFalse(self.factory.core_bindings)
        populated = P.observe_closure(self.core)
        self.assertEqual(populated.status, P.Status.INCOMPLETE)
        fact, proof = self.typed_closure(populated)
        self.assertIs(type(proof), C.ClosureUnavailable)
        self.assertEqual(fact["tag"], "Unavailable")

    def test_absence_policy_uses_pre_go_capture_original_binding_and_original_lease(self):
        self.terminal()
        policy = self.policy()
        self.assertIs(type(policy), P.AbsencePolicy)
        self.assertEqual(policy.binding_ref, self.core.binding_ref)
        self.assertEqual(len(policy.binding_ref), 32)
        self.assertEqual(policy.policy_id, "sole-mutator-protected-cgroup-v1")
        self.assertEqual(policy.exclusions, frozenset({"rename", "replacement", "migration"}))
        self.assertEqual(policy.valid_from_ns, self.factory.perimeters[C.digest_record(self.h.unit)][0]["finished_ns"])
        self.assertEqual(policy.valid_until_ns, 60_000_000 * 1000)
        records = self.journal()
        record = records[policy.source_ref]
        self.assertEqual(record["cleanup_graph"]["missing_evidence"], [])
        capture, capture_ref = self.factory.perimeters[C.digest_record(self.h.unit)]
        self.assertEqual(record["protection_capture_ref"], capture_ref)
        self.assertEqual(self.perimeter_preimage(records, capture_ref), capture)
        self.assertNotIn("protection_capture", record)
        for field in ("protection_before_ref", "protection_after_ref"):
            self.assertEqual(self.perimeter_preimage(records, record[field])["unit_binding"], self.h.unit)
        record["cleanup_graph"]["missing_evidence"].append("fixture exported mutation")
        self.assertEqual(self.journal()[policy.source_ref]["cleanup_graph"]["missing_evidence"], [])
        self.assertIs(self.factory.core_bindings[C.digest_record(self.h.unit)][1], self.core.binding)

    def test_settled_no_such_and_cleared_pair_close_actual_retained_core_without_fake_live(self):
        release = self.h.patches.enter_context(patch.object(
            self.h.backend, "release_receipt", wraps=self.h.backend.release_receipt))
        self.terminal()
        policy = self.policy()
        terminal = self.source.closure_snapshot(self.h.deadline_ns())
        self.assertIs(type(terminal), P.TerminalIdentityObservation)
        self.assertEqual(terminal.kind, "SETTLED_ORIGINAL")
        self.assertEqual(terminal.original_unit_binding, self.h.unit)
        records = self.journal()
        body = records[terminal.source_ref]
        self.assertEqual(set(body), {"kind", "original_unit_binding", "current_manager_before",
                                    "current_manager_after", "cleanup_graph", "unit_state_read",
                                    "started_ns", "finished_ns"})
        self.assertEqual(body["cleanup_graph"]["missing_evidence"], [])
        wrappers = [record for record in records.values()
                    if record.get("kind") == "NATIVE_TERMINAL_IDENTITY_OBSERVATION"]
        self.assertEqual(len(wrappers), 1)
        self.assertEqual(wrappers[0]["terminal_ref"], terminal.source_ref)
        for field in ("protection_capture_ref", "protection_before_ref", "protection_after_ref"):
            self.assertEqual(self.perimeter_preimage(records, wrappers[0][field])["unit_binding"], self.h.unit)
        populated = P.observe_closure(self.core, policy=policy)
        self.assertEqual(populated.status, P.Status.INCOMPLETE)
        self.assertEqual(populated.value.kind, P.ClosureKind.UNAVAILABLE)
        self.fs.present, self.fs.detached = False, True
        closure = P.observe_closure(self.core, policy=policy)
        self.assertEqual(closure.status, P.Status.COMPLETE, closure.issues)
        self.assertEqual(closure.value.kind, P.ClosureKind.ORIGINAL_ABSENT)
        self.assertIsNone(closure.value.populated)
        fact, proof = self.typed_closure(closure)
        self.assertIs(type(proof), C.ClosureProof)
        self.assertEqual(fact["tag"], "OriginalAbsent")
        self.assertEqual(proof.to_mapping()["operation"]["kind"], "OPENAT_ORIGINAL_ABSENT")
        release.assert_not_called()
        authority = M.NativeSettlementAuthority(self.h.spec)
        authority.attach_once(self.h.backend)
        with patch.object(M, "monotonic_us", return_value=self.clock.value):
            allowed = authority.prove_release_allowed(self.h.backend.payload, 60_000_000)
        self.assertEqual(len(allowed["slots"]), 3)
        self.assertEqual(allowed["slots"][0]["basis"], "START_DISPATCHED_BOUND")
        self.assertTrue(allowed["slots"][0]["no_future_own_exec"])
        self.assertEqual(release.call_count, 3)
        with self.assertRaises(T.BusRemoteError):
            self.source.snapshot(self.h.deadline_ns())
        peak = P.observe_memory_peak(self.core)
        self.assertEqual(peak.status, P.Status.INCOMPLETE)
        self.assertIsNone(peak.value.bytes)
        rebound = P.bind_before_go(self.core.binding.manager, self.source, filesystem=self.fs, clock=self.factory.clock)
        self.assertEqual(rebound.observation.status, P.Status.INCOMPLETE)
        self.assertIsNone(rebound.observer)

    def test_cleared_pair_is_terminal_only_for_closure(self):
        self.terminal("cleared")
        policy = self.policy()
        terminal = self.source.closure_snapshot(self.h.deadline_ns())
        self.assertIs(type(terminal), P.TerminalIdentityObservation)
        self.assertEqual(terminal.unit_state_read["kind"], "TERMINAL_CLEARED")
        with self.assertRaises(M._TerminalIdentityRequired):
            self.source.snapshot(self.h.deadline_ns())
        self.fs.present, self.fs.detached = False, True
        closure = P.observe_closure(self.core, policy=policy)
        self.assertEqual(closure.status, P.Status.COMPLETE, closure.issues)
        self.assertEqual(closure.value.kind, P.ClosureKind.ORIGINAL_ABSENT)
        fact, proof = self.typed_closure(closure)
        self.assertIs(type(proof), C.ClosureProof)
        self.assertEqual(fact["tag"], "OriginalAbsent")

    def test_rehashed_graph_and_execution_flags_cannot_authorize_terminal_policy(self):
        self.terminal()
        original = self.h.backend.cleanup_receipts
        for field in ("activations_settled", "stop_settled", "terminal_no_pending_execution", "keeper_reaped",
                      "forged_pidfd_record"):
            with self.subTest(field=field):
                def changed(slot, deadline):
                    graph = original(slot, deadline)
                    if field == "forged_pidfd_record":
                        graph["keeper_reap_receipt"]["pidfd_task_released"]["not_closed_or_reused"] = False
                        graph["keeper_reap_receipt_ref"] = C.digest_record(graph["keeper_reap_receipt"])
                    else:
                        graph[field] = False
                    self.assertFalse(self.h.backend.validate_release_graph(slot, graph, deadline))
                    return graph
                with patch.object(self.h.backend, "cleanup_receipts", side_effect=changed):
                    with self.assertRaisesRegex(B.BackendError, "TERMINAL_GRAPH_INCOMPLETE"):
                        self.policy()
        self.assertFalse(any(record.get("kind") == "NATIVE_ABSENCE_POLICY"
                             for record in self.journal().values()))

    def test_no_such_and_enoent_with_linked_original_handle_remain_unavailable(self):
        self.terminal()
        policy = self.policy()
        self.fs.present = False
        closure = P.observe_closure(self.core, policy=policy)
        self.assertEqual(closure.status, P.Status.INCOMPLETE)
        self.assertTrue(any("still linked" in issue for issue in closure.issues), closure.issues)
        fact, proof = self.typed_closure(closure)
        self.assertIs(type(proof), C.ClosureUnavailable)
        self.assertEqual(fact["tag"], "Unavailable")

    def test_physical_leaf_replacement_is_not_original_absence(self):
        self.terminal()
        policy = self.policy()
        self.fs.leaf = replace(self.fs.leaf, inode=self.fs.leaf.inode + 1)
        closure = P.observe_closure(self.core, policy=policy)
        self.assertEqual(closure.status, P.Status.INCOMPLETE)
        self.assertTrue(any("original leaf handle changed" in issue for issue in closure.issues), closure.issues)
        fact, proof = self.typed_closure(closure)
        self.assertIs(type(proof), C.ClosureUnavailable)
        self.assertEqual(fact["tag"], "Unavailable")

    def test_physical_name_reappearing_after_verified_absence_invalidates_success(self):
        self.terminal()
        policy = self.policy()
        self.fs.present, self.fs.detached = False, True
        first = P.observe_closure(self.core, policy=policy)
        self.assertEqual(first.status, P.Status.COMPLETE, first.issues)
        self.fs.present, self.fs.detached = True, False
        second = P.observe_closure(self.core, policy=policy)
        self.assertEqual(second.status, P.Status.INCOMPLETE)
        self.assertTrue(any("reappeared" in issue for issue in second.issues), second.issues)
        fact, proof = self.typed_closure(second)
        self.assertIs(type(proof), C.ClosureUnavailable)
        self.assertEqual(fact["tag"], "Unavailable")

    def test_absence_policy_requires_original_binding_and_entire_observation_interval(self):
        self.terminal()
        policy = self.policy()
        self.fs.present, self.fs.detached = False, True
        invalid = (replace(policy, binding_ref="f" * 32),
                   replace(policy, valid_from_ns=self.clock.value * 1000 + 1),
                   replace(policy, valid_until_ns=self.clock.value * 1000))
        for candidate in invalid:
            with self.subTest(policy=candidate):
                closure = P.observe_closure(self.core, policy=candidate)
                self.assertEqual(closure.status, P.Status.INCOMPLETE)
                self.assertEqual(closure.value.kind, P.ClosureKind.UNAVAILABLE)
        valid = P.observe_closure(self.core, policy=policy)
        self.assertEqual(valid.status, P.Status.COMPLETE, valid.issues)

    def test_three_slot_upper_fixture_preserves_full_journals_within_original_store_limit(self):
        """Size upper fixture; copied slot-zero records establish no three-slot certificate."""
        perimeter = PN.NativePerimeterTests()
        with patch.object(M._NativeCgroupPerimeter, "capture", _NATIVE_CAPTURE), \
                patch.object(M._NativeCgroupPerimeter, "revalidate", _NATIVE_REVALIDATE), \
                patch.object(B._NativeIdentity, "current_generation", _NATIVE_GENERATION), \
                patch.object(B._NativeIdentity, "verify_workload", _NATIVE_WORKLOAD):
            try:
                perimeter.setUp()
                capture = perimeter.capture()
                binding = perimeter.binding()
                present = perimeter.perimeter.revalidate(capture, binding, 60_000_000_000)
                perimeter.tree.errors[perimeter.tree.leaf] = errno.ENOENT
                absent = []
                for _ in range(6):
                    perimeter.now_ns += 1000
                    observed_us = str(perimeter.now_ns // 1000)
                    perimeter.delegation.update(before_us=observed_us, after_us=observed_us)
                    absent.append(perimeter.perimeter.revalidate(capture, binding, 60_000_000_000))
            finally:
                perimeter.doCleanups()
        # These are the real full permission/credential/component-walk records.
        self.assertIn("keeper_capture", capture)
        self.assertIn("ancestors", capture)
        self.assertIn("leaf", absent[0])
        peak, census = P.observe_memory_peak(self.core), P.observe_census(self.core)
        self.assertEqual(peak.status, P.Status.COMPLETE)
        self.assertEqual(census.status, P.Status.COMPLETE)
        self.terminal()
        policy = self.policy()
        self.fs.present, self.fs.detached = False, True
        closure = P.observe_closure(self.core, policy=policy)
        self.assertEqual(closure.status, P.Status.COMPLETE, closure.issues)
        _, proof = self.typed_closure(closure)
        self.assertIs(type(proof), C.ClosureProof)
        adapter = self.closure_adapter
        for observation in (self.bound_observation, peak, census):
            adapter._put(observation, raw=True)
        adapter._put(proof)
        observer_records = adapter.export_evidence()["records"]
        # Capture, a conservative extra present recheck, policy brackets and
        # both terminal-closure brackets. Each read has its own actual fixture
        # time; the producer alone shares immutable full metadata preimages.
        full_perimeter = [capture, present] + absent
        perimeter_refs = [self.factory._put_perimeter_observation(record) for record in full_perimeter]
        self.assertEqual(len(set(perimeter_refs)), len(full_perimeter))
        records = self.journal()
        for ref, original in zip(perimeter_refs, full_perimeter):
            self.assertEqual(self.perimeter_preimage(records, ref), original)
        producer_records = self.factory.export_evidence()["records"]
        h = WD.Harness()
        h.measured_three()
        h.settle()
        h.observer.export_evidence = lambda: {
            "fixture_only": True, "records": deepcopy(observer_records * 3)}
        h.observer.export_producer_evidence = lambda: {
            "fixture_only": True, "records": deepcopy(producer_records * 3)}
        exported = h.watchdog.export_evidence()
        raw = json.dumps(exported, ensure_ascii=False, sort_keys=True,
                         separators=(",", ":"), allow_nan=False).encode("utf-8")
        self.assertEqual(M.STORE_LIMIT, 524288)
        self.assertEqual(len(exported["slots"]), 3)
        self.assertTrue(exported["fixture_only"])
        self.assertTrue(exported["observer_journal"]["fixture_only"])
        self.assertTrue(exported["physical_producer_journal"]["fixture_only"])
        self.assertEqual(len(exported["physical_producer_journal"]["records"]),
                         len(producer_records) * 3)
        self.assertLessEqual(len(raw), M.STORE_LIMIT, "Full ordinary three-slot upper fixture exceeds unchanged sink")
        type(self).evidence_budget_bytes = len(raw)

    def test_scope_core_binding_reference_and_local_object_custody_cannot_be_replaced(self):
        self.terminal()
        self.policy()
        for replacement in ("a" * 64, "f" * 32):
            with self.subTest(reference=replacement), self.assertRaises(ValueError):
                self.factory.absence_policy(replacement, self.core.binding, self.h.deadline_ns())
        with self.assertRaisesRegex(ValueError, "custody changed"):
            self.factory.absence_policy(self.core.binding_ref, replace(self.core.binding), self.h.deadline_ns())
        changed = replace(self.h.spec, scope_ref="hermetic-unapproved-scope")
        with patch.object(self.h.backend, "spec", changed), self.assertRaisesRegex(ValueError, "scope required"):
            M.create_native_physical_producer_factory(changed, backend=self.h.backend, physical_module=P)

    def test_protection_permission_or_identity_failure_has_no_policy_or_terminal_success(self):
        self.terminal()
        self.revalidate.side_effect = PermissionError("fixture protection read unavailable")
        with self.assertRaises(PermissionError):
            self.policy()
        self.assertFalse(self.factory.core_bindings)
        self.assertFalse(any(item["record"].get("kind") == "NATIVE_ABSENCE_POLICY"
                             for item in self.factory.export_evidence()["records"]))

    def test_missing_terminal_graph_and_owner_change_never_authorize_absence(self):
        self.terminal()
        self.h.backend.slots[0].exit_fact = None
        with self.assertRaisesRegex(B.BackendError, "TERMINAL_GRAPH_INCOMPLETE"):
            self.policy()
        self.h.actual_manager["owner_unique_name"] = ":1.99"
        with self.assertRaises((T.TransportError, B.BackendError, ValueError)):
            self.policy()
        self.assertFalse(any(item["record"].get("kind") == "NATIVE_ABSENCE_POLICY"
                             for item in self.factory.export_evidence()["records"]))

    def test_policy_original_interval_does_not_renew_after_late_callback(self):
        self.terminal()
        original = self.revalidate.side_effect

        def late(perimeter, capture, binding, deadline):
            value = original(perimeter, capture, binding, deadline)
            self.clock.value = deadline // 1000
            return value

        self.revalidate.side_effect = late
        with self.assertRaises((T.TransportError, B.BackendError, ValueError)):
            self.policy()
        self.assertFalse(any(item["record"].get("kind") == "NATIVE_ABSENCE_POLICY"
                             for item in self.factory.export_evidence()["records"]))


if __name__ == "__main__":
    unittest.main()
