"""Own synthetic fixtures for review-only pilot validation; no native runtime.

Run with the already installed Python standard library:
    python -B -m unittest discover -s tests -p test_ci_systemd_synthetic_pilot.py
"""
from __future__ import annotations

from collections.abc import Mapping
from contextlib import contextmanager, redirect_stdout
import copy
import hashlib
import importlib.abc
import importlib.util
import io
import json
from pathlib import Path
import sys
import unittest
from unittest.mock import patch


class _NoRuntimeImports(importlib.abc.MetaPathFinder):
    """Fail before looking up any real runtime module, including lazy imports."""

    def find_spec(self, fullname, path=None, target=None):
        if fullname.split(".", 1)[0] in {
            "systemd_memory_runtime", "physical_cgroup", "payload_distribution"
        }:
            raise AssertionError("Real runtime import forbidden in own fixtures")
        return None


@contextmanager
def _runtime_import_guard():
    guard = _NoRuntimeImports()
    sys.meta_path.insert(0, guard)
    try:
        yield
    finally:
        sys.meta_path.remove(guard)


_MODULE_PATH = (
    Path(__file__).resolve().parents[1]
    / "scripts" / "ci" / "invoke-systemd-synthetic-pilot.py"
)
_MODULE_NAME = "_own_ci_systemd_synthetic_pilot_under_test"
_MODULE_SPEC = importlib.util.spec_from_file_location(_MODULE_NAME, _MODULE_PATH)
if _MODULE_SPEC is None or _MODULE_SPEC.loader is None:
    raise RuntimeError("Own review-only module could not be located")
PILOT = importlib.util.module_from_spec(_MODULE_SPEC)
# Dataclasses need the registered name while exec_module defines their classes.
sys.modules[_MODULE_NAME] = PILOT
with _runtime_import_guard():
    _MODULE_SPEC.loader.exec_module(PILOT)


FENCE = bytes((96, 96, 96))
REPOSITORY = "jfcaicedoobando-arch/elogistix"
SOURCE_COMMIT = "a" * 40
WORKFLOW_COMMIT = "b" * 40
BRANCH = "pilot/own-fixtures-only"
AUTHORIZATION_SCOPE_REF = "Sentinel_5d6cf0688f788191ad0503a9a351e1a7"
YAML_BYTES = b"name: own-fixture-only\non:\n  create:\n"
MANIFEST_KEYS = frozenset({"schema", "files"})
ENTRY_KEYS = frozenset({"path", "sha256"})
RECEIPT_KEYS = {
    "retained_bytes", "observed_bytes", "discarded_observed_bytes", "eof",
    "overflow", "sha256_retained", "sha256_full", "status", "reason",
}


def _sha(raw: bytes) -> str:
    return hashlib.sha256(raw).hexdigest()


def _json_bytes(value, *, pretty=False) -> bytes:
    options = {"sort_keys": True, "ensure_ascii": False}
    if pretty:
        options["indent"] = 2
    else:
        options["separators"] = (",", ":")
    return json.dumps(value, **options).encode("utf-8") + b"\n"


def _document(raw_json: bytes) -> bytes:
    return (
        b"# Own fixture: no authorization or runtime execution\n\n"
        + FENCE + b"json approved-scope\n" + raw_json + FENCE + b"\n"
    )


def _limits() -> dict:
    # Final closed profile supplied by the coordinator, not measured consumption.
    return {
        "vm_count": 1,
        "runner": "ubuntu-24.04",
        "max_services": 3,
        "max_start_requests": 3,
        "memory_max_bytes_per_service": 33_554_432,
        "tasks_max_per_service": 8,
        "authorized_memory_ceiling_bytes": 268_435_456,
        "authorized_tasks_ceiling": 32,
        "auxiliary_memory_budget_bytes": 167_772_160,
        "auxiliary_tasks_budget": 8,
        "work_duration_us": 50_000_000,
        "cleanup_duration_us": 60_000_000,
        "capture_bytes_per_stream": 65_536,
        "capture_chunk_bytes": 8192,
    }


class OwnFixtureCase(unittest.TestCase):
    def setUp(self):
        self._import_guard = _runtime_import_guard()
        self._import_guard.__enter__()
        self.addCleanup(self._import_guard.__exit__, None, None, None)
        self.source_files = {
            "fixture/source.txt": b"Own source fixture; not runtime code.\n",
            "fixture/recipe.txt": b"Own recipe fixture; never compiled.\n",
        }
        self.manifest_value = {
            "schema": "own.fixture.manifest.v1",
            "files": [
                {"path": path, "sha256": _sha(raw)}
                for path, raw in sorted(self.source_files.items())
            ],
        }
        self.manifest_bytes = _json_bytes(self.manifest_value)
        self.scope = {
            "schema": "elogistix.systemd-pilot.approved-scope.v2",
            "repository": REPOSITORY,
            "source_commit": SOURCE_COMMIT,
            "yaml_sha256": _sha(YAML_BYTES),
            "branch": BRANCH,
            "limits": _limits(),
            "manifest": {
                "path": "fixture/manifest.json",
                "sha256": _sha(self.manifest_bytes),
            },
            "authorization_ref": "own-fixture-reference-without-real-authority",
            "scope_ref": AUTHORIZATION_SCOPE_REF,
        }
        self.context = {
            "repository": REPOSITORY,
            "event_name": "create",
            "ref_type": "branch",
            "event_ref": BRANCH,
            "ref": "refs/heads/" + BRANCH,
            "run_attempt": "1",
            "workflow_commit": WORKFLOW_COMMIT,
            "source_commit": SOURCE_COMMIT,
        }

    def parsed(self, scope=None, *, pretty=False):
        value = self.scope if scope is None else scope
        return PILOT.extract_approved_scope(_document(_json_bytes(value, pretty=pretty)))

    def validate(self, scope=None, **overrides):
        return self.validate_parsed(self.parsed(scope), **overrides)

    def validate_parsed(self, parsed, **overrides):
        args = {
            "context": self.context,
            "expected_branch": BRANCH,
            "expected_source_commit": SOURCE_COMMIT,
            "yaml_bytes": YAML_BYTES,
            "manifest_bytes": self.manifest_bytes,
            "manifest_path": "fixture/manifest.json",
            "source_files": self.source_files,
            "manifest_keys": MANIFEST_KEYS,
            "entry_keys": ENTRY_KEYS,
        }
        args.update(overrides)
        return PILOT.validate_scope(parsed, **args)

    def check_manifest(self, value=None, *, source_files=None, **overrides):
        raw = _json_bytes(self.manifest_value if value is None else value)
        args = {
            "expected_sha256": _sha(raw),
            "source_files": self.source_files if source_files is None else source_files,
            "manifest_keys": MANIFEST_KEYS,
            "entry_keys": ENTRY_KEYS,
        }
        args.update(overrides)
        return PILOT.validate_manifest(raw, **args)

    def feed_bytes(self, stream, raw):
        for offset in range(0, len(raw), 8192):
            stream.feed(raw[offset:offset + 8192])


class StrictJsonTests(OwnFixtureCase):
    def test_valid_integer_boolean_unicode_data(self):
        raw = '{"count":1,"flag":true,"text":"á🙂","nested":[null]}'.encode("utf-8")
        self.assertEqual(
            PILOT.parse_strict_json(raw),
            {"count": 1, "flag": True, "text": "á🙂", "nested": [None]},
        )

    def test_duplicate_decoded_keys_at_any_level(self):
        for raw in (
            b'{"a":1,"a":2}',
            b'{"a":1,"\\u0061":2}',
            b'{"nested":{"a":1,"a":2}}',
        ):
            with self.subTest(raw=raw), self.assertRaises(PILOT.PilotValidationError):
                PILOT.parse_strict_json(raw)

    def test_floats_and_nonfinite_numbers_rejected(self):
        for token in (b"1.0", b"1e2", b"-0.0", b"NaN", b"Infinity", b"-Infinity"):
            with self.subTest(token=token), self.assertRaises(PILOT.PilotValidationError):
                PILOT.parse_strict_json(b'{"number":' + token + b"}")

    def test_utf8_bom_surrogates_and_trailing_json_rejected(self):
        for raw in (
            b'{"text":"\xff"}',
            b'{"text":"\xed\xa0\x80"}',
            b'{"text":"\\ud800"}',
            b'{"\\udfff":1}',
            b"\xef\xbb\xbf{}",
            b"{} {}",
        ):
            with self.subTest(raw=raw), self.assertRaises(PILOT.PilotValidationError):
                PILOT.parse_strict_json(raw)

    def test_json_byte_boundary_exactly_65536(self):
        raw = b'{"value":1}'
        raw += b" " * (65_536 - len(raw))
        self.assertEqual(PILOT.parse_strict_json(raw), {"value": 1})
        with self.assertRaises(PILOT.PilotValidationError):
            PILOT.parse_strict_json(raw + b" ")

    def test_depth_six_accepted_seven_rejected(self):
        self.assertEqual(PILOT.parse_strict_json(b"[" * 6 + b"0" + b"]" * 6),
                         [[[[[[0]]]]]])
        with self.assertRaises(PILOT.PilotValidationError):
            PILOT.parse_strict_json(b"[" * 7 + b"0" + b"]" * 7)

    def test_bounds_reject_boolean_and_invalid_configuration(self):
        for kwargs in (
            {"max_bytes": True}, {"max_bytes": 0}, {"max_bytes": 65_537},
            {"max_depth": True}, {"max_depth": 0}, {"max_depth": 7},
        ):
            with self.subTest(kwargs=kwargs), self.assertRaises(PILOT.PilotValidationError):
                PILOT.parse_strict_json(b"{}", **kwargs)
        for raw in ("{}", bytearray(b"{}"), memoryview(b"{}")):
            with self.subTest(raw=type(raw)), self.assertRaises(PILOT.PilotValidationError):
                PILOT.parse_strict_json(raw)

    def test_integer_counter_boundary(self):
        maximum = (1 << 64) - 1
        self.assertEqual(PILOT.parse_strict_json(str(maximum).encode()), maximum)
        self.assertEqual(PILOT.parse_strict_json(str(-maximum).encode()), -maximum)
        for value in (maximum + 1, -(maximum + 1), 10 ** 100):
            with self.subTest(value=value), self.assertRaises(PILOT.PilotValidationError):
                PILOT.parse_strict_json(str(value).encode())


class ScopeExtractionTests(OwnFixtureCase):
    def test_retains_exact_json_bytes_including_lf(self):
        raw = _json_bytes(self.scope, pretty=True)
        parsed = PILOT.extract_approved_scope(_document(raw))
        self.assertEqual(parsed.json_bytes, raw)
        self.assertTrue(parsed.json_bytes.endswith(b"\n"))
        self.assertEqual(parsed.approved_scope_sha256, _sha(raw))
        self.assertRegex(parsed.approved_scope_sha256, r"^[0-9a-f]{64}$")
        self.assertEqual(parsed.values["scope_ref"], AUTHORIZATION_SCOPE_REF)
        self.assertNotIn("approved_scope_sha256", parsed.values)

    def test_equivalent_json_serializations_have_distinct_scope_hashes(self):
        compact = self.parsed()
        pretty = self.parsed(pretty=True)
        self.assertEqual(compact.values, pretty.values)
        self.assertEqual(compact.values["scope_ref"], pretty.values["scope_ref"])
        self.assertNotEqual(compact.approved_scope_sha256, pretty.approved_scope_sha256)
        self.assertNotEqual(compact.json_bytes, pretty.json_bytes)

    def test_scope_mapping_is_deeply_immutable(self):
        parsed = self.parsed()
        self.assertIsInstance(parsed.values, Mapping)
        with self.assertRaises(TypeError):
            parsed.values["branch"] = "another"
        with self.assertRaises(TypeError):
            parsed.values["limits"]["vm_count"] = 2
        with self.assertRaises(TypeError):
            parsed.values["manifest"]["path"] = "another"
        with self.assertRaises((AttributeError, TypeError)):
            parsed.approved_scope_sha256 = "changed"

    def test_document_boundary_exactly_65536(self):
        document = _document(_json_bytes(self.scope))
        document = b"x" * (65_536 - len(document)) + document
        self.assertEqual(len(document), 65_536)
        self.assertEqual(PILOT.extract_approved_scope(document).values["branch"], BRANCH)
        with self.assertRaises(PILOT.PilotValidationError):
            PILOT.extract_approved_scope(document + b"x")

    def test_scope_fence_must_be_unique_and_present(self):
        document = _document(_json_bytes(self.scope))
        for raw in (b"# No scope\n", document + b"\n" + document):
            with self.subTest(raw=raw[:30]), self.assertRaises(PILOT.PilotValidationError):
                PILOT.extract_approved_scope(raw)

    def test_fence_exactness_cr_bom_and_invalid_utf8(self):
        document = _document(_json_bytes(self.scope))
        opening = FENCE + b"json approved-scope\n"
        for replacement in (
            b" " + opening, FENCE + b"json approved-scope \n",
            FENCE + b"JSON approved-scope\n",
            FENCE + b"json  approved-scope\n",
            FENCE + bytes((96,)) + b"json approved-scope\n",
            b"~~~json approved-scope\n",
        ):
            with self.subTest(opening=replacement), self.assertRaises(PILOT.PilotValidationError):
                PILOT.extract_approved_scope(document.replace(opening, replacement, 1))
        for raw in (
            document[:-4] + FENCE + bytes((96,)) + b"\n",
            document[:-4] + FENCE + b" \n",
            document[:-4],
            document.replace(b"\n", b"\r\n"),
            b"\xef\xbb\xbf" + document,
            b"\xff\n" + document,
        ):
            with self.subTest(tail=raw[-15:]), self.assertRaises(PILOT.PilotValidationError):
                PILOT.extract_approved_scope(raw)

    def test_closed_top_level_scope_schema(self):
        for mutation in ("extra", "missing", "W", "workflow_commit"):
            value = copy.deepcopy(self.scope)
            if mutation == "missing":
                del value["authorization_ref"]
            else:
                value[mutation] = WORKFLOW_COMMIT
            with self.subTest(mutation=mutation), self.assertRaises(PILOT.PilotValidationError):
                self.parsed(value)

    def test_approved_scope_inside_indented_commonmark_fence_is_rejected(self):
        inner = FENCE + b"json approved-scope\n" + _json_bytes(self.scope) + FENCE + b"\n"
        for indentation in (b" ", b"  ", b"   "):
            document = indentation + FENCE + b"text\n" + inner + FENCE + b"\n"
            with self.subTest(indentation=indentation), self.assertRaises(PILOT.PilotValidationError):
                PILOT.extract_approved_scope(document)

    def test_duplicate_scope_key_is_not_silently_replaced(self):
        raw = _json_bytes(self.scope)
        duplicate = b'{"repository":"another",' + raw[1:]
        with self.assertRaises(PILOT.PilotValidationError):
            PILOT.extract_approved_scope(_document(duplicate))

    def test_v1_and_eight_key_scope_are_rejected(self):
        legacy = copy.deepcopy(self.scope)
        legacy["schema"] = "elogistix.systemd-pilot.approved-scope.v1"
        with self.assertRaises(PILOT.PilotValidationError):
            self.validate(legacy)
        for schema in (legacy["schema"], self.scope["schema"]):
            eight_keys = copy.deepcopy(self.scope)
            eight_keys["schema"] = schema
            del eight_keys["scope_ref"]
            self.assertEqual(len(eight_keys), 8)
            with self.subTest(schema=schema), self.assertRaises(PILOT.PilotValidationError):
                self.parsed(eight_keys)

    def test_scope_hash_field_inside_json_is_rejected(self):
        value = copy.deepcopy(self.scope)
        value["approved_scope_sha256"] = _sha(_json_bytes(value))
        with self.assertRaises(PILOT.PilotValidationError):
            self.parsed(value)

    def test_escaped_sentinel_preserves_literal_but_changes_exact_hash(self):
        plain_raw = _json_bytes(self.scope)
        escaped_raw = plain_raw.replace(
            AUTHORIZATION_SCOPE_REF.encode("ascii"),
            b"\\u0053entinel_5d6cf0688f788191ad0503a9a351e1a7", 1,
        )
        self.assertNotEqual(escaped_raw, plain_raw)
        plain = PILOT.extract_approved_scope(_document(plain_raw))
        escaped = PILOT.extract_approved_scope(_document(escaped_raw))
        self.assertEqual(plain.values, escaped.values)
        self.assertEqual(escaped.values["scope_ref"], AUTHORIZATION_SCOPE_REF)
        self.assertEqual(plain.approved_scope_sha256, _sha(plain_raw))
        self.assertEqual(escaped.approved_scope_sha256, _sha(escaped_raw))
        self.assertNotEqual(plain.approved_scope_sha256, escaped.approved_scope_sha256)
        result = self.validate_parsed(escaped)
        self.assertEqual(result["scope_ref"], AUTHORIZATION_SCOPE_REF)
        self.assertEqual(result["approved_scope_sha256"], _sha(escaped_raw))
        self.assertFalse(result["authorization_authenticated"])
        self.assertFalse(result["runtime_ready"])


class ManifestTests(OwnFixtureCase):
    def test_valid_manifest_is_consistency_only(self):
        result = self.check_manifest()
        self.assertEqual(result["files_verified"], 2)
        self.assertFalse(result["schema_semantics_verified"])
        self.assertFalse(result["custody_authenticated"])

    def test_schema_string_is_not_a_hardcoded_central_schema(self):
        value = copy.deepcopy(self.manifest_value)
        value["schema"] = "different.owner.fixture.schema"
        self.assertEqual(self.check_manifest(value)["files_verified"], 2)

    def test_caller_supplied_closed_key_profiles(self):
        value = copy.deepcopy(self.manifest_value)
        value["owner_note"] = "Own data, not executable commands"
        for item in value["files"]:
            item["bytes"] = len(self.source_files[item["path"]])
        result = self.check_manifest(
            value, manifest_keys=MANIFEST_KEYS | {"owner_note"},
            entry_keys=ENTRY_KEYS | {"bytes"},
        )
        self.assertEqual(result["files_verified"], 2)
        self.assertFalse(result["schema_semantics_verified"])

    def test_wrong_manifest_or_source_hash(self):
        with self.assertRaises(PILOT.PilotValidationError):
            self.check_manifest(expected_sha256="f" * 64)
        wrong_source = dict(self.source_files)
        wrong_source["fixture/source.txt"] += b"unreviewed mutation"
        with self.assertRaises(PILOT.PilotValidationError):
            self.check_manifest(source_files=wrong_source)
        value = copy.deepcopy(self.manifest_value)
        value["files"][0]["sha256"] = "f" * 64
        with self.assertRaises(PILOT.PilotValidationError):
            self.check_manifest(value)

    def test_manifest_and_entry_extras_missing_keys(self):
        variants = []
        value = copy.deepcopy(self.manifest_value)
        value["extra"] = True
        variants.append(value)
        value = copy.deepcopy(self.manifest_value)
        del value["schema"]
        variants.append(value)
        value = copy.deepcopy(self.manifest_value)
        value["files"][0]["extra"] = True
        variants.append(value)
        value = copy.deepcopy(self.manifest_value)
        del value["files"][0]["sha256"]
        variants.append(value)
        for value in variants:
            with self.subTest(value=value), self.assertRaises(PILOT.PilotValidationError):
                self.check_manifest(value)

    def test_unsafe_paths_and_normalization_aliases(self):
        for path in (
            "/absolute", "../escape", "fixture/../source.txt",
            "fixture//source.txt", "fixture/./source.txt", "./fixture/source.txt",
            "fixture\\source.txt", "C:/escape", "fixture/source.txt/",
            "fixture/\x00source.txt",
        ):
            value = copy.deepcopy(self.manifest_value)
            old_path = value["files"][0]["path"]
            value["files"][0]["path"] = path
            sources = dict(self.source_files)
            sources[path] = sources.pop(old_path)
            with self.subTest(path=path), self.assertRaises(PILOT.PilotValidationError):
                self.check_manifest(value, source_files=sources)

    def test_duplicate_and_aliased_manifest_paths(self):
        value = copy.deepcopy(self.manifest_value)
        value["files"].append(copy.deepcopy(value["files"][0]))
        with self.assertRaises(PILOT.PilotValidationError):
            self.check_manifest(value)
        value = copy.deepcopy(self.manifest_value)
        duplicate = copy.deepcopy(value["files"][0])
        duplicate["path"] = "fixture/./recipe.txt"
        value["files"].append(duplicate)
        sources = {
            **self.source_files,
            duplicate["path"]: self.source_files["fixture/recipe.txt"],
        }
        with self.assertRaises(PILOT.PilotValidationError):
            self.check_manifest(value, source_files=sources)

    def test_source_file_set_must_be_exact_and_bytes(self):
        for sources in (
            {k: v for k, v in self.source_files.items() if k != "fixture/source.txt"},
            {**self.source_files, "fixture/extra.txt": b"extra"},
            {**self.source_files, "fixture/source.txt": "not bytes"},
            {**self.source_files, "fixture/source.txt": bytearray(b"not bytes")},
        ):
            with self.subTest(keys=list(sources)), self.assertRaises(PILOT.PilotValidationError):
                self.check_manifest(source_files=sources)

    def test_profile_types_and_required_structural_keys(self):
        for overrides in (
            {"manifest_keys": set(MANIFEST_KEYS)},
            {"entry_keys": set(ENTRY_KEYS)},
            {"manifest_keys": frozenset({"schema"})},
            {"entry_keys": frozenset({"path"})},
        ):
            with self.subTest(overrides=overrides), self.assertRaises(PILOT.PilotValidationError):
                self.check_manifest(**overrides)

    def test_manifest_bound_and_duplicate_decoded_keys(self):
        for files in ([], [None], [True], "not a list"):
            value = copy.deepcopy(self.manifest_value)
            value["files"] = files
            with self.subTest(files=files), self.assertRaises(PILOT.PilotValidationError):
                self.check_manifest(value)
        value = copy.deepcopy(self.manifest_value)
        value["files"] = [copy.deepcopy(value["files"][0]) for _ in range(129)]
        with self.assertRaises(PILOT.PilotValidationError):
            self.check_manifest(value)
        raw = b'{"schema":"x","schema":"y","files":[]}'
        with self.assertRaises(PILOT.PilotValidationError):
            PILOT.validate_manifest(
                raw, _sha(raw), {}, manifest_keys=MANIFEST_KEYS, entry_keys=ENTRY_KEYS
            )


class ScopeValidationTests(OwnFixtureCase):
    def test_consistent_data_never_authenticates_or_measures(self):
        result = self.validate()
        self.assertEqual(result["status"], "CONSISTENT_DATA_ONLY")
        self.assertFalse(result["authorization_authenticated"])
        self.assertFalse(result["runtime_ready"])
        self.assertFalse(result["consumption_measured"])
        self.assertFalse(result["keeper_profile_verified"])
        self.assertEqual(result["scope_ref"], AUTHORIZATION_SCOPE_REF)
        self.assertEqual(result["approved_scope_sha256"], self.parsed().approved_scope_sha256)
        self.assertNotEqual(result["scope_ref"], result["approved_scope_sha256"])
        self.assertEqual(result["allocated_memory_bytes"], 268_435_456)
        self.assertEqual(result["allocated_tasks"], 32)
        self.assertEqual(result["declared_keeper_load_bytes"], 8_388_608)
        self.assertEqual(result["declared_overlap_touched_bytes"], 16_777_216)

    def test_rejects_closed_profile_alternatives_even_when_lower(self):
        for key, value in (
            ("memory_max_bytes_per_service", 16_777_216),
            ("memory_max_bytes_per_service", 83_886_080),
            ("tasks_max_per_service", 7),
            ("auxiliary_memory_budget_bytes", 16_777_216),
            ("auxiliary_tasks_budget", 7),
        ):
            scope = copy.deepcopy(self.scope)
            scope["limits"][key] = value
            with self.subTest(key=key, value=value), self.assertRaises(PILOT.PilotValidationError):
                self.validate(scope)

    def test_boolean_float_zero_and_wrong_limit_constants(self):
        for key in self.scope["limits"]:
            if key == "runner":
                alternatives = ("ubuntu-latest", "ubuntu-22.04", None)
            else:
                alternatives = (True, 0, -1, self.scope["limits"][key] + 1)
            for value in alternatives:
                scope = copy.deepcopy(self.scope)
                scope["limits"][key] = value
                with self.subTest(key=key, value=value), self.assertRaises(PILOT.PilotValidationError):
                    self.validate(scope)
        scope = copy.deepcopy(self.scope)
        scope["limits"]["vm_count"] = 1.0
        with self.assertRaises(PILOT.PilotValidationError):
            self.validate(scope)

    def test_limits_and_manifest_scope_fields_are_closed(self):
        for field in ("limits", "manifest"):
            for mutation in ("extra", "missing"):
                scope = copy.deepcopy(self.scope)
                if mutation == "extra":
                    scope[field]["extra"] = 1
                else:
                    del scope[field][next(iter(scope[field]))]
                with self.subTest(field=field, mutation=mutation), self.assertRaises(PILOT.PilotValidationError):
                    self.validate(scope)

    def test_exact_context_repository_create_branch_attempt_one(self):
        for key, value in (
            ("repository", "fork-owner/elogistix"),
            ("event_name", "push"), ("ref_type", "tag"),
            ("event_ref", "another-branch"), ("ref", "refs/tags/" + BRANCH),
            ("run_attempt", "2"), ("run_attempt", 1),
            ("workflow_commit", SOURCE_COMMIT),
            ("workflow_commit", "B" * 40),
            ("workflow_commit", "0" * 40),
            ("workflow_commit", "b" * 39),
            ("source_commit", "c" * 40),
        ):
            context = dict(self.context)
            context[key] = value
            with self.subTest(key=key, value=value), self.assertRaises(PILOT.PilotValidationError):
                self.validate(context=context)

    def test_context_keys_and_expected_identities(self):
        for context in (
            {**self.context, "extra": "not allowed"},
            {k: v for k, v in self.context.items() if k != "workflow_commit"},
        ):
            with self.subTest(context=context), self.assertRaises(PILOT.PilotValidationError):
                self.validate(context=context)
        with self.assertRaises(PILOT.PilotValidationError):
            self.validate(expected_branch="another")
        with self.assertRaises(PILOT.PilotValidationError):
            self.validate(expected_source_commit="c" * 40)

    def test_wrong_yaml_manifest_and_source_bytes(self):
        for overrides in (
            {"yaml_bytes": YAML_BYTES + b"changed"},
            {"yaml_bytes": "not bytes"},
            {"manifest_bytes": self.manifest_bytes + b" "},
            {"manifest_path": "fixture/not-the-observed-manifest.json"},
            {"source_files": {**self.source_files, "fixture/extra": b"extra"}},
        ):
            with self.subTest(overrides=list(overrides)), self.assertRaises(PILOT.PilotValidationError):
                self.validate(**overrides)

    def test_invalid_scope_identity_hash_or_authorization_reference(self):
        for key, value in (
            ("schema", "another.schema"), ("repository", "fork/elogistix"),
            ("source_commit", "a" * 39), ("source_commit", "A" * 40),
            ("yaml_sha256", "f" * 64), ("yaml_sha256", "0" * 64),
            ("authorization_ref", ""), ("authorization_ref", True),
            ("authorization_ref", "PENDING_COORDINATOR_AUTHORIZATION_REF"),
            ("authorization_ref", "embedded\ncontrol"),
        ):
            scope = copy.deepcopy(self.scope)
            scope[key] = value
            with self.subTest(key=key, value=value), self.assertRaises(PILOT.PilotValidationError):
                self.validate(scope)

    def test_manifest_path_and_sha_in_scope(self):
        for key, value in (
            ("path", "../manifest.json"),
            ("path", "PENDING_REVIEWED_MANIFEST_PATH"),
            ("sha256", "f" * 64),
            ("sha256", "F" * 64),
        ):
            scope = copy.deepcopy(self.scope)
            scope["manifest"][key] = value
            with self.subTest(key=key, value=value), self.assertRaises(PILOT.PilotValidationError):
                self.validate(scope)

    def test_invalid_literal_branch_even_if_all_context_values_agree(self):
        for branch in (
            "PENDING_COORDINATOR_BRANCH", "pilot/*", "pilot/../escape",
            "pilot//empty", "pilot/space here", "pilot/ref.lock",
            "/absolute", "pilot/trailing/", "pilot/@{bad", "@",
        ):
            scope = copy.deepcopy(self.scope)
            scope["branch"] = branch
            context = dict(self.context, event_ref=branch, ref="refs/heads/" + branch)
            with self.subTest(branch=branch), self.assertRaises(PILOT.PilotValidationError):
                self.validate(scope, context=context, expected_branch=branch)

    def test_optional_constants_are_consistency_data_only(self):
        constants = {
            "WORK_US": 50_000_000, "CLEANUP_US": 60_000_000,
            "MEMORY_MAX_BYTES": 33_554_432, "TASKS_MAX": 8,
        }
        result = self.validate(shared_constants=constants)
        self.assertTrue(result["shared_constants_consistent"])
        self.assertFalse(result["authorization_authenticated"])
        self.assertFalse(result["runtime_ready"])
        for key in constants:
            changed = dict(constants)
            changed[key] += 1
            with self.subTest(key=key), self.assertRaises(PILOT.PilotValidationError):
                self.validate(shared_constants=changed)
        for invalid in (
            {**constants, "extra": 1},
            {k: v for k, v in constants.items() if k != "WORK_US"},
            {**constants, "TASKS_MAX": True},
        ):
            with self.subTest(constants=invalid), self.assertRaises(PILOT.PilotValidationError):
                self.validate(shared_constants=invalid)

    def test_forged_scope_hash_or_values_do_not_replace_exact_json(self):
        parsed = self.parsed()
        forged_hash = PILOT.ParsedScope(parsed.values, parsed.json_bytes, "forged")
        changed_values = dict(parsed.values, branch="changed")
        forged_values = PILOT.ParsedScope(
            changed_values, parsed.json_bytes, parsed.approved_scope_sha256
        )
        for forged in (forged_hash, forged_values):
            with self.subTest(forged=forged.approved_scope_sha256), self.assertRaises(PILOT.PilotValidationError):
                self.validate_parsed(forged)

    def test_changed_authorization_literal_rejected_with_correct_scope_hash(self):
        for literal in (
            AUTHORIZATION_SCOPE_REF.lower(), "another-literal",
            "approved-scope-sha256:" + self.parsed().approved_scope_sha256,
        ):
            value = copy.deepcopy(self.scope)
            value["scope_ref"] = literal
            parsed = self.parsed(value)
            self.assertEqual(parsed.approved_scope_sha256, _sha(parsed.json_bytes))
            with self.subTest(literal=literal), self.assertRaises(PILOT.PilotValidationError) as raised:
                self.validate_parsed(parsed)
            self.assertEqual(raised.exception.code, "AUTHORIZATION_SCOPE_REF")

    def test_tampered_scope_hash_is_not_replaced_by_literal(self):
        parsed = self.parsed()
        self.assertEqual(parsed.values["scope_ref"], AUTHORIZATION_SCOPE_REF)
        changed = ("f" if parsed.approved_scope_sha256[0] != "f" else "e") + parsed.approved_scope_sha256[1:]
        for digest in (
            changed, "F" * 64, parsed.approved_scope_sha256[:-1],
            "", None, "not-a-hash", "approved-scope-sha256:" + parsed.approved_scope_sha256,
        ):
            forged = PILOT.ParsedScope(parsed.values, parsed.json_bytes, digest)
            with self.subTest(digest=digest), self.assertRaises(PILOT.PilotValidationError):
                self.validate_parsed(forged)

    def test_exact_literal_and_hash_do_not_authorize_wrong_context(self):
        parsed = self.parsed()
        result = self.validate_parsed(parsed)
        self.assertEqual(result["scope_ref"], AUTHORIZATION_SCOPE_REF)
        self.assertEqual(result["approved_scope_sha256"], _sha(parsed.json_bytes))
        self.assertFalse(result["authorization_authenticated"])
        self.assertFalse(result["runtime_ready"])
        for key, value in (("repository", "fork-owner/elogistix"), ("run_attempt", "2")):
            context = dict(self.context)
            context[key] = value
            with self.subTest(key=key), self.assertRaises(PILOT.PilotValidationError) as raised:
                self.validate_parsed(parsed, context=context)
            self.assertEqual(raised.exception.code, "EVENT_CONTEXT")


class CaptureTests(OwnFixtureCase):
    def test_complete_boundary_65535_and_65536_raw_bytes(self):
        for length in (65_535, 65_536):
            raw = (b"\x00\xff\n\x80" * ((length + 3) // 4))[:length]
            stream = PILOT.CaptureAccumulator()
            self.feed_bytes(stream, raw)
            self.assertIsNone(stream.receipt()["sha256_full"])
            self.assertEqual(stream.receipt()["status"], "INCOMPLETE")
            stream.eof()
            receipt = stream.receipt()
            self.assertEqual(set(receipt), RECEIPT_KEYS)
            self.assertEqual(stream.retained, raw)
            self.assertEqual(receipt["status"], "COMPLETE")
            self.assertEqual(receipt["retained_bytes"], length)
            self.assertEqual(receipt["observed_bytes"], length)
            self.assertEqual(receipt["discarded_observed_bytes"], 0)
            self.assertFalse(receipt["overflow"])
            self.assertEqual(receipt["sha256_retained"], _sha(raw))
            self.assertEqual(receipt["sha256_full"], _sha(raw))

    def test_65537_overflow_retains_prefix_and_hashes_all_observed_bytes(self):
        raw = b"x" * 65_536 + b"y"
        stream = PILOT.CaptureAccumulator()
        self.feed_bytes(stream, raw)
        before = stream.receipt()
        self.assertEqual(before["status"], "INCOMPLETE")
        self.assertTrue(before["overflow"])
        self.assertIsNone(before["sha256_full"])
        stream.eof()
        receipt = stream.receipt()
        self.assertEqual(stream.retained, raw[:65_536])
        self.assertEqual(receipt["status"], "OVERFLOW")
        self.assertEqual(receipt["observed_bytes"], 65_537)
        self.assertEqual(receipt["discarded_observed_bytes"], 1)
        self.assertEqual(receipt["sha256_full"], _sha(raw))
        self.assertEqual(receipt["sha256_retained"], _sha(raw[:65_536]))

    def test_empty_stream_requires_eof(self):
        stream = PILOT.CaptureAccumulator()
        stream.feed(b"")
        self.assertEqual(stream.receipt()["status"], "INCOMPLETE")
        stream.eof()
        self.assertEqual(stream.receipt()["status"], "COMPLETE")
        self.assertEqual(stream.receipt()["sha256_full"], _sha(b""))

    def test_error_after_full_prefix_remains_incomplete_even_after_eof(self):
        stream = PILOT.CaptureAccumulator()
        self.feed_bytes(stream, b"x" * 65_536)
        stream.mark_error("READ_ERROR")
        stream.mark_error("OTHER_ERROR")
        stream.eof()
        receipt = stream.receipt()
        self.assertEqual(stream.retained, b"x" * 65_536)
        self.assertEqual(receipt["status"], "INCOMPLETE")
        self.assertEqual(receipt["reason"], "READ_ERROR")
        self.assertIsNone(receipt["sha256_full"])

    def test_oversized_chunk_and_nonbytes_fail_without_losing_prefix(self):
        for chunk in (b"x" * 8193, "text", bytearray(b"bytes"), memoryview(b"bytes")):
            stream = PILOT.CaptureAccumulator()
            stream.feed(b"prefix")
            with self.subTest(chunk_type=type(chunk)), self.assertRaises(PILOT.PilotValidationError):
                stream.feed(chunk)
            self.assertEqual(stream.retained, b"prefix")
            stream.eof()
            self.assertEqual(stream.receipt()["status"], "INCOMPLETE")
            self.assertIsNone(stream.receipt()["sha256_full"])

    def test_feed_after_eof_is_failure_not_a_second_stream(self):
        stream = PILOT.CaptureAccumulator()
        stream.feed(b"prefix")
        stream.eof()
        with self.assertRaises(PILOT.PilotValidationError):
            stream.feed(b"suffix")
        self.assertEqual(stream.retained, b"prefix")
        self.assertEqual(stream.receipt()["status"], "INCOMPLETE")
        self.assertIsNone(stream.receipt()["sha256_full"])

    def test_capture_counter_overflow_uses_real_small_chunks(self):
        stream = PILOT.CaptureAccumulator()
        with patch.object(PILOT, "MAX_CAPTURE_COUNTER", 3):
            stream.feed(b"abc")
            with self.assertRaises(PILOT.PilotValidationError):
                stream.feed(b"d")
        stream.eof()
        receipt = stream.receipt()
        self.assertEqual(stream.retained, b"abc")
        self.assertEqual(receipt["observed_bytes"], 3)
        self.assertEqual(receipt["status"], "INCOMPLETE")
        self.assertIsNone(receipt["sha256_full"])

    def test_reason_code_is_bounded_ascii_not_arbitrary_output(self):
        for reason in ("", "read_error", "READ ERROR", "READ\nERROR", "ÉRROR",
                       "A" * 65, None, True):
            stream = PILOT.CaptureAccumulator()
            with self.subTest(reason=reason), self.assertRaises(PILOT.PilotValidationError):
                stream.mark_error(reason)
        stream = PILOT.CaptureAccumulator()
        stream.mark_error("A" * 64)
        self.assertEqual(stream.receipt()["reason"], "A" * 64)

    def test_constructor_bounds_do_not_accept_bool_or_raise_limits(self):
        for kwargs in (
            {"limit_bytes": True}, {"limit_bytes": 0}, {"limit_bytes": 65_537},
            {"chunk_bytes": True}, {"chunk_bytes": 0}, {"chunk_bytes": 8193},
        ):
            with self.subTest(kwargs=kwargs), self.assertRaises(PILOT.PilotValidationError):
                PILOT.CaptureAccumulator(**kwargs)

    def test_capture_outcome_is_not_pilot_acceptance(self):
        stdout, stderr = PILOT.CaptureAccumulator(), PILOT.CaptureAccumulator()
        stdout.feed(b"own output")
        stderr.feed(b"")
        self.assertNotEqual(PILOT.capture_outcome(stdout, stderr, 0), "CAPTURE_COMPLETE")
        stdout.eof()
        stderr.eof()
        self.assertEqual(PILOT.capture_outcome(stdout, stderr, 0), "CAPTURE_COMPLETE")
        self.assertEqual(PILOT.capture_outcome(stdout, stderr, 3), "RUNTIME_FAILED")
        self.assertNotEqual(PILOT.capture_outcome(stdout, stderr, None), "CAPTURE_COMPLETE")
        stdout.mark_error("READ_ERROR")
        self.assertNotEqual(PILOT.capture_outcome(stdout, stderr, 0), "CAPTURE_COMPLETE")
        with self.assertRaises(PILOT.PilotValidationError):
            PILOT.capture_outcome(stdout, stderr, True)

    def test_overflow_cannot_become_capture_complete_with_exit_zero(self):
        stdout, stderr = PILOT.CaptureAccumulator(), PILOT.CaptureAccumulator()
        self.feed_bytes(stdout, b"x" * 65_537)
        stdout.eof()
        stderr.eof()
        self.assertNotEqual(PILOT.capture_outcome(stdout, stderr, 0), "CAPTURE_COMPLETE")


class ClosedEntryPointTests(OwnFixtureCase):
    def test_all_argv_routes_print_blocked_and_return_three(self):
        for argv in (None, [], ["--help"], ["run"], ["--spec", "/not-opened"],
                     ["--anything", "never-executed"]):
            output = io.StringIO()
            with self.subTest(argv=argv), redirect_stdout(output):
                code = PILOT.main(argv)
            value = json.loads(output.getvalue())
            self.assertEqual(code, 3)
            self.assertTrue(value["status"].startswith("BLOCKED"))
            self.assertIs(value["pilot_executed"], False)

    def test_only_own_module_was_loaded_no_runtime_imports(self):
        self.assertEqual(Path(PILOT.__file__).resolve(), _MODULE_PATH.resolve())
        self.assertIs(sys.modules[_MODULE_NAME], PILOT)
        self.assertFalse(any(
            name == "systemd_memory_runtime" or name.startswith("systemd_memory_runtime.")
            for name in sys.modules
        ))


if __name__ == "__main__":
    unittest.main()
