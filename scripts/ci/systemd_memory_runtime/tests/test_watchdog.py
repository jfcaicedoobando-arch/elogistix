"""Hermetic watchdog boundary tests; no Linux, manager, socket or process I/O."""

from copy import deepcopy
from contextlib import ExitStack
from dataclasses import replace
from pathlib import Path
from types import SimpleNamespace
import hashlib
import json
import sys
import unittest
from unittest.mock import Mock, mock_open, patch

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
from systemd_memory_runtime import contracts
from systemd_memory_runtime import watchdog as watchdog_module
from systemd_memory_runtime.watchdog import PeerIdentity, Watchdog, WatchdogError


BOOT = "11111111-2222-3333-4444-555555555555"
RUN = "a" * 32
PAYLOAD_SHA = "b" * 64


def ref(value):
    return contracts.digest_record(value)


def generation(pid, ticks=None):
    return {"pid": pid, "start_ticks": str(ticks or pid * 10), "boot_id": BOOT,
            "pid_namespace_ref": "pid:[fixture]", "mount_namespace_ref": "mnt:[fixture]"}


def make_spec():
    scenarios = ("OVERLAP", "LEADER_EXIT_THREAD_SURVIVES", "DESCENDANT_IGNORES_TERM")
    slots = tuple(contracts.SlotSpec(i, "elogistix-memory-adapter-" + f"{i + 1:032x}" + ".service", scenario)
                  for i, scenario in enumerate(scenarios))
    return contracts.RunSpec(RUN, 1_000_000, 51_000_000, 61_000_000, slots,
                             1001, 1001, (1001,), PAYLOAD_SHA,
                             contracts.CLEANUP_POLICY_ID, "hermetic-fixture-only")


class Clock:
    def __init__(self, now=1_000_000):
        self.now = now

    def __call__(self):
        return self.now


class FakeBackend:
    fixture_only = True

    def __init__(self, spec, clock, log):
        self.spec, self.clock, self.log = spec, clock, log
        self.manager = {"boot_id": BOOT, "bus_guid": "c" * 32, "owner_unique_name": ":1.42",
                        "manager_pid_generation": generation(1),
                        "authority_lease_until_us": str(spec.cleanup_deadline_us + 1_000_000)}
        self.ready = True
        self.start_states = {}
        self.start_errors = set()
        self.start_advance_us = 0
        self.reserved = {}
        self.start_calls, self.stop_calls = [], []
        self.candidate_missing = set()
        self.receipts = {}
        self.bound_units = {}
        self.events = []
        self.retained_job_events = {}
        self.cleanup_modes = {}
        self.unit_overrides = {}
        self.start_hook = None
        self.stop_error = False
        self.cleanup_started = False
        self.cleanup_transitions = 0
        self.reserve_hook = None
        self.release_receipt_calls = []
        self.release_overrides = {}

    def preflight(self, spec, deadline):
        self.log.append(("backend.preflight", deadline))
        return {"manager_binding": deepcopy(self.manager), "jobs_listener_ready": self.ready,
                "jobs_listener_ref": ref("fixture-observer")}

    def reserve_start(self, slot, ledger_ref):
        if self.cleanup_started:
            raise WatchdogError("DEADLINE")
        if slot in self.reserved:
            raise AssertionError("backend reservation replay")
        self.reserved[slot] = ledger_ref
        self.log.append(("backend.reserve_start", slot, ledger_ref))
        if self.reserve_hook is not None:
            self.reserve_hook(slot)

    def start_reserved(self, slot, payload, deadline):
        if self.cleanup_started:
            raise WatchdogError("DEADLINE")
        if slot not in self.reserved:
            raise AssertionError("mutation before retained reservation")
        self.start_calls.append((slot, deadline))
        self.log.append(("backend.start", slot, deadline))
        if self.start_hook is not None:
            self.start_hook(slot)
        self.clock.now += self.start_advance_us
        if slot in self.start_errors:
            raise OSError("fixture transport ambiguity")
        state = self.start_states.get(slot, "ACCEPTED")
        if state == "ACCEPTED":
            event = self.job_event(slot, "start")
            self.retained_job_events[(slot, "start")] = deepcopy(event)
            self.events.append(event)
        return {"state": state, "request_ref": ref({"start": slot}),
                "job_ref": self.job_ref(slot, "start") if state == "ACCEPTED" else None}

    def begin_cleanup(self):
        if not self.cleanup_started:
            self.cleanup_started = True
            self.cleanup_transitions += 1
            self.log.append(("backend.begin_cleanup",))

    def release_receipt(self, slot, deadline):
        self.release_receipt_calls.append((slot, deadline))
        self.log.append(("backend.release_receipt", slot, deadline))
        dispatched = any(started == slot for started, _ in self.start_calls)
        bound = slot in self.bound_units
        if not dispatched:
            basis = "RESERVED_NOT_DISPATCHED" if slot in self.reserved else "NOT_RESERVED_NOT_DISPATCHED"
            graph = None
            no_future = self.cleanup_started
        elif not bound:
            basis, graph, no_future = "START_DISPATCHED_UNKNOWN", None, False
        else:
            basis = "START_DISPATCHED_BOUND"
            graph = self.cleanup_receipts(slot, deadline)
            no_future = self.cleanup_started and all(graph.get(flag) is True for flag in
                ("activations_settled", "stop_settled", "terminal_no_pending_execution", "keeper_reaped"))
        result = {"slot": slot, "run": RUN, "reservation_ref": self.reserved.get(slot),
                  "payload_binding_ref": ref(self.distribution_payload), "manager_binding_ref": ref(self.manager),
                  "basis": basis, "no_future_own_exec": no_future, "observed_us": str(self.clock.now),
                  "authority_lease_until_us": self.manager["authority_lease_until_us"],
                  "cleanup_receipts": graph, "test_boundary": True}
        result.update(deepcopy(self.release_overrides.get(slot, {})))
        return result

    def candidate(self, slot):
        spec = self.spec.slots[slot]
        return {"slot": slot, "name": spec.unit_name,
                "object_path": "/org/freedesktop/systemd1/unit/" + spec.unit_name.replace("-", "_2d").replace(".", "_2e"),
                "invocation_id": f"{slot + 1:032x}", "manager_binding_ref": ref(self.manager),
                "control_group": "/system.slice/" + spec.unit_name,
                "control_group_id": str(100 + slot), "main_pid": 300 + slot}

    def observe_candidate(self, slot, deadline):
        self.log.append(("backend.candidate", slot, deadline))
        if slot in self.candidate_missing or not any(started == slot for started, _ in self.start_calls):
            raise LookupError("fixture NoSuchUnit")
        return self.candidate(slot)

    def bind_unit(self, slot, keeper, deadline):
        self.log.append(("backend.bind", slot, deadline))
        result = self.candidate(slot)
        result.pop("main_pid")
        result["keeper_generation_ref"] = ref(keeper)
        result.update(deepcopy(self.unit_overrides.get(slot, {})))
        self.bound_units[slot] = deepcopy(result)
        return result

    def stop_once(self, unit, deadline):
        self.stop_calls.append((unit["slot"], deadline))
        self.log.append(("backend.stop", unit["slot"], deadline))
        if self.stop_error:
            raise OSError("fixture Stop reply lost")
        event = self.job_event(unit["slot"], "stop")
        self.retained_job_events[(unit["slot"], "stop")] = deepcopy(event)
        self.events.append(event)
        return {"state": "ACCEPTED", "request_ref": ref({"stop": unit["slot"]}),
                "job_ref": self.job_ref(unit["slot"], "stop")}

    def poll_events(self, deadline):
        self.log.append(("backend.poll", deadline))
        events, self.events = tuple(self.events), []
        return events

    def cleanup_receipts(self, slot, deadline):
        self.log.append(("backend.receipts", slot, deadline))
        if slot in self.cleanup_modes:
            result = self.complete_receipts(slot)
            for key, value in self.cleanup_modes[slot].items():
                if value is None:
                    result.pop(key, None)
                else:
                    result[key] = deepcopy(value)
            for record, digest in (("start_receipt", "start_settlement_ref"),
                                   ("stop_receipt", "stop_settlement_ref"),
                                   ("final_unit_receipt", "final_unit_receipt_ref"),
                                   ("keeper_reap_receipt", "keeper_reap_receipt_ref")):
                if type(result.get(record)) is dict and digest not in self.cleanup_modes[slot]:
                    result[digest] = ref(result[record])
            return result
        return deepcopy(self.receipts.get(slot, {
            "activations_settled": False, "stop_settled": False,
            "terminal_no_pending_execution": False, "keeper_reaped": False}))

    def job_event(self, slot, kind):
        job_id = 10 + slot if kind == "start" else 20 + slot
        return {"boot_id": BOOT, "bus_guid": self.manager["bus_guid"],
                "owner_unique_name": self.manager["owner_unique_name"], "job_id": job_id,
                "job_path": "/org/freedesktop/systemd1/job/" + str(job_id),
                "unit_name": self.spec.slots[slot].unit_name, "result": "done",
                "observed_us": self.clock.now}

    def job_ref(self, slot, kind):
        event = self.job_event(slot, kind)
        return ref({"kind": kind, "slot": slot, "boot_id": BOOT,
                    "bus_guid": event["bus_guid"], "owner": event["owner_unique_name"],
                    "job_id": event["job_id"], "job_path": event["job_path"],
                    "unit_name": event["unit_name"]})

    def complete_receipts(self, slot):
        """Explicit fixture observations, never a synthesized PID1 wait receipt."""
        unit, keeper = self.bound_units[slot], generation(300 + slot)
        now = str(self.clock.now)
        start = {"kind": "start", "job_ref": self.job_ref(slot, "start"),
                 "request_ref": ref({"start": slot}), "event": deepcopy(self.retained_job_events.get(
                    (slot, "start"), self.job_event(slot, "start")))}
        stop = {"kind": "stop", "job_ref": self.job_ref(slot, "stop"),
                "request_ref": ref({"stop": slot}), "event": deepcopy(self.retained_job_events.get(
                    (slot, "stop"), self.job_event(slot, "stop")))}
        snapshot = {"object_path": unit["object_path"],
                    "unit": {"Id": unit["name"], "InvocationID": unit["invocation_id"],
                             "ActiveState": "inactive", "SubState": "dead", "Job": [0, "/"], "Transient": True},
                    "service": {"MainPID": 0, "ControlPID": 0, "ControlGroup": unit["control_group"],
                                "ControlGroupId": int(unit["control_group_id"]), "ExecMainPID": keeper["pid"],
                                "ExecMainCode": 1, "ExecMainStatus": 0}}
        final = {"original_unit_binding_ref": ref(unit), "manager_binding_ref": ref(self.manager),
                 "invocation_id": unit["invocation_id"], "snapshot": snapshot,
                 "before_us": now, "after_us": now}
        exit_fact = {"tag": "SYSTEMD_MAIN_EXIT", "original_process_generation": keeper,
                     "invocation_id": unit["invocation_id"], "exec_main_pid": keeper["pid"],
                     "exec_main_code": "CLD_EXITED", "exec_main_status": 0,
                     "start_timestamp_us": str(self.spec.t0_us), "exit_timestamp_us": now,
                     "before_us": now, "after_us": now}
        release = {"tag": "PIDFD_TASK_RELEASED", "original_process_generation": keeper,
                   "pidfd_identity_ref": "pidfd:keeper-" + str(slot), "procfs_namespace_ref": "pid:[fixture]",
                   "fdinfo_pid": -1, "retained_original": True, "not_closed_or_reused": True,
                   "before_us": now, "after_us": now}
        main = {"systemd_main_exit": exit_fact, "pidfd_task_released": release}
        contracts.validate_main_release_facts(exit_fact, release)
        return {"activations_settled": True, "stop_settled": True,
                "terminal_no_pending_execution": True, "keeper_reaped": True,
                "start_receipt": start, "stop_receipt": stop, "final_unit_receipt": final,
                "keeper_reap_receipt": main, "start_settlement_ref": ref(start),
                "stop_settlement_ref": ref(stop), "final_unit_receipt_ref": ref(final),
                "keeper_reap_receipt_ref": ref(main), "missing_evidence": [], "test_boundary": True}


class FakeDistribution:
    fixture_only = True

    def __init__(self, spec, log):
        self.spec, self.log = spec, log
        self.release_calls = []
        self.release_hook = None
        self.release_error = False
        self.payload = {"kind": "VERIFIED_STAGED_ELF", "sha256": PAYLOAD_SHA,
                        "absolute_path": "/run/elogistix-memory-" + RUN + "/keeper",
                        "dev": "2", "inode": "3", "mount_namespace_ref": "mnt:[fixture]",
                        "owner_uid": 0, "protected_ancestor_refs": ["parent:fixture"],
                        "exec_identity_proof_ref": "PENDING_BEFORE_EXEC"}

    def prepare(self, spec, deadline):
        self.log.append(("distribution.prepare", deadline))
        return deepcopy(self.payload)

    def verify(self, payload, deadline):
        self.log.append(("distribution.verify", deadline))
        return {"verified": True, "binding_ref": ref(payload)}

    def release(self, payload, receipt, deadline):
        self.release_calls.append((deepcopy(payload), deepcopy(receipt), deadline))
        self.log.append(("distribution.release", deadline))
        if self.release_hook is not None:
            self.release_hook()
        if self.release_error:
            raise OSError("fixture payload release failed")
        return {"released": True, "receipt_ref": ref({"payload": payload["sha256"],
                "certificates": [slot["certificate"] for slot in receipt["slots"]]})}


class FakeObserver:
    fixture_only = True

    def __init__(self, spec, backend, clock, log):
        self.spec, self.backend, self.clock, self.log = spec, backend, clock, log
        self.bindings = {}
        self.sample_calls, self.probe_calls = [], []
        self.sample_bytes = "4096"
        self.physical_tags = {}
        self.evidence_overrides = {}
        self.binding_overrides = {}
        self.sample_overrides = {}
        self.binding_proofs, self.closure_proofs = {}, {}
        self.binding_proof_overrides, self.closure_overrides = {}, {}
        self.root_overrides = {}

    def preflight(self, spec):
        self.log.append(("observer.preflight",))
        result = {"run": RUN, "original_root_identity": {"boot_id": BOOT,
            "mount_namespace_ref": "mnt:[fixture]", "mount_id": "11", "fs_type": "cgroup2",
            "dev": "2", "inode": "998", "cgroup_path": "/"},
            "before_us": str(self.clock.now), "after_us": str(self.clock.now)}
        result.update(deepcopy(self.root_overrides))
        return result

    def bind_leaf(self, unit, keeper, deadline):
        self.log.append(("observer.bind", unit["slot"], deadline))
        result = {"run": RUN, "slot": unit["slot"], "boot_id": BOOT,
                  "manager_owner": self.backend.manager["owner_unique_name"],
                  "bus_guid": self.backend.manager["bus_guid"], "unit_name": unit["name"],
                  "invocation_id": unit["invocation_id"], "control_group": unit["control_group"],
                  "control_group_id": unit["control_group_id"], "unit_binding_ref": ref(unit),
                  "physical_ref": "leaf:fixture-" + str(unit["slot"]),
                  "mount_namespace_ref": "mnt:[fixture]", "mount_id": "11", "fs_type": "cgroup2",
                  "dev": "2", "inode": str(1000 + unit["slot"]), "parent_ref": "parent:fixture",
                  "leaf_basename": unit["name"]}
        result.update(deepcopy(self.binding_overrides.get(unit["slot"], {})))
        self.bindings[unit["slot"]] = result
        identity = {key: result[key] for key in ("boot_id", "mount_namespace_ref", "mount_id", "fs_type", "dev", "inode")}
        identity["cgroup_path"] = result["control_group"]
        parent = {**identity, "inode": "999", "cgroup_path": result["control_group"].rsplit("/", 1)[0]}
        self.binding_proofs[unit["slot"]] = {"physical_binding_ref": ref(result),
            "original_leaf_identity": deepcopy(identity), "original_parent_identity": deepcopy(parent),
            "before_us": str(self.clock.now), "after_us": str(self.clock.now)}
        return deepcopy(result)

    def binding_proof(self, physical, deadline):
        self.log.append(("observer.binding_proof", physical["slot"], deadline))
        result = deepcopy(self.binding_proofs[physical["slot"]])
        result.update(deepcopy(self.binding_proof_overrides.get(physical["slot"], {})))
        return result

    def _capture_closure(self, physical, tag):
        # The original identities come only from the retained binding capture.
        # Only the operation and its two observations are new fixture facts.
        binding = self.binding_proofs[physical["slot"]]
        absent = tag == "OriginalAbsent"
        identity = deepcopy(binding["original_parent_identity" if absent else "original_leaf_identity"])
        operation = ({"kind": "OPENAT_ORIGINAL_ABSENT", "parent_identity_ref": ref(identity),
                      "leaf_basename": physical["leaf_basename"], "errno": "ENOENT"} if absent else
                     {"kind": "DIRECT_EVENTS_EMPTY", "leaf_identity_ref": ref(identity), "populated": 0})
        operation.update({"before_us": str(self.clock.now), "after_us": str(self.clock.now)})
        closure = {"physical_binding_ref": ref(physical), "original_identity": deepcopy(identity),
                   "before_identity": deepcopy(identity), "after_identity": deepcopy(identity),
                   "operation": operation}
        closure.update(deepcopy(self.closure_overrides.get(physical["slot"], {})))
        self.closure_proofs[physical["slot"]] = deepcopy(closure)
        return closure

    def cleanup_proof(self, evidence, physical, deadline):
        self.log.append(("observer.cleanup_proof", physical["slot"], deadline))
        return deepcopy(self.closure_proofs[physical["slot"]])

    def sample_peak(self, physical, keeper, reap_ref, deadline):
        self.sample_calls.append((physical["slot"], deadline))
        self.log.append(("observer.sample", physical["slot"], deadline))
        sample = {"unit_binding_ref": physical["unit_binding_ref"], "physical_binding_ref": ref(physical),
                "keeper_generation_ref": ref(keeper), "ledger_checkpoint_ref": reap_ref,
                "metric": "memory.peak", "bytes": self.sample_bytes,
                "before_us": str(self.clock.now), "after_us": str(self.clock.now),
                "identity_before_ref": ref(physical), "identity_after_ref": ref(physical)}
        sample.update(deepcopy(self.sample_overrides.get(physical["slot"], {})))
        return sample

    def physical_fact(self, physical):
        tag = self.physical_tags.get(physical["slot"], "OriginalAbsent")
        if tag == "PresentEmpty":
            proof = self._capture_closure(physical, tag)
            operation = proof["operation"]
            return {"tag": tag, "populated": 0, "read_before_us": operation["before_us"],
                    "read_after_us": operation["after_us"], "original_identity_before_ref": ref(proof["before_identity"]),
                    "original_identity_after_ref": ref(proof["after_identity"]), "direct_events_read_ref": ref(operation)}
        if tag == "OriginalAbsent":
            proof = self._capture_closure(physical, tag)
            operation = proof["operation"]
            return {"tag": tag, "populated": None,
                    "parent_original_identity_before_ref": ref(proof["before_identity"]),
                    "parent_original_identity_after_ref": ref(proof["after_identity"]),
                    "leaf_basename": operation["leaf_basename"], "openat_errno": operation["errno"],
                    "probe_ref": ref(operation)}
        fact = {"tag": "Unavailable", "populated": None, "reason": "OTHER_UNCERTAINTY",
                "observation_ref": ref("fixture-unavailable")}
        proof = {"tag": "Unavailable", "physical_binding_ref": ref(physical),
                 "reason": fact["reason"], "observation_ref": fact["observation_ref"]}
        proof.update(deepcopy(self.closure_overrides.get(physical["slot"], {})))
        self.closure_proofs[physical["slot"]] = proof
        return fact

    def probe_cleanup(self, physical, unit, receipts, reap_ref, deadline):
        self.probe_calls.append((unit["slot"], deadline))
        self.log.append(("observer.cleanup", unit["slot"], deadline))
        fact = self.physical_fact(physical)
        closure_ref = ref(self.closure_proofs[physical["slot"]])
        evidence = {"slot": unit["slot"], "original_unit_binding_ref": ref(unit),
                    "original_physical_binding_ref": ref(physical),
                    "start_settlement_ref": receipts["start_settlement_ref"],
                    "stop_settlement_ref": receipts["stop_settlement_ref"], "reap_ledger_ref": reap_ref,
                    "final_unit_observation_ref": receipts["final_unit_receipt_ref"], "observed_us": str(self.clock.now),
                    "lease_until_us": self.backend.manager["authority_lease_until_us"],
                    "physical": fact, "identity_brackets_ref": closure_ref,
                    "missing_evidence": []}
        evidence.update(deepcopy(self.evidence_overrides.get(unit["slot"], {})))
        return evidence


class FakeAuthenticator:
    fixture_only = True
    watchdog_generation = generation(200)

    def __call__(self, peer, body, candidate, payload, spec, deadline):
        if (not peer.fixture_only or not peer.kernel_authenticated
                or peer.generation["pid"] != candidate["main_pid"]
                or body["pid"] != peer.generation["pid"]
                or body["start_ticks"] != peer.generation["start_ticks"]
                or body["uid"] != peer.uid or body["gid"] != peer.gid
                or peer.uid != spec.load_uid or peer.gid != spec.load_gid
                or body["exe_sha256"] != payload["sha256"]
                or tuple(peer.credentials.get("groups", ())) != spec.load_groups
                or peer.credentials.get("no_new_privs") is not True
                or any(peer.credentials.get(k) != "0" for k in ("cap_eff", "cap_perm", "cap_inh", "cap_amb"))):
            raise WatchdogError("AUTHENTICATION")
        return deepcopy(peer.generation)


class Harness:
    def __init__(self, **overrides):
        self.spec, self.clock, self.log = make_spec(), Clock(), []
        self.backend = FakeBackend(self.spec, self.clock, self.log)
        self.distribution = FakeDistribution(self.spec, self.log)
        self.backend.distribution_payload = deepcopy(self.distribution.payload)
        self.observer = FakeObserver(self.spec, self.backend, self.clock, self.log)
        self.auth = FakeAuthenticator()
        self.alive = True
        self.results = []
        self.seq = {"coordinator": 0}
        dependencies = {"backend": self.backend, "distribution": self.distribution,
                        "observer": self.observer, "clock": self.clock,
                        "coordinator_generation": generation(100),
                        "coordinator_liveness": lambda: self.alive,
                        "keeper_authenticator": self.auth,
                        "listener_factory": lambda payload, deadline: self.log.append(("listener.ready", deadline)),
                        "result_sink": lambda body: self.results.append(json.loads(json.dumps(body)))}
        dependencies.update(overrides)
        self.watchdog = Watchdog(self.spec, **dependencies)

    def packet(self, sender, event, body, slot=None, *, seq=None):
        channel = "coordinator" if sender == "COORDINATOR" else "keeper:" + str(slot)
        if seq is None:
            self.seq[channel] = self.seq.get(channel, 0) + 1
            seq = self.seq[channel]
        return contracts.Envelope.from_mapping({"v": 3, "run": RUN, "sender": sender, "seq": seq,
                 "slot": slot, "event": event, "request": None, "mono_us": str(self.clock.now), "body": body})

    def arm(self):
        return self.watchdog.handle_packet(self.packet("COORDINATOR", "ARM", {
            "run_spec": self.spec.to_mapping(), "payload_expected_sha256": PAYLOAD_SHA}))

    def start(self, slot):
        return self.watchdog.handle_packet(self.packet("COORDINATOR", "RUN_SLOT", {
            "slot_spec_sha256": ref(self.spec.slots[slot])}, slot))

    def peer(self, slot, **overrides):
        data = {"generation": generation(300 + slot), "uid": 1001, "gid": 1001,
                "credentials": {"groups": [1001], "no_new_privs": True,
                                "cap_eff": "0", "cap_perm": "0", "cap_inh": "0", "cap_amb": "0"},
                "kernel_authenticated": True, "fixture_only": True}
        data.update(overrides)
        return PeerIdentity(**data)

    def hello(self, slot, *, peer=None, body_changes=None):
        peer = peer or self.peer(slot)
        body = {"pid": 300 + slot, "start_ticks": str((300 + slot) * 10),
                "exe_sha256": PAYLOAD_SHA, "uid": 1001, "gid": 1001, "groups": [1001],
                "no_new_privs": True, "cap_eff": "0", "cap_perm": "0", "cap_inh": "0", "cap_amb": "0"}
        body.update(body_changes or {})
        return self.watchdog.handle_packet(self.packet("KEEPER", "KEEPER_HELLO", body, slot), peer)

    def spawn(self, slot, child=None, parent_ref=None):
        child = child or generation(400 + slot)
        body = {"child_generation": child, "parent_generation_ref": parent_ref or ref(generation(300 + slot)),
                "role": "LOAD", "spawn_record_ref": ref({"fixture_spawn": child})}
        packet = self.packet("KEEPER", "SPAWNED", body, slot)
        return packet, self.watchdog.handle_packet(packet, self.peer(slot))

    def reap(self, slot, child=None, reaper=None):
        child, reaper = child or generation(400 + slot), reaper or generation(300 + slot)
        receipt = {"tag": "WAITPID_CONSUMED", "child_generation": child, "reaper_generation": reaper,
                   "before_us": str(self.clock.now), "after_us": str(self.clock.now),
                   "requested_pid": child["pid"], "returned_pid": child["pid"], "options": "WNOHANG",
                   "raw_wait_status": 0}
        return self.watchdog.handle_packet(self.packet("KEEPER", "REAPED", {"receipt": receipt}, slot), self.peer(slot))

    def checkpoint(self, slot, **changes):
        retained = self.watchdog.export_evidence()["slots"][slot]
        body = {"spawn_ledger_ref": ref({"spawns": sorted(ref(body) for body in retained["spawns"])}),
                "reap_ledger_ref": ref({"reaps": sorted(ref(body) for body in
                                  retained["reaps"] + retained["joins"])}),
                "keeper_generation_ref": ref(retained["keeper"])}
        body.update(changes)
        return self.watchdog.handle_packet(self.packet("KEEPER", "CHECKPOINT_READY", body, slot), self.peer(slot))

    def thread_created(self, slot, *, owner_ref=None, **changes):
        owner = owner_ref or ref(generation(300 + slot))
        creator = next((record["thread_ref"] for record in
            self.watchdog.export_evidence()["slots"][slot]["initial_threads"]
            if record["owner_process_generation_ref"] == owner), ref("unregistered-creator"))
        body = {"owner_process_generation_ref": owner,
                "thread_creation_record_ref": ref({"thread_creation": slot}),
                "thread_ref": ref({"thread": slot}), "creating_thread_ref": creator,
                "before_us": str(self.clock.now), "after_us": str(self.clock.now)}
        body.update(changes)
        packet = self.packet("KEEPER", "THREAD_CREATED", body, slot)
        return packet, self.watchdog.handle_packet(packet, self.peer(slot))

    def thread_joined(self, slot, **changes):
        receipt = {"tag": "PTHREAD_JOINED", "owner_process_generation_ref": ref(generation(300 + slot)),
                   "thread_creation_record_ref": ref({"thread_creation": slot}),
                   "joined_thread_ref": ref({"thread": slot}),
                   "joining_thread_ref": contracts.initial_thread_token(generation(300 + slot)),
                   "return_code": 0, "outcome": "RETURNED", "before_us": str(self.clock.now),
                   "after_us": str(self.clock.now)}
        receipt.update(changes)
        return self.watchdog.handle_packet(self.packet("KEEPER", "REAPED", {"receipt": receipt}, slot), self.peer(slot))

    def begin_cleanup(self):
        return self.watchdog.handle_packet(self.packet("COORDINATOR", "BEGIN_CLEANUP", {"reason": "NORMAL"}))

    def bound(self, slot=0):
        self.arm()
        self.start(slot)
        self.hello(slot)

    def measured_three(self):
        self.arm()
        for slot in range(3):
            self.start(slot)
            self.hello(slot)
            self.spawn(slot)
            self.reap(slot)
            self.checkpoint(slot)
            self.backend.cleanup_modes[slot] = {}

    def settle(self):
        self.begin_cleanup()
        self.watchdog.tick()
        self.watchdog.tick()
        return self.watchdog.snapshot()

    def final(self):
        self.clock.now = self.spec.cleanup_deadline_us
        self.watchdog.tick()
        return self.watchdog.snapshot()["final"]


class NativeSpawnFixture:
    """Exercise the native verifier with every kernel-facing operation patched."""

    def __init__(self, harness, variant=None):
        self.harness, self.variant = harness, variant
        self.stack = ExitStack()
        self.child, self.keeper = generation(400), generation(300)
        self.peer = harness.peer(0)
        self.native = watchdog_module.NativeKeeperAuthenticator.__new__(watchdog_module.NativeKeeperAuthenticator)
        self.native.registry = SimpleNamespace(children={}, verify_live=Mock())
        self.native.distribution = harness.distribution
        self.native.bindings = {ref(self.keeper): (self.peer, deepcopy(harness.distribution.payload), harness.spec)}
        self.credentials = {"uids": (1001,) * 4, "gids": (1001,) * 4, "groups": (1001,),
                            "no_new_privs": True, "cap_eff": 0, "cap_perm": 0, "cap_inh": 0, "cap_amb": 0}
        self.generation_reads, self.credential_reads = 0, 0
        self.parent_reads, self.executable_reads, self.membership_reads, self.pin_reads = 0, 0, 0, 0
        self.fd, self.closed = 77, Mock()
        self.opened, self.inheritable = Mock(return_value=self.fd), Mock()

    def __enter__(self):
        def child_generation(pid):
            if pid != 400:
                raise AssertionError("unexpected kernel generation lookup")
            self.generation_reads += 1
            if (self.variant == "generation-before"
                    or (self.variant == "generation-race" and self.generation_reads > 1)
                    or (self.variant == "generation-final" and self.generation_reads > 2)):
                return generation(400, 9999)
            return deepcopy(self.child)

        def child_credentials(pid):
            if pid != 400:
                raise AssertionError("unexpected kernel credential lookup")
            self.credential_reads += 1
            result = deepcopy(self.credentials)
            if self.variant == "caps" or (self.variant == "credentials-race" and self.credential_reads > 1):
                result["cap_eff"] = 1
            credentials_changes = {"uids": {"uids": (0,) * 4}, "gids": {"gids": (0,) * 4},
                "groups": {"groups": (1001, 999)}, "no-new-privs": {"no_new_privs": False},
                "cap-perm": {"cap_perm": 1}, "cap-inh": {"cap_inh": 1}, "cap-amb": {"cap_amb": 1}}
            result.update(credentials_changes.get(self.variant, {}))
            return result

        def child_parent(pid):
            if pid != 400:
                raise AssertionError("unexpected kernel parent lookup")
            self.parent_reads += 1
            return 999 if (self.variant == "ppid" or
                           (self.variant == "ppid-race" and self.parent_reads > 1)) else 300

        def read_fdinfo(path, *args):
            if path != "/proc/self/fdinfo/77":
                raise AssertionError("unexpected procfs read")
            if self.variant == "released-pin":
                return "Pid:\t-1\n"
            if self.variant == "duplicate-fdinfo":
                return "Pid:\t400\nPid:\t400\n"
            return "Pid:\t400\n"

        def executable(path, *args, **kwargs):
            if path != "/proc/400/exe":
                raise AssertionError("unexpected executable stat")
            self.executable_reads += 1
            return SimpleNamespace(st_mode=0o040755 if self.variant == "nonregular-executable" else 0o100755,
                                   st_dev=2, st_ino=999 if (self.variant == "executable" or
                                   (self.variant == "executable-race" and self.executable_reads > 1)) else 3)

        def membership(pid, group):
            if pid != 400 or group != self.harness.backend.bound_units[0]["control_group"]:
                raise AssertionError("unexpected membership target")
            self.membership_reads += 1
            if self.variant == "cgroup" or (self.variant == "cgroup-race" and self.membership_reads > 1):
                raise WatchdogError("IDENTITY_CHANGED")

        def pin_live(fd):
            if fd != 77:
                raise AssertionError("unexpected pidfd poll")
            self.pin_reads += 1
            return not (self.variant == "readable-pin" or
                        (self.variant == "pin-race" and self.pin_reads > 1))

        if self.variant == "keeper-pin":
            self.native.registry.verify_live.side_effect = WatchdogError("AUTHENTICATION")
        patches = ((watchdog_module, "_generation", child_generation),
                   (watchdog_module, "_parent_pid", child_parent),
                   (watchdog_module, "_credentials", child_credentials),
                   (watchdog_module, "_read_bounded", read_fdinfo),
                   (watchdog_module, "_verify_membership", membership),
                   (watchdog_module, "_pidfd_live", pin_live),
                   (watchdog_module.os, "pidfd_open", self.opened),
                   (watchdog_module.os, "set_inheritable", self.inheritable),
                   (watchdog_module.os, "stat", executable),
                   (watchdog_module.os, "close", self.closed),
                   (watchdog_module.time, "monotonic_ns", lambda: (self.harness.spec.work_deadline_us
                       if self.variant == "deadline" else self.harness.clock.now) * 1000))
        for target, name, value in patches:
            self.stack.enter_context(patch.object(target, name, value, create=True))
        return self

    def __exit__(self, exc_type, exc_value, traceback):
        return self.stack.__exit__(exc_type, exc_value, traceback)

    def verify(self):
        return self.native.verify_spawn(self.child, self.keeper,
            self.harness.backend.bound_units[0], self.harness.spec.work_deadline_us)


class WatchdogTests(unittest.TestCase):
    def assert_armed(self, harness):
        packets = harness.arm()
        self.assertIn("ARMED", [p.event for p in packets], harness.watchdog.snapshot())
        return packets

    def test_armed_is_emitted_only_after_observers_listener_and_payload_are_ready(self):
        h = Harness()
        packets = self.assert_armed(h)
        self.assertEqual(h.backend.start_calls, [])
        self.assertEqual([p.body["work_deadline_us"] for p in packets if p.event == "ARMED"], ["51000000"])
        names = [row[0] for row in h.log]
        for expected in ("backend.preflight", "distribution.prepare", "distribution.verify", "observer.preflight", "listener.ready"):
            self.assertIn(expected, names)

    def test_missing_dependencies_never_start_or_arm(self):
        for name in ("backend", "distribution", "observer", "coordinator_generation", "coordinator_liveness", "keeper_authenticator", "listener_factory"):
            with self.subTest(dependency=name):
                h = Harness(**{name: None})
                packets = h.arm()
                self.assertNotIn("ARMED", [p.event for p in packets])
                self.assertIn("DEPENDENCY_MISSING", h.watchdog.snapshot()["faults"])
                self.assertEqual(h.backend.start_calls, [])
                self.assertNotEqual(h.final()["status"], "COMPLETE")

    def test_unsubscribed_backend_cannot_arm(self):
        h = Harness()
        h.backend.ready = False
        self.assertNotIn("ARMED", [p.event for p in h.arm()])
        self.assertEqual(h.backend.start_calls, [])

    def test_start_without_arm_is_rejected_before_backend_mutation(self):
        h = Harness()
        h.start(0)
        self.assertEqual(h.backend.start_calls, [])
        self.assertEqual(h.watchdog.snapshot()["state"], "CLEANUP")

    def test_consumption_and_retained_record_precede_start_rpc(self):
        h = Harness()
        self.assert_armed(h)
        observed = []

        def during_start(slot):
            snapshot = h.watchdog.snapshot()
            observed.append(snapshot["slots"][slot]["start_consumed"])
            self.assertTrue(any(record["kind"] == "START_RESERVED" and record["slot"] == slot
                                for _, record in h.watchdog.records))

        h.backend.start_hook = during_start
        h.start(0)
        self.assertEqual(observed, [True])

    def test_three_consumed_slots_and_unknown_last_start_never_allow_fourth(self):
        h = Harness()
        self.assert_armed(h)
        h.start(0)
        h.start(1)
        h.backend.start_states[2] = "UNKNOWN"
        h.start(2)
        self.assertEqual([s["start_consumed"] for s in h.watchdog.snapshot()["slots"]], [True] * 3)
        h.start(0)
        h.start(1)
        h.start(2)
        self.assertEqual([slot for slot, _ in h.backend.start_calls], [0, 1, 2])
        self.assertEqual(len(h.watchdog.snapshot()["slots"]), 3)
        self.assertIn("START_SETTLEMENT", h.watchdog.snapshot()["missing_evidence"])

    def test_lost_start_reply_keeps_consumed_slot_and_absence_is_not_settlement(self):
        h = Harness()
        self.assert_armed(h)
        h.backend.start_errors.add(0)
        h.backend.candidate_missing.add(0)
        h.start(0)
        h.watchdog.tick()
        h.start(0)
        self.assertEqual(len(h.backend.start_calls), 1)
        self.assertTrue(h.watchdog.snapshot()["slots"][0]["start_consumed"])
        self.assertIsNone(h.watchdog.snapshot()["slots"][0]["certificate"])
        self.assertNotEqual(h.final()["status"], "COMPLETE")
        self.assertEqual(h.distribution.release_calls, [])

    def test_exact_start_margin_is_rejected_without_consuming_start(self):
        h = Harness()
        self.assert_armed(h)
        h.clock.now = h.spec.work_deadline_us - 5_500_000
        h.start(0)
        self.assertEqual(h.backend.start_calls, [])
        self.assertFalse(h.watchdog.snapshot()["slots"][0]["start_consumed"])

    def test_rpc_that_crosses_its_budget_retains_start_and_never_permits_load(self):
        h = Harness()
        self.assert_armed(h)
        h.backend.start_advance_us = 1_000_000
        h.start(0)
        self.assertTrue(h.watchdog.snapshot()["slots"][0]["start_consumed"])
        self.assertEqual(h.watchdog.snapshot()["state"], "CLEANUP")
        self.assertNotIn("LOAD_PERMIT", [p.event for p in h.watchdog.drain("keeper:0")])

    def test_kernel_peer_identity_overrides_spoofed_body(self):
        for peer_changes, body_changes in (({"generation": generation(999)}, {}), ({}, {"pid": 999}),
                                            ({"kernel_authenticated": False}, {})):
            with self.subTest(peer=peer_changes, body=body_changes):
                h = Harness()
                h.arm()
                h.start(0)
                packets = h.hello(0, peer=h.peer(0, **peer_changes), body_changes=body_changes)
                self.assertNotIn("LOAD_PERMIT", [p.event for p in packets])
                self.assertEqual(h.watchdog.snapshot()["state"], "CLEANUP")
                self.assertEqual(h.observer.bindings, {})

    def test_spawn_ack_matches_record_already_retained_in_watchdog(self):
        h = Harness()
        h.bound()
        packet, replies = h.spawn(0)
        ack = [p for p in replies if p.event == "ACK"]
        self.assertEqual(len(ack), 1)
        self.assertEqual(ack[0].request, packet.seq)
        records = {digest: record for digest, record in h.watchdog.records}
        retained = records[ack[0].body["ledger_record_sha256"]]
        self.assertEqual(retained["kind"], "SPAWNED")
        self.assertEqual(retained["facts"]["child_generation"], generation(400))
        self.assertEqual(h.watchdog.snapshot()["slots"][0]["spawn_count"], 1)

    def test_spawn_replay_and_foreign_parent_cannot_receive_a_load_ack(self):
        for foreign in (False, True):
            with self.subTest(foreign_parent=foreign):
                h = Harness()
                h.bound()
                if not foreign:
                    h.spawn(0)
                _, packets = h.spawn(0, parent_ref=ref(generation(999)) if foreign else None)
                self.assertNotIn("ACK", [p.event for p in packets])
                self.assertEqual(h.watchdog.snapshot()["state"], "CLEANUP")

    def test_load_ack_delivery_failure_enters_cleanup_and_forbids_more_spawns(self):
        h = Harness()
        h.bound()
        h.spawn(0)
        h.watchdog.delivery_failed("keeper:0")
        _, replies = h.spawn(0, generation(401))
        self.assertNotIn("ACK", [p.event for p in replies])
        self.assertEqual(h.watchdog.snapshot()["slots"][0]["spawn_count"], 1)

    def test_checkpoint_requires_genuine_reap_before_sampling(self):
        h = Harness()
        h.bound()
        h.spawn(0)
        h.checkpoint(0)
        self.assertEqual(h.observer.sample_calls, [])
        self.assertEqual(h.watchdog.snapshot()["slots"][0]["reap_count"], 0)
        self.assertNotEqual(h.final()["status"], "COMPLETE")

    def test_foreign_reaper_receipt_does_not_clear_spawn_obligation(self):
        h = Harness()
        h.bound()
        h.spawn(0)
        packets = h.reap(0, reaper=generation(999))
        self.assertNotIn("ACK", [p.event for p in packets])
        self.assertEqual(h.watchdog.snapshot()["slots"][0]["reap_count"], 0)
        self.assertEqual(h.observer.sample_calls, [])

    def test_genuine_reap_ack_precedes_checkpoint_sample(self):
        h = Harness()
        h.bound()
        h.spawn(0)
        self.assertIn("ACK", [p.event for p in h.reap(0)])
        h.checkpoint(0)
        self.assertEqual(h.watchdog.snapshot()["slots"][0]["reap_count"], 1)
        self.assertEqual(len(h.observer.sample_calls), 1)
        self.assertTrue(h.watchdog.snapshot()["slots"][0]["sampled"])

    def test_unknown_memory_cannot_become_a_sample(self):
        h = Harness()
        h.bound()
        h.spawn(0)
        h.reap(0)
        h.observer.sample_bytes = None
        h.checkpoint(0)
        self.assertFalse(h.watchdog.snapshot()["slots"][0]["sampled"])
        self.assertNotEqual(h.final()["status"], "COMPLETE")

    def test_cleanup_is_irreversible_and_stop_is_one_shot(self):
        h = Harness()
        h.bound()
        h.begin_cleanup()
        h.watchdog.tick()
        h.begin_cleanup()
        h.start(1)
        self.assertEqual([slot for slot, _ in h.backend.stop_calls], [0])
        self.assertEqual([slot for slot, _ in h.backend.start_calls], [0])
        self.assertEqual(h.watchdog.snapshot()["state"], "CLEANUP")

    def test_lost_stop_reply_is_not_retried_or_accepted_as_cleanup(self):
        h = Harness()
        h.bound()
        h.backend.stop_error = True
        h.begin_cleanup()
        h.watchdog.tick()
        self.assertEqual(len(h.backend.stop_calls), 1)
        self.assertTrue(h.watchdog.snapshot()["slots"][0]["stop_consumed"])
        self.assertIsNone(h.watchdog.snapshot()["slots"][0]["certificate"])
        self.assertNotEqual(h.final()["status"], "COMPLETE")

    def test_coordinator_death_cleans_without_ack_and_uses_original_deadlines(self):
        h = Harness()
        h.bound()
        h.clock.now = h.spec.t0_us + 10_000_000
        h.alive = False
        h.watchdog.tick()
        self.assertTrue(h.watchdog.snapshot()["coordinator_gone"])
        self.assertEqual(len(h.backend.stop_calls), 1)
        for packet in h.watchdog.drain("keeper:0"):
            if packet.event == "QUIESCE":
                self.assertEqual(packet.body["cleanup_deadline_us"], str(h.spec.cleanup_deadline_us))
        self.assertTrue(all(deadline <= h.spec.cleanup_deadline_us for _, deadline in h.backend.stop_calls))
        self.assertNotEqual(h.final()["status"], "COMPLETE")

    def test_coordinator_delivery_failure_never_waits_for_cleanup_ack(self):
        h = Harness()
        h.bound()
        h.watchdog.delivery_failed("coordinator")
        h.watchdog.tick()
        self.assertEqual(len(h.backend.stop_calls), 1)
        # A failed IPC delivery triggers cleanup; only a kernel liveness fact
        # establishes coordinator death.
        self.assertFalse(h.watchdog.snapshot()["coordinator_gone"])

    def test_work_cutoff_begins_cleanup_and_cleanup_cutoff_makes_no_new_rpc(self):
        h = Harness()
        h.bound()
        h.clock.now = h.spec.work_deadline_us
        h.watchdog.tick()
        self.assertEqual(h.watchdog.snapshot()["state"], "CLEANUP")
        self.assertEqual(len(h.backend.stop_calls), 1)
        h.clock.now = h.spec.cleanup_deadline_us
        count = len(h.log)
        h.watchdog.tick()
        self.assertEqual(len(h.log), count)
        self.assertEqual(h.watchdog.snapshot()["state"], "FINAL")
        self.assertNotEqual(h.watchdog.snapshot()["status"], "COMPLETE")
        self.assertFalse(h.watchdog.snapshot()["runtime_certificate"])

    def test_expired_authority_never_performs_cleanup_mutation(self):
        h = Harness()
        h.backend.manager["authority_lease_until_us"] = "11000000"
        h.bound()
        h.clock.now = 11_000_000
        h.watchdog.tick()
        self.assertEqual(h.backend.stop_calls, [])
        self.assertIn("AUTHORITY", h.watchdog.snapshot()["missing_evidence"])
        self.assertNotEqual(h.watchdog.snapshot()["status"], "COMPLETE")

    def test_original_absent_is_null_population_and_keeps_memory_reclamation_unknown(self):
        h = Harness()
        h.measured_three()
        snapshot = h.settle()
        self.assertEqual(snapshot["status"], "COMPLETE", snapshot)
        self.assertEqual([s["leaf_status"] for s in snapshot["slots"]], ["CLOSED_REMOVED"] * 3)
        self.assertFalse(snapshot["runtime_certificate"])
        self.assertEqual(snapshot["final"]["memory_reclamation"], "NOT_ESTABLISHED")
        evidence = [slot["cleanup_evidence"] for slot in h.watchdog.export_evidence()["slots"]]
        self.assertEqual(len(evidence), 3)
        self.assertTrue(all(e["physical"]["populated"] is None for e in evidence))
        self.assertTrue(all(e["physical"]["tag"] == "OriginalAbsent" for e in evidence))
        self.assertEqual(len(h.distribution.release_calls), 1)
        self.assertTrue(all(slot["leaf_status"] == "CLOSED_REMOVED"
                            for slot in h.distribution.release_calls[0][1]["slots"]))

    def test_present_empty_still_cannot_finish_required_leaf_removal(self):
        h = Harness()
        h.measured_three()
        h.observer.physical_tags[0] = "PresentEmpty"
        snapshot = h.settle()
        self.assertEqual(snapshot["slots"][0]["leaf_status"], "CLOSED_EMPTY", snapshot)
        self.assertNotEqual(snapshot["status"], "COMPLETE")
        self.assertFalse(snapshot["runtime_certificate"])

    def test_unavailable_physical_fact_cannot_produce_certificate(self):
        h = Harness()
        h.measured_three()
        h.observer.physical_tags[0] = "Unavailable"
        snapshot = h.settle()
        self.assertEqual(snapshot["slots"][0]["leaf_status"], "UNKNOWN")
        self.assertIsNone(snapshot["slots"][0]["certificate"])
        self.assertNotEqual(h.final()["status"], "COMPLETE")

    def test_typed_unavailable_with_missing_physical_observation_stays_incomplete_without_identity_fault(self):
        h = Harness()
        h.measured_three()
        h.observer.physical_tags[0] = "Unavailable"
        unavailable = h.observer.physical_fact(h.observer.bindings[0])
        h.observer.evidence_overrides[0] = {
            "missing_evidence": ["PHYSICAL_OBSERVATION"]}
        original_cleanup_proof = h.observer.cleanup_proof

        def proof_only_for_observed_physical_identity(evidence, physical, deadline):
            proof = original_cleanup_proof(evidence, physical, deadline)
            if physical["slot"] == 0:
                self.assertEqual(proof["tag"], "Unavailable")
                self.assertNotIn("operation", proof)
            return proof

        h.observer.cleanup_proof = proof_only_for_observed_physical_identity
        snapshot = h.settle()
        self.assertEqual(snapshot["slots"][0]["leaf_status"], "UNKNOWN")
        self.assertIsNone(snapshot["slots"][0]["certificate"])
        self.assertNotIn("IDENTITY_CHANGED", snapshot["faults"])
        evidence = h.watchdog.export_evidence()["slots"][0]
        self.assertEqual(evidence["closure_proof"]["tag"], "Unavailable")
        contracts.validate_cleanup_proof(evidence["closure_proof"], evidence["binding_proof"],
                                         evidence["cleanup_evidence"], evidence["physical"])
        self.assertEqual(evidence["cleanup_evidence"]["missing_evidence"], ["PHYSICAL_OBSERVATION"])
        self.assertEqual(evidence["cleanup_evidence"]["physical"], unavailable)
        self.assertIsNone(unavailable["populated"])
        self.assertFalse(any("identity" in field for field in unavailable))
        self.assertEqual(h.distribution.release_calls, [])
        final = h.final()
        self.assertEqual(final["status"], "INCOMPLETE")
        self.assertIn("PHYSICAL_OBSERVATION", final["missing_evidence"])
        self.assertNotIn("IDENTITY_CHANGED", h.watchdog.snapshot()["faults"])

    def test_absence_with_population_zero_is_invalid_and_never_certified(self):
        h = Harness()
        h.measured_three()
        physical = h.observer.physical_fact(h.observer.bindings[0])
        physical["populated"] = 0
        h.observer.evidence_overrides[0] = {"physical": physical}
        h.settle()
        self.assertIsNone(h.watchdog.snapshot()["slots"][0]["certificate"])
        self.assertNotEqual(h.final()["status"], "COMPLETE")

    def test_each_independent_cleanup_flag_is_required_even_with_physical_absence(self):
        for flag in ("activations_settled", "stop_settled", "terminal_no_pending_execution", "keeper_reaped"):
            with self.subTest(flag=flag):
                h = Harness()
                h.measured_three()
                h.backend.cleanup_modes[0][flag] = False
                h.settle()
                self.assertIsNone(h.watchdog.snapshot()["slots"][0]["certificate"])
                self.assertFalse(any(slot == 0 for slot, _ in h.observer.probe_calls))
                self.assertNotEqual(h.final()["status"], "COMPLETE")

    def test_each_independent_cleanup_record_is_required_despite_all_true_flags(self):
        for record in ("start_receipt", "stop_receipt", "final_unit_receipt", "keeper_reap_receipt"):
            with self.subTest(record=record):
                h = Harness()
                h.measured_three()
                h.backend.cleanup_modes[0][record] = None
                h.settle()
                self.assertIsNone(h.watchdog.snapshot()["slots"][0]["certificate"])
                self.assertNotEqual(h.final()["status"], "COMPLETE")

    def test_legacy_manager_reaped_boolean_is_not_a_main_release_receipt(self):
        h = Harness()
        h.measured_three()
        h.backend.cleanup_modes[0]["keeper_reap_receipt"] = {"reaped": True}
        h.settle()
        self.assertIsNone(h.watchdog.snapshot()["slots"][0]["certificate"])
        self.assertNotEqual(h.final()["status"], "COMPLETE")

    def test_main_release_for_foreign_generation_or_invocation_is_rejected(self):
        for altered in ("generation", "invocation"):
            with self.subTest(altered=altered):
                h = Harness()
                h.measured_three()
                receipt = h.backend.complete_receipts(0)["keeper_reap_receipt"]
                if altered == "generation":
                    receipt["systemd_main_exit"]["original_process_generation"] = generation(999)
                    receipt["systemd_main_exit"]["exec_main_pid"] = 999
                    receipt["pidfd_task_released"]["original_process_generation"] = generation(999)
                else:
                    receipt["systemd_main_exit"]["invocation_id"] = "f" * 32
                h.backend.cleanup_modes[0]["keeper_reap_receipt"] = receipt
                h.settle()
                self.assertIsNone(h.watchdog.snapshot()["slots"][0]["certificate"])
                self.assertNotEqual(h.final()["status"], "COMPLETE")

    def test_original_removed_with_unreaped_child_cannot_certify_cleanup(self):
        h = Harness()
        h.bound()
        h.spawn(0)
        h.backend.cleanup_modes[0] = {}
        h.settle()
        self.assertEqual(h.watchdog.snapshot()["slots"][0]["reap_count"], 0)
        self.assertIsNone(h.watchdog.snapshot()["slots"][0]["certificate"])
        self.assertFalse(any(slot == 0 for slot, _ in h.observer.probe_calls))
        self.assertNotEqual(h.final()["status"], "COMPLETE")

    def test_cleanup_evidence_cannot_replace_original_unit_or_physical_binding(self):
        for key in ("original_unit_binding_ref", "original_physical_binding_ref", "reap_ledger_ref"):
            with self.subTest(key=key):
                h = Harness()
                h.measured_three()
                h.observer.evidence_overrides[0] = {key: ref("foreign-binding")}
                h.settle()
                self.assertIsNone(h.watchdog.snapshot()["slots"][0]["certificate"])
                self.assertNotEqual(h.final()["status"], "COMPLETE")

    def test_expired_evidence_lease_is_not_accepted_as_cleanup(self):
        h = Harness()
        h.measured_three()
        h.observer.evidence_overrides[0] = {"lease_until_us": str(h.clock.now)}
        h.settle()
        self.assertIsNone(h.watchdog.snapshot()["slots"][0]["certificate"])
        self.assertNotEqual(h.final()["status"], "COMPLETE")

    def test_missing_final_sink_does_not_certify_complete_result(self):
        h = Harness(result_sink=None)
        h.measured_three()
        snapshot = h.settle()
        self.assertNotEqual(snapshot["status"], "COMPLETE")
        self.assertFalse(snapshot["runtime_certificate"])

    def test_final_sink_failure_does_not_certify_complete_result(self):
        def failed_sink(_receipt):
            raise OSError("fixture result retention failed")

        h = Harness(result_sink=failed_sink)
        h.measured_three()
        snapshot = h.settle()
        self.assertNotEqual(snapshot["status"], "COMPLETE")
        self.assertFalse(snapshot["runtime_certificate"])

    def test_replayed_coordinator_request_cannot_dispatch_another_start(self):
        h = Harness()
        self.assert_armed(h)
        packet = h.packet("COORDINATOR", "RUN_SLOT", {
            "slot_spec_sha256": ref(h.spec.slots[0])}, 0)
        h.watchdog.handle_packet(packet)
        h.watchdog.handle_packet(packet)
        self.assertEqual(len(h.backend.start_calls), 1)
        self.assertEqual(h.watchdog.snapshot()["state"], "CLEANUP")

    def test_start_for_one_slot_does_not_authenticate_another_keeper_channel(self):
        h = Harness()
        h.arm()
        h.start(0)
        packets = h.hello(1)
        self.assertNotIn("LOAD_PERMIT", [p.event for p in packets])
        self.assertEqual(h.observer.bindings, {})
        self.assertEqual([slot for slot, _ in h.backend.start_calls], [0])

    def test_wrong_keeper_channel_cannot_reap_an_original_child(self):
        h = Harness()
        h.arm()
        for slot in (0, 1):
            h.start(slot)
            h.hello(slot)
        h.spawn(0)
        # A well-formed genuine wait receipt from another channel cannot clear
        # the retained obligations of slot zero.
        packets = h.reap(1, child=generation(400), reaper=generation(301))
        self.assertNotIn("ACK", [p.event for p in packets])
        self.assertEqual(h.watchdog.snapshot()["slots"][0]["reap_count"], 0)

    def test_foreign_job_correlation_cannot_certify_cleanup(self):
        for altered in ("owner_unique_name", "unit_name", "job_id", "request_ref", "job_ref"):
            with self.subTest(altered=altered):
                h = Harness()
                h.measured_three()
                receipt = h.backend.complete_receipts(0)["stop_receipt"]
                if altered == "owner_unique_name":
                    receipt["event"][altered] = ":1.999"
                elif altered == "unit_name":
                    receipt["event"][altered] = h.spec.slots[1].unit_name
                elif altered == "job_id":
                    receipt["event"][altered] = 999
                else:
                    receipt[altered] = ref("foreign-correlation")
                h.backend.cleanup_modes[0]["stop_receipt"] = receipt
                h.settle()
                self.assertIsNone(h.watchdog.snapshot()["slots"][0]["certificate"])
                self.assertNotEqual(h.final()["status"], "COMPLETE")

    def test_nonterminal_or_foreign_final_unit_cannot_certify_cleanup(self):
        for altered in ("generation_ref", "manager", "invocation", "main_pid", "job", "state"):
            with self.subTest(altered=altered):
                h = Harness()
                h.measured_three()
                receipt = h.backend.complete_receipts(0)["final_unit_receipt"]
                if altered == "generation_ref":
                    receipt["original_unit_binding_ref"] = ref("foreign-unit")
                elif altered == "manager":
                    receipt["manager_binding_ref"] = ref("foreign-manager")
                elif altered == "invocation":
                    receipt["invocation_id"] = "f" * 32
                elif altered == "main_pid":
                    receipt["snapshot"]["service"]["MainPID"] = 300
                elif altered == "job":
                    receipt["snapshot"]["unit"]["Job"] = [99, "/org/freedesktop/systemd1/job/99"]
                else:
                    receipt["snapshot"]["unit"]["ActiveState"] = "active"
                h.backend.cleanup_modes[0]["final_unit_receipt"] = receipt
                h.settle()
                self.assertIsNone(h.watchdog.snapshot()["slots"][0]["certificate"])
                self.assertNotEqual(h.final()["status"], "COMPLETE")

    def test_ambiguous_start_later_bound_is_quiesced_without_load_or_retry(self):
        h = Harness()
        h.arm()
        h.backend.start_states[0] = "UNKNOWN"
        h.backend.candidate_missing.add(0)
        h.start(0)
        h.watchdog.tick()
        h.backend.candidate_missing.remove(0)
        packets = h.hello(0)
        self.assertNotIn("LOAD_PERMIT", [p.event for p in packets])
        self.assertIn("QUIESCE", [p.event for p in packets])
        self.assertEqual([slot for slot, _ in h.backend.start_calls], [0])
        self.assertEqual([slot for slot, _ in h.backend.stop_calls], [0])
        self.assertEqual(h.distribution.release_calls, [])
        self.assertNotEqual(h.final()["status"], "COMPLETE")

    def test_fourth_slot_packet_is_rejected_without_an_rpc(self):
        h = Harness()
        h.arm()
        packet = {"v": 3, "run": RUN, "sender": "COORDINATOR", "seq": 2,
                  "slot": 3, "event": "RUN_SLOT", "request": None, "mono_us": str(h.clock.now),
                  "body": {"slot_spec_sha256": ref("unreserved-fourth-slot")}}
        with self.assertRaises(contracts.ContractError):
            h.watchdog.handle_packet(packet)
        self.assertEqual(h.backend.start_calls, [])
        self.assertEqual(len(h.watchdog.snapshot()["slots"]), 3)

    def test_authority_expiry_during_start_does_not_extend_original_deadlines(self):
        h = Harness()
        h.backend.manager["authority_lease_until_us"] = str(h.clock.now + 500_000)
        self.assert_armed(h)
        h.backend.start_advance_us = 500_000
        h.start(0)
        self.assertEqual(h.backend.start_calls, [(0, 1_500_000)])
        self.assertTrue(h.watchdog.snapshot()["slots"][0]["start_consumed"])
        self.assertEqual(h.spec.work_deadline_us, 51_000_000)
        self.assertEqual(h.spec.cleanup_deadline_us, 61_000_000)
        self.assertNotEqual(h.watchdog.snapshot()["status"], "COMPLETE")
        self.assertEqual(h.backend.stop_calls, [])

    def test_missing_reap_validator_keeps_obligation_and_never_emits_ack(self):
        h = Harness()
        h.bound()
        h.spawn(0)
        child, reaper = generation(400), generation(300)
        receipt = {"tag": "WAITPID_CONSUMED", "child_generation": child, "reaper_generation": reaper,
                   "before_us": str(h.clock.now), "after_us": str(h.clock.now),
                   "requested_pid": 400, "returned_pid": 400, "options": "WNOHANG", "raw_wait_status": 0}
        packet = h.packet("KEEPER", "REAPED", {"receipt": receipt}, 0)
        with patch.object(contracts, "validate_reap_receipt", None):
            replies = h.watchdog.handle_packet(packet, h.peer(0))
        self.assertNotIn("ACK", [p.event for p in replies])
        self.assertEqual(h.watchdog.snapshot()["slots"][0]["reap_count"], 0)
        self.assertNotEqual(h.final()["status"], "COMPLETE")

    def test_missing_main_release_validator_cannot_certify_cleanup(self):
        h = Harness()
        h.measured_three()
        receipts = {slot: h.backend.complete_receipts(slot) for slot in range(3)}
        h.backend.cleanup_modes.clear()
        h.backend.receipts = receipts
        with patch.object(contracts, "validate_main_release_facts", None):
            h.settle()
        self.assertTrue(all(s["certificate"] is None for s in h.watchdog.snapshot()["slots"]))
        self.assertNotEqual(h.final()["status"], "COMPLETE")

    def test_kernel_credentials_cannot_be_replaced_by_unprivileged_body_claims(self):
        variants = ({"uid": 0}, {"gid": 999}, {"credentials": {"groups": [0]}},
                    {"credentials": {"groups": [1001], "no_new_privs": False}},
                    {"credentials": {"groups": [1001], "no_new_privs": True, "cap_eff": "1"}})
        for changes in variants:
            with self.subTest(changes=changes):
                h = Harness()
                h.arm()
                h.start(0)
                replies = h.hello(0, peer=h.peer(0, **changes))
                self.assertNotIn("LOAD_PERMIT", [p.event for p in replies])
                self.assertEqual(h.observer.bindings, {})
                self.assertEqual(h.watchdog.snapshot()["state"], "CLEANUP")

    def test_unit_bindings_must_match_original_manager_and_authenticated_keeper(self):
        for key in ("manager_binding_ref", "keeper_generation_ref"):
            with self.subTest(key=key):
                h = Harness()
                h.arm()
                h.start(0)
                h.backend.unit_overrides[0] = {key: ref("foreign-original")}
                replies = h.hello(0)
                self.assertNotIn("LOAD_PERMIT", [p.event for p in replies])
                self.assertNotEqual(h.final()["status"], "COMPLETE")

    def test_physical_binding_must_match_original_run_manager_unit_and_namespace(self):
        variants = ({"run": "f" * 32}, {"boot_id": "22222222-3333-4444-5555-666666666666"},
                    {"manager_owner": ":1.999"}, {"bus_guid": "f" * 32},
                    {"invocation_id": "f" * 32}, {"control_group_id": "999"},
                    {"mount_namespace_ref": "mnt:[foreign]"},
                    {"control_group": "/system.slice/foreign.service", "leaf_basename": "foreign.service"})
        for changes in variants:
            with self.subTest(changes=changes):
                h = Harness()
                h.arm()
                h.start(0)
                h.observer.binding_overrides[0] = changes
                replies = h.hello(0)
                self.assertNotIn("LOAD_PERMIT", [p.event for p in replies])
                self.assertNotEqual(h.final()["status"], "COMPLETE")

    def test_present_empty_is_reobserved_until_original_removal_without_second_stop(self):
        h = Harness()
        h.measured_three()
        h.observer.physical_tags[0] = "PresentEmpty"
        first = h.settle()
        self.assertNotEqual(first["state"], "FINAL")
        self.assertEqual(first["slots"][0]["leaf_status"], "CLOSED_EMPTY")
        probes = sum(slot == 0 for slot, _ in h.observer.probe_calls)
        h.observer.physical_tags[0] = "OriginalAbsent"
        h.watchdog.tick()
        final = h.watchdog.snapshot()
        self.assertGreater(sum(slot == 0 for slot, _ in h.observer.probe_calls), probes)
        self.assertEqual(final["slots"][0]["leaf_status"], "CLOSED_REMOVED")
        self.assertEqual(final["status"], "COMPLETE", final)
        self.assertEqual([slot for slot, _ in h.backend.stop_calls].count(0), 1)

    def test_recorded_live_thread_blocks_checkpoint_without_an_actual_join(self):
        h = Harness()
        h.bound()
        _, ack = h.thread_created(0)
        self.assertIn("ACK", [p.event for p in ack])
        h.checkpoint(0)
        self.assertEqual(h.observer.sample_calls, [])
        self.assertFalse(h.watchdog.snapshot()["slots"][0]["sampled"])
        self.assertNotEqual(h.final()["status"], "COMPLETE")

    def test_original_absent_with_unreaped_child_thread_cannot_certify_cleanup(self):
        h = Harness()
        h.bound()
        h.spawn(0)
        h.thread_created(0, owner_ref=ref(generation(400)))
        h.backend.cleanup_modes[0] = {}
        h.settle()
        self.assertIsNone(h.watchdog.snapshot()["slots"][0]["certificate"])
        self.assertFalse(any(slot == 0 for slot, _ in h.observer.probe_calls))
        self.assertNotEqual(h.final()["status"], "COMPLETE")

    def test_authentic_main_release_covers_keeper_thread_only_during_cleanup(self):
        h = Harness()
        h.bound()
        h.thread_created(0)
        h.backend.cleanup_modes[0] = {}
        h.settle()
        snapshot = h.watchdog.snapshot()["slots"][0]
        self.assertEqual(snapshot["leaf_status"], "CLOSED_REMOVED")
        self.assertIsNotNone(snapshot["certificate"])
        self.assertFalse(snapshot["sampled"])
        self.assertEqual(h.watchdog.export_evidence()["slots"][0]["joins"], [])
        self.assertNotEqual(h.final()["status"], "COMPLETE")

    def test_genuine_recorded_thread_join_allows_checkpoint_sample(self):
        h = Harness()
        h.bound()
        h.thread_created(0)
        self.assertIn("ACK", [p.event for p in h.thread_joined(0)])
        h.checkpoint(0)
        self.assertEqual(len(h.observer.sample_calls), 1)
        evidence = h.watchdog.export_evidence()["slots"][0]
        self.assertEqual(len(evidence["threads"]), 1)
        self.assertEqual(len(evidence["joins"]), 1)

    def test_unrecorded_or_foreign_thread_join_does_not_receive_ack(self):
        variants = (None, {"owner_process_generation_ref": ref(generation(999))},
                    {"thread_creation_record_ref": ref("foreign-create")},
                    {"joined_thread_ref": ref("foreign-thread")})
        for changes in variants:
            with self.subTest(changes=changes):
                h = Harness()
                h.bound()
                if changes is not None:
                    h.thread_created(0)
                replies = h.thread_joined(0, **(changes or {}))
                self.assertNotIn("ACK", [p.event for p in replies])
                self.assertEqual(h.observer.sample_calls, [])
                self.assertEqual(h.watchdog.export_evidence()["slots"][0]["joins"], [])

    def test_checkpoint_claims_must_match_each_exact_retained_ledger_before_read(self):
        for claim in ("spawn_ledger_ref", "reap_ledger_ref", "keeper_generation_ref"):
            with self.subTest(claim=claim):
                h = Harness()
                h.bound()
                h.spawn(0)
                h.reap(0)
                replies = h.checkpoint(0, **{claim: ref("foreign-checkpoint")})
                self.assertNotIn("ACK", [p.event for p in replies])
                self.assertEqual(h.observer.sample_calls, [])
                self.assertFalse(h.watchdog.snapshot()["slots"][0]["sampled"])

    def test_work_deadline_rejects_spawn_thread_and_checkpoint_without_ack_or_read(self):
        for event in ("SPAWNED", "THREAD_CREATED", "CHECKPOINT_READY"):
            with self.subTest(event=event):
                h = Harness()
                h.bound()
                if event == "CHECKPOINT_READY":
                    h.spawn(0)
                    h.reap(0)
                h.clock.now = h.spec.work_deadline_us
                if event == "SPAWNED":
                    _, replies = h.spawn(0)
                elif event == "THREAD_CREATED":
                    _, replies = h.thread_created(0)
                else:
                    replies = h.checkpoint(0)
                self.assertNotIn("ACK", [p.event for p in replies])
                self.assertEqual(h.observer.sample_calls, [])
                self.assertEqual(h.watchdog.snapshot()["state"], "CLEANUP")
                self.assertEqual(h.watchdog.export_evidence()["slots"][0]["threads"], [])

    def test_sample_identity_brackets_and_retained_refs_must_match_physical_original(self):
        for claim in ("unit_binding_ref", "physical_binding_ref", "keeper_generation_ref",
                      "identity_before_ref", "identity_after_ref", "ledger_checkpoint_ref"):
            with self.subTest(claim=claim):
                h = Harness()
                h.bound()
                h.observer.sample_overrides[0] = {claim: ref("foreign-sample")}
                replies = h.checkpoint(0)
                self.assertNotIn("ACK", [p.event for p in replies])
                self.assertFalse(h.watchdog.snapshot()["slots"][0]["sampled"])
                self.assertIsNone(h.watchdog.export_evidence()["slots"][0]["sample"])

    def test_sample_time_must_be_inside_original_clock_interval(self):
        for times in (("999999", "1000000"), ("1000001", "1000001"), ("1000000", "999999")):
            with self.subTest(times=times):
                h = Harness()
                h.bound()
                h.observer.sample_overrides[0] = dict(zip(("before_us", "after_us"), times))
                h.checkpoint(0)
                self.assertFalse(h.watchdog.snapshot()["slots"][0]["sampled"])

    def test_payload_release_failure_or_budget_overrun_never_reports_complete(self):
        for mode in ("failure", "budget"):
            with self.subTest(mode=mode):
                h = Harness()
                h.measured_three()
                if mode == "failure":
                    h.distribution.release_error = True
                else:
                    h.distribution.release_hook = lambda: setattr(h.clock, "now", h.spec.cleanup_deadline_us)
                snapshot = h.settle()
                self.assertEqual(len(h.distribution.release_calls), 1)
                self.assertNotEqual(snapshot["status"], "COMPLETE")
                self.assertFalse(snapshot["runtime_certificate"])
                self.assertTrue(all(s["leaf_status"] == "CLOSED_REMOVED" for s in snapshot["slots"]))
                self.assertFalse(h.watchdog.payload_released)
                self.assertNotEqual(h.final()["status"], "COMPLETE")
                self.assertEqual(len(h.distribution.release_calls), 1)

    def test_result_sink_crossing_original_cleanup_deadline_downgrades_final(self):
        h = Harness()
        writes = []

        def slow_sink(evidence):
            writes.append(deepcopy(evidence))
            h.clock.now = h.spec.cleanup_deadline_us

        h.watchdog.result_sink = slow_sink
        h.measured_three()
        snapshot = h.settle()
        self.assertEqual(len(writes), 1)
        self.assertNotEqual(snapshot["status"], "COMPLETE")
        self.assertIn("DEADLINE", snapshot["final"]["missing_evidence"])
        self.assertFalse(snapshot["runtime_certificate"])

    def test_native_child_pin_is_retained_before_spawn_record_and_ack(self):
        h = Harness()
        h.bound()
        with NativeSpawnFixture(h) as native:
            h.auth.verify_spawn = native.native.verify_spawn
            original_append = h.watchdog._append
            pins_at_record = []

            def append(kind, slot, body):
                if kind == "SPAWNED":
                    pins_at_record.append(deepcopy(native.native.registry.children))
                return original_append(kind, slot, body)

            with patch.object(h.watchdog, "_append", side_effect=append):
                _, replies = h.spawn(0)
            self.assertIn("ACK", [p.event for p in replies])
            self.assertEqual(pins_at_record, [{ref(generation(400)): (77, generation(400))}])
            native.opened.assert_called_once_with(400, 0)
            native.inheritable.assert_called_once_with(77, False)
            native.closed.assert_not_called()
            self.assertEqual(native.native.registry.verify_live.call_count, 2)

    def test_native_spawn_identity_failures_never_retain_child_and_close_acquired_pin(self):
        variants = ("ppid", "ppid-race", "generation-before", "generation-race", "generation-final",
                    "executable", "executable-race", "nonregular-executable", "cgroup", "cgroup-race",
                    "caps", "cap-perm", "cap-inh", "cap-amb", "uids", "gids", "groups", "no-new-privs",
                    "credentials-race", "released-pin", "readable-pin", "pin-race", "duplicate-fdinfo",
                    "keeper-pin", "deadline")
        for variant in variants:
            with self.subTest(variant=variant):
                h = Harness()
                h.bound()
                with NativeSpawnFixture(h, variant) as native:
                    with self.assertRaises(WatchdogError):
                        native.verify()
                    self.assertEqual(native.native.registry.children, {})
                    if variant in ("ppid", "generation-before", "keeper-pin"):
                        native.opened.assert_not_called()
                        native.closed.assert_not_called()
                    else:
                        native.opened.assert_called_once_with(400, 0)
                        native.closed.assert_called_once_with(77)

    def test_native_spawn_failure_blocks_retained_spawn_record_and_load_ack(self):
        h = Harness()
        h.bound()
        with NativeSpawnFixture(h, "cgroup") as native:
            h.auth.verify_spawn = native.native.verify_spawn
            _, replies = h.spawn(0)
            self.assertNotIn("ACK", [p.event for p in replies])
            self.assertEqual(h.watchdog.export_evidence()["slots"][0]["spawns"], [])
            self.assertEqual(native.native.registry.children, {})
            native.closed.assert_called_once_with(77)
            self.assertEqual(h.watchdog.snapshot()["state"], "CLEANUP")

    def test_native_child_binding_duplicate_global_bound_and_foreign_namespace_abort_before_open(self):
        for variant in ("binding", "unit-keeper", "duplicate", "global-bound", "boot", "pidns", "mntns"):
            with self.subTest(variant=variant):
                h = Harness()
                h.bound()
                with NativeSpawnFixture(h) as native:
                    unit = deepcopy(h.backend.bound_units[0])
                    if variant == "binding":
                        native.native.bindings.clear()
                    elif variant == "unit-keeper":
                        unit["keeper_generation_ref"] = ref("foreign-keeper")
                    elif variant == "duplicate":
                        native.native.registry.children[ref(native.child)] = (76, deepcopy(native.child))
                    elif variant == "global-bound":
                        native.native.registry.children = {str(i): (i, generation(500 + i)) for i in range(21)}
                    else:
                        key = {"boot": "boot_id", "pidns": "pid_namespace_ref", "mntns": "mount_namespace_ref"}[variant]
                        native.child[key] = ("22222222-3333-4444-5555-666666666666" if variant == "boot"
                                             else "foreign:[fixture]")
                    original = deepcopy(native.native.registry.children)
                    with self.assertRaises(WatchdogError):
                        native.native.verify_spawn(native.child, native.keeper, unit, h.spec.work_deadline_us)
                    self.assertEqual(native.native.registry.children, original)
                    native.opened.assert_not_called()
                    native.closed.assert_not_called()

    def test_eighth_spawn_is_never_acknowledged_or_added_to_seven_child_ledger(self):
        h = Harness()
        h.bound()
        for pid in range(400, 407):
            _, replies = h.spawn(0, generation(pid))
            self.assertIn("ACK", [p.event for p in replies])
        _, replies = h.spawn(0, generation(407))
        self.assertNotIn("ACK", [p.event for p in replies])
        self.assertEqual(h.watchdog.snapshot()["slots"][0]["spawn_count"], 7)
        self.assertEqual(h.watchdog.snapshot()["state"], "CLEANUP")

    def test_consumed_child_wait_covers_its_recorded_group_thread_for_checkpoint(self):
        h = Harness()
        h.bound()
        h.spawn(0)
        h.thread_created(0, owner_ref=ref(generation(400)))
        h.reap(0)
        replies = h.checkpoint(0)
        self.assertIn("ACK", [p.event for p in replies])
        self.assertTrue(h.watchdog.snapshot()["slots"][0]["sampled"])
        self.assertEqual(h.watchdog.export_evidence()["slots"][0]["joins"], [])

    def test_missing_physical_proof_methods_or_validators_fail_before_start(self):
        for boundary in ("binding_proof", "cleanup_proof", "validate_binding_proof", "validate_closure_proof",
                         "validate_cleanup_proof"):
            with self.subTest(boundary=boundary):
                h = Harness()
                target = contracts if boundary.startswith("validate_") else h.observer
                with patch.object(target, boundary, None):
                    packets = h.arm()
                    self.assertNotIn("ARMED", [p.event for p in packets])
                    self.assertIn("DEPENDENCY_MISSING", h.watchdog.snapshot()["faults"])
                    self.assertEqual(h.backend.start_calls, [])

    def test_binding_proof_identity_and_original_capture_are_required_before_load(self):
        for field in ("physical_binding_ref", "leaf-inode", "parent-path", "parent-mount", "before-time", "after-time"):
            with self.subTest(field=field):
                h = Harness()
                h.arm()
                h.start(0)

                def tampered_binding(physical, deadline):
                    proof = deepcopy(h.observer.binding_proofs[physical["slot"]])
                    if field == "physical_binding_ref":
                        proof[field] = ref("foreign-physical")
                    elif field == "leaf-inode":
                        proof["original_leaf_identity"]["inode"] = "88888"
                    elif field == "parent-path":
                        proof["original_parent_identity"]["cgroup_path"] = "/foreign"
                    elif field == "parent-mount":
                        proof["original_parent_identity"]["mount_id"] = "999"
                    elif field == "before-time":
                        proof["before_us"] = str(h.spec.t0_us - 1)
                    else:
                        proof["after_us"] = str(h.clock.now + 1)
                    return proof

                h.observer.binding_proof = tampered_binding
                replies = h.hello(0)
                self.assertNotIn("LOAD_PERMIT", [p.event for p in replies])
                self.assertIsNone(h.watchdog.export_evidence()["slots"][0]["binding_proof"])
                # An authenticated invocation survives this failed read, so the
                # one authorized Stop is still attempted during cleanup.
                self.assertEqual([slot for slot, _ in h.backend.stop_calls], [0])
                self.assertNotEqual(h.final()["status"], "COMPLETE")

    def test_full_directory_preimages_are_retained_and_referenced_by_certificate(self):
        h = Harness()
        h.measured_three()
        h.settle()
        export = h.watchdog.export_evidence()
        records = {item["ref"]: item["record"] for item in export["ledger_records"]}
        for slot in export["slots"]:
            binding, closure = slot["binding_proof"], slot["closure_proof"]
            self.assertEqual(binding["original_parent_identity"], closure["original_identity"])
            self.assertEqual(slot["cleanup_evidence"]["identity_brackets_ref"], ref(closure))
            self.assertEqual(slot["cleanup_evidence"]["physical"]["parent_original_identity_before_ref"],
                             ref(binding["original_parent_identity"]))
            self.assertNotEqual(ref(binding["original_parent_identity"]), ref(slot["physical"]["parent_ref"]))
            facts = records[slot["certificate"]]["facts"]
            self.assertEqual(facts["binding_proof_ref"], ref(binding))
            self.assertEqual(facts["closure_proof_ref"], ref(closure))

    def test_coherent_adoption_of_foreign_full_identity_cannot_certify_original(self):
        for tag in ("OriginalAbsent", "PresentEmpty"):
            for field in ("inode", "mount_id", "cgroup_path"):
                with self.subTest(tag=tag, field=field):
                    h = Harness()
                    h.measured_three()
                    h.observer.physical_tags[0] = tag
                    original = h.observer._capture_closure(h.observer.bindings[0], tag)
                    adopted = deepcopy(original["original_identity"])
                    adopted[field] = "/foreign" if field == "cgroup_path" else "999999"
                    operation = deepcopy(original["operation"])
                    operation["parent_identity_ref" if tag == "OriginalAbsent" else "leaf_identity_ref"] = ref(adopted)
                    h.observer.closure_overrides[0] = {"original_identity": adopted,
                        "before_identity": deepcopy(adopted), "after_identity": deepcopy(adopted), "operation": operation}
                    h.settle()
                    self.assertIsNone(h.watchdog.snapshot()["slots"][0]["certificate"])
                    self.assertEqual(h.watchdog.snapshot()["slots"][0]["leaf_status"], "UNKNOWN")
                    self.assertNotEqual(h.final()["status"], "COMPLETE")
                    self.assertEqual(h.distribution.release_calls, [])

    def test_original_closure_operation_identity_time_and_leaf_are_checked(self):
        for field in ("before_identity", "after_identity", "physical_binding_ref", "operation-identity",
                      "operation-leaf", "operation-before", "operation-after"):
            with self.subTest(field=field):
                h = Harness()
                h.measured_three()
                original = h.observer._capture_closure(h.observer.bindings[0], "OriginalAbsent")
                if field in ("before_identity", "after_identity"):
                    identity = deepcopy(original[field])
                    identity["inode"] = "999999"
                    changes = {field: identity}
                elif field == "physical_binding_ref":
                    changes = {field: ref("foreign-physical")}
                else:
                    operation = deepcopy(original["operation"])
                    if field == "operation-identity":
                        operation["parent_identity_ref"] = ref("foreign-parent")
                    elif field == "operation-leaf":
                        operation["leaf_basename"] = "foreign.service"
                    elif field == "operation-before":
                        operation["before_us"] = str(h.spec.t0_us - 1)
                    else:
                        operation["after_us"] = str(h.clock.now + 1)
                    changes = {"operation": operation}
                h.observer.closure_overrides[0] = changes
                h.settle()
                self.assertIsNone(h.watchdog.snapshot()["slots"][0]["certificate"])
                self.assertEqual(h.watchdog.snapshot()["slots"][0]["leaf_status"], "UNKNOWN")
                self.assertNotEqual(h.final()["status"], "COMPLETE")

    def test_evidence_cannot_use_label_digest_or_replace_closure_digest(self):
        for field in ("parent_original_identity_before_ref", "identity_brackets_ref", "probe_ref"):
            with self.subTest(field=field):
                h = Harness()
                h.measured_three()
                if field == "identity_brackets_ref":
                    h.observer.evidence_overrides[0] = {field: ref("unrelated-closure")}
                else:
                    physical = h.observer.physical_fact(h.observer.bindings[0])
                    physical[field] = ref(h.observer.bindings[0]["parent_ref"])
                    h.observer.evidence_overrides[0] = {"physical": physical}
                h.settle()
                self.assertIsNone(h.watchdog.snapshot()["slots"][0]["certificate"])
                self.assertEqual(h.watchdog.snapshot()["slots"][0]["leaf_status"], "UNKNOWN")
                self.assertNotEqual(h.final()["status"], "COMPLETE")

    def test_initial_threads_are_derived_from_full_authenticated_hello_and_spawn(self):
        h = Harness()
        h.bound()
        packet, _ = h.spawn(0)
        initial = h.watchdog.export_evidence()["slots"][0]["initial_threads"]
        self.assertEqual(len(initial), 2)
        for record in initial:
            owner = generation(300 if record["event"] == "KEEPER_HELLO" else 400)
            self.assertEqual(record["thread_ref"], contracts.initial_thread_token(owner))
            self.assertEqual(record["owner_process_generation_ref"], ref(owner))
            self.assertEqual(record["thread_creation_record_ref"],
                             contracts.initial_thread_creation_ref(record["event"], record["body"]))
        spawned = next(record for record in initial if record["event"] == "SPAWNED")
        self.assertEqual(spawned["body"], dict(packet.body))

    def test_unregistered_or_foreign_group_creator_cannot_register_thread(self):
        for token in (ref("unregistered-thread"), contracts.initial_thread_token(generation(400))):
            with self.subTest(token=token):
                h = Harness()
                h.bound()
                h.spawn(0)
                _, replies = h.thread_created(0, creating_thread_ref=token)
                self.assertNotIn("ACK", [p.event for p in replies])
                self.assertEqual(h.watchdog.export_evidence()["slots"][0]["threads"], [])

    def test_unregistered_or_foreign_group_joiner_cannot_clear_registered_thread(self):
        for token in (ref("unregistered-thread"), contracts.initial_thread_token(generation(400))):
            with self.subTest(token=token):
                h = Harness()
                h.bound()
                h.spawn(0)
                h.thread_created(0)
                replies = h.thread_joined(0, joining_thread_ref=token)
                self.assertNotIn("ACK", [p.event for p in replies])
                self.assertEqual(h.watchdog.export_evidence()["slots"][0]["joins"], [])

    def test_repeated_empty_polling_keeps_bounded_ledger_and_original_sixty_second_deadline(self):
        h = Harness()
        h.measured_three()
        h.observer.physical_tags[0] = "PresentEmpty"
        h.settle()
        retained_count = h.watchdog.snapshot()["ledger_count"]
        for _ in range(513):
            h.clock.now += 50_000
            h.watchdog.tick()
        snapshot = h.watchdog.snapshot()
        self.assertEqual(snapshot["state"], "CLEANUP")
        self.assertEqual(snapshot["ledger_count"], retained_count)
        self.assertEqual(snapshot["slots"][0]["leaf_status"], "CLOSED_EMPTY")
        self.assertIsNone(snapshot["slots"][0]["certificate"])
        self.assertEqual(h.distribution.release_calls, [])
        self.assertGreater(sum(slot == 0 for slot, _ in h.observer.probe_calls), 512)
        self.assertEqual([slot for slot, _ in h.backend.stop_calls].count(0), 1)
        evidence = h.watchdog.export_evidence()["slots"][0]
        self.assertEqual(evidence["cleanup_evidence"]["observed_us"], str(h.clock.now))
        self.assertIsNotNone(evidence["binding_proof"])
        self.assertIsNotNone(evidence["closure_proof"])
        h.clock.now = h.spec.cleanup_deadline_us - 1
        h.watchdog.tick()
        self.assertEqual(h.watchdog.snapshot()["state"], "CLEANUP")
        call_count = len(h.log)
        h.clock.now += 1
        h.watchdog.tick()
        self.assertEqual(len(h.log), call_count)
        self.assertEqual(h.watchdog.snapshot()["state"], "FINAL")
        self.assertNotEqual(h.watchdog.snapshot()["status"], "COMPLETE")
        self.assertIn("PHYSICAL_OBSERVATION", h.watchdog.snapshot()["final"]["missing_evidence"])

    def test_second_checkpoint_cannot_take_second_sample_or_append_second_memory_record(self):
        h = Harness()
        h.bound()
        h.checkpoint(0)
        first = deepcopy(h.watchdog.export_evidence()["slots"][0]["sample"])
        h.clock.now += 50_000
        replies = h.checkpoint(0)
        self.assertNotIn("ACK", [p.event for p in replies])
        self.assertEqual(len(h.observer.sample_calls), 1)
        self.assertEqual(h.watchdog.export_evidence()["slots"][0]["sample"], first)
        records = [r for _, r in h.watchdog.records if r["kind"] == "MEMORY_SAMPLE"]
        self.assertEqual(len(records), 1)
        self.assertEqual(h.watchdog.snapshot()["state"], "CLEANUP")

    def test_identical_job_replay_is_deduplicated_and_conflict_is_rejected(self):
        h = Harness()
        h.bound()
        event = deepcopy(h.backend.retained_job_events[(0, "start")])
        count = sum(record["kind"] == "JOB_EVENT" for _, record in h.watchdog.records)
        h.backend.events = [deepcopy(event)] * 6
        h.watchdog.tick()
        self.assertEqual(sum(record["kind"] == "JOB_EVENT" for _, record in h.watchdog.records), count)
        event["result"] = "failed"
        h.backend.events = [event]
        h.watchdog.tick()
        self.assertIn("IDENTITY_CHANGED", h.watchdog.snapshot()["faults"])
        self.assertEqual(sum(record["kind"] == "JOB_EVENT" for _, record in h.watchdog.records), count)
        self.assertEqual(h.watchdog.snapshot()["state"], "CLEANUP")

    def test_job_batch_and_global_ledger_are_bounded_by_six(self):
        for mode in ("batch", "global"):
            with self.subTest(mode=mode):
                h = Harness()
                h.bound()

                def extra_job(job_id):
                    event = deepcopy(h.backend.retained_job_events[(0, "start")])
                    event.update({"job_id": job_id, "job_path": "/org/freedesktop/systemd1/job/" + str(job_id)})
                    return event

                if mode == "batch":
                    expected = 1
                    h.backend.events = [extra_job(i) for i in range(30, 37)]
                else:
                    h.backend.events = [extra_job(i) for i in range(30, 35)]
                    h.watchdog.tick()
                    expected = 6
                    h.backend.events = [extra_job(35)]
                h.watchdog.tick()
                self.assertEqual(sum(record["kind"] == "JOB_EVENT" for _, record in h.watchdog.records), expected)
                self.assertEqual(h.watchdog.snapshot()["state"], "CLEANUP")
                self.assertTrue(set(h.watchdog.snapshot()["faults"]) & {"PROTOCOL", "IDENTITY_CHANGED"})

    def test_three_reserved_unit_names_with_no_start_release_payload_but_leave_metrics_incomplete(self):
        h = Harness()
        h.arm()
        snapshot = h.settle()
        self.assertEqual(len(h.spec.slots), 3)
        self.assertEqual(h.backend.start_calls, [])
        self.assertEqual(h.backend.stop_calls, [])
        self.assertEqual(h.backend.cleanup_transitions, 1)
        self.assertTrue(h.watchdog.payload_released)
        self.assertEqual(len(h.distribution.release_calls), 1)
        self.assertEqual(snapshot["state"], "FINAL")
        self.assertEqual(snapshot["status"], "INCOMPLETE")
        self.assertIn("MEMORY_SAMPLE", snapshot["final"]["missing_evidence"])
        self.assertTrue(all(not slot["sampled"] for slot in snapshot["slots"]))
        self.assertTrue(all(slot["certificate"] is None for slot in snapshot["slots"]))
        self.assertFalse(snapshot["runtime_certificate"])

    def test_reservation_aborted_before_start_rpc_can_release_without_marking_memory_complete(self):
        h = Harness()
        h.arm()

        def abort_before_rpc(slot):
            raise WatchdogError("TRANSPORT_UNKNOWN")

        h.backend.reserve_hook = abort_before_rpc
        h.start(0)
        h.watchdog.tick()
        snapshot = h.watchdog.snapshot()
        self.assertIn(0, h.backend.reserved)
        self.assertTrue(snapshot["slots"][0]["start_consumed"])
        self.assertEqual(h.backend.start_calls, [])
        self.assertEqual(h.backend.stop_calls, [])
        self.assertTrue(h.watchdog.payload_released)
        self.assertEqual(len(h.distribution.release_calls), 1)
        self.assertEqual(snapshot["status"], "INCOMPLETE")
        self.assertIn("MEMORY_SAMPLE", snapshot["final"]["missing_evidence"])
        receipt = h.backend.release_receipt(0, h.spec.cleanup_deadline_us)
        self.assertEqual(receipt["basis"], "RESERVED_NOT_DISPATCHED")
        self.assertIsNone(receipt["cleanup_receipts"])
        self.assertTrue(receipt["no_future_own_exec"])
        self.assertFalse(snapshot["runtime_certificate"])

    def test_one_removed_dispatched_unit_and_two_unstarted_units_release_even_without_metrics(self):
        h = Harness()
        h.bound()
        h.backend.cleanup_modes[0] = {}
        snapshot = h.settle()
        self.assertEqual([slot for slot, _ in h.backend.start_calls], [0])
        self.assertEqual([slot for slot, _ in h.backend.stop_calls], [0])
        self.assertEqual(snapshot["slots"][0]["leaf_status"], "CLOSED_REMOVED")
        self.assertIsNotNone(snapshot["slots"][0]["certificate"])
        self.assertTrue(all(slot["certificate"] is None for slot in snapshot["slots"][1:]))
        self.assertTrue(h.watchdog.payload_released)
        self.assertEqual(len(h.distribution.release_calls), 1)
        self.assertEqual(snapshot["state"], "FINAL")
        self.assertEqual(snapshot["status"], "INCOMPLETE")
        self.assertIn("MEMORY_SAMPLE", snapshot["final"]["missing_evidence"])
        self.assertTrue(all(not slot["sampled"] for slot in snapshot["slots"]))
        supplied = h.distribution.release_calls[0][1]["slots"]
        self.assertIsNotNone(supplied[0]["certificate"])
        self.assertTrue(all(slot["certificate"] is None for slot in supplied[1:]))
        self.assertFalse(snapshot["runtime_certificate"])

    def test_unknown_dispatched_start_never_releases_on_local_no_future_execution_flag(self):
        h = Harness()
        h.arm()
        h.backend.start_errors.add(0)
        h.start(0)
        h.watchdog.tick()
        receipt = h.backend.release_receipt(0, h.spec.cleanup_deadline_us)
        self.assertEqual(receipt["basis"], "START_DISPATCHED_UNKNOWN")
        self.assertFalse(receipt["no_future_own_exec"])
        self.assertTrue(h.backend.cleanup_started)
        self.assertFalse(h.watchdog.payload_released)
        self.assertEqual(h.distribution.release_calls, [])
        self.assertNotEqual(h.final()["status"], "COMPLETE")
        self.assertEqual(h.distribution.release_calls, [])

    def test_false_or_foreign_release_receipt_cannot_free_unstarted_payload(self):
        for changes in ({"no_future_own_exec": False}, {"run": "f" * 32},
                        {"payload_binding_ref": ref("foreign-payload")},
                        {"manager_binding_ref": ref("foreign-manager")}, {"slot": 1}):
            with self.subTest(changes=changes):
                h = Harness()
                h.arm()
                h.backend.release_overrides[0] = changes
                h.settle()
                self.assertFalse(h.watchdog.payload_released)
                self.assertEqual(h.distribution.release_calls, [])
                self.assertNotEqual(h.final()["status"], "COMPLETE")

    def test_local_cleanup_flag_prevents_start_even_without_coordinator_ack(self):
        h = Harness()
        h.arm()
        h.watchdog.coordinator_dead()
        h.watchdog.coordinator_dead()
        self.assertTrue(h.backend.cleanup_started)
        self.assertEqual(h.backend.cleanup_transitions, 1)
        with self.assertRaises(WatchdogError):
            h.backend.reserve_start(0, ref("late-reservation"))
        with self.assertRaises(WatchdogError):
            h.backend.start_reserved(0, h.distribution.payload, h.spec.work_deadline_us)
        self.assertEqual(h.backend.start_calls, [])
        self.assertEqual(h.backend.reserved, {})

    def test_armed_root_digest_has_retained_full_original_directory_identity(self):
        h = Harness()
        packets = h.arm()
        armed = next(packet for packet in packets if packet.event == "ARMED")
        root = h.watchdog.observer_root_record
        self.assertEqual(armed.body["observer_root_binding"], ref(root))
        self.assertEqual(set(root), {"run", "original_root_identity", "before_us", "after_us"})
        self.assertEqual(root["run"], RUN)
        identity = root["original_root_identity"]
        self.assertEqual(identity["cgroup_path"], "/")
        self.assertEqual(identity["boot_id"], h.backend.manager["boot_id"])
        self.assertEqual(identity["mount_namespace_ref"], h.auth.watchdog_generation["mount_namespace_ref"])
        self.assertEqual(set(identity), {"boot_id", "mount_namespace_ref", "mount_id", "fs_type", "dev", "inode", "cgroup_path"})

    def test_hash_only_foreign_or_out_of_epoch_observer_root_cannot_arm(self):
        for variant in ("digest-only", "run", "boot", "namespace", "path", "before", "after"):
            with self.subTest(variant=variant):
                h = Harness()
                if variant == "digest-only":
                    h.observer.preflight = lambda spec: ref("unattributed-observer-root")
                elif variant == "run":
                    h.observer.root_overrides["run"] = "f" * 32
                elif variant in ("before", "after"):
                    h.observer.root_overrides[variant + "_us"] = str(h.spec.t0_us - 1 if variant == "before" else h.clock.now + 1)
                else:
                    identity = h.observer.preflight(h.spec)["original_root_identity"]
                    key = {"boot": "boot_id", "namespace": "mount_namespace_ref", "path": "cgroup_path"}[variant]
                    identity[key] = {"boot": "22222222-3333-4444-5555-666666666666",
                                     "namespace": "mnt:[foreign]", "path": "/foreign"}[variant]
                    h.observer.root_overrides["original_root_identity"] = identity
                replies = h.arm()
                self.assertNotIn("ARMED", [packet.event for packet in replies])
                self.assertEqual(h.backend.start_calls, [])
                self.assertFalse(h.watchdog.snapshot()["runtime_certificate"])


class OriginalPayloadCustodyTest(unittest.TestCase):
    def test_arm_composes_real_distribution_verify_with_original_typed_payload(self):
        from systemd_memory_runtime import payload_distribution as D

        h = Harness()
        elf = bytearray(64)
        elf[:7] = b"\x7fELF\x02\x01\x01"
        elf[16:18] = (3).to_bytes(2, "little")
        elf[18:20] = (62).to_bytes(2, "little")
        elf = bytes(elf)
        digest = hashlib.sha256(elf).hexdigest()
        h.spec = replace(h.spec, payload_expected_sha256=digest)
        h.watchdog.spec = h.backend.spec = h.observer.spec = h.spec
        h.auth.watchdog_generation = generation(200) | {"mount_namespace_ref": "mnt:[11]"}
        root = h.observer.preflight(h.spec)["original_root_identity"]
        root["mount_namespace_ref"] = "mnt:[11]"
        h.observer.root_overrides["original_root_identity"] = root
        stage = "elogistix-memory-" + RUN
        tokens = ("parent:root", "parent:run", "parent:stage")
        binding = D.PayloadBinding("VERIFIED_STAGED_ELF", digest, "/run/" + stage + "/keeper.elf",
                                   "2", "3", "mnt:[11]", 0, tokens, "PENDING_BEFORE_EXEC")
        distribution = D.RuntimeDistribution.__new__(D.RuntimeDistribution)
        distribution._state, distribution._binding = "PREPARED", binding
        distribution._spec = D.validate_run_spec(h.spec)
        distribution._elf_fd, distribution._control_uid = 50, 0
        distribution._file_identity = (2, 3, 11, 0, 0, 0o755, 64, 1, 1, 1)
        distribution._namespace_ref = "mnt:[11]"
        distribution._listener, distribution._listener_lazy = None, True
        distribution._dirs = [D._Directory(fd, name, (2, inode, 11, 0, 0, 0o755))
                              for fd, name, inode in ((10, "/", 100), (11, "run", 101), (12, stage, 102))]
        distribution._ancestor_registry = dict(zip(tokens, distribution._dirs))
        distribution.prepare = Mock(return_value=binding)
        h.watchdog.distribution = distribution
        listener = Mock()
        h.watchdog.listener_factory = listener

        def fstat(fd):
            return SimpleNamespace(st_dev=2, st_ino=3 if fd == 50 else {10: 100, 11: 101, 12: 102}[fd],
                                   st_uid=0, st_gid=0, st_mode=0o100755 if fd == 50 else 0o040755,
                                   st_size=64, st_nlink=1, st_mtime_ns=1, st_ctime_ns=1)

        with ExitStack() as stack:
            for constant in ("O_DIRECTORY", "O_NOFOLLOW", "O_CLOEXEC", "ST_NOEXEC"):
                stack.enter_context(patch.object(D.os, constant, 1, create=True))
            stack.enter_context(patch.object(D.time, "CLOCK_MONOTONIC", 1, create=True))
            stack.enter_context(patch.object(D.time, "clock_gettime_ns", return_value=h.clock.now * 1000, create=True))
            stack.enter_context(patch.object(D.os, "readlink", return_value="mnt:[11]"))
            stack.enter_context(patch.object(D.os, "open", side_effect=lambda path, *args, **kwargs:
                                            {"/": 10, "run": 11, stage: 12, "keeper.elf": 50}[path]))
            stack.enter_context(patch.object(D.os, "close"))
            stack.enter_context(patch.object(D.os, "fstat", side_effect=fstat))
            stack.enter_context(patch.object(D.os, "listxattr", return_value=[], create=True))
            stack.enter_context(patch.object(D.os, "fstatvfs", return_value=SimpleNamespace(f_flag=0), create=True))
            stack.enter_context(patch.object(D.os, "pread", side_effect=lambda fd, size, offset: elf[offset:offset + size], create=True))
            stack.enter_context(patch.object(D, "open", mock_open(read_data="mnt_id:\t11\n"), create=True))
            with self.assertRaises(D.DistributionError):
                distribution.verify(binding.to_mapping(), h.spec.work_deadline_us)
            with self.assertRaises(D.DistributionError):
                distribution.verify(replace(binding), h.spec.work_deadline_us)
            packet = h.packet("COORDINATOR", "ARM", {"run_spec": h.spec.to_mapping(),
                              "payload_expected_sha256": digest})
            replies = h.watchdog.handle_packet(packet)
            self.assertIn("ARMED", [reply.event for reply in replies], h.watchdog.snapshot())
            self.assertIs(distribution.verify(binding, h.spec.work_deadline_us).binding, binding)
        self.assertIs(h.watchdog.payload_local, binding)
        self.assertEqual(h.watchdog.payload, binding.to_mapping())
        self.assertIsNot(h.watchdog.payload, binding)
        self.assertIs(listener.call_args.args[0], binding)
        self.assertEqual(next(reply for reply in replies if reply.event == "ARMED").to_mapping()["body"]["payload_binding"], binding.to_mapping())
        self.assertEqual(h.watchdog.export_evidence()["payload_binding"], binding.to_mapping())
        self.assertEqual(h.backend.start_calls, [])

    def test_local_verify_listener_authentication_and_release_keep_same_object(self):
        from systemd_memory_runtime import payload_distribution as D

        h = Harness()
        binding = D.PayloadBinding(**(h.distribution.payload | {"protected_ancestor_refs": ("parent:fixture",)}))
        h.distribution.prepare = Mock(return_value=binding)
        verify = Mock(side_effect=lambda payload, deadline: self.assertIs(payload, binding))
        release = Mock(side_effect=lambda payload, evidence, deadline: self.assertIs(payload, binding))
        listener = Mock(side_effect=lambda payload, deadline: self.assertIs(payload, binding))

        class Authenticator(FakeAuthenticator):
            def __call__(inner, peer, body, candidate, payload, spec, deadline):
                self.assertIs(payload, binding)
                return super().__call__(peer, body, candidate, payload, spec, deadline)

        h.distribution.verify, h.distribution.release = verify, release
        h.watchdog.listener_factory, h.watchdog.keeper_authenticator = listener, Authenticator()
        h.measured_three()
        h.settle()
        self.assertEqual(h.watchdog.snapshot()["final"]["status"], "COMPLETE")
        verify.assert_called_once()
        listener.assert_called_once()
        release.assert_called_once()
        self.assertIs(h.watchdog.payload_local, binding)
        self.assertIs(release.call_args.args[0], binding)
        self.assertEqual(h.watchdog.export_evidence()["payload_binding"], binding.to_mapping())

    def test_native_authenticator_retains_same_typed_payload_for_later_spawn_verification(self):
        from systemd_memory_runtime import payload_distribution as D

        h = Harness()
        h.bound()
        binding = D.PayloadBinding(**(h.distribution.payload | {"protected_ancestor_refs": ("parent:fixture",)}))
        retained_distribution = D.RuntimeDistribution.__new__(D.RuntimeDistribution)
        retained_distribution._state, retained_distribution._binding = "PREPARED", binding
        retained_distribution._spec = D.validate_run_spec(h.spec)
        seen = []

        def verify_original(payload, deadline):
            seen.append(payload)
            return retained_distribution._known(payload)

        retained_distribution.verify = verify_original
        native = watchdog_module.NativeKeeperAuthenticator.__new__(watchdog_module.NativeKeeperAuthenticator)
        native.registry = SimpleNamespace(children={}, verify_live=Mock())
        native.distribution, native.bindings = retained_distribution, {}
        peer = h.peer(0)
        hello = {"pid": 300, "start_ticks": "3000", "exe_sha256": PAYLOAD_SHA, "uid": 1001,
                 "gid": 1001, "groups": [1001], "no_new_privs": True,
                 "cap_eff": "0", "cap_perm": "0", "cap_inh": "0", "cap_amb": "0"}
        credentials = {"uids": (1001,) * 4, "gids": (1001,) * 4, "groups": (1001,), "no_new_privs": True,
                       "cap_eff": 0, "cap_perm": 0, "cap_inh": 0, "cap_amb": 0}
        with patch.object(watchdog_module, "_credentials", return_value=credentials), \
                patch.object(watchdog_module, "_verify_membership"), \
                patch.object(watchdog_module.os, "stat", return_value=SimpleNamespace(st_dev=2, st_ino=3, st_mode=0o100755)):
            self.assertEqual(native(peer, hello, h.backend.candidate(0), binding, h.spec, h.spec.work_deadline_us), peer.generation)
        self.assertIs(native.bindings[ref(peer.generation)][1], binding)
        with NativeSpawnFixture(h) as child_probe:
            child_probe.native.distribution = retained_distribution
            child_probe.native.bindings = native.bindings
            child_probe.verify()
        self.assertEqual(len(seen), 2)
        self.assertTrue(all(payload is binding for payload in seen))


class PhysicalJournalAndUnavailableProofTest(unittest.TestCase):
    def test_optional_full_journals_are_defensive_and_keep_fixture_provenance(self):
        h = Harness()
        raw = {"operation": "fixture-read", "observations": [{"text": "populated 1\n"}]}
        observer_journal = {"fixture_only": True, "records": [{"ref": ref(raw), "record": raw}]}
        producer_record = {"manager": deepcopy(h.backend.manager), "retained_generation": generation(300)}
        producer_journal = {"fixture_only": False, "records": [{"ref": ref(producer_record), "record": producer_record}]}
        self.assertNotIn("observer_journal", h.watchdog.export_evidence())
        self.assertNotIn("physical_producer_journal", h.watchdog.export_evidence())
        h.observer.export_evidence = lambda: observer_journal
        h.observer.export_producer_evidence = lambda: producer_journal
        exported = h.watchdog.export_evidence()
        self.assertEqual(exported["observer_journal"], observer_journal)
        self.assertEqual(exported["physical_producer_journal"], producer_journal)
        self.assertIs(exported["fixture_only"], True)
        self.assertIs(exported["observer_journal"]["fixture_only"], True)
        self.assertIs(exported["physical_producer_journal"]["fixture_only"], False)
        exported["observer_journal"]["records"][0]["record"]["observations"][0]["text"] = "changed"
        exported["physical_producer_journal"]["records"][0]["record"]["retained_generation"]["pid"] = 999
        self.assertEqual(raw["observations"][0]["text"], "populated 1\n")
        self.assertEqual(producer_record["retained_generation"]["pid"], 300)
        self.assertFalse(h.watchdog.snapshot()["runtime_certificate"])

    def test_unknown_exports_full_unavailable_proof_observation_and_receipts_without_certificate(self):
        h = Harness()
        h.measured_three()
        h.observer.physical_tags[0] = "Unavailable"
        observation = {"operation": "fixture-cgroup-events-read", "status": "Unavailable",
                       "reason": "IO", "before_us": str(h.clock.now), "after_us": str(h.clock.now)}
        original_fact = h.observer.physical_fact

        def physical_fact(physical):
            fact = original_fact(physical)
            if physical["slot"] == 0:
                fact.update(reason="IO", observation_ref=ref(observation))
                h.observer.closure_proofs[0].update(reason="IO", observation_ref=ref(observation))
            return fact

        h.observer.physical_fact = physical_fact

        def journal():
            records = [observation] + list(h.observer.closure_proofs.values())
            return {"fixture_only": True, "records": [{"ref": ref(record), "record": record} for record in records]}

        h.observer.export_evidence = journal
        h.settle()
        exported = h.watchdog.export_evidence()
        slot = exported["slots"][0]
        proof = slot["closure_proof"]
        self.assertEqual(proof["tag"], "Unavailable")
        contracts.validate_cleanup_proof(proof, slot["binding_proof"], slot["cleanup_evidence"], slot["physical"])
        records = {item["ref"]: item["record"] for item in exported["observer_journal"]["records"]}
        self.assertEqual(records[proof["observation_ref"]], observation)
        self.assertEqual(records[slot["cleanup_evidence"]["identity_brackets_ref"]], proof)
        self.assertEqual(slot["independent_receipts"]["missing_evidence"], [])
        self.assertIsNone(slot["certificate"])
        self.assertEqual(slot["leaf_status"], "UNKNOWN")
        self.assertFalse(any(record["kind"] == "CLEANUP_CERTIFICATE" and record["slot"] == 0
                             for _, record in h.watchdog.records))
        exported["slots"][0]["closure_proof"]["reason"] = "PERMISSION"
        self.assertEqual(h.watchdog.slots[0]["closure_proof"]["reason"], "IO")
        self.assertEqual(h.final()["status"], "INCOMPLETE")

    def test_success_closure_cannot_replace_unknown_even_with_matching_digest(self):
        h = Harness()
        h.measured_three()
        h.observer.physical_tags[0] = "Unavailable"
        original_probe = h.observer.probe_cleanup

        def contradictory_probe(physical, unit, receipts, reap_ref, deadline):
            evidence = original_probe(physical, unit, receipts, reap_ref, deadline)
            if unit["slot"] == 0:
                success = h.observer._capture_closure(physical, "OriginalAbsent")
                evidence["identity_brackets_ref"] = ref(success)
            return evidence

        h.observer.probe_cleanup = contradictory_probe
        h.settle()
        self.assertIn("IDENTITY_CHANGED", h.watchdog.snapshot()["faults"])
        self.assertIsNone(h.watchdog.slots[0]["closure_proof"])
        self.assertIsNone(h.watchdog.slots[0]["certificate"])
        self.assertNotEqual(h.final()["status"], "COMPLETE")

    def test_unknown_proof_must_match_original_binding_reason_observation_and_bracket(self):
        for field, value in (("physical_binding_ref", "f" * 64), ("reason", "PERMISSION"),
                             ("observation_ref", "f" * 64), ("identity_brackets_ref", "f" * 64)):
            with self.subTest(field=field):
                h = Harness()
                h.measured_three()
                h.observer.physical_tags[0] = "Unavailable"
                if field == "identity_brackets_ref":
                    h.observer.evidence_overrides[0] = {field: value}
                else:
                    h.observer.closure_overrides[0] = {field: value}
                h.settle()
                self.assertIn("IDENTITY_CHANGED", h.watchdog.snapshot()["faults"])
                self.assertIsNone(h.watchdog.slots[0]["certificate"])
                self.assertIsNone(h.watchdog.slots[0]["closure_proof"])
                self.assertNotEqual(h.final()["status"], "COMPLETE")

    def test_full_journal_is_not_truncated_to_make_final_store_appear_complete(self):
        h = Harness()
        h.measured_three()
        raw = {"observed_text": "x" * 524288}
        h.observer.export_evidence = lambda: {"fixture_only": True, "records": [{"ref": ref(raw), "record": raw}]}
        attempts = []

        def bounded_sink(record):
            attempts.append(record)
            if len(json.dumps(record).encode("utf-8")) > 524288:
                raise ValueError("fixture retained store limit")

        h.watchdog.result_sink = bounded_sink
        h.settle()
        self.assertEqual(len(attempts), 1)
        self.assertEqual(attempts[0]["observer_journal"]["records"][0]["record"], raw)
        self.assertEqual(h.watchdog.snapshot()["final"]["status"], "INCOMPLETE")
        self.assertIn("FINAL_UNIT_OBSERVATION", h.watchdog.snapshot()["final"]["missing_evidence"])


if __name__ == "__main__":
    unittest.main()
