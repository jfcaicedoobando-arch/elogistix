"""Targeted V9 cross-API regressions; own bindings only, no native runtime."""
from __future__ import annotations

from contextlib import contextmanager
import importlib.util
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import Mock, patch


ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location(
    "_own_pilot_capture_test_support",
    ROOT / "tests" / "test_ci_systemd_synthetic_pilot_process_capture.py")
if SPEC is None or SPEC.loader is None:
    raise RuntimeError("Own test support unavailable")
SUPPORT = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(SUPPORT)  # definitions/guard only; no stable tests run
PILOT = SUPPORT.PILOT


def fresh():
    return SUPPORT.consumer(SUPPORT.clock_us() + 5_000_000)


def call_api(observer, binding, api):
    if api == "bound":
        return observer.invoke_bound(binding)
    if api == "adapter":
        return observer.invoke(binding, spec_path="/owned/spec.json",
                               source_elf_path="/owned/load.elf")
    if api == "bridge":
        with patch.object(PILOT, "_pipe_fd", side_effect=lambda fd, **kw: fd), \
             patch.object(PILOT.os, "read", side_effect=BlockingIOError):
            return PILOT.invoke_bound_with_pipes(observer, binding,
                evidence_write_fd=101, control_read_fd=106)["exit_main"]
    raise AssertionError("Unknown own fixture API")


def completed_pump(observer, **kwargs):
    kwargs["process"].returncode = 0
    return {"process_exit_code": 0, "process_reaped": True,
        "capture_outcome": "CAPTURE_COMPLETE",
        "supervision_status": "DATA_OBSERVED_ONLY",
        "consumer": observer.receipt(), "remote_ack_sent": True,
        "abort_sent": False, "control_error": None,
        "evidence_eof": True, "evidence_frame_consumed": True,
        "evidence_wire_prefix": b"own-model", "runtime_ready": False,
        "certificate_verified": False}


@contextmanager
def successful_parent(observer, *, pump=completed_pump, publication_failure=None):
    """Model an already-reaped successful child; never fork or write a file."""
    metadata = b'{"bridge_error":null,"exit_main":0,"remote_acknowledged":true}'
    publication = {"status": "FILES_WRITTEN", "writer_pid": 54322,
        "writer_reaped": True, "writer_exit_code": 0, "error": None,
        "durability_guaranteed": False, "custody_authenticated": False}
    with SUPPORT.mocked_linux_entry() as preconditions, \
         patch.object(PILOT.os, "fork", return_value=54321, create=True) as fork, \
         patch.object(PILOT, "supervise_bound_process", side_effect=pump), \
         patch.object(PILOT, "_pipe_fd", side_effect=lambda fd, **kw: fd), \
         patch.object(PILOT.os, "read", side_effect=[metadata, b""]), \
         patch.object(PILOT, "_publish_auxiliary", return_value=publication,
                      side_effect=publication_failure) as publish:
        yield preconditions, fork, publish


class CrossApiOrderTests(unittest.TestCase):
    def assert_supervisor_then_api(self, api):
        observer, first, second = fresh(), Mock(return_value=0), Mock(return_value=0)
        with successful_parent(observer) as (_, fork, publish):
            report = PILOT.supervise_bound(observer, first, output_dir_fd=123)
            self.assertEqual(report["supervision_status"], "DATA_OBSERVED_ONLY")
            self.assertIs(observer.abort_requested(), False)
            self.assertIs(report["consumer"]["invocation_attempted"], False)
            self.assertIs(report["consumer"]["bound_main_called"], False)
            self.assertIsNone(call_api(observer, second, api))
            second.assert_not_called()
            first.assert_not_called()  # it ran only in the modeled child
            self.assertIs(observer.abort_requested(), True)
            self.assertEqual(observer.receipt()["first_failure"], "V5_REPEATED_INVOCATION")
            fork.assert_called_once_with()
            publish.assert_called_once()

    def assert_api_then_supervisor(self, api):
        observer, first, second = fresh(), Mock(return_value=0), Mock(return_value=0)
        self.assertEqual(call_api(observer, first, api), 0)
        self.assertIs(observer.abort_requested(), False)
        with patch.object(PILOT, "_prepare_supervised_entry") as prepare, \
             patch.object(PILOT.os, "pipe") as pipe, \
             patch.object(PILOT.os, "fork", create=True) as fork:
            with self.assertRaises(PILOT.PilotValidationError) as rejected:
                PILOT.supervise_bound(observer, second, output_dir_fd=123)
            self.assertEqual(rejected.exception.code, "REPEATED_PROCESS_INVOCATION")
            prepare.assert_not_called()
            pipe.assert_not_called()
            fork.assert_not_called()
        first.assert_called_once()
        second.assert_not_called()
        self.assertEqual(observer.receipt()["first_failure"], "REPEATED_PROCESS_INVOCATION")

    def test_supervisor_then_bound_cannot_execute_in_parent(self):
        self.assert_supervisor_then_api("bound")

    def test_supervisor_then_adapter_cannot_execute_in_parent(self):
        self.assert_supervisor_then_api("adapter")

    def test_supervisor_then_bridge_cannot_execute_in_parent(self):
        self.assert_supervisor_then_api("bridge")

    def test_bound_then_supervisor_rejects_before_checks_pipes_and_fork(self):
        self.assert_api_then_supervisor("bound")

    def test_adapter_then_supervisor_rejects_before_checks_pipes_and_fork(self):
        self.assert_api_then_supervisor("adapter")

    def test_bridge_then_supervisor_rejects_before_checks_pipes_and_fork(self):
        self.assert_api_then_supervisor("bridge")

    def test_direct_apis_share_one_reservation_in_all_orders(self):
        for first_api in ("bound", "adapter", "bridge"):
            for second_api in ("bound", "adapter", "bridge"):
                with self.subTest(first=first_api, second=second_api):
                    observer, first, second = fresh(), Mock(return_value=0), Mock(return_value=0)
                    self.assertEqual(call_api(observer, first, first_api), 0)
                    self.assertIsNone(call_api(observer, second, second_api))
                    first.assert_called_once()
                    second.assert_not_called()
                    self.assertIs(observer.abort_requested(), True)

    def test_supervisor_reservation_closes_bound_during_parent_pump(self):
        observer, second = fresh(), Mock(return_value=0)
        def pump(observed, **kwargs):
            self.assertIsNone(observed.invoke_bound(second))
            return completed_pump(observed, **kwargs)
        with successful_parent(observer, pump=pump):
            report = PILOT.supervise_bound(observer, Mock(), output_dir_fd=123)
        second.assert_not_called()
        self.assertEqual(report["supervision_status"], "INCOMPLETE")
        self.assertEqual(report["consumer"]["first_failure"], "V5_REPEATED_INVOCATION")

    def test_bound_reservation_closes_supervisor_reentry_during_main(self):
        observer, second = fresh(), Mock()
        def binding(**hooks):
            with patch.object(PILOT, "_prepare_supervised_entry") as prepare:
                with self.assertRaises(PILOT.PilotValidationError):
                    PILOT.supervise_bound(observer, second, output_dir_fd=123)
                prepare.assert_not_called()
            return 0
        self.assertEqual(observer.invoke_bound(binding), 0)
        second.assert_not_called()
        self.assertIs(observer.abort_requested(), True)


class ReservationFailureAndPermitTests(unittest.TestCase):
    def assert_all_routes_closed(self, observer):
        for api in ("bound", "adapter", "bridge"):
            binding = Mock(return_value=0)
            self.assertIsNone(call_api(observer, binding, api))
            binding.assert_not_called()
        with patch.object(PILOT, "_prepare_supervised_entry") as prepare:
            with self.assertRaises(PILOT.PilotValidationError):
                PILOT.supervise_bound(observer, Mock(), output_dir_fd=123)
            prepare.assert_not_called()

    def test_setup_failure_never_releases_reservation_to_other_apis(self):
        observer = fresh()
        with patch.object(PILOT, "_prepare_supervised_entry", side_effect=PermissionError):
            with self.assertRaises(PermissionError):
                PILOT.supervise_bound(observer, Mock(), output_dir_fd=123)
        self.assert_all_routes_closed(observer)
        self.assertEqual(observer.receipt()["first_failure"], "SUPERVISOR_SETUP_FAILURE")

    def test_allocation_pipe_and_fork_failure_never_release_reservation(self):
        for failure_point in ("allocation", "pipe", "fork"):
            with self.subTest(point=failure_point):
                observer = fresh()
                with SUPPORT.mocked_linux_entry() as mocked, \
                     patch.object(PILOT._ForkChild, "allocate_for_fork",
                        wraps=PILOT._ForkChild.allocate_for_fork) as allocate:
                    if failure_point == "allocation":
                        allocate.side_effect = MemoryError
                    elif failure_point == "pipe":
                        mocked.pipe.side_effect = OSError
                    with self.assertRaises((MemoryError, OSError)):
                        PILOT.supervise_bound(observer, Mock(), output_dir_fd=123)
                self.assert_all_routes_closed(observer)
                self.assertEqual(observer.receipt()["first_failure"], "SUPERVISOR_FORK_FAILURE")

    def test_invalid_direct_binding_consumes_reservation_before_validation(self):
        observer = fresh()
        self.assertIsNone(observer.invoke_bound(None))
        self.assert_all_routes_closed(observer)
        self.assertEqual(observer.receipt()["first_failure"], "V5_INVOCATION_UNAVAILABLE")

    def test_only_matching_child_pid_and_exact_binding_can_use_permit_once(self):
        observer, binding, other = fresh(), Mock(return_value=0), Mock(return_value=0)
        self.assertIs(observer._claim_invocation(), True)
        observer._supervised_child_permit = (os.getpid(), binding)
        self.assertEqual(observer.invoke_bound(binding), 0)
        self.assertIsNone(observer._supervised_child_permit)
        self.assertIsNone(observer.invoke_bound(binding))
        self.assertIsNone(observer.invoke_bound(other))
        binding.assert_called_once()
        other.assert_not_called()

    def test_inherited_permit_with_wrong_pid_is_consumed_and_rejected(self):
        observer, binding = fresh(), Mock(return_value=0)
        observer._claim_invocation()
        observer._supervised_child_permit = (os.getpid() + 1, binding)
        self.assertIsNone(observer.invoke_bound(binding))
        self.assertIsNone(observer._supervised_child_permit)
        binding.assert_not_called()
        self.assertIs(observer.abort_requested(), True)
        self.assert_all_routes_closed(observer)

    def test_wrong_binding_discards_permit_without_running_either_callable(self):
        observer, intended, other = fresh(), Mock(return_value=0), Mock(return_value=0)
        observer._claim_invocation()
        observer._supervised_child_permit = (os.getpid(), intended)
        self.assertIsNone(observer.invoke_bound(other))
        self.assertIsNone(observer._supervised_child_permit)
        self.assertIsNone(observer.invoke_bound(intended))
        intended.assert_not_called()
        other.assert_not_called()

    def test_child_permit_cannot_authorize_an_adapter_or_another_supervisor(self):
        for route in ("adapter", "supervisor"):
            with self.subTest(route=route):
                observer, intended = fresh(), Mock(return_value=0)
                observer._claim_invocation()
                observer._supervised_child_permit = (os.getpid(), intended)
                if route == "adapter":
                    self.assertIsNone(call_api(observer, intended, "adapter"))
                else:
                    with patch.object(PILOT, "_prepare_supervised_entry") as prepare:
                        with self.assertRaises(PILOT.PilotValidationError):
                            PILOT.supervise_bound(observer, intended, output_dir_fd=123)
                        prepare.assert_not_called()
                intended.assert_not_called()
                self.assertIsNone(observer._supervised_child_permit)

    def test_matching_child_permit_traverses_real_bridge_exactly_once(self):
        observer, binding = fresh(), Mock(return_value=0)
        observer._claim_invocation()
        observer._supervised_child_permit = (os.getpid(), binding)
        self.assertEqual(call_api(observer, binding, "bridge"), 0)
        self.assertIs(observer.abort_requested(), False)
        self.assertIsNone(observer._supervised_child_permit)
        self.assertIsNone(call_api(observer, binding, "bridge"))
        binding.assert_called_once()

    def test_real_bridge_cannot_transfer_permit_to_a_different_binding(self):
        observer, intended, other = fresh(), Mock(return_value=0), Mock(return_value=0)
        observer._claim_invocation()
        observer._supervised_child_permit = (os.getpid(), intended)
        self.assertIsNone(call_api(observer, other, "bridge"))
        self.assertIsNone(observer._supervised_child_permit)
        self.assertIsNone(call_api(observer, intended, "bridge"))
        intended.assert_not_called()
        other.assert_not_called()

    def test_permit_is_installed_only_in_child_branch_and_cleared_after_bridge(self):
        class ExitChild(BaseException):
            pass
        for bridge_fails in (False, True):
            with self.subTest(bridge_fails=bridge_fails):
                observer, binding = fresh(), Mock(return_value=0)
                real_bridge = PILOT.invoke_bound_with_pipes
                def bridge(observed, bound, **channels):
                    self.assertIs(observed._invocation_claimed, True)
                    self.assertIs(observed._invoked, False)
                    self.assertEqual(observed._supervised_child_permit[0], os.getpid())
                    self.assertIs(observed._supervised_child_permit[1], bound)
                    if bridge_fails:
                        raise OSError("own bridge refused")
                    delivered = real_bridge(observed, bound, **channels)
                    self.assertIsNone(observed._supervised_child_permit)
                    return delivered
                with SUPPORT.mocked_linux_entry(), \
                     patch.object(PILOT.os, "fork", return_value=0, create=True), \
                     patch.object(PILOT.os, "dup2"), \
                     patch.object(PILOT.io, "FileIO"), \
                     patch.object(PILOT.io, "TextIOWrapper"), \
                     patch.object(PILOT.sys, "stdout"), patch.object(PILOT.sys, "stderr"), \
                     patch.object(PILOT, "invoke_bound_with_pipes", side_effect=bridge), \
                     patch.object(PILOT, "_pipe_fd", side_effect=lambda fd, **kw: fd), \
                     patch.object(PILOT.os, "read", side_effect=BlockingIOError), \
                     patch.object(PILOT.os, "write", side_effect=lambda fd, data: len(data)), \
                     patch.object(PILOT.os, "_exit", side_effect=ExitChild):
                    with self.assertRaises(ExitChild):
                        PILOT.supervise_bound(observer, binding, output_dir_fd=123)
                self.assertIsNone(observer._supervised_child_permit)
                self.assertIs(observer._invocation_claimed, True)
                self.assertEqual(binding.call_count, 0 if bridge_fails else 1)
                self.assert_all_routes_closed(observer)


class PublicationDiagnosticTests(unittest.TestCase):
    def test_actual_publication_fork_failure_keeps_matching_diagnostics(self):
        observer = fresh()
        metadata = b'{"bridge_error":null,"exit_main":0,"remote_acknowledged":true}'
        with SUPPORT.mocked_linux_entry(), \
             patch.object(PILOT.os, "fork", side_effect=[54321, OSError("own publication fork refused")], create=True) as fork, \
             patch.object(PILOT, "supervise_bound_process", side_effect=completed_pump), \
             patch.object(PILOT, "_pipe_fd", side_effect=lambda fd, **kw: fd), \
             patch.object(PILOT.os, "read", side_effect=[metadata, b""]):
            report = PILOT.supervise_bound(observer, Mock(), output_dir_fd=123)
        self.assertEqual(fork.call_count, 2)
        self.assertIs(report["owned_child_reaped"], True)
        self.assertEqual(report["publication"]["error"], "AUXILIARY_PUBLICATION_UNAVAILABLE")
        self.assertEqual(report["consumer"]["first_failure"], "AUXILIARY_PUBLICATION_UNAVAILABLE")
        self.assertEqual(report["supervision_status"], "INCOMPLETE")
        self.assertEqual(report["pending_owned_children"], ())

    def test_publication_exception_keeps_real_failure_in_both_fields(self):
        observer = fresh()
        with successful_parent(observer, publication_failure=OSError("own writer fork refused")):
            report = PILOT.supervise_bound(observer, Mock(), output_dir_fd=123)
        self.assertIs(report["owned_child_reaped"], True)
        self.assertEqual(report["publication"]["error"], "AUXILIARY_PUBLICATION_UNAVAILABLE")
        self.assertEqual(report["consumer"]["first_failure"], "AUXILIARY_PUBLICATION_UNAVAILABLE")
        self.assertEqual(report["supervision_status"], "INCOMPLETE")
        self.assertIs(report["publication"]["writer_reaped"], False)
        self.assertEqual(report["pending_owned_children"], ())

    def test_prior_failure_stays_first_while_publication_error_is_current(self):
        observer = fresh()
        def pump(observed, **kwargs):
            observed.request_abort("OWN_PRIOR_FAILURE")
            return completed_pump(observed, **kwargs)
        with successful_parent(observer, pump=pump, publication_failure=OSError):
            report = PILOT.supervise_bound(observer, Mock(), output_dir_fd=123)
        self.assertEqual(report["publication"]["error"], "AUXILIARY_PUBLICATION_UNAVAILABLE")
        self.assertEqual(report["consumer"]["first_failure"], "OWN_PRIOR_FAILURE")
        self.assertEqual(report["supervision_status"], "INCOMPLETE")


def linux_fixture(order):
    """Own unprivileged Linux fork/pipe/publication seam, never native main."""
    with SUPPORT._runtime_import_guard(), tempfile.TemporaryDirectory(prefix="own-pilot-once-") as directory:
        output_fd = os.open(directory, os.O_RDONLY | os.O_DIRECTORY | os.O_CLOEXEC)
        try:
            for api in ("bound", "adapter"):
                observer, second = fresh(), Mock(return_value=0)
                if order == "supervisor-first":
                    calls = []
                    def bound(*, evidence_sink, abort_requested):
                        calls.append(1)
                        os.write(1, b'{"status":"INCOMPLETE","certificate_verified":false}\n')
                        snapshot = SUPPORT.synthetic_snapshot(observer.deadline_us)
                        snapshot["retained_record"]["own_binding_calls"] = len(calls)
                        return 0 if evidence_sink(snapshot, deadline_us=observer.deadline_us) is True else 3
                    # Each publication is EXCL; isolate each API's auxiliary directory.
                    subdirectory = Path(directory) / api
                    subdirectory.mkdir(mode=0o700)
                    sub_fd = os.open(subdirectory, os.O_RDONLY | os.O_DIRECTORY | os.O_CLOEXEC)
                    os.close(output_fd)
                    output_fd = sub_fd
                    report = PILOT.supervise_bound(observer, bound, output_dir_fd=output_fd)
                    assert report["supervision_status"] == "DATA_OBSERVED_ONLY", report
                    assert report["consumer"]["abort_requested"] is False
                    assert report["consumer"]["invocation_attempted"] is False
                    assert json.loads(observer.evidence_bytes)["retained_record"]["own_binding_calls"] == 1
                    assert calls == []  # parent memory never called bound
                    assert call_api(observer, second, api) is None
                    second.assert_not_called()
                    assert observer.abort_requested() is True
                else:
                    first = Mock(return_value=0)
                    assert call_api(observer, first, api) == 0
                    assert observer.abort_requested() is False
                    with patch.object(PILOT.os, "fork", wraps=os.fork) as fork:
                        try:
                            PILOT.supervise_bound(observer, second, output_dir_fd=output_fd)
                        except PILOT.PilotValidationError as error:
                            assert error.code == "REPEATED_PROCESS_INVOCATION"
                        else:
                            raise AssertionError("Supervisor admitted a second attempt")
                        fork.assert_not_called()
                    first.assert_called_once()
                    second.assert_not_called()
            print(json.dumps({"own_fixture": order, "status": "PASS", "native_runtime": False}))
        finally:
            os.close(output_fd)


@unittest.skipUnless(sys.platform == "linux", "Real Linux fork/publication awaits Linux reviewer")
class RealLinuxCrossApiTests(unittest.TestCase):
    def run_fixture(self, order):
        with SUPPORT._runtime_import_guard():
            result = subprocess.run([str(Path(sys.executable).resolve()), "-I", "-S", "-B",
                str(Path(__file__).resolve()), "--own-linux-fixture", order],
                stdin=subprocess.DEVNULL, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                close_fds=True, shell=False, cwd=str(ROOT), timeout=12, check=False)
        self.assertEqual(result.returncode, 0, result.stderr.decode("utf-8", "replace"))
        self.assertEqual(json.loads(result.stdout)["status"], "PASS")

    def test_real_linux_supervisor_then_bound_and_adapter(self):
        self.run_fixture("supervisor-first")

    def test_real_linux_bound_and_adapter_then_supervisor(self):
        self.run_fixture("direct-first")


if __name__ == "__main__":
    if len(sys.argv) == 3 and sys.argv[1] == "--own-linux-fixture":
        linux_fixture(sys.argv[2])
    else:
        unittest.main()
