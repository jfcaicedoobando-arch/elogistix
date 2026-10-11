"""Abort-hook regressions with existing hermetic coordinator fixtures only.

No sockets, native processes, manager calls or workload execution are performed.
The callback is a trusted cooperative caller operation, not a preemption API.
"""
from contextlib import redirect_stderr, redirect_stdout
from copy import deepcopy
import io
import json
from pathlib import Path
import sys
import tempfile
from types import SimpleNamespace
import unittest
from unittest.mock import patch


TESTS = Path(__file__).resolve().parent
sys.path.insert(0, str(TESTS.parent.parent))
sys.path.insert(0, str(TESTS))
import test_coordinator as F
from systemd_memory_runtime import coordinator as C
from systemd_memory_runtime import __main__ as M
from systemd_memory_runtime.preflight import PreflightResult


class AbortHookTest(unittest.TestCase):
    def execute(self, guard_factory=None, *, messages=None, authenticated=True,
                public_run=False, initial_clock=None):
        fixtures = F.CoordinatorTest()
        spec, clock, backend, distribution = fixtures.fixture()
        if initial_clock is not None:
            clock.now = initial_clock
        mappings = (fixtures.completed_messages(spec, backend, distribution) if messages is None
                    else messages(fixtures, spec, backend, distribution))
        channel = F.FakeChannel(clock, [fixtures.packet(value) for value in mappings], authenticated)
        verifier = F.FakeVerifier(clock)
        context = SimpleNamespace(spec=spec, clock=clock, channel=channel, verifier=verifier,
                                  fixtures=fixtures, coordinator=None, guard_calls=[])
        guard = guard_factory(context) if guard_factory is not None else None
        context.guard = guard
        if public_run:
            result = C.run(spec, channel, clock_us=clock, final_verifier=verifier,
                           abort_requested=guard)
        else:
            context.coordinator = C.Coordinator(spec, channel, clock_us=clock,
                                               final_verifier=verifier, abort_requested=guard)
            result = context.coordinator.run()
        return result, context

    @staticmethod
    def early_final(fixtures, spec, backend, distribution):
        values = fixtures.completed_messages(spec, backend, distribution)
        final = deepcopy(values[-1])
        final["seq"] = 2
        return [values[0], final]

    @staticmethod
    def single_slot_then_final(fixtures, spec, backend, distribution):
        values = fixtures.completed_messages(spec, backend, distribution)
        selected = [values[index] for index in (0, 1, 4, 5, 10)]
        for sequence, value in enumerate(selected, 1):
            value["seq"] = sequence
        return selected

    @staticmethod
    def sends(context, event):
        return [value for value, _deadline in context.channel.sent if value["event"] == event]

    def assert_aborted(self, result, context, *, slots=(), sample_count=0, invalid=False):
        self.assertEqual(result.status, "INVALID" if invalid else "INCOMPLETE")
        self.assertEqual(result.mode, "hermetic")
        self.assertFalse(result.certificate_verified)
        self.assertEqual(context.verifier.calls, [])
        self.assertEqual(result.faults.count("AUTHORITY"), 1)
        self.assertEqual([value["slot"] for value in self.sends(context, "RUN_SLOT")], list(slots))
        self.assertEqual(len(self.sends(context, "BEGIN_CLEANUP")), 1)
        self.assertEqual(len(result.samples), sample_count)

    def test_true_after_valid_armed_aborts_before_first_dispatch(self):
        result, context = self.execute(lambda ctx: lambda: True, messages=self.early_final)
        self.assert_aborted(result, context)
        self.assertEqual([value["event"] for value, _ in context.channel.sent], ["ARM", "BEGIN_CLEANUP"])
        self.assertEqual(self.sends(context, "BEGIN_CLEANUP")[0]["body"], {"reason": "FAULT"})

    def test_abort_between_first_dispatch_ack_and_second_slot_preserves_first_sample(self):
        def guard_factory(context):
            return lambda: bool(context.coordinator.transcript and
                                context.coordinator.transcript[-1]["event"] == "START_DISPATCHED")
        result, context = self.execute(guard_factory, messages=self.single_slot_then_final)
        self.assert_aborted(result, context, slots=(0,), sample_count=1)
        self.assertEqual(result.samples[0]["bytes"], "48000000")

    def test_abort_at_loop_boundary_before_next_receive_is_irreversible(self):
        def guard_factory(context):
            def guard():
                context.guard_calls.append(len(context.channel.receives))
                # The arming guard ran; the following loop boundary still has
                # exactly one received packet and one dispatched slot.
                return bool(self.sends(context, "RUN_SLOT"))
            return guard
        result, context = self.execute(guard_factory, messages=self.single_slot_then_final)
        self.assert_aborted(result, context, slots=(0,), sample_count=1)
        self.assertEqual(context.guard_calls, [1, 1])

    def test_late_true_after_final_receive_never_verifies_claimed_complete(self):
        def guard_factory(context):
            return lambda: bool(context.coordinator.transcript and
                                context.coordinator.transcript[-1]["event"] == "FINAL")
        result, context = self.execute(guard_factory)
        self.assert_aborted(result, context, slots=(0, 1, 2), sample_count=3)
        self.assertEqual(result.claimed_status, "COMPLETE")
        self.assertEqual([value["bytes"] for value in result.samples], ["48000000", "48000001", "48000002"])

    def test_revocation_during_final_verification_cannot_certify_complete(self):
        def guard_factory(context):
            context.revoked = False
            original_verify = context.verifier.verify
            def verify(*args):
                accepted = original_verify(*args)
                context.revoked = True
                return accepted
            context.verifier.verify = verify
            return lambda: context.revoked
        result, context = self.execute(guard_factory)
        self.assertEqual(result.status, "INCOMPLETE")
        self.assertEqual(result.claimed_status, "COMPLETE")
        self.assertFalse(result.certificate_verified)
        self.assertEqual(result.faults.count("AUTHORITY"), 1)
        self.assertEqual(len(context.verifier.calls), 1)
        self.assertEqual(len(result.samples), 3)
        self.assertEqual(len(self.sends(context, "BEGIN_CLEANUP")), 1)
        self.assertTrue(context.coordinator.abort_consumed)

    def test_abort_preserves_previously_collected_samples_before_final(self):
        def guard_factory(context):
            return lambda: len(context.coordinator.samples) == 3
        result, context = self.execute(guard_factory)
        self.assert_aborted(result, context, slots=(0, 1, 2), sample_count=3)
        self.assertEqual(self.sends(context, "BEGIN_CLEANUP")[0]["body"], {"reason": "FAULT"})

    def test_non_exact_bool_results_remove_authority(self):
        for returned in (None, 0, 1, "False", [], object()):
            with self.subTest(returned_type=type(returned).__name__):
                result, context = self.execute(lambda ctx: lambda: returned, messages=self.early_final)
                self.assert_aborted(result, context)

    def test_callback_exception_removes_authority_without_disclosing_message(self):
        def guard_factory(context):
            def guard():
                raise RuntimeError("private callback detail must not enter the result")
            return guard
        result, context = self.execute(guard_factory, messages=self.early_final)
        self.assert_aborted(result, context)
        self.assertNotIn("private callback", json.dumps(result.to_mapping()))

    def test_abort_consumed_once_cannot_be_reversed_by_later_false(self):
        def guard_factory(context):
            def guard():
                context.guard_calls.append(True)
                return len(context.guard_calls) == 1
            return guard
        result, context = self.execute(guard_factory, messages=self.early_final)
        self.assert_aborted(result, context)
        self.assertEqual(context.guard_calls, [True])
        self.assertTrue(context.coordinator.cleanup)
        self.assertTrue(context.coordinator.abort_consumed)

    def test_false_nominal_preserves_three_slot_dispatch_and_verification(self):
        def guard_factory(context):
            def guard():
                context.guard_calls.append(True)
                return False
            return guard
        result, context = self.execute(guard_factory)
        self.assertEqual(result.status, "COMPLETE")
        self.assertTrue(result.certificate_verified)
        self.assertEqual(result.faults, ())
        self.assertEqual(len(context.verifier.calls), 1)
        self.assertEqual([value["slot"] for value in self.sends(context, "RUN_SLOT")], [0, 1, 2])
        self.assertEqual(self.sends(context, "BEGIN_CLEANUP")[0]["body"], {"reason": "NORMAL"})
        self.assertGreater(len(context.guard_calls), 3)

    def test_omitted_guard_keeps_existing_nominal_behavior(self):
        result, context = self.execute()
        self.assertEqual(result.status, "COMPLETE")
        self.assertEqual(len(context.verifier.calls), 1)
        self.assertEqual(len(result.samples), 3)

    def test_invalid_final_remains_invalid_after_abort_and_keeps_samples(self):
        def messages(fixtures, spec, backend, distribution):
            values = fixtures.completed_messages(spec, backend, distribution)
            values[-1]["body"]["status"] = "INVALID"
            return values
        def guard_factory(context):
            return lambda: bool(context.coordinator.transcript and
                                context.coordinator.transcript[-1]["event"] == "FINAL")
        result, context = self.execute(guard_factory, messages=messages)
        self.assert_aborted(result, context, slots=(0, 1, 2), sample_count=3, invalid=True)

    def test_invalid_armed_never_invokes_guard_or_dispatches(self):
        def messages(fixtures, spec, backend, distribution):
            return [fixtures.armed(spec, backend, distribution, work_deadline_us="52000000")]
        def guard_factory(context):
            def guard():
                self.fail("invalid ARMED granted the caller guard a dispatch boundary")
            return guard
        result, context = self.execute(guard_factory, messages=messages)
        self.assertEqual(result.status, "INVALID")
        self.assertEqual(self.sends(context, "RUN_SLOT"), [])
        self.assertEqual(context.verifier.calls, [])

    def test_failed_channel_authentication_never_invokes_guard(self):
        def guard_factory(context):
            def guard():
                self.fail("unauthenticated channel invoked abort guard")
            return guard
        result, context = self.execute(guard_factory, authenticated=False)
        self.assertEqual(result.status, "INVALID")
        self.assertEqual(context.channel.sent, [])

    def test_callback_crossing_original_work_deadline_cannot_dispatch(self):
        def guard_factory(context):
            def guard():
                context.clock.now = context.spec.work_deadline_us
                return False
            return guard
        result, context = self.execute(guard_factory, messages=self.early_final)
        self.assertNotEqual(result.status, "COMPLETE")
        self.assertFalse(result.certificate_verified)
        self.assertEqual(self.sends(context, "RUN_SLOT"), [])
        self.assertEqual(context.verifier.calls, [])
        self.assertTrue(context.coordinator.cleanup)
        self.assertEqual(self.sends(context, "BEGIN_CLEANUP")[0]["body"], {"reason": "DEADLINE"})
        self.assertNotIn("TRANSPORT_UNKNOWN", result.faults)
        self.assertNotIn("AUTHORITY", result.faults)
        self.assertEqual(context.coordinator.transcript[-1]["event"], "FINAL")
        self.assertEqual(result.claimed_status, "COMPLETE")
        self.assertTrue(all(deadline <= context.spec.cleanup_deadline_us for _, deadline in context.channel.sent))

    def test_late_callback_at_cleanup_deadline_cannot_verify_complete(self):
        def guard_factory(context):
            def guard():
                if context.coordinator.transcript and context.coordinator.transcript[-1]["event"] == "FINAL":
                    context.clock.now = context.spec.cleanup_deadline_us
                return False
            return guard
        result, context = self.execute(guard_factory)
        self.assert_aborted(result, context, slots=(0, 1, 2), sample_count=3)
        self.assertIn("DEADLINE", result.missing_evidence)
        self.assertEqual(result.claimed_status, "COMPLETE")
        self.assertEqual(context.spec.cleanup_deadline_us, 61_000_000)

    def test_public_run_forwards_guard_and_still_rejects_unknown_authority(self):
        result, context = self.execute(lambda ctx: lambda: True,
                                       messages=self.early_final, public_run=True)
        self.assert_aborted(result, context)

    def test_public_main_forwards_same_guard_without_invoking_it_or_native_runtime(self):
        fixtures = F.CoordinatorTest()
        spec, _clock, _backend, _distribution = fixtures.fixture()
        def guard():
            self.fail("CLI forwarding invoked callback outside coordinator")
        output, errors = io.StringIO(), io.StringIO()
        with tempfile.TemporaryDirectory(prefix="abort-hook-", dir=TESTS) as directory:
            path = Path(directory) / "spec.json"
            path.write_text(json.dumps(spec.to_mapping()), encoding="utf-8")
            with patch.object(M, "preflight", return_value=PreflightResult(True, {"fixture_only": True}, ())) as preflight:
                with patch.object(M, "_native_runtime", return_value={"status": "INCOMPLETE", "mode": "hermetic"}) as runtime:
                    with redirect_stdout(output), redirect_stderr(errors):
                        code = M.main(["run", "--spec", str(path), "--source-elf", "/fixture/source-elf"],
                                      preflight_fn=preflight, abort_requested=guard)
        self.assertEqual(code, 3)
        self.assertEqual(json.loads(output.getvalue())["status"], "INCOMPLETE")
        self.assertIs(runtime.call_args.kwargs["abort_requested"], guard)
        self.assertEqual(runtime.call_args.kwargs["source_elf"], "/fixture/source-elf")
        self.assertEqual(errors.getvalue(), "")


if __name__ == "__main__":
    unittest.main()
