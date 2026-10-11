"""Hermetic scope/spec/identity binding and bootstrap-data review tests.

The runtime and wrapper are never imported. Their already reviewed validators
are contract fakes/spies, so these tests measure the launcher's wiring and closed
data boundaries, not native custody, execution, or measured auxiliary budgets.
"""
from __future__ import annotations

from dataclasses import FrozenInstanceError, dataclass, replace
import hashlib
import importlib.util
import json
from pathlib import Path
import sys
from types import MappingProxyType, SimpleNamespace
import unittest
from unittest.mock import Mock, patch


ENTRY_FILE = Path(__file__).resolve().parents[1] / "scripts" / "ci" / "systemd-pilot-protected-entry.py"
MODULE_NAME = "scope_binding_entry_under_test"
MODULE_SPEC = importlib.util.spec_from_file_location(MODULE_NAME, ENTRY_FILE)
entry = importlib.util.module_from_spec(MODULE_SPEC)
sys.modules[MODULE_NAME] = entry
MODULE_SPEC.loader.exec_module(entry)

ROOT = "/srv/protected-pilot"
SCOPE_REF = "Sentinel_5d6cf0688f788191ad0503a9a351e1a7"
SOURCE_COMMIT = "a" * 40
WORKFLOW_COMMIT = "b" * 40
AUTHORIZATION_REF = "synthetic-reviewed-authorization"
WORK_US = 50_000_000
CLEANUP_US = 60_000_000
T0_US = 1_000_000


def digest(raw):
    return hashlib.sha256(raw).hexdigest()


def encode(value):
    return json.dumps(value, sort_keys=True, separators=(",", ":")).encode("utf-8")


class FakeOwnerError(ValueError):
    def __init__(self, code):
        self.code = code
        super().__init__(code)


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
                        "approved_scope_sha256": digest(b"invented scope JSON bytes")}

    def parse_strict_json(self, raw, **kwargs):
        self.parse_calls.append((raw, kwargs))
        return json.loads(raw.decode("utf-8"))

    def extract_approved_scope(self, raw):
        self.extract_calls.append(raw)
        return SimpleNamespace(values=MappingProxyType(dict(self.fixture.scope_values)),
                               json_bytes=b"invented scope JSON bytes",
                               approved_scope_sha256=digest(b"invented scope JSON bytes"))

    def validate_scope(self, parsed, **kwargs):
        self.scope_calls.append((parsed, kwargs))
        if self.validator_error is not None:
            raise self.validator_error
        return self.receipt


class Fixture:
    """Synthetic protected bytes; no filesystem/OS facts are observed here."""
    def __init__(self):
        self.python_blobs = {
            entry.ENTRY_PATH: b"# invented launcher source, never imported\n",
            entry.WRAPPER_PATH: b"# invented wrapper source, never imported\n",
            "package/systemd_memory_runtime/__init__.py": b"# invented package\n",
            "package/systemd_memory_runtime/__main__.py": b"# invented canonical main\n",
            "package/systemd_memory_runtime/contracts.py": b"# invented contracts\n",
            "package/systemd_memory_runtime/payload_distribution.py": b"# invented adapter\n",
            "package/systemd_memory_runtime/physical_cgroup.py": b"# invented physical adapter\n",
        }
        self.static_blobs = {**self.python_blobs, "sources/keeper.c": b"/* invented C, never built */\n"}
        self.elf = b"\x7fELF\x02\x01synthetic-ELF-data-never-executed"
        self.scope_document = b"Synthetic document\n```json approved-scope\n{}\n```\n"
        self.yaml = b"name: synthetic\njobs:\n  pilot:\n    if: false\n"
        self.scope_values = {"authorization_ref": AUTHORIZATION_REF, "scope_ref": SCOPE_REF}
        self.context = {"repository": entry.REPOSITORY, "event_name": "create", "ref_type": "branch",
                        "event_ref": "synthetic-review", "ref": "refs/heads/synthetic-review",
                        "run_attempt": "1", "workflow_commit": WORKFLOW_COMMIT,
                        "source_commit": SOURCE_COMMIT}
        self.spec_value = {"run": "1" * 32, "t0_us": str(T0_US),
                           "work_deadline_us": str(T0_US + WORK_US),
                           "cleanup_deadline_us": str(T0_US + CLEANUP_US),
                           "slots": [{"slot": i, "unit_name": "elogistix-memory-adapter-" + str(i + 2) * 32 + ".service",
                                      "scenario": scenario, "memory_max_bytes": 33_554_432, "tasks_max": 8}
                                     for i, scenario in enumerate(("OVERLAP", "LEADER_EXIT_THREAD_SURVIVES", "DESCENDANT_IGNORES_TERM"))],
                           "load_uid": 2042, "load_gid": 2043, "load_groups": [2043],
                           "payload_expected_sha256": digest(self.elf),
                           "cleanup_policy_id": "physical-cleanup-union-v1", "scope_ref": SCOPE_REF}
        self.manifest = {"schema": entry.SOURCE_SCHEMA, "repository": entry.REPOSITORY,
                         "source_commit": SOURCE_COMMIT,
                         "files": [{"path": p, "sha256": digest(b), "size": len(b)}
                                   for p, b in sorted(self.static_blobs.items())]}
        self.identity = entry.LoadIdentity(2042, 2043, (), ())
        self.now = T0_US + 1
        self.canonical_calls = []
        self.canonical_error = None
        self.clock = Mock(side_effect=lambda: self.now)
        self.original_main = Mock(name="canonical_main_must_not_run")
        self.wrapper = FakeWrapper(self)
        fixture = self

        class CanonicalRunSpec:
            @classmethod
            def from_mapping(cls, mapping):
                fixture.canonical_calls.append(mapping)
                if fixture.canonical_error is not None:
                    raise fixture.canonical_error
                # Canonical schema/deadline validation is delegated; this fake
                # makes that owner's rejection observable without importing it.
                values = dict(mapping)
                for key in ("t0_us", "work_deadline_us", "cleanup_deadline_us"):
                    values[key] = int(values[key])
                if values["work_deadline_us"] != values["t0_us"] + WORK_US or values["cleanup_deadline_us"] != values["t0_us"] + CLEANUP_US:
                    raise FakeOwnerError("DEADLINE")
                values["load_groups"] = tuple(values["load_groups"])
                values["slots"] = tuple(values["slots"])
                return FakeCanonicalSpec(**values)

        self.contracts = SimpleNamespace(RunSpec=CanonicalRunSpec, WORK_US=WORK_US,
                                         CLEANUP_US=CLEANUP_US, MEMORY_MAX_BYTES=33_554_432,
                                         TASKS_MAX=8, MAX_PACKET_BYTES=16_384, MAX_DEPTH=6)
        self.rebuild()

    @staticmethod
    def os_pin(path):
        return {"path": path, "sha256": digest(("invented OS bytes " + path).encode()), "size": 1}

    def rebuild(self):
        manifest_raw = encode(self.manifest)
        self.approval = {
            "schema": entry.APPROVAL_SCHEMA, "repository": entry.REPOSITORY,
            "source_commit": SOURCE_COMMIT, "branch": "synthetic-review",
            "authorization_ref": AUTHORIZATION_REF,
            "scope_document_sha256": digest(self.scope_document), "yaml_sha256": digest(self.yaml),
            "source_manifest_sha256": digest(manifest_raw), "elf_sha256": digest(self.elf),
            "event_context_sha256": digest(encode(self.context)),
            "python_files": [{"path": p, "sha256": digest(b), "size": len(b)}
                             for p, b in sorted(self.python_blobs.items())],
            "interpreter": entry.VM_INTERPRETER, "stdlib_paths": list(entry.VM_STDLIB_PATHS),
            "startup_files": sorted([self.os_pin("/usr/bin/python3.12"),
                                     self.os_pin("/usr/lib/python3.12/encodings/__init__.py"),
                                     self.os_pin("/usr/lib/python3.12/encodings/__pycache__/__init__.cpython-312.pyc"),
                                     self.os_pin("/usr/lib/python3.12/lib-dynload/synthetic.so"),
                                     *(self.os_pin(path) for path in entry.VM_NATIVE_DEPENDENCIES)],
                                    key=lambda item: item["path"]),
            "identity": {"uid": 2042, "gid": 2043, "name": "synthetic_load", "home": "/nonexistent",
                         "shell": "/usr/sbin/nologin",
                         "policy_files": [self.os_pin(p) for p in ("/etc/group", "/etc/nsswitch.conf", "/etc/passwd", "/etc/sudoers")],
                         "policy_directories": ["/etc/sudoers.d", "/etc/polkit-1/rules.d",
                                                "/usr/share/polkit-1/rules.d", "/etc/pam.d", "/etc/security"]},
        }
        self.approval_raw = encode(self.approval)
        self.blobs = {**self.static_blobs, entry.SOURCE_MANIFEST_PATH: manifest_raw,
                      entry.SCOPE_PATH: self.scope_document, entry.YAML_PATH: self.yaml,
                      entry.CONTEXT_PATH: encode(self.context), entry.SPEC_PATH: encode(self.spec_value),
                      entry.APPROVAL_PATH: self.approval_raw, entry.ELF_PATH: self.elf}
        roles = {p: "python" for p in self.python_blobs}
        roles.update({p: "data" for p in self.blobs if p not in roles})
        roles.update({entry.SCOPE_PATH: "scope", entry.SPEC_PATH: "spec", entry.ELF_PATH: "elf"})
        raw = encode({"schema": entry.INVENTORY_SCHEMA,
                      "files": [{"path": p, "sha256": digest(b), "size": len(b), "role": roles[p]}
                                for p, b in sorted(self.blobs.items())]})
        inventory = entry.parse_inventory(raw, expected_sha256=digest(raw))
        self.inputs = entry.ProtectedInputs(ROOT, inventory, MappingProxyType(dict(self.blobs)),
                                            self.approval_raw, digest(self.approval_raw))
        self.components = entry.ReviewedComponents(self.inputs, self.wrapper, self.contracts,
                                                   self.original_main, self.clock)


class ScopeBindingTests(unittest.TestCase):
    def setUp(self):
        self.fixture = Fixture()
        self.refresh = patch.object(entry, "_refresh_inputs", side_effect=lambda inputs: inputs).start()
        self.approval = patch.object(entry, "_parse_approval", side_effect=lambda raw, pin: self.fixture.approval).start()
        self.observe = patch.object(entry, "_observe_identity", side_effect=lambda approval: self.fixture.identity).start()
        patch.dict(entry._owned_components, {}, clear=True).start()
        patch.dict(entry._owned_bindings, {}, clear=True).start()
        self.addCleanup(patch.stopall)

    def bind(self, components=None):
        if components is not None:
            return entry.bind_scope_spec_identity(self.fixture.inputs, components)
        components = self.fixture.components
        # Model the protected loader's local ownership registration only; this
        # synthetic registry supplies no cryptographic/native authority.
        with patch.dict(entry._owned_components, {id(components): components}, clear=True):
            return entry.bind_scope_spec_identity(self.fixture.inputs, components)

    def assert_code(self, code, function=None):
        with self.assertRaises(entry.BootstrapError) as caught:
            (self.bind if function is None else function)()
        self.assertEqual(caught.exception.code, code)

    def test_valid_binding_reuses_exact_protected_bytes_and_canonical_schema(self):
        binding = self.bind()
        self.assertIs(binding.components, self.fixture.components)
        self.assertIs(entry._owned_bindings[id(binding)], binding)
        self.assertEqual(binding.spec.run, self.fixture.spec_value["run"])
        self.assertEqual(binding.spec.cleanup_deadline_us, T0_US + CLEANUP_US)
        self.assertEqual(self.fixture.canonical_calls, [self.fixture.spec_value])
        self.fixture.original_main.assert_not_called()
        self.assertEqual(self.refresh.call_count, 2)
        self.observe.assert_called_once_with(self.fixture.approval)

    def test_binding_with_reviewed_boundary_fakes_performs_no_native_io_or_imports(self):
        with patch("builtins.open", side_effect=AssertionError("unexpected filesystem IO")), \
             patch.object(entry.os, "open", side_effect=AssertionError("unexpected native IO")), \
             patch("importlib.import_module", side_effect=AssertionError("unexpected runtime import")):
            binding = self.bind()
        self.assertEqual(binding.spec.run, self.fixture.spec_value["run"])
        self.fixture.original_main.assert_not_called()

    def test_wrapper_receives_original_document_and_fixed_profiles_context_constants(self):
        self.bind()
        W = self.fixture.wrapper
        self.assertEqual(W.extract_calls, [self.fixture.scope_document])
        self.assertEqual(len(W.scope_calls), 1)
        _, kwargs = W.scope_calls[0]
        self.assertEqual(kwargs["context"], self.fixture.context)
        self.assertEqual(kwargs["expected_branch"], self.fixture.approval["branch"])
        self.assertEqual(kwargs["expected_source_commit"], SOURCE_COMMIT)
        self.assertEqual(kwargs["yaml_bytes"], self.fixture.yaml)
        self.assertEqual(kwargs["manifest_bytes"], self.fixture.blobs[entry.SOURCE_MANIFEST_PATH])
        self.assertEqual(kwargs["manifest_path"], entry.SOURCE_MANIFEST_PATH)
        self.assertEqual(kwargs["source_files"], self.fixture.static_blobs)
        self.assertEqual(kwargs["manifest_keys"], entry.SOURCE_MANIFEST_KEYS)
        self.assertEqual(kwargs["entry_keys"], entry.SOURCE_ENTRY_KEYS)
        self.assertEqual(kwargs["shared_constants"], {"WORK_US": WORK_US, "CLEANUP_US": CLEANUP_US,
                                                     "MEMORY_MAX_BYTES": 33_554_432, "TASKS_MAX": 8})
        self.assertEqual(W.parse_calls[-1][1], {"max_bytes": 16_384, "max_depth": 6})

    def test_receipt_and_binding_are_immutable_and_do_not_promote_owner_flags(self):
        binding = self.bind()
        with self.assertRaises(TypeError):
            binding.scope_receipt["runtime_ready"] = True
        with self.assertRaises(FrozenInstanceError):
            binding.identity = entry.LoadIdentity(1, 1, (), ())
        self.fixture.wrapper.receipt["status"] = "mutated later"
        self.assertEqual(binding.scope_receipt["status"], "CONSISTENT_DATA_ONLY")
        for key in ("runtime_ready", "authorization_authenticated", "consumption_measured"):
            self.assertIs(binding.scope_receipt[key], False)

    def test_components_must_share_same_inputs(self):
        foreign = replace(self.fixture.inputs, root="/srv/other")
        components = replace(self.fixture.components, inputs=foreign)
        with patch.dict(entry._owned_components, {id(components): components}, clear=True):
            self.assert_code("COMPONENT_INPUTS_CHANGED", lambda: self.bind(components))
        self.assertEqual(self.fixture.wrapper.parse_calls, [])

    def test_equal_but_fabricated_components_are_not_a_protected_loader_registration(self):
        fabricated = replace(self.fixture.components)
        self.assertEqual(fabricated, self.fixture.components)
        self.assertIsNot(fabricated, self.fixture.components)
        with patch.dict(entry._owned_components, {id(self.fixture.components): self.fixture.components}, clear=True):
            self.assert_code("UNBOUND_REVIEWED_COMPONENTS", lambda: self.bind(fabricated))
        self.assertEqual(self.fixture.wrapper.parse_calls, [])
        self.observe.assert_not_called()
        self.assertEqual(entry._owned_bindings, {})

    def test_missing_or_wrong_local_registry_value_cannot_bind_components(self):
        for registration in ({}, {id(self.fixture.components): object()}):
            with self.subTest(registration=registration):
                with patch.dict(entry._owned_components, registration, clear=True):
                    self.assert_code("UNBOUND_REVIEWED_COMPONENTS", lambda: self.bind(self.fixture.components))
        self.assertEqual(self.fixture.wrapper.scope_calls, [])

    def test_first_protected_refresh_failure_prevents_any_validator(self):
        self.refresh.side_effect = entry.BootstrapError("PROTECTED_INPUTS_CHANGED")
        self.assert_code("PROTECTED_INPUTS_CHANGED")
        self.assertEqual(self.fixture.wrapper.parse_calls, [])
        self.observe.assert_not_called()

    def test_second_protected_refresh_failure_prevents_binding_return(self):
        self.refresh.side_effect = [self.fixture.inputs, entry.BootstrapError("PROTECTED_INPUTS_CHANGED")]
        self.assert_code("PROTECTED_INPUTS_CHANGED")
        self.assertEqual(len(self.fixture.canonical_calls), 1)
        self.fixture.original_main.assert_not_called()

    def test_authorization_reference_is_bound_to_external_approval_before_owner_validation(self):
        self.fixture.scope_values["authorization_ref"] = "another-reference"
        self.assert_code("SCOPE_AUTHORIZATION_BINDING")
        self.assertEqual(self.fixture.wrapper.scope_calls, [])
        self.observe.assert_not_called()

    def test_spec_and_scope_ref_cannot_replace_each_other(self):
        for spec_ref, scope_ref in (("wrong", SCOPE_REF), (SCOPE_REF, "wrong"), ("wrong", "wrong")):
            with self.subTest(spec=spec_ref, scope=scope_ref):
                self.fixture.spec_value["scope_ref"] = spec_ref
                self.fixture.scope_values["scope_ref"] = scope_ref
                self.fixture.rebuild()
                self.assert_code("SPEC_SCOPE_MISMATCH")

    def test_source_manifest_semantics_are_fixed(self):
        for key, value in (("schema", "wrong"), ("repository", "wrong/repository"),
                           ("source_commit", "c" * 40), ("unreviewed_extra", True)):
            with self.subTest(key=key):
                self.fixture = Fixture()
                self.fixture.manifest[key] = value
                self.fixture.rebuild()
                self.assert_code("SOURCE_MANIFEST_SEMANTICS")
                self.assertEqual(self.fixture.wrapper.scope_calls, [])

    def test_source_manifest_requires_list_and_closed_entries(self):
        for update, code in ((lambda m: m.update(files={}), "SOURCE_MANIFEST_FILES"),
                             (lambda m: m["files"][0].update(extra=1), "SOURCE_ENTRY_KEYS"),
                             (lambda m: m["files"][0].pop("sha256"), "SOURCE_ENTRY_KEYS")):
            with self.subTest(code=code):
                self.fixture = Fixture()
                update(self.fixture.manifest)
                self.fixture.rebuild()
                self.assert_code(code)

    def test_source_manifest_rejects_all_dynamic_and_self_references(self):
        for path in (entry.APPROVAL_PATH, entry.SPEC_PATH, entry.SCOPE_PATH,
                     entry.SOURCE_MANIFEST_PATH, entry.CONTEXT_PATH, entry.ELF_PATH, entry.INVENTORY_NAME):
            with self.subTest(path=path):
                self.fixture = Fixture()
                self.fixture.manifest["files"].append({"path": path, "sha256": "a" * 64, "size": 1})
                self.fixture.rebuild()
                self.assert_code("SOURCE_DYNAMIC_REFERENCE")

    def test_source_entries_cannot_use_traversal_aliases(self):
        for path in ("../outside.py", "/outside.py", "package/./alias.py", "package\\alias.py"):
            with self.subTest(path=path):
                self.fixture = Fixture()
                self.fixture.manifest["files"][0]["path"] = path
                self.fixture.rebuild()
                self.assert_code("RELATIVE_PATH")

    def test_source_entries_require_present_unique_bytes_and_exact_integer_size(self):
        for mutation in (lambda m: m["files"].append(dict(m["files"][0])),
                         lambda m: m["files"][0].update(path="source/missing.c"),
                         lambda m: m["files"][0].update(size=True),
                         lambda m: m["files"][0].update(size=m["files"][0]["size"] + 1)):
            with self.subTest(mutation=mutation):
                self.fixture = Fixture()
                mutation(self.fixture.manifest)
                self.fixture.rebuild()
                self.assert_code("SOURCE_FILE_SIZE_OR_SET")

    def test_every_approved_python_file_must_be_in_source_manifest(self):
        for path in self.fixture.python_blobs:
            with self.subTest(path=path):
                self.fixture = Fixture()
                self.fixture.manifest["files"] = [v for v in self.fixture.manifest["files"] if v["path"] != path]
                self.fixture.rebuild()
                self.assert_code("SOURCE_MANIFEST_MISSING_PYTHON")

    def test_inventoried_keeper_source_must_be_in_source_manifest(self):
        self.fixture.manifest["files"] = [item for item in self.fixture.manifest["files"] if item["path"] != "sources/keeper.c"]
        self.fixture.rebuild()
        self.assert_code("SOURCE_MANIFEST_MISSING_KEEPER")
        self.assertEqual(self.fixture.wrapper.scope_calls, [])

    def test_owner_hash_context_and_limit_errors_are_not_swallowed_or_replaced(self):
        for code in ("MANIFEST_HASH", "SOURCE_FILE_HASH", "YAML_HASH", "EVENT_CONTEXT",
                     "SOURCE_CONTEXT", "AUTHORIZATION_SCOPE_REF", "SHARED_CONSTANT_MISMATCH"):
            with self.subTest(code=code):
                failure = FakeOwnerError(code)
                self.fixture.wrapper.validator_error = failure
                with self.assertRaises(FakeOwnerError) as caught:
                    self.bind()
                self.assertIs(caught.exception, failure)
        self.observe.assert_not_called()
        self.assertEqual(self.fixture.canonical_calls, [])

    def test_primary_group_is_bound_even_with_no_supplementary_groups(self):
        binding = self.bind()
        self.assertEqual(binding.identity.supplementary_gids, ())
        self.assertEqual(binding.spec.load_groups, (binding.identity.gid,))
        self.fixture.spec_value["load_groups"] = []
        self.fixture.rebuild()
        self.assert_code("SPEC_IDENTITY_MISMATCH")

    def test_uid_gid_or_effective_group_differences_reject_spec(self):
        for key, value in (("load_uid", 2044), ("load_gid", 2044), ("load_groups", [2043, 2044])):
            with self.subTest(key=key):
                self.fixture = Fixture()
                self.fixture.spec_value[key] = value
                self.fixture.rebuild()
                self.assert_code("SPEC_IDENTITY_MISMATCH")

    def test_identity_observation_rejection_prevents_spec_parse(self):
        self.observe.side_effect = entry.BootstrapError("ADMINISTRATIVE_CHANNEL")
        self.assert_code("ADMINISTRATIVE_CHANNEL")
        self.assertEqual(self.fixture.canonical_calls, [])

    def test_elf_must_have_magic_and_actual_hash_must_match_spec(self):
        for elf, spec_hash in ((b"not ELF", digest(b"not ELF")),
                               (self.fixture.elf, "c" * 64),
                               (self.fixture.elf + b"changed", digest(self.fixture.elf))):
            with self.subTest(elf=elf, spec_hash=spec_hash):
                self.fixture.elf = elf
                self.fixture.spec_value["payload_expected_sha256"] = spec_hash
                self.fixture.rebuild()
                self.assert_code("SPEC_ELF_MISMATCH")

    def test_original_work_deadline_must_be_live_without_renewal(self):
        raw_spec = self.fixture.blobs[entry.SPEC_PATH]
        for now in (T0_US - 1, T0_US + WORK_US, T0_US + CLEANUP_US, True, float(T0_US + 1)):
            with self.subTest(now=now):
                self.fixture.now = now
                self.assert_code("ORIGINAL_WORK_DEADLINE")
                self.assertEqual(self.fixture.inputs.blobs[entry.SPEC_PATH], raw_spec)
                self.assertEqual(self.fixture.spec_value["t0_us"], str(T0_US))

    def test_start_boundary_and_last_live_microsecond_preserve_deadlines(self):
        for now in (T0_US, T0_US + WORK_US - 1):
            with self.subTest(now=now):
                self.fixture.now = now
                binding = self.bind()
                self.assertEqual(binding.spec.t0_us, T0_US)
                self.assertEqual(binding.spec.work_deadline_us, T0_US + WORK_US)
                self.assertEqual(binding.spec.cleanup_deadline_us, T0_US + CLEANUP_US)

    def test_changed_or_renewed_canonical_deadlines_retain_owner_rejection(self):
        self.fixture.spec_value["cleanup_deadline_us"] = str(T0_US + CLEANUP_US + 1)
        self.fixture.rebuild()
        with self.assertRaises(FakeOwnerError) as caught:
            self.bind()
        self.assertEqual(caught.exception.code, "DEADLINE")
        self.fixture.original_main.assert_not_called()

    def test_other_canonical_spec_errors_are_not_swallowed(self):
        failure = FakeOwnerError("PROTOCOL")
        self.fixture.canonical_error = failure
        with self.assertRaises(FakeOwnerError) as caught:
            self.bind()
        self.assertIs(caught.exception, failure)
        self.fixture.clock.assert_not_called()


class NativeBootstrapDataTests(unittest.TestCase):
    def setUp(self):
        self.fixture = Fixture()

    def build(self, **changes):
        values = {"approval_raw": self.fixture.approval_raw,
                  "approval_sha256": digest(self.fixture.approval_raw),
                  "inventory_raw": self.fixture.inputs.inventory.raw,
                  "inventory_sha256": self.fixture.inputs.inventory.sha256,
                  "source_directory": "/srv/ingress-pilot", "protected_root": ROOT,
                  "auxiliary_output_directory": "/srv/pilot-output"}
        values.update(changes)
        return entry.build_native_bootstrap(**values)

    def assert_code(self, code, function):
        with self.assertRaises(entry.BootstrapError) as caught:
            function()
        self.assertEqual(caught.exception.code, code)

    def parse_approval(self, value):
        raw = encode(value)
        return entry._parse_approval(raw, digest(raw))

    def test_closed_real_approval_and_inventory_generate_only_data(self):
        with patch("builtins.open", side_effect=AssertionError("unexpected filesystem IO")), \
             patch.object(entry.os, "open", side_effect=AssertionError("unexpected native IO")), \
             patch("importlib.import_module", side_effect=AssertionError("unexpected runtime import")):
            recipe = self.build()
        self.assertIs(type(recipe), entry.NativeBootstrapData)
        self.assertEqual(recipe.bootstrap_argv, ("/usr/bin/dash", "-eu"))
        self.assertEqual(recipe.environment, ())
        self.assertEqual(recipe.cwd, "/")
        self.assertEqual(recipe.script_sha256, digest(recipe.stdin_script))
        self.assertEqual(recipe.python_argv[:4], ("/usr/bin/python3.12", "-I", "-S", "-B"))
        self.assertEqual(recipe.python_argv[4], ROOT + "/" + entry.ENTRY_PATH)
        with self.assertRaises(FrozenInstanceError):
            recipe.cwd = ROOT

    def test_native_recipe_hashes_all_python_and_data_before_only_python_exec(self):
        text = self.build().stdin_script.decode("ascii")
        self.assertEqual(text.count("exec /usr/bin/env -i"), 1)
        exec_offset = text.index("exec /usr/bin/env -i")
        for item in self.fixture.inputs.inventory.files:
            self.assertIn("file '%s/%s' %d '%s'" % (ROOT, item.path, item.size, item.sha256), text[:exec_offset])
        self.assertIn("count_bytes", text[:exec_offset])
        self.assertIn("iflag=nofollow,nonblock", text[:exec_offset])
        self.assertIn("set -C", text[:exec_offset])

    def test_native_stat_uid_links_and_size_fail_before_value_comparisons(self):
        text = self.build().stdin_script.decode("ascii")
        for command, comparison in (
            ('u=$(/usr/bin/stat -c %u -- "$1") || die', '[ "$u" = 0 ] || die'),
            ('l=$(/usr/bin/stat -c %h -- "$1") || die', '[ "$l" = 1 ] || die'),
            ('z=$(/usr/bin/stat -c %s -- "$1") || die', '[ "$z" = "$2" ] || die'),
        ):
            with self.subTest(command=command):
                self.assertIn(command, text)
                self.assertLess(text.index(command), text.index(comparison))
        self.assertNotIn('[ "$(/usr/bin/stat', text)

    def test_os_bytecode_is_pinned_in_separate_startup_closure(self):
        text = self.build().stdin_script.decode("ascii")
        bytecode = next(pin for pin in self.fixture.approval["startup_files"] if pin["path"].endswith(".pyc"))
        self.assertIn("file '%s' %d '%s'" % (bytecode["path"], bytecode["size"], bytecode["sha256"]), text)
        with self.assertRaises(entry.BootstrapError) as caught:
            entry._relative("package/cache.pyc")
        self.assertEqual(caught.exception.code, "BYTECODE_FORBIDDEN")

    def test_approval_pin_is_required_outside_editable_ingress_data(self):
        self.assert_code("EXTERNAL_APPROVAL_HASH", lambda: self.build(approval_sha256="a" * 64))

    def test_real_approval_schema_rejects_extras_missing_and_unresolved(self):
        for mutate, code in ((lambda a: a.update(extra=True), "APPROVAL_KEYS"),
                             (lambda a: a.pop("identity"), "APPROVAL_KEYS"),
                             (lambda a: a.update(branch="PENDING_BRANCH"), "APPROVAL_UNRESOLVED"),
                             (lambda a: a.update(source_commit="0" * 40), "SOURCE_COMMIT")):
            with self.subTest(code=code):
                value = json.loads(self.fixture.approval_raw)
                mutate(value)
                self.assert_code(code, lambda: self.parse_approval(value))

    def test_real_approval_requires_os_interpreter_stdlib_and_identity_policy_pins(self):
        for mutate, code in ((lambda a: a.update(startup_files=[]), "PIN_COUNT"),
                             (lambda a: a.update(startup_files=[p for p in a["startup_files"] if p["path"] != a["interpreter"]]), "INTERPRETER_NOT_PINNED"),
                             (lambda a: a.update(startup_files=[p for p in a["startup_files"] if not p["path"].startswith("/usr/lib/python3.12/lib-dynload/")]), "STDLIB_NOT_PINNED"),
                             (lambda a: a["identity"].update(policy_files=a["identity"]["policy_files"][:-1]), "IDENTITY_POLICY_NOT_PINNED"),
                             (lambda a: a["identity"].update(policy_directories=[]), "IDENTITY_POLICY_DIRECTORIES"),
                             (lambda a: a["identity"].update(shell="/bin/bash"), "LOAD_LOGIN_CHANNEL")):
            with self.subTest(code=code):
                value = json.loads(self.fixture.approval_raw)
                mutate(value)
                self.assert_code(code, lambda: self.parse_approval(value))

    def test_installation_python_pins_are_exact_and_not_dynamic_approval(self):
        for mutate in (lambda a: a["python_files"].pop(),
                       lambda a: a["python_files"][0].update(sha256="c" * 64),
                       lambda a: a["python_files"][0].update(size=999)):
            with self.subTest(mutation=mutate):
                value = json.loads(self.fixture.approval_raw)
                mutate(value)
                self.assert_code("UNAPPROVED_PYTHON_SOURCE", lambda: entry._validate_installation_pins(self.fixture.inputs.inventory, value))

    def test_installation_static_elf_scope_yaml_manifest_pins_cannot_drift(self):
        for key in ("elf_sha256", "scope_document_sha256", "yaml_sha256", "source_manifest_sha256", "event_context_sha256"):
            with self.subTest(key=key):
                value = json.loads(self.fixture.approval_raw)
                value[key] = "c" * 64
                self.assert_code("APPROVED_DATA_PIN", lambda: entry._validate_installation_pins(self.fixture.inputs.inventory, value))

    def test_startup_closure_cannot_supply_an_ambient_runtime_package(self):
        value = json.loads(self.fixture.approval_raw)
        value["startup_files"].append(Fixture.os_pin("/usr/lib/python3.12/systemd_memory_runtime/__init__.py"))
        value["startup_files"].sort(key=lambda item: item["path"])
        self.assert_code("AMBIENT_RUNTIME_PACKAGE", lambda: self.parse_approval(value))

    def test_fixed_vm_startup_profile_and_native_dependencies_are_required(self):
        for mutate, code in ((lambda a: a.update(interpreter="/usr/bin/python3"), "UNREVIEWED_VM_STARTUP_PROFILE"),
                             (lambda a: a.update(stdlib_paths=["/unapproved/stdlib"]), "UNREVIEWED_VM_STARTUP_PROFILE"),
                             (lambda a: a.update(startup_files=[p for p in a["startup_files"] if p["path"] not in entry.VM_NATIVE_DEPENDENCIES]), "NATIVE_STARTUP_DEPS_NOT_PINNED")):
            with self.subTest(code=code):
                value = json.loads(self.fixture.approval_raw)
                mutate(value)
                self.assert_code(code, lambda: self.parse_approval(value))

    def test_startup_zip_absence_is_checked_before_python_exec(self):
        text = self.build().stdin_script.decode("ascii")
        exec_offset = text.index("exec /usr/bin/env -i")
        self.assertIn(entry.VM_ABSENT_STARTUP_ZIP, text[:exec_offset])

    def test_empty_approved_python_and_os_policy_files_are_data_not_missing_files(self):
        path = "package/systemd_memory_runtime/__init__.py"
        self.fixture.python_blobs[path] = b""
        self.fixture.static_blobs[path] = b""
        for item in self.fixture.manifest["files"]:
            if item["path"] == path:
                item.update(sha256=digest(b""), size=0)
        self.fixture.rebuild()
        self.assertIsInstance(self.build(), entry.NativeBootstrapData)
        value = json.loads(self.fixture.approval_raw)
        value["identity"]["policy_files"][-1].update(size=0, sha256=digest(b""))
        parsed = self.parse_approval(value)
        self.assertEqual(parsed["identity"]["policy_files"][-1]["size"], 0)

    def test_installation_rejects_native_extensions_pth_and_unapproved_data_nodes(self):
        for path in ("package/injected.so", "package/extra.pth", "package/systemd_memory_runtime/extra.so",
                     "data/extra.json"):
            with self.subTest(path=path):
                value = json.loads(self.fixture.inputs.inventory.raw)
                value["files"].append({"path": path, "sha256": digest(b"synthetic"), "size": 9, "role": "data"})
                value["files"].sort(key=lambda item: item["path"])
                raw = encode(value)
                inventory = entry.parse_inventory(raw, expected_sha256=digest(raw))
                self.assert_code("UNAPPROVED_INSTALLATION_NODE", lambda: entry._validate_installation_pins(inventory, self.fixture.approval))

    def test_python_layout_cannot_hide_sources_outside_closed_runtime_package(self):
        value = json.loads(self.fixture.inputs.inventory.raw)
        extra = {"path": "package/extra.py", "sha256": digest(b"synthetic"), "size": 9, "role": "python"}
        value["files"].append(extra)
        value["files"].sort(key=lambda item: item["path"])
        raw = encode(value)
        inventory = entry.parse_inventory(raw, expected_sha256=digest(raw))
        approval = json.loads(self.fixture.approval_raw)
        approval["python_files"].append({key: extra[key] for key in ("path", "sha256", "size")})
        approval["python_files"].sort(key=lambda item: item["path"])
        self.assert_code("PYTHON_LAYOUT", lambda: entry._validate_installation_pins(inventory, approval))

    def test_bootstrap_paths_cannot_overlap_control_or_startup(self):
        for values in ({"protected_root": "/srv/ingress-pilot/sub"},
                       {"auxiliary_output_directory": ROOT + "/output"},
                       {"auxiliary_output_directory": "/srv"},
                       {"protected_root": "/usr/lib/python3.12/pilot"}):
            with self.subTest(values=values):
                self.assert_code("BOOTSTRAP_PATH_OVERLAP", lambda: self.build(**values))


if __name__ == "__main__":
    unittest.main()
