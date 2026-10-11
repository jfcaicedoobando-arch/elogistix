"""V3 watchdog: one mutator, retained ledgers, and independent cleanup.

The core supports explicit fixture boundaries; ``serve`` is Linux-only. No unit
name lookup, timer expiry, PID disappearance, or physical fact alone certifies
cleanup. In particular, this process cannot reap PID1's service children.
"""

from dataclasses import asdict, dataclass, is_dataclass
from collections.abc import Mapping
import errno
import os
import selectors
import socket
import stat
import struct
import sys
import time

from . import contracts


MAX_PACKET = 16384
MAX_LEDGER_RECORDS = 512
RPC_MAX_US = 1000000
SO_PEERPIDFD = 77  # Linux >= 6.5; absence is a fail-closed binding failure.


class WatchdogError(ValueError):
    def __init__(self, code):
        self.code = code
        super().__init__(code)


@dataclass(frozen=True)
class PeerIdentity:
    generation: dict
    uid: int
    gid: int
    credentials: dict
    kernel_authenticated: bool = False
    fixture_only: bool = False


def _mapping(value):
    if isinstance(value, Mapping):
        return dict(value)
    if hasattr(value, "to_mapping"):
        return value.to_mapping()
    if is_dataclass(value):
        return asdict(value)
    raise WatchdogError("PROTOCOL")


def _u64(value):
    if type(value) is int and 0 <= value <= 2**64 - 1:
        return value
    return contracts.parse_u64(value)


def _ref(value):
    return contracts.digest_record(value)


def _plain(value):
    """Archive frozen protocol records as JSON data, without live handles."""
    if isinstance(value, Mapping):
        return {key: _plain(item) for key, item in value.items()}
    if type(value) in (tuple, list):
        return [_plain(item) for item in value]
    return value


class Watchdog:
    def __init__(self, run_spec, backend=None, distribution=None, observer=None,
                 clock=None, coordinator_generation=None, coordinator_liveness=None,
                 keeper_authenticator=None, listener_factory=None, result_sink=None):
        self.spec = run_spec if isinstance(run_spec, contracts.RunSpec) else contracts.RunSpec.from_mapping(run_spec)
        self.backend, self.distribution, self.observer = backend, distribution, observer
        self.clock = clock or (lambda: time.monotonic_ns() // 1000)
        self.coordinator_generation = coordinator_generation
        self.coordinator_liveness = coordinator_liveness
        self.keeper_authenticator = keeper_authenticator
        self.listener_factory, self.result_sink = listener_factory, result_sink
        self.state = "PRECHECK"
        self.manager = self.payload = self.observer_root = None
        self.payload_local = None
        self.observer_root_record = None
        self.backend_cleanup_started = False
        self.release_receipts = None
        self.last_us = self.spec.t0_us
        self.invalid = False
        self.coordinator_gone = False
        self.missing = set()
        self.faults = []
        self.fault_keys = set()
        self.records = []
        self.job_records = {}
        self.payload_released = False
        self.record_ref = _ref({"run": self.spec.run, "origin": str(self.spec.t0_us)})
        self.rx_seq, self.tx_seq, self.outboxes = {}, {}, {}
        self.keeper_peers = {}
        self.slots = {s.slot: {"spec": s, "start_consumed": False, "stop_consumed": False,
                     "candidate": None, "unit": None, "physical": None, "keeper": None,
                     "binding_proof": None, "closure_proof": None, "initial_threads": {},
                     "start_request_ref": None, "start_job_ref": None, "stop_request_ref": None,
                     "reservation_ref": None,
                     "stop_job_ref": None, "spawns": {}, "reaps": {}, "pending_reaps": [],
                     "spawn_observed_us": {},
                     "threads": {}, "joins": {},
                     "sample": None, "cleanup_evidence": None, "certificate": None,
                     "leaf_status": "UNKNOWN"} for s in self.spec.slots}
        self.fixture_only = any(getattr(d, "fixture_only", False) or getattr(d, "test_boundary", False)
                                for d in (backend, distribution, observer, keeper_authenticator))

    def _now(self):
        now = self.clock()
        if type(now) is not int or now < self.last_us:
            raise WatchdogError("PROTOCOL")
        self.last_us = now
        return now

    def _deadline(self, work=False):
        now = self._now()
        deadline = self.spec.work_deadline_us if work else self.spec.cleanup_deadline_us
        if self.manager is not None:
            deadline = min(deadline, _u64(self.manager["authority_lease_until_us"]))
        if now >= deadline:
            raise WatchdogError("DEADLINE")
        if work and self.state in ("CLEANUP", "FINAL"):
            raise WatchdogError("DEADLINE")
        return min(deadline, now + RPC_MAX_US)

    def _call(self, function, *args, work=False, with_deadline=True):
        if not callable(function):
            raise WatchdogError("DEPENDENCY_MISSING")
        deadline = self._deadline(work)
        try:
            result = function(*args, deadline) if with_deadline else function(*args)
        except Exception as error:
            if self._now() >= deadline:
                raise WatchdogError("DEADLINE") from None
            code = getattr(error, "code", None)
            if code in contracts.FAULT_CODES:
                raise WatchdogError(code) from None
            raise WatchdogError("TRANSPORT_UNKNOWN") from None
        if self._now() >= deadline:
            raise WatchdogError("DEADLINE")
        return result

    def _append(self, kind, slot, facts):
        if len(self.records) >= MAX_LEDGER_RECORDS:
            raise WatchdogError("PROTOCOL")
        record = {"previous": self.record_ref, "kind": kind, "slot": slot,
                  "mono_us": str(self._now()), "facts": facts}
        self.record_ref = _ref(record)
        self.records.append((self.record_ref, record))
        return self.record_ref

    def _emit(self, event, body, slot=None, request=None, channel="coordinator", sender="WATCHDOG"):
        seq = self.tx_seq.get(channel, 0) + 1
        packet = contracts.Envelope.from_mapping({"v": 3, "run": self.spec.run,
                 "sender": sender, "seq": seq, "slot": slot, "event": event,
                 "request": request, "mono_us": str(self._now()), "body": body})
        self.tx_seq[channel] = seq
        self.outboxes.setdefault(channel, []).append(packet)
        return packet

    def drain(self, channel="coordinator"):
        return tuple(self.outboxes.pop(channel, ()))

    def _fault(self, code, slot=None, at_event="FAULT"):
        if (slot, code) in self.fault_keys:
            self.begin_cleanup("FAULT")
            return
        self.fault_keys.add((slot, code))
        if code not in self.faults:
            self.faults.append(code)
        if code in ("IDENTITY_CHANGED", "AUTHENTICATION", "PROTOCOL", "INTERNAL"):
            self.invalid = True
        self._append("FAULT", slot, {"code": code})
        self._emit("FAULT", {"code": code, "at_event": at_event,
                   "identity_ref": self.record_ref, "missing_evidence": sorted(self.missing)}, slot)
        self.begin_cleanup("FAULT")

    def _required(self):
        requirements = ((self.backend, ("preflight", "reserve_start", "start_reserved",
                        "observe_candidate", "bind_unit", "stop_once", "poll_events", "cleanup_receipts",
                        "begin_cleanup", "release_receipt")),
                        (self.distribution, ("prepare", "verify", "release")),
                        (self.observer, ("preflight", "bind_leaf", "binding_proof", "sample_peak",
                                         "probe_cleanup", "cleanup_proof")))
        if any(d is None or any(not callable(getattr(d, name, None)) for name in names)
               for d, names in requirements):
            raise WatchdogError("DEPENDENCY_MISSING")
        if (self.coordinator_generation is None or not callable(self.coordinator_liveness)
                or not callable(self.keeper_authenticator) or not callable(self.listener_factory)
                or not callable(self.result_sink)):
            raise WatchdogError("DEPENDENCY_MISSING")
        contracts.validate_process_generation(self.coordinator_generation)
        if any(not callable(getattr(contracts, name, None)) for name in
               ("validate_binding_proof", "validate_closure_proof", "validate_cleanup_proof", "validate_observer_root_binding", "initial_thread_token",
                "initial_thread_creation_ref")):
            raise WatchdogError("DEPENDENCY_MISSING")

    def _arm(self, packet):
        if self.state != "PRECHECK" or contracts.RunSpec.from_mapping(packet.body["run_spec"]) != self.spec:
            raise WatchdogError("PROTOCOL")
        if packet.body["payload_expected_sha256"] != self.spec.payload_expected_sha256:
            raise WatchdogError("IDENTITY_CHANGED")
        self._required()
        ready = _mapping(self._call(self.backend.preflight, self.spec, work=True))
        if ready.get("jobs_listener_ready") is not True:
            raise WatchdogError("DEPENDENCY_MISSING")
        contracts.validate_manager_binding(ready["manager_binding"])
        self.manager = ready["manager_binding"]
        self.payload_local = self._call(self.distribution.prepare, self.spec, work=True)
        self.payload = _plain(_mapping(self.payload_local))
        contracts.validate_payload_binding(self.payload)
        self._call(self.distribution.verify, self.payload_local, work=True)
        observer_root = self._call(self.observer.preflight, self.spec, work=True, with_deadline=False)
        self.observer_root_record = _mapping(observer_root)
        contracts.validate_observer_root_binding(self.observer_root_record)
        self._validate_times(self.observer_root_record)
        identity = self.observer_root_record["original_root_identity"]
        if (self.observer_root_record["run"] != self.spec.run
                or identity["boot_id"] != self.manager["boot_id"]
                or identity["mount_namespace_ref"] != self.keeper_authenticator.watchdog_generation["mount_namespace_ref"]
                or _u64(self.observer_root_record["after_us"]) >= self.spec.work_deadline_us):
            raise WatchdogError("IDENTITY_CHANGED")
        self.observer_root = _ref(self.observer_root_record)
        self._call(self.listener_factory, self.payload_local, work=True)
        ledger = self._append("ARMED", None, {"slots": [s.to_mapping() for s in self.spec.slots]})
        self.state = "ARMED"
        self._emit("ARMED", {"watchdog_generation": self.keeper_authenticator.watchdog_generation,
                   "manager_binding": self.manager, "observer_root_binding": self.observer_root,
                   "payload_binding": self.payload, "slots_ledger_ref": ledger,
                   "work_deadline_us": str(self.spec.work_deadline_us),
                   "cleanup_deadline_us": str(self.spec.cleanup_deadline_us)}, request=packet.seq)

    def _run_slot(self, packet):
        if self.state not in ("ARMED", "RUN", "CHECKPOINT"):
            raise WatchdogError("PROTOCOL")
        slot = self.slots[packet.slot]
        self._deadline(work=True)
        if self.spec.work_deadline_us - self._now() <= 5500000:
            raise WatchdogError("DEADLINE")
        if slot["start_consumed"] or packet.body["slot_spec_sha256"] != _ref(slot["spec"]):
            raise WatchdogError("PROTOCOL")
        # Consumption and retained record precede any backend mutation.
        slot["start_consumed"] = True
        reserved = self._append("START_RESERVED", packet.slot, {"slot_spec_sha256": _ref(slot["spec"])})
        slot["reservation_ref"] = reserved
        self._call(self.backend.reserve_start, packet.slot, reserved, work=True, with_deadline=False)
        self.state = "RUN"
        self._emit("START_DISPATCHED", {"slot_record_ref": reserved,
                   "start_request_ref": reserved, "deadline_us": str(self._deadline(work=True))},
                   packet.slot, packet.seq)
        outcome = _mapping(self._call(self.backend.start_reserved, packet.slot, self.payload, work=True))
        slot["start_request_ref"] = outcome["request_ref"]
        slot["start_job_ref"] = outcome.get("job_ref")
        self._append("START_OUTCOME", packet.slot, outcome)
        if outcome["state"] != "ACCEPTED":
            self.missing.add("START_SETTLEMENT")
            self.begin_cleanup("FAULT")
        self._observe_candidate(packet.slot)

    def _observe_candidate(self, slot_id):
        slot = self.slots[slot_id]
        if not slot["start_consumed"] or slot["unit"] is not None:
            return
        try:
            candidate = _mapping(self._call(self.backend.observe_candidate, slot_id,
                                           work=self.state != "CLEANUP"))
            if candidate:
                contracts.validate_unit_candidate(candidate)
                if (candidate["slot"] != slot_id or candidate["name"] != slot["spec"].unit_name
                        or candidate["manager_binding_ref"] != _ref(self.manager)):
                    raise WatchdogError("IDENTITY_CHANGED")
                slot["candidate"] = candidate
        except WatchdogError as error:
            if error.code in ("DEADLINE", "IDENTITY_CHANGED", "AUTHENTICATION", "PROTOCOL"):
                raise
            # Missing unit is still an unresolved activation, never absence proof.
            self.missing.add("START_SETTLEMENT")

    def _keeper_hello(self, packet, peer):
        slot = self.slots[packet.slot]
        if (type(peer) is not PeerIdentity or peer.kernel_authenticated is not True
                or slot["keeper"] is not None or not slot["start_consumed"]):
            raise WatchdogError("AUTHENTICATION")
        self._observe_candidate(packet.slot)
        if slot["candidate"] is None:
            raise WatchdogError("AUTHENTICATION")
        generation = _mapping(self._call(self.keeper_authenticator, peer, packet.body,
                          slot["candidate"], self.payload_local, self.spec, work=self.state != "CLEANUP"))
        contracts.validate_process_generation(generation)
        if generation != peer.generation:
            raise WatchdogError("IDENTITY_CHANGED")
        self.fixture_only = self.fixture_only or peer.fixture_only
        unit = _mapping(self._call(self.backend.bind_unit, packet.slot, generation,
                                  work=self.state != "CLEANUP"))
        contracts.validate_unit_binding(unit)
        candidate = slot["candidate"]
        if (unit["manager_binding_ref"] != _ref(self.manager)
                or unit["keeper_generation_ref"] != _ref(generation)
                or any(unit[key] != candidate[key] for key in ("name", "object_path", "invocation_id",
                                                             "control_group", "control_group_id"))):
            raise WatchdogError("IDENTITY_CHANGED")
        # Retain an authenticated original unit before optional physical reads:
        # a later read failure must not erase our ability to Stop this invocation.
        slot["unit"], slot["keeper"] = unit, generation
        self.keeper_peers[packet.slot] = peer
        self._register_initial_thread(slot, generation, "KEEPER_HELLO", packet.body)
        physical = _mapping(self._call(self.observer.bind_leaf, unit, generation,
                                      work=self.state != "CLEANUP"))
        contracts.validate_physical_binding(physical)
        if (unit["slot"] != packet.slot or physical["slot"] != packet.slot
                or unit["name"] != slot["spec"].unit_name or physical["unit_binding_ref"] != _ref(unit)
                or physical["run"] != self.spec.run or physical["boot_id"] != self.manager["boot_id"]
                or physical["manager_owner"] != self.manager["owner_unique_name"]
                or physical["bus_guid"] != self.manager["bus_guid"]
                or physical["mount_namespace_ref"] != generation["mount_namespace_ref"]
                or any(physical[key] != self.observer_root_record["original_root_identity"][key]
                       for key in ("boot_id", "mount_namespace_ref", "mount_id", "fs_type", "dev"))
                or any(physical[key] != unit[key] for key in ("invocation_id", "control_group", "control_group_id"))
                or physical["unit_name"] != unit["name"]):
            raise WatchdogError("IDENTITY_CHANGED")
        binding_proof = _mapping(self._call(self.observer.binding_proof, physical,
                                           work=self.state != "CLEANUP"))
        contracts.validate_binding_proof(binding_proof, physical)
        self._validate_times(binding_proof)
        slot["unit"], slot["physical"], slot["keeper"] = unit, physical, generation
        slot["binding_proof"] = binding_proof
        self.keeper_peers[packet.slot] = peer
        record = self._append("KEEPER_BOUND", packet.slot,
                              {"unit": unit, "physical": physical, "keeper": generation,
                               "binding_proof": binding_proof})
        if slot["start_job_ref"] is not None:
            self._emit("UNIT_BOUND", {"unit_binding": unit, "start_job_ref": slot["start_job_ref"]}, packet.slot)
        if self.state != "CLEANUP" and slot["start_job_ref"] is not None:
            self._emit("LOAD_PERMIT", {"unit_binding_ref": _ref(unit), "physical_binding_ref": _ref(physical),
                       "scenario": slot["spec"].scenario, "work_deadline_us": str(self.spec.work_deadline_us),
                       "cleanup_deadline_us": str(self.spec.cleanup_deadline_us)}, packet.slot,
                       packet.seq, "keeper:" + str(packet.slot))
        else:
            self._quiesce(packet.slot, "FAULT")
        return record

    def _register_initial_thread(self, slot, generation, event, body):
        token = contracts.initial_thread_token(generation)
        slot["initial_threads"][token] = {"owner_process_generation_ref": _ref(generation),
            "thread_creation_record_ref": contracts.initial_thread_creation_ref(event, body),
            "thread_ref": token, "event": event, "body": _plain(body)}

    @staticmethod
    def _thread_record(slot, token):
        return slot["initial_threads"].get(token) or slot["threads"].get(token)

    def _keeper_record(self, packet, peer):
        slot = self.slots[packet.slot]
        self._deadline(work=packet.event in ("SPAWNED", "THREAD_CREATED", "CHECKPOINT_READY"))
        expected = self.keeper_peers.get(packet.slot)
        if expected is None or peer != expected:
            raise WatchdogError("AUTHENTICATION")
        if packet.event == "SPAWNED":
            if self.state == "CLEANUP":
                raise WatchdogError("PROTOCOL")
            body = packet.body
            contracts.validate_process_generation(body["child_generation"])
            child_ref = _ref(body["child_generation"])
            if (body["parent_generation_ref"] != _ref(slot["keeper"])
                    or child_ref in slot["spawns"] or len(slot["spawns"]) >= 7
                    or any(body["spawn_record_ref"] == r["spawn_record_ref"] for r in slot["spawns"].values())):
                raise WatchdogError("PROTOCOL")
            verifier = getattr(self.keeper_authenticator, "verify_spawn", None)
            if callable(verifier):
                self._call(verifier, body["child_generation"], slot["keeper"], slot["unit"], work=True)
            elif not self.fixture_only:
                raise WatchdogError("DEPENDENCY_MISSING")
            slot["spawns"][child_ref] = dict(body)
            slot["spawn_observed_us"][child_ref] = self._now()
            self._register_initial_thread(slot, body["child_generation"], "SPAWNED", body)
            record = self._append("SPAWNED", packet.slot, body)
        elif packet.event == "THREAD_CREATED":
            body = packet.body
            self._validate_times(body)
            owner = body["owner_process_generation_ref"]
            creator = self._thread_record(slot, body["creating_thread_ref"])
            if (self.state == "CLEANUP" or owner not in ({_ref(slot["keeper"])} | set(slot["spawns"]))
                    or owner in slot["reaps"] or creator is None
                    or creator["owner_process_generation_ref"] != owner
                    or body["thread_ref"] in slot["threads"] or len(slot["threads"]) >= 7
                    or body["thread_ref"] in slot["initial_threads"]
                    or any(r["thread_creation_record_ref"] == body["thread_creation_record_ref"]
                           for r in slot["threads"].values())):
                raise WatchdogError("PROTOCOL")
            slot["threads"][body["thread_ref"]] = dict(body)
            record = self._append("THREAD_CREATED", packet.slot, body)
        elif packet.event == "REAPED":
            receipt = packet.body["receipt"]
            validator = getattr(contracts, "validate_reap_receipt", None)
            if not callable(validator):
                slot["pending_reaps"].append(dict(receipt))
                raise WatchdogError("REAP_POLICY_PENDING")
            validator(receipt)
            self._validate_times(receipt)
            if receipt["tag"] == "PTHREAD_JOINED":
                thread = self._thread_record(slot, receipt["joined_thread_ref"])
                joining = self._thread_record(slot, receipt["joining_thread_ref"])
                if (thread is None or receipt["joined_thread_ref"] in slot["joins"]
                        or joining is None or joining["owner_process_generation_ref"] != thread["owner_process_generation_ref"]
                        or receipt["owner_process_generation_ref"] != thread["owner_process_generation_ref"]
                        or receipt["thread_creation_record_ref"] != thread["thread_creation_record_ref"]
                        or ("after_us" in thread and _u64(receipt["before_us"]) < _u64(thread["after_us"]))):
                    raise WatchdogError("REAP_UNKNOWN")
                slot["joins"][receipt["joined_thread_ref"]] = dict(receipt)
            else:
                child_ref = _ref(receipt["child_generation"])
                if (child_ref not in slot["spawns"] or child_ref in slot["reaps"]
                        or receipt["reaper_generation"] != slot["keeper"]
                        or _u64(receipt["before_us"]) < slot["spawn_observed_us"][child_ref]):
                    raise WatchdogError("REAP_UNKNOWN")
                slot["reaps"][child_ref] = dict(receipt)
            record = self._append("REAPED", packet.slot, receipt)
        elif packet.event == "CHECKPOINT_READY":
            if self.state == "CLEANUP" or slot["sample"] is not None or not self._workloads_reaped(slot):
                raise WatchdogError("REAP_UNKNOWN")
            if packet.body["keeper_generation_ref"] != _ref(slot["keeper"]):
                raise WatchdogError("IDENTITY_CHANGED")
            if (packet.body["spawn_ledger_ref"] != _ref({"spawns": sorted(
                    _ref(body) for body in slot["spawns"].values())})
                    or packet.body["reap_ledger_ref"] != self._reap_ref(slot)):
                raise WatchdogError("IDENTITY_CHANGED")
            checkpoint = self._append("CHECKPOINT_READY", packet.slot, packet.body)
            sample = _mapping(self._call(self.observer.sample_peak, slot["physical"], slot["keeper"],
                                        self._reap_ref(slot), work=True))
            contracts.validate_memory_sample(sample)
            if (sample["unit_binding_ref"] != _ref(slot["unit"])
                    or sample["physical_binding_ref"] != _ref(slot["physical"])
                    or sample["keeper_generation_ref"] != _ref(slot["keeper"])
                    or sample["identity_before_ref"] != _ref(slot["physical"])
                    or sample["identity_after_ref"] != _ref(slot["physical"])
                    or sample["ledger_checkpoint_ref"] != self._reap_ref(slot)):
                raise WatchdogError("IDENTITY_CHANGED")
            self._validate_times(sample)
            slot["sample"] = sample
            self.state = "CHECKPOINT"
            record = self._append("MEMORY_SAMPLE", packet.slot, {"sample": sample, "checkpoint": checkpoint})
            self._emit("MEMORY_SAMPLE", {"sample": sample}, packet.slot)
        else:
            raise WatchdogError("PROTOCOL")
        self._emit("ACK", {"accepted_seq": packet.seq, "ledger_record_sha256": record},
                   packet.slot, packet.seq, "keeper:" + str(packet.slot))

    def _reap_ref(self, slot):
        return _ref({"reaps": sorted(_ref(r) for r in (*slot["reaps"].values(), *slot["joins"].values()))})

    def _workloads_reaped(self, slot, keeper_released=False):
        if set(slot["spawns"]) != set(slot["reaps"]) or slot["pending_reaps"]:
            return False
        # Consumed wait of the owning process covers its whole task group.
        return all(ref in slot["joins"] or thread["owner_process_generation_ref"] in slot["reaps"]
                   or (keeper_released and thread["owner_process_generation_ref"] == _ref(slot["keeper"]))
                   for ref, thread in slot["threads"].items())

    def _quiesce(self, slot_id, reason):
        if slot_id in self.keeper_peers:
            self._emit("QUIESCE", {"reason": reason, "cleanup_deadline_us": str(self.spec.cleanup_deadline_us)},
                       slot_id, channel="keeper:" + str(slot_id))

    def begin_cleanup(self, reason="FAULT"):
        if self.state in ("CLEANUP", "FINAL"):
            return
        self.state = "CLEANUP"
        # This is a local irreversible fence, never a manager mutation or RPC.
        # It must remain possible even when the remote-operation lease expired.
        try:
            function = getattr(self.backend, "begin_cleanup", None)
            if not callable(function):
                raise WatchdogError("DEPENDENCY_MISSING")
            function()
            self.backend_cleanup_started = True
        except Exception:
            self.missing.add("PAYLOAD_BINDING")
        self._append("BEGIN_CLEANUP", None, {"reason": reason})
        for slot_id in self.slots:
            self._quiesce(slot_id, reason)

    def coordinator_dead(self):
        self.coordinator_gone = True
        self.begin_cleanup("FAULT")

    def _cleanup_slot(self, slot_id):
        slot = self.slots[slot_id]
        if not slot["start_consumed"] or (slot["leaf_status"] == "CLOSED_REMOVED" and slot["certificate"]):
            return
        if slot["unit"] is None:
            self._observe_candidate(slot_id)
            self.missing.add("START_SETTLEMENT")
            return
        if not slot["stop_consumed"]:
            slot["stop_consumed"] = True
            retained = self._append("STOP_RESERVED", slot_id, {"original_unit_binding_ref": _ref(slot["unit"])})
            self._emit("STOP_DISPATCHED", {"original_unit_binding_ref": _ref(slot["unit"]),
                       "stop_request_ref": retained, "deadline_us": str(self._deadline())}, slot_id)
            outcome = _mapping(self._call(self.backend.stop_once, slot["unit"]))
            slot["stop_request_ref"], slot["stop_job_ref"] = outcome["request_ref"], outcome.get("job_ref")
            self._append("STOP_OUTCOME", slot_id, outcome)
        receipts = _mapping(self._call(self.backend.cleanup_receipts, slot_id))
        required = ("activations_settled", "stop_settled", "terminal_no_pending_execution", "keeper_reaped")
        if any(receipts.get(key) is not True for key in required):
            self.missing.update(("START_SETTLEMENT", "STOP_SETTLEMENT", "FINAL_UNIT_OBSERVATION", "KEEPER_REAP"))
            return
        # Authentic job/terminal/main-reap records are mandatory, not bare flags.
        for key in ("start_receipt", "stop_receipt", "final_unit_receipt", "keeper_reap_receipt"):
            if type(receipts.get(key)) is not dict or not receipts[key]:
                self.missing.add("KEEPER_REAP" if key == "keeper_reap_receipt" else "FINAL_UNIT_OBSERVATION")
                return
        validator = getattr(contracts, "validate_main_release_facts", None)
        if not callable(validator):
            self.missing.add("KEEPER_REAP")
            return
        main_receipt = receipts["keeper_reap_receipt"]
        if set(main_receipt) != {"systemd_main_exit", "pidfd_task_released"}:
            self.missing.add("KEEPER_REAP")
            return
        validator(main_receipt["systemd_main_exit"], main_receipt["pidfd_task_released"])
        if (main_receipt["systemd_main_exit"]["original_process_generation"] != slot["keeper"]
                or main_receipt["systemd_main_exit"]["invocation_id"] != slot["unit"]["invocation_id"]):
            raise WatchdogError("IDENTITY_CHANGED")
        self._validate_receipts(slot, receipts)
        if not self._workloads_reaped(slot, keeper_released=True):
            self.missing.add("REAP_LEDGER")
            return
        if slot["physical"] is None or slot["binding_proof"] is None:
            self.missing.add("PHYSICAL_IDENTITY")
            return
        evidence = _mapping(self._call(self.observer.probe_cleanup, slot["physical"], slot["unit"],
                            receipts, self._reap_ref(slot)))
        contracts.validate_cleanup_evidence(evidence)
        if (evidence["slot"] != slot_id or evidence["original_unit_binding_ref"] != _ref(slot["unit"])
                or evidence["original_physical_binding_ref"] != _ref(slot["physical"])
                or evidence["reap_ledger_ref"] != self._reap_ref(slot)
                or evidence["start_settlement_ref"] != receipts["start_settlement_ref"]
                or evidence["stop_settlement_ref"] != receipts["stop_settlement_ref"]
                or evidence["final_unit_observation_ref"] != receipts["final_unit_receipt_ref"]
                or _u64(evidence["lease_until_us"]) != _u64(self.manager["authority_lease_until_us"])
                or not self.spec.t0_us <= _u64(evidence["observed_us"]) <= self._now()):
            raise WatchdogError("IDENTITY_CHANGED")
        leaf_status = contracts.physical_leaf_status(evidence["physical"])
        if leaf_status == "UNKNOWN":
            closure = _mapping(self._call(self.observer.cleanup_proof, evidence, slot["physical"]))
            contracts.validate_cleanup_proof(closure, slot["binding_proof"], evidence, slot["physical"])
            if closure.get("tag") != "Unavailable":
                raise WatchdogError("IDENTITY_CHANGED")
            slot["cleanup_evidence"] = evidence
            slot["closure_proof"] = closure
            slot["independent_receipts"] = receipts
            slot["leaf_status"] = leaf_status
            self.missing.update(evidence["missing_evidence"])
            self.missing.add("PHYSICAL_OBSERVATION")
            return
        if evidence["missing_evidence"]:
            slot["cleanup_evidence"] = evidence
            self.missing.update(evidence["missing_evidence"])
            return
        closure = _mapping(self._call(self.observer.cleanup_proof, evidence, slot["physical"]))
        contracts.validate_closure_proof(closure, slot["binding_proof"], evidence, slot["physical"])
        self._validate_times(closure["operation"])
        if evidence["identity_brackets_ref"] != _ref(closure):
            raise WatchdogError("IDENTITY_CHANGED")
        slot["cleanup_evidence"] = evidence
        slot["leaf_status"] = leaf_status
        slot["closure_proof"] = closure
        certificate_facts = {"evidence_ref": _ref(evidence),
                             "independent_receipts_ref": _ref(receipts)}
        if leaf_status == "CLOSED_REMOVED":
            slot["certificate"] = self._append("CLEANUP_CERTIFICATE", slot_id,
                    {**certificate_facts, "binding_proof_ref": _ref(slot["binding_proof"]),
                     "closure_proof_ref": _ref(closure)})
            slot["certified_evidence"] = evidence
        slot["independent_receipts"] = receipts

    def _validate_times(self, record, before="before_us", after="after_us"):
        if not self.spec.t0_us <= _u64(record[before]) <= _u64(record[after]) <= self._now():
            raise WatchdogError("PROTOCOL")
        if _u64(record[after]) >= min(self.spec.cleanup_deadline_us,
                                     _u64(self.manager["authority_lease_until_us"])):
            raise WatchdogError("DEADLINE")

    def _validate_receipts(self, slot, receipts):
        """Bind every retained receipt to the one consumed RPC and invocation."""
        unit = slot["unit"]
        for kind in ("start", "stop"):
            receipt = receipts[kind + "_receipt"]
            if set(receipt) != {"kind", "job_ref", "request_ref", "event"}:
                raise WatchdogError("PROTOCOL")
            event = receipt["event"]
            if (receipt["kind"] != kind or receipt["request_ref"] != slot[kind + "_request_ref"]
                    or receipt["job_ref"] != slot[kind + "_job_ref"]
                    or slot[kind + "_job_ref"] is None
                    or set(event) != {"boot_id", "bus_guid", "owner_unique_name", "job_id", "job_path",
                                      "unit_name", "result", "observed_us"}
                    or event["boot_id"] != self.manager["boot_id"]
                    or event["bus_guid"] != self.manager["bus_guid"]
                    or event["owner_unique_name"] != self.manager["owner_unique_name"]
                    or event["unit_name"] != unit["name"] or event["result"] != "done"
                    or type(event["job_id"]) is not int or not 0 < event["job_id"] <= 2**32-1
                    or event["job_path"] != "/org/freedesktop/systemd1/job/" + str(event["job_id"])):
                raise WatchdogError("IDENTITY_CHANGED")
            if not self.spec.t0_us <= _u64(event["observed_us"]) <= self._now():
                raise WatchdogError("PROTOCOL")
            if receipts[kind + "_settlement_ref"] != _ref(receipt):
                raise WatchdogError("IDENTITY_CHANGED")
            if receipt["job_ref"] != _ref({"kind": kind, "slot": slot["spec"].slot,
                    "boot_id": event["boot_id"], "bus_guid": event["bus_guid"],
                    "owner": event["owner_unique_name"], "job_id": event["job_id"],
                    "job_path": event["job_path"], "unit_name": event["unit_name"]}):
                raise WatchdogError("IDENTITY_CHANGED")
        final = receipts["final_unit_receipt"]
        if set(final) != {"original_unit_binding_ref", "manager_binding_ref", "invocation_id",
                          "snapshot", "before_us", "after_us"}:
            raise WatchdogError("PROTOCOL")
        snapshot = final["snapshot"]
        base, service = snapshot["unit"], snapshot["service"]
        if (final["original_unit_binding_ref"] != _ref(unit)
                or final["manager_binding_ref"] != _ref(self.manager)
                or final["invocation_id"] != unit["invocation_id"]
                or snapshot["object_path"] != unit["object_path"]
                or base["Id"] != unit["name"] or base["InvocationID"] != unit["invocation_id"]
                or base["ActiveState"] not in ("inactive", "failed")
                or base["SubState"] not in ("dead", "failed")
                or tuple(base["Job"]) != (0, "/")
                or type(service["MainPID"]) is not int or service["MainPID"] != 0
                or type(service["ControlPID"]) is not int or service["ControlPID"] != 0
                or base.get("Transient") is not True
                or receipts["final_unit_receipt_ref"] != _ref(final)
                or receipts["keeper_reap_receipt_ref"] != _ref(receipts["keeper_reap_receipt"])):
            raise WatchdogError("IDENTITY_CHANGED")
        self._validate_times(final)
        main = receipts["keeper_reap_receipt"]
        for record in main.values():
            self._validate_times(record)
        if (main["pidfd_task_released"]["procfs_namespace_ref"] != slot["keeper"]["pid_namespace_ref"]
                or _u64(main["systemd_main_exit"]["start_timestamp_us"]) < self.spec.t0_us):
            raise WatchdogError("IDENTITY_CHANGED")

    def _release_ready(self):
        """Consult the sole mutator's local custody; reservation is not dispatch.

        These retained facts are evidence for the graph, never caller-granted
        authority. Native distribution independently asks its local settlement
        authority before releasing the ELF/listener resources.
        """
        if (not self.backend_cleanup_started or self.manager is None or self.payload is None):
            return False
        observations = []
        eligible = True
        for slot_id, slot in self.slots.items():
            record = _mapping(self._call(self.backend.release_receipt, slot_id))
            if (set(record) != {"slot", "run", "reservation_ref", "payload_binding_ref",
                               "manager_binding_ref", "basis", "no_future_own_exec", "observed_us",
                               "authority_lease_until_us", "cleanup_receipts", "test_boundary"}
                    or type(record["slot"]) is not int or record["slot"] != slot_id
                    or record["run"] != self.spec.run
                    or record["payload_binding_ref"] != _ref(self.payload)
                    or record["manager_binding_ref"] != _ref(self.manager)
                    or _u64(record["authority_lease_until_us"]) != _u64(self.manager["authority_lease_until_us"])
                    or not self.spec.t0_us <= _u64(record["observed_us"]) <= self._now()
                    or type(record["test_boundary"]) is not bool
                    or type(record["no_future_own_exec"]) is not bool):
                raise WatchdogError("IDENTITY_CHANGED")
            self.fixture_only = self.fixture_only or record["test_boundary"]
            basis = record["basis"]
            if basis in ("NOT_RESERVED_NOT_DISPATCHED", "RESERVED_NOT_DISPATCHED"):
                if (record["no_future_own_exec"] is not True or record["cleanup_receipts"] is not None
                        or slot["unit"] is not None or slot["start_request_ref"] is not None
                        or slot["start_job_ref"] is not None):
                    raise WatchdogError("IDENTITY_CHANGED")
                if basis == "NOT_RESERVED_NOT_DISPATCHED":
                    if record["reservation_ref"] is not None:
                        raise WatchdogError("IDENTITY_CHANGED")
                elif (slot["reservation_ref"] is None or record["reservation_ref"] != slot["reservation_ref"]):
                    raise WatchdogError("IDENTITY_CHANGED")
            elif basis == "START_DISPATCHED_BOUND":
                if (record["reservation_ref"] != slot["reservation_ref"] or slot["unit"] is None
                        or record["no_future_own_exec"] is not True or slot["certificate"] is None
                        or slot["leaf_status"] != "CLOSED_REMOVED"):
                    eligible = False
                else:
                    receipts = _mapping(record["cleanup_receipts"])
                    if any(receipts.get(key) is not True for key in ("activations_settled", "stop_settled",
                                           "terminal_no_pending_execution", "keeper_reaped")):
                        eligible = False
                    else:
                        contracts.validate_main_release_facts(receipts["keeper_reap_receipt"]["systemd_main_exit"],
                                                               receipts["keeper_reap_receipt"]["pidfd_task_released"])
                        if (receipts["keeper_reap_receipt"]["systemd_main_exit"]["original_process_generation"] != slot["keeper"]
                                or receipts["keeper_reap_receipt"]["systemd_main_exit"]["invocation_id"] != slot["unit"]["invocation_id"]):
                            raise WatchdogError("IDENTITY_CHANGED")
                        self._validate_receipts(slot, receipts)
            elif basis == "START_DISPATCHED_UNKNOWN":
                if record["no_future_own_exec"] is not False or record["cleanup_receipts"] is not None:
                    raise WatchdogError("IDENTITY_CHANGED")
                eligible = False
            else:
                raise WatchdogError("PROTOCOL")
            observations.append(record)
        self.release_receipts = observations
        return eligible

    def _progress(self):
        now = self._now()
        if self.state == "FINAL":
            return
        if callable(self.coordinator_liveness) and self.coordinator_liveness() is not True:
            self.coordinator_dead()
        if now >= self.spec.work_deadline_us:
            self.begin_cleanup("DEADLINE")
        if now >= self.spec.cleanup_deadline_us:
            self.missing.add("DEADLINE")
            self._finish()
            return
        if self.manager is not None and now >= _u64(self.manager["authority_lease_until_us"]):
            self.missing.add("AUTHORITY")
            self._finish()
            return
        if self.manager is None:
            return
        try:
            events = self._call(self.backend.poll_events)
            if type(events) not in (tuple, list) or len(events) > 6:
                raise WatchdogError("PROTOCOL")
            for event in events:
                record = _mapping(event)
                if (set(record) != {"boot_id", "bus_guid", "owner_unique_name", "job_path",
                        "unit_name", "job_id", "result", "observed_us"}
                        or any(type(record.get(key)) is not str for key in
                               ("boot_id", "bus_guid", "owner_unique_name", "job_path", "unit_name", "result"))
                        or type(record["job_id"]) is not int or not 0 < record["job_id"] <= 2**32-1
                        or record["job_path"] != "/org/freedesktop/systemd1/job/" + str(record["job_id"])
                        or not self.spec.t0_us <= _u64(record["observed_us"]) <= self._now()):
                    raise WatchdogError("PROTOCOL")
                identity = (record.get("boot_id"), record.get("bus_guid"), record.get("owner_unique_name"),
                            record.get("job_path"), record.get("unit_name"))
                if identity not in self.job_records:
                    if (len(self.job_records) >= 6 or record.get("boot_id") != self.manager["boot_id"]
                            or record.get("bus_guid") != self.manager["bus_guid"]
                            or record.get("owner_unique_name") != self.manager["owner_unique_name"]
                            or record.get("unit_name") not in {s.unit_name for s in self.spec.slots}):
                        raise WatchdogError("IDENTITY_CHANGED")
                    self.job_records[identity] = _ref(record)
                    self._append("JOB_EVENT", None, record)
                elif self.job_records[identity] != _ref(record):
                    raise WatchdogError("IDENTITY_CHANGED")
            if self.state == "CLEANUP":
                for slot_id in self.slots:
                    try:
                        self._cleanup_slot(slot_id)
                    except (WatchdogError, contracts.ContractError, KeyError, TypeError) as error:
                        code = getattr(error, "code", "PROTOCOL")
                        self._fault(code if code in contracts.FAULT_CODES else "PROTOCOL", slot_id)
                if (all(s["leaf_status"] == "CLOSED_REMOVED" for s in self.slots.values())
                        or self._release_ready()):
                    self._finish()
        except (WatchdogError, contracts.ContractError, KeyError, TypeError) as error:
            code = getattr(error, "code", "PROTOCOL")
            if code == "DEADLINE":
                self.missing.add("DEADLINE")
            else:
                self.missing.add("STOP_SETTLEMENT")
            if code in ("IDENTITY_CHANGED", "AUTHENTICATION", "PROTOCOL", "INTERNAL"):
                self._fault(code)
            self.begin_cleanup("FAULT")

    def _finish(self):
        if self.state == "FINAL":
            return
        self.state = "FINAL"
        # Transient observations remain in the ledger. Current obligations are
        # rebuilt per slot so late authentic settlement can resolve uncertainty.
        self.missing.difference_update({"START_SETTLEMENT", "STOP_SETTLEMENT", "FINAL_UNIT_OBSERVATION",
                                        "KEEPER_REAP", "REAP_LEDGER", "PHYSICAL_OBSERVATION"})
        for slot in self.slots.values():
            if slot["sample"] is None:
                self.missing.add("MEMORY_SAMPLE")
            if slot["certificate"] is None:
                self.missing.add("PHYSICAL_OBSERVATION")
            if slot["leaf_status"] != "CLOSED_REMOVED":
                self.missing.add("PHYSICAL_OBSERVATION")
            if not slot["certificate"]:
                self.missing.update(("START_SETTLEMENT", "STOP_SETTLEMENT", "FINAL_UNIT_OBSERVATION", "KEEPER_REAP"))
            if not self._workloads_reaped(slot, keeper_released=bool(slot["certificate"])):
                self.missing.add("REAP_LEDGER")
        status = "INVALID" if self.invalid else "COMPLETE" if (
            not self.missing and all(s["leaf_status"] == "CLOSED_REMOVED" for s in self.slots.values())) else "INCOMPLETE"
        try:
            release_ready = self._release_ready()
        except Exception:
            release_ready = False
            self.missing.add("PAYLOAD_BINDING")
        if status == "COMPLETE" and not release_ready:
            status = "INCOMPLETE"
            self.missing.add("PAYLOAD_BINDING")
        if release_ready and not self.payload_released:
            try:
                # Only ELF/listener resources may be released. The protected
                # evidence store remains available for independent verification.
                self._call(self.distribution.release, self.payload_local, self.export_evidence())
                self.payload_released = True
            except WatchdogError as error:
                status = "INVALID" if self.invalid else "INCOMPLETE"
                self.missing.add("DEADLINE" if error.code == "DEADLINE" else "PAYLOAD_BINDING")
        body = {"status": status, "slots": [{"slot": i, "leaf_status": s["leaf_status"]}
                for i, s in sorted(self.slots.items())], "metric_records_ref": _ref({"samples": [
                    _ref(s["sample"]) for s in self.slots.values() if s["sample"] is not None]}),
                "slot_ledger_ref": self.record_ref, "cleanup_records_ref": _ref({"certificates": [
                    s["certificate"] for s in self.slots.values() if s["certificate"] is not None]}),
                "memory_reclamation": "NOT_ESTABLISHED", "missing_evidence": sorted(self.missing)}
        if not callable(self.result_sink):
            if status == "COMPLETE":
                body["status"] = "INCOMPLETE"
                body["missing_evidence"] = sorted(set(body["missing_evidence"]) | {"FINAL_UNIT_OBSERVATION"})
        else:
            try:
                self.final_body = body
                self._deadline()
                self.result_sink(self.export_evidence())
                self._deadline()
            except Exception as error:
                body["status"] = "INVALID" if self.invalid else "INCOMPLETE"
                failures = {"FINAL_UNIT_OBSERVATION"}
                if getattr(error, "code", None) == "DEADLINE":
                    failures.add("DEADLINE")
                body["missing_evidence"] = sorted(set(body["missing_evidence"]) | failures)
        self.final_body = body
        self._emit("FINAL", body)

    def handle_packet(self, packet, peer=None):
        packet = packet if isinstance(packet, contracts.Envelope) else contracts.Envelope.from_mapping(packet)
        channel = "coordinator" if packet.sender == "COORDINATOR" else "keeper:" + str(packet.slot)
        try:
            if packet.run != self.spec.run or packet.seq != self.rx_seq.get(channel, 0) + 1:
                raise WatchdogError("PROTOCOL")
            if _u64(packet.mono_us) > self._now() or self.state == "FINAL":
                raise WatchdogError("DEADLINE")
            self.rx_seq[channel] = packet.seq
            if packet.sender == "COORDINATOR":
                if packet.event == "ARM":
                    self._arm(packet)
                elif packet.event == "RUN_SLOT":
                    self._run_slot(packet)
                elif packet.event == "BEGIN_CLEANUP":
                    self.begin_cleanup(packet.body["reason"])
                    record = self._append("COORDINATOR_CLEANUP", None, packet.body)
                    self._emit("ACK", {"accepted_seq": packet.seq, "ledger_record_sha256": record}, request=packet.seq)
                else:
                    raise WatchdogError("PROTOCOL")
            elif packet.sender == "KEEPER":
                if packet.event == "KEEPER_HELLO":
                    self._keeper_hello(packet, peer)
                else:
                    self._keeper_record(packet, peer)
            else:
                raise WatchdogError("AUTHENTICATION")
        except WatchdogError as error:
            self._fault(error.code, packet.slot, packet.event)
        except Exception:
            self._fault("PROTOCOL", packet.slot, packet.event)
        self._progress()
        return self.drain(channel)

    def tick(self):
        self._progress()
        return self.drain()

    def delivery_failed(self, channel):
        if channel == "coordinator":
            self.begin_cleanup("FAULT")
        else:
            self._fault("PEER_CLOSED", int(channel.split(":", 1)[1]))

    def snapshot(self):
        final = getattr(self, "final_body", None)
        return {"state": self.state, "status": final["status"] if final else "IN_PROGRESS",
                "fixture_only": self.fixture_only, "runtime_certificate": bool(final and
                final["status"] == "COMPLETE" and not self.fixture_only),
                "coordinator_gone": self.coordinator_gone, "ledger_record_ref": self.record_ref,
                "ledger_count": len(self.records), "faults": tuple(self.faults),
                "missing_evidence": tuple(sorted(self.missing)), "final": final,
                "slots": tuple({"slot": i, "start_consumed": s["start_consumed"],
                "stop_consumed": s["stop_consumed"], "spawn_count": len(s["spawns"]),
                "reap_count": len(s["reaps"]), "sampled": s["sample"] is not None,
                "leaf_status": s["leaf_status"], "certificate": s["certificate"]} for i, s in self.slots.items())}

    def export_evidence(self):
        """Actual retained facts, not an attestation produced by hashes alone."""
        journals = {}
        for field, method in (("observer_journal", "export_evidence"),
                              ("physical_producer_journal", "export_producer_evidence")):
            export = getattr(self.observer, method, None)
            if callable(export):
                journals[field] = _mapping(export())
        return _plain({"run": self.spec.run, "fixture_only": self.fixture_only,
                **journals,
                "final": getattr(self, "final_body", None), "payload_binding": self.payload,
                "manager_binding": self.manager,
                "observer_root_binding": self.observer_root_record,
                "release_receipts": self.release_receipts,
                "ledger_records": [{"ref": ref, "record": record} for ref, record in self.records],
                "slots": [{"slot": i, "unit": s["unit"], "physical": s["physical"],
                "keeper": s["keeper"], "spawns": list(s["spawns"].values()),
                "initial_threads": list(s["initial_threads"].values()),
                "binding_proof": s["binding_proof"], "closure_proof": s["closure_proof"],
                "reaps": list(s["reaps"].values()), "threads": list(s["threads"].values()),
                "joins": list(s["joins"].values()), "sample": s["sample"],
                "cleanup_evidence": s["cleanup_evidence"], "independent_receipts": s.get("independent_receipts"),
                "certificate": s["certificate"], "leaf_status": s["leaf_status"]}
                for i, s in sorted(self.slots.items())]})


WatchdogCore = Watchdog


def _linux_only():
    if not sys.platform.startswith("linux") or not hasattr(os, "pidfd_open"):
        raise WatchdogError("DEPENDENCY_UNAVAILABLE")


def _read_bounded(path, limit=4096):
    fd = os.open(path, os.O_RDONLY | os.O_CLOEXEC | os.O_NOFOLLOW)
    try:
        data = os.read(fd, limit + 1)
        if len(data) > limit:
            raise WatchdogError("PROTOCOL")
        return data.decode("ascii", "strict")
    finally:
        os.close(fd)


def _pidfd_live(fd):
    poller = selectors.DefaultSelector()
    try:
        poller.register(fd, selectors.EVENT_READ)
        return not poller.select(0)
    finally:
        poller.close()


def _generation(pid):
    text = _read_bounded("/proc/" + str(pid) + "/stat")
    close = text.rfind(")")
    fields = text[close + 2:].split()
    if close < 1 or len(fields) < 20 or text[:text.find(" ")] != str(pid):
        raise WatchdogError("AUTHENTICATION")
    start = contracts.parse_u64(fields[19])
    result = {"pid": pid, "start_ticks": str(start),
              "boot_id": _read_bounded("/proc/sys/kernel/random/boot_id", 64).strip(),
              "pid_namespace_ref": os.readlink("/proc/" + str(pid) + "/ns/pid"),
              "mount_namespace_ref": os.readlink("/proc/" + str(pid) + "/ns/mnt")}
    contracts.validate_process_generation(result)
    return result


def _parent_pid(pid):
    text = _read_bounded("/proc/" + str(pid) + "/stat")
    close = text.rfind(")")
    fields = text[close + 2:].split()
    if close < 1 or len(fields) < 20 or text[:text.find(" ")] != str(pid):
        raise WatchdogError("AUTHENTICATION")
    if not fields[1].isascii() or not fields[1].isdecimal():
        raise WatchdogError("AUTHENTICATION")
    return int(fields[1], 10)


def _verify_membership(pid, control_group):
    text = _read_bounded("/proc/" + str(pid) + "/cgroup")
    unified = [line[3:] for line in text.split("\n") if line.startswith("0::")]
    if unified != [control_group] or any(ord(c) < 32 for c in control_group):
        raise WatchdogError("IDENTITY_CHANGED")


def _credentials(pid):
    lines = _read_bounded("/proc/" + str(pid) + "/status", 16384).split("\n")
    wanted = {"Uid", "Gid", "Groups", "NoNewPrivs", "CapEff", "CapPrm", "CapInh", "CapAmb"}
    values = {}
    for line in lines:
        key, colon, value = line.partition(":")
        if colon and key in wanted:
            if key in values:
                raise WatchdogError("AUTHENTICATION")
            values[key] = value.split()
    if set(values) != wanted:
        raise WatchdogError("AUTHENTICATION")
    for key in ("Uid", "Gid"):
        if len(values[key]) != 4:
            raise WatchdogError("AUTHENTICATION")
    if len(values["Groups"]) > 32:
        raise WatchdogError("AUTHENTICATION")
    return {"uids": tuple(int(v, 10) for v in values["Uid"]),
            "gids": tuple(int(v, 10) for v in values["Gid"]),
            "groups": tuple(sorted(int(v, 10) for v in values["Groups"])),
            "no_new_privs": values["NoNewPrivs"] == ["1"],
            "cap_eff": int(values["CapEff"][0], 16), "cap_perm": int(values["CapPrm"][0], 16),
            "cap_inh": int(values["CapInh"][0], 16), "cap_amb": int(values["CapAmb"][0], 16)}


class NativePeerRegistry:
    """Owns peer pidfds from SO_PEERPIDFD, never descriptor numbers from IPC."""
    fixture_only = False

    def __init__(self):
        _linux_only()
        self.entries = {}
        self.children = {}

    def accept(self, connection):
        pid, uid, gid = struct.unpack("3i", connection.getsockopt(socket.SOL_SOCKET, socket.SO_PEERCRED, 12))
        if pid <= 1 or uid < 0 or gid < 0:
            raise WatchdogError("AUTHENTICATION")
        # pidfd_open(pid) cannot substitute this: the socket peer may have died
        # and its numeric PID been reused between credential and proc lookups.
        fd = connection.getsockopt(socket.SOL_SOCKET, SO_PEERPIDFD)
        try:
            os.set_inheritable(fd, False)
            info = _read_bounded("/proc/self/fdinfo/" + str(fd))
            pids = [line.partition(":")[2].strip() for line in info.split("\n") if line.startswith("Pid:")]
            if pids != [str(pid)] or not _pidfd_live(fd):
                raise WatchdogError("AUTHENTICATION")
            before = _generation(pid)
            credentials = _credentials(pid)
            after = _generation(pid)
            if before != after or not _pidfd_live(fd):
                raise WatchdogError("IDENTITY_CHANGED")
            peer = PeerIdentity(before, uid, gid, credentials, True, False)
            ref = _ref(before)
            if ref in self.entries:
                raise WatchdogError("AUTHENTICATION")
            self.entries[ref] = (fd, peer)
            return peer
        except Exception:
            os.close(fd)
            raise

    def verify_live(self, peer):
        entry = self.entries.get(_ref(peer.generation))
        if entry is None or entry[1] != peer or not _pidfd_live(entry[0]):
            raise WatchdogError("IDENTITY_CHANGED")
        if _generation(peer.generation["pid"]) != peer.generation:
            raise WatchdogError("IDENTITY_CHANGED")

    def close(self):
        for fd, _peer in self.entries.values():
            os.close(fd)
        self.entries.clear()
        for fd, _generation_record in self.children.values():
            os.close(fd)
        self.children.clear()


class NativeKeeperAuthenticator:
    """Kernel identity plus same staged executable; claimed HELLO is compared."""
    fixture_only = False

    def __init__(self, registry, distribution):
        _linux_only()
        self.registry, self.distribution = registry, distribution
        self.watchdog_generation = _generation(os.getpid())
        self.bindings = {}

    def __call__(self, peer, hello, candidate, payload, spec, deadline_us):
        self.registry.verify_live(peer)
        pid = peer.generation["pid"]
        c = _credentials(pid)
        if (pid != candidate["main_pid"] or hello["pid"] != pid
                or hello["start_ticks"] != peer.generation["start_ticks"]
                or peer.uid != spec.load_uid or peer.gid != spec.load_gid
                or c["uids"] != (spec.load_uid,) * 4 or c["gids"] != (spec.load_gid,) * 4
                or c["groups"] != tuple(spec.load_groups) or not c["no_new_privs"]
                or any(c[key] != 0 for key in ("cap_eff", "cap_perm", "cap_inh", "cap_amb"))
                or hello["uid"] != spec.load_uid or hello["gid"] != spec.load_gid
                or tuple(hello["groups"]) != c["groups"] or hello["no_new_privs"] is not True
                or any(_u64(hello[key]) != c[key] for key in ("cap_eff", "cap_perm", "cap_inh", "cap_amb"))
                or hello["exe_sha256"] != payload["sha256"]
                or peer.generation["mount_namespace_ref"] != payload["mount_namespace_ref"]):
            raise WatchdogError("AUTHENTICATION")
        self.distribution.verify(payload, deadline_us)
        executable = os.stat("/proc/" + str(pid) + "/exe")
        if (executable.st_dev != _u64(payload["dev"]) or executable.st_ino != _u64(payload["inode"])
                or not stat.S_ISREG(executable.st_mode)):
            raise WatchdogError("IDENTITY_CHANGED")
        _verify_membership(pid, candidate["control_group"])
        self.registry.verify_live(peer)
        executable_after = os.stat("/proc/" + str(pid) + "/exe")
        if ((executable_after.st_dev, executable_after.st_ino) != (executable.st_dev, executable.st_ino)
                or _credentials(pid) != c):
            raise WatchdogError("IDENTITY_CHANGED")
        self.bindings[_ref(peer.generation)] = (peer, payload, spec)
        return peer.generation

    def verify_spawn(self, child_generation, keeper_generation, unit, deadline_us):
        """Pin a published, ACK-blocked direct child of the authenticated keeper.

        The immutable keeper protocol retains the child (including zombies) and
        forbids its reap before the ACK. The kernel checks here bind that claim
        to the actual generation/parent/executable/membership before recording.
        No PID or descriptor received over IPC is used as a signal target.
        """
        contracts.validate_process_generation(child_generation)
        binding = self.bindings.get(_ref(keeper_generation))
        if binding is None or unit["keeper_generation_ref"] != _ref(keeper_generation):
            raise WatchdogError("AUTHENTICATION")
        peer, payload, spec = binding
        self.registry.verify_live(peer)
        ref = _ref(child_generation)
        pid = child_generation["pid"]
        if (ref in self.registry.children or len(self.registry.children) >= 21
                or pid <= 1 or pid == keeper_generation["pid"]
                or any(child_generation[key] != keeper_generation[key] for key in
                       ("boot_id", "pid_namespace_ref", "mount_namespace_ref"))):
            raise WatchdogError("AUTHENTICATION")
        before = _generation(pid)
        if before != child_generation or _parent_pid(pid) != keeper_generation["pid"]:
            raise WatchdogError("IDENTITY_CHANGED")
        fd = os.pidfd_open(pid, 0)
        try:
            os.set_inheritable(fd, False)
            info = _read_bounded("/proc/self/fdinfo/" + str(fd))
            if [line.partition(":")[2].strip() for line in info.split("\n")
                    if line.startswith("Pid:")] != [str(pid)] or not _pidfd_live(fd):
                raise WatchdogError("AUTHENTICATION")
            credentials = _credentials(pid)
            if (credentials["uids"] != (spec.load_uid,) * 4
                    or credentials["gids"] != (spec.load_gid,) * 4
                    or credentials["groups"] != tuple(spec.load_groups)
                    or not credentials["no_new_privs"]
                    or any(credentials[key] != 0 for key in ("cap_eff", "cap_perm", "cap_inh", "cap_amb"))):
                raise WatchdogError("AUTHENTICATION")
            self.distribution.verify(payload, deadline_us)
            executable = os.stat("/proc/" + str(pid) + "/exe")
            if (not stat.S_ISREG(executable.st_mode) or executable.st_dev != _u64(payload["dev"])
                    or executable.st_ino != _u64(payload["inode"])):
                raise WatchdogError("IDENTITY_CHANGED")
            _verify_membership(pid, unit["control_group"])
            if (_generation(pid) != before or _parent_pid(pid) != keeper_generation["pid"]
                    or not _pidfd_live(fd)):
                raise WatchdogError("IDENTITY_CHANGED")
            executable_after = os.stat("/proc/" + str(pid) + "/exe")
            _verify_membership(pid, unit["control_group"])
            if ((executable_after.st_dev, executable_after.st_ino) != (executable.st_dev, executable.st_ino)
                    or _credentials(pid) != credentials or _generation(pid) != before):
                raise WatchdogError("IDENTITY_CHANGED")
            self.registry.verify_live(peer)
            if time.monotonic_ns() // 1000 >= deadline_us:
                raise WatchdogError("DEADLINE")
            self.registry.children[ref] = (fd, _plain(child_generation))
        except Exception:
            os.close(fd)
            raise
        return _plain(child_generation)


def _recv_packet(connection):
    data, ancillary, flags, _address = connection.recvmsg(MAX_PACKET + 1, 1)
    if ancillary or flags & (socket.MSG_TRUNC | socket.MSG_CTRUNC) or len(data) > MAX_PACKET:
        raise WatchdogError("PROTOCOL")
    if not data:
        raise WatchdogError("PEER_CLOSED")
    return contracts.decode_packet(data)


def serve(control_socket, run_spec, *, backend, distribution, observer,
          coordinator_generation, coordinator_pidfd, keeper_listener=None,
          keeper_listener_path=None, result_sink=None, keeper_authenticator=None):
    """Linux dispatcher. A dead coordinator or failed send never gates cleanup.

    The launcher supplies an already-owned pidfd and protected bound listener.
    This function never creates a fourth service or moves its own cgroup. Socket
    permissions and staging-parent ownership belong to the reviewed distribution
    factory; no arbitrary pathname listener is constructed here.
    """
    _linux_only()
    if (type(coordinator_pidfd) is not int or coordinator_pidfd < 0
            or keeper_listener is None or not callable(result_sink)):
        raise WatchdogError("DEPENDENCY_MISSING")
    spec = run_spec if isinstance(run_spec, contracts.RunSpec) else contracts.RunSpec.from_mapping(run_spec)
    expected_path = "/run/elogistix-memory-" + spec.run + "/watchdog.sock"
    if keeper_listener_path != expected_path or keeper_listener.getsockname() != expected_path:
        raise WatchdogError("AUTHENTICATION")
    if (control_socket.family != socket.AF_UNIX or control_socket.type & 0xf != socket.SOCK_SEQPACKET
            or keeper_listener.family != socket.AF_UNIX or keeper_listener.type & 0xf != socket.SOCK_SEQPACKET):
        raise WatchdogError("PROTOCOL")
    pid, _uid, _gid = struct.unpack("3i", control_socket.getsockopt(socket.SOL_SOCKET, socket.SO_PEERCRED, 12))
    if pid != coordinator_generation["pid"] or _generation(pid) != coordinator_generation:
        raise WatchdogError("AUTHENTICATION")
    fdinfo = _read_bounded("/proc/self/fdinfo/" + str(coordinator_pidfd))
    fdinfo_pids = [line.partition(":")[2].strip() for line in fdinfo.split("\n") if line.startswith("Pid:")]
    if fdinfo_pids != [str(pid)] or not _pidfd_live(coordinator_pidfd):
        raise WatchdogError("AUTHENTICATION")
    peers = NativePeerRegistry()
    authenticator = keeper_authenticator or NativeKeeperAuthenticator(peers, distribution)
    ready_listener = lambda _payload, _deadline: True
    watchdog = Watchdog(spec, backend, distribution, observer, coordinator_generation=coordinator_generation,
                        coordinator_liveness=lambda: _pidfd_live(coordinator_pidfd),
                        keeper_authenticator=authenticator, listener_factory=ready_listener, result_sink=result_sink)
    selector = selectors.DefaultSelector()
    channels = {"coordinator": control_socket}
    accepted = {}
    control_socket.setblocking(False)
    keeper_listener.setblocking(False)
    selector.register(control_socket, selectors.EVENT_READ, "coordinator")
    selector.register(keeper_listener, selectors.EVENT_READ, "listener")
    selector.register(coordinator_pidfd, selectors.EVENT_READ, "coordinator_pidfd")

    def send_events(channel, events):
        connection = channels.get(channel)
        if connection is None:
            if events:
                watchdog.delivery_failed(channel)
            return
        for event in events:
            try:
                packet = contracts.encode_packet(event)
                if connection.send(packet) != len(packet):
                    raise WatchdogError("PEER_CLOSED")
            except (OSError, WatchdogError):
                watchdog.delivery_failed(channel)
                try:
                    selector.unregister(connection)
                except KeyError:
                    pass
                channels.pop(channel, None)
                connection.close()
                return

    try:
        while watchdog.state != "FINAL":
            send_events("coordinator", watchdog.tick())
            for channel in tuple(watchdog.outboxes):
                send_events(channel, watchdog.drain(channel))
            remaining = max(0, spec.cleanup_deadline_us - time.monotonic_ns() // 1000)
            for key, _mask in selector.select(min(0.05, remaining / 1000000)):
                channel = key.data
                if channel == "coordinator_pidfd":
                    watchdog.coordinator_dead()
                    selector.unregister(coordinator_pidfd)
                    continue
                if channel == "listener":
                    connection, _address = keeper_listener.accept()
                    connection.setblocking(False)
                    try:
                        peer = peers.accept(connection)
                    except Exception:
                        connection.close()
                        watchdog._fault("AUTHENTICATION")
                        continue
                    # At most three peers: original peer/slot association is
                    # established only after decoding its first HELLO.
                    if len(accepted) >= 3:
                        connection.close()
                        watchdog._fault("AUTHENTICATION")
                        continue
                    token = "pending:" + str(connection.fileno())
                    accepted[token] = (connection, peer)
                    selector.register(connection, selectors.EVENT_READ, token)
                    continue
                connection = key.fileobj
                try:
                    packet = _recv_packet(connection)
                    if channel == "coordinator":
                        if packet.sender != "COORDINATOR":
                            raise WatchdogError("AUTHENTICATION")
                        send_events(channel, watchdog.handle_packet(packet))
                    else:
                        peer = accepted[channel][1]
                        if packet.sender != "KEEPER":
                            raise WatchdogError("AUTHENTICATION")
                        target = "keeper:" + str(packet.slot)
                        if channel.startswith("pending:"):
                            if packet.event != "KEEPER_HELLO" or target in channels:
                                raise WatchdogError("AUTHENTICATION")
                            channels[target] = connection
                            selector.modify(connection, selectors.EVENT_READ, target)
                            accepted[target] = accepted.pop(channel)
                            channel = target
                        elif target != channel:
                            raise WatchdogError("AUTHENTICATION")
                        peers.verify_live(peer)
                        send_events(channel, watchdog.handle_packet(packet, peer))
                except (OSError, WatchdogError, contracts.ContractError):
                    try:
                        selector.unregister(connection)
                    except KeyError:
                        pass
                    channels.pop(channel, None)
                    connection.close()
                    if channel == "coordinator":
                        watchdog.begin_cleanup("FAULT")
                    elif channel.startswith("keeper:"):
                        watchdog._fault("PEER_CLOSED", int(channel.split(":", 1)[1]))
                    else:
                        watchdog._fault("AUTHENTICATION")
        send_events("coordinator", watchdog.drain())
        return watchdog.export_evidence()
    finally:
        selector.close()
        for connection in set(channels.values()) | {c for c, _p in accepted.values()}:
            connection.close()
        peers.close()
