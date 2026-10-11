"""Public export-hook boundary with hermetic parent-process syscall fixtures.

The real CLI, retained-store decoder and export path run. Linux, fork, pidfd,
manager, physical observations and workload execution are never performed.
"""
from contextlib import ExitStack, redirect_stderr, redirect_stdout
from copy import deepcopy
from dataclasses import replace
import io
import json
from pathlib import Path
import sys
import tempfile
from types import SimpleNamespace
import unittest
from unittest.mock import patch


PACKAGE = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PACKAGE.parent))
sys.path.insert(0, str(Path(__file__).resolve().parent))
import test_cli as CLI
from systemd_memory_runtime import __main__ as M
from systemd_memory_runtime import sd_bus_transport as T
from systemd_memory_runtime.coordinator import RunResult
from systemd_memory_runtime.preflight import PreflightResult


class ParentNativeFixture:
    """Substitute every OS operation while preserving the real retained store."""

    def __init__(self, *, status="INCOMPLETE", stored_status=None, claimed_status=None):
        self.spec = CLI.fixture_module.RunSpec.from_mapping(CLI.fixture_module.spec_mapping())
        self.now = 5_000_000
        self.log, self.closed, self.offset = [], set(), 0
        self.dev, self.inode, self.owner, self.mode, self.nlink = 31, 410, 0, 0o100600, 1
        self.read_error = None
        self.prepare_error = None
        self.wait_error = None
        self.wait_pending = False
        self.poll_error = None
        self.after_coordinator = None
        self.after_read = None
        self.sample = {"slot": 0, "memory_peak_bytes": None, "complete": False, "reason": "UNKNOWN_MEMORY"}
        self.result = RunResult(
            status, "hermetic", (self.sample,),
            tuple({"slot": slot, "leaf_status": "UNKNOWN"} for slot in range(3)),
            ("UNKNOWN_MEMORY",) if status != "COMPLETE" else (),
            ("IDENTITY_CHANGED",) if status == "INVALID" else (),
            claimed_status or stored_status or status, status == "COMPLETE",
        )
        final_status = stored_status or status
        self.record = {
            "run": self.spec.run, "fixture_only": False,
            "final": {
                "status": final_status,
                "slots": [{"slot": slot, "leaf_status": "CLOSED_REMOVED" if final_status == "COMPLETE" else "UNKNOWN"} for slot in range(3)],
                "metric_records_ref": "a" * 64,
                "slot_ledger_ref": "b" * 64,
                "cleanup_records_ref": "c" * 64,
                "memory_reclamation": "NOT_ESTABLISHED",
                "missing_evidence": [] if final_status == "COMPLETE" else ["UNKNOWN_MEMORY"],
            },
            "slots": [{"slot": 0, "sample": deepcopy(self.sample), "closure_proof": {"tag": "Unavailable", "reason": "UNKNOWN_MEMORY"}}],
            "observer_journal": {"records": [{"kind": "FULL_OBSERVATION", "body": {"value": None, "source": "retained-fixture"}}]},
            "physical_producer_journal": {"records": [{"kind": "FULL_PERIMETER", "body": {"identity": {"dev": "31", "inode": "410"}}}]},
        }
        self.raw_override = None

    def encoded(self):
        return self.raw_override if self.raw_override is not None else json.dumps(self.record, separators=(",", ":")).encode()

    def clock(self):
        return self.now

    def fstat(self, fd):
        self.log.append(("fstat", fd))
        if fd in self.closed:
            raise OSError("closed fixture descriptor")
        if fd == 10:
            return SimpleNamespace(st_uid=0, st_mode=0o40700, st_nlink=1, st_dev=31, st_ino=409)
        if fd != 11:
            raise AssertionError("unexpected fstat descriptor")
        return SimpleNamespace(st_uid=self.owner, st_mode=self.mode, st_nlink=self.nlink, st_dev=self.dev, st_ino=self.inode)

    def close(self, fd):
        self.log.append(("close", fd))
        self.closed.add(fd)

    def lseek(self, fd, offset, whence):
        if fd != 11 or offset != 0 or whence != M.os.SEEK_SET:
            raise AssertionError("unexpected retained-store seek")
        self.log.append("store.seek")
        self.offset = 0
        return 0

    def read(self, fd, size):
        if fd != 11:
            raise AssertionError("unexpected retained-store read")
        self.log.append("store.read")
        if self.read_error is not None:
            raise self.read_error
        raw = self.encoded()
        value = raw[self.offset:self.offset + size]
        self.offset += len(value)
        if self.after_read is not None:
            self.after_read(self)
        return value

    def waitpid(self, pid, options):
        if pid != 200 or options != M.os.WNOHANG:
            raise AssertionError("unexpected own-child wait")
        self.log.append("watchdog.wait")
        if self.wait_error is not None:
            raise self.wait_error
        return (0 if self.wait_pending else 200), 0

    def poll(self, *args):
        self.log.append("poller.poll")
        if self.poll_error is not None:
            raise self.poll_error
        raise AssertionError("fixture never performs an unbounded polling loop")

    def run_coordinator(self):
        self.log.append("coordinator.run")
        if self.after_coordinator is not None:
            self.after_coordinator(self)
        return self.result

    def install(self, stack):
        owner = self

        class Distribution:
            def __init__(self, **kwargs):
                owner.log.append("distribution.construct")

            def prepare(self, spec, deadline):
                owner.log.append("distribution.prepare")
                if owner.prepare_error is not None:
                    raise owner.prepare_error
                return {"fixture": "local-payload"}

            def verify(self, payload, deadline):
                owner.log.append("distribution.verify")

        class Resource:
            def __init__(self, label, fd=None, generation=None):
                self.label, self.fd, self.generation = label, fd, generation

            def close(self):
                owner.log.append(self.label + ".close")

        pins = [Resource("coordinator.pin", 70, {"pid": 100}), Resource("watchdog.pin", 71, {"pid": 200})]
        left, right = Resource("left"), Resource("right")
        poller = SimpleNamespace(register=lambda *args: self.log.append("poller.register"), poll=self.poll)
        for name, value in (("O_DIRECTORY", 0x10000), ("O_CLOEXEC", 0x20000), ("O_NOFOLLOW", 0x40000), ("WNOHANG", 1)):
            stack.enter_context(patch.object(M.os, name, value, create=True))
        for name, value in (("AF_UNIX", 1), ("SOCK_SEQPACKET", 5)):
            stack.enter_context(patch.object(M.socket, name, value, create=True))
        for name, value in (("POLLIN", 1), ("POLLERR", 8), ("POLLHUP", 16)):
            stack.enter_context(patch.object(M.select, name, value, create=True))
        stack.enter_context(patch.object(M.sys, "platform", "linux"))
        stack.enter_context(patch.object(M.os, "getpid", return_value=100))
        stack.enter_context(patch.object(M.os, "geteuid", return_value=0, create=True))
        stack.enter_context(patch.object(M.signal, "SIGCHLD", 17, create=True))
        stack.enter_context(patch.object(M.signal, "getsignal", return_value=M.signal.SIG_DFL))
        stack.enter_context(patch.object(M.os, "pidfd_open", create=True))
        stack.enter_context(patch.object(M.os, "fork", side_effect=lambda: (self.log.append("fork"), 200)[1], create=True))
        stack.enter_context(patch.object(M.os.path, "isabs", return_value=True))
        stack.enter_context(patch.object(M.os, "open", side_effect=(10, 11)))
        stack.enter_context(patch.object(M.os, "fstat", side_effect=self.fstat))
        stack.enter_context(patch.object(M.os, "close", side_effect=self.close))
        stack.enter_context(patch.object(M.os, "lseek", side_effect=self.lseek))
        stack.enter_context(patch.object(M.os, "read", side_effect=self.read))
        stack.enter_context(patch.object(M.os, "write", side_effect=AssertionError("parent must not write retained evidence")))
        stack.enter_context(patch.object(M.os, "ftruncate", side_effect=AssertionError("parent must not truncate retained evidence")))
        stack.enter_context(patch.object(M.os, "waitpid", side_effect=self.waitpid, create=True))
        stack.enter_context(patch.object(M.os, "WIFEXITED", return_value=True, create=True))
        stack.enter_context(patch.object(M.os, "WEXITSTATUS", return_value=0, create=True))
        stack.enter_context(patch.object(M.select, "poll", return_value=poller, create=True))
        stack.enter_context(patch.object(M.socket, "socketpair", return_value=(left, right)))
        stack.enter_context(patch.object(M, "monotonic_us", side_effect=self.clock))
        stack.enter_context(patch.object(M.importlib, "import_module", side_effect=lambda name: SimpleNamespace(RuntimeDistribution=Distribution) if name.endswith("payload_distribution") else SimpleNamespace(RuntimePhysicalObserver=object)))
        stack.enter_context(patch.object(T, "process_generation", side_effect=lambda pid: {"pid": pid}))
        stack.enter_context(patch.object(T, "pin_process", side_effect=pins))
        stack.enter_context(patch.object(M, "_ForkCustody", return_value=SimpleNamespace()))
        stack.enter_context(patch.object(M, "PrivateSocketChannel", return_value=SimpleNamespace()))
        stack.enter_context(patch.object(M, "Coordinator", return_value=SimpleNamespace(run=self.run_coordinator)))


class ExportHookTest(unittest.TestCase):
    def invoke(self, fixture, sink=None, *, provide_sink=True, preflight_passed=True):
        output, errors = io.StringIO(), io.StringIO()

        def preflight(spec):
            fixture.log.append("preflight")
            return PreflightResult(preflight_passed, {"fixture_only": True, "probe_mode": "injected"}, () if preflight_passed else ("PAYLOAD_COMPONENT",))

        with tempfile.TemporaryDirectory(prefix="export-hook-", dir=PACKAGE) as directory:
            path = Path(directory) / "spec.json"
            path.write_text(json.dumps(fixture.spec.to_mapping()), encoding="utf-8")
            with ExitStack() as stack:
                fixture.install(stack)
                stack.enter_context(patch.object(M, "preflight", preflight))
                with redirect_stdout(output), redirect_stderr(errors):
                    kwargs = {"preflight_fn": preflight}
                    if provide_sink:
                        kwargs["evidence_sink"] = sink
                    code = M.main(["run", "--spec", str(path), "--source-elf", "/fixture/source-elf"], **kwargs)
        return code, json.loads(output.getvalue()), errors.getvalue()

    def test_public_hook_exports_exact_full_record_before_wait_and_descriptor_close(self):
        fixture, snapshots = ParentNativeFixture(), []
        original = deepcopy(fixture.record)

        def sink(snapshot, *, deadline_us):
            fixture.log.append("sink")
            self.assertNotIn(11, fixture.closed)
            self.assertEqual(deadline_us, fixture.spec.cleanup_deadline_us)
            snapshots.append(deepcopy(snapshot))
            return True

        code, result, _ = self.invoke(fixture, sink)
        self.assertEqual(code, 3)
        self.assertEqual(result["status"], "INCOMPLETE")
        self.assertEqual(len(snapshots), 1)
        self.assertEqual(snapshots[0]["retained_record"], original)
        self.assertEqual(snapshots[0]["coordinator_result"], fixture.result.to_mapping())
        provenance = snapshots[0]["provenance"]
        self.assertEqual(provenance["phase"], "POST_COORDINATOR_PRE_WATCHDOG_WAIT")
        self.assertEqual(provenance["run"], fixture.spec.run)
        self.assertTrue(provenance["watchdog_wait_pending"])
        self.assertEqual(provenance["original_store_identity"], {"dev": "31", "inode": "410"})
        self.assertEqual(provenance["captured_before_us"], "5000000")
        self.assertEqual(provenance["captured_after_us"], "5000000")
        self.assertEqual(provenance["cleanup_deadline_us"], str(fixture.spec.cleanup_deadline_us))
        self.assertLess(fixture.log.index("coordinator.run"), fixture.log.index("sink"))
        self.assertLess(fixture.log.index("sink"), fixture.log.index("watchdog.wait"))
        self.assertLess(fixture.log.index("sink"), fixture.log.index(("close", 11)))

    def test_divergent_complete_stored_final_never_promotes_coordinator_incomplete_or_invalid(self):
        for status in ("INCOMPLETE", "INVALID"):
            with self.subTest(status=status):
                fixture, snapshots = ParentNativeFixture(status=status, stored_status="COMPLETE"), []
                code, result, _ = self.invoke(fixture, lambda snapshot, **kwargs: (snapshots.append(deepcopy(snapshot)), True)[1])
                self.assertEqual(code, 3)
                self.assertEqual(result["status"], status)
                self.assertFalse(result["certificate_verified"])
                self.assertEqual(snapshots[0]["retained_record"]["final"]["status"], "COMPLETE")
                self.assertEqual(snapshots[0]["coordinator_result"]["status"], status)
                self.assertTrue(snapshots[0]["provenance"]["stored_final_status_matches_coordinator_claim"])
                self.assertFalse(snapshots[0]["provenance"]["stored_final_status_matches_coordinator_status"])
                self.assertEqual(result["samples"], [fixture.sample])

    def test_callback_mutation_cannot_change_retained_record_or_coordinator_result(self):
        fixture = ParentNativeFixture(status="INVALID")
        record, samples = deepcopy(fixture.record), deepcopy(fixture.result.samples)

        def sink(snapshot, *, deadline_us):
            snapshot["retained_record"].clear()
            snapshot["coordinator_result"]["samples"][0]["memory_peak_bytes"] = 0
            snapshot["coordinator_result"]["status"] = "COMPLETE"
            snapshot["provenance"].clear()
            return True

        _, result, _ = self.invoke(fixture, sink)
        self.assertEqual(fixture.record, record)
        self.assertEqual(fixture.result.samples, samples)
        self.assertEqual(result["samples"], list(samples))
        self.assertEqual(result["status"], "INVALID")
        self.assertEqual(result["faults"], ["IDENTITY_CHANGED"])

    def test_actual_stored_final_mismatch_is_delivered_unchanged_but_cannot_be_certified(self):
        fixture = ParentNativeFixture(status="COMPLETE", stored_status="INCOMPLETE", claimed_status="COMPLETE")
        snapshots = []
        code, result, _ = self.invoke(fixture, lambda snapshot, **kwargs: (snapshots.append(deepcopy(snapshot)), True)[1])
        self.assertEqual(code, 3)
        self.assertEqual(snapshots[0]["retained_record"], fixture.record)
        self.assertEqual(snapshots[0]["coordinator_result"]["status"], "COMPLETE")
        self.assertFalse(snapshots[0]["provenance"]["stored_final_status_matches_coordinator_claim"])
        self.assertFalse(snapshots[0]["provenance"]["stored_final_status_matches_coordinator_status"])
        self.assertEqual(result["status"], "INCOMPLETE")
        self.assertFalse(result["certificate_verified"])
        self.assertIn("STORED_FINAL_STATUS_MISMATCH", result["missing_evidence"])
        self.assertEqual(result["evidence_export"]["status"], "EXPORTED")

    def test_callback_requires_exact_true_and_preserves_samples_faults(self):
        for returned in (False, None, 1, "true", {}):
            with self.subTest(returned=returned):
                fixture = ParentNativeFixture(status="INVALID")
                _, result, _ = self.invoke(fixture, lambda snapshot, **kwargs: returned)
                self.assertEqual(result["status"], "INVALID")
                self.assertFalse(result["certificate_verified"])
                self.assertEqual(result["samples"], [fixture.sample])
                self.assertEqual(result["faults"], ["IDENTITY_CHANGED"])
                self.assertIn("EVIDENCE_EXPORT_UNAVAILABLE", result["missing_evidence"])

    def test_callback_exception_downgrades_complete_and_never_emits_exception_details(self):
        fixture = ParentNativeFixture(status="COMPLETE")

        def sink(snapshot, *, deadline_us):
            raise PermissionError("PRIVATE_CALLBACK_FAILURE")

        code, result, errors = self.invoke(fixture, sink)
        self.assertEqual(code, 3)
        self.assertEqual(result["status"], "INCOMPLETE")
        self.assertFalse(result["certificate_verified"])
        self.assertEqual(result["samples"], [fixture.sample])
        self.assertIn("EVIDENCE_EXPORT_UNAVAILABLE", result["missing_evidence"])
        self.assertNotIn("PRIVATE_CALLBACK_FAILURE", json.dumps(result) + errors)

    def test_after_callback_rechecks_original_inode_permissions_and_deadline(self):
        mutations = (
            lambda fixture: setattr(fixture, "inode", 411),
            lambda fixture: setattr(fixture, "owner", 1001),
            lambda fixture: setattr(fixture, "mode", 0o100644),
            lambda fixture: setattr(fixture, "nlink", 0),
            lambda fixture: setattr(fixture, "now", fixture.spec.cleanup_deadline_us),
        )
        for mutate in mutations:
            with self.subTest(mutation=mutations.index(mutate)):
                fixture = ParentNativeFixture(status="COMPLETE")

                def sink(snapshot, *, deadline_us):
                    mutate(fixture)
                    return True

                _, result, _ = self.invoke(fixture, sink)
                self.assertEqual(result["status"], "INCOMPLETE")
                self.assertFalse(result["certificate_verified"])
                self.assertEqual(result["samples"], [fixture.sample])
                self.assertIn("EVIDENCE_EXPORT_UNAVAILABLE", result["missing_evidence"])

    def test_wait_errors_after_successful_export_preserve_samples_faults_and_export_acknowledgement(self):
        cases = (("INVALID", OSError("PRIVATE_WAIT_ERROR")),
                 ("INCOMPLETE", ChildProcessError("PRIVATE_WAIT_ERROR")),
                 ("COMPLETE", OSError("PRIVATE_WAIT_ERROR")))
        for status, error in cases:
            with self.subTest(status=status, error=type(error).__name__):
                fixture, snapshots = ParentNativeFixture(status=status), []
                fixture.wait_error = error
                code, result, errors = self.invoke(fixture, lambda snapshot, **kwargs: (snapshots.append(deepcopy(snapshot)), True)[1])
                self.assertEqual(code, 3)
                self.assertEqual(len(snapshots), 1)
                self.assertEqual(snapshots[0]["coordinator_result"]["status"], status)
                self.assertEqual(result["status"], "INVALID" if status == "INVALID" else "INCOMPLETE")
                self.assertFalse(result["certificate_verified"])
                self.assertEqual(result["samples"], [fixture.sample])
                self.assertEqual(result["faults"], list(fixture.result.faults))
                self.assertIn("WATCHDOG_WAIT", result["missing_evidence"])
                self.assertNotIn("EVIDENCE_EXPORT_UNAVAILABLE", result["missing_evidence"])
                self.assertEqual(result["evidence_export"]["status"], "EXPORTED")
                self.assertFalse(result["watchdog_wait"]["consumed"])
                self.assertNotIn("PRIVATE_WAIT_ERROR", json.dumps(result) + errors)

    def test_poll_error_after_export_is_unconfirmed_wait_and_preserves_invalid_result(self):
        fixture, snapshots = ParentNativeFixture(status="INVALID"), []
        fixture.wait_pending = True
        fixture.poll_error = OSError("PRIVATE_POLL_ERROR")
        _, result, _ = self.invoke(fixture, lambda snapshot, **kwargs: (snapshots.append(deepcopy(snapshot)), True)[1])
        self.assertEqual(len(snapshots), 1)
        self.assertEqual(result["status"], "INVALID")
        self.assertEqual(result["samples"], [fixture.sample])
        self.assertEqual(result["faults"], ["IDENTITY_CHANGED"])
        self.assertFalse(result["certificate_verified"])
        self.assertFalse(result["watchdog_wait"]["consumed"])
        self.assertIn("WATCHDOG_WAIT", result["missing_evidence"])
        self.assertEqual(result["evidence_export"]["status"], "EXPORTED")
        self.assertLess(fixture.log.index("store.read"), fixture.log.index("poller.poll"))

    def test_unavailable_retained_store_never_calls_callback(self):
        for error in (PermissionError("private read denied"), OSError("private read failed")):
            with self.subTest(error=type(error).__name__):
                fixture = ParentNativeFixture()
                fixture.read_error = error
                calls = []
                _, result, _ = self.invoke(fixture, lambda snapshot, **kwargs: calls.append(snapshot))
                self.assertEqual(calls, [])
                self.assertEqual(result["samples"], [fixture.sample])
                self.assertIn("EVIDENCE_EXPORT_UNAVAILABLE", result["missing_evidence"])

    def test_decode_rejects_duplicate_keys_floats_and_oversized_store_before_callback(self):
        for raw in (b'{"run":"a","run":"b"}', b'{"run":"a","unexpected":0.5}', b"x" * (M.STORE_LIMIT + 1)):
            with self.subTest(raw_length=len(raw)):
                fixture, calls = ParentNativeFixture(), []
                fixture.raw_override = raw
                _, result, _ = self.invoke(fixture, lambda snapshot, **kwargs: calls.append(snapshot))
                self.assertEqual(calls, [])
                self.assertEqual(result["samples"], [fixture.sample])
                self.assertIn("EVIDENCE_EXPORT_UNAVAILABLE", result["missing_evidence"])

    def test_deadline_or_custody_lost_after_coordinator_does_not_call_callback(self):
        for mutate in (lambda fixture: setattr(fixture, "now", fixture.spec.cleanup_deadline_us),
                       lambda fixture: setattr(fixture, "inode", 999)):
            with self.subTest(mutation=repr(mutate)):
                fixture, calls = ParentNativeFixture(), []
                fixture.after_coordinator = mutate
                _, result, _ = self.invoke(fixture, lambda snapshot, **kwargs: calls.append(snapshot))
                self.assertEqual(calls, [])
                self.assertEqual(result["samples"], [fixture.sample])
                self.assertIn("EVIDENCE_EXPORT_UNAVAILABLE", result["missing_evidence"])

    def test_no_final_never_calls_hook_or_fabricates_raw_evidence(self):
        fixture, calls = ParentNativeFixture(), []
        del fixture.record["final"]
        _, result, _ = self.invoke(fixture, lambda snapshot, **kwargs: calls.append(snapshot))
        self.assertEqual(calls, [])
        self.assertIn("EVIDENCE_EXPORT_UNAVAILABLE", result["missing_evidence"])
        self.assertEqual(result["evidence_export"], {"status": "UNAVAILABLE", "delivery_attempted": False})

    def test_coordinator_without_received_final_does_not_read_or_export_stored_claim(self):
        fixture, calls = ParentNativeFixture(), []
        fixture.result = replace(fixture.result, claimed_status=None)
        record = deepcopy(fixture.record)
        _, result, _ = self.invoke(fixture, lambda snapshot, **kwargs: calls.append(snapshot))
        self.assertEqual(calls, [])
        self.assertNotIn("store.read", fixture.log)
        self.assertEqual(fixture.record, record)
        self.assertEqual(result["samples"], [fixture.sample])
        self.assertEqual(result["evidence_export"], {"status": "UNAVAILABLE", "delivery_attempted": False})

    def test_early_bootstrap_failure_and_failed_preflight_do_not_invoke_export_sink(self):
        for bootstrap in (False, True):
            with self.subTest(bootstrap=bootstrap):
                fixture, calls = ParentNativeFixture(), []
                if bootstrap:
                    fixture.prepare_error = PermissionError("PRIVATE_BOOTSTRAP_FAILURE")
                _, result, _ = self.invoke(fixture, lambda snapshot, **kwargs: calls.append(snapshot), preflight_passed=bootstrap)
                self.assertEqual(calls, [])
                self.assertNotIn("coordinator.run", fixture.log)
                self.assertIn("EVIDENCE_EXPORT_UNAVAILABLE", result["missing_evidence"])
                self.assertEqual(result["evidence_export"], {"status": "UNAVAILABLE", "delivery_attempted": False})
                self.assertEqual(result["status"], "INCOMPLETE")
                self.assertNotIn("PRIVATE_BOOTSTRAP_FAILURE", json.dumps(result))

    def test_store_identity_changed_during_read_never_calls_callback(self):
        fixture, calls = ParentNativeFixture(), []
        fixture.after_read = lambda current: setattr(current, "inode", 411)
        _, result, _ = self.invoke(fixture, lambda snapshot, **kwargs: calls.append(snapshot))
        self.assertEqual(calls, [])
        self.assertEqual(result["samples"], [fixture.sample])
        self.assertIn("EVIDENCE_EXPORT_UNAVAILABLE", result["missing_evidence"])

    def test_original_run_mismatch_or_deadline_expiring_during_read_never_calls_sink(self):
        for bad_run in (False, True):
            with self.subTest(bad_run=bad_run):
                fixture, calls = ParentNativeFixture(), []
                if bad_run:
                    fixture.record["run"] = "f" * 32
                else:
                    fixture.after_read = lambda current: setattr(current, "now", current.spec.cleanup_deadline_us)
                _, result, _ = self.invoke(fixture, lambda snapshot, **kwargs: calls.append(snapshot))
                self.assertEqual(calls, [])
                self.assertEqual(result["samples"], [fixture.sample])
                self.assertIn("EVIDENCE_EXPORT_UNAVAILABLE", result["missing_evidence"])

    def test_full_store_within_limit_is_not_truncated_to_fit_snapshot_metadata(self):
        fixture, calls = ParentNativeFixture(), []
        fixture.record["padding"] = ""
        retained_size = M.STORE_LIMIT - 32
        fixture.record["padding"] = "x" * (retained_size - len(fixture.encoded()))
        self.assertEqual(len(fixture.encoded()), retained_size)
        original = deepcopy(fixture.record)
        _, result, _ = self.invoke(fixture, lambda snapshot, **kwargs: calls.append(snapshot))
        self.assertEqual(calls, [])
        self.assertEqual(fixture.record, original)
        self.assertEqual(result["samples"], [fixture.sample])
        self.assertIn("EVIDENCE_EXPORT_UNAVAILABLE", result["missing_evidence"])

    def test_deadline_expiring_inside_original_store_decode_is_rechecked_before_delivery(self):
        fixture, calls = ParentNativeFixture(), []
        original_decode = M._decode

        def decode(raw):
            value = original_decode(raw)
            if isinstance(value, dict) and value.get("final") is not None and value.get("run") == fixture.spec.run:
                fixture.now = fixture.spec.cleanup_deadline_us
            return value

        with patch.object(M, "_decode", side_effect=decode):
            _, result, _ = self.invoke(fixture, lambda snapshot, **kwargs: calls.append(snapshot))
        self.assertEqual(calls, [])
        self.assertEqual(result["samples"], [fixture.sample])
        self.assertIn("EVIDENCE_EXPORT_UNAVAILABLE", result["missing_evidence"])

    def test_optional_none_preserves_existing_parent_run_without_reading_store(self):
        for provide_sink in (True, False):
            with self.subTest(provide_sink=provide_sink):
                fixture = ParentNativeFixture()
                _, result, _ = self.invoke(fixture, provide_sink=provide_sink)
                self.assertNotIn("store.read", fixture.log)
                self.assertEqual(result["samples"], [fixture.sample])
                self.assertEqual(result["status"], "INCOMPLETE")
                self.assertNotIn("EVIDENCE_EXPORT_UNAVAILABLE", result["missing_evidence"])

    def test_noncallable_hook_rejected_by_public_main_before_any_preflight_or_runtime(self):
        def forbidden(*args, **kwargs):
            self.fail("invalid evidence sink invoked preflight or runtime")

        with tempfile.TemporaryDirectory(prefix="export-invalid-", dir=PACKAGE) as directory:
            path = Path(directory) / "spec.json"
            path.write_text(json.dumps(CLI.fixture_module.spec_mapping()), encoding="utf-8")
            for sink in (False, 1, "destination", {}):
                with self.subTest(sink=sink), redirect_stdout(io.StringIO()) as output:
                    code = M.main(["run", "--spec", str(path)], preflight_fn=forbidden, run_fn=forbidden, evidence_sink=sink)
                self.assertEqual(code, 2)
                self.assertEqual(json.loads(output.getvalue())["status"], "INVALID")


if __name__ == "__main__":
    unittest.main()
