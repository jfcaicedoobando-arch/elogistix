"""Coordinator protocol fixtures; no sockets, native processes or units run."""
from copy import deepcopy
from pathlib import Path
import json
import sys
import unittest
from unittest.mock import patch


TESTS = Path(__file__).resolve().parent
sys.path.insert(0, str(TESTS.parent.parent))
sys.path.insert(0, str(TESTS))
from systemd_memory_runtime import contracts as K
from systemd_memory_runtime import coordinator as C
import test_watchdog as W


class FakeChannel:
    # This declaration must not be sufficient to claim a physical runtime.
    test_only = False

    def __init__(self, clock, packets=(), authenticated=True):
        self.clock = clock
        self.packets = list(packets)
        self.authenticated = authenticated
        self.sent = []
        self.receives = []
        self.watchdog_generation = W.generation(200)
        self.send_failure = None

    def authenticate(self):
        return self.authenticated

    def send(self, packet, deadline):
        self.sent.append((K.decode_packet(packet).to_mapping(), deadline))
        if self.send_failure is not None:
            raise self.send_failure

    def receive(self, deadline):
        self.receives.append(deadline)
        if not self.packets:
            return None
        packet = self.packets.pop(0)
        if type(packet) is tuple:
            packet, self.clock.now = packet
        return packet


class FakeVerifier:
    def __init__(self, clock, accepted=True, after=None, error=None):
        self.clock, self.accepted, self.after, self.error = clock, accepted, after, error
        self.calls = []

    def verify(self, spec, body, transcript):
        self.calls.append((spec, deepcopy(body), deepcopy(transcript)))
        if self.after is not None:
            self.clock.now = self.after
        if self.error is not None:
            raise self.error
        return self.accepted


class CoordinatorTest(unittest.TestCase):
    def fixture(self):
        spec, clock, log = W.make_spec(), W.Clock(), []
        backend = W.FakeBackend(spec, clock, log)
        distribution = W.FakeDistribution(spec, log)
        return spec, clock, backend, distribution

    def envelope(self, spec, event, body, seq, slot=None, request=None, mono=1000000):
        return {"v": 3, "run": spec.run, "sender": "WATCHDOG", "seq": seq,
                "slot": slot, "event": event, "request": request, "mono_us": str(mono), "body": deepcopy(body)}

    def packet(self, mapping):
        return K.encode_packet(K.Envelope.from_mapping(mapping))

    def armed(self, spec, backend, distribution, **changes):
        body = {"watchdog_generation": W.generation(200), "manager_binding": deepcopy(backend.manager),
                "observer_root_binding": W.ref("observer-root"), "payload_binding": deepcopy(distribution.payload),
                "slots_ledger_ref": W.ref("reserved-three-slots"), "work_deadline_us": str(spec.work_deadline_us),
                "cleanup_deadline_us": str(spec.cleanup_deadline_us)}
        body.update(changes)
        return self.envelope(spec, "ARMED", body, 1, request=1)

    def unit(self, backend, slot):
        result = backend.candidate(slot)
        result.pop("main_pid")
        result["keeper_generation_ref"] = W.ref(W.generation(300 + slot))
        return result

    def sample(self, unit, slot, **changes):
        result = {"unit_binding_ref": W.ref(unit), "physical_binding_ref": W.ref({"physical": slot}),
                  "keeper_generation_ref": unit["keeper_generation_ref"], "ledger_checkpoint_ref": W.ref({"reaped": slot}),
                  "metric": "memory.peak", "bytes": str(48000000 + slot), "before_us": "1000000", "after_us": "1000000",
                  "identity_before_ref": W.ref({"original": slot}), "identity_after_ref": W.ref({"original": slot})}
        result.update(changes)
        return result

    def completed_messages(self, spec, backend, distribution):
        messages = [self.armed(spec, backend, distribution)]
        for slot in range(3):
            body = {"slot_record_ref": W.ref({"slot": slot}), "start_request_ref": W.ref({"start": slot}),
                    "deadline_us": "2000000"}
            messages.append(self.envelope(spec, "START_DISPATCHED", body, len(messages) + 1, slot, request=slot + 2))
        for slot in range(3):
            unit = self.unit(backend, slot)
            messages.append(self.envelope(spec, "UNIT_BOUND", {"unit_binding": unit, "start_job_ref": backend.job_ref(slot, "start")}, len(messages) + 1, slot))
            messages.append(self.envelope(spec, "MEMORY_SAMPLE", {"sample": self.sample(unit, slot)}, len(messages) + 1, slot))
        body = {"status": "COMPLETE", "slots": [{"slot": i, "leaf_status": "CLOSED_REMOVED"} for i in range(3)],
                "metric_records_ref": W.ref([message["body"] for message in messages if message["event"] == "MEMORY_SAMPLE"]),
                "slot_ledger_ref": W.ref("reserved-three-slots"), "cleanup_records_ref": W.ref("independent-fixture-certificates"),
                "memory_reclamation": "NOT_ESTABLISHED", "missing_evidence": []}
        messages.append(self.envelope(spec, "FINAL", body, len(messages) + 1))
        return messages

    def execute(self, messages=None, *, verifier=True, authenticated=True, clock_after=None, initial_clock=None):
        spec, clock, backend, distribution = self.fixture()
        if initial_clock is not None:
            clock.now = initial_clock
        mappings = self.completed_messages(spec, backend, distribution) if messages is None else messages(spec, backend, distribution)
        packets = [self.packet(message) for message in mappings]
        if clock_after is not None and packets:
            packets[-1] = (packets[-1], clock_after)
        channel = FakeChannel(clock, packets, authenticated)
        proof = FakeVerifier(clock) if verifier is True else verifier
        result = C.Coordinator(spec, channel, clock_us=clock, final_verifier=proof).run()
        return result, channel, proof

    def test_valid_three_slot_protocol_is_complete_only_as_a_hermetic_fixture(self):
        result, channel, proof = self.execute()
        self.assertEqual(result.status, "COMPLETE")
        self.assertEqual(result.mode, "hermetic")
        self.assertTrue(result.certificate_verified)
        self.assertEqual(len(proof.calls), 1)
        self.assertEqual(len(result.samples), 3)
        self.assertEqual(result.to_mapping()["memory_reclamation"], "NOT_ESTABLISHED")
        sent = [message for message, _ in channel.sent]
        self.assertEqual([message["event"] for message in sent], ["ARM", "RUN_SLOT", "RUN_SLOT", "RUN_SLOT", "BEGIN_CLEANUP"])
        self.assertEqual([message["slot"] for message in sent if message["event"] == "RUN_SLOT"], [0, 1, 2])

    def test_sha_shaped_final_refs_without_independent_verifier_are_incomplete(self):
        result, _, _ = self.execute(verifier=None)
        self.assertEqual(result.status, "INCOMPLETE")
        self.assertFalse(result.certificate_verified)
        self.assertIn("REAP_LEDGER", result.missing_evidence)

    def test_initial_authentication_failure_sends_no_arm_or_work(self):
        result, channel, _ = self.execute(authenticated=False)
        self.assertEqual(result.status, "INVALID")
        self.assertIn("AUTHENTICATION", result.faults)
        self.assertEqual(channel.sent, [])

    def test_armed_reply_must_correlate_the_original_arm_request(self):
        for request in (None, 2):
            with self.subTest(request=request):
                def messages(spec, backend, distribution):
                    value = self.armed(spec, backend, distribution)
                    value["request"] = request
                    return [value]
                result, channel, _ = self.execute(messages)
                self.assertEqual(result.status, "INVALID")
                self.assertNotIn("RUN_SLOT", [message["event"] for message, _ in channel.sent])

    def test_armed_payload_hash_deadlines_generation_and_authority_are_original(self):
        for field in ("payload", "deadline", "generation", "lease"):
            with self.subTest(field=field):
                def messages(spec, backend, distribution):
                    body = self.armed(spec, backend, distribution)
                    if field == "payload":
                        body["body"]["payload_binding"]["sha256"] = "e" * 64
                    elif field == "deadline":
                        body["body"]["work_deadline_us"] = "52000000"
                    elif field == "generation":
                        body["body"]["watchdog_generation"] = W.generation(201)
                    else:
                        body["body"]["manager_binding"]["authority_lease_until_us"] = "1000000"
                    return [body]
                result, channel, _ = self.execute(messages)
                self.assertEqual(result.status, "INVALID")
                self.assertNotIn("RUN_SLOT", [message["event"] for message, _ in channel.sent])

    def test_dispatch_reply_must_correlate_the_exact_run_slot_request(self):
        for request in (None, 1, 3):
            with self.subTest(request=request):
                def messages(spec, backend, distribution):
                    values = self.completed_messages(spec, backend, distribution)[:2]
                    values[1]["request"] = request
                    return values
                result, channel, _ = self.execute(messages)
                self.assertEqual(result.status, "INVALID")
                self.assertEqual(len([message for message, _ in channel.sent if message["event"] == "RUN_SLOT"]), 1)

    def test_replayed_or_gapped_peer_sequence_never_causes_more_work(self):
        for seq in (1, 3):
            with self.subTest(seq=seq):
                def messages(spec, backend, distribution):
                    values = self.completed_messages(spec, backend, distribution)[:2]
                    values[1]["seq"] = seq
                    return values
                result, channel, _ = self.execute(messages)
                self.assertEqual(result.status, "INVALID")
                self.assertEqual(len([message for message, _ in channel.sent if message["event"] == "RUN_SLOT"]), 1)

    def test_bound_unit_name_and_slot_must_match_original_reserved_slot(self):
        def messages(spec, backend, distribution):
            values = self.completed_messages(spec, backend, distribution)
            values[4]["body"]["unit_binding"]["name"] = spec.slots[1].unit_name
            return values
        result, _, _ = self.execute(messages)
        self.assertEqual(result.status, "INVALID")
        self.assertEqual(result.samples, ())

    def test_sample_must_reference_the_original_unit_and_cannot_repeat_a_slot(self):
        for mutation in ("foreign", "repeat"):
            with self.subTest(mutation=mutation):
                def messages(spec, backend, distribution):
                    values = self.completed_messages(spec, backend, distribution)
                    if mutation == "foreign":
                        values[5]["body"]["sample"]["unit_binding_ref"] = "e" * 64
                    else:
                        duplicate = deepcopy(values[5])
                        duplicate["seq"] = values[5]["seq"] + 1
                        values.insert(6, duplicate)
                    return values
                result, _, _ = self.execute(messages)
                self.assertEqual(result.status, "INVALID")
                self.assertLessEqual(len(result.samples), 1)

    def test_missing_memory_or_missing_cleanup_certificate_cannot_complete(self):
        for missing in ("sample", "physical"):
            with self.subTest(missing=missing):
                def messages(spec, backend, distribution):
                    values = self.completed_messages(spec, backend, distribution)
                    if missing == "sample":
                        values.pop(9)
                        for seq, value in enumerate(values, 1):
                            value["seq"] = seq
                    else:
                        values[-1]["body"]["status"] = "INCOMPLETE"
                        values[-1]["body"]["slots"][2]["leaf_status"] = "UNKNOWN"
                        values[-1]["body"]["missing_evidence"] = ["PHYSICAL_OBSERVATION"]
                    return values
                result, _, proof = self.execute(messages)
                self.assertEqual(result.status, "INCOMPLETE")
                self.assertFalse(result.certificate_verified)
                self.assertEqual(proof.calls, [])

    def test_fault_is_sticky_even_when_later_final_claims_complete(self):
        def messages(spec, backend, distribution):
            values = self.completed_messages(spec, backend, distribution)
            fault = self.envelope(spec, "FAULT", {"code": "IDENTITY_CHANGED", "at_event": "MEMORY_SAMPLE",
                                                  "identity_ref": "e" * 64, "missing_evidence": ["PHYSICAL_IDENTITY"]}, len(values), slot=0)
            values.insert(-1, fault)
            values[-1]["seq"] += 1
            return values
        result, _, proof = self.execute(messages)
        self.assertEqual(result.status, "INVALID")
        self.assertFalse(result.certificate_verified)
        self.assertEqual(proof.calls, [])

    def test_peer_observation_timestamp_cannot_roll_back_between_messages(self):
        def messages(spec, backend, distribution):
            values = self.completed_messages(spec, backend, distribution)[:3]
            values[1]["mono_us"] = "1000010"
            values[2]["mono_us"] = "1000000"
            retry = deepcopy(values[2])
            retry["seq"] = 4
            retry["mono_us"] = "1000015"
            values.append(retry)
            return values
        result, channel, _ = self.execute(messages, initial_clock=1000020)
        self.assertNotEqual(result.status, "COMPLETE")
        self.assertEqual(result.status, "INVALID")
        self.assertEqual(len([message for message, _ in channel.sent if message["event"] == "RUN_SLOT"]), 2)

    def test_impossible_peer_clock_cannot_be_replaced_with_a_later_valid_reply(self):
        for bad in (999999, 1000021):
            with self.subTest(observed=bad):
                def messages(spec, backend, distribution):
                    first = self.armed(spec, backend, distribution)
                    first["mono_us"] = str(bad)
                    second = self.armed(spec, backend, distribution)
                    second["seq"] = 2
                    return [first, second]
                result, channel, _ = self.execute(messages, initial_clock=1000020)
                self.assertEqual(result.status, "INVALID")
                self.assertNotIn("RUN_SLOT", [message["event"] for message, _ in channel.sent])

    def test_final_verifier_finishing_at_original_cleanup_deadline_cannot_certify(self):
        spec, clock, backend, distribution = self.fixture()
        channel = FakeChannel(clock, [self.packet(message) for message in self.completed_messages(spec, backend, distribution)])
        proof = FakeVerifier(clock, after=spec.cleanup_deadline_us)
        result = C.Coordinator(spec, channel, clock_us=clock, final_verifier=proof).run()
        self.assertEqual(result.status, "INCOMPLETE")
        self.assertFalse(result.certificate_verified)
        self.assertIn("DEADLINE", result.missing_evidence)
        self.assertEqual(len(result.samples), 3)

    def test_closed_peer_or_ambiguous_send_enters_cleanup_once_without_retrying_a_slot(self):
        spec, clock, backend, distribution = self.fixture()
        channel = FakeChannel(clock, [self.packet(self.armed(spec, backend, distribution))])
        channel.send_failure = ConnectionError("uncertain delivery")
        result = C.Coordinator(spec, channel, clock_us=clock).run()
        self.assertEqual(result.status, "INCOMPLETE")
        self.assertLessEqual(len([message for message, _ in channel.sent if message["event"] == "BEGIN_CLEANUP"]), 1)
        self.assertNotIn("RUN_SLOT", [message["event"] for message, _ in channel.sent])

    def test_private_channel_rejects_truncated_ancillary_metadata_without_host_socket(self):
        class SocketFixture:
            def settimeout(self, value):
                self.timeout = value

            def recvmsg(self, limit, ancillary_limit=0):
                return b"{}", [], 8, None

        channel = object.__new__(C.PrivateSocketChannel)
        channel.clock = lambda: 1000000
        channel.sock = SocketFixture()
        with patch.object(C.socket, "MSG_CTRUNC", 8, create=True), patch.object(C.socket, "MSG_TRUNC", 32, create=True):
            with self.assertRaises(K.ContractError):
                channel.receive(2000000)


if __name__ == "__main__":
    unittest.main()
