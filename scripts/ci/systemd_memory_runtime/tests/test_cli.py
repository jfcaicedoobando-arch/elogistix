"""CLI tests inject pure functions; no watchdog process, probes or bus runs."""
from contextlib import redirect_stdout, redirect_stderr
from contextlib import ExitStack
import importlib.util
import io
import json
import runpy
from pathlib import Path
import sys
import struct
import tempfile
from types import SimpleNamespace
import unittest
from unittest.mock import patch


PACKAGE = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PACKAGE.parent))
from systemd_memory_runtime.__main__ import main
from systemd_memory_runtime import __main__ as M
from systemd_memory_runtime.preflight import PreflightResult


fixture_spec = importlib.util.spec_from_file_location("runtime_preflight_fixtures", PACKAGE / "tests/test_preflight.py")
fixture_module = importlib.util.module_from_spec(fixture_spec)
sys.modules[fixture_spec.name] = fixture_module
fixture_spec.loader.exec_module(fixture_module)


class CliTest(unittest.TestCase):
    def test_module_entry_calls_canonical_main_without_duplicate_nominal_authority(self):
        with patch.object(M, "main", return_value=0) as canonical_main:
            with self.assertRaises(SystemExit) as finished:
                runpy.run_module("systemd_memory_runtime", run_name="__main__")
        self.assertEqual(finished.exception.code, 0)
        canonical_main.assert_called_once_with()

    def invoke(self, argv, **kwargs):
        output = io.StringIO()
        errors = io.StringIO()
        with redirect_stdout(output), redirect_stderr(errors):
            code = main(argv, **kwargs)
        return code, output.getvalue(), errors.getvalue()

    def spec_file(self, directory, mapping=None):
        path = Path(directory) / "spec.json"
        path.write_text(json.dumps(mapping or fixture_module.spec_mapping()), encoding="utf-8")
        return str(path)

    def test_preflight_only_invokes_injected_read_only_function(self):
        calls = []

        def fixture_preflight(spec):
            calls.append(spec)
            return PreflightResult(True, {"fixture_only": True}, ())

        def forbidden_run(*args, **kwargs):
            self.fail("preflight CLI invoked runtime")

        with tempfile.TemporaryDirectory(prefix="systemd-runtime-cli-", dir=PACKAGE) as directory:
            path = self.spec_file(directory)
            code, output, _ = self.invoke(["preflight", "--spec", path], preflight_fn=fixture_preflight, run_fn=forbidden_run)
        self.assertEqual(code, 0)
        self.assertEqual(len(calls), 1)
        self.assertTrue(json.loads(output)["passed"])

    def test_preflight_unavailable_returns_json_incomplete_without_invoking_runtime(self):
        calls = []

        def fixture_preflight(spec):
            calls.append(spec)
            return PreflightResult(False, {"probe_mode": "injected"}, ("PHYSICAL_COMPONENT",))

        def forbidden_run(*args, **kwargs):
            self.fail("failed preflight launched runtime")

        with tempfile.TemporaryDirectory(prefix="systemd-runtime-cli-", dir=PACKAGE) as directory:
            path = self.spec_file(directory)
            code, output, _ = self.invoke(["preflight", "--spec", path], preflight_fn=fixture_preflight, run_fn=forbidden_run)
        self.assertEqual(code, 3)
        result = json.loads(output)
        self.assertFalse(result["passed"])
        self.assertIn("PHYSICAL_COMPONENT", result["missing"])
        self.assertEqual(len(calls), 1)

    def test_default_runtime_is_unavailable_even_when_injected_capabilities_pass(self):
        def fixture_preflight(spec):
            return PreflightResult(True, {"probe_mode": "injected"}, ())

        with tempfile.TemporaryDirectory(prefix="systemd-runtime-cli-", dir=PACKAGE) as directory:
            path = self.spec_file(directory)
            code, output, _ = self.invoke(["run", "--spec", path], preflight_fn=fixture_preflight)
        self.assertEqual(code, 3)
        result = json.loads(output)
        self.assertEqual(result["status"], "INCOMPLETE")
        self.assertNotIn("memory_peak_bytes", result)

    def test_invalid_or_unknown_cli_arguments_never_probe_or_run(self):
        def forbidden(*args, **kwargs):
            self.fail("invalid CLI performed work")

        for argv in ([], ["unknown"], ["preflight"], ["run"], ["preflight", "--exec", "/bin/sh"],
                     ["run", "--spec", "missing", "--extra", "command"]):
            with self.subTest(argv=argv):
                code, output, _ = self.invoke(argv, preflight_fn=forbidden, run_fn=forbidden)
                self.assertEqual(code, 2)
                self.assertIsInstance(json.loads(output), dict)

    def test_spec_missing_malformed_extra_fields_and_float_credentials_never_probe(self):
        def forbidden(*args, **kwargs):
            self.fail("invalid spec performed work")

        with tempfile.TemporaryDirectory(prefix="systemd-runtime-cli-", dir=PACKAGE) as directory:
            path = Path(directory) / "spec.json"
            valid = fixture_module.spec_mapping()
            cases = (None, "{broken", json.dumps(valid | {"unknown": "private"}),
                     json.dumps(valid | {"load_uid": 2042.0}), json.dumps(valid | {"load_uid": True}))
            for text in cases:
                with self.subTest(case=text is None):
                    if text is not None:
                        path.write_text(text, encoding="utf-8")
                    code, output, _ = self.invoke(["preflight", "--spec", str(path)], preflight_fn=forbidden, run_fn=forbidden)
                    self.assertEqual(code, 2)
                    self.assertIsInstance(json.loads(output), dict)

    def test_duplicate_spec_key_is_rejected_before_preflight(self):
        def forbidden(*args, **kwargs):
            self.fail("duplicate-key spec performed work")

        with tempfile.TemporaryDirectory(prefix="systemd-runtime-cli-", dir=PACKAGE) as directory:
            path = Path(directory) / "spec.json"
            text = json.dumps(fixture_module.spec_mapping())
            text = text[:-1] + ',"run":"' + "a" * 32 + '"}'
            path.write_text(text, encoding="utf-8")
            code, output, _ = self.invoke(["preflight", "--spec", str(path)], preflight_fn=forbidden, run_fn=forbidden)
        self.assertEqual(code, 2)
        self.assertIsInstance(json.loads(output), dict)

    def test_injected_complete_run_is_reported_as_hermetic_even_if_it_claims_runtime(self):
        calls = []

        def fixture_preflight(spec):
            calls.append(("preflight", spec.run))
            return PreflightResult(True, {"probe_mode": "injected"}, ())

        def fixture_run(spec):
            calls.append(("run", spec.run))
            return {"status": "COMPLETE", "mode": "runtime", "samples": [], "fixture_only": True}

        with tempfile.TemporaryDirectory(prefix="systemd-runtime-cli-", dir=PACKAGE) as directory:
            path = self.spec_file(directory)
            code, output, _ = self.invoke(["run", "--spec", path], preflight_fn=fixture_preflight, run_fn=fixture_run)
        self.assertEqual(code, 0)
        self.assertEqual([kind for kind, _ in calls], ["preflight", "run"])
        self.assertEqual(json.loads(output)["mode"], "hermetic")

    def test_failed_run_preflight_never_invokes_even_an_injected_runtime(self):
        def fixture_preflight(spec):
            return PreflightResult(False, {"probe_mode": "injected"}, ("SYSTEMD_MANAGER",))

        def forbidden_run(*args, **kwargs):
            self.fail("failed run preflight performed work")

        with tempfile.TemporaryDirectory(prefix="systemd-runtime-cli-", dir=PACKAGE) as directory:
            path = self.spec_file(directory)
            code, output, _ = self.invoke(["run", "--spec", path], preflight_fn=fixture_preflight, run_fn=forbidden_run)
        self.assertEqual(code, 3)
        self.assertEqual(json.loads(output)["status"], "INCOMPLETE")
        self.assertFalse(json.loads(output)["certificate_verified"])

    def test_injected_failure_preserves_incomplete_and_does_not_emit_exception_details(self):
        def fixture_preflight(spec):
            return PreflightResult(True, {"probe_mode": "injected"}, ())

        def broken_runtime(spec):
            raise RuntimeError("PRIVATE_EXCEPTION_OR_ENVIRONMENT")

        with tempfile.TemporaryDirectory(prefix="systemd-runtime-cli-", dir=PACKAGE) as directory:
            path = self.spec_file(directory)
            code, output, _ = self.invoke(["run", "--spec", path], preflight_fn=fixture_preflight, run_fn=broken_runtime)
        self.assertEqual(code, 3)
        self.assertEqual(json.loads(output)["status"], "INCOMPLETE")
        self.assertNotIn("PRIVATE_EXCEPTION_OR_ENVIRONMENT", output)
        self.assertEqual(json.loads(output)["samples"], [])

    def test_source_elf_is_forbidden_for_preflight_before_any_probe(self):
        def forbidden(*args, **kwargs):
            self.fail("preflight source option performed work")

        with tempfile.TemporaryDirectory(prefix="systemd-runtime-cli-", dir=PACKAGE) as directory:
            path = self.spec_file(directory)
            code, output, _ = self.invoke(["preflight", "--spec", path, "--source-elf", "unread-private-payload"],
                                          preflight_fn=forbidden, run_fn=forbidden)
        self.assertEqual(code, 2)
        self.assertEqual(json.loads(output)["status"], "INVALID")

    def test_source_option_does_not_turn_injected_preflight_into_runtime_authority(self):
        def fixture_preflight(spec):
            return PreflightResult(True, {"probe_mode": "injected"}, ())

        with tempfile.TemporaryDirectory(prefix="systemd-runtime-cli-", dir=PACKAGE) as directory:
            path = self.spec_file(directory)
            code, output, _ = self.invoke(["run", "--spec", path, "--source-elf", "unread-private-payload"],
                                          preflight_fn=fixture_preflight)
        self.assertEqual(code, 3)
        result = json.loads(output)
        self.assertEqual(result["mode"], "hermetic")
        self.assertIn("INJECTED_PREFLIGHT_CANNOT_AUTHORIZE_RUNTIME", result["missing_evidence"])


class ChildSimulationExit(BaseException):
    def __init__(self, code):
        self.code = code


class ListenerFixture:
    def __init__(self, endpoint, creator=(200, 0, 0), *, family=1, kind=5, accepting=1, log=None):
        self.endpoint, self.creator, self.family, self.type = endpoint, creator, family, kind
        self.accepting, self.closed, self.log = accepting, False, log if log is not None else []

    def getsockname(self):
        return self.endpoint

    def getsockopt(self, level, option, size=None):
        if option == M.socket.SO_PEERCRED:
            return struct.pack("3i", *self.creator)
        if option == M.socket.SO_ACCEPTCONN:
            return self.accepting
        raise AssertionError("unexpected socket query")

    def close(self):
        self.closed = True
        self.log.append("listener.close")


class WatchdogListenerBootstrapTest(unittest.TestCase):
    observer_methods = ("preflight", "bind_leaf", "binding_proof", "sample_peak", "probe_cleanup", "cleanup_proof")

    def native_constants(self, stack, pid=lambda: 200):
        for name, value in (("AF_UNIX", 1), ("SOCK_SEQPACKET", 5), ("SO_PEERCRED", 17), ("SO_ACCEPTCONN", 30)):
            stack.enter_context(patch.object(M.socket, name, value, create=True))
        stack.enter_context(patch.object(M.os, "getpid", side_effect=pid))
        stack.enter_context(patch.object(M.os, "geteuid", return_value=0, create=True))
        stack.enter_context(patch.object(M.os, "getegid", return_value=0, create=True))

    def test_listener_authenticates_its_current_root_watchdog_creator(self):
        endpoint = "/run/elogistix-memory-" + "a" * 32 + "/watchdog.sock"
        listener = ListenerFixture(endpoint)
        distribution = SimpleNamespace(keeper_listener=lambda: listener)
        with ExitStack() as stack:
            self.native_constants(stack)
            self.assertIs(M._watchdog_listener(distribution, endpoint), listener)
        self.assertFalse(listener.closed)

    def test_inherited_foreign_or_nonlistening_listener_is_closed_and_rejected(self):
        endpoint = "/run/elogistix-memory-" + "a" * 32 + "/watchdog.sock"
        for changes in ({"creator": (100, 0, 0)}, {"creator": (200, 1001, 0)}, {"creator": (200, 0, 1001)},
                        {"family": 2}, {"kind": 1}, {"accepting": 0}, {"endpoint": endpoint + "-foreign"}):
            with self.subTest(changes=changes), ExitStack() as stack:
                self.native_constants(stack)
                listener = ListenerFixture(**({"endpoint": endpoint} | changes))
                calls = []

                def keeper_listener():
                    calls.append("create")
                    return listener

                with self.assertRaises(ValueError):
                    M._watchdog_listener(SimpleNamespace(keeper_listener=keeper_listener), endpoint)
                self.assertEqual(calls, ["create"])
                self.assertTrue(listener.closed)

    def bootstrap(self, inherited=False):
        from systemd_memory_runtime import sd_bus_transport as T
        from systemd_memory_runtime import systemd_backend as B
        from systemd_memory_runtime import watchdog as W

        spec = fixture_module.RunSpec.from_mapping(fixture_module.spec_mapping())
        log, current_pid = [], {"value": 100}
        endpoint = "/run/elogistix-memory-" + spec.run + "/watchdog.sock"
        listener = ListenerFixture(endpoint, creator=(100 if inherited else 200, 0, 0), log=log)

        class DistributionFixture:
            def __init__(self, **kwargs):
                log.append("distribution.construct")

            def prepare(self, actual, deadline):
                log.append("stage.prepare")
                return {"fixture": "payload"}

            def verify(self, payload, deadline):
                log.append("stage.verify")

            def keeper_listener(self):
                log.append(("listener.create", current_pid["value"]))
                return listener

        class BackendFixture:
            test_boundary = False

            def __init__(self, transport, actual, **kwargs):
                self.spec = actual
                log.append(("backend.construct", kwargs["watchdog_generation"]["pid"]))

            def close(self):
                log.append("backend.close")

        class ChannelFixture:
            def __init__(self, name):
                self.name = name

            def close(self):
                log.append(self.name + ".close")

        def fork():
            log.append("fork")
            current_pid["value"] = 200
            return 0

        def serve(*args, **kwargs):
            self.assertIs(kwargs["keeper_listener"], listener)
            self.assertEqual(kwargs["coordinator_generation"]["pid"], 100)
            log.append("serve.enter")
            raise RuntimeError("stop fixture before event loop")

        def exit_child(code):
            raise ChildSimulationExit(code)

        def observer_type(actual, *, producer_factory=None):
            self.assertIs(producer_factory, local_producer)
            log.append("observer.construct")
            return SimpleNamespace(**{method: lambda *args, **kwargs: None for method in self.observer_methods})

        def local_producer(actual):
            self.fail("bootstrap fixture attempted native producer observations")

        def native_factory(actual, *, backend, physical_module):
            self.assertIs(actual, spec)
            self.assertIsInstance(backend, BackendFixture)
            self.assertIs(physical_module.RuntimePhysicalObserver, observer_type)
            log.append("native_factory.compose")
            return local_producer

        with ExitStack() as stack:
            self.native_constants(stack, pid=lambda: current_pid["value"])
            stack.enter_context(patch.object(M.sys, "platform", "linux"))
            stack.enter_context(patch.object(M.signal, "SIGCHLD", 17, create=True))
            stack.enter_context(patch.object(M.signal, "getsignal", return_value=M.signal.SIG_DFL))
            for name in ("O_DIRECTORY", "O_CLOEXEC", "O_NOFOLLOW"):
                stack.enter_context(patch.object(M.os, name, 1, create=True))
            stack.enter_context(patch.object(M.os, "fork", side_effect=fork, create=True))
            stack.enter_context(patch.object(M.os, "pidfd_open", create=True))
            stack.enter_context(patch.object(M.os, "setsid", side_effect=lambda: log.append("setsid"), create=True))
            stack.enter_context(patch.object(M.os, "_exit", side_effect=exit_child))
            stack.enter_context(patch.object(M.os.path, "isabs", return_value=True))
            stack.enter_context(patch.object(M.os, "open", side_effect=(10, 11)))
            stack.enter_context(patch.object(M.os, "fstat", return_value=SimpleNamespace(st_uid=0, st_mode=0o700)))
            stack.enter_context(patch.object(M.os, "close"))
            stack.enter_context(patch.object(M, "monotonic_us", return_value=1000000))
            stack.enter_context(patch.object(M, "RetainedEvidenceStore", return_value=SimpleNamespace()))
            stack.enter_context(patch.object(M.socket, "socketpair", return_value=(ChannelFixture("left"), ChannelFixture("right"))))
            stack.enter_context(patch.object(M.importlib, "import_module", side_effect=lambda name: SimpleNamespace(RuntimeDistribution=DistributionFixture) if name.endswith("payload_distribution") else SimpleNamespace(RuntimePhysicalObserver=observer_type)))
            stack.enter_context(patch.object(T, "Budget", return_value=SimpleNamespace()))
            stack.enter_context(patch.object(T, "process_generation", side_effect=lambda pid: {"pid": pid}))
            stack.enter_context(patch.object(T, "pin_process", return_value=SimpleNamespace(fd=77, close=lambda: None)))
            stack.enter_context(patch.object(T, "SdBusTransport", return_value=SimpleNamespace()))
            stack.enter_context(patch.object(B, "SystemdBackend", BackendFixture))
            stack.enter_context(patch.object(W, "serve", side_effect=serve))
            stack.enter_context(patch.object(M, "create_native_physical_producer_factory", side_effect=native_factory))
            with self.assertRaises(ChildSimulationExit) as finished:
                M._native_runtime_unchecked(spec, source_elf="fixture-staged-ELF", resources=[], launch_state={})
            self.assertEqual(finished.exception.code, 3)
        return log, listener

    def test_stage_prepared_in_parent_but_listener_is_created_after_fork_in_watchdog(self):
        log, listener = self.bootstrap()
        self.assertLess(log.index("stage.prepare"), log.index("stage.verify"))
        self.assertLess(log.index("stage.verify"), log.index("fork"))
        self.assertLess(log.index("fork"), log.index(("listener.create", 200)))
        self.assertLess(log.index(("listener.create", 200)), log.index(("backend.construct", 200)))
        self.assertLess(log.index(("backend.construct", 200)), log.index("observer.construct"))
        self.assertLess(log.index(("backend.construct", 200)), log.index("native_factory.compose"))
        self.assertLess(log.index("native_factory.compose"), log.index("observer.construct"))
        self.assertLess(log.index("observer.construct"), log.index("serve.enter"))
        self.assertTrue(listener.closed)

    def test_watchdog_cannot_serve_with_an_inherited_parents_listener(self):
        log, listener = self.bootstrap(inherited=True)
        self.assertEqual([item for item in log if type(item) is tuple and item[0] == "listener.create"], [("listener.create", 200)])
        self.assertNotIn("serve.enter", log)
        self.assertNotIn(("backend.construct", 200), log)
        self.assertTrue(listener.closed)

    def test_external_observer_factory_forwards_the_same_local_producer_without_calling_it(self):
        spec = fixture_module.RunSpec.from_mapping(fixture_module.spec_mapping())
        calls = []

        def producer(*args, **kwargs):
            self.fail("pure adapter composition invoked native producer")

        observer = SimpleNamespace(**{method: lambda *args, **kwargs: None for method in self.observer_methods})

        def observer_type(actual, *, producer_factory):
            calls.append((actual, producer_factory))
            return observer

        self.assertIs(M.create_runtime_observer(spec, observer_type=observer_type, producer_factory=producer), observer)
        self.assertEqual(len(calls), 1)
        self.assertIs(calls[0][0], spec)
        self.assertIs(calls[0][1], producer)

    def test_missing_physical_observer_method_blocks_composition(self):
        spec = fixture_module.RunSpec.from_mapping(fixture_module.spec_mapping())
        for missing in self.observer_methods:
            with self.subTest(missing=missing):
                observer = SimpleNamespace(**{method: lambda *args, **kwargs: None for method in self.observer_methods if method != missing})
                with self.assertRaises(ValueError):
                    M.create_runtime_observer(spec, observer_type=lambda actual, **kwargs: observer)


if __name__ == "__main__":
    unittest.main()
