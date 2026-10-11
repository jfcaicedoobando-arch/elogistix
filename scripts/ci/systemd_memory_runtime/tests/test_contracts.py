"""Hermetic V3 contract boundaries: no Linux, sockets, manager or workload I/O."""
import copy
from dataclasses import FrozenInstanceError
import hashlib
import json
from pathlib import Path
import sys
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
from systemd_memory_runtime import contracts as c

RUN = "1" * 32
SHA = "a" * 64
BOOT = "12345678-1234-1234-1234-123456789abc"


def spec_mapping():
    scenarios = ("OVERLAP", "LEADER_EXIT_THREAD_SURVIVES", "DESCENDANT_IGNORES_TERM")
    return {"run": RUN, "t0_us": "1000000", "work_deadline_us": "51000000", "cleanup_deadline_us": "61000000", "slots": [{"slot": i, "unit_name": "elogistix-memory-adapter-" + str(i + 2) * 32 + ".service", "scenario": scenarios[i], "memory_max_bytes": c.MEMORY_MAX_BYTES, "tasks_max": 8} for i in range(3)], "load_uid": 1001, "load_gid": 1001, "load_groups": [1001], "payload_expected_sha256": SHA, "cleanup_policy_id": "physical-cleanup-union-v1", "scope_ref": "authorized-experiment:v3-fixture"}


def process(pid=101, tick="123"):
    return {"pid": pid, "start_ticks": tick, "boot_id": BOOT, "pid_namespace_ref": "pid:[4026531836]", "mount_namespace_ref": "mnt:[4026531841]"}


def unit(candidate=False):
    r = {"slot": 0, "name": spec_mapping()["slots"][0]["unit_name"], "object_path": "/org/freedesktop/systemd1/unit/elogistix_2dmemory_2dadapter_2d" + "2" * 32 + "_2eservice", "invocation_id": "5" * 32, "manager_binding_ref": SHA, "control_group": "/system.slice/" + spec_mapping()["slots"][0]["unit_name"], "control_group_id": "456"}
    r["main_pid" if candidate else "keeper_generation_ref"] = 101 if candidate else SHA
    return r


def physical():
    u = unit()
    return {"run": RUN, "slot": 0, "boot_id": BOOT, "manager_owner": ":1.2", "bus_guid": "b" * 32, "unit_name": u["name"], "invocation_id": u["invocation_id"], "control_group": u["control_group"], "control_group_id": u["control_group_id"], "unit_binding_ref": SHA, "physical_ref": "observer:leaf:1", "mount_namespace_ref": "mnt:[4026531841]", "mount_id": "29", "fs_type": "cgroup2", "dev": "31", "inode": "999", "parent_ref": "observer:parent:1", "leaf_basename": u["name"]}


def payload():
    return {"kind": "VERIFIED_STAGED_ELF", "sha256": SHA, "absolute_path": "/run/elogistix-memory-" + RUN + "/keeper", "dev": "31", "inode": "200", "mount_namespace_ref": "mnt:[4026531841]", "owner_uid": 0, "protected_ancestor_refs": ["distribution:parent:1"], "exec_identity_proof_ref": "PENDING_BEFORE_EXEC"}


def manager():
    return {"boot_id": BOOT, "bus_guid": "b" * 32, "owner_unique_name": ":1.2", "manager_pid_generation": process(1), "authority_lease_until_us": "61000000"}


def present():
    return {"tag": "PresentEmpty", "populated": 0, "read_before_us": "59000000", "read_after_us": "59000001", "original_identity_before_ref": SHA, "original_identity_after_ref": SHA, "direct_events_read_ref": SHA}


def absent():
    return {"tag": "OriginalAbsent", "populated": None, "parent_original_identity_before_ref": SHA, "parent_original_identity_after_ref": SHA, "leaf_basename": unit()["name"], "openat_errno": "ENOENT", "probe_ref": SHA}


def unavailable(reason="PARENT_GONE"):
    return {"tag": "Unavailable", "populated": None, "reason": reason, "observation_ref": SHA}


def cleanup(fact=None):
    return {"slot": 0, "original_unit_binding_ref": SHA, "original_physical_binding_ref": SHA, "start_settlement_ref": SHA, "stop_settlement_ref": SHA, "reap_ledger_ref": SHA, "final_unit_observation_ref": SHA, "observed_us": "59000002", "lease_until_us": "61000000", "physical": fact or present(), "identity_brackets_ref": SHA, "missing_evidence": []}


def waitpid():
    return {"tag": "WAITPID_CONSUMED", "child_generation": process(102, "124"), "reaper_generation": process(), "before_us": "2000000", "after_us": "2000001", "requested_pid": 102, "options": "WNOHANG", "returned_pid": 102, "raw_wait_status": 0}


def waitid():
    r = {"tag": "WAITID_CONSUMED", "child_generation": process(102, "124"), "reaper_generation": process(), "before_us": "2000000", "after_us": "2000001", "idtype": "P_PID", "target_ref": c.digest_record(process(102, "124")), "options": "WEXITED_WNOHANG", "return_code": 0, "si_pid": 102, "si_code": "CLD_EXITED", "si_status": 0}
    return r


def join():
    return {"tag": "PTHREAD_JOINED", "owner_process_generation_ref": SHA, "thread_creation_record_ref": SHA, "joined_thread_ref": "b" * 64, "joining_thread_ref": "c" * 64, "return_code": 0, "outcome": "RETURNED", "before_us": "2000000", "after_us": "2000001"}


def thread_created():
    return {"owner_process_generation_ref": SHA, "thread_creation_record_ref": SHA, "thread_ref": "b" * 64, "creating_thread_ref": "c" * 64, "before_us": "1500000", "after_us": "1500001"}


def directory(parent=False):
    p = physical()
    return {"boot_id": p["boot_id"], "mount_namespace_ref": p["mount_namespace_ref"], "mount_id": p["mount_id"], "fs_type": "cgroup2", "dev": p["dev"], "inode": "998" if parent else p["inode"], "cgroup_path": "/system.slice" if parent else p["control_group"]}


def binding_proof():
    return {"physical_binding_ref": c.digest_record(physical()), "original_leaf_identity": directory(), "original_parent_identity": directory(True), "before_us": "1500000", "after_us": "1500001"}


def closure_proof(is_absent=False):
    identity = directory(is_absent)
    operation = {"kind": "OPENAT_ORIGINAL_ABSENT" if is_absent else "DIRECT_EVENTS_EMPTY", "before_us": "59000000", "after_us": "59000001"}
    if is_absent:
        operation.update(parent_identity_ref=c.digest_record(identity), leaf_basename=unit()["name"], errno="ENOENT")
    else:
        operation.update(leaf_identity_ref=c.digest_record(identity), populated=0)
    return {"physical_binding_ref": c.digest_record(physical()), "original_identity": identity, "before_identity": copy.deepcopy(identity), "after_identity": copy.deepcopy(identity), "operation": operation}


def closure_evidence(is_absent=False):
    proof = closure_proof(is_absent)
    identity_ref = c.digest_record(proof["original_identity"])
    op = proof["operation"]
    fact = absent() if is_absent else present()
    if is_absent:
        fact.update(parent_original_identity_before_ref=identity_ref, parent_original_identity_after_ref=identity_ref, probe_ref=c.digest_record(op))
    else:
        fact.update(original_identity_before_ref=identity_ref, original_identity_after_ref=identity_ref, direct_events_read_ref=c.digest_record(op))
    evidence = cleanup(fact)
    evidence.update(original_physical_binding_ref=proof["physical_binding_ref"], identity_brackets_ref=c.digest_record(proof))
    return evidence


def main_exit():
    return {"tag": "SYSTEMD_MAIN_EXIT", "original_process_generation": process(), "invocation_id": "5" * 32, "exec_main_pid": 101, "exec_main_code": "CLD_EXITED", "exec_main_status": 0, "start_timestamp_us": "1500000", "exit_timestamp_us": "2000000", "before_us": "2000000", "after_us": "2000001"}


def release():
    return {"tag": "PIDFD_TASK_RELEASED", "original_process_generation": process(), "pidfd_identity_ref": "watchdog:pidfd:1", "procfs_namespace_ref": "pid:[4026531836]", "fdinfo_pid": -1, "retained_original": True, "not_closed_or_reused": True, "before_us": "2000000", "after_us": "2000001"}


def envelope(event="ARM", body=None, sender=None, slot=None, request=None):
    if body is None:
        body = {"run_spec": spec_mapping(), "payload_expected_sha256": SHA}
    return {"v": 3, "run": RUN, "sender": sender or c.EVENT_SENDERS[event] or "KEEPER", "seq": 1, "slot": slot, "event": event, "request": request, "mono_us": "1000000", "body": body}


class ContractTests(unittest.TestCase):
    def reject(self, fn, value):
        with self.assertRaises(c.ContractError):
            fn(value)

    def test_u64_extremes_and_noncanonical_forms(self):
        self.assertEqual(c.parse_u64("0"), 0)
        self.assertEqual(c.parse_u64(str(c.U64_MAX)), c.U64_MAX)
        for value in (0, True, None, "", "00", "01", "-1", "+1", " 1", "1 ", "1.0", "1e3", "NaN", "١", str(c.U64_MAX + 1), "9" * 100):
            with self.subTest(value=value):
                self.reject(c.parse_u64, value)

    def test_spec_roundtrip_immutable_normalized_and_isolated(self):
        raw = spec_mapping()
        raw["slots"].reverse()
        spec = c.RunSpec.from_mapping(raw)
        self.assertEqual([s.slot for s in spec.slots], [0, 1, 2])
        self.assertEqual(spec.to_mapping(), spec_mapping())
        raw["slots"][0]["unit_name"] = "changed"
        self.assertEqual(spec.slots[2].unit_name, spec_mapping()["slots"][2]["unit_name"])
        with self.assertRaises(FrozenInstanceError):
            spec.t0_us = 9

    def test_spec_rejects_extended_deadlines_duplicate_slots_and_limits(self):
        mutations = [("work_deadline_us", "51000001"), ("cleanup_deadline_us", "61000001"), ("t0_us", 1000000), ("load_uid", 0), ("load_uid", True), ("load_groups", [1001, 1001]), ("load_groups", [1002, 1001]), ("cleanup_policy_id", "unchecked"), ("extra", 1)]
        for key, value in mutations:
            raw = spec_mapping()
            raw[key] = value
            with self.subTest(key=key):
                self.reject(c.RunSpec.from_mapping, raw)
        for key, value in (("slot", 0), ("unit_name", spec_mapping()["slots"][0]["unit_name"]), ("memory_max_bytes", c.MEMORY_MAX_BYTES + 1), ("tasks_max", 9), ("scenario", "shell")):
            raw = spec_mapping()
            raw["slots"][1][key] = value
            with self.subTest(slotkey=key):
                self.reject(c.RunSpec.from_mapping, raw)
        raw = spec_mapping()
        raw["slots"].append(raw["slots"][0])
        self.reject(c.RunSpec.from_mapping, raw)

    def test_fixed_three_slot_quota_rejects_previous_and_neighboring_limits(self):
        spec = c.RunSpec.from_mapping(spec_mapping())
        self.assertEqual(c.MEMORY_MAX_BYTES, 33_554_432)
        self.assertEqual(len(spec.slots), 3)
        self.assertEqual([slot.memory_max_bytes for slot in spec.slots], [33_554_432] * 3)
        self.assertEqual([slot.tasks_max for slot in spec.slots], [8] * 3)
        self.assertEqual(sum(slot.memory_max_bytes for slot in spec.slots), 100_663_296)
        self.assertEqual(sum(slot.tasks_max for slot in spec.slots), 24)
        for mib in (80, 64, 31, 33):
            raw = spec_mapping()
            raw["slots"][0]["memory_max_bytes"] = mib * 1_048_576
            with self.subTest(memory_mib=mib):
                self.reject(c.RunSpec.from_mapping, raw)
        for tasks in (0, 9):
            raw = spec_mapping()
            raw["slots"][0]["tasks_max"] = tasks
            with self.subTest(tasks=tasks):
                self.reject(c.RunSpec.from_mapping, raw)

    def test_original_origin_overflow_rejected(self):
        raw = spec_mapping()
        raw["t0_us"] = str(c.U64_MAX - 1)
        raw["work_deadline_us"] = str(c.U64_MAX)
        raw["cleanup_deadline_us"] = str(c.U64_MAX)
        self.reject(c.RunSpec.from_mapping, raw)

    def test_timeout_budget_exact_boundaries_and_lease(self):
        spec = c.RunSpec.from_mapping(spec_mapping())
        self.assertEqual(c.operation_budget_us(spec, 1_000_000, 61_000_000), 1_000_000)
        self.assertEqual(c.operation_budget_us(spec, 50_000_001, 51_000_001, work=True), 999_999)
        self.assertEqual(c.operation_budget_us(spec, 60_999_999, 61_000_000), 1)
        for now, lease, work in ((999999, 61000000, False), (51000000, 61000000, True), (61000000, 62000000, False), (1000000, 1000000, False)):
            with self.subTest(now=now, lease=lease):
                with self.assertRaises(c.ContractError):
                    c.operation_budget_us(spec, now, lease, work=work)
        self.assertEqual(c.runtime_max_us(spec, 1_000_000), 40_000_000)
        self.assertEqual(c.runtime_max_us(spec, 45_499_999), 1)
        for now in (45_500_000, 51_000_000, 61_000_000):
            with self.assertRaises(c.ContractError):
                c.runtime_max_us(spec, now)

    def test_process_wire_has_no_fd_authority(self):
        self.assertEqual(c.validate_process_generation(process()), process())
        for key, value in (("pidfd_ref", "local:pidfd:1"), ("pid", 0), ("pid", False), ("start_ticks", "0"), ("start_ticks", 123), ("boot_id", "unknown"), ("pid_namespace_ref", "\ud800")):
            raw = process()
            raw[key] = value
            with self.subTest(key=key):
                self.reject(c.validate_process_generation, raw)

    def test_candidate_has_real_pid_and_bound_requires_real_generation_ref(self):
        self.assertEqual(c.validate_unit_candidate(unit(True)), unit(True))
        self.assertEqual(c.validate_unit_binding(unit()), unit())
        self.reject(c.validate_unit_binding, unit(True))
        raw = unit()
        raw["keeper_generation_ref"] = "PENDING"
        self.reject(c.validate_unit_binding, raw)
        raw = unit(True)
        raw["main_pid"] = 0
        self.reject(c.validate_unit_candidate, raw)

    def test_local_physical_tokens_are_not_raw_fd_numbers(self):
        self.assertEqual(c.validate_physical_binding(physical()), physical())
        for value in (3, "3", True, "../../fd/3"):
            raw = physical()
            raw["physical_ref"] = value
            with self.subTest(value=value):
                self.reject(c.validate_physical_binding, raw)
        raw = physical()
        raw["inode"] = "456"
        self.assertEqual(c.validate_physical_binding(raw)["control_group_id"], "456")
        # ControlGroupId is not inferred from inode; each is independently bound.
        raw["inode"] = "999"
        self.assertNotEqual(c.validate_physical_binding(raw)["inode"], raw["control_group_id"])

    def test_payload_uses_new_staging_abi_only(self):
        self.assertEqual(c.validate_payload_binding(payload()), payload())
        for key, value in (("kind", "SEALED_MEMFD"), ("absolute_path", "/opt/keeper"), ("absolute_path", "/run/elogistix-memory-" + RUN + "/../keeper"), ("protected_ancestor_refs", []), ("protected_ancestor_refs", [3]), ("exec_identity_proof_ref", None)):
            raw = payload()
            raw[key] = value
            with self.subTest(key=key):
                self.reject(c.validate_payload_binding, raw)

    def test_cleanup_union_never_fabricates_unknown_population(self):
        for fact, expected in ((present(), "CLOSED_EMPTY"), (absent(), "CLOSED_REMOVED"), (unavailable(), "UNKNOWN")):
            self.assertEqual(c.physical_leaf_status(fact), expected)
            self.assertEqual(c.validate_cleanup_evidence(cleanup(fact))["physical"], fact)
        for fact in (absent(), unavailable()):
            for populated in (0, False, "0"):
                raw = copy.deepcopy(fact)
                raw["populated"] = populated
                self.reject(c.validate_cleanup_physical, raw)
        for populated in (None, False, 1, "0"):
            raw = present()
            raw["populated"] = populated
            self.reject(c.validate_cleanup_physical, raw)

    def test_absence_requires_exact_leaf_under_original_parent_refs(self):
        for key, value in (("openat_errno", "EACCES"), ("leaf_basename", "../leaf"), ("parent_original_identity_before_ref", None), ("parent_original_identity_after_ref", 3), ("memory_peak_missing", True)):
            raw = absent()
            raw[key] = value
            with self.subTest(key=key):
                self.reject(c.validate_cleanup_physical, raw)
        for reason in c.UNAVAILABLE_REASONS:
            self.assertEqual(c.physical_leaf_status(unavailable(reason)), "UNKNOWN")

    def test_cleanup_brackets_deadline_missing_receipts_and_closed_codes(self):
        for key, value in (("reap_ledger_ref", None), ("stop_settlement_ref", None), ("final_unit_observation_ref", None), ("lease_until_us", "59000002"), ("observed_us", "59000000"), ("missing_evidence", ["guessed"]), ("missing_evidence", ["KEEPER_REAP", "KEEPER_REAP"])):
            raw = cleanup()
            raw[key] = value
            with self.subTest(key=key):
                self.reject(c.validate_cleanup_evidence, raw)
        raw = cleanup(absent())
        raw["missing_evidence"] = ["REAP_LEDGER"]
        self.assertEqual(c.validate_cleanup_evidence(raw)["missing_evidence"], ["REAP_LEDGER"])
        self.assertEqual(c.physical_leaf_status(raw["physical"]), "CLOSED_REMOVED")
        # This shape is only a recorded fact; it does not establish final cleanup.
        self.assertEqual(c.MEMORY_RECLAMATION, "NOT_ESTABLISHED")

    def test_waitpid_consumed_exit_and_signals(self):
        for status in (0, 1 << 8, 255 << 8, 9, 9 | 128, 64):
            raw = waitpid()
            raw["raw_wait_status"] = status
            self.assertEqual(c.validate_reap_receipt(raw), raw)
        for key, value in (("returned_pid", 0), ("returned_pid", 103), ("requested_pid", 103), ("options", "WNOHANG_WNOWAIT"), ("raw_wait_status", 127), ("raw_wait_status", 128), ("raw_wait_status", 0xffff), ("raw_wait_status", True), ("after_us", "1999999")):
            raw = waitpid()
            raw[key] = value
            with self.subTest(key=key):
                self.reject(c.validate_reap_receipt, raw)

    def test_waitid_consumed_not_wnowait_or_zero_transition(self):
        self.assertEqual(c.validate_reap_receipt(waitid()), waitid())
        raw = waitid()
        raw["idtype"] = "P_PIDFD"
        raw["target_ref"] = "keeper:pidfd:102"
        self.assertEqual(c.validate_reap_receipt(raw), raw)
        for key, value in (("si_pid", 0), ("si_pid", 103), ("options", "WEXITED_WNOHANG_WNOWAIT"), ("return_code", 1), ("si_code", "CLD_STOPPED"), ("target_ref", "b" * 64), ("si_status", 256)):
            raw = waitid()
            raw[key] = value
            with self.subTest(key=key):
                self.reject(c.validate_reap_receipt, raw)
        raw = waitid()
        raw.update(idtype="P_PIDFD", target_ref=3)
        self.reject(c.validate_reap_receipt, raw)

    def test_join_receipt_separate_from_group_wait(self):
        self.assertEqual(c.validate_reap_receipt(join()), join())
        for key, value in (("joining_thread_ref", "b" * 64), ("joined_thread_ref", 123), ("return_code", 1), ("outcome", "UNKNOWN"), ("thread_creation_record_ref", None)):
            raw = join()
            raw[key] = value
            with self.subTest(key=key):
                self.reject(c.validate_reap_receipt, raw)

    def test_thread_creation_uses_closed_identity_tokens(self):
        self.assertEqual(c.validate_thread_created(thread_created()), thread_created())
        for key, value in (("thread_ref", 123), ("thread_ref", "c" * 64), ("thread_creation_record_ref", None), ("after_us", "1499999"), ("pthread_t", 123)):
            raw = thread_created()
            raw[key] = value
            with self.subTest(key=key):
                self.reject(c.validate_thread_created, raw)

    def test_initial_thread_registration_uses_existing_hello_and_spawned(self):
        generation = process()
        expected = c.digest_record({"generation": generation, "role": "INITIAL_THREAD"})
        self.assertEqual(c.initial_thread_token(generation), expected)
        spawned = {"child_generation": generation, "parent_generation_ref": SHA, "role": "LOAD", "spawn_record_ref": SHA}
        self.assertEqual(c.initial_thread_creation_ref("SPAWNED", spawned), c.digest_record(spawned))
        hello = {"pid": 101, "start_ticks": "123", "exe_sha256": SHA, "uid": 1001, "gid": 1001, "groups": [1001], "no_new_privs": True, "cap_eff": "0", "cap_perm": "0", "cap_inh": "0", "cap_amb": "0"}
        self.assertEqual(c.initial_thread_creation_ref("KEEPER_HELLO", hello), c.digest_record(hello))
        with self.assertRaises(c.ContractError):
            c.initial_thread_creation_ref("THREAD_CREATED", thread_created())
        self.assertEqual(len(c.EVENTS), 19)

    def test_initial_thread_golden_bytes_hash_only_exact_body(self):
        canonical = b'{"generation":{"boot_id":"12345678-1234-1234-1234-123456789abc","mount_namespace_ref":"mnt:[4026531841]","pid":101,"pid_namespace_ref":"pid:[4026531836]","start_ticks":"123"},"role":"INITIAL_THREAD"}'
        self.assertEqual(hashlib.sha256(canonical).hexdigest(), "685157cea948e33087f4a5b7d060aed56225737a0aa1fdddfd4e027ddf950eaa")
        self.assertEqual(c.initial_thread_token(process()), "685157cea948e33087f4a5b7d060aed56225737a0aa1fdddfd4e027ddf950eaa")
        hello = {"pid": 101, "start_ticks": "123", "exe_sha256": SHA, "uid": 1001, "gid": 1001, "groups": [1001], "no_new_privs": True, "cap_eff": "0", "cap_perm": "0", "cap_inh": "0", "cap_amb": "0"}
        self.assertEqual(c.initial_thread_creation_ref("KEEPER_HELLO", hello), "44b5cef2c5e0a1cd1d8bf999a91046a3f0d278c8bca923850a775933779f9ac2")
        spawned = {"child_generation": process(102, "124"), "parent_generation_ref": SHA, "role": "LOAD", "spawn_record_ref": SHA}
        self.assertEqual(c.initial_thread_creation_ref("SPAWNED", spawned), "8a11c29d9b48a0f2931774b32c67061ae39fe2819b48b45501e8f6148b112868")
        for event, body in (("KEEPER_HELLO", hello), ("SPAWNED", spawned)):
            self.assertNotEqual(c.initial_thread_creation_ref(event, body), c.digest_record({"event": event, "body": body}))
            raw = dict(body, mono_us="1000000")
            with self.assertRaises(c.ContractError):
                c.initial_thread_creation_ref(event, raw)
        self.assertEqual(c.digest_record({"text": "é"}), hashlib.sha256('{"text":"é"}'.encode("utf-8")).hexdigest())

    def test_join_accepts_registered_initial_thread_creation_ref(self):
        child = process(102, "124")
        spawned = {"child_generation": child, "parent_generation_ref": SHA, "role": "LOAD", "spawn_record_ref": SHA}
        receipt = join()
        receipt.update(owner_process_generation_ref=c.digest_record(child), thread_creation_record_ref=c.initial_thread_creation_ref("SPAWNED", spawned), joined_thread_ref=c.initial_thread_token(child))
        self.assertEqual(c.validate_reap_receipt(receipt), receipt)
        # Shape permits this real initial antecedent. Authentication, matching
        # existing registry and same-process join producer remain watchdog duties.
        self.assertEqual(c.decode_packet(c.encode_packet(envelope("REAPED", {"receipt": receipt}, slot=0))).body["receipt"]["thread_creation_record_ref"], c.digest_record(spawned))

    def test_directory_identity_is_full_and_closed_not_a_label_hash(self):
        self.assertEqual(c.validate_directory_identity(directory()), directory())
        raw = directory(True)
        raw["cgroup_path"] = "/"
        self.assertEqual(c.validate_directory_identity(raw)["cgroup_path"], "/")
        raw["dev"] = "0"
        self.assertEqual(c.validate_directory_identity(raw)["dev"], "0")
        for key, value in (("mount_id", "0"), ("inode", "0"), ("inode", 999), ("dev", True), ("cgroup_path", "/system.slice/../leaf"), ("fs_type", "tmpfs"), ("label_ref", SHA)):
            raw = directory()
            raw[key] = value
            with self.subTest(key=key):
                self.reject(c.validate_directory_identity, raw)

    def test_observer_root_binding_requires_full_original_root_identity(self):
        identity = directory(True)
        identity["cgroup_path"] = "/"
        root = {"run": RUN, "original_root_identity": identity, "before_us": "1000000", "after_us": "1000001"}
        self.assertEqual(c.validate_observer_root_binding(root), root)
        self.assertEqual(c.ObserverRootBinding.from_mapping(root).to_mapping(), root)
        for key, value in (("original_root_identity", SHA), ("after_us", "999999"), ("pidfd", 3)):
            raw = copy.deepcopy(root)
            raw[key] = value
            with self.subTest(key=key):
                self.reject(c.validate_observer_root_binding, raw)
        raw = copy.deepcopy(root)
        raw["original_root_identity"]["cgroup_path"] = "/system.slice"
        self.reject(c.validate_observer_root_binding, raw)

    def test_cleanup_proof_unavailable_is_typed_failure_without_identity(self):
        proof = {"tag": "Unavailable", "physical_binding_ref": c.digest_record(physical()), "reason": "IO", "observation_ref": SHA}
        evidence = cleanup(unavailable("IO"))
        evidence["original_physical_binding_ref"] = proof["physical_binding_ref"]
        evidence["identity_brackets_ref"] = c.digest_record(proof)
        self.assertEqual(c.validate_cleanup_proof(proof, binding_proof(), evidence, physical()), proof)
        self.assertEqual(c.ClosureUnavailable.from_mapping(proof).to_mapping(), proof)
        self.reject(c.validate_closure_proof, proof)
        bad_evidence = copy.deepcopy(evidence)
        bad_evidence["identity_brackets_ref"] = SHA
        with self.assertRaises(c.ContractError):
            c.validate_cleanup_proof(proof, binding_proof(), bad_evidence, physical())
        for key, value in (("original_identity", directory()), ("populated", 0), ("reason", "CLOSED_REMOVED"), ("physical_binding_ref", 3)):
            raw = copy.deepcopy(proof)
            raw[key] = value
            with self.subTest(key=key):
                self.reject(c.validate_cleanup_proof, raw)
        proof["reason"] = "TIMEOUT"
        with self.assertRaises(c.ContractError):
            c.validate_cleanup_proof(proof, binding_proof(), evidence, physical())
        self.assertEqual(c.validate_cleanup_proof(closure_proof(), binding_proof(), closure_evidence(), physical()), closure_proof())

    def test_binding_proof_matches_leaf_parent_and_physical_capture(self):
        proof = binding_proof()
        self.assertEqual(c.validate_binding_proof(proof, physical()), proof)
        for target, key, value in (("original_parent_identity", "cgroup_path", "/"), ("original_parent_identity", "mount_id", "30"), ("original_parent_identity", "mount_namespace_ref", "mnt:[different]"), ("original_leaf_identity", "inode", "998"), ("original_leaf_identity", "dev", "32")):
            raw = copy.deepcopy(proof)
            raw[target][key] = value
            with self.subTest(target=target, key=key):
                with self.assertRaises(c.ContractError):
                    c.validate_binding_proof(raw, physical())
        raw = copy.deepcopy(proof)
        raw["physical_binding_ref"] = SHA
        with self.assertRaises(c.ContractError):
            c.validate_binding_proof(raw, physical())

    def test_closure_identity_and_operation_hashes_are_full_and_correlated(self):
        for is_absent in (False, True):
            proof, evidence = closure_proof(is_absent), closure_evidence(is_absent)
            self.assertEqual(c.validate_closure_proof(proof, binding_proof(), evidence, physical()), proof)
            self.assertEqual(evidence["identity_brackets_ref"], c.digest_record(proof))
            self.assertEqual(c.physical_leaf_status(evidence["physical"]), "CLOSED_REMOVED" if is_absent else "CLOSED_EMPTY")

    def test_closure_cannot_adopt_changed_or_posthoc_foreign_identity(self):
        for change in ("inode", "mount_id", "mount_namespace_ref", "cgroup_path"):
            raw = closure_proof()
            raw["after_identity"][change] = "1000" if change in ("inode", "mount_id") else "/other"
            with self.subTest(change=change):
                self.reject(c.validate_closure_proof, raw)
        raw = closure_proof()
        for k in ("original_identity", "before_identity", "after_identity"):
            raw[k]["inode"] = "1000"
        raw["operation"]["leaf_identity_ref"] = c.digest_record(raw["original_identity"])
        with self.assertRaises(c.ContractError):
            c.validate_closure_proof(raw, binding_proof())

    def test_closure_operation_cannot_substitute_another_path_or_read(self):
        cases = ((False, "populated", False), (False, "leaf_identity_ref", SHA), (True, "errno", "EACCES"), (True, "leaf_basename", "memory.peak"), (True, "parent_identity_ref", SHA), (True, "after_us", "1500000"))
        for is_absent, key, value in cases:
            proof = closure_proof(is_absent)
            proof["operation"][key] = value
            with self.subTest(key=key):
                with self.assertRaises(c.ContractError):
                    c.validate_closure_proof(proof, binding_proof(), closure_evidence(is_absent), physical())

    def test_closure_evidence_refs_brackets_and_captured_origin_required(self):
        for is_absent in (False, True):
            for location, key, value in (("root", "identity_brackets_ref", SHA), ("root", "original_physical_binding_ref", SHA), ("root", "observed_us", "58999999"), ("fact", "probe_ref" if is_absent else "direct_events_read_ref", SHA)):
                evidence = closure_evidence(is_absent)
                if location == "root":
                    evidence[key] = value
                else:
                    evidence["physical"][key] = value
                with self.subTest(absent=is_absent, key=key):
                    with self.assertRaises(c.ContractError):
                        c.validate_closure_proof(closure_proof(is_absent), binding_proof(), evidence, physical())

    def test_manager_snapshot_then_fdinfo_after_unload_is_allowed_with_original_namespace(self):
        fact = release()
        fact.update(before_us="3000000", after_us="3000001")
        self.assertEqual(c.validate_main_release_facts(main_exit(), fact)["release"], fact)
        fact["procfs_namespace_ref"] = "pid:[other]"
        self.reject(c.validate_pidfd_task_released, fact)

    def test_observer_facts_are_watchdog_relays_not_observer_ipc(self):
        raw = envelope("CLEANUP_EVIDENCE", {"evidence": cleanup()}, slot=0)
        self.assertEqual(c.Envelope.from_mapping(raw).sender, "WATCHDOG")
        raw["sender"] = "OBSERVER"
        self.reject(c.Envelope.from_mapping, raw)
        raw = envelope("FAULT", {"code": "PHYSICAL_UNAVAILABLE", "at_event": "CLEANUP_EVIDENCE", "identity_ref": SHA, "missing_evidence": ["PHYSICAL_OBSERVATION"]}, sender="OBSERVER")
        self.reject(c.Envelope.from_mapping, raw)

    def test_legacy_wait_status_and_self_reap_rejected(self):
        self.reject(c.validate_reap_receipt, {"wait_api": "waitpid", "wait_status": 0})
        raw = waitpid()
        raw["reaper_generation"] = process(102, "124")
        self.reject(c.validate_reap_receipt, raw)
        raw = waitpid()
        raw["reaper_generation"]["boot_id"] = "b" * 8 + "-bbbb-bbbb-bbbb-" + "b" * 12
        self.reject(c.validate_reap_receipt, raw)

    def test_main_exit_and_retained_pidfd_release_are_distinct_facts(self):
        result = c.validate_main_release_facts(main_exit(), release())
        self.assertEqual(result["release"]["fdinfo_pid"], -1)
        for key, value in (("exec_main_pid", 0), ("exec_main_pid", 102), ("exec_main_code", "CLD_STOPPED"), ("start_timestamp_us", "0"), ("exit_timestamp_us", "0")):
            raw = main_exit()
            raw[key] = value
            with self.subTest(key=key):
                self.reject(c.validate_systemd_main_exit, raw)
        for key, value in (("fdinfo_pid", 0), ("fdinfo_pid", 101), ("retained_original", False), ("not_closed_or_reused", False), ("pidfd_identity_ref", 3), ("pollin", True)):
            raw = release()
            raw[key] = value
            with self.subTest(key=key):
                self.reject(c.validate_pidfd_task_released, raw)
        raw = release()
        raw["original_process_generation"]["start_ticks"] = "124"
        with self.assertRaises(c.ContractError):
            c.validate_main_release_facts(main_exit(), raw)

    def test_envelope_roundtrip_freezes_nested_records(self):
        raw = envelope()
        e = c.Envelope.from_mapping(raw)
        raw["body"]["run_spec"]["slots"][0]["unit_name"] = "changed"
        encoded = c.encode_packet(e)
        self.assertEqual(c.decode_packet(encoded).to_mapping(), envelope())
        with self.assertRaises(TypeError):
            e.body["run_spec"]["load_uid"] = 0

    def test_json_duplicate_keys_floats_nonfinite_and_bad_utf8_rejected(self):
        valid = c.encode_packet(envelope())
        for packet in (valid.replace(b'"v":3', b'"v":3,"v":3'), valid.replace(b'"load_uid":1001', b'"load_uid":1001,"load_uid":1001'), valid.replace(b'"seq":1', b'"seq":1.0'), valid.replace(b'"seq":1', b'"seq":NaN'), valid.replace(b'"seq":1', b'"seq":Infinity'), b"\xff", b"[]", b"null", b"", b" " * 16385):
            self.reject(c.decode_packet, packet)

    def test_json_depth_array_size_and_packet_boundary(self):
        self.reject(c.digest_record, [[[[[[[[1]]]]]]]])
        self.reject(c.digest_record, [0] * 33)
        raw = envelope()
        packet = c.encode_packet(raw)
        boundary = packet + b" " * (16384 - len(packet))
        self.assertEqual(c.decode_packet(boundary).event, "ARM")
        self.reject(c.decode_packet, boundary + b" ")

    def test_event_sender_slot_unknown_fields_and_ack_binding(self):
        for key, value in (("v", True), ("sender", "KEEPER"), ("slot", 0), ("event", "UNIT_CANDIDATE"), ("seq", 0), ("seq", True), ("request", 0), ("extra", 1), ("mono_us", 1000000)):
            raw = envelope()
            raw[key] = value
            with self.subTest(key=key):
                self.reject(c.Envelope.from_mapping, raw)
        raw = envelope()
        raw["body"]["extra"] = 1
        self.reject(c.Envelope.from_mapping, raw)
        ack = envelope("ACK", {"accepted_seq": 7, "ledger_record_sha256": SHA}, request=7)
        self.assertEqual(c.decode_packet(c.encode_packet(ack)).event, "ACK")
        ack["request"] = 8
        self.reject(c.Envelope.from_mapping, ack)

    def test_every_closed_event_body_can_roundtrip_without_authority(self):
        bodies = {
            "ARMED": {"watchdog_generation": process(), "manager_binding": manager(), "observer_root_binding": SHA, "payload_binding": payload(), "slots_ledger_ref": SHA, "work_deadline_us": "51000000", "cleanup_deadline_us": "61000000"},
            "RUN_SLOT": {"slot_spec_sha256": SHA},
            "START_DISPATCHED": {"slot_record_ref": SHA, "start_request_ref": SHA, "deadline_us": "3000000"},
            "UNIT_BOUND": {"unit_binding": unit(), "start_job_ref": SHA},
            "KEEPER_HELLO": {"pid": 101, "start_ticks": "123", "exe_sha256": SHA, "uid": 1001, "gid": 1001, "groups": [1001], "no_new_privs": True, "cap_eff": "0", "cap_perm": "0", "cap_inh": "0", "cap_amb": "0"},
            "LOAD_PERMIT": {"unit_binding_ref": SHA, "physical_binding_ref": SHA, "scenario": "OVERLAP", "work_deadline_us": "51000000", "cleanup_deadline_us": "61000000"},
            "SPAWNED": {"child_generation": process(102), "parent_generation_ref": SHA, "role": "LOAD", "spawn_record_ref": SHA},
            "THREAD_CREATED": thread_created(),
            "REAPED": {"receipt": waitpid()},
            "CHECKPOINT_READY": {"spawn_ledger_ref": SHA, "reap_ledger_ref": SHA, "keeper_generation_ref": SHA},
            "MEMORY_SAMPLE": {"sample": {"unit_binding_ref": SHA, "physical_binding_ref": SHA, "keeper_generation_ref": SHA, "ledger_checkpoint_ref": SHA, "metric": "memory.peak", "bytes": "0", "before_us": "2000000", "after_us": "2000001", "identity_before_ref": SHA, "identity_after_ref": SHA}},
            "BEGIN_CLEANUP": {"reason": "FAULT"},
            "QUIESCE": {"reason": "DEADLINE", "cleanup_deadline_us": "61000000"},
            "STOP_DISPATCHED": {"original_unit_binding_ref": SHA, "stop_request_ref": SHA, "deadline_us": "61000000"},
            "CLEANUP_EVIDENCE": {"evidence": cleanup()},
            "FINAL": {"status": "INCOMPLETE", "slots": [{"slot": i, "leaf_status": "UNKNOWN"} for i in range(3)], "metric_records_ref": SHA, "slot_ledger_ref": SHA, "cleanup_records_ref": SHA, "memory_reclamation": "NOT_ESTABLISHED", "missing_evidence": ["REAP_LEDGER"]},
            "FAULT": {"code": "REAP_POLICY_PENDING", "at_event": "REAPED", "identity_ref": SHA, "missing_evidence": ["KEEPER_REAP"]},
            "ACK": {"accepted_seq": 1, "ledger_record_sha256": SHA},
        }
        for event, body in bodies.items():
            with self.subTest(event=event):
                slot = None if event in c.RUN_LEVEL_EVENTS or event in ("FAULT", "ACK") else 0
                raw = envelope(event, body, slot=slot, request=1 if event == "ACK" else None)
                self.assertEqual(c.decode_packet(c.encode_packet(raw)).to_mapping(), raw)

    def test_final_cannot_hide_per_slot_unknown_or_removal_duty(self):
        body = {"status": "COMPLETE", "slots": [{"slot": i, "leaf_status": "CLOSED_REMOVED"} for i in range(3)], "metric_records_ref": SHA, "slot_ledger_ref": SHA, "cleanup_records_ref": SHA, "memory_reclamation": "NOT_ESTABLISHED", "missing_evidence": []}
        raw = envelope("FINAL", body)
        self.assertEqual(c.Envelope.from_mapping(raw).body["status"], "COMPLETE")
        for status in ("CLOSED_EMPTY", "UNKNOWN"):
            bad = copy.deepcopy(raw)
            bad["body"]["slots"][1]["leaf_status"] = status
            self.reject(c.Envelope.from_mapping, bad)
        for key, value in (("missing_evidence", ["REAP_LEDGER"]), ("memory_reclamation", "COMPLETE"), ("slots", [{"slot": 0, "leaf_status": "CLOSED_REMOVED"}])):
            bad = copy.deepcopy(raw)
            bad["body"][key] = value
            self.reject(c.Envelope.from_mapping, bad)

    def test_replayed_gap_sequences_do_not_advance_ledger(self):
        guard = c.SequenceGuard()
        guard.accept(1)
        for value in (1, 3, 0, True):
            self.reject(guard.accept, value)
            self.assertEqual(guard.last, 1)
        guard.accept(2)
        self.assertEqual(guard.last, 2)

    def test_digest_is_canonical_and_dataclass_records_frozen(self):
        first = {"a": "1", "b": [True, None]}
        second = {"b": [True, None], "a": "1"}
        expected = hashlib.sha256(b'{"a":"1","b":[true,null]}').hexdigest()
        self.assertEqual(c.digest_record(first), expected)
        self.assertEqual(c.digest_record(first), c.digest_record(second))
        raw = process()
        rec = c.ProcessGeneration.from_mapping(raw)
        raw["pid"] = 999
        self.assertEqual(rec.to_mapping()["pid"], 101)
        with self.assertRaises(TypeError):
            rec.values["pid"] = 999
        with self.assertRaises(FrozenInstanceError):
            rec.arbitrary_attribute = 999


if __name__ == "__main__":
    unittest.main()
