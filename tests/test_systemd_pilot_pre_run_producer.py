"""Hermetic tests of the original RunSpec producer from sealed pre-run data.

All OS facts and native file writes are instrumented seams. Only the owned
launcher is imported; invented central/wrapper fakes never execute native code.
"""
from __future__ import annotations

from contextlib import ExitStack
from dataclasses import FrozenInstanceError, dataclass, replace
import hashlib
import importlib.util
import json
from pathlib import Path
import stat
import sys
from types import MappingProxyType, SimpleNamespace
import unittest
from unittest.mock import Mock, patch


ENTRY_FILE = Path(__file__).resolve().parents[1] / "scripts" / "ci" / "systemd-pilot-protected-entry.py"
MODULE_NAME = "pre_run_producer_entry_under_test"
MODULE_SPEC = importlib.util.spec_from_file_location(MODULE_NAME, ENTRY_FILE)
entry = importlib.util.module_from_spec(MODULE_SPEC)
sys.modules[MODULE_NAME] = entry
MODULE_SPEC.loader.exec_module(entry)

ROOT = "/srv/sealed-pre-run"
SCOPE_REF = "Sentinel_5d6cf0688f788191ad0503a9a351e1a7"
AUTHORIZATION_REF = "synthetic-reviewed-authorization"
WORK_US = 50_000_000
CLEANUP_US = 60_000_000
T0_US = 1_000_000


def digest(raw):
    return hashlib.sha256(raw).hexdigest()


def encode(value):
    return json.dumps(value, sort_keys=True, separators=(",", ":")).encode("ascii")


def pin(path):
    return {"path": path, "sha256": digest(("synthetic approved OS " + path).encode("ascii")), "size": 1}


class FakeOwnerError(ValueError):
    def __init__(self, code):
        self.code = code
        super().__init__(code)


@dataclass(frozen=True)
class FakeCanonicalSlot:
    slot: int
    unit_name: str
    scenario: str
    memory_max_bytes: int
    tasks_max: int

    def to_mapping(self):
        return {"slot": self.slot, "unit_name": self.unit_name, "scenario": self.scenario,
                "memory_max_bytes": self.memory_max_bytes, "tasks_max": self.tasks_max}


@dataclass(frozen=True)
class FakeCanonicalSpec:
    run: str
    t0_us: int
    work_deadline_us: int
    cleanup_deadline_us: int
    slots: tuple
    load_uid: int
    load_gid: int
    load_groups: tuple
    payload_expected_sha256: str
    cleanup_policy_id: str
    scope_ref: str

    def to_mapping(self):
        return {"run": self.run, "t0_us": str(self.t0_us),
                "work_deadline_us": str(self.work_deadline_us),
                "cleanup_deadline_us": str(self.cleanup_deadline_us),
                "slots": [slot.to_mapping() if isinstance(slot, FakeCanonicalSlot) else slot for slot in self.slots], "load_uid": self.load_uid,
                "load_gid": self.load_gid, "load_groups": list(self.load_groups),
                "payload_expected_sha256": self.payload_expected_sha256,
                "cleanup_policy_id": self.cleanup_policy_id, "scope_ref": self.scope_ref}


class FakeWrapper:
    AUTHORIZATION_SCOPE_REF = SCOPE_REF

    def __init__(self, fixture):
        self.fixture = fixture
        self.parse_calls = []
        self.extract_calls = []
        self.scope_calls = []
        self.validator_error = None
        self.receipt = {"status": "CONSISTENT_DATA_ONLY", "runtime_ready": False,
                        "authorization_authenticated": False, "consumption_measured": False,
                        "approved_scope_sha256": digest(b"invented scope JSON")}

    def parse_strict_json(self, raw, **kwargs):
        self.parse_calls.append((raw, kwargs))
        return json.loads(raw.decode("utf-8"))

    def extract_approved_scope(self, raw):
        self.extract_calls.append(raw)
        return SimpleNamespace(values=MappingProxyType(dict(self.fixture.scope_values)),
                               json_bytes=b"invented scope JSON",
                               approved_scope_sha256=digest(b"invented scope JSON"))

    def validate_scope(self, parsed, **kwargs):
        self.scope_calls.append((parsed, kwargs))
        if self.validator_error is not None:
            raise self.validator_error
        return self.receipt


class ProducerFixture:
    """Synthetic closed pre-run bytes with faithful canonical-owner call spies."""
    def __init__(self):
        python_paths = (entry.ENTRY_PATH, entry.WRAPPER_PATH,
                        "package/systemd_memory_runtime/__init__.py",
                        "package/systemd_memory_runtime/__main__.py",
                        "package/systemd_memory_runtime/contracts.py",
                        "package/systemd_memory_runtime/payload_distribution.py",
                        "package/systemd_memory_runtime/physical_cgroup.py")
        self.python_blobs = {path: ("# synthetic " + path + " never imported\n").encode("ascii")
                             for path in python_paths}
        self.static_blobs = {**self.python_blobs, "sources/keeper.c": b"/* synthetic, never compiled */\n"}
        self.elf = b"\x7fELF\x02\x01synthetic-ELF-never-executed"
        self.scope = b"```json approved-scope\n{}\n```\n"
        self.scope_values = {"authorization_ref": AUTHORIZATION_REF, "scope_ref": SCOPE_REF}
        self.yaml = b"name: synthetic\njobs: {}\n"
        self.context = {"repository": entry.REPOSITORY, "event_name": "create", "ref_type": "branch",
                        "event_ref": "synthetic-review", "ref": "refs/heads/synthetic-review",
                        "run_attempt": "1", "workflow_commit": "b" * 40, "source_commit": "a" * 40}
        self.source_manifest = {"schema": entry.SOURCE_SCHEMA, "repository": entry.REPOSITORY,
            "source_commit": "a" * 40, "files": [{"path": p, "sha256": digest(raw), "size": len(raw)}
                                                 for p, raw in sorted(self.static_blobs.items())]}
        self.approval = {"schema": entry.APPROVAL_SCHEMA, "repository": entry.REPOSITORY,
            "source_commit": "a" * 40, "branch": "synthetic-review", "authorization_ref": AUTHORIZATION_REF,
            "scope_document_sha256": digest(self.scope), "yaml_sha256": digest(self.yaml),
            "source_manifest_sha256": digest(encode(self.source_manifest)), "elf_sha256": digest(self.elf),
            "event_context_sha256": digest(encode(self.context)),
            "python_files": [{"path": p, "sha256": digest(raw), "size": len(raw)}
                             for p, raw in sorted(self.python_blobs.items())],
            "interpreter": entry.VM_INTERPRETER, "stdlib_paths": list(entry.VM_STDLIB_PATHS),
            "startup_files": sorted([pin(entry.VM_INTERPRETER),
                pin("/usr/lib/python3.12/encodings/__init__.py"),
                pin("/usr/lib/python3.12/lib-dynload/synthetic.so"),
                *(pin(p) for p in entry.VM_NATIVE_DEPENDENCIES),
                *(pin(p) for p in entry.PREPARATION_NATIVE_TOOLS)], key=lambda item: item["path"]),
            "identity": {"uid": 2042, "gid": 2043, "name": "synthetic_load",
                "home": "/nonexistent", "shell": "/usr/sbin/nologin",
                "policy_files": [pin(p) for p in ("/etc/group", "/etc/nsswitch.conf", "/etc/passwd", "/etc/sudoers")],
                "policy_directories": ["/etc/sudoers.d", "/etc/polkit-1/rules.d",
                                       "/usr/share/polkit-1/rules.d", "/etc/pam.d", "/etc/security"]}}
        self.intent = {"schema": entry.RUN_INTENT_SCHEMA, "run": "1" * 32,
            "slots": [{"slot": i, "unit_name": "elogistix-memory-adapter-" + str(i + 2) * 32 + ".service",
                       "scenario": scenario, "memory_max_bytes": 33_554_432, "tasks_max": 8}
                      for i, scenario in enumerate(("OVERLAP", "LEADER_EXIT_THREAD_SURVIVES", "DESCENDANT_IGNORES_TERM"))],
            "load_uid": 2042, "load_gid": 2043, "load_groups": [2043],
            "payload_expected_sha256": digest(self.elf), "cleanup_policy_id": "physical-cleanup-union-v1",
            "scope_ref": SCOPE_REF}
        self.events = []
        self.identity = entry.LoadIdentity(2042, 2043, (), ())
        self.canonical_calls = []
        self.canonical_error = None
        self.slot_calls = []
        self.slot_error = None
        self.now = T0_US
        self.clock = Mock(side_effect=self.read_clock)
        self.original_main = Mock(name="central_main_must_never_run_in_producer_tests")
        self.wrapper = FakeWrapper(self)
        fixture = self

        class CanonicalSlotSpec(FakeCanonicalSlot):
            @classmethod
            def from_mapping(cls, mapping):
                fixture.events.append("canonical_slot")
                fixture.slot_calls.append(dict(mapping))
                if fixture.slot_error is not None:
                    raise fixture.slot_error
                return cls(**mapping)

        class CanonicalRunSpec(FakeCanonicalSpec):
            @classmethod
            def from_mapping(cls, mapping):
                fixture.events.append("canonical_spec")
                fixture.canonical_calls.append(dict(mapping))
                if fixture.canonical_error is not None:
                    raise fixture.canonical_error
                values = dict(mapping)
                for key in ("t0_us", "work_deadline_us", "cleanup_deadline_us"):
                    values[key] = int(values[key])
                if values["work_deadline_us"] != values["t0_us"] + WORK_US or values["cleanup_deadline_us"] != values["t0_us"] + CLEANUP_US:
                    raise FakeOwnerError("DEADLINE")
                values["load_groups"] = tuple(values["load_groups"])
                values["slots"] = tuple(values["slots"])
                return cls(**values)

        self.contracts = SimpleNamespace(RunSpec=CanonicalRunSpec, SlotSpec=CanonicalSlotSpec, WORK_US=WORK_US,
            CLEANUP_US=CLEANUP_US, MEMORY_MAX_BYTES=33_554_432, TASKS_MAX=8,
            MAX_PACKET_BYTES=16_384, MAX_DEPTH=6, CLEANUP_POLICY_ID="physical-cleanup-union-v1",
            SCENARIOS=frozenset(("OVERLAP", "LEADER_EXIT_THREAD_SURVIVES", "DESCENDANT_IGNORES_TERM")))
        self.rebuild()

    def read_clock(self):
        self.events.append("clock")
        return self.now

    def rebuild(self):
        self.approval_raw = encode(self.approval)
        self.intent_raw = encode(self.intent)
        self.blobs = {**self.static_blobs, entry.SCOPE_PATH: self.scope, entry.YAML_PATH: self.yaml,
            entry.CONTEXT_PATH: encode(self.context), entry.SOURCE_MANIFEST_PATH: encode(self.source_manifest),
            entry.APPROVAL_PATH: self.approval_raw, entry.ELF_PATH: self.elf, entry.RUN_INTENT_PATH: self.intent_raw}
        self.roles = {path: "python" for path in self.python_blobs}
        self.roles.update({path: "data" for path in self.blobs if path not in self.roles})
        self.roles.update({entry.SCOPE_PATH: "scope", entry.ELF_PATH: "elf"})
        self.rebuild_inventory()

    def rebuild_inventory(self):
        self.inventory_raw = encode({"schema": entry.INVENTORY_SCHEMA,
            "files": [{"path": path, "sha256": digest(raw), "size": len(raw), "role": self.roles[path]}
                      for path, raw in sorted(self.blobs.items())]})
        self.inventory = entry.parse_inventory(self.inventory_raw, expected_sha256=digest(self.inventory_raw))


class DescriptorModel:
    """In-memory descriptors only; simulated uid=0 grants no real authority."""
    def __init__(self):
        self.next_fd = 100
        self.nodes = {}
        self.paths = {}
        self.open_calls = []
        self.close_calls = []
        self.write_calls = []
        self.read_calls = []
        self.sync_calls = []
        self.fail_open_path = None
        self.write_limit = 5
        self.force_write_count = None
        self.corrupt_read = False
        self.change_during_read = False

    def open(self, path, flags, mode=0o777, *, dir_fd=None):
        absolute = path if path.startswith("/") else self.nodes[dir_fd]["path"].rstrip("/") + "/" + path
        self.open_calls.append((path, flags, mode, dir_fd))
        if absolute == self.fail_open_path:
            raise OSError("invented reservation failure")
        is_file = bool(flags & entry.os.O_CREAT)
        if is_file and absolute in self.paths and flags & entry.os.O_EXCL:
            raise FileExistsError("invented persistent reserved inode")
        fd = self.next_fd
        self.next_fd += 1
        self.nodes[fd] = {"path": absolute, "mode": (stat.S_IFREG | mode) if is_file else (stat.S_IFDIR | 0o700),
                          "data": bytearray(), "offset": 0, "tick": 0, "nlink": 1}
        self.paths[absolute] = fd
        return fd

    def fstat(self, fd):
        node = self.nodes[fd]
        return SimpleNamespace(st_dev=1, st_ino=fd, st_mode=node["mode"], st_uid=0, st_gid=0,
                               st_nlink=node["nlink"], st_size=len(node["data"]),
                               st_mtime_ns=node["tick"], st_ctime_ns=node["tick"])

    def write(self, fd, raw):
        self.write_calls.append((fd, bytes(raw)))
        if self.force_write_count is not None:
            return self.force_write_count
        node = self.nodes[fd]
        count = min(len(raw), self.write_limit)
        node["data"].extend(bytes(raw[:count]))
        node["offset"] += count
        node["tick"] += 1
        return count

    def lseek(self, fd, offset, whence):
        if whence != entry.os.SEEK_SET:
            raise AssertionError("only fixed absolute seek is allowed")
        self.nodes[fd]["offset"] = offset
        return offset

    def read(self, fd, maximum):
        self.read_calls.append((fd, maximum))
        node = self.nodes[fd]
        start = node["offset"]
        raw = bytes(node["data"][start:start + maximum])
        node["offset"] += len(raw)
        if self.change_during_read:
            node["tick"] += 1
        if self.corrupt_read and raw:
            return b"!" + raw[1:]
        return raw

    def fsync(self, fd):
        self.sync_calls.append(fd)

    def close(self, fd):
        self.close_calls.append(fd)


class ProducerFileHelperTests(unittest.TestCase):
    def setUp(self):
        self.fs = DescriptorModel()
        self.stack = ExitStack()
        self.addCleanup(self.stack.close)
        self.stack.enter_context(patch.object(entry.sys, "platform", "linux"))
        for name, value in (("O_DIRECTORY", 0x10000), ("O_CLOEXEC", 0x20000), ("O_NOFOLLOW", 0x40000)):
            self.stack.enter_context(patch.object(entry.os, name, value, create=True))
        for name, value in (("open", self.fs.open), ("fstat", self.fs.fstat), ("write", self.fs.write),
                            ("read", self.fs.read), ("lseek", self.fs.lseek), ("fsync", self.fs.fsync),
                            ("close", self.fs.close), ("getuid", lambda: 0), ("geteuid", lambda: 0),
                            ("listxattr", lambda fd: [])):
            self.stack.enter_context(patch.object(entry.os, name, value, create=True))
        self.unlink = self.stack.enter_context(patch.object(entry.os, "unlink", side_effect=AssertionError("must retain failed reservations")))
        self.rename = self.stack.enter_context(patch.object(entry.os, "rename", side_effect=AssertionError("must not replace names")))

    def reserve(self):
        return entry._reserve_producer_outputs(SimpleNamespace(root=ROOT))

    def test_real_reservation_uses_new_nofollow_exclusive_0600_files_under_retained_directory_fds(self):
        root_fd, data_fd, spec_fd, inventory_fd = self.reserve()
        output_flags = entry.os.O_RDWR | entry.os.O_CREAT | entry.os.O_EXCL | entry.os.O_NOFOLLOW | entry.os.O_CLOEXEC
        self.assertIn(("run-spec.json", output_flags, 0o600, data_fd), self.fs.open_calls)
        self.assertIn((entry.CLOSED_INVOCATION_INVENTORY_NAME, output_flags, 0o600, root_fd), self.fs.open_calls)
        self.assertEqual(self.fs.nodes[spec_fd]["data"], b"")
        self.assertEqual(self.fs.nodes[inventory_fd]["data"], b"")
        self.assertEqual(set(self.fs.sync_calls), {root_fd, data_fd, spec_fd, inventory_fd})
        self.assertTrue(set(self.fs.close_calls).isdisjoint((root_fd, data_fd, spec_fd, inventory_fd)))
        self.unlink.assert_not_called()
        self.rename.assert_not_called()

    def test_partial_reservation_failure_keeps_spec_name_and_closes_every_open_fd(self):
        self.fs.fail_open_path = ROOT + "/" + entry.CLOSED_INVOCATION_INVENTORY_NAME
        with self.assertRaises(entry.BootstrapError) as caught:
            self.reserve()
        self.assertEqual(caught.exception.code, "PRODUCER_RESERVATION_UNAVAILABLE")
        self.assertIn(ROOT + "/" + entry.SPEC_PATH, self.fs.paths)
        self.assertEqual(set(self.fs.close_calls), set(self.fs.nodes))
        self.unlink.assert_not_called()
        self.rename.assert_not_called()

    def test_second_real_reservation_cannot_overwrite_original_control_names(self):
        first = self.reserve()
        for fd in first:
            self.fs.close(fd)
        with self.assertRaises(entry.BootstrapError) as caught:
            self.reserve()
        self.assertEqual(caught.exception.code, "PRODUCER_RESERVATION_UNAVAILABLE")
        self.unlink.assert_not_called()
        self.rename.assert_not_called()

    def test_ancestor_close_failure_keeps_reservations_and_attempts_all_remaining_descriptors(self):
        failed = False
        def close_once(fd):
            nonlocal failed
            self.fs.close(fd)
            if self.fs.nodes[fd]["path"] == "/" and not failed:
                failed = True
                raise OSError("invented ancestor close uncertainty")
        with patch.object(entry.os, "close", side_effect=close_once):
            with self.assertRaises(entry.BootstrapError) as caught:
                self.reserve()
        self.assertEqual(caught.exception.code, "PRODUCER_RESERVATION_UNAVAILABLE")
        self.assertIn(ROOT + "/" + entry.SPEC_PATH, self.fs.paths)
        self.assertIn(ROOT + "/" + entry.CLOSED_INVOCATION_INVENTORY_NAME, self.fs.paths)
        self.assertEqual(set(self.fs.close_calls), set(self.fs.nodes))
        self.unlink.assert_not_called()
        self.rename.assert_not_called()

    def test_real_writer_handles_short_writes_and_verifies_exact_fd_readback(self):
        fd = self.reserve()[2]
        raw = b'{"original_run":"synthetic data"}'
        entry._write_reserved_control_file(fd, raw, ROOT + "/" + entry.SPEC_PATH)
        self.assertEqual(bytes(self.fs.nodes[fd]["data"]), raw)
        self.assertGreater(len(self.fs.write_calls), 1)
        self.assertTrue(self.fs.read_calls)
        self.assertEqual({opened for opened, _ in self.fs.write_calls}, {fd})
        self.assertEqual({opened for opened, _ in self.fs.read_calls}, {fd})

    def test_real_writer_rejects_nonempty_reserved_inode_before_any_write(self):
        fd = self.reserve()[2]
        self.fs.nodes[fd]["data"] = bytearray(b"already occupied")
        with self.assertRaises(entry.BootstrapError) as caught:
            entry._write_reserved_control_file(fd, b"new data", ROOT + "/" + entry.SPEC_PATH)
        self.assertEqual(caught.exception.code, "PRODUCER_RESERVATION_NOT_EMPTY_PRIVATE")
        self.assertEqual(self.fs.write_calls, [])

    def test_real_writer_rejects_zero_progress_and_changed_readback(self):
        fd = self.reserve()[2]
        self.fs.force_write_count = 0
        with self.assertRaises(entry.BootstrapError) as caught:
            entry._write_reserved_control_file(fd, b"data", ROOT + "/" + entry.SPEC_PATH)
        self.assertEqual(caught.exception.code, "PRODUCER_SHORT_WRITE")
        self.fs.force_write_count = None
        self.fs.corrupt_read = True
        with self.assertRaises(entry.BootstrapError) as caught:
            entry._write_reserved_control_file(fd, b"data", ROOT + "/" + entry.SPEC_PATH)
        self.assertEqual(caught.exception.code, "PRODUCER_OUTPUT_CHANGED")

    def test_real_writer_rejects_inode_change_during_readback(self):
        fd = self.reserve()[2]
        self.fs.change_during_read = True
        with self.assertRaises(entry.BootstrapError) as caught:
            entry._write_reserved_control_file(fd, b"data", ROOT + "/" + entry.SPEC_PATH)
        self.assertEqual(caught.exception.code, "NODE_CHANGED_DURING_READ")


class PreRunProducerTests(unittest.TestCase):
    def setUp(self):
        self.fixture = ProducerFixture()
        # Distinct data keys isolate the actual one-shot guard across test cases;
        # tests never reset or mutate the producer's consumed-attempt registry.
        self.fixture.intent["run"] = digest(self.id().encode("ascii"))[:32]
        self.fixture.rebuild()

    def prepare_wiring(self):
        self.fixture.inputs = entry.ProtectedPreRunInputs(ROOT, self.fixture.inventory,
            MappingProxyType({**self.fixture.blobs, entry.INVENTORY_NAME: self.fixture.inventory_raw}),
            self.fixture.approval_raw, digest(self.fixture.approval_raw))
        self.fixture.components = entry.ReviewedComponents(self.fixture.inputs, self.fixture.wrapper,
            self.fixture.contracts, self.fixture.original_main, self.fixture.clock)
        self.reader = patch.object(entry, "read_protected_pre_run_inputs", side_effect=self.read_pre_run).start()
        self.observe = patch.object(entry, "_observe_identity", side_effect=self.observe_identity).start()
        self.reserve = patch.object(entry, "_reserve_producer_outputs", side_effect=self.reserve_outputs).start()
        self.writer = patch.object(entry, "_write_reserved_control_file", side_effect=self.write_control).start()
        self.final_reader = patch.object(entry, "_read_protected_final_inputs", side_effect=self.read_final).start()
        self.close = patch.object(entry.os, "close", side_effect=lambda fd: self.fixture.events.append(("close", fd))).start()
        patch.dict(entry._owned_components, {id(self.fixture.components): self.fixture.components}, clear=True).start()
        patch.dict(entry._owned_pre_run_bindings, {}, clear=True).start()
        patch.dict(entry._owned_bindings, {}, clear=True).start()
        self.addCleanup(patch.stopall)
        self.written = {}

    def read_pre_run(self, root, **kwargs):
        self.fixture.events.append("read_pre_run")
        self.assertEqual(root, ROOT)
        self.assertEqual(kwargs["inventory_sha256"], self.fixture.inventory.sha256)
        self.assertEqual(kwargs["approval_sha256"], digest(self.fixture.approval_raw))
        return self.fixture.inputs

    def observe_identity(self, approval):
        self.fixture.events.append("observe_identity")
        self.assertEqual(approval, self.fixture.approval)
        return self.fixture.identity

    def reserve_outputs(self, inputs):
        self.fixture.events.append("reserve")
        self.assertIs(inputs, self.fixture.inputs)
        return (1000, 1001, 1002, 1003)

    def write_control(self, fd, raw, path):
        self.fixture.events.append(("write", fd, path))
        self.assertIs(type(raw), bytes)
        self.assertIn(fd, (1002, 1003))
        self.assertNotIn(path, self.written)
        self.written[path] = raw
        return None

    def read_final(self, root, **kwargs):
        self.fixture.events.append("read_final")
        self.assertEqual(root, ROOT)
        final_name = entry.CLOSED_INVOCATION_INVENTORY_NAME
        raw = self.written[ROOT + "/" + final_name]
        self.assertEqual(kwargs["inventory_sha256"], digest(raw))
        self.assertEqual(kwargs["approval_sha256"], digest(self.fixture.approval_raw))
        inventory = entry.parse_inventory(raw, expected_sha256=digest(raw), inventory_name=final_name)
        blobs = {**self.fixture.blobs, entry.INVENTORY_NAME: self.fixture.inventory_raw,
                 entry.SPEC_PATH: self.written[ROOT + "/" + entry.SPEC_PATH], final_name: raw}
        entry._validate_installation_pins(inventory, self.fixture.approval, final=True)
        entry._validate_final_provenance(inventory, blobs, self.fixture.approval)
        self.final_inputs = entry.ProtectedInputs(ROOT, inventory, MappingProxyType(blobs),
            self.fixture.approval_raw, digest(self.fixture.approval_raw))
        return self.final_inputs

    def validate(self):
        return entry.validate_pre_run_inputs(self.fixture.inputs, self.fixture.components)

    def produce(self, binding=None):
        if binding is None:
            binding = self.validate()
        return entry.produce_original_runspec(binding)

    def assert_bootstrap_rejected(self, call):
        with self.assertRaises(entry.BootstrapError) as caught:
            call()
        self.assertTrue(caught.exception.code)
        return caught.exception.code

    def test_closed_pre_run_fixture_cannot_authenticate_or_start_a_runtime(self):
        approval = entry._parse_approval(self.fixture.approval_raw, digest(self.fixture.approval_raw))
        entry._validate_installation_pins(self.fixture.inventory, approval, pre_run=True)
        self.assertNotIn(entry.SPEC_PATH, self.fixture.blobs)
        self.assertEqual(set(self.fixture.intent), entry.RUN_INTENT_KEYS)
        self.fixture.clock.assert_not_called()
        self.fixture.original_main.assert_not_called()
        self.assertEqual(self.fixture.wrapper.scope_calls, [])

    def test_pre_run_validation_uses_existing_owners_and_never_reads_clock_or_writes(self):
        self.prepare_wiring()
        binding = self.validate()
        self.assertIs(type(binding), entry.PreRunBinding)
        self.assertIs(binding.components, self.fixture.components)
        self.assertEqual(binding.intent_raw, self.fixture.intent_raw)
        self.assertEqual(binding.identity, self.fixture.identity)
        self.assertEqual(binding.scope_ref, SCOPE_REF)
        self.assertEqual(self.fixture.slot_calls, self.fixture.intent["slots"])
        self.assertTrue(self.fixture.wrapper.scope_calls)
        self.fixture.clock.assert_not_called()
        self.reserve.assert_not_called()
        self.writer.assert_not_called()
        self.final_reader.assert_not_called()
        self.fixture.original_main.assert_not_called()
        with self.assertRaises(FrozenInstanceError):
            binding.scope_ref = "changed"

    def test_success_reads_original_clock_once_and_preserves_fixed_50_60_second_deadlines(self):
        self.prepare_wiring()
        binding = self.produce()
        self.assertIs(type(binding), entry.ScopeSpecBinding)
        self.assertEqual(binding.spec.t0_us, T0_US)
        self.assertEqual(binding.spec.work_deadline_us, T0_US + WORK_US)
        self.assertEqual(binding.spec.cleanup_deadline_us, T0_US + CLEANUP_US)
        self.fixture.clock.assert_called_once_with()
        self.assertEqual(len(self.fixture.canonical_calls), 1)
        values = self.fixture.canonical_calls[0]
        self.assertEqual(values["t0_us"], str(T0_US))
        self.assertEqual(values["work_deadline_us"], str(T0_US + WORK_US))
        self.assertEqual(values["cleanup_deadline_us"], str(T0_US + CLEANUP_US))
        self.assertEqual(values["load_groups"], [self.fixture.identity.gid])
        self.assertEqual(values["payload_expected_sha256"], digest(self.fixture.elf))
        self.fixture.original_main.assert_not_called()
        self.assertIs(entry._owned_bindings[id(binding)], binding)

    def test_reservation_precedes_t0_and_every_writable_fd_closes_before_final_read(self):
        self.prepare_wiring()
        binding = self.produce()
        events = self.fixture.events
        self.assertLess(events.index("reserve"), events.index("clock"))
        self.assertLess(events.index("clock"), events.index("canonical_spec"))
        read_index = events.index("read_final")
        for fd in (1000, 1001, 1002, 1003):
            self.assertLess(events.index(("close", fd)), read_index)
        self.assertEqual(self.close.call_count, 4)
        self.assertEqual(binding.components.inputs, self.final_inputs)
        self.assertIs(binding.components.wrapper, self.fixture.wrapper)
        self.assertIs(binding.components.contracts, self.fixture.contracts)
        self.assertIs(binding.components.original_main, self.fixture.original_main)
        self.assertIs(binding.components.clock_us, self.fixture.clock)

    def test_final_written_inventory_binds_original_intent_preinventory_and_exact_spec_bytes(self):
        self.prepare_wiring()
        binding = self.produce()
        self.assertEqual(set(self.written), {ROOT + "/" + entry.SPEC_PATH,
                                           ROOT + "/" + entry.CLOSED_INVOCATION_INVENTORY_NAME})
        spec_raw = self.written[ROOT + "/" + entry.SPEC_PATH]
        self.assertEqual(json.loads(spec_raw), binding.spec.to_mapping())
        final_inventory = json.loads(self.written[ROOT + "/" + entry.CLOSED_INVOCATION_INVENTORY_NAME])
        files = {item["path"]: item for item in final_inventory["files"]}
        for path, raw, role in ((entry.SPEC_PATH, spec_raw, "spec"),
                                (entry.RUN_INTENT_PATH, self.fixture.intent_raw, "data"),
                                (entry.INVENTORY_NAME, self.fixture.inventory_raw, "data")):
            with self.subTest(path=path):
                self.assertEqual(files[path], {"path": path, "sha256": digest(raw), "size": len(raw), "role": role})
        self.assertEqual(set(files), set(self.fixture.blobs) | {entry.SPEC_PATH, entry.INVENTORY_NAME})

    def test_success_cannot_start_same_binding_again_or_renew_clock(self):
        self.prepare_wiring()
        pre = self.validate()
        self.produce(pre)
        self.fixture.now = T0_US + CLEANUP_US + 100
        self.assert_bootstrap_rejected(lambda: self.produce(pre))
        self.fixture.clock.assert_called_once_with()
        self.reserve.assert_called_once_with(self.fixture.inputs)
        self.assertEqual(len(self.fixture.canonical_calls), 1)

    def test_canonical_failure_consumes_attempt_and_does_not_retry_original_origin(self):
        self.prepare_wiring()
        pre = self.validate()
        self.fixture.canonical_error = FakeOwnerError("CANONICAL_REJECTION")
        with self.assertRaises(FakeOwnerError):
            self.produce(pre)
        self.fixture.canonical_error = None
        self.fixture.now += 1_000_000
        self.assert_bootstrap_rejected(lambda: self.produce(pre))
        self.fixture.clock.assert_called_once_with()
        self.reserve.assert_called_once_with(self.fixture.inputs)
        self.writer.assert_not_called()
        self.final_reader.assert_not_called()
        self.assertEqual(self.close.call_count, 4)

    def test_writer_failure_consumes_attempt_closes_fds_and_never_returns_binding(self):
        self.prepare_wiring()
        pre = self.validate()
        self.writer.side_effect = OSError("invented protected output failure")
        with self.assertRaises(OSError):
            self.produce(pre)
        self.writer.side_effect = self.write_control
        self.assert_bootstrap_rejected(lambda: self.produce(pre))
        self.fixture.clock.assert_called_once_with()
        self.final_reader.assert_not_called()
        self.assertEqual(self.close.call_count, 4)
        self.assertEqual(entry._owned_bindings, {})

    def test_pre_run_read_failure_prevents_origin_output_and_owner_imports(self):
        self.prepare_wiring()
        self.reader.side_effect = entry.BootstrapError("INVENTED_SEAL_READ_FAILURE")
        with patch("importlib.import_module", side_effect=AssertionError("unexpected new imports")):
            self.assert_bootstrap_rejected(self.validate)
        self.fixture.clock.assert_not_called()
        self.reserve.assert_not_called()
        self.assertEqual(self.fixture.wrapper.scope_calls, [])

    def test_changed_identity_after_validation_prevents_reservation_and_t0(self):
        self.prepare_wiring()
        pre = self.validate()
        self.fixture.identity = entry.LoadIdentity(2042, 2043, (2044,), ())
        self.assert_bootstrap_rejected(lambda: self.produce(pre))
        self.fixture.clock.assert_not_called()
        self.reserve.assert_not_called()

    def test_pre_run_revalidation_failure_consumes_attempt_before_any_origin(self):
        self.prepare_wiring()
        pre = self.validate()
        self.reader.side_effect = entry.BootstrapError("INVENTED_REVALIDATION_FAILURE")
        self.assertEqual(self.assert_bootstrap_rejected(lambda: self.produce(pre)), "INVENTED_REVALIDATION_FAILURE")
        self.reader.side_effect = self.read_pre_run
        self.assertEqual(self.assert_bootstrap_rejected(lambda: self.produce(pre)), "PRODUCER_ATTEMPT_CONSUMED")
        self.fixture.clock.assert_not_called()
        self.reserve.assert_not_called()

    def test_reservation_failure_consumes_attempt_without_reading_clock(self):
        self.prepare_wiring()
        pre = self.validate()
        self.reserve.side_effect = entry.BootstrapError("INVENTED_RESERVATION_FAILURE")
        self.assert_bootstrap_rejected(lambda: self.produce(pre))
        self.reserve.side_effect = self.reserve_outputs
        self.assertEqual(self.assert_bootstrap_rejected(lambda: self.produce(pre)), "PRODUCER_ATTEMPT_CONSUMED")
        self.fixture.clock.assert_not_called()
        self.reserve.assert_called_once_with(self.fixture.inputs)
        self.writer.assert_not_called()

    def test_clock_failure_consumes_attempt_and_closes_reserved_descriptors(self):
        self.prepare_wiring()
        pre = self.validate()
        self.fixture.clock.side_effect = RuntimeError("invented original clock failure")
        with self.assertRaises(RuntimeError):
            self.produce(pre)
        self.fixture.clock.side_effect = self.fixture.read_clock
        self.assertEqual(self.assert_bootstrap_rejected(lambda: self.produce(pre)), "PRODUCER_ATTEMPT_CONSUMED")
        self.fixture.clock.assert_called_once_with()
        self.assertEqual(self.close.call_count, 4)
        self.writer.assert_not_called()

    def test_invalid_clock_value_is_never_replaced_with_a_second_origin(self):
        for value in (True, -1, (1 << 64) - CLEANUP_US):
            with self.subTest(value=value):
                self.fixture = ProducerFixture()
                self.fixture.intent["run"] = digest((self.id() + str(value)).encode("ascii"))[:32]
                self.fixture.rebuild()
                self.prepare_wiring()
                self.fixture.now = value
                pre = self.validate()
                self.assertEqual(self.assert_bootstrap_rejected(lambda: self.produce(pre)), "ORIGINAL_CLOCK_VALUE")
                self.fixture.now = T0_US
                self.assertEqual(self.assert_bootstrap_rejected(lambda: self.produce(pre)), "PRODUCER_ATTEMPT_CONSUMED")
                self.fixture.clock.assert_called_once_with()
                self.writer.assert_not_called()
                patch.stopall()

    def test_second_registered_binding_for_same_pre_run_cannot_bypass_attempt(self):
        self.prepare_wiring()
        first = self.validate()
        second = self.validate()
        self.assertIsNot(first, second)
        self.produce(first)
        self.assertEqual(self.assert_bootstrap_rejected(lambda: self.produce(second)), "PRODUCER_ATTEMPT_CONSUMED")
        self.fixture.clock.assert_called_once_with()

    def test_fabricated_component_and_pre_run_dataclasses_do_not_grant_local_ownership(self):
        self.prepare_wiring()
        fabricated = replace(self.fixture.components)
        self.assertEqual(self.assert_bootstrap_rejected(lambda: entry.validate_pre_run_inputs(self.fixture.inputs, fabricated)),
                         "UNBOUND_REVIEWED_COMPONENTS")
        pre = self.validate()
        fabricated_binding = replace(pre)
        self.assertEqual(self.assert_bootstrap_rejected(lambda: self.produce(fabricated_binding)), "UNBOUND_PRE_RUN")
        self.fixture.clock.assert_not_called()
        self.reserve.assert_not_called()

    def test_changed_scope_receipt_after_validation_prevents_original_origin(self):
        self.prepare_wiring()
        pre = self.validate()
        self.fixture.wrapper.receipt = {**self.fixture.wrapper.receipt, "status": "INVENTED_CHANGED_DATA"}
        self.assertEqual(self.assert_bootstrap_rejected(lambda: self.produce(pre)), "PRE_RUN_OBSERVATIONS_CHANGED")
        self.fixture.clock.assert_not_called()
        self.reserve.assert_not_called()

    def test_existing_slot_validator_rejection_prevents_clock(self):
        self.prepare_wiring()
        self.fixture.slot_error = FakeOwnerError("OWNER_SLOT_REJECTION")
        with self.assertRaises(FakeOwnerError):
            self.validate()
        self.assertEqual(len(self.fixture.slot_calls), 1)
        self.assertEqual(self.fixture.canonical_calls, [])
        self.fixture.clock.assert_not_called()
        self.reserve.assert_not_called()

    def test_existing_scope_validator_rejection_prevents_identity_clock_and_writes(self):
        self.prepare_wiring()
        self.fixture.wrapper.validator_error = FakeOwnerError("OWNER_SCOPE_REJECTION")
        with self.assertRaises(FakeOwnerError):
            self.validate()
        self.observe.assert_not_called()
        self.fixture.clock.assert_not_called()
        self.reserve.assert_not_called()

    def test_actual_elf_hash_and_approval_pin_conflict_prevents_origin(self):
        self.fixture.elf += b"changed"
        self.fixture.rebuild()
        self.prepare_wiring()
        self.assert_bootstrap_rejected(self.validate)
        self.fixture.clock.assert_not_called()
        self.reserve.assert_not_called()

    def test_changed_final_read_cannot_publish_binding_or_retry_t0(self):
        self.prepare_wiring()
        pre = self.validate()
        def changed_final(root, **kwargs):
            inputs = self.read_final(root, **kwargs)
            blobs = dict(inputs.blobs)
            blobs[entry.SPEC_PATH] += b" "
            return replace(inputs, blobs=MappingProxyType(blobs))
        self.final_reader.side_effect = changed_final
        self.assertEqual(self.assert_bootstrap_rejected(lambda: self.produce(pre)), "PRODUCER_FINAL_READ_CHANGED")
        self.assertEqual(entry._owned_bindings, {})
        self.assertEqual(self.close.call_count, 4)
        self.assert_bootstrap_rejected(lambda: self.produce(pre))
        self.fixture.clock.assert_called_once_with()

    def test_failed_fd_close_does_not_reach_final_reader_or_republish_binding(self):
        self.prepare_wiring()
        pre = self.validate()
        def close_failure(fd):
            self.fixture.events.append(("close", fd))
            if fd == 1002:
                raise OSError("invented close uncertainty")
        self.close.side_effect = close_failure
        self.assertEqual(self.assert_bootstrap_rejected(lambda: self.produce(pre)), "PRODUCER_FD_CLOSE_FAILED")
        self.assertEqual(self.close.call_count, 4)
        self.final_reader.assert_not_called()
        self.assertEqual(entry._owned_bindings, {})
        self.assert_bootstrap_rejected(lambda: self.produce(pre))
        self.fixture.clock.assert_called_once_with()

    def test_caller_cannot_supply_probe_facts_t0_clock_or_main_replacement(self):
        self.prepare_wiring()
        pre = self.validate()
        for key, value in (("t0_us", 123), ("clock_us", lambda: 123),
                           ("original_main", Mock()), ("preflight_fn", Mock()),
                           ("run_fn", Mock()), ("os_probe", {"pid1": "systemd", "capabilities": True})):
            with self.subTest(key=key):
                with self.assertRaises(TypeError):
                    entry.produce_original_runspec(pre, **{key: value})
        binding = self.produce(pre)
        self.assertEqual(binding.spec.t0_us, T0_US)
        self.fixture.clock.assert_called_once_with()

    def test_fixed_pre_run_python_argv_is_data_with_no_caller_startup_or_clock_options(self):
        with patch.object(entry.os, "open", side_effect=AssertionError("unexpected native IO")):
            argv = entry.build_pre_run_entry_argv(protected_root=ROOT,
                inventory_sha256=self.fixture.inventory.sha256,
                approval_raw=self.fixture.approval_raw, approval_sha256=digest(self.fixture.approval_raw),
                auxiliary_output_directory="/srv/auxiliary-output")
        self.assertEqual(argv, (entry.VM_INTERPRETER, "-I", "-S", "-B", ROOT + "/" + entry.ENTRY_PATH,
            "--pre-run-root", ROOT, "--inventory-sha256", self.fixture.inventory.sha256,
            "--approval-sha256", digest(self.fixture.approval_raw),
            "--auxiliary-output-directory", "/srv/auxiliary-output"))
        self.assertEqual(entry.EXPECTED_ENVIRONMENT, (("LANG", "C.UTF-8"), ("LC_ALL", "C.UTF-8")))
        self.assertNotIn("--root", argv)
        self.assertNotIn("--t0", argv)
        self.fixture.clock.assert_not_called()

    def test_fixed_pre_run_python_argv_rejects_control_overlap_and_bad_pins(self):
        args = {"protected_root": ROOT, "inventory_sha256": self.fixture.inventory.sha256,
                "approval_raw": self.fixture.approval_raw, "approval_sha256": digest(self.fixture.approval_raw),
                "auxiliary_output_directory": "/srv/auxiliary-output"}
        for changes in ({"protected_root": "relative"}, {"inventory_sha256": "bad"},
                        {"approval_sha256": "c" * 64}, {"auxiliary_output_directory": ROOT},
                        {"auxiliary_output_directory": ROOT + "/nested"}, {"auxiliary_output_directory": "/srv"}):
            with self.subTest(changes=changes):
                self.assert_bootstrap_rejected(lambda: entry.build_pre_run_entry_argv(**{**args, **changes}))

    def test_final_provenance_rejects_changed_intent_static_pins_missing_or_added_nodes(self):
        self.prepare_wiring()
        self.produce()
        original = json.loads(self.written[ROOT + "/" + entry.CLOSED_INVOCATION_INVENTORY_NAME])
        for mutate in (lambda files: files.remove(next(item for item in files if item["path"] == entry.RUN_INTENT_PATH)),
                       lambda files: next(item for item in files if item["path"] == entry.RUN_INTENT_PATH).update(sha256="c" * 64),
                       lambda files: next(item for item in files if item["path"] == "sources/keeper.c").update(size=1),
                       lambda files: files.append({"path": "unapproved-data.json", "size": 0, "sha256": digest(b""), "role": "data"})):
            with self.subTest(mutate=mutate):
                value = json.loads(encode(original))
                mutate(value["files"])
                value["files"].sort(key=lambda item: item["path"])
                raw = encode(value)
                inventory = entry.parse_inventory(raw, expected_sha256=digest(raw),
                    inventory_name=entry.CLOSED_INVOCATION_INVENTORY_NAME)
                self.assert_bootstrap_rejected(lambda: entry._validate_final_provenance(inventory,
                    self.final_inputs.blobs, self.fixture.approval))

    def test_real_final_reader_uses_fixed_name_and_checks_external_approval_and_retained_provenance(self):
        spec_value = {key: value for key, value in self.fixture.intent.items() if key != "schema"}
        spec_value.update(t0_us=str(T0_US), work_deadline_us=str(T0_US + WORK_US),
                          cleanup_deadline_us=str(T0_US + CLEANUP_US))
        spec_raw = encode(spec_value)
        final_raw = entry._final_inventory_bytes(self.fixture.inventory,
            spec_sha256=digest(spec_raw), spec_size=len(spec_raw))
        inventory = entry.parse_inventory(final_raw, expected_sha256=digest(final_raw),
            inventory_name=entry.CLOSED_INVOCATION_INVENTORY_NAME)
        blobs = {**self.fixture.blobs, entry.INVENTORY_NAME: self.fixture.inventory_raw,
                 entry.SPEC_PATH: spec_raw, entry.CLOSED_INVOCATION_INVENTORY_NAME: final_raw}
        with patch.object(entry, "_read_single_protected_file", return_value=final_raw) as single, \
             patch.object(entry, "_read_posix_tree", return_value=MappingProxyType(blobs)) as tree:
            inputs = entry._read_protected_final_inputs(ROOT, inventory_sha256=digest(final_raw),
                approval_sha256=digest(self.fixture.approval_raw))
            self.assertIs(type(inputs), entry.ProtectedInputs)
            self.assertEqual(inputs.inventory, inventory)
            self.assertEqual(inputs.inventory.name, entry.CLOSED_INVOCATION_INVENTORY_NAME)
            single.assert_called_once_with(ROOT + "/" + entry.CLOSED_INVOCATION_INVENTORY_NAME,
                                           maximum=entry.MAX_INVENTORY_BYTES)
            tree.assert_called_once_with(ROOT, inventory, control_uid=0)
            self.assertEqual(self.assert_bootstrap_rejected(lambda: entry._read_protected_final_inputs(ROOT,
                inventory_sha256=digest(final_raw), approval_sha256="c" * 64)), "EXTERNAL_APPROVAL_HASH")
        changed = json.loads(final_raw)
        next(item for item in changed["files"] if item["path"] == entry.RUN_INTENT_PATH)["sha256"] = "c" * 64
        changed_raw = encode(changed)
        changed_blobs = {**blobs, entry.CLOSED_INVOCATION_INVENTORY_NAME: changed_raw}
        with patch.object(entry, "_read_single_protected_file", return_value=changed_raw), \
             patch.object(entry, "_read_posix_tree", return_value=MappingProxyType(changed_blobs)):
            self.assertEqual(self.assert_bootstrap_rejected(lambda: entry._read_protected_final_inputs(ROOT,
                inventory_sha256=digest(changed_raw), approval_sha256=digest(self.fixture.approval_raw))),
                "PRE_RUN_PROVENANCE_CHANGED")

    def test_main_pre_run_dispatch_reads_loads_validates_produces_then_supervises_without_legacy_bind(self):
        events = []
        inputs, components, pre_binding, binding = (object(), object(), object(), object())
        def record(label, result):
            def call(*args, **kwargs):
                events.append(label)
                return result
            return call
        result = {"supervision_status": "DATA_OBSERVED_ONLY", "pending_owned_children": (),
                  "evidence_wire_prefix": b"invented data", "invocation_attempted": True}
        args = ["--pre-run-root", ROOT, "--inventory-sha256", self.fixture.inventory.sha256,
                "--approval-sha256", digest(self.fixture.approval_raw),
                "--auxiliary-output-directory", "/srv/auxiliary-output"]
        with patch.object(entry.sys, "platform", "linux"), \
             patch.object(entry, "read_protected_pre_run_inputs", side_effect=record("read", inputs)) as reader, \
             patch.object(entry, "load_reviewed_components", side_effect=record("load", components)) as loader, \
             patch.object(entry, "validate_pre_run_inputs", side_effect=record("validate", pre_binding)) as validate, \
             patch.object(entry, "produce_original_runspec", side_effect=record("produce", binding)) as producer, \
             patch.object(entry, "run_supervised", side_effect=record("supervise", result)) as supervise, \
             patch.object(entry, "read_protected_inputs", side_effect=AssertionError("unexpected legacy reader")) as legacy_reader, \
             patch.object(entry, "bind_scope_spec_identity", side_effect=AssertionError("unexpected legacy binding")) as legacy_bind, \
             patch.object(entry.os, "open", side_effect=AssertionError("unexpected native IO")), \
             patch("builtins.print") as output:
            self.assertEqual(entry.main(args), 0)
        self.assertEqual(events, ["read", "load", "validate", "produce", "supervise"])
        reader.assert_called_once_with(ROOT, inventory_sha256=self.fixture.inventory.sha256,
                                       approval_sha256=digest(self.fixture.approval_raw))
        loader.assert_called_once_with(inputs)
        validate.assert_called_once_with(inputs, components)
        producer.assert_called_once_with(pre_binding)
        supervise.assert_called_once_with(binding, auxiliary_output_directory="/srv/auxiliary-output")
        legacy_reader.assert_not_called()
        legacy_bind.assert_not_called()
        metadata = json.loads(output.call_args.args[0])
        self.assertIs(metadata["native_runtime_certified"], False)
        self.assertEqual(metadata["evidence_wire_prefix_bytes"], len(result["evidence_wire_prefix"]))


if __name__ == "__main__":
    unittest.main()
