"""Hermetic ABI/request/epoch tests; no Linux, sd-bus or unit is executed."""
import copy
import ctypes as C
import importlib
from pathlib import Path
import sys
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
T = importlib.import_module("systemd_memory_runtime.sd_bus_transport")

BOOT = "11111111-2222-3333-4444-555555555555"
RUN = "a" * 32
NAMES = tuple("elogistix-memory-adapter-" + str(i) * 32 + ".service" for i in (1, 2, 3))
GEN = {"pid": 1, "start_ticks": "10", "boot_id": BOOT, "pid_namespace_ref": "pid:[1]", "mount_namespace_ref": "mnt:[2]"}


class Clock:
    def __init__(self):
        self.value = 100
    def __call__(self):
        return self.value


class FakeBusTestBoundary:
    """Explicit fake. It never loads libsystemd or authenticates real messages."""
    def __init__(self, clock, lease=60_000_000):
        self.clock = clock
        self.binding = {"boot_id": BOOT, "bus_guid": "b" * 32, "owner_unique_name": ":1.2", "manager_pid_generation": copy.deepcopy(GEN), "authority_lease_until_us": str(lease)}
        self.log, self.events = [], []
        self.request_error = None
        self.after_request = 0
        self.opened = 0
        self.reply = "/org/freedesktop/systemd1/job/1"
    def open(self, deadline):
        self.opened += 1
        self.log.append("open")
        return copy.deepcopy(self.binding)
    def epoch(self, deadline):
        return copy.deepcopy(self.binding)
    def subscribe(self, deadline):
        self.log.append("subscribe")
    def request(self, request, deadline):
        self.log.append(type(request).__name__)
        self.clock.value += self.after_request
        if self.request_error:
            raise self.request_error
        if isinstance(request, T.ManagerPolicyRequest):
            return {"UnitPath": ["/etc/systemd/system"], "Environment": []}
        return copy.deepcopy(self.reply)
    def poll(self, deadline):
        out, self.events = self.events, []
        return out
    def close(self):
        self.log.append("close")


def request():
    argv = ("/run/elogistix-memory-" + RUN + "/keeper", "--run", RUN, "--slot", "0", "--ipc", "/run/elogistix-memory-" + RUN + "/keeper.sock", "--t0-us", "0", "--work-deadline-us", "50000000", "--cleanup-deadline-us", "60000000", "--watchdog-pid", "22", "--watchdog-start-ticks", "90")
    return T.StartRequest(NAMES[0], argv, 1001, 1001, (1001,), 40_000_000)


EXPECTED_ENVIRONMENT = ("PATH=/usr/bin:/bin", "LANG=C", "LC_ALL=C")
EXPECTED_UNSET_ENVIRONMENT = (
    "GCONV_PATH", "GLIBC_TUNABLES", "LD_AUDIT", "LD_ASSUME_KERNEL", "LD_BIND_NOT", "LD_BIND_NOW",
    "LD_DEBUG", "LD_DEBUG_OUTPUT", "LD_DYNAMIC_WEAK", "LD_HWCAP_MASK", "LD_LIBRARY_PATH", "LD_NOSEGNEG",
    "LD_ORIGIN_PATH", "LD_POINTER_GUARD", "LD_PREFER_MAP_32BIT_EXEC", "LD_PRELOAD", "LD_PROFILE",
    "LD_PROFILE_OUTPUT", "LD_SHOW_AUXV", "LD_TRACE_LOADED_OBJECTS", "LD_TRACE_PRELINKING", "LD_USE_LOAD_BIAS",
    "LD_VERBOSE", "LD_WARN", "LOCPATH", "MALLOC_TRACE", "NLSPATH")


class MessageAbiTestBoundary:
    """Record the real ctypes codec calls without loading libsystemd."""
    def __init__(self, *, values=(), ends=(), sender=b":1.2"):
        self.roots, self.stack, self.methods, self.settings, self.reads = [], [], [], [], []
        self.values, self.ends, self.sender = list(values), list(ends), sender
        self.buffers, self.unrefs = [], []

    def _item(self, item):
        (self.stack[-1]["items"] if self.stack else self.roots).append(item)

    def sd_bus_message_open_container(self, msg, kind, contents):
        item = {"type": kind.decode(), "contents": contents.decode(), "items": []}
        self._item(item)
        self.stack.append(item)
        return 1

    def sd_bus_message_close_container(self, msg):
        self.stack.pop()
        return 1

    def sd_bus_message_append_basic(self, msg, signature, pointer):
        if signature in (b"s", b"o"):
            value = C.string_at(pointer).decode()
        else:
            scalar = {b"t": C.c_uint64, b"u": C.c_uint32, b"i": C.c_int32, b"b": C.c_int}[signature]
            value = C.cast(pointer, C.POINTER(scalar)).contents.value
        self._item(("basic", signature.decode(), value))
        return 1

    def sd_bus_message_new_method_call(self, bus, output, destination, path, interface, member):
        self.methods.append((destination, path, interface, member))
        C.cast(output, C.POINTER(C.c_void_p)).contents.value = 5
        return 1

    def sd_bus_message_set_auto_start(self, msg, enabled):
        self.settings.append(("auto_start", enabled))
        return 1

    def sd_bus_message_set_allow_interactive_authorization(self, msg, enabled):
        self.settings.append(("interactive_authorization", enabled))
        return 1

    def sd_bus_call(self, bus, message, timeout, error, output):
        self.settings.append(("timeout_us", timeout))
        C.cast(output, C.POINTER(C.c_void_p)).contents.value = 6
        return 1

    def sd_bus_message_get_sender(self, message):
        return self.sender

    def sd_bus_message_get_signature(self, message, complete):
        return b"a{sv}"

    def sd_bus_message_enter_container(self, message, kind, contents):
        self.reads.append(("enter", kind, contents))
        return 1

    def sd_bus_message_exit_container(self, message):
        self.reads.append(("exit",))
        return 1

    def sd_bus_message_at_end(self, message, complete):
        return int(self.ends.pop(0))

    def sd_bus_message_read_basic(self, message, signature, output):
        if signature != b"s":
            raise AssertionError("fixture supports only the closed string reply")
        value = self.values.pop(0).encode()
        self.buffers.append(value)
        self.reads.append(("basic", signature, value))
        C.cast(output, C.POINTER(C.c_char_p)).contents.value = value
        return 1

    def sd_bus_error_free(self, error):
        return 0

    def sd_bus_message_unref(self, message):
        self.unrefs.append(message.value)
        return None


def native_codec(lib, clock=None):
    bus = T._NativeBus.__new__(T._NativeBus)
    bus.lib, bus.owner, bus.bus = lib, ":1.2", C.c_void_p(1)
    bus.budget = T.Budget(clock or Clock(), 60_000_000)
    return bus


def manager_reply_abi(environment, *, sender=b":1.2"):
    values, ends = [], []
    for name, entries in (("UnitPath", ("/etc/systemd/system",)), ("Environment", environment)):
        values.append(name)
        ends.append(False)
        for entry in entries:
            values.append(entry)
            ends.append(False)
        ends.append(True)
    ends.extend((True, True))
    return MessageAbiTestBoundary(values=values, ends=ends, sender=sender)


class TransportTests(unittest.TestCase):
    def setUp(self):
        self.clock = Clock()
        self.driver = FakeBusTestBoundary(self.clock)
        self.transport = T.SdBusTransport.for_test_boundary(self.driver, authority_lease_until_us=60_000_000, clock_us=self.clock)
        self.transport.authorize_units(NAMES)
        self.transport.open(50_000_000)

    def test_native_constructor_rejects_windows_before_load(self):
        with patch.object(T.sys, "platform", "win32"), patch.object(T.C, "CDLL") as load:
            with self.assertRaisesRegex(T.TransportError, "PLATFORM_LINUX"):
                T.SdBusTransport(authority_lease_until_us=60_000_000)
            load.assert_not_called()

    def test_persistent_connection_and_subscribe_before_mutation(self):
        with self.assertRaisesRegex(T.TransportError, "OBSERVER_NOT_READY"):
            self.transport.call_closed(request(), 50_000_000)
        self.transport.subscribe(50_000_000)
        self.transport.call_closed(request(), 50_000_000)
        self.transport.call_closed(T.StopRequest(NAMES[0]), 60_000_000)
        self.assertEqual(self.driver.opened, 1)
        self.assertEqual(self.driver.log, ["open", "subscribe", "StartRequest", "StopRequest"])

    def test_no_generic_rpc_or_unreserved_name(self):
        with self.assertRaisesRegex(T.TransportError, "CLOSED_REQUEST"):
            self.transport.call_closed({"member": "RestartUnit"}, 50_000_000)
        with self.assertRaisesRegex(T.TransportError, "UNRESERVED_UNIT"):
            self.transport.call_closed(T.SnapshotRequest("elogistix-memory-adapter-" + "e" * 32 + ".service"), 50_000_000)

    def test_pre_and_post_deadline_and_lease(self):
        self.clock.value = 60_000_000
        with self.assertRaisesRegex(T.TransportError, "DEADLINE"):
            self.transport.call_closed(T.SnapshotRequest(NAMES[0]), 70_000_000)
        self.clock.value = 100
        self.transport.budget.last = 100
        self.driver.after_request = 1_000_000
        with self.assertRaisesRegex(T.TransportError, "DEADLINE"):
            self.transport.call_closed(T.SnapshotRequest(NAMES[0]), 50_000_000)

    def test_clock_regression_rejected(self):
        self.clock.value = 99
        with self.assertRaisesRegex(T.TransportError, "CLOCK_INVALID"):
            self.transport.poll_events(50_000_000)

    def test_owner_change_is_sticky_even_after_return(self):
        self.driver.binding["owner_unique_name"] = ":1.99"
        with self.assertRaisesRegex(T.TransportError, "MANAGER_IDENTITY_CHANGED"):
            self.transport.poll_events(50_000_000)
        self.driver.binding["owner_unique_name"] = ":1.2"
        with self.assertRaisesRegex(T.TransportError, "MANAGER_IDENTITY_CHANGED"):
            self.transport.poll_events(50_000_000)

    def test_native_latched_owner_changed_cannot_hide_return_to_owner(self):
        original = self.driver.epoch
        def fault(deadline): raise T.TransportError("MANAGER_OWNER_CHANGED")
        self.driver.epoch = fault
        with self.assertRaisesRegex(T.TransportError, "MANAGER_OWNER_CHANGED"):
            self.transport.poll_events(50_000_000)
        self.driver.epoch = original
        with self.assertRaisesRegex(T.TransportError, "MANAGER_OWNER_CHANGED"):
            self.transport.poll_events(50_000_000)

    def test_boot_guid_generation_epoch_changes(self):
        for field, changed in (("boot_id", "22222222-2222-3333-4444-555555555555"), ("bus_guid", "c" * 32), ("manager_pid_generation", {**GEN, "start_ticks": "11"})):
            clock = Clock()
            driver = FakeBusTestBoundary(clock)
            transport = T.SdBusTransport.for_test_boundary(driver, authority_lease_until_us=60_000_000, clock_us=clock)
            transport.open(50_000_000)
            driver.binding[field] = changed
            with self.subTest(field=field), self.assertRaisesRegex(T.TransportError, "MANAGER_IDENTITY_CHANGED"):
                transport.poll_events(50_000_000)

    def test_job_correlated_id_path_and_sender(self):
        event = {"job_id": 2, "job_path": "/org/freedesktop/systemd1/job/2", "unit_name": NAMES[0], "result": "done", "owner_unique_name": ":1.2", "observed_us": 100}
        self.driver.events.append(event)
        result = self.transport.poll_events(50_000_000)[0]
        self.assertEqual((result.boot_id, result.bus_guid, result.job_id), (BOOT, "b" * 32, 2))
        self.driver.events.append({**event, "job_path": "/org/freedesktop/systemd1/job/3"})
        with self.assertRaisesRegex(T.TransportError, "JOB_SIGNAL_INVALID"):
            self.transport.poll_events(50_000_000)

    def test_foreign_sender_and_unknown_result_rejected(self):
        for field, value in (("owner_unique_name", ":1.77"), ("result", "pretend-success")):
            self.transport.invalid = None
            self.driver.events = [{"job_id": 2, "job_path": "/org/freedesktop/systemd1/job/2", "unit_name": NAMES[0], "result": "done", "owner_unique_name": ":1.2", "observed_us": 100, field: value}]
            with self.subTest(field=field), self.assertRaisesRegex(T.TransportError, "JOB_SIGNAL_INVALID"):
                self.transport.poll_events(50_000_000)

    def test_fixed_properties_and_no_auxiliary_units(self):
        properties = dict((name, (sig, value)) for name, sig, value in T.start_properties(request()))
        self.assertEqual(properties["MemoryMax"], ("t", 33_554_432))
        self.assertEqual(properties["DefaultDependencies"], ("b", False))
        self.assertEqual(T._NativeBus.UNIT_FIELDS["DefaultDependencies"], "b")
        self.assertEqual(properties["TasksMax"], ("t", 8))
        self.assertEqual(properties["FinalKillSignal"], ("i", 9))
        self.assertEqual(properties["ExecStart"][1][0][1], request().argv)
        self.assertFalse(properties["ExecStart"][1][0][2])
        self.assertFalse(any(x in properties for x in ("ExecStartPre", "ExecStartPost", "ExecStop", "ExecStopPost", "DefaultEnvironment", "SetEnvironment")))
        self.assertEqual(properties["Environment"], ("as", EXPECTED_ENVIRONMENT))
        self.assertEqual(properties["PassEnvironment"], ("as", ()))
        self.assertEqual(properties["UnsetEnvironment"], ("as", EXPECTED_UNSET_ENVIRONMENT))
        self.assertEqual(properties["EnvironmentFiles"], ("a(sb)", ()))
        self.assertEqual(properties["PAMName"], ("s", ""))
        self.assertEqual(len(EXPECTED_UNSET_ENVIRONMENT), 27)
        self.assertLessEqual(len(properties["UnsetEnvironment"][1]), 32)
        self.assertEqual(len(set(properties["UnsetEnvironment"][1])), 27)
        self.assertEqual({name: T._NativeBus.SERVICE_FIELDS[name] for name in ("Environment", "PassEnvironment", "UnsetEnvironment", "EnvironmentFiles", "PAMName")},
                         {"Environment": "as", "PassEnvironment": "as", "UnsetEnvironment": "as", "EnvironmentFiles": "a(sb)", "PAMName": "s"})

    def test_argv_and_timers_closed(self):
        base = request()
        from dataclasses import replace
        for invalid in (replace(base, runtime_max_us=0), replace(base, runtime_max_us=40_000_001), replace(base, argv=base.argv + ("--shell",)), replace(base, argv=("/bin/sh",) + base.argv[1:]), replace(base, groups=(1002,1001)), replace(base, uid=0)):
            with self.subTest(invalid=invalid), self.assertRaises(T.TransportError):
                T.start_properties(invalid)

    def test_job_uint32_and_paths(self):
        for path in ("/org/freedesktop/systemd1/job/0", "/org/freedesktop/systemd1/job/01", "/org/freedesktop/systemd1/job/4294967296", "/caller/path"):
            with self.subTest(path=path), self.assertRaises(T.TransportError):
                T.job_id(path)

    def test_native_basic_append_abi_string_and_integer(self):
        class RecordingLib:
            def __init__(self): self.values = []
            def sd_bus_message_append_basic(self, msg, signature, pointer):
                if signature == b"s": value = C.string_at(pointer)
                elif signature == b"t": value = C.cast(pointer, C.POINTER(C.c_uint64)).contents.value
                else: value = C.cast(pointer, C.POINTER(C.c_int32)).contents.value
                self.values.append((signature, value))
                return 1
        bus = T._NativeBus.__new__(T._NativeBus)
        bus.lib = RecordingLib()
        bus._append(None, "s", "keeper")
        bus._append(None, "t", 83_886_080)
        bus._append(None, "i", 9)
        self.assertEqual(bus.lib.values, [(b"s", b"keeper"), (b"t", 83_886_080), (b"i", 9)])

    def test_broker_peer_is_distinct_from_pid1_manager(self):
        self.assertTrue(T._broker_peer_allowed((101, 102, 103), 101, 102, 0))
        self.assertTrue(T._broker_peer_allowed((1, 0, 0), 101, 102, 0))
        self.assertFalse(T._broker_peer_allowed((101, 1001, 1001), 101, 102, 0))
        self.assertFalse(T._broker_peer_allowed((202, 102, 103), 101, 102, 0))
        self.assertFalse(T._broker_peer_allowed((101, 102, 103), 101, 102, 1001))

    def test_native_start_container_shape(self):
        bus = T._NativeBus.__new__(T._NativeBus)
        log = []
        bus._open = lambda msg, typ, contents: log.append(("open", typ, contents))
        bus._close = lambda msg: log.append(("close",))
        bus._append = lambda msg, sig, value: log.append(("basic", sig, value))
        bus._append_start(None, request())
        self.assertEqual(log[0], ("open", "a", "(sv)"))
        self.assertEqual(log[-2:], [("open", "a", "(sa(sv))"), ("close",)])
        self.assertEqual(sum(x == ("open", "r", "sasb") for x in log), 1)

    def test_environment_start_serialization_uses_exact_variants_and_empty_files(self):
        lib = MessageAbiTestBoundary()
        native_codec(lib)._append_start(None, request())
        self.assertEqual(lib.stack, [])
        self.assertEqual([(root["type"], root["contents"]) for root in lib.roots], [("a", "(sv)"), ("a", "(sa(sv))")])
        self.assertEqual(lib.roots[1]["items"], [])
        variants = {record["items"][0][2]: record["items"][1] for record in lib.roots[0]["items"]}
        for name, values in (("Environment", EXPECTED_ENVIRONMENT), ("PassEnvironment", ()), ("UnsetEnvironment", EXPECTED_UNSET_ENVIRONMENT)):
            with self.subTest(property=name):
                self.assertEqual(variants[name], {"type": "v", "contents": "as", "items": [
                    {"type": "a", "contents": "s", "items": [("basic", "s", value) for value in values]}]})
        self.assertEqual(variants["EnvironmentFiles"], {"type": "v", "contents": "a(sb)", "items": [{"type": "a", "contents": "(sb)", "items": []}]})
        self.assertEqual(variants["PAMName"], {"type": "v", "contents": "s", "items": [("basic", "s", "")]})

    def test_environment_files_encoder_only_accepts_exact_empty_tuple_or_list(self):
        class TupleSubclass(tuple):
            pass
        class ListSubclass(list):
            pass
        for value in ((), []):
            with self.subTest(empty_type=type(value).__name__):
                lib = MessageAbiTestBoundary()
                with patch.object(T, "start_properties", return_value=(("EnvironmentFiles", "a(sb)", value),)):
                    native_codec(lib)._append_start(None, request())
                self.assertEqual(lib.roots[0]["items"][0]["items"][1]["items"], [{"type": "a", "contents": "(sb)", "items": []}])
        for value in (None, False, "", {}, TupleSubclass(), ListSubclass(), (("/private/environment", False),), [["/private/environment", True]]):
            with self.subTest(invalid_type=type(value).__name__), patch.object(T.os, "open", side_effect=AssertionError("codec must not read environment files")):
                lib = MessageAbiTestBoundary()
                with patch.object(T, "start_properties", return_value=(("EnvironmentFiles", "a(sb)", value),)):
                    with self.assertRaisesRegex(T.TransportError, "ENVIRONMENT_FILES_NOT_EMPTY"):
                        native_codec(lib)._append_start(None, request())
                self.assertNotIn("/private/environment", repr(lib.roots))

    def test_environment_files_decoder_rejects_entry_before_reading_its_path(self):
        for nonempty in (False, True):
            with self.subTest(nonempty=nonempty), patch.object(T.os, "open", side_effect=AssertionError("decoder must not read environment files")):
                lib = MessageAbiTestBoundary(ends=(not nonempty,))
                bus = native_codec(lib)
                if nonempty:
                    with self.assertRaisesRegex(T.TransportError, "ENVIRONMENT_FILES_NOT_EMPTY"):
                        bus._value(None, "a(sb)")
                    self.assertEqual(lib.reads, [("enter", b"a", b"(sb)")])
                else:
                    self.assertEqual(bus._value(None, "a(sb)"), [])
                    self.assertEqual(lib.reads, [("enter", b"a", b"(sb)"), ("exit",)])

    def test_manager_getall_decodes_environment_and_is_bound_to_original_unique_owner(self):
        lib = manager_reply_abi(("LANG=C", "LC_ALL=C"))
        result = native_codec(lib).request(T.ManagerPolicyRequest(), 50_000_000)
        self.assertEqual(result, {"UnitPath": ["/etc/systemd/system"], "Environment": ["LANG=C", "LC_ALL=C"]})
        self.assertEqual(lib.methods, [(b":1.2", b"/org/freedesktop/systemd1", b"org.freedesktop.DBus.Properties", b"GetAll")])
        self.assertEqual(lib.roots, [("basic", "s", "org.freedesktop.systemd1.Manager")])
        self.assertEqual(lib.settings, [("auto_start", 0), ("interactive_authorization", 0), ("timeout_us", 1_000_000)])
        self.assertEqual(lib.unrefs, [6, 5])
        self.assertEqual((lib.values, lib.ends), ([], []))

    def test_manager_environment_cannot_relax_array_bound_or_accept_foreign_sender(self):
        lib = manager_reply_abi(tuple("LANG=C" for _ in range(32)))
        result = native_codec(lib).request(T.ManagerPolicyRequest(), 50_000_000)
        self.assertEqual(len(result["Environment"]), 32)
        lib = manager_reply_abi(tuple("LANG=C" for _ in range(33)))
        with self.assertRaisesRegex(T.TransportError, "ARRAY_BOUND"):
            native_codec(lib).request(T.ManagerPolicyRequest(), 50_000_000)
        for sender in (b":1.99", b"org.freedesktop.systemd1"):
            with self.subTest(sender=sender):
                lib = manager_reply_abi((), sender=sender)
                with self.assertRaisesRegex(T.TransportError, "REPLY_SENDER"):
                    native_codec(lib).request(T.ManagerPolicyRequest(), 50_000_000)
                self.assertEqual(lib.reads, [])
                self.assertEqual(lib.unrefs, [6, 5])

    def test_native_snapshot_brackets_service_with_same_invocation(self):
        bus = T._NativeBus.__new__(T._NativeBus)
        bus.owner = ":1.2"
        replies = [T.unit_path(NAMES[0]), {"Id": NAMES[0], "InvocationID": "d" * 32, "Transient": True, "ActiveState": "active"}, {"MainPID": 33}, {"Id": NAMES[0], "InvocationID": "f" * 32, "Transient": True, "ActiveState": "inactive"}]
        bus._rpc = lambda *args, **kwargs: replies.pop(0)
        with self.assertRaisesRegex(T.TransportError, "UNIT_IDENTITY_CHANGED"):
            bus.request(T.SnapshotRequest(NAMES[0]), 50_000_000)

    def test_explicit_nonvariadic_ctypes_abi_declarations(self):
        class Fn:
            pass
        class Lib:
            def __getattr__(self, name):
                fn = Fn()
                setattr(self, name, fn)
                return fn
        lib = Lib()
        with patch.object(T.C, "CDLL", return_value=lib):
            T._NativeBus(T.Budget(self.clock, 60_000_000))
        self.assertEqual(lib.sd_bus_call.argtypes, [C.c_void_p, C.c_void_p, C.c_uint64, C.POINTER(T._Error), C.POINTER(C.c_void_p)])
        self.assertEqual(lib.sd_bus_message_append_basic.argtypes, [C.c_void_p, C.c_char, C.c_void_p])
        self.assertEqual(lib.sd_bus_message_read_basic.argtypes, [C.c_void_p, C.c_char, C.c_void_p])
        self.assertEqual(lib.sd_bus_add_match.argtypes[3], T._HANDLER)

    def test_no_reconnection_or_repeated_subscription(self):
        with self.assertRaisesRegex(T.TransportError, "CONNECTION_ALREADY_OPEN"):
            self.transport.open(50_000_000)
        self.transport.subscribe(50_000_000)
        with self.assertRaisesRegex(T.TransportError, "ALREADY_SUBSCRIBED"):
            self.transport.subscribe(50_000_000)
        self.transport.close()
        self.transport.close()
        self.assertEqual(self.driver.log.count("close"), 1)


if __name__ == "__main__":
    unittest.main()
