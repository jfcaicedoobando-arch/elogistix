"""Real bounded own Python child/pipe tests; never native runtime or privileges."""
from __future__ import annotations

from contextlib import ExitStack, contextmanager
import hashlib
import importlib.abc
import importlib.util
import json
import os
from pathlib import Path
import subprocess
import sys
import time
from types import SimpleNamespace
import unittest
from unittest.mock import Mock, patch


class _NoRuntimeImports(importlib.abc.MetaPathFinder):
    def find_spec(self, fullname, path=None, target=None):
        if fullname.split(".", 1)[0] in {
            "systemd_memory_runtime", "physical_cgroup", "payload_distribution"
        }:
            raise AssertionError("Native runtime import forbidden in pipe tests")
        return None


@contextmanager
def _runtime_import_guard():
    guard = _NoRuntimeImports()
    sys.meta_path.insert(0, guard)
    try:
        yield
    finally:
        sys.meta_path.remove(guard)


ROOT = Path(__file__).resolve().parents[1]
FIXTURE = ROOT / "tests" / "fixtures" / "systemd_pilot_pipe_child.py"
_MODULE_PATH = ROOT / "scripts" / "ci" / "invoke-systemd-synthetic-pilot.py"
_MODULE_NAME = "_own_ci_systemd_pilot_pipe_under_test"
_MODULE_SPEC = importlib.util.spec_from_file_location(_MODULE_NAME, _MODULE_PATH)
if _MODULE_SPEC is None or _MODULE_SPEC.loader is None:
    raise RuntimeError("Own wrapper unavailable")
PILOT = importlib.util.module_from_spec(_MODULE_SPEC)
sys.modules[_MODULE_NAME] = PILOT
with _runtime_import_guard():
    _MODULE_SPEC.loader.exec_module(PILOT)

RUN = "a" * 32
CONSTANTS = {"WORK_US": 50_000_000, "CLEANUP_US": 60_000_000,
             "MEMORY_MAX_BYTES": 33_554_432, "TASKS_MAX": 8}
BINARY_STDOUT = b"\r\n\x1a\x00\xff" * 6000
BINARY_STDERR = b"\xff\x00\x1a\n\r" * 6000


def clock_us():
    return time.monotonic_ns() // 1000


def stdout_bytes(count):
    base = b'{"status":"INCOMPLETE","certificate_verified":false}\n'
    return base[:count] if count < len(base) else base + b" " * (count - len(base))


def consumer(deadline):
    return PILOT.V5InvocationConsumer(run=RUN, cleanup_deadline_us=deadline,
                                     clock_us=clock_us, shared_constants=CONSTANTS)


def synthetic_snapshot(deadline):
    now = clock_us()
    return {"retained_record": {"run": RUN, "final": {"status": "COMPLETE"}},
            "coordinator_result": {"status": "INCOMPLETE"},
            "provenance": {"phase": "POST_COORDINATOR_PRE_WATCHDOG_WAIT", "run": RUN,
                "original_store_identity": {"dev": "23", "inode": "456"},
                "captured_before_us": str(now), "captured_after_us": str(now),
                "cleanup_deadline_us": str(deadline), "watchdog_wait_pending": True,
                "stored_final_status_matches_coordinator_claim": True,
                "stored_final_status_matches_coordinator_status": False}}


@contextmanager
def child(mode="valid", *, stdout_bytes_count=64, stderr_bytes_count=0,
          deadline=None):
    """Own four pipes, explicit inherited handle, no shell or reader threads."""
    deadline = deadline if deadline is not None else clock_us() + 3_000_000
    read_fd, write_fd = os.pipe()
    process = None
    try:
        options = {"stdin": subprocess.PIPE, "stdout": subprocess.PIPE,
                   "stderr": subprocess.PIPE, "bufsize": 0, "close_fds": True,
                   "shell": False, "cwd": str(ROOT)}
        if os.name == "nt":
            import msvcrt
            msvcrt.setmode(read_fd, os.O_BINARY)
            msvcrt.setmode(write_fd, os.O_BINARY)
            handle = msvcrt.get_osfhandle(write_fd)
            os.set_handle_inheritable(handle, True)
            startup = subprocess.STARTUPINFO()
            startup.lpAttributeList = {"handle_list": [handle]}
            options["startupinfo"] = startup
        else:
            handle = write_fd
            options["pass_fds"] = (write_fd,)
        argv = [str(Path(sys.executable).resolve()), "-I", "-S", "-B", str(FIXTURE),
                "--mode", mode, "--evidence-handle", str(handle),
                "--deadline-us", str(deadline),
                "--stdout-bytes", str(stdout_bytes_count),
                "--stderr-bytes", str(stderr_bytes_count)]
        process = subprocess.Popen(argv, **options)
        os.close(write_fd)
        write_fd = None
        if process.stdin is None or process.stdout is None or process.stderr is None:
            raise AssertionError("Expected the three standard raw pipes")
        yield process, read_fd, deadline
    finally:
        # Reap only the exact process created here. Failure tests never leave a
        # live fixture behind; no group or unrelated process is touched.
        if process is not None:
            if process.poll() is None:
                if process.stdin is not None:
                    try:
                        process.stdin.close()
                    except (OSError, ValueError):
                        pass
                try:
                    process.wait(timeout=1)
                except subprocess.TimeoutExpired:
                    process.kill()
                    process.wait(timeout=1)
            for stream in (process.stdin, process.stdout, process.stderr):
                if stream is not None:
                    try:
                        stream.close()
                    except (OSError, ValueError):
                        pass
        for fd in (read_fd, write_fd):
            if fd is not None:
                try:
                    os.close(fd)
                except OSError:
                    pass


def supervise(process, evidence_fd, deadline, **cutoffs):
    observer = consumer(deadline)
    with _runtime_import_guard():
        report = PILOT.supervise_bound_process(
            observer, process=process, stdout_fd=process.stdout.fileno(),
            stderr_fd=process.stderr.fileno(), evidence_read_fd=evidence_fd,
            control_write_fd=process.stdin.fileno(), **cutoffs)
    return observer, report


@contextmanager
def mocked_linux_entry(*, directory_mode=0o700):
    """Linux identity/FD data with an always-mocked fork and no real file I/O."""
    directory = SimpleNamespace(st_mode=PILOT.stat.S_IFDIR | directory_mode,
                                st_uid=0, st_gid=0, st_dev=23, st_ino=456)
    null = SimpleNamespace(st_mode=PILOT.stat.S_IFCHR | 0o600, st_rdev=23)
    with ExitStack() as stack, _runtime_import_guard():
        stack.enter_context(patch.object(PILOT.sys, "platform", "linux"))
        stack.enter_context(patch.object(PILOT.signal, "SIGCHLD", 42, create=True))
        stack.enter_context(patch.object(PILOT.signal, "SIG_DFL", 0))
        stack.enter_context(patch.object(PILOT.signal, "getsignal", return_value=0))
        stack.enter_context(patch.object(PILOT.os, "listdir", side_effect=lambda path:
            ["owned-main-task"] if path == "/proc/self/task" else ["0", "1", "2", "123"]))
        stack.enter_context(patch.object(PILOT.os, "geteuid", return_value=0, create=True))
        fstat = stack.enter_context(patch.object(PILOT.os, "fstat",
            side_effect=lambda fd: null if fd == 0 else directory))
        stat = stack.enter_context(patch.object(PILOT.os, "stat", return_value=null))
        pipe = stack.enter_context(patch.object(PILOT.os, "pipe",
            side_effect=[(100 + 2*i, 101 + 2*i) for i in range(5)]))
        fork = stack.enter_context(patch.object(PILOT.os, "fork",
            side_effect=OSError("mock fork refused"), create=True))
        stack.enter_context(patch.object(PILOT, "_close_own_fds", return_value=True))
        yield SimpleNamespace(directory=directory, null=null, fstat=fstat, stat=stat,
                              pipe=pipe, fork=fork)


class RealPipeCaptureTests(unittest.TestCase):
    def _assert_data_only(self, report):
        self.assertEqual(report["supervision_status"], "DATA_OBSERVED_ONLY")
        self.assertEqual(report["process_exit_code"], 0)
        self.assertTrue(report["process_reaped"])
        self.assertTrue(report["evidence_eof"])
        self.assertTrue(report["evidence_frame_consumed"])
        self.assertTrue(report["remote_ack_sent"])
        self.assertFalse(report["abort_sent"])
        self.assertEqual(report["capture_outcome"], "CAPTURE_COMPLETE")
        self.assertFalse(report["consumer"]["invocation_attempted"])
        self.assertFalse(report["consumer"]["bound_main_called"])
        self.assertFalse(report["runtime_ready"])
        self.assertFalse(report["certificate_verified"])

    def _assert_failed(self, report):
        self.assertEqual(report["supervision_status"], "INCOMPLETE")
        self.assertTrue(report["consumer"]["abort_requested"])
        self.assertFalse(report["runtime_ready"])
        self.assertFalse(report["certificate_verified"])

    def test_real_four_pipes_acknowledge_whole_copy_and_observe_both_eofs(self):
        with child(stderr_bytes_count=127) as (process, evidence_fd, deadline):
            observer, report = supervise(process, evidence_fd, deadline)
            self._assert_data_only(report)
            self.assertEqual(observer.stdout.retained, stdout_bytes(64))
            self.assertEqual(observer.stderr.retained, b"e" * 127)
            self.assertEqual(observer.runtime_result()["status"], "INCOMPLETE")
            self.assertTrue(report["consumer"]["evidence_acknowledged"])
            graph = json.loads(observer.evidence_bytes)
            self.assertEqual(graph["retained_record"]["final"]["status"], "COMPLETE")
            self.assertEqual(graph["coordinator_result"]["status"], "INCOMPLETE")

    def test_simultaneous_streams_larger_than_pipe_buffers_are_drained_without_deadlock(self):
        with child(stdout_bytes_count=60000, stderr_bytes_count=60000) as (process, fd, deadline):
            observer, report = supervise(process, fd, deadline)
            self._assert_data_only(report)
            self.assertEqual(observer.stdout.retained, stdout_bytes(60000))
            self.assertEqual(observer.stderr.retained, b"e" * 60000)
            self.assertEqual(report["consumer"]["stdout"]["observed_bytes"], 60000)
            self.assertEqual(report["consumer"]["stderr"]["observed_bytes"], 60000)

    def test_exact_64k_per_stream_is_whole_data_without_overflow(self):
        with child(stdout_bytes_count=65536, stderr_bytes_count=65536) as (process, fd, deadline):
            observer, report = supervise(process, fd, deadline)
            self._assert_data_only(report)
            for name, expected in (("stdout", stdout_bytes(65536)), ("stderr", b"e" * 65536)):
                receipt = report["consumer"][name]
                self.assertEqual(receipt["retained_bytes"], 65536)
                self.assertEqual(receipt["observed_bytes"], 65536)
                self.assertEqual(receipt["status"], "COMPLETE")
                self.assertEqual(receipt["sha256_full"], hashlib.sha256(expected).hexdigest())
            self.assertEqual(observer.runtime_result()["status"], "INCOMPLETE")

    def test_exact_524288_evidence_bytes_cross_real_pipe_with_whole_parent_ack(self):
        with child("exact_evidence", stderr_bytes_count=64) as (process, fd, deadline):
            observer, report = supervise(process, fd, deadline)
            self._assert_data_only(report)
            raw = observer.evidence_bytes
            self.assertIs(type(raw), bytes)
            self.assertEqual(len(raw), 524288)
            self.assertEqual(report["consumer"]["evidence_bytes"], 524288)
            self.assertEqual(report["consumer"]["evidence_sha256"], hashlib.sha256(raw).hexdigest())
            graph = json.loads(raw)
            self.assertEqual(graph["retained_record"]["run"], RUN)
            self.assertEqual(graph["retained_record"]["final"]["status"], "COMPLETE")
            self.assertEqual(graph["coordinator_result"]["status"], "INCOMPLETE")
            self.assertGreater(len(graph["retained_record"]["fixture_padding"]), 523000)

    def test_64k_plus_one_stdout_aborts_and_keeps_whole_observed_hash(self):
        with child(stdout_bytes_count=65537, stderr_bytes_count=60000) as (process, fd, deadline):
            observer, report = supervise(process, fd, deadline)
            self._assert_failed(report)
            receipt = report["consumer"]["stdout"]
            self.assertEqual(receipt["status"], "OVERFLOW")
            self.assertEqual(receipt["observed_bytes"], 65537)
            self.assertEqual(receipt["retained_bytes"], 65536)
            self.assertEqual(receipt["discarded_observed_bytes"], 1)
            self.assertEqual(receipt["sha256_full"], hashlib.sha256(stdout_bytes(65537)).hexdigest())
            self.assertTrue(receipt["eof"])
            self.assertIsNone(observer.runtime_result())

    def test_64k_plus_one_stderr_is_also_irreversible_failure(self):
        with child(stdout_bytes_count=60000, stderr_bytes_count=65537) as (process, fd, deadline):
            observer, report = supervise(process, fd, deadline)
            self._assert_failed(report)
            self.assertEqual(report["consumer"]["stderr"]["status"], "OVERFLOW")
            self.assertEqual(report["consumer"]["stderr"]["observed_bytes"], 65537)
            self.assertEqual(observer.stderr.retained, b"e" * 65536)
            self.assertEqual(report["consumer"]["stdout"]["status"], "COMPLETE")

    def test_binary_crlf_ctrlz_nul_and_ff_are_retained_without_text_conversion(self):
        with child("binary") as (process, fd, deadline):
            observer, report = supervise(process, fd, deadline)
            self._assert_data_only(report)
            self.assertEqual(observer.stdout.retained, BINARY_STDOUT)
            self.assertEqual(observer.stderr.retained, BINARY_STDERR)
            self.assertEqual(report["consumer"]["stdout"]["sha256_full"], hashlib.sha256(BINARY_STDOUT).hexdigest())
            self.assertEqual(report["consumer"]["stderr"]["sha256_full"], hashlib.sha256(BINARY_STDERR).hexdigest())

    def test_invalid_json_evidence_is_not_acknowledged_even_with_exit_zero(self):
        with child("invalid_evidence") as (process, fd, deadline):
            observer, report = supervise(process, fd, deadline)
            self._assert_failed(report)
            self.assertFalse(report["remote_ack_sent"])
            self.assertIsNone(observer.evidence_bytes)
            self.assertTrue(report["evidence_eof"])

    def test_truncated_evidence_is_unavailable_and_eof_is_observed_explicitly(self):
        with child("truncated_evidence") as (process, fd, deadline):
            observer, report = supervise(process, fd, deadline)
            self._assert_failed(report)
            self.assertFalse(report["evidence_frame_consumed"])
            self.assertFalse(report["remote_ack_sent"])
            self.assertTrue(report["evidence_eof"])
            self.assertIsNone(observer.evidence_bytes)

    def test_evidence_header_above_bound_is_rejected_without_allocating_declared_body(self):
        with child("oversized_evidence") as (process, fd, deadline):
            observer, report = supervise(process, fd, deadline)
            self._assert_failed(report)
            self.assertFalse(report["remote_ack_sent"])
            self.assertIsNone(observer.evidence_bytes)
            self.assertTrue(report["evidence_eof"])

    def test_original_evidence_deadline_cannot_be_renewed_by_header(self):
        with child("wrong_deadline") as (process, fd, deadline):
            observer, report = supervise(process, fd, deadline)
            self._assert_failed(report)
            self.assertFalse(report["remote_ack_sent"])
            self.assertIsNone(observer.evidence_bytes)

    def test_second_evidence_frame_never_promotes_or_overwrites_first_copy(self):
        with child("duplicate_evidence") as (process, fd, deadline):
            observer, report = supervise(process, fd, deadline)
            self._assert_failed(report)
            self.assertTrue(report["evidence_eof"])
            if observer.evidence_bytes is not None:
                graph = json.loads(observer.evidence_bytes)
                self.assertEqual(graph["retained_record"]["run"], RUN)
                self.assertEqual(graph["retained_record"]["final"]["status"], "COMPLETE")

    def test_noncanonical_json_evidence_does_not_receive_parent_ack(self):
        with child("noncanonical_evidence") as (process, fd, deadline):
            observer, report = supervise(process, fd, deadline)
            self._assert_failed(report)
            self.assertFalse(report["remote_ack_sent"])
            self.assertTrue(report["evidence_eof"])
            # Preserved full data remains failure evidence, not original custody.
            self.assertIsNotNone(observer.evidence_bytes)
            self.assertFalse(report["certificate_verified"])

    def test_nonzero_process_exit_keeps_acknowledged_evidence_and_captured_streams(self):
        with child("exit_nonzero", stderr_bytes_count=32) as (process, fd, deadline):
            observer, report = supervise(process, fd, deadline)
            self._assert_failed(report)
            self.assertEqual(report["process_exit_code"], 3)
            self.assertTrue(report["process_reaped"])
            self.assertTrue(report["remote_ack_sent"])
            self.assertTrue(report["consumer"]["evidence_acknowledged"])
            self.assertEqual(report["capture_outcome"], "RUNTIME_FAILED")
            self.assertIsNotNone(observer.evidence_bytes)

    def test_live_child_without_output_eof_stops_at_original_deadline(self):
        deadline = clock_us() + 3_000_000
        with child("no_eof", deadline=deadline) as (process, fd, deadline):
            observer, report = supervise(process, fd, deadline)
            self._assert_failed(report)
            self.assertTrue(report["remote_ack_sent"])
            self.assertFalse(report["consumer"]["stdout"]["eof"])
            self.assertFalse(report["consumer"]["stderr"]["eof"])
            self.assertEqual(report["capture_outcome"], "INCOMPLETE")
            self.assertEqual(report["consumer"]["cleanup_deadline_us"], deadline)


class ChildBridgeFailureTests(unittest.TestCase):
    def _read_diagnostic_after_exit(self, process):
        # Diagnostic fixtures emit <4096 bytes and no stderr; waiting does not
        # depend on draining a full output pipe or on background reader threads.
        process.wait(timeout=2)
        raw = process.stdout.read()
        self.assertEqual(process.stderr.read(), b"")
        self.assertLess(len(raw), 4096)
        return json.loads(raw)

    def test_control_pipe_eof_consumes_abort_before_binding(self):
        with child("control_probe") as (process, fd, deadline):
            process.stdin.close()
            diagnostic = self._read_diagnostic_after_exit(process)
            self.assertTrue(diagnostic["consumer_abort"])
            self.assertEqual(diagnostic["binding_calls"], 0)
            self.assertFalse(diagnostic["adapter"]["remote_acknowledged"])
            self.assertEqual(diagnostic["adapter"]["bridge_error"], "BRIDGE_CONTROL_EOF")
            self.assertEqual(process.returncode, 3)
            self.assertEqual(os.read(fd, 8192), b"")

    def test_wrong_control_token_consumes_abort_before_binding(self):
        for token in (b"Z", b"K"):
            with self.subTest(token=token):
                with child("control_probe") as (process, fd, deadline):
                    self.assertEqual(process.stdin.write(token), 1)
                    diagnostic = self._read_diagnostic_after_exit(process)
                    self.assertTrue(diagnostic["consumer_abort"])
                    self.assertEqual(diagnostic["binding_calls"], 0)
                    self.assertFalse(diagnostic["adapter"]["remote_acknowledged"])
                    self.assertEqual(diagnostic["adapter"]["bridge_error"], "BRIDGE_CONTROL_PROTOCOL")
                    self.assertEqual(process.returncode, 3)
                    self.assertEqual(os.read(fd, 8192), b"")

    def test_sink_backpressure_and_missing_ack_return_before_original_deadline(self):
        for mode in ("backpressure", "ack_missing"):
            with self.subTest(mode=mode):
                with child(mode) as (process, fd, deadline):
                    # Keep evidence unread and control open without ACK. The
                    # adapter must exhaust its own 250ms relay budget instead of
                    # waiting for the larger original test-process deadline.
                    diagnostic = self._read_diagnostic_after_exit(process)
                    self.assertEqual(diagnostic["binding_calls"], 1)
                    self.assertIs(diagnostic["sink_result"], False)
                    self.assertTrue(diagnostic["consumer_abort"])
                    self.assertFalse(diagnostic["adapter"]["remote_acknowledged"])
                    self.assertEqual(diagnostic["adapter"]["bridge_error"], "BRIDGE_DELIVERY_TIMEOUT")
                    self.assertEqual(process.returncode, 3)
                    self.assertLess(clock_us(), deadline)
                    self.assertLess(diagnostic["elapsed_us"], 2_000_000)

        with child("backpressure") as (process, fd, deadline):
            # The header establishes that the child is inside relay_sink. Keep
            # the 400k body blocked; a K before the whole frame was sent cannot
            # acknowledge remote receipt. Synchronize on bytes, not a sleep.
            os.set_blocking(fd, False)
            prefix = bytearray()
            while len(prefix) < 12 and clock_us() < deadline:
                try:
                    prefix.extend(os.read(fd, 12 - len(prefix)))
                except BlockingIOError:
                    pass
                if process.poll() is not None:
                    break
            self.assertEqual(len(prefix), 12)
            self.assertEqual(process.stdin.write(b"K"), 1)
            diagnostic = self._read_diagnostic_after_exit(process)
            self.assertIs(diagnostic["sink_result"], False)
            self.assertTrue(diagnostic["consumer_abort"])
            self.assertFalse(diagnostic["adapter"]["remote_acknowledged"])
            self.assertEqual(diagnostic["adapter"]["bridge_error"], "BRIDGE_CONTROL_PROTOCOL")

        evidence_r, evidence_w = os.pipe()
        control_r, control_w = os.pipe()
        try:
            deadline = clock_us() + 3_000_000
            observer = consumer(deadline)
            sink_returns = []
            def no_progress_binding(*, evidence_sink, abort_requested):
                sink_returns.append(evidence_sink(synthetic_snapshot(deadline), deadline_us=deadline))
                return 3
            real_write = os.write
            def zero_write(fd, raw):
                return 0 if fd == evidence_w else real_write(fd, raw)
            with patch.object(PILOT.os, "write", side_effect=zero_write):
                result = PILOT.invoke_bound_with_pipes(
                    observer, no_progress_binding, evidence_write_fd=evidence_w,
                    control_read_fd=control_r)
            self.assertEqual(sink_returns, [False])
            self.assertEqual(result["bridge_error"], "BRIDGE_DELIVERY_TIMEOUT")
            self.assertFalse(result["remote_acknowledged"])
            self.assertIs(observer.abort_requested(), True)
            self.assertLess(clock_us(), deadline)
        finally:
            for fd in (evidence_r, evidence_w, control_r, control_w):
                os.close(fd)


class EarlierCutoffAndOwnedChildTests(unittest.TestCase):
    def test_cutoffs_are_optional_together_and_strict_integers_inside_original_end(self):
        with child("hold") as (process, fd, deadline):
            observer = consumer(deadline)
            for abort, stop in ((None, 1), (1, None), (-1, 1), (2, 1),
                                (0, deadline), (0, deadline + 1),
                                (True, 2), (0, False), ("0", 1), (0, 1.0)):
                with self.subTest(abort=abort, stop=stop):
                    with self.assertRaises(PILOT.PilotValidationError):
                        PILOT.supervise_bound_process(
                            observer, process=process, stdout_fd=process.stdout.fileno(),
                            stderr_fd=process.stderr.fileno(), evidence_read_fd=fd,
                            control_write_fd=process.stdin.fileno(),
                            abort_cutoff_us=abort, stop_cutoff_us=stop)
            # Zero is a valid earlier boundary, immediately stopping this own
            # observer. It must not renew the original absolute deadline.
            _, report = supervise(process, fd, deadline, abort_cutoff_us=0, stop_cutoff_us=0)
            self.assertEqual(report["supervision_status"], "INCOMPLETE")
            self.assertFalse(report["process_reaped"])
            self.assertEqual(report["consumer"]["cleanup_deadline_us"], deadline)

    def test_stop_cutoff_returns_incomplete_while_exact_owned_child_remains_alive(self):
        deadline = clock_us() + 3_000_000
        with child("hold", deadline=deadline) as (process, fd, deadline):
            _, report = supervise(process, fd, deadline,
                                  abort_cutoff_us=deadline - 2_000_000,
                                  stop_cutoff_us=deadline - 1_500_000)
            self.assertEqual(report["supervision_status"], "INCOMPLETE")
            self.assertTrue(report["remote_ack_sent"])
            self.assertTrue(report["abort_sent"])
            self.assertFalse(report["process_reaped"])
            self.assertIsNone(report["process_exit_code"])
            self.assertIsNone(process.poll())
            self.assertLess(clock_us(), deadline)
            self.assertFalse(report["consumer"]["stdout"]["eof"])
            self.assertFalse(report["consumer"]["stderr"]["eof"])

    def test_fork_child_wait_and_kill_target_only_original_positive_pid(self):
        pid = 54321
        with patch.object(PILOT.os, "WNOHANG", 1, create=True), \
             patch.object(PILOT.signal, "SIGKILL", 9, create=True), \
             patch.object(PILOT.os, "waitpid", return_value=(0, 0), create=True) as wait, \
             patch.object(PILOT.os, "waitstatus_to_exitcode", return_value=3, create=True) as decode, \
             patch.object(PILOT.os, "kill") as kill:
            owned = PILOT._ForkChild(pid)
            self.assertIsNone(owned.poll())
            owned.kill()
            kill.assert_called_once_with(pid, 9)
            wait.return_value = (pid, 768)
            self.assertEqual(owned.poll(), 3)
            decode.assert_called_once_with(768)
            owned.kill()
            self.assertEqual(kill.call_count, 1)
            self.assertTrue(all(call.args == (pid, 1) for call in wait.call_args_list))

    def test_kill_poll_preserves_pending_custody_and_actual_return_on_clock_failure(self):
        class FailingClock:
            def __call__(self):
                raise RuntimeError("synthetic lost monotonic clock")
        observer = PILOT.V5InvocationConsumer(
            run=RUN, cleanup_deadline_us=4_000_000, clock_us=FailingClock(),
            shared_constants=CONSTANTS)
        with patch.object(PILOT.os, "WNOHANG", 1, create=True), \
             patch.object(PILOT.signal, "SIGKILL", 9, create=True), \
             patch.object(PILOT.os, "waitpid", return_value=(0, 0), create=True) as wait, \
             patch.object(PILOT.os, "waitstatus_to_exitcode", return_value=3, create=True), \
             patch.object(PILOT.os, "kill") as kill:
            pending = PILOT._ForkChild(54321)
            reaped, error = PILOT._kill_and_poll_own(pending, observer, stop_us=3_500_000)
            self.assertFalse(reaped)
            self.assertEqual(error, "RuntimeError")
            self.assertIsNone(pending.returncode)
            self.assertEqual(pending.pid, 54321)
            kill.assert_called_once_with(54321, 9)
            wait.return_value = (54322, 768)
            observed = PILOT._ForkChild(54322)
            reaped, error = PILOT._kill_and_poll_own(observed, observer)
            self.assertTrue(reaped)
            self.assertEqual(error, "RuntimeError")
            self.assertEqual(observed.returncode, 3)
            self.assertEqual(kill.call_count, 1)


class MockedLinuxEntryAndPublicationTests(unittest.TestCase):
    def test_linux_preconditions_and_repeated_latch_prevent_second_fork(self):
        bound = Mock()
        observer = consumer(clock_us() + 3_000_000)
        with patch.object(PILOT.sys, "platform", "win32"), \
             patch.object(PILOT.os, "fork", create=True) as fork:
            with self.assertRaises(PILOT.PilotValidationError):
                PILOT.supervise_bound(observer, bound, output_dir_fd=123)
            fork.assert_not_called()
            bound.assert_not_called()
            self.assertTrue(observer._process_supervised)
            self.assertIs(observer.abort_requested(), True)
            self.assertEqual(observer.receipt()["first_failure"], "SUPERVISOR_SETUP_FAILURE")
        observer = consumer(clock_us() + 3_000_000)
        with mocked_linux_entry() as mocked:
            with self.assertRaises(OSError):
                PILOT.supervise_bound(observer, bound, output_dir_fd=123)
            self.assertTrue(observer._process_supervised)
            with self.assertRaises(PILOT.PilotValidationError):
                PILOT.supervise_bound(observer, bound, output_dir_fd=123)
            mocked.fork.assert_called_once_with()
            self.assertEqual(mocked.pipe.call_count, 5)
            mocked.stat.assert_called_once_with("/dev/null", follow_symlinks=False)
            bound.assert_not_called()
            self.assertIs(observer.abort_requested(), True)
            self.assertEqual(observer.receipt()["first_failure"], "SUPERVISOR_FORK_FAILURE")
            leaking_observer = consumer(clock_us() + 3_000_000)
            with patch.object(PILOT.os, "listdir", side_effect=lambda path: ["owned-main-task"]
                              if path == "/proc/self/task" else ["0", "1", "2", "123", "999"]):
                with self.assertRaises(PILOT.PilotValidationError) as rejected:
                    PILOT.supervise_bound(leaking_observer, bound, output_dir_fd=123)
            self.assertEqual(rejected.exception.code, "UNLISTED_INHERITED_FD")
            self.assertEqual(mocked.pipe.call_count, 5)
            mocked.fork.assert_called_once_with()

    def test_permission_failure_consumes_latch_even_after_directory_is_corrected(self):
        observer = consumer(clock_us() + 3_000_000)
        bound = Mock()
        with mocked_linux_entry(directory_mode=0o722) as mocked:
            with self.assertRaises(PILOT.PilotValidationError) as rejected:
                PILOT.supervise_bound(observer, bound, output_dir_fd=123)
            self.assertEqual(rejected.exception.code, "AUXILIARY_DIRECTORY_MODE")
            self.assertTrue(observer._process_supervised)
            self.assertIs(observer.abort_requested(), True)
            first_receipt = observer.receipt()
            self.assertEqual(first_receipt["first_failure"], "SUPERVISOR_SETUP_FAILURE")
            first_checks = mocked.fstat.call_count
            mocked.directory.st_mode = PILOT.stat.S_IFDIR | 0o700
            with self.assertRaises(PILOT.PilotValidationError) as repeated:
                PILOT.supervise_bound(observer, bound, output_dir_fd=123)
            self.assertEqual(repeated.exception.code, "REPEATED_PROCESS_INVOCATION")
            self.assertEqual(mocked.fstat.call_count, first_checks)
            mocked.pipe.assert_not_called()
            mocked.fork.assert_not_called()
            bound.assert_not_called()
            self.assertEqual(observer.receipt()["first_failure"], "SUPERVISOR_SETUP_FAILURE")

    def test_child_handle_allocation_failure_happens_before_pipe_and_fork(self):
        observer = consumer(clock_us() + 3_000_000)
        bound = Mock()
        with mocked_linux_entry() as mocked, \
             patch.object(PILOT._ForkChild, "allocate_for_fork", side_effect=MemoryError("fixture allocation refused")) as allocation:
            with self.assertRaises(MemoryError):
                PILOT.supervise_bound(observer, bound, output_dir_fd=123)
            allocation.assert_called_once_with()
            mocked.pipe.assert_not_called()
            mocked.fork.assert_not_called()
            self.assertTrue(observer._process_supervised)
            self.assertIs(observer.abort_requested(), True)
            self.assertEqual(observer.receipt()["first_failure"], "SUPERVISOR_FORK_FAILURE")
            with self.assertRaises(PILOT.PilotValidationError) as repeated:
                PILOT.supervise_bound(observer, bound, output_dir_fd=123)
            self.assertEqual(repeated.exception.code, "REPEATED_PROCESS_INVOCATION")
            allocation.assert_called_once_with()
            mocked.fork.assert_not_called()
            bound.assert_not_called()

    def test_any_parent_fd_close_failure_remains_incomplete_and_skips_publication(self):
        for closes in ((False, True, True), (True, False, True), (True, True, False)):
            with self.subTest(close_outcomes=closes):
                observer = consumer(clock_us() + 3_000_000)
                bound = Mock()
                child_return = b'{"bridge_error":null,"exit_main":0,"remote_acknowledged":true}'
                def completed_pump(observed, **kwargs):
                    kwargs["process"].returncode = 0
                    return {"process_exit_code": 0, "process_reaped": True,
                        "capture_outcome": "CAPTURE_COMPLETE",
                        "supervision_status": "DATA_OBSERVED_ONLY",
                        "consumer": observed.receipt(), "remote_ack_sent": True,
                        "abort_sent": False, "control_error": None,
                        "evidence_eof": True, "evidence_frame_consumed": True,
                        "evidence_wire_prefix": b"fixture", "runtime_ready": False,
                        "certificate_verified": False}
                with mocked_linux_entry() as mocked, \
                     patch.object(PILOT.os, "fork", return_value=54321, create=True) as fork, \
                     patch.object(PILOT, "supervise_bound_process", side_effect=completed_pump), \
                     patch.object(PILOT, "_pipe_fd", side_effect=lambda fd, **kwargs: fd), \
                     patch.object(PILOT.os, "read", side_effect=[child_return, b""]), \
                     patch.object(PILOT, "_close_own_fds", side_effect=closes) as close, \
                     patch.object(PILOT, "_publish_auxiliary") as publish:
                    report = PILOT.supervise_bound(observer, bound, output_dir_fd=123)
                    fork.assert_called_once_with()
                    publish.assert_not_called()
                    bound.assert_not_called()
                    self.assertEqual(close.call_count, 3)
                self.assertIs(report["fd_cleanup_complete"], False)
                self.assertEqual(report["supervision_status"], "INCOMPLETE")
                self.assertEqual(report["publication"]["status"], "INCOMPLETE")
                self.assertTrue(report["owned_child_reaped"])
                self.assertTrue(report["consumer"]["abort_requested"])
                self.assertEqual(report["consumer"]["first_failure"], "PARENT_PIPE_CLOSE_FAILED")
                self.assertEqual(report["pending_owned_children"], ())
                self.assertFalse(report["runtime_ready"])
                self.assertFalse(report["certificate_verified"])

    def test_late_publication_poll_never_promotes_and_receipt_is_pre_publication(self):
        class Clock:
            value = 1_000_000
            def __call__(self):
                return self.value
        for return_code in (0, None):
            with self.subTest(return_code=return_code):
                clock = Clock()
                observer = PILOT.V5InvocationConsumer(
                    run=RUN, cleanup_deadline_us=4_000_000, clock_us=clock,
                    shared_constants=CONSTANTS)
                result = {"process_exit_code": 0, "supervision_status": "DATA_OBSERVED_ONLY",
                          "evidence_wire_prefix": b"synthetic raw frame",
                          "pending_owned_children": (PILOT._ForkChild(54323),)}
                receipts = []
                real_dumps = json.dumps
                def capture_receipt(value, *args, **kwargs):
                    receipts.append(value)
                    return real_dumps(value, *args, **kwargs)
                def late_poll(owned):
                    owned.returncode = return_code
                    clock.value = 1_000_000 + PILOT.PIPE_CALLBACK_US if return_code == 0 else 4_000_000
                    return return_code
                with patch.object(PILOT.os, "fork", return_value=54321, create=True) as fork, \
                     patch.object(PILOT._ForkChild, "poll", late_poll), \
                     patch.object(PILOT.signal, "SIGKILL", 9, create=True), \
                     patch.object(PILOT.os, "kill") as kill, \
                     patch.object(PILOT.json, "dumps", side_effect=capture_receipt):
                    publication = PILOT._publish_auxiliary(observer, output_dir_fd=123, result=result)
                fork.assert_called_once_with()
                self.assertEqual(publication["status"], "INCOMPLETE")
                self.assertFalse(publication["custody_authenticated"])
                self.assertFalse(publication["durability_guaranteed"])
                self.assertEqual(publication["writer_exit_code"], return_code)
                self.assertIs(observer.abort_requested(), True)
                self.assertEqual(len(receipts), 1)
                self.assertEqual(receipts[0]["receipt_phase"], "PRE_PUBLICATION")
                self.assertTrue(receipts[0]["publication_result_recorded_in_return_only"])
                self.assertNotIn("pending_owned_children", receipts[0])
                self.assertNotIn("evidence_wire_prefix", receipts[0])
                if return_code == 0:
                    self.assertTrue(publication["writer_reaped"])
                    self.assertIsNone(publication["pending_owned_child"])
                    self.assertIn(publication["error"], ("PUBLICATION_SUBDEADLINE", "OWN_CHILD_REAP_CUTOFF"))
                    kill.assert_not_called()
                else:
                    self.assertFalse(publication["writer_reaped"])
                    pending = publication["pending_owned_child"]
                    self.assertIs(type(pending), PILOT._ForkChild)
                    self.assertEqual(pending.pid, 54321)
                    self.assertIsNone(pending.returncode)
                    kill.assert_called_once_with(54321, 9)


if __name__ == "__main__":
    unittest.main()
