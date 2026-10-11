"""V5 consumer fixtures only: no runtime imports, subprocesses or native APIs.

Run only this new delta with the installed Python standard library:
    python -B -m unittest discover -s tests -p test_ci_systemd_synthetic_pilot_v5_composition.py
"""
from __future__ import annotations

from contextlib import contextmanager
import hashlib
import importlib.abc
import importlib.util
import json
from pathlib import Path
import random
import sys
import unittest
from unittest.mock import patch


class _NoRuntimeImports(importlib.abc.MetaPathFinder):
    def find_spec(self, fullname, path=None, target=None):
        if fullname.split(".", 1)[0] in {
            "systemd_memory_runtime", "physical_cgroup", "payload_distribution"
        }:
            raise AssertionError("Native runtime import forbidden in V5 fixtures")
        return None


@contextmanager
def _runtime_import_guard():
    guard = _NoRuntimeImports()
    sys.meta_path.insert(0, guard)
    try:
        yield
    finally:
        sys.meta_path.remove(guard)


_MODULE_PATH = (Path(__file__).resolve().parents[1] / "scripts" / "ci"
                / "invoke-systemd-synthetic-pilot.py")
_MODULE_NAME = "_own_ci_systemd_synthetic_pilot_v5_under_test"
_MODULE_SPEC = importlib.util.spec_from_file_location(_MODULE_NAME, _MODULE_PATH)
if _MODULE_SPEC is None or _MODULE_SPEC.loader is None:
    raise RuntimeError("Own wrapper fixture module could not be located")
PILOT = importlib.util.module_from_spec(_MODULE_SPEC)
sys.modules[_MODULE_NAME] = PILOT
with _runtime_import_guard():
    _MODULE_SPEC.loader.exec_module(PILOT)


RUN = "a" * 32
DEADLINE = 1_060_000_000
NOW = 1_045_000_005
SPEC_PATH = "/run/elogistix-pilot-stage-fixture/spec.json"
ELF_PATH = "/run/elogistix-pilot-stage-fixture/keeper-source.elf"
CONSTANTS = {"WORK_US": 50_000_000, "CLEANUP_US": 60_000_000,
             "MEMORY_MAX_BYTES": 33_554_432, "TASKS_MAX": 8}


class _Clock:
    def __init__(self, value=NOW):
        self.value = value
        self.error = None
        self.calls = 0

    def __call__(self):
        self.calls += 1
        if self.error is not None:
            raise self.error
        return self.value


def _snapshot(stored="COMPLETE", claimed="COMPLETE", provisional="INCOMPLETE"):
    # Synthetic, deliberately distinct bodies: no native certificate is claimed.
    return {
        "retained_record": {
            "run": RUN,
            "final": {"status": stored, "stored_only": "fixture FINAL preimage"},
            "journals": [{"entry": "fixture", "raw": [0, 1, None, True, False]}],
            "graph_preimages": {"sample": {"memory_peak": "8388608"}},
            "slots": [{"slot": index, "samples": [], "faults": []}
                      for index in range(3)],
            "samples": [{"slot": 0, "value": "synthetic raw sample"}],
            "faults": ["SYNTHETIC_UNVERIFIABLE_GRAPH"],
        },
        "coordinator_result": {
            "status": provisional,
            "claimed_status": claimed,
            "certificate_verified": False,
            "missing_evidence": ["SYNTHETIC_UNVERIFIABLE_GRAPH"],
            "provisional_only": "fixture summary before watchdog wait",
        },
        "provenance": {
            "phase": "POST_COORDINATOR_PRE_WATCHDOG_WAIT",
            "run": RUN,
            "original_store_identity": {"dev": "23", "inode": "456"},
            "captured_before_us": str(NOW - 5),
            "captured_after_us": str(NOW - 1),
            "cleanup_deadline_us": str(DEADLINE),
            "watchdog_wait_pending": True,
            "stored_final_status_matches_coordinator_claim": stored == claimed,
            "stored_final_status_matches_coordinator_status": stored == provisional,
        },
    }


def _consumer(clock=None, **overrides):
    settings = {"run": RUN, "cleanup_deadline_us": DEADLINE,
                "clock_us": clock if clock is not None else _Clock(),
                "shared_constants": CONSTANTS.copy()}
    settings.update(overrides)
    return PILOT.V5InvocationConsumer(**settings)


def _canonical(value):
    return json.dumps(value, ensure_ascii=False, sort_keys=True,
                      separators=(",", ":"), allow_nan=False).encode("utf-8")


def _delivered(consumer):
    raw = consumer.evidence_bytes
    if type(raw) is not bytes:
        raise AssertionError("Expected complete retained evidence bytes")
    return json.loads(raw.decode("utf-8"))


class ConstructorAndAbortTests(unittest.TestCase):
    def test_shared_constants_are_mandatory(self):
        with self.assertRaises(TypeError):
            PILOT.V5InvocationConsumer(run=RUN, cleanup_deadline_us=DEADLINE,
                                       clock_us=_Clock())

    def test_shared_constants_must_be_exact_closed_and_integer(self):
        bad = [None, {}, {**CONSTANTS, "EXTRA": 1},
               {k: v for k, v in CONSTANTS.items() if k != "WORK_US"}]
        for key, value in CONSTANTS.items():
            bad.extend(({**CONSTANTS, key: value + 1},
                        {**CONSTANTS, key: True},
                        {**CONSTANTS, key: str(value)}))
        for item in bad:
            with self.subTest(constants=item):
                with self.assertRaises((PILOT.PilotValidationError, TypeError)):
                    _consumer(shared_constants=item)

    def test_initial_evidence_is_absent_and_continue_is_exact_false(self):
        consumer = _consumer()
        self.assertIsNone(consumer.evidence_bytes)
        self.assertIs(consumer.abort_requested(), False)

    def test_deadline_boundary_aborts_without_renewal(self):
        clock = _Clock()
        consumer = _consumer(clock)
        clock.value = DEADLINE - 1
        self.assertIs(consumer.abort_requested(), False)
        clock.value = DEADLINE
        self.assertIs(consumer.abort_requested(), True)
        clock.value = NOW
        self.assertIs(consumer.abort_requested(), True)

    def test_clock_errors_unknown_types_and_out_of_range_latch_abort(self):
        for value in (None, True, False, "1", 1.0, -1, (1 << 64)):
            with self.subTest(value=value):
                clock = _Clock()
                consumer = _consumer(clock)
                clock.value = value
                self.assertIs(consumer.abort_requested(), True)
                clock.value = NOW
                self.assertIs(consumer.abort_requested(), True)
        clock = _Clock()
        consumer = _consumer(clock)
        clock.error = RuntimeError("synthetic clock failure")
        self.assertIs(consumer.abort_requested(), True)
        clock.error = None
        self.assertIs(consumer.abort_requested(), True)

    def test_clock_regression_latches_abort_without_repair(self):
        clock = _Clock()
        consumer = _consumer(clock)
        self.assertIs(consumer.abort_requested(), False)
        clock.value = NOW - 1
        self.assertIs(consumer.abort_requested(), True)
        clock.value = NOW + 1
        self.assertIs(consumer.abort_requested(), True)

    def test_callbacks_do_not_open_files_or_import_native_modules(self):
        consumer = _consumer()
        with _runtime_import_guard(), patch("builtins.open", side_effect=AssertionError("No callback I/O")):
            self.assertIs(consumer.abort_requested(), False)
            self.assertIs(consumer.evidence_sink(_snapshot(), deadline_us=DEADLINE), True)

    def test_deadline_and_clock_inputs_are_validated_without_invocation(self):
        for value in (None, True, "60000000", 0, -1, 1 << 64):
            with self.subTest(deadline=value):
                with self.assertRaises((PILOT.PilotValidationError, TypeError)):
                    _consumer(cleanup_deadline_us=value)
        for value in (None, 1, "clock"):
            with self.subTest(clock=value):
                with self.assertRaises((PILOT.PilotValidationError, TypeError)):
                    _consumer(clock_us=value)

    def test_explicit_supervisor_abort_is_irreversible_and_first_reason_survives(self):
        consumer = _consumer()
        consumer.request_abort("SYNTHETIC_BUDGET_ABORT")
        self.assertIs(consumer.abort_requested(), True)
        consumer.request_abort("SYNTHETIC_SECOND_REASON")
        consumer.capture_error("stderr", "READ_ERROR")
        receipt = consumer.receipt()
        self.assertEqual(receipt["first_failure"], "SYNTHETIC_BUDGET_ABORT")
        self.assertTrue(receipt["abort_requested"])
        self.assertFalse(receipt["runtime_ready"])

    def test_unknown_supervisor_abort_reason_consumes_abort(self):
        for reason in (None, True, "", "lowercase", "BAD REASON", "X" * 65):
            consumer = _consumer()
            with self.subTest(reason=reason):
                self.assertIs(consumer.request_abort(reason), False)
                self.assertIs(consumer.abort_requested(), True)


class EvidenceCopyTests(unittest.TestCase):
    def _reject(self, snapshot, deadline=DEADLINE):
        consumer = _consumer()
        self.assertIs(consumer.evidence_sink(snapshot, deadline_us=deadline), False)
        self.assertFalse(consumer.receipt()["evidence_acknowledged"])
        # A complete raw copy may be retained despite rejected provenance.
        # Such bytes remain evidence of failure, never an acknowledgement.
        if consumer.evidence_bytes is not None:
            self.assertEqual(json.loads(consumer.evidence_bytes), snapshot)
        self.assertIs(consumer.abort_requested(), True)

    def test_complete_copy_includes_raw_record_and_distinct_provisional_summary(self):
        snapshot = _snapshot()
        consumer = _consumer()
        self.assertIs(consumer.evidence_sink(snapshot, deadline_us=DEADLINE), True)
        self.assertEqual(consumer.evidence_bytes, _canonical(snapshot))
        delivered = _delivered(consumer)
        self.assertEqual(delivered["retained_record"]["final"]["status"], "COMPLETE")
        self.assertEqual(delivered["coordinator_result"]["status"], "INCOMPLETE")
        self.assertFalse(delivered["coordinator_result"]["certificate_verified"])
        self.assertIn("stored_only", delivered["retained_record"]["final"])
        self.assertIn("provisional_only", delivered["coordinator_result"])
        self.assertIs(consumer.abort_requested(), False)

    def test_copy_is_immune_to_caller_mutation_after_acknowledgement(self):
        snapshot = _snapshot()
        consumer = _consumer()
        self.assertIs(consumer.evidence_sink(snapshot, deadline_us=DEADLINE), True)
        first = consumer.evidence_bytes
        snapshot["retained_record"]["final"].clear()
        snapshot["coordinator_result"]["status"] = "COMPLETE"
        snapshot["provenance"].clear()
        self.assertEqual(consumer.evidence_bytes, first)
        self.assertEqual(_delivered(consumer)["coordinator_result"]["status"], "INCOMPLETE")

    def test_copy_receipt_hashes_whole_snapshot_and_does_not_claim_custody(self):
        snapshot = _snapshot()
        consumer = _consumer()
        self.assertIs(consumer.evidence_sink(snapshot, deadline_us=DEADLINE), True)
        raw = _canonical(snapshot)
        receipt = consumer.receipt()
        self.assertTrue(receipt["evidence_delivery_attempted"])
        self.assertTrue(receipt["evidence_acknowledged"])
        self.assertEqual(receipt["evidence_bytes"], len(raw))
        self.assertEqual(receipt["evidence_sha256"], hashlib.sha256(raw).hexdigest())
        self.assertFalse(receipt["authorization_authenticated"])
        self.assertFalse(receipt["custody_authenticated"])
        self.assertFalse(receipt["certificate_verified_by_wrapper"])
        self.assertFalse(receipt["runtime_ready"])

    def test_expiry_during_callback_never_acknowledges_partial_delivery(self):
        class ExpiringClock(_Clock):
            def __call__(self):
                self.calls += 1
                return NOW if self.calls < 16 else DEADLINE
        clock = ExpiringClock()
        consumer = _consumer(clock)
        self.assertIs(consumer.evidence_sink(_snapshot(), deadline_us=DEADLINE), False)
        self.assertTrue(consumer.receipt()["abort_requested"])
        self.assertFalse(consumer.receipt()["evidence_acknowledged"])
        self.assertIsNone(consumer.evidence_bytes)

    def test_rejected_provenance_keeps_raw_copy_as_unacknowledged_failure_evidence(self):
        snapshot = _snapshot()
        snapshot["provenance"]["run"] = "b" * 32
        consumer = _consumer()
        self.assertIs(consumer.evidence_sink(snapshot, deadline_us=DEADLINE), False)
        self.assertEqual(consumer.evidence_bytes, _canonical(snapshot))
        self.assertFalse(consumer.receipt()["evidence_acknowledged"])
        self.assertIs(consumer.abort_requested(), True)

    def test_false_status_match_metadata_is_valid_without_promoting_result(self):
        snapshot = _snapshot(stored="INVALID", claimed="COMPLETE", provisional="INCOMPLETE")
        consumer = _consumer()
        self.assertIs(consumer.evidence_sink(snapshot, deadline_us=DEADLINE), True)
        delivered = _delivered(consumer)
        self.assertFalse(delivered["provenance"]["stored_final_status_matches_coordinator_claim"])
        self.assertFalse(delivered["provenance"]["stored_final_status_matches_coordinator_status"])
        self.assertEqual(delivered["retained_record"]["final"]["status"], "INVALID")

    def test_received_final_and_provisional_equality_are_checked_separately(self):
        for stored in ("COMPLETE", "INCOMPLETE", "INVALID"):
            for claimed in ("COMPLETE", "INCOMPLETE", "INVALID"):
                for provisional in ("COMPLETE", "INCOMPLETE", "INVALID"):
                    with self.subTest(stored=stored, claimed=claimed, provisional=provisional):
                        consumer = _consumer()
                        snapshot = _snapshot(stored, claimed, provisional)
                        self.assertIs(consumer.evidence_sink(snapshot, deadline_us=DEADLINE), True)
                        self.assertEqual(_delivered(consumer), snapshot)

    def test_second_sink_call_never_overwrites_first_copy_and_latches_abort(self):
        consumer = _consumer()
        self.assertIs(consumer.evidence_sink(_snapshot(), deadline_us=DEADLINE), True)
        first = consumer.evidence_bytes
        self.assertIs(consumer.evidence_sink(_snapshot(stored="INVALID"), deadline_us=DEADLINE), False)
        self.assertEqual(consumer.evidence_bytes, first)
        self.assertIs(consumer.abort_requested(), True)

    def test_invalid_first_call_cannot_be_repaired_by_later_valid_call(self):
        consumer = _consumer()
        self.assertIs(consumer.evidence_sink({}, deadline_us=DEADLINE), False)
        first = consumer.evidence_bytes
        self.assertIs(consumer.evidence_sink(_snapshot(), deadline_us=DEADLINE), False)
        self.assertEqual(consumer.evidence_bytes, first)
        self.assertIs(consumer.abort_requested(), True)

    def test_top_level_is_exactly_the_public_v5_envelope(self):
        for value in (None, [], "snapshot", True, {}, {**_snapshot(), "extra": None}):
            with self.subTest(value=type(value).__name__):
                self._reject(value)
        for key in _snapshot():
            snapshot = _snapshot()
            del snapshot[key]
            with self.subTest(missing=key):
                self._reject(snapshot)

    def test_provenance_and_identity_are_closed(self):
        for key in _snapshot()["provenance"]:
            snapshot = _snapshot()
            del snapshot["provenance"][key]
            with self.subTest(missing=key):
                self._reject(snapshot)
        snapshot = _snapshot()
        snapshot["provenance"]["extra"] = "x"
        self._reject(snapshot)
        for identity in ({}, {"dev": "1"}, {"inode": "2"},
                         {"dev": "1", "inode": "2", "extra": 3}, [], None):
            snapshot = _snapshot()
            snapshot["provenance"]["original_store_identity"] = identity
            with self.subTest(identity=identity):
                self._reject(snapshot)

    def test_store_identity_is_canonical_decimal_with_positive_inode(self):
        for key in ("dev", "inode"):
            invalid = (0, 1, True, None, "", "01", "+1", "-1", "1.0",
                       " 1", "1 ", "1\n", "١", "1e2", str(1 << 64))
            if key == "inode":
                invalid += ("0",)
            for value in invalid:
                snapshot = _snapshot()
                snapshot["provenance"]["original_store_identity"][key] = value
                with self.subTest(key=key, value=value):
                    self._reject(snapshot)
        snapshot = _snapshot()
        # The owner exposes st_dev as text; a zero device number is possible.
        snapshot["provenance"]["original_store_identity"]["dev"] = "0"
        consumer = _consumer()
        self.assertIs(consumer.evidence_sink(snapshot, deadline_us=DEADLINE), True)
        self.assertEqual(_delivered(consumer), snapshot)

    def test_run_phase_and_pending_are_exact(self):
        cases = (("run", "b" * 32), ("run", RUN.upper()), ("run", None),
                 ("phase", "POST_WATCHDOG_WAIT"), ("phase", ""),
                 ("watchdog_wait_pending", False), ("watchdog_wait_pending", 1),
                 ("watchdog_wait_pending", "true"))
        for key, value in cases:
            snapshot = _snapshot()
            snapshot["provenance"][key] = value
            with self.subTest(key=key, value=value):
                self._reject(snapshot)

    def test_callback_deadline_and_original_deadline_cannot_diverge(self):
        for value in (DEADLINE - 1, DEADLINE + 1, str(DEADLINE), True, None):
            with self.subTest(argument=value):
                self._reject(_snapshot(), deadline=value)
        for value in (str(DEADLINE - 1), str(DEADLINE + 1), DEADLINE, True, None,
                      "0" + str(DEADLINE)):
            snapshot = _snapshot()
            snapshot["provenance"]["cleanup_deadline_us"] = value
            with self.subTest(provenance=value):
                self._reject(snapshot)

    def test_capture_bracket_must_be_ordered_not_future_and_before_deadline(self):
        for before, after in ((NOW, NOW - 1), (NOW, NOW + 1),
                              (DEADLINE, DEADLINE), ("01", NOW), (-1, NOW)):
            snapshot = _snapshot()
            snapshot["provenance"]["captured_before_us"] = str(before)
            snapshot["provenance"]["captured_after_us"] = str(after)
            with self.subTest(before=before, after=after):
                self._reject(snapshot)
        snapshot = _snapshot()
        snapshot["provenance"]["captured_before_us"] = str(NOW)
        snapshot["provenance"]["captured_after_us"] = str(NOW)
        consumer = _consumer()
        self.assertIs(consumer.evidence_sink(snapshot, deadline_us=DEADLINE), True)

    def test_sink_rejects_when_clock_has_reached_deadline(self):
        consumer = _consumer(_Clock(DEADLINE))
        self.assertIs(consumer.evidence_sink(_snapshot(), deadline_us=DEADLINE), False)
        self.assertIsNone(consumer.evidence_bytes)
        self.assertIs(consumer.abort_requested(), True)

    def test_status_match_metadata_must_be_boolean_without_reverification(self):
        for key in ("stored_final_status_matches_coordinator_claim",
                    "stored_final_status_matches_coordinator_status"):
            for value in (None, 0, 1, "true"):
                snapshot = _snapshot()
                snapshot["provenance"][key] = value
                with self.subTest(key=key, value=value):
                    self._reject(snapshot)
            snapshot = _snapshot()
            snapshot["provenance"][key] = not snapshot["provenance"][key]
            consumer = _consumer()
            self.assertIs(consumer.evidence_sink(snapshot, deadline_us=DEADLINE), True)
            self.assertEqual(_delivered(consumer), snapshot)
            self.assertFalse(consumer.receipt()["certificate_verified_by_wrapper"])

    def test_record_run_and_final_container_are_required_without_graph_verifier(self):
        for key in ("run", "final"):
            snapshot = _snapshot()
            del snapshot["retained_record"][key]
            with self.subTest(key=key):
                self._reject(snapshot)
        for section, key in (("coordinator_result", "status"),
                             ("coordinator_result", "claimed_status"),
                             ("final", "status")):
            snapshot = _snapshot()
            target = snapshot["retained_record"]["final"] if section == "final" else snapshot[section]
            del target[key]
            consumer = _consumer()
            with self.subTest(section=section, key=key):
                self.assertIs(consumer.evidence_sink(snapshot, deadline_us=DEADLINE), True)
                self.assertEqual(_delivered(consumer), snapshot)
                self.assertFalse(consumer.receipt()["certificate_verified_by_wrapper"])

    def test_byte_bound_accepts_exact_limit_and_rejects_one_byte_more(self):
        snapshot = _snapshot()
        snapshot["retained_record"]["padding"] = ""
        overhead = len(_canonical(snapshot))
        snapshot["retained_record"]["padding"] = "x" * (524288 - overhead)
        self.assertEqual(len(_canonical(snapshot)), 524288)
        consumer = _consumer()
        self.assertIs(consumer.evidence_sink(snapshot, deadline_us=DEADLINE), True)
        self.assertEqual(len(consumer.evidence_bytes), 524288)
        snapshot["retained_record"]["padding"] += "x"
        self._reject(snapshot)

    def test_utf8_bound_counts_bytes_without_truncating_record(self):
        snapshot = _snapshot()
        snapshot["retained_record"]["padding"] = "é" * 262144
        self.assertGreater(len(_canonical(snapshot)), 524288)
        self._reject(snapshot)

    def test_deep_graph_rejected_without_recursion_error(self):
        snapshot = _snapshot()
        nested = []
        for _ in range(70):
            nested = [nested]
        snapshot["retained_record"]["nested"] = nested
        self._reject(snapshot)

    def test_node_bound_rejected_even_when_canonical_bytes_are_small(self):
        snapshot = _snapshot()
        snapshot["retained_record"]["nodes"] = [None] * 32768
        self.assertLess(len(_canonical(snapshot)), 524288)
        self._reject(snapshot)

    def test_cycles_are_rejected_without_losing_abort(self):
        for cycle in ([], {}):
            if type(cycle) is list:
                cycle.append(cycle)
            else:
                cycle["cycle"] = cycle
            snapshot = _snapshot()
            snapshot["retained_record"]["cycle"] = cycle
            with self.subTest(cycle_type=type(cycle).__name__):
                self._reject(snapshot)

    def test_reused_container_alias_is_rejected_as_non_decoded_graph(self):
        snapshot = _snapshot()
        shared = {"sample": "synthetic"}
        snapshot["retained_record"]["aliases"] = [shared, shared]
        self._reject(snapshot)

    def test_builtin_only_graph_rejects_objects_subclasses_and_floats(self):
        class DictSubclass(dict):
            pass
        class ListSubclass(list):
            pass
        class StringSubclass(str):
            pass
        class IntSubclass(int):
            pass
        for value in (object(), (), set(), b"bytes", bytearray(b"bytes"),
                      1.0, float("nan"), float("inf"), DictSubclass(),
                      ListSubclass(), StringSubclass("x"), IntSubclass(1)):
            snapshot = _snapshot()
            snapshot["retained_record"]["bad"] = value
            with self.subTest(value_type=type(value).__name__):
                self._reject(snapshot)

    def test_keys_and_strings_must_be_real_utf8(self):
        for value in ({1: "integer key"}, {None: "null key"},
                      {"surrogate": "\ud800"}, {"\udfff": "surrogate key"}):
            snapshot = _snapshot()
            snapshot["retained_record"]["bad"] = value
            with self.subTest(value=repr(value)):
                self._reject(snapshot)


class CaptureAndInvocationTests(unittest.TestCase):
    def test_capture_both_streams_complete_without_runtime_certification(self):
        consumer = _consumer()
        consumer.capture_chunk("stdout", b'{"status":"INCOMPLETE"}\n')
        consumer.capture_chunk("stderr", b"synthetic diagnostic\n")
        consumer.capture_eof("stdout")
        consumer.capture_eof("stderr")
        receipt = consumer.receipt()
        self.assertIs(receipt["runtime_ready"], False)

    def test_capture_overflow_or_error_consumes_irreversible_abort(self):
        for stream in ("stdout", "stderr"):
            consumer = _consumer()
            for _ in range(8):
                consumer.capture_chunk(stream, b"x" * 8192)
            self.assertIs(consumer.abort_requested(), False)
            consumer.capture_chunk(stream, b"x")
            self.assertIs(consumer.abort_requested(), True)
            consumer.capture_eof(stream)
            self.assertIs(consumer.abort_requested(), True)
            consumer = _consumer()
            consumer.capture_error(stream, "SYNTHETIC_READ_ERROR")
            self.assertIs(consumer.abort_requested(), True)

    def test_capture_bad_stream_bad_chunk_and_feed_after_eof_latch_abort(self):
        for operation in (lambda c: c.capture_chunk("other", b"x"),
                          lambda c: c.capture_chunk("stdout", "text"),
                          lambda c: c.capture_chunk("stdout", b"x" * 8193),
                          lambda c: c.capture_eof("other"),
                          lambda c: c.capture_error("other", "READ_ERROR"),
                          lambda c: c.capture_error("stdout", "not a code")):
            consumer = _consumer()
            try:
                operation(consumer)
            except (PILOT.PilotValidationError, TypeError, ValueError):
                pass
            self.assertIs(consumer.abort_requested(), True)
        consumer = _consumer()
        consumer.capture_eof("stdout")
        try:
            consumer.capture_chunk("stdout", b"x")
        except PILOT.PilotValidationError:
            pass
        self.assertIs(consumer.abort_requested(), True)

    def test_capture_failure_prevents_sink_acknowledgement(self):
        consumer = _consumer()
        consumer.capture_error("stderr", "READ_ERROR")
        self.assertIs(consumer.evidence_sink(_snapshot(), deadline_us=DEADLINE), False)
        self.assertFalse(consumer.receipt()["evidence_acknowledged"])
        if consumer.evidence_bytes is not None:
            self.assertEqual(_delivered(consumer), _snapshot())

    def test_acknowledged_copy_survives_later_capture_failure(self):
        consumer = _consumer()
        self.assertIs(consumer.evidence_sink(_snapshot(), deadline_us=DEADLINE), True)
        first = consumer.evidence_bytes
        consumer.capture_error("stdout", "READ_ERROR")
        self.assertEqual(consumer.evidence_bytes, first)
        self.assertIs(consumer.abort_requested(), True)

    def test_invoke_calls_exact_argv_and_only_public_hooks(self):
        consumer = _consumer()
        calls = []
        def reviewed_fixture(argv, **kwargs):
            calls.append((argv, kwargs))
            self.assertIs(kwargs["abort_requested"](), False)
            self.assertIs(kwargs["evidence_sink"](_snapshot(), deadline_us=DEADLINE), True)
            return 3
        with _runtime_import_guard():
            self.assertEqual(consumer.invoke(reviewed_fixture, spec_path=SPEC_PATH,
                                             source_elf_path=ELF_PATH), 3)
        self.assertEqual(len(calls), 1)
        self.assertEqual(calls[0][0], ["run", "--spec", SPEC_PATH, "--source-elf", ELF_PATH])
        self.assertEqual(set(calls[0][1]), {"evidence_sink", "abort_requested"})
        self.assertIs(calls[0][1]["evidence_sink"].__self__, consumer)
        self.assertIs(calls[0][1]["abort_requested"].__self__, consumer)
        self.assertEqual(_delivered(consumer)["coordinator_result"]["status"], "INCOMPLETE")

    def test_runtime_exit_codes_are_observed_without_success_promotion(self):
        for code in (0, 2, 3):
            consumer = _consumer()
            def fixture(argv, **kwargs):
                kwargs["evidence_sink"](_snapshot(stored="INVALID"), deadline_us=DEADLINE)
                return code
            with self.subTest(code=code):
                self.assertEqual(consumer.invoke(fixture, spec_path=SPEC_PATH,
                                                 source_elf_path=ELF_PATH), code)
                self.assertEqual(_delivered(consumer)["retained_record"]["final"]["status"], "INVALID")
                self.assertFalse(consumer.receipt()["runtime_ready"])

    def test_unknown_returns_and_runtime_exception_abort_without_retry(self):
        for result in (None, True, False, "0", 0.0, 1, -1, 4, {}):
            consumer = _consumer()
            calls = []
            def fixture(argv, **kwargs):
                calls.append(1)
                return result
            with self.subTest(result=result):
                self.assertIsNone(consumer.invoke(fixture, spec_path=SPEC_PATH,
                                                  source_elf_path=ELF_PATH))
                self.assertIs(consumer.abort_requested(), True)
                self.assertIsNone(consumer.invoke(fixture, spec_path=SPEC_PATH,
                                                  source_elf_path=ELF_PATH))
                self.assertEqual(len(calls), 1)
        consumer = _consumer()
        def raises(argv, **kwargs):
            raise RuntimeError("synthetic runtime failure")
        self.assertIsNone(consumer.invoke(raises, spec_path=SPEC_PATH, source_elf_path=ELF_PATH))
        self.assertIs(consumer.abort_requested(), True)

    def test_delivered_raw_copy_survives_runtime_exception(self):
        consumer = _consumer()
        def fixture(argv, **kwargs):
            self.assertIs(kwargs["evidence_sink"](_snapshot(), deadline_us=DEADLINE), True)
            raise RuntimeError("fixture watchdog wait failure after export")
        self.assertIsNone(consumer.invoke(fixture, spec_path=SPEC_PATH, source_elf_path=ELF_PATH))
        self.assertEqual(_delivered(consumer), _snapshot())
        receipt = consumer.receipt()
        self.assertTrue(receipt["evidence_acknowledged"])
        self.assertEqual(receipt["invocation_error"], "RuntimeError")
        self.assertIsNone(receipt["exit_code"])
        self.assertIs(consumer.abort_requested(), True)

    def test_captured_final_summary_can_differ_from_pre_wait_snapshot(self):
        consumer = _consumer()
        final_summary = {"status": "INVALID", "certificate_verified": False,
                         "missing_evidence": ["WATCHDOG_WAIT"],
                         "evidence_export": {"status": "EXPORTED"}}
        def fixture(argv, **kwargs):
            self.assertIs(kwargs["evidence_sink"](_snapshot(), deadline_us=DEADLINE), True)
            consumer.capture_chunk("stdout", _canonical(final_summary))
            consumer.capture_eof("stdout")
            consumer.capture_eof("stderr")
            return 3
        self.assertEqual(consumer.invoke(fixture, spec_path=SPEC_PATH, source_elf_path=ELF_PATH), 3)
        self.assertEqual(consumer.runtime_result(), final_summary)
        delivered = _delivered(consumer)
        self.assertEqual(delivered["retained_record"]["final"]["status"], "COMPLETE")
        self.assertEqual(delivered["coordinator_result"]["status"], "INCOMPLETE")
        self.assertEqual(consumer.receipt()["capture_outcome"], "RUNTIME_FAILED")
        self.assertEqual(consumer.receipt()["exit_code"], 3)
        self.assertFalse(consumer.receipt()["runtime_ready"])

    def test_successful_invocation_is_also_one_shot(self):
        consumer = _consumer()
        calls = []
        def fixture(argv, **kwargs):
            calls.append(1)
            return 0
        self.assertEqual(consumer.invoke(fixture, spec_path=SPEC_PATH, source_elf_path=ELF_PATH), 0)
        self.assertIsNone(consumer.invoke(fixture, spec_path=SPEC_PATH, source_elf_path=ELF_PATH))
        self.assertEqual(len(calls), 1)
        self.assertIs(consumer.abort_requested(), True)

    def test_aborted_consumer_does_not_invoke_callable(self):
        consumer = _consumer()
        consumer.capture_error("stdout", "READ_ERROR")
        calls = []
        def fixture(argv, **kwargs):
            calls.append(1)
            return 0
        self.assertIsNone(consumer.invoke(fixture, spec_path=SPEC_PATH, source_elf_path=ELF_PATH))
        self.assertEqual(calls, [])

    def test_invalid_absolute_paths_do_not_call_fixture(self):
        for path in ("", "relative/spec.json", "C:\\spec.json", "/run/../spec.json",
                     "/run/./spec.json", "/run//spec.json", "/run/spec.json\n",
                     "/run/spec.json\x00", "/", None, True):
            for field in ("spec_path", "source_elf_path"):
                consumer = _consumer()
                calls = []
                def fixture(argv, **kwargs):
                    calls.append(1)
                    return 0
                kwargs = {"spec_path": SPEC_PATH, "source_elf_path": ELF_PATH, field: path}
                with self.subTest(field=field, path=repr(path)):
                    self.assertIsNone(consumer.invoke(fixture, **kwargs))
                    self.assertEqual(calls, [])
                    self.assertIs(consumer.abort_requested(), True)

    def test_receipt_reports_incomplete_capture_even_if_observed_exit_is_zero(self):
        consumer = _consumer()
        self.assertEqual(consumer.invoke(lambda argv, **kwargs: 0, spec_path=SPEC_PATH,
                                         source_elf_path=ELF_PATH), 0)
        self.assertFalse(consumer.receipt()["runtime_ready"])
        self.assertEqual(consumer.receipt()["capture_outcome"], "INCOMPLETE")
        self.assertEqual(consumer.receipt()["exit_code"], 0)
        self.assertFalse(consumer.receipt()["stdout"]["eof"])
        self.assertFalse(consumer.receipt()["stderr"]["eof"])


class WholeStdoutTests(unittest.TestCase):
    def _feed(self, raw, *, eof=True):
        consumer = _consumer()
        for start in range(0, len(raw), 8192):
            consumer.capture_chunk("stdout", raw[start:start + 8192])
        if eof:
            consumer.capture_eof("stdout")
        return consumer

    def test_valid_prefix_is_not_parsed_before_observed_eof(self):
        consumer = self._feed(b'{"status":"COMPLETE"}', eof=False)
        with patch.object(PILOT.json, "loads", side_effect=AssertionError("Prefix must not be parsed")):
            self.assertIsNone(consumer.runtime_result())
        self.assertFalse(consumer.receipt()["stdout"]["eof"])
        consumer.capture_eof("stdout")
        self.assertEqual(consumer.runtime_result(), {"status": "COMPLETE"})
        self.assertFalse(consumer.receipt()["certificate_verified_by_wrapper"])

    def test_overflow_never_parses_retained_prefix_even_if_it_looks_valid(self):
        raw = b'{"status":"COMPLETE"}' + b" " * 65536
        consumer = self._feed(raw)
        with patch.object(PILOT.json, "loads", side_effect=AssertionError("Truncated prefix must not be parsed")):
            self.assertIsNone(consumer.runtime_result())
        receipt = consumer.receipt()["stdout"]
        self.assertEqual(receipt["status"], "OVERFLOW")
        self.assertEqual(receipt["retained_bytes"], 65536)
        self.assertEqual(receipt["observed_bytes"], len(raw))
        self.assertEqual(receipt["sha256_retained"], hashlib.sha256(raw[:65536]).hexdigest())
        self.assertEqual(receipt["sha256_full"], hashlib.sha256(raw).hexdigest())
        self.assertIs(consumer.abort_requested(), True)

    def test_read_error_prevents_prefix_parsing_even_after_eof(self):
        consumer = self._feed(b'{"status":"COMPLETE"}')
        consumer.capture_error("stdout", "READ_ERROR")
        with patch.object(PILOT.json, "loads", side_effect=AssertionError("Failed capture must not be parsed")):
            self.assertIsNone(consumer.runtime_result())
        self.assertEqual(consumer.receipt()["stdout"]["status"], "INCOMPLETE")
        self.assertIsNone(consumer.receipt()["stdout"]["sha256_full"])

    def test_complete_stdout_is_strict_json_object_without_type_coercion(self):
        invalid = (b'{"status":"COMPLETE","status":"INVALID"}',
                   br'{"s":1,"\u0073":2}', b'{"value":1.0}',
                   b'{"value":NaN}', b'{"value":Infinity}',
                   b'{"value":18446744073709551616}',
                   br'{"value":"\ud800"}', b'{"bad": "\xff"}',
                   b'{"status":"COMPLETE"}\n{"status":"INVALID"}',
                   b"[]", b"null", b"true", b"", b"{broken")
        for raw in invalid:
            with self.subTest(raw=raw):
                consumer = self._feed(raw)
                self.assertIsNone(consumer.runtime_result())
                self.assertIs(consumer.abort_requested(), True)

    def test_exact_capture_limit_whole_stdout_is_accepted_as_data_only(self):
        raw = b'{"status":"COMPLETE"}'
        raw += b" " * (65536 - len(raw))
        consumer = self._feed(raw)
        self.assertEqual(consumer.runtime_result(), {"status": "COMPLETE"})
        receipt = consumer.receipt()
        self.assertEqual(receipt["stdout"]["status"], "COMPLETE")
        self.assertEqual(receipt["stdout"]["observed_bytes"], 65536)
        self.assertFalse(receipt["runtime_ready"])
        self.assertFalse(receipt["authorization_authenticated"])
        self.assertFalse(receipt["custody_authenticated"])
        self.assertFalse(receipt["certificate_verified_by_wrapper"])

    def test_native_summary_can_exceed_the_pure_scope_depth_six(self):
        value = "sample"
        for _ in range(12):
            value = {"nested": value}
        result = {"status": "INCOMPLETE", "samples": [value]}
        consumer = self._feed(_canonical(result))
        self.assertEqual(consumer.runtime_result(), result)

    def test_graph_depth_bound_applies_to_complete_stdout(self):
        value = []
        for _ in range(70):
            value = [value]
        consumer = self._feed(_canonical({"status": "COMPLETE", "value": value}))
        self.assertIsNone(consumer.runtime_result())
        self.assertIs(consumer.abort_requested(), True)

    def test_200_fragmentations_preserve_raw_stream_and_parse_only_whole_capture(self):
        # Different chunk boundaries exercise UTF-8 splits and independent stderr.
        result = {"status": "INVALID", "faults": ["árbol", "fixture"],
                  "samples": [{"slot": i, "value": str(i)} for i in range(3)]}
        raw = _canonical(result) + b"\n"
        stderr = "diagnóstico sintético\n".encode("utf-8")
        for seed in range(200):
            with self.subTest(seed=seed):
                rng = random.Random(seed)
                consumer = _consumer()
                position = 0
                while position < len(raw):
                    width = rng.randrange(1, 31)
                    self.assertIs(consumer.capture_chunk("stdout", raw[position:position + width]), True)
                    position += width
                position = 0
                while position < len(stderr):
                    width = rng.randrange(1, 7)
                    self.assertIs(consumer.capture_chunk("stderr", stderr[position:position + width]), True)
                    position += width
                self.assertIsNone(consumer.runtime_result())
                self.assertIs(consumer.capture_eof("stdout"), True)
                self.assertIs(consumer.capture_eof("stderr"), True)
                self.assertEqual(consumer.runtime_result(), result)
                receipt = consumer.receipt()
                self.assertEqual(receipt["stdout"]["sha256_full"], hashlib.sha256(raw).hexdigest())
                self.assertEqual(receipt["stderr"]["sha256_full"], hashlib.sha256(stderr).hexdigest())
                self.assertEqual(receipt["stdout"]["discarded_observed_bytes"], 0)
                self.assertFalse(receipt["runtime_ready"])
                self.assertEqual(receipt["capture_outcome"], "INCOMPLETE")

    def test_eof_at_expired_original_deadline_preserves_capture_but_aborts(self):
        clock = _Clock()
        consumer = _consumer(clock)
        self.assertIs(consumer.capture_chunk("stdout", b'{"status":"INVALID"}'), True)
        clock.value = DEADLINE
        self.assertIs(consumer.capture_eof("stdout"), False)
        receipt = consumer.receipt()["stdout"]
        self.assertTrue(receipt["eof"])
        self.assertEqual(receipt["status"], "INCOMPLETE")
        self.assertIs(consumer.abort_requested(), True)


class BoundInvocationContractTests(unittest.TestCase):
    # bound_main_called records entry into the supplied binding only. A binding
    # can reject before invoking canonical M.main; fixtures certify neither.
    def test_bound_main_receives_no_positional_args_and_only_the_two_public_hooks(self):
        consumer = _consumer()
        calls = []
        def bound_fixture(*args, **kwargs):
            calls.append((args, kwargs))
            self.assertEqual(args, ())
            self.assertEqual(set(kwargs), {"evidence_sink", "abort_requested"})
            self.assertIs(kwargs["abort_requested"](), False)
            self.assertIs(kwargs["evidence_sink"](_snapshot(), deadline_us=DEADLINE), True)
            return 0
        with _runtime_import_guard():
            self.assertEqual(consumer.invoke_bound(bound_fixture), 0)
        self.assertEqual(len(calls), 1)
        self.assertIs(calls[0][1]["evidence_sink"].__self__, consumer)
        self.assertIs(calls[0][1]["abort_requested"].__self__, consumer)
        receipt = consumer.receipt()
        self.assertTrue(receipt["bound_main_called"])
        self.assertFalse(receipt["runtime_ready"])
        self.assertFalse(receipt["authorization_authenticated"])
        self.assertFalse(receipt["custody_authenticated"])

    def test_bound_and_fixture_adapter_share_one_irreversible_invocation_attempt(self):
        for first in ("bound", "adapter"):
            with self.subTest(first=first):
                consumer = _consumer()
                calls = []
                def bound_fixture(*, evidence_sink, abort_requested):
                    calls.append("bound")
                    return 0
                def adapter_fixture(argv, **kwargs):
                    calls.append("adapter")
                    return 0
                def bound_call():
                    return consumer.invoke_bound(bound_fixture)
                def adapter_call():
                    return consumer.invoke(adapter_fixture, spec_path=SPEC_PATH,
                                           source_elf_path=ELF_PATH)
                primary, secondary = (bound_call, adapter_call) if first == "bound" else (adapter_call, bound_call)
                self.assertEqual(primary(), 0)
                self.assertIsNone(secondary())
                self.assertEqual(calls, [first])
                self.assertIs(consumer.abort_requested(), True)
                self.assertEqual(consumer.receipt()["first_failure"], "V5_REPEATED_INVOCATION")

    def test_invalid_bound_callable_consumes_attempt_without_calling_binding(self):
        for value in (None, True, False, "main", {}, 0):
            consumer = _consumer()
            with self.subTest(value=value):
                self.assertIsNone(consumer.invoke_bound(value))
                self.assertIs(consumer.abort_requested(), True)
                receipt = consumer.receipt()
                self.assertTrue(receipt["invocation_attempted"])
                self.assertFalse(receipt["bound_main_called"])
                self.assertIsNone(receipt["exit_code"])
                calls = []
                def retry(*, evidence_sink, abort_requested):
                    calls.append(1)
                    return 0
                self.assertIsNone(consumer.invoke_bound(retry))
                self.assertEqual(calls, [])

    def test_bool_bound_return_is_not_an_exit_code_and_never_retries(self):
        for result in (True, False):
            consumer = _consumer()
            calls = []
            def bound_fixture(*, evidence_sink, abort_requested):
                calls.append(1)
                return result
            with self.subTest(result=result):
                self.assertIsNone(consumer.invoke_bound(bound_fixture))
                self.assertEqual(calls, [1])
                self.assertIs(consumer.abort_requested(), True)
                receipt = consumer.receipt()
                self.assertTrue(receipt["bound_main_called"])
                self.assertIsNone(receipt["exit_code"])
                self.assertIsNone(consumer.invoke_bound(bound_fixture))
                self.assertEqual(calls, [1])

    def test_abort_before_bound_invocation_never_calls_binding(self):
        consumer = _consumer()
        consumer.request_abort("SYNTHETIC_BUDGET_ABORT")
        calls = []
        def bound_fixture(*, evidence_sink, abort_requested):
            calls.append(1)
            return 0
        self.assertIsNone(consumer.invoke_bound(bound_fixture))
        self.assertEqual(calls, [])
        receipt = consumer.receipt()
        self.assertTrue(receipt["invocation_attempted"])
        self.assertFalse(receipt["bound_main_called"])
        self.assertIsNone(receipt["exit_code"])
        self.assertTrue(receipt["abort_requested"])
        self.assertEqual(receipt["first_failure"], "SYNTHETIC_BUDGET_ABORT")


if __name__ == "__main__":
    unittest.main()
