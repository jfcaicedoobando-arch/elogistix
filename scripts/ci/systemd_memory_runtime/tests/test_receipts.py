"""Synthetic certificate graphs and mocked retained descriptors, never runtime proof."""
from copy import deepcopy
from pathlib import Path
import json
import stat
import sys
from types import SimpleNamespace
import unittest
from unittest.mock import patch


TESTS = Path(__file__).resolve().parent
sys.path.insert(0, str(TESTS.parent.parent))
sys.path.insert(0, str(TESTS))
from systemd_memory_runtime import contracts as C
from systemd_memory_runtime import __main__ as M
import test_watchdog as W


class FakeStore:
    native_custody = False

    def __init__(self, record, clock, after_read=None):
        self.record, self.clock, self.after_read = deepcopy(record), clock, after_read
        self.reads = 0

    def read(self):
        self.reads += 1
        if self.after_read is not None:
            self.clock.now = self.after_read
        return deepcopy(self.record)


def reseal(record, *, outcome_overrides=None, omit_outcomes=(), repeat_outcomes=()):
    """Rehash altered facts so semantic failures cannot hide behind hash mismatch."""
    previous = C.digest_record({"run": record["run"], "origin": "1000000"})
    chain = []
    for slot in record["slots"]:
        receipts = slot["independent_receipts"]
        for receipt, key in (("start_receipt", "start_settlement_ref"), ("stop_receipt", "stop_settlement_ref"),
                             ("final_unit_receipt", "final_unit_receipt_ref"), ("keeper_reap_receipt", "keeper_reap_receipt_ref")):
            receipts[key] = C.digest_record(receipts[receipt])
        evidence = slot["cleanup_evidence"]
        evidence["start_settlement_ref"] = receipts["start_settlement_ref"]
        evidence["stop_settlement_ref"] = receipts["stop_settlement_ref"]
        evidence["final_unit_observation_ref"] = receipts["final_unit_receipt_ref"]
        for kind in ("start", "stop"):
            key = (kind, slot["slot"])
            if key in omit_outcomes:
                continue
            receipt = receipts[kind + "_receipt"]
            facts = {"state": "ACCEPTED", "request_ref": receipt["request_ref"], "job_ref": receipt["job_ref"]}
            facts.update((outcome_overrides or {}).get(key, {}))
            for _ in range(2 if key in repeat_outcomes else 1):
                outcome = {"previous": previous, "kind": kind.upper() + "_OUTCOME", "slot": slot["slot"],
                           "mono_us": "1000000", "facts": deepcopy(facts)}
                previous = C.digest_record(outcome)
                chain.append({"ref": previous, "record": outcome})
        entry = {"previous": previous, "kind": "CLEANUP_CERTIFICATE", "slot": slot["slot"], "mono_us": "1000000",
                 "facts": {"evidence_ref": C.digest_record(evidence), "independent_receipts_ref": C.digest_record(receipts),
                           "binding_proof_ref": C.digest_record(slot.get("binding_proof")),
                           "closure_proof_ref": C.digest_record(slot.get("closure_proof"))}}
        previous = C.digest_record(entry)
        chain.append({"ref": previous, "record": entry})
        slot["certificate"] = previous
    record["ledger_records"] = chain
    record["final"]["slot_ledger_ref"] = previous
    record["final"]["metric_records_ref"] = C.digest_record({"samples": [C.digest_record(s["sample"]) for s in record["slots"]]})
    record["final"]["cleanup_records_ref"] = C.digest_record({"certificates": [s["certificate"] for s in record["slots"]]})


def graph_fixture():
    spec, clock, log = W.make_spec(), W.Clock(), []
    backend = W.FakeBackend(spec, clock, log)
    distribution = W.FakeDistribution(spec, log)
    observer = W.FakeObserver(spec, backend, clock, log)
    record = {"run": spec.run, "fixture_only": False, "manager_binding": deepcopy(backend.manager),
              "payload_binding": deepcopy(distribution.payload), "observer_root_binding": observer.preflight(spec),
              "slots": [], "ledger_records": [],
              "final": {"status": "COMPLETE", "slots": [{"slot": n, "leaf_status": "CLOSED_REMOVED"} for n in range(3)],
                        "metric_records_ref": "0" * 64, "slot_ledger_ref": "0" * 64, "cleanup_records_ref": "0" * 64,
                        "memory_reclamation": "NOT_ESTABLISHED", "missing_evidence": []}}
    for index in range(3):
        keeper, child = W.generation(300 + index), W.generation(400 + index)
        unit = backend.bind_unit(index, keeper, 2000000)
        physical = observer.bind_leaf(unit, keeper, 2000000)
        spawn = {"child_generation": child, "parent_generation_ref": W.ref(keeper), "role": "LOAD", "spawn_record_ref": W.ref({"spawn": index})}
        hello = {"pid": keeper["pid"], "start_ticks": keeper["start_ticks"], "exe_sha256": spec.payload_expected_sha256,
                 "uid": spec.load_uid, "gid": spec.load_gid, "groups": list(spec.load_groups), "no_new_privs": True,
                 "cap_eff": "0", "cap_perm": "0", "cap_inh": "0", "cap_amb": "0"}
        initial_threads = [{"owner_process_generation_ref": W.ref(owner),
                            "thread_creation_record_ref": C.initial_thread_creation_ref(event, body),
                            "thread_ref": C.initial_thread_token(owner), "event": event, "body": deepcopy(body)}
                           for owner, event, body in ((keeper, "KEEPER_HELLO", hello), (child, "SPAWNED", spawn))]
        reap = {"tag": "WAITPID_CONSUMED", "child_generation": child, "reaper_generation": keeper,
                "before_us": "1000000", "after_us": "1000000", "requested_pid": child["pid"],
                "returned_pid": child["pid"], "options": "WNOHANG", "raw_wait_status": 0}
        threads, joins = [], []
        if index == 1:
            thread = {"owner_process_generation_ref": W.ref(keeper), "thread_creation_record_ref": W.ref({"create": index}),
                      "thread_ref": W.ref({"worker": index}), "creating_thread_ref": C.initial_thread_token(keeper),
                      "before_us": "1000000", "after_us": "1000000"}
            join = {"tag": "PTHREAD_JOINED", "owner_process_generation_ref": W.ref(keeper),
                    "thread_creation_record_ref": thread["thread_creation_record_ref"], "joined_thread_ref": thread["thread_ref"],
                    "joining_thread_ref": thread["creating_thread_ref"], "return_code": 0, "outcome": "RETURNED",
                    "before_us": "1000000", "after_us": "1000000"}
            threads, joins = [thread], [join]
        reap_ref = C.digest_record({"reaps": sorted(C.digest_record(r) for r in (reap, *joins))})
        receipts = backend.complete_receipts(index)
        # Original producer flags are represented as fixture data only; the verifier below is explicitly fixture_only.
        receipts["test_boundary"] = False
        sample = observer.sample_peak(physical, keeper, reap_ref, 2000000)
        evidence = observer.probe_cleanup(physical, unit, receipts, reap_ref, 2000000)
        record["slots"].append({"slot": index, "unit": unit, "physical": physical, "keeper": keeper,
                                "spawns": [spawn], "initial_threads": initial_threads,
                                "binding_proof": observer.binding_proof(physical, 2000000),
                                "closure_proof": observer.cleanup_proof(evidence, physical, 2000000),
                                "reaps": [reap], "threads": threads, "joins": joins,
                                "sample": sample, "cleanup_evidence": evidence, "independent_receipts": receipts,
                                "certificate": "0" * 64, "leaf_status": "CLOSED_REMOVED"})
    reseal(record)
    return spec, clock, record


def refresh_reap_checkpoint(slot):
    digest = C.digest_record({"reaps": sorted(C.digest_record(r) for r in (*slot["reaps"], *slot["joins"]))})
    slot["sample"]["ledger_checkpoint_ref"] = digest
    slot["cleanup_evidence"]["reap_ledger_ref"] = digest


def refresh_absence_refs(slot):
    proof = slot["closure_proof"]
    identity, operation = proof["original_identity"], proof["operation"]
    operation["parent_identity_ref"] = C.digest_record(identity)
    evidence = slot["cleanup_evidence"]
    evidence["identity_brackets_ref"] = C.digest_record(proof)
    evidence["physical"].update({"parent_original_identity_before_ref": C.digest_record(proof["before_identity"]),
                                 "parent_original_identity_after_ref": C.digest_record(proof["after_identity"]),
                                 "probe_ref": C.digest_record(operation)})


def transcript_for(record):
    result = [{"event": "ARMED", "slot": None,
               "body": {"watchdog_generation": W.generation(200), "manager_binding": deepcopy(record["manager_binding"]),
                        "payload_binding": deepcopy(record["payload_binding"]),
                        "observer_root_binding": C.digest_record(record["observer_root_binding"]),
                        "slots_ledger_ref": W.ref({"run": record["run"], "reserved": [0, 1, 2]}),
                        "work_deadline_us": "51000000", "cleanup_deadline_us": "61000000"}}]
    for slot in record["slots"]:
        result.extend(({"event": "UNIT_BOUND", "slot": slot["slot"], "body": {"unit_binding": deepcopy(slot["unit"])}},
                       {"event": "MEMORY_SAMPLE", "slot": slot["slot"], "body": {"sample": deepcopy(slot["sample"])}}))
    return result


class CertificateGraphTest(unittest.TestCase):
    def verify(self, record, spec, clock, transcript=None, *, fixture_only=True, after_read=None):
        store = FakeStore(record, clock, after_read=after_read)
        verifier = M.StoredFinalVerifier(store, fixture_only=fixture_only)
        return verifier.verify(spec, deepcopy(record["final"]), transcript_for(record) if transcript is None else transcript)

    def rejected(self, record, spec, clock, **kwargs):
        try:
            accepted = self.verify(record, spec, clock, **kwargs)
        except (C.ContractError, ValueError, KeyError, TypeError):
            accepted = False
        self.assertFalse(accepted)

    def test_complete_graph_validates_only_under_explicit_hermetic_verifier(self):
        spec, clock, record = graph_fixture()
        self.assertTrue(self.verify(record, spec, clock))
        self.assertFalse(self.verify(record, spec, clock, fixture_only=False))
        self.assertEqual(record["final"]["memory_reclamation"], "NOT_ESTABLISHED")

    def test_refs_without_retained_records_or_ledger_chain_do_not_certify(self):
        for field in ("slots", "ledger_records"):
            with self.subTest(field=field):
                spec, clock, record = graph_fixture()
                record[field] = []
                self.rejected(record, spec, clock)

    def test_ledger_hash_corruption_replay_and_wrong_predecessor_fail(self):
        for mutation in ("hash", "replay", "previous"):
            with self.subTest(mutation=mutation):
                spec, clock, record = graph_fixture()
                if mutation == "hash":
                    record["ledger_records"][0]["record"]["facts"]["evidence_ref"] = "e" * 64
                elif mutation == "replay":
                    record["ledger_records"].append(deepcopy(record["ledger_records"][0]))
                else:
                    record["ledger_records"][1]["record"]["previous"] = "e" * 64
                    record["ledger_records"][1]["ref"] = C.digest_record(record["ledger_records"][1]["record"])
                self.rejected(record, spec, clock)

    def test_generation_change_or_missing_or_duplicate_own_wait_fails_even_after_rehash(self):
        for mutation in ("generation", "missing", "duplicate", "foreign_reaper"):
            with self.subTest(mutation=mutation):
                spec, clock, record = graph_fixture()
                slot = record["slots"][0]
                if mutation == "generation":
                    slot["reaps"][0]["child_generation"]["start_ticks"] = "9000"
                elif mutation == "missing":
                    slot["reaps"] = []
                elif mutation == "duplicate":
                    slot["reaps"].append(deepcopy(slot["reaps"][0]))
                else:
                    slot["reaps"][0]["reaper_generation"] = W.generation(999)
                reseal(record)
                self.rejected(record, spec, clock)

    def test_join_cannot_be_lost_or_replace_process_wait_and_unknown_peak_is_not_zero(self):
        for mutation in ("join_missing", "join_as_wait", "unknown_peak"):
            with self.subTest(mutation=mutation):
                spec, clock, record = graph_fixture()
                slot = record["slots"][1]
                if mutation == "join_missing":
                    slot["joins"] = []
                elif mutation == "join_as_wait":
                    slot["reaps"] = [deepcopy(slot["joins"][0])]
                else:
                    slot["sample"]["bytes"] = None
                reseal(record)
                self.rejected(record, spec, clock)

    def test_rehashed_job_owner_or_pending_execution_or_live_pid_does_not_certify(self):
        for mutation in ("owner", "pending_job", "live_pid", "main_not_released"):
            with self.subTest(mutation=mutation):
                spec, clock, record = graph_fixture()
                receipts = record["slots"][0]["independent_receipts"]
                if mutation == "owner":
                    receipts["stop_receipt"]["event"]["owner_unique_name"] = ":1.99"
                elif mutation == "pending_job":
                    receipts["final_unit_receipt"]["snapshot"]["unit"]["Job"] = [99, "/org/freedesktop/systemd1/job/99"]
                elif mutation == "live_pid":
                    receipts["final_unit_receipt"]["snapshot"]["service"]["MainPID"] = 300
                else:
                    receipts["keeper_reap_receipt"]["pidfd_task_released"]["fdinfo_pid"] = 300
                reseal(record)
                self.rejected(record, spec, clock)

    def test_no_such_unit_or_populated_zero_alone_does_not_prove_original_absence(self):
        for tag in ("Unavailable", "PresentEmpty"):
            with self.subTest(tag=tag):
                spec, clock, record = graph_fixture()
                slot = record["slots"][0]
                if tag == "Unavailable":
                    physical = {"tag": tag, "populated": None, "reason": "OTHER_UNCERTAINTY", "observation_ref": W.ref("NoSuchUnit")}
                else:
                    physical = {"tag": tag, "populated": 0, "read_before_us": "1000000", "read_after_us": "1000000",
                                "original_identity_before_ref": W.ref(slot["physical"]), "original_identity_after_ref": W.ref(slot["physical"]),
                                "direct_events_read_ref": W.ref("events")}
                slot["cleanup_evidence"]["physical"] = physical
                slot["leaf_status"] = "UNKNOWN" if tag == "Unavailable" else "CLOSED_EMPTY"
                reseal(record)
                self.rejected(record, spec, clock)

    def test_transcript_and_reap_checkpoint_must_match_actual_retained_sample(self):
        for mutation in ("transcript", "checkpoint", "evidence_checkpoint", "lease"):
            with self.subTest(mutation=mutation):
                spec, clock, record = graph_fixture()
                transcript = transcript_for(record)
                if mutation == "transcript":
                    transcript = transcript[:-1]
                elif mutation == "checkpoint":
                    record["slots"][0]["sample"]["ledger_checkpoint_ref"] = "e" * 64
                elif mutation == "evidence_checkpoint":
                    record["slots"][0]["cleanup_evidence"]["reap_ledger_ref"] = "e" * 64
                else:
                    record["slots"][0]["cleanup_evidence"]["lease_until_us"] = "99000000"
                reseal(record)
                self.rejected(record, spec, clock, transcript=transcript)

    def test_store_read_finishing_at_original_cleanup_deadline_cannot_certify(self):
        spec, clock, record = graph_fixture()
        self.rejected(record, spec, clock, after_read=spec.cleanup_deadline_us)

    def test_missing_full_physical_preimages_cannot_be_replaced_by_labels_or_hashes(self):
        for field, substitute in (("binding_proof", None), ("closure_proof", None),
                                  ("binding_proof", "parent:fixture"), ("closure_proof", "e" * 64)):
            with self.subTest(field=field, substitute=substitute):
                spec, clock, record = graph_fixture()
                record["slots"][0][field] = substitute
                reseal(record)
                self.rejected(record, spec, clock)

    def test_closure_cannot_coherently_adopt_another_parent_after_original_binding(self):
        for field in ("inode", "mount_id", "cgroup_path"):
            with self.subTest(field=field):
                spec, clock, record = graph_fixture()
                slot = record["slots"][0]
                closure = slot["closure_proof"]
                adopted = deepcopy(closure["original_identity"])
                adopted[field] = "/foreign" if field == "cgroup_path" else "999999"
                for key in ("original_identity", "before_identity", "after_identity"):
                    closure[key] = deepcopy(adopted)
                refresh_absence_refs(slot)
                reseal(record)
                self.rejected(record, spec, clock)

    def test_leaf_parent_epoch_and_operation_brackets_must_match_full_capture(self):
        for mutation in ("leaf", "parent_mount", "brackets", "probe"):
            with self.subTest(mutation=mutation):
                spec, clock, record = graph_fixture()
                slot = record["slots"][0]
                if mutation == "leaf":
                    slot["binding_proof"]["original_leaf_identity"]["inode"] = "999999"
                elif mutation == "parent_mount":
                    slot["binding_proof"]["original_parent_identity"]["mount_id"] = "999999"
                elif mutation == "brackets":
                    slot["cleanup_evidence"]["identity_brackets_ref"] = "e" * 64
                else:
                    slot["cleanup_evidence"]["physical"]["probe_ref"] = "e" * 64
                reseal(record)
                self.rejected(record, spec, clock)

    def test_each_original_process_requires_its_full_initial_thread_token(self):
        for mutation in ("keeper_missing", "child_missing", "wrong_token", "wrong_body_hash", "duplicate"):
            with self.subTest(mutation=mutation):
                spec, clock, record = graph_fixture()
                initial = record["slots"][0]["initial_threads"]
                if mutation == "keeper_missing":
                    initial.pop(0)
                elif mutation == "child_missing":
                    initial.pop(1)
                elif mutation == "wrong_token":
                    initial[0]["thread_ref"] = C.initial_thread_token(W.generation(300, 9000))
                elif mutation == "wrong_body_hash":
                    initial[0]["thread_creation_record_ref"] = "e" * 64
                else:
                    initial.append(deepcopy(initial[0]))
                reseal(record)
                self.rejected(record, spec, clock)

    def test_rehashed_initial_spawn_must_describe_the_original_registered_child(self):
        spec, clock, record = graph_fixture()
        child_initial = record["slots"][0]["initial_threads"][1]
        child_initial["body"]["child_generation"] = W.generation(400, 9000)
        child_initial["thread_creation_record_ref"] = C.initial_thread_creation_ref("SPAWNED", child_initial["body"])
        reseal(record)
        self.rejected(record, spec, clock)

    def test_join_by_registered_distinct_thread_of_same_process_need_not_be_creator(self):
        spec, clock, record = graph_fixture()
        slot = record["slots"][1]
        first = slot["threads"][0]
        second = deepcopy(first)
        second["thread_ref"] = W.ref("second-thread")
        second["thread_creation_record_ref"] = W.ref("second-creation")
        slot["threads"].append(second)
        slot["joins"][0]["joining_thread_ref"] = second["thread_ref"]
        second_join = deepcopy(slot["joins"][0])
        second_join.update({"thread_creation_record_ref": second["thread_creation_record_ref"],
                            "joined_thread_ref": second["thread_ref"], "joining_thread_ref": first["creating_thread_ref"]})
        slot["joins"].append(second_join)
        refresh_reap_checkpoint(slot)
        reseal(record)
        self.assertTrue(self.verify(record, spec, clock))

    def test_unregistered_or_foreign_process_joiner_cannot_clear_a_known_thread(self):
        for token in (W.ref("unregistered"), C.initial_thread_token(W.generation(401))):
            with self.subTest(token=token):
                spec, clock, record = graph_fixture()
                slot = record["slots"][1]
                slot["joins"][0]["joining_thread_ref"] = token
                refresh_reap_checkpoint(slot)
                reseal(record)
                self.rejected(record, spec, clock)

    def test_job_done_identity_path_and_request_must_match_actual_outcome_preimages(self):
        for mutation in ("failed", "id", "path", "job_ref", "request_ref", "missing_outcome", "duplicate_outcome"):
            with self.subTest(mutation=mutation):
                spec, clock, record = graph_fixture()
                receipt = record["slots"][0]["independent_receipts"]["stop_receipt"]
                if mutation == "failed":
                    receipt["event"]["result"] = "failed"
                elif mutation == "id":
                    receipt["event"]["job_id"] = 900
                elif mutation == "path":
                    receipt["event"]["job_path"] = "/org/freedesktop/systemd1/job/900"
                elif mutation == "job_ref":
                    receipt["job_ref"] = "e" * 64
                overrides = {("stop", 0): {"request_ref": "e" * 64}} if mutation == "request_ref" else None
                reseal(record, outcome_overrides=overrides,
                       omit_outcomes=(("stop", 0),) if mutation == "missing_outcome" else (),
                       repeat_outcomes=(("stop", 0),) if mutation == "duplicate_outcome" else ())
                self.rejected(record, spec, clock)

    def test_registered_descendant_cannot_substitute_for_keepers_own_wait_receipt(self):
        spec, clock, record = graph_fixture()
        slot = record["slots"][0]
        child = W.generation(499)
        spawn = {"child_generation": child, "parent_generation_ref": W.ref(slot["keeper"]),
                 "role": "LOAD", "spawn_record_ref": W.ref("additional-child")}
        slot["spawns"].append(spawn)
        slot["initial_threads"].append({"owner_process_generation_ref": W.ref(child), "thread_ref": C.initial_thread_token(child),
                                       "thread_creation_record_ref": C.initial_thread_creation_ref("SPAWNED", spawn),
                                       "event": "SPAWNED", "body": deepcopy(spawn)})
        child_wait = deepcopy(slot["reaps"][0])
        child_wait.update({"child_generation": child, "requested_pid": child["pid"], "returned_pid": child["pid"]})
        slot["reaps"].append(child_wait)
        slot["reaps"][0]["reaper_generation"] = child
        refresh_reap_checkpoint(slot)
        reseal(record)
        self.rejected(record, spec, clock)

    def test_observer_root_full_capture_is_required_and_bound_to_original_armed_digest(self):
        for mutation in ("missing", "substituted"):
            with self.subTest(mutation=mutation):
                spec, clock, record = graph_fixture()
                transcript = transcript_for(record)
                if mutation == "missing":
                    record.pop("observer_root_binding")
                else:
                    record["observer_root_binding"]["original_root_identity"]["inode"] = "9000"
                reseal(record)
                self.rejected(record, spec, clock, transcript=transcript)

    def test_exactly_one_armed_with_original_manager_payload_and_watchdog_namespace_is_required(self):
        for mutation in ("missing", "duplicate", "manager", "payload", "watchdog_namespace"):
            with self.subTest(mutation=mutation):
                spec, clock, record = graph_fixture()
                transcript = transcript_for(record)
                if mutation == "missing":
                    transcript.pop(0)
                elif mutation == "duplicate":
                    transcript.insert(1, deepcopy(transcript[0]))
                elif mutation == "manager":
                    transcript[0]["body"]["manager_binding"]["owner_unique_name"] = ":1.99"
                elif mutation == "payload":
                    transcript[0]["body"]["payload_binding"]["sha256"] = "e" * 64
                else:
                    transcript[0]["body"]["watchdog_generation"]["mount_namespace_ref"] = "mnt:[foreign]"
                self.rejected(record, spec, clock, transcript=transcript)

    def test_rehashed_root_must_match_original_run_epoch_namespace_and_work_window(self):
        for mutation in ("run", "boot", "namespace", "before_origin", "work_cutoff"):
            with self.subTest(mutation=mutation):
                spec, clock, record = graph_fixture()
                root = record["observer_root_binding"]
                if mutation == "run":
                    root["run"] = "e" * 32
                elif mutation == "boot":
                    root["original_root_identity"]["boot_id"] = "22222222-2222-3333-4444-555555555555"
                elif mutation == "namespace":
                    root["original_root_identity"]["mount_namespace_ref"] = "mnt:[foreign]"
                elif mutation == "before_origin":
                    root["before_us"] = "999999"
                else:
                    root["after_us"] = str(spec.work_deadline_us)
                reseal(record)
                self.rejected(record, spec, clock)

    def test_coherently_rehashed_leaf_on_another_device_cannot_adopt_observer_root(self):
        spec, clock, record = graph_fixture()
        slot = record["slots"][0]
        slot["physical"]["dev"] = "99"
        physical_ref = C.digest_record(slot["physical"])
        binding, closure = slot["binding_proof"], slot["closure_proof"]
        binding["physical_binding_ref"] = closure["physical_binding_ref"] = physical_ref
        for identity in (binding["original_leaf_identity"], binding["original_parent_identity"],
                         closure["original_identity"], closure["before_identity"], closure["after_identity"]):
            identity["dev"] = "99"
        slot["sample"].update({"physical_binding_ref": physical_ref, "identity_before_ref": physical_ref, "identity_after_ref": physical_ref})
        slot["cleanup_evidence"]["original_physical_binding_ref"] = physical_ref
        refresh_absence_refs(slot)
        reseal(record)
        self.rejected(record, spec, clock)

    def test_rehashed_sample_and_binding_obey_original_root_and_t0_chronology(self):
        for mutation in ("sample_before_t0", "binding_after_sample", "binding_before_root"):
            with self.subTest(mutation=mutation):
                spec, clock, record = graph_fixture()
                slot = record["slots"][0]
                if mutation == "sample_before_t0":
                    slot["sample"].update({"before_us": "999999", "after_us": "999999"})
                elif mutation == "binding_after_sample":
                    slot["binding_proof"].update({"before_us": "1000001", "after_us": "1000001"})
                    slot["closure_proof"]["operation"].update({"before_us": "1000002", "after_us": "1000002"})
                    slot["cleanup_evidence"]["observed_us"] = "1000002"
                    refresh_absence_refs(slot)
                else:
                    record["observer_root_binding"]["after_us"] = "1000001"
                clock.now = 1000003
                reseal(record)
                self.rejected(record, spec, clock)

    def test_rehashed_own_wait_before_t0_cannot_clear_registered_workload(self):
        spec, clock, record = graph_fixture()
        slot = record["slots"][0]
        slot["reaps"][0].update({"before_us": "999999", "after_us": "999999"})
        refresh_reap_checkpoint(slot)
        reseal(record)
        self.rejected(record, spec, clock)

    def test_certificate_must_follow_actual_closure_observation_even_when_all_hashes_match(self):
        spec, clock, record = graph_fixture()
        slot = record["slots"][0]
        slot["closure_proof"]["operation"].update({"before_us": "1000002", "after_us": "1000002"})
        slot["cleanup_evidence"]["observed_us"] = "1000002"
        refresh_absence_refs(slot)
        clock.now = 1000003
        reseal(record)  # Certificate mono_us remains 1000000, earlier than the fact it claims.
        self.rejected(record, spec, clock)

    def test_sample_identity_brackets_must_reference_the_original_physical_binding(self):
        spec, clock, record = graph_fixture()
        record["slots"][0]["sample"].update({"identity_before_ref": "a" * 64, "identity_after_ref": "b" * 64})
        reseal(record)
        self.rejected(record, spec, clock)

    def test_rehashed_physical_control_group_id_cannot_replace_original_unit_id(self):
        spec, clock, record = graph_fixture()
        slot = record["slots"][0]
        slot["physical"]["control_group_id"] = str(int(slot["physical"]["control_group_id"]) + 1)
        physical_ref = C.digest_record(slot["physical"])
        slot["binding_proof"]["physical_binding_ref"] = physical_ref
        slot["closure_proof"]["physical_binding_ref"] = physical_ref
        slot["sample"].update({"physical_binding_ref": physical_ref, "identity_before_ref": physical_ref, "identity_after_ref": physical_ref})
        slot["cleanup_evidence"]["original_physical_binding_ref"] = physical_ref
        refresh_absence_refs(slot)
        reseal(record)
        self.rejected(record, spec, clock)


class RetainedDescriptorTest(unittest.TestCase):
    def metadata(self, **changes):
        fields = dict(st_mode=stat.S_IFREG | 0o600, st_nlink=1, st_dev=2, st_ino=3, st_uid=0)
        fields.update(changes)
        return SimpleNamespace(**fields)

    def store(self, clock=None, native=True):
        return M.RetainedEvidenceStore(77, clock_us=clock or (lambda: 1000000), deadline_us=61000000, native_custody=native)

    def test_initial_nonregular_or_hardlinked_descriptor_is_rejected(self):
        for changes in ({"st_mode": stat.S_IFDIR | 0o600}, {"st_nlink": 2}):
            with self.subTest(changes=changes), patch.object(M.os, "fstat", return_value=self.metadata(**changes)):
                with self.assertRaises(ValueError):
                    self.store()

    def test_retained_inode_owner_mode_or_link_change_blocks_before_read(self):
        for changes in ({"st_ino": 99}, {"st_dev": 99}, {"st_uid": 1001}, {"st_mode": stat.S_IFREG | 0o644}, {"st_nlink": 2}):
            with self.subTest(changes=changes), patch.object(M.os, "fstat", side_effect=[self.metadata(), self.metadata(**changes)]), patch.object(M.os, "read") as read:
                store = self.store()
                with self.assertRaises(ValueError):
                    store.read()
                read.assert_not_called()

    def test_short_writes_are_completed_and_snapshot_is_serialized_before_caller_mutation(self):
        captured = bytearray()
        original = {"facts": {"flag": True}}

        def write(fd, raw):
            self.assertEqual(fd, 77)
            take = min(3, len(raw))
            captured.extend(raw[:take])
            original["facts"]["flag"] = False
            return take

        with patch.object(M.os, "fstat", return_value=self.metadata()), patch.object(M.os, "lseek"), patch.object(M.os, "write", side_effect=write), patch.object(M.os, "ftruncate") as truncate, patch.object(M.os, "fsync") as sync:
            self.store()(original)
        self.assertEqual(json.loads(captured), {"facts": {"flag": True}})
        truncate.assert_called_once_with(77, len(captured))
        sync.assert_called_once_with(77)

    def test_zero_write_and_oversize_record_never_commit_a_complete_snapshot(self):
        with patch.object(M.os, "fstat", return_value=self.metadata()), patch.object(M.os, "lseek"), patch.object(M.os, "write", return_value=0) as write, patch.object(M.os, "fsync") as sync:
            with self.assertRaises(OSError):
                self.store()({"run": "a" * 32})
            sync.assert_not_called()
            write.reset_mock()
            with self.assertRaises(ValueError):
                self.store()({"large": "x" * M.STORE_LIMIT})
            write.assert_not_called()

    def test_bounded_reads_reject_duplicate_keys_floats_and_more_than_store_limit(self):
        for raw in (b'{"run":"a","run":"b"}', b'{"mono_us":1.0}', b"x" * (M.STORE_LIMIT + 1)):
            with self.subTest(bytes=len(raw)), patch.object(M.os, "fstat", return_value=self.metadata()), patch.object(M.os, "lseek"), patch.object(M.os, "read", side_effect=[raw, b""]):
                with self.assertRaises(ValueError):
                    self.store().read()

    def test_read_crossing_global_deadline_never_returns_the_valid_json(self):
        clock = W.Clock()

        def read(fd, limit):
            clock.now = 61000000
            return b'{"run":"a"}'

        with patch.object(M.os, "fstat", return_value=self.metadata()), patch.object(M.os, "lseek"), patch.object(M.os, "read", side_effect=read):
            with self.assertRaises(ValueError):
                self.store(clock).read()


class NativeReleaseAuthorityTest(unittest.TestCase):
    def fixture(self, bases=("RESERVED_NOT_DISPATCHED",) * 3):
        from systemd_memory_runtime.systemd_backend import SystemdBackend

        spec, clock, log = W.make_spec(), W.Clock(), []
        fixtures = W.FakeBackend(spec, clock, log)
        manager = deepcopy(fixtures.manager)
        manager["authority_lease_until_us"] = str(spec.cleanup_deadline_us)
        fixtures.manager = deepcopy(manager)
        payload = W.FakeDistribution(spec, log).payload
        backend = object.__new__(SystemdBackend)
        backend.spec, backend.payload, backend.test_boundary, backend.cleanup_started = spec, payload, False, True
        backend.transport = SimpleNamespace(binding=manager, budget=SimpleNamespace(lease=spec.cleanup_deadline_us))
        receipts = []
        for index, basis in enumerate(bases):
            graph = None
            if basis == "START_DISPATCHED_BOUND":
                fixtures.bind_unit(index, W.generation(300 + index), 2000000)
                graph = fixtures.complete_receipts(index)
                graph["test_boundary"] = False
            receipts.append({"slot": index, "run": spec.run, "reservation_ref": W.ref({"reserved": index}),
                             "payload_binding_ref": C.digest_record(payload), "manager_binding_ref": C.digest_record(manager),
                             "basis": basis, "no_future_own_exec": True, "observed_us": str(clock.now),
                             "authority_lease_until_us": str(spec.cleanup_deadline_us), "cleanup_receipts": graph,
                             "test_boundary": False})
        calls = []

        def release_receipt(index, deadline):
            calls.append((index, deadline))
            return deepcopy(receipts[index])

        backend.release_receipt = release_receipt
        # Authority checks use this closed fake read. Actual graph validation is exercised by the full-flow class below.
        backend.validate_release_graph = lambda slot, graph, deadline: True
        authority = M.NativeSettlementAuthority(spec)
        authority.attach_once(backend)
        return spec, clock, backend, payload, receipts, calls, authority

    def prove(self, authority, payload, clock, deadline):
        with patch.object(M.sys, "platform", "linux"), patch.object(M, "monotonic_us", side_effect=clock):
            return authority.prove_release_allowed(payload, deadline)

    def test_all_unstarted_reservations_release_without_inventing_unit_or_reap_graphs(self):
        for bases in (("RESERVED_NOT_DISPATCHED",) * 3,
                      ("NOT_RESERVED_NOT_DISPATCHED", "RESERVED_NOT_DISPATCHED", "NOT_RESERVED_NOT_DISPATCHED")):
            with self.subTest(bases=bases):
                spec, clock, _, payload, _, calls, authority = self.fixture(bases)
                result = self.prove(authority, payload, clock, spec.cleanup_deadline_us)
                self.assertEqual(result["run"], spec.run)
                self.assertEqual([receipt["basis"] for receipt in result["slots"]], list(bases))
                self.assertEqual([receipt["cleanup_receipts"] for receipt in result["slots"]], [None] * 3)
                self.assertEqual([index for index, _ in calls], [0, 1, 2])

    def test_correlated_bound_release_requires_all_four_independent_settlements(self):
        spec, clock, _, payload, _, _, authority = self.fixture(("START_DISPATCHED_BOUND",) * 3)
        self.assertEqual(len(self.prove(authority, payload, clock, spec.cleanup_deadline_us)["slots"]), 3)
        for missing in (None, "activations_settled", "stop_settled", "terminal_no_pending_execution", "keeper_reaped"):
            with self.subTest(missing=missing):
                spec, clock, _, payload, receipts, _, authority = self.fixture(("START_DISPATCHED_BOUND",) * 3)
                if missing is None:
                    receipts[0]["cleanup_receipts"] = None
                else:
                    receipts[0]["cleanup_receipts"][missing] = False
                with self.assertRaises(ValueError):
                    self.prove(authority, payload, clock, spec.cleanup_deadline_us)

    def test_unknown_dispatched_activation_remains_an_obligation_even_with_optimistic_flag(self):
        for optimistic in (False, True):
            with self.subTest(optimistic=optimistic):
                spec, clock, _, payload, receipts, _, authority = self.fixture(("START_DISPATCHED_UNKNOWN", "RESERVED_NOT_DISPATCHED", "RESERVED_NOT_DISPATCHED"))
                receipts[0]["no_future_own_exec"] = optimistic
                with self.assertRaises(ValueError):
                    self.prove(authority, payload, clock, spec.cleanup_deadline_us)

    def test_unstarted_slot_cannot_invent_a_cleanup_graph(self):
        spec, clock, _, payload, receipts, _, authority = self.fixture()
        receipts[0]["cleanup_receipts"] = {"test_boundary": False, "keeper_reaped": True}
        with self.assertRaises(ValueError):
            self.prove(authority, payload, clock, spec.cleanup_deadline_us)

    def test_release_identity_time_lease_and_native_flags_are_exact(self):
        cases = ({"slot": 1}, {"run": "e" * 32}, {"payload_binding_ref": "e" * 64},
                 {"manager_binding_ref": "e" * 64}, {"no_future_own_exec": 1}, {"test_boundary": "false"},
                 {"observed_us": "999999"}, {"observed_us": "1000001"}, {"authority_lease_until_us": "62000000"})
        for changes in cases:
            with self.subTest(changes=changes):
                spec, clock, _, payload, receipts, _, authority = self.fixture()
                receipts[0].update(changes)
                with self.assertRaises(ValueError):
                    self.prove(authority, payload, clock, spec.cleanup_deadline_us)

    def test_no_cleanup_phase_or_original_expired_deadline_never_reads_release_receipts(self):
        for missing in ("cleanup", "deadline"):
            with self.subTest(missing=missing):
                spec, clock, backend, payload, _, calls, authority = self.fixture()
                if missing == "cleanup":
                    backend.cleanup_started = False
                else:
                    clock.now = spec.cleanup_deadline_us
                with self.assertRaises(ValueError):
                    self.prove(authority, payload, clock, spec.cleanup_deadline_us)
                self.assertEqual(calls, [])

    def test_backend_custody_cannot_be_replaced_or_attached_twice(self):
        spec, _, backend, _, _, _, authority = self.fixture()
        with self.assertRaises(ValueError):
            authority.attach_once(backend)
        fresh = M.NativeSettlementAuthority(spec)
        with self.assertRaises(ValueError):
            fresh.attach_once(SimpleNamespace(test_boundary=False, spec=spec))
        backend.test_boundary = True
        with self.assertRaises(ValueError):
            fresh.attach_once(backend)

    def test_bound_release_requires_local_graph_validation_empty_missing_and_all_four_hashes(self):
        for mutation in ("validator", "missing", "start_settlement_ref", "stop_settlement_ref",
                         "final_unit_receipt_ref", "keeper_reap_receipt_ref"):
            with self.subTest(mutation=mutation):
                spec, clock, backend, payload, receipts, _, authority = self.fixture(("START_DISPATCHED_BOUND",) * 3)
                if mutation == "validator":
                    backend.validate_release_graph = lambda slot, graph, deadline: False
                elif mutation == "missing":
                    receipts[0]["cleanup_receipts"]["missing_evidence"] = ["FINAL_UNIT_UNAVAILABLE"]
                else:
                    receipts[0]["cleanup_receipts"][mutation] = "e" * 64
                with self.assertRaises(ValueError):
                    self.prove(authority, payload, clock, spec.cleanup_deadline_us)


class BackendReleaseFullFlowTest(unittest.TestCase):
    """Actual backend methods composed with explicit fake transport and process readers."""
    def fixture(self, *, capture_terminal):
        import test_backend_faults as F

        harness = F.BackendFaultTests()
        harness.setUp()
        _, binding = harness.bind()
        backend = harness.backend
        # This flag selects the native receipt schema for an explicitly hermetic graph.
        # The transport, pins and identity implementation remain dedicated test fakes.
        backend.test_boundary = False
        backend.begin_cleanup()
        original_request = harness.driver.request

        def stop_request(request, deadline):
            if isinstance(request, F.T.StopRequest):
                harness.driver.log.append("StopRequest")
                return "/org/freedesktop/systemd1/job/2"
            return original_request(request, deadline)

        harness.driver.request = stop_request
        harness.driver.reply = harness.snapshot()
        backend.stop_once(binding, 60000000)
        harness.events(1, 2)
        harness.identity.released = True
        retained = None
        if capture_terminal:
            harness.driver.reply = harness.snapshot(terminal=True)
            retained = backend.cleanup_receipts(0, 60000000)

        def no_such_unit(request, deadline):
            if isinstance(request, F.T.SnapshotRequest):
                raise F.T.BusRemoteError("org.freedesktop.systemd1.NoSuchUnit")
            return stop_request(request, deadline)

        harness.driver.request = no_such_unit
        authority = M.NativeSettlementAuthority(backend.spec)
        authority.attach_once(backend)
        return harness, authority, retained

    def test_actual_terminal_receipt_survives_unload_through_release_and_authority(self):
        harness, authority, retained = self.fixture(capture_terminal=True)
        self.assertEqual(retained["missing_evidence"], [])
        self.assertTrue(all(retained[key] for key in ("activations_settled", "stop_settled", "terminal_no_pending_execution", "keeper_reaped")))
        graph = harness.backend.cleanup_receipts(0, 60000000)
        self.assertEqual(graph["final_unit_receipt"], retained["final_unit_receipt"])
        self.assertEqual(graph["missing_evidence"], [])
        self.assertTrue(harness.backend.validate_release_graph(0, graph, 60000000))
        release = harness.backend.release_receipt(0, 60000000)
        self.assertEqual(release["basis"], "START_DISPATCHED_BOUND")
        self.assertTrue(release["no_future_own_exec"])
        with patch.object(M.sys, "platform", "linux"), patch.object(M, "monotonic_us", side_effect=harness.clock):
            result = authority.prove_release_allowed(harness.backend.payload, 60000000)
        self.assertEqual([slot["basis"] for slot in result["slots"]], ["START_DISPATCHED_BOUND", "RESERVED_NOT_DISPATCHED", "RESERVED_NOT_DISPATCHED"])
        self.assertEqual(sum(name == "StartRequest" for name in harness.driver.log), 1)
        self.assertEqual(sum(name == "StopRequest" for name in harness.driver.log), 1)

    def test_no_such_unit_without_retained_terminal_receipt_does_not_authorize_release(self):
        harness, authority, _ = self.fixture(capture_terminal=False)
        graph = harness.backend.cleanup_receipts(0, 60000000)
        self.assertFalse(graph["terminal_no_pending_execution"])
        self.assertIn("FINAL_UNIT_UNAVAILABLE", graph["missing_evidence"])
        self.assertFalse(harness.backend.validate_release_graph(0, graph, 60000000))
        with patch.object(M.sys, "platform", "linux"), patch.object(M, "monotonic_us", side_effect=harness.clock):
            with self.assertRaises(ValueError):
                authority.prove_release_allowed(harness.backend.payload, 60000000)


if __name__ == "__main__":
    unittest.main()
