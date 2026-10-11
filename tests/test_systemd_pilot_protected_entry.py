"""Hermetic review tests for the protected-entry proposal only.

All identities, bytes, POSIX metadata and ACL observations below are invented
fixtures, never evidence of a protected installation or authorization to run a
pilot. The central runtime and wrapper are neither imported nor executed.
"""
from __future__ import annotations

import ast
from contextlib import ExitStack, contextmanager, redirect_stdout
from dataclasses import replace
import hashlib
import importlib.util
import importlib
import importlib.machinery
import io
import json
import os
from pathlib import Path, PurePosixPath
import stat
import sys
from types import MappingProxyType, ModuleType, SimpleNamespace
import unittest
from unittest.mock import Mock, patch


ENTRY_PATH = Path(__file__).resolve().parents[1] / "scripts" / "ci" / "systemd-pilot-protected-entry.py"
MODULE_NAME = "hermetic_protected_entry_under_test"
MODULE_SPEC = importlib.util.spec_from_file_location(MODULE_NAME, ENTRY_PATH)
entry = importlib.util.module_from_spec(MODULE_SPEC)
sys.modules[MODULE_NAME] = entry
MODULE_SPEC.loader.exec_module(entry)

ROOT = "/srv/protected-pilot"
PACKAGE = "reviewed-package"
CONTROL_UID = 0
FIXTURE_BLOBS = {
    "bin/load-fixture": b"\x7fELF\x02\x01fixture-data-never-executed",
    "entry.py": b"# invented launcher fixture, never imported\n",
    "reviewed-package/systemd_memory_runtime/__init__.py": b"# invented package fixture\n",
    "reviewed-package/systemd_memory_runtime/__main__.py": b"# invented main fixture, never imported\n",
    "scope.json": b'{"synthetic_fixture":true}\n',
    "spec.json": b'{"fixture_run":"unprivileged-test-only"}\n',
}
FIXTURE_ROLES = {
    "bin/load-fixture": "elf",
    "entry.py": "python",
    "reviewed-package/systemd_memory_runtime/__init__.py": "python",
    "reviewed-package/systemd_memory_runtime/__main__.py": "python",
    "scope.json": "scope",
    "spec.json": "spec",
}


def digest(raw):
    return hashlib.sha256(raw).hexdigest()


def inventory_dict(blobs=None, roles=None):
    blobs = FIXTURE_BLOBS if blobs is None else blobs
    roles = FIXTURE_ROLES if roles is None else roles
    return {
        "schema": entry.INVENTORY_SCHEMA,
        "files": [{"path": path, "sha256": digest(blob), "size": len(blob), "role": roles[path]}
                  for path, blob in sorted(blobs.items())],
    }


def encode_inventory(value):
    return json.dumps(value, sort_keys=True, separators=(",", ":")).encode("utf-8")


def parse_value(value):
    raw = encode_inventory(value)
    return entry.parse_inventory(raw, expected_sha256=digest(raw))


def valid_inventory():
    return parse_value(inventory_dict())


def fixture_observations(inventory=None):
    inventory = valid_inventory() if inventory is None else inventory
    # Explicit path closure for the invented fixture, including all ancestors.
    directories = ("/", "/srv", ROOT, ROOT + "/bin", ROOT + "/reviewed-package",
                   ROOT + "/reviewed-package/systemd_memory_runtime")
    observations = [entry.NodeObservation(path, "directory", CONTROL_UID, 0o555, 2, True)
                    for path in directories]
    observations.append(entry.NodeObservation(ROOT + "/inventory.json", "file", CONTROL_UID,
                                              0o444, 1, True, content=inventory.raw))
    observations.extend(entry.NodeObservation(ROOT + "/" + path, "file", CONTROL_UID,
                                             0o444, 1, True, content=blob)
                        for path, blob in sorted(FIXTURE_BLOBS.items()))
    return tuple(observations)


def replace_observation(observations, path, **changes):
    return tuple(replace(node, **changes) if node.path == path else node for node in observations)


class BootstrapAssertions(unittest.TestCase):
    def assert_error(self, code, function, *args, **kwargs):
        with self.assertRaises(entry.BootstrapError) as caught:
            function(*args, **kwargs)
        self.assertEqual(caught.exception.code, code)


class InventoryTests(BootstrapAssertions):
    def test_valid_closed_inventory_is_hash_bound_and_ordered(self):
        inventory = valid_inventory()
        self.assertEqual(inventory.sha256, digest(inventory.raw))
        self.assertEqual(tuple(item.path for item in inventory.files), tuple(sorted(FIXTURE_BLOBS)))
        self.assertEqual({item.role for item in inventory.files}, {"elf", "python", "spec", "scope"})

    def test_inventory_hash_is_checked_before_json_parsing(self):
        raw = b"this is not JSON"
        self.assert_error("INVENTORY_HASH", entry.parse_inventory, raw, expected_sha256="0" * 64)
        self.assert_error("INVENTORY_JSON", entry.parse_inventory, raw, expected_sha256=digest(raw))

    def test_pin_syntax_is_strict(self):
        for invalid in (None, b"0" * 64, "A" * 64, "0" * 63, "0" * 65, "g" * 64):
            with self.subTest(pin=invalid):
                self.assert_error("SHA256_SYNTAX", entry.parse_inventory, b"{}", expected_sha256=invalid)

    def test_inventory_bytes_are_exact_type_nonempty_and_bounded(self):
        for invalid in ("{}", bytearray(b"{}"), memoryview(b"{}"), b"", b" " * (entry.MAX_INVENTORY_BYTES + 1)):
            with self.subTest(type=type(invalid), size=len(invalid)):
                self.assert_error("INVENTORY_BYTES", entry.parse_inventory, invalid, expected_sha256="0" * 64)

    def test_duplicate_json_keys_at_top_level_and_entry_are_rejected(self):
        raw_values = (
            b'{"schema":"x","schema":"y","files":[]}',
            (b'{"schema":"' + entry.INVENTORY_SCHEMA.encode() +
             b'","files":[{"path":"a.py","path":"b.py","sha256":"' + b"0" * 64 +
             b'","size":1,"role":"python"}]}'),
        )
        for raw in raw_values:
            with self.subTest(raw=raw):
                self.assert_error("DUPLICATE_JSON_KEY", entry.parse_inventory, raw, expected_sha256=digest(raw))

    def test_invalid_utf8_json_and_nonobject_are_rejected(self):
        for raw, code in ((b"\xff", "INVENTORY_JSON"), (b"{", "INVENTORY_JSON"),
                          (b"[]", "INVENTORY_KEYS"), (b"null", "INVENTORY_KEYS")):
            with self.subTest(raw=raw):
                self.assert_error(code, entry.parse_inventory, raw, expected_sha256=digest(raw))

    def test_json_floats_constants_and_oversized_integers_are_rejected(self):
        template = b'{"schema":"x","files":[],"size":%s}'
        for token, code in ((b"1.0", "JSON_NONINTEGER"), (b"1e2", "JSON_NONINTEGER"),
                            (b"NaN", "JSON_NONINTEGER"), (b"Infinity", "JSON_NONINTEGER"),
                            (b"-Infinity", "JSON_NONINTEGER"), (b"10000000000", "JSON_INTEGER_BOUND")):
            raw = template % token
            with self.subTest(token=token):
                self.assert_error(code, entry.parse_inventory, raw, expected_sha256=digest(raw))

    def test_unknown_missing_keys_and_wrong_schema_are_rejected(self):
        for change, code in ((lambda data: data.update(extra=True), "INVENTORY_KEYS"),
                             (lambda data: data.pop("schema"), "INVENTORY_KEYS"),
                             (lambda data: data.update(schema="other"), "INVENTORY_SCHEMA"),
                             (lambda data: data["files"][0].update(extra=True), "ENTRY_KEYS"),
                             (lambda data: data["files"][0].pop("role"), "ENTRY_KEYS")):
            data = inventory_dict()
            change(data)
            with self.subTest(code=code):
                self.assert_error(code, parse_value, data)

    def test_empty_nonlist_or_oversized_file_lists_are_rejected(self):
        for value in ([], (), None, {}, [inventory_dict()["files"][0]] * (entry.MAX_FILES + 1)):
            data = inventory_dict()
            data["files"] = value
            # JSON tuples serialize as arrays, so an empty tuple also fails by count.
            with self.subTest(value_type=type(value)):
                self.assert_error("INVENTORY_FILE_COUNT", parse_value, data)

    def test_relative_paths_reject_traversal_aliases_backslashes_and_bytecode(self):
        cases = (("../entry.py", "RELATIVE_PATH"), ("/entry.py", "RELATIVE_PATH"),
                 ("a//b.py", "RELATIVE_PATH"), ("a/./b.py", "RELATIVE_PATH"),
                 ("a/../b.py", "RELATIVE_PATH"), ("a\\b.py", "RELATIVE_PATH"),
                 ("a b.py", "RELATIVE_PATH"), ("entry.py\x00", "RELATIVE_PATH"),
                 ("a/__pycache__/b.py", "BYTECODE_FORBIDDEN"), ("b.pyc", "BYTECODE_FORBIDDEN"),
                 ("b.pyo", "BYTECODE_FORBIDDEN"), ("", "RELATIVE_PATH"),
                 ("a" * 1025, "RELATIVE_PATH"), (False, "RELATIVE_PATH"))
        for value, code in cases:
            data = inventory_dict()
            data["files"][0]["path"] = value
            with self.subTest(path=value):
                self.assert_error(code, parse_value, data)

    def test_self_reference_roles_extensions_and_sizes_are_rejected(self):
        cases = (("path", "inventory.json", "INVENTORY_SELF_REFERENCE"),
                 ("role", "backend", "ENTRY_ROLE"), ("role", False, "ENTRY_ROLE"),
                 ("role", "python", "ENTRY_EXTENSION"),
                 ("size", True, "ENTRY_SIZE"), ("size", 0, "EMPTY_EXECUTION_INPUT"),
                 ("size", -1, "ENTRY_SIZE"), ("size", entry.MAX_FILE_BYTES + 1, "ENTRY_SIZE"),
                 ("sha256", "A" * 64, "SHA256_SYNTAX"))
        for field, value, code in cases:
            data = inventory_dict()
            data["files"][0][field] = value
            with self.subTest(field=field, value=value):
                self.assert_error(code, parse_value, data)
        data = inventory_dict()
        data["files"][1]["role"] = "elf"
        self.assert_error("PYTHON_ROLE", parse_value, data)

    def test_total_size_is_bounded(self):
        data = inventory_dict()
        for item in data["files"]:
            item["size"] = entry.MAX_FILE_BYTES
        self.assert_error("TREE_SIZE", parse_value, data)

    def test_empty_python_and_data_are_inventoried_but_execution_inputs_must_be_nonempty(self):
        for path, role in (("empty.py", "python"), ("empty-data", "data")):
            inventory = parse_value(inventory_dict({path: b""}, {path: role}))
            self.assertEqual(entry.prepare_data(inventory, {path: b""})[path], b"")
        for path, role in (("spec.json", "spec"), ("scope.md", "scope"), ("load.elf", "elf")):
            self.assert_error("EMPTY_EXECUTION_INPUT", parse_value,
                              inventory_dict({path: b""}, {path: role}))

    def test_unsorted_duplicate_case_alias_and_file_directory_collision_are_rejected(self):
        data = inventory_dict()
        data["files"].reverse()
        self.assert_error("PATHS_NOT_SORTED_OR_DUPLICATE", parse_value, data)
        data = inventory_dict()
        data["files"].insert(0, dict(data["files"][0]))
        self.assert_error("PATHS_NOT_SORTED_OR_DUPLICATE", parse_value, data)
        for paths, code in ((("A.py", "a.py"), "PATH_CASE_ALIAS"),
                            (("a", "a/b"), "FILE_DIRECTORY_COLLISION")):
            data = {"schema": entry.INVENTORY_SCHEMA,
                    "files": [{"path": path, "sha256": "0" * 64, "size": 1,
                               "role": "python" if path.endswith(".py") else "elf"} for path in paths]}
            self.assert_error(code, parse_value, data)

    def test_reserved_inventory_name_and_descendants_are_rejected_case_insensitively(self):
        for path in ("inventory.json", "INVENTORY.JSON", "inventory.json/child.py", "Inventory.Json/child.py"):
            data = {"schema": entry.INVENTORY_SCHEMA,
                    "files": [{"path": path, "sha256": "0" * 64, "size": 1,
                               "role": "python" if path.endswith(".py") else "elf"}]}
            with self.subTest(path=path):
                self.assert_error("INVENTORY_SELF_REFERENCE", parse_value, data)

    def test_windows_reserved_names_trailing_dots_and_depth_are_rejected(self):
        for path in ("CON", "aux.py", "COM1.json", "Lpt9.py", "a/NUL.py", "PRN", "file.", "dir./file.py"):
            data = {"schema": entry.INVENTORY_SCHEMA,
                    "files": [{"path": path, "sha256": "0" * 64, "size": 1, "role": "elf"}]}
            with self.subTest(path=path):
                self.assert_error("PORTABLE_PATH", parse_value, data)
        for count in (16, 17):
            path = "/".join(["directory"] * (count - 1) + ["file.py"])
            data = {"schema": entry.INVENTORY_SCHEMA,
                    "files": [{"path": path, "sha256": "0" * 64, "size": 1, "role": "python"}]}
            if count == 16:
                self.assertEqual(parse_value(data).files[0].path, path)
            else:
                self.assert_error("RELATIVE_PATH", parse_value, data)

    def test_casefold_file_directory_collision_and_directory_aliases_are_rejected(self):
        for paths, code in ((("A.py", "a.py/child.py"), "FILE_DIRECTORY_COLLISION"),
                            (("Pkg/a.py", "pkg/b.py"), "DIRECTORY_CASE_ALIAS"),
                            (("Pkg/Nested/a.py", "Pkg/nested/b.py"), "DIRECTORY_CASE_ALIAS")):
            data = {"schema": entry.INVENTORY_SCHEMA,
                    "files": [{"path": path, "sha256": "0" * 64, "size": 1, "role": "python"}
                              for path in sorted(paths)]}
            with self.subTest(paths=paths):
                self.assert_error(code, parse_value, data)


class PrepareDataTests(BootstrapAssertions):
    def test_prepared_map_includes_inventory_and_is_immutable(self):
        inventory = valid_inventory()
        blobs = dict(FIXTURE_BLOBS)
        result = entry.prepare_data(inventory, blobs)
        self.assertEqual(dict(result), {"inventory.json": inventory.raw, **FIXTURE_BLOBS})
        blobs["entry.py"] = b"changed after preparation"
        self.assertEqual(result["entry.py"], FIXTURE_BLOBS["entry.py"])
        with self.assertRaises(TypeError):
            result["entry.py"] = b"cannot modify"

    def test_extra_missing_and_nonmapping_inputs_are_rejected(self):
        for blobs in ({**FIXTURE_BLOBS, "extra.py": b"x"},
                      {key: value for key, value in FIXTURE_BLOBS.items() if key != "entry.py"},
                      list(FIXTURE_BLOBS), None):
            with self.subTest(type=type(blobs)):
                self.assert_error("UNINVENTORIED_OR_MISSING_FILE", entry.prepare_data, valid_inventory(), blobs)

    def test_exact_bytes_size_and_hash_are_required(self):
        original = FIXTURE_BLOBS["entry.py"]
        for blob, code in ((bytearray(original), "FILE_SIZE"), (original + b"x", "FILE_SIZE"),
                           (b"x" * len(original), "FILE_HASH")):
            with self.subTest(code=code, type=type(blob)):
                self.assert_error(code, entry.prepare_data, valid_inventory(), {**FIXTURE_BLOBS, "entry.py": blob})

    def test_forged_public_inventory_dataclass_cannot_bypass_reparse(self):
        inventory = valid_inventory()
        forged = replace(inventory, files=inventory.files[:-1])
        self.assert_error("INVENTORY_CHANGED", entry.prepare_data, forged, FIXTURE_BLOBS)
        self.assert_error("INVENTORY_REQUIRED", entry.prepare_data, object(), FIXTURE_BLOBS)


class NodeTests(BootstrapAssertions):
    def test_control_owned_file_and_directory_pass(self):
        for kind, links in (("file", 1), ("directory", 2)):
            entry.check_node(entry.NodeObservation("/fixture", kind, 0, 0o555, links, True), control_uid=0)

    def test_wrong_owner_kind_mode_acl_and_hardlinks_are_rejected(self):
        baseline = entry.NodeObservation("/fixture", "file", 0, 0o444, 1, True)
        cases = (({"uid": 1}, "CONTROL_OWNER"), ({"uid": True}, "CONTROL_OWNER"),
                 ({"kind": "symlink"}, "SYMLINK_OR_SPECIAL_NODE"),
                 ({"kind": "fifo"}, "SYMLINK_OR_SPECIAL_NODE"),
                 ({"mode": 0o446}, "WRITABLE_OR_SPECIAL_MODE"),
                 ({"mode": 0o464}, "WRITABLE_OR_SPECIAL_MODE"),
                 ({"mode": 0o1444}, "WRITABLE_OR_SPECIAL_MODE"),
                 ({"mode": 0o2444}, "WRITABLE_OR_SPECIAL_MODE"),
                 ({"mode": 0o4444}, "WRITABLE_OR_SPECIAL_MODE"),
                 ({"mode": True}, "MODE_INVALID"), ({"mode": -1}, "MODE_INVALID"),
                 ({"mode": 0o10000}, "MODE_INVALID"),
                 ({"acl_checked": False}, "ACL_UNOBSERVED"),
                 ({"acl_checked": 1}, "ACL_UNOBSERVED"),
                 ({"acl_names": ("system.posix_acl_access",)}, "ACL_FORBIDDEN"),
                 ({"acl_names": ("security.capability",)}, "ACL_FORBIDDEN"),
                 ({"acl_names": []}, "ACL_FORBIDDEN"),
                 ({"nlink": 0}, "LINK_COUNT"), ({"nlink": True}, "LINK_COUNT"),
                 ({"nlink": 2}, "FILE_HARDLINK"))
        for changes, code in cases:
            with self.subTest(changes=changes):
                self.assert_error(code, entry.check_node, replace(baseline, **changes), control_uid=0)

    def test_control_identity_and_node_type_are_strict(self):
        baseline = entry.NodeObservation("/fixture", "file", 0, 0o444, 1, True)
        for value in (True, -1, 1 << 32, "0"):
            self.assert_error("IDENTITY_INTEGER", entry.check_node, baseline, control_uid=value)
        self.assert_error("NODE_REQUIRED", entry.check_node, object(), control_uid=0)


class TreeObservationTests(BootstrapAssertions):
    def test_full_inventoried_tree_and_all_ancestors_pass(self):
        inventory = valid_inventory()
        self.assertEqual(entry.check_tree_observations(ROOT, inventory, fixture_observations(), control_uid=0), inventory)

    def test_extras_missing_bytecode_and_missing_ancestor_are_rejected(self):
        observations = fixture_observations()
        for altered in (observations + (entry.NodeObservation(ROOT + "/extra.py", "file", 0, 0o444, 1, True),),
                        observations + (entry.NodeObservation(ROOT + "/extra.pyc", "file", 0, 0o444, 1, True),),
                        tuple(node for node in observations if node.path != ROOT + "/entry.py"),
                        tuple(node for node in observations if node.path != "/srv")):
            self.assert_error("UNINVENTORIED_OR_MISSING_NODE", entry.check_tree_observations,
                              ROOT, valid_inventory(), altered, control_uid=0)

    def test_duplicate_observation_and_wrong_kind_are_rejected(self):
        observations = fixture_observations()
        self.assert_error("DUPLICATE_OBSERVATION", entry.check_tree_observations,
                          ROOT, valid_inventory(), observations + (observations[0],), control_uid=0)
        altered = replace_observation(observations, ROOT + "/entry.py", kind="directory")
        self.assert_error("NODE_KIND", entry.check_tree_observations, ROOT, valid_inventory(), altered, control_uid=0)

    def test_ancestor_ownership_writability_acl_and_symlink_are_rejected(self):
        for path in ("/", "/srv", ROOT):
            for changes, code in (({"uid": 1000}, "CONTROL_OWNER"),
                                  ({"mode": 0o557}, "WRITABLE_OR_SPECIAL_MODE"),
                                  ({"acl_names": ("system.posix_acl_access",)}, "ACL_FORBIDDEN"),
                                  ({"acl_checked": False}, "ACL_UNOBSERVED"),
                                  ({"kind": "symlink"}, "SYMLINK_OR_SPECIAL_NODE")):
                with self.subTest(ancestor=path, changes=changes):
                    self.assert_error(code, entry.check_tree_observations, ROOT, valid_inventory(),
                                      replace_observation(fixture_observations(), path, **changes), control_uid=0)

    def test_inventory_and_file_bytes_are_checked_again(self):
        observations = fixture_observations()
        for path, content, code in ((ROOT + "/inventory.json", b"changed", "INVENTORY_HASH"),
                                    (ROOT + "/entry.py", b"x", "FILE_SIZE"),
                                    (ROOT + "/entry.py", b"x" * len(FIXTURE_BLOBS["entry.py"]), "FILE_HASH"),
                                    (ROOT + "/entry.py", bytearray(FIXTURE_BLOBS["entry.py"]), "FILE_SIZE")):
            self.assert_error(code, entry.check_tree_observations, ROOT, valid_inventory(),
                              replace_observation(observations, path, content=content), control_uid=0)

    def test_observation_bound_types_root_and_forged_inventory_are_rejected(self):
        observations = fixture_observations()
        for value in (list(observations), observations * (entry.MAX_FILES * 16)):
            self.assert_error("OBSERVATION_BOUND", entry.check_tree_observations, ROOT, valid_inventory(), value, control_uid=0)
        self.assert_error("NODE_REQUIRED", entry.check_tree_observations, ROOT, valid_inventory(), (object(),), control_uid=0)
        self.assert_error("INVENTORY_CHANGED", entry.check_tree_observations, ROOT,
                          replace(valid_inventory(), files=()), observations, control_uid=0)
        for root in ("/", "relative", "C:\\protected", "/srv//protected", "/srv/../protected"):
            with self.subTest(root=root):
                with self.assertRaises(entry.BootstrapError):
                    entry.check_tree_observations(root, valid_inventory(), observations, control_uid=0)


class FakePosix:
    """Descriptor-only POSIX model. It never touches host ownership or permissions."""
    O_NOFOLLOW = 0x10000
    O_DIRECTORY = 0x20000
    O_CLOEXEC = 0x40000
    O_NONBLOCK = 0x80000

    def __init__(self, observations=None):
        self.nodes = {node.path: node for node in (fixture_observations() if observations is None else observations)}
        self.fds = {}
        self.positions = {}
        self.next_fd = 40
        self.opened = []
        self.closed = []
        self.stat_counts = {}
        self.change_at = {}
        self.extra_names = {}
        self.size_override = {}
        self.read_override = {}
        self.xattr_error = None

    def open(self, name, flags, *, dir_fd=None):
        if dir_fd is None:
            if name != "/":
                raise AssertionError("Only / may be opened without a parent descriptor")
            path = name
        else:
            if "/" in name or name in (".", ".."):
                raise AssertionError("Child opens must be one component")
            path = self.fds[dir_fd].rstrip("/") + "/" + name
        if not flags & self.O_NOFOLLOW or not flags & self.O_CLOEXEC:
            raise AssertionError("Every descriptor requires no-follow and close-on-exec")
        node = self.nodes.get(path)
        if node is None or node.kind == "symlink":
            raise OSError("fixture unavailable or no-follow rejection")
        if flags & self.O_DIRECTORY and node.kind != "directory":
            raise OSError("fixture is not a directory")
        fd = self.next_fd
        self.next_fd += 1
        self.fds[fd] = path
        self.positions[fd] = 0
        self.opened.append(fd)
        return fd

    def close(self, fd):
        if fd not in self.fds:
            raise AssertionError("Descriptor closed twice")
        self.closed.append(fd)
        del self.fds[fd]

    def fstat(self, fd):
        path = self.fds[fd]
        node = self.nodes[path]
        self.stat_counts[path] = self.stat_counts.get(path, 0) + 1
        changed = self.stat_counts[path] >= self.change_at.get(path, float("inf"))
        kind = stat.S_IFDIR if node.kind == "directory" else stat.S_IFREG if node.kind == "file" else stat.S_IFIFO
        content = node.content or b""
        return SimpleNamespace(st_dev=1, st_ino=sorted(self.nodes).index(path) + 1,
                               st_mode=kind | node.mode, st_uid=node.uid, st_gid=0,
                               st_nlink=node.nlink, st_size=self.size_override.get(path, len(content)),
                               st_mtime_ns=1 + int(changed), st_ctime_ns=1)

    def listxattr(self, fd):
        if self.xattr_error is not None:
            raise self.xattr_error
        return list(self.nodes[self.fds[fd]].acl_names)

    def listdir(self, fd):
        path = self.fds[fd]
        prefix = path.rstrip("/") + "/"
        names = [name[len(prefix):] for name in self.nodes
                 if name.startswith(prefix) and "/" not in name[len(prefix):] and name != path]
        return names + self.extra_names.get(path, [])

    def read(self, fd, maximum):
        path = self.fds[fd]
        content = self.read_override.get(path, self.nodes[path].content or b"")
        position = self.positions[fd]
        value = content[position:position + maximum]
        self.positions[fd] += len(value)
        return value


class PosixInspectionTests(BootstrapAssertions):
    def inspect(self, fake, inventory=None):
        replacements = {name: getattr(fake, name) for name in
                        ("open", "close", "fstat", "listxattr", "listdir", "read")}
        replacements.update({name: getattr(fake, name) for name in
                             ("O_NOFOLLOW", "O_DIRECTORY", "O_CLOEXEC", "O_NONBLOCK")})
        with patch.object(entry.sys, "platform", "linux"), patch.multiple(entry.os, create=True, **replacements):
            return entry.inspect_posix_tree(ROOT, valid_inventory() if inventory is None else inventory, control_uid=0)

    def assert_fake_error(self, code, fake):
        self.assert_error(code, self.inspect, fake)
        self.assertEqual(set(fake.closed), set(fake.opened), "All opened descriptors must be closed on rejection")
        self.assertEqual(fake.fds, {})

    def test_descriptor_inspection_passes_without_host_posix_access_and_closes_all_fds(self):
        fake = FakePosix()
        self.assertEqual(self.inspect(fake), valid_inventory())
        self.assertEqual(set(fake.closed), set(fake.opened))
        self.assertEqual(fake.fds, {})

    def test_nonlinux_is_rejected_before_any_descriptor_is_opened(self):
        with patch.object(entry.sys, "platform", "win32"), patch.object(entry.os, "open") as open_mock:
            self.assert_error("PLATFORM_NOT_SUPPORTED", entry.inspect_posix_tree, ROOT, valid_inventory())
        open_mock.assert_not_called()

    def test_symlink_component_and_special_file_fail_closed_and_release_fds(self):
        fake = FakePosix(replace_observation(fixture_observations(), "/srv", kind="symlink"))
        self.assert_fake_error("PROTECTED_TREE_UNAVAILABLE", fake)
        fake = FakePosix(replace_observation(fixture_observations(), ROOT + "/entry.py", kind="fifo"))
        self.assert_fake_error("SYMLINK_OR_SPECIAL_NODE", fake)

    def test_unknown_acl_capability_and_unavailable_acl_inspection_fail_closed(self):
        for xattr in ("system.posix_acl_access", "system.posix_acl_default", "system.nfs4_acl",
                      "system.richacl", "security.capability"):
            with self.subTest(xattr=xattr):
                fake = FakePosix(replace_observation(fixture_observations(), ROOT + "/entry.py", acl_names=(xattr,)))
                self.assert_fake_error("ACL_FORBIDDEN", fake)
        for error in (OSError("fixture ACL failure"), AttributeError("fixture no xattr support")):
            fake = FakePosix()
            fake.xattr_error = error
            self.assert_fake_error("ACL_UNOBSERVED", fake)

    def test_harmless_non_acl_xattr_does_not_grant_or_remove_permissions(self):
        fake = FakePosix(replace_observation(fixture_observations(), ROOT + "/entry.py",
                                            acl_names=("user.fixture-description",)))
        self.assertEqual(self.inspect(fake), valid_inventory())

    def test_extra_missing_and_bytecode_entries_fail_closed(self):
        for name, code in (("extra.py", "UNINVENTORIED_OR_MISSING_NODE"),
                           ("extra.pyc", "BYTECODE_FORBIDDEN"), ("__pycache__", "BYTECODE_FORBIDDEN")):
            fake = FakePosix()
            fake.extra_names[ROOT] = [name]
            self.assert_fake_error(code, fake)
        fake = FakePosix(tuple(node for node in fixture_observations() if node.path != ROOT + "/inventory.json"))
        self.assert_fake_error("UNINVENTORIED_OR_MISSING_NODE", fake)

    def test_directory_entry_count_is_bounded_before_opening_children(self):
        fake = FakePosix()
        fake.extra_names[ROOT] = ["fixture-" + str(index) for index in range(entry.MAX_FILES + 1)]
        self.assert_fake_error("DIRECTORY_ENTRY_BOUND", fake)

    def test_maximum_flat_inventory_allows_pinned_inventory_as_one_additional_entry(self):
        blobs = {"fixture-" + str(index).zfill(3) + ".py": b"#" for index in range(entry.MAX_FILES)}
        inventory = parse_value(inventory_dict(blobs, {path: "python" for path in blobs}))
        observations = [entry.NodeObservation(path, "directory", 0, 0o555, 2, True)
                        for path in ("/", "/srv", ROOT)]
        observations.append(entry.NodeObservation(ROOT + "/inventory.json", "file", 0, 0o444, 1, True,
                                                  content=inventory.raw))
        observations.extend(entry.NodeObservation(ROOT + "/" + path, "file", 0, 0o444, 1, True, content=blob)
                            for path, blob in blobs.items())
        fake = FakePosix(tuple(observations))
        self.assertEqual(self.inspect(fake, inventory), inventory)
        self.assertEqual(set(fake.closed), set(fake.opened))

    def test_file_stat_size_truncation_growth_and_hash_changes_are_rejected(self):
        path = ROOT + "/entry.py"
        fake = FakePosix()
        fake.size_override[path] = len(FIXTURE_BLOBS["entry.py"]) + 1
        self.assert_fake_error("FILE_SIZE", fake)
        for content, code in ((FIXTURE_BLOBS["entry.py"][:-1], "FILE_SIZE"),
                              (FIXTURE_BLOBS["entry.py"] + b"x", "FILE_SIZE"),
                              (b"x" * len(FIXTURE_BLOBS["entry.py"]), "FILE_HASH")):
            fake = FakePosix()
            fake.read_override[path] = content
            self.assert_fake_error(code, fake)

    def test_file_directory_and_ancestor_changes_are_detected(self):
        for path, call, code in ((ROOT + "/entry.py", 3, "NODE_CHANGED_DURING_READ"),
                                 (ROOT, 3, "NODE_CHANGED_DURING_READ"),
                                 ("/", 2, "ANCESTOR_CHANGED")):
            with self.subTest(path=path):
                fake = FakePosix()
                fake.change_at[path] = call
                self.assert_fake_error(code, fake)


class InvocationPlanTests(BootstrapAssertions):
    def arguments(self, **changes):
        values = dict(root=ROOT, interpreter="/opt/review-python/bin/python3",
                      stdlib_paths=("/opt/review-python/lib/python3.14", "/opt/review-python/lib/python3.14/lib-dynload"),
                      inventory=valid_inventory(), entry_path="entry.py", spec_path="spec.json",
                      scope_path="scope.json", source_elf_path="bin/load-fixture",
                      ledger_directory="/var/tmp/fixture-ledger", package_directory=PACKAGE)
        values.update(changes)
        return values

    def test_concrete_absolute_recipe_closes_environment_cwd_and_sys_path(self):
        with patch.dict(os.environ, {"PYTHONPATH": "/editable", "PYTHONHOME": "/editable", "LD_PRELOAD": "/editable.so",
                                     "PATH": "/editable", "SUDO_USER": "fixture"}, clear=True):
            plan = entry.build_invocation_plan(**self.arguments())
        self.assertEqual(plan.argv[:5], ("/opt/review-python/bin/python3", "-I", "-S", "-B", ROOT + "/entry.py"))
        self.assertEqual(plan.cwd, ROOT)
        self.assertEqual(dict(plan.environment), {"LANG": "C.UTF-8", "LC_ALL": "C.UTF-8"})
        self.assertEqual(plan.sys_path, self.arguments()["stdlib_paths"] + (ROOT + "/" + PACKAGE,))
        self.assertEqual(plan.central_argv, ("run", "--spec", ROOT + "/spec.json", "--source-elf", ROOT + "/bin/load-fixture"))
        self.assertEqual(plan.blockers, entry.PRODUCTION_BLOCKERS)
        self.assertIn("--inventory-sha256", plan.argv)
        self.assertIn(valid_inventory().sha256, plan.argv)
        scope_hash = digest(FIXTURE_BLOBS["scope.json"])
        self.assertEqual(plan.argv[plan.argv.index("--scope-sha256") + 1], scope_hash)
        self.assertNotIn("", plan.sys_path)
        with self.assertRaises(Exception):
            plan.cwd = "/changed"

    def test_package_location_must_be_explicit_and_canonical_main_inventoried(self):
        for directory, code in (("unknown-package", "CANONICAL_MAIN_NOT_INVENTORIED"),
                                 ("../reviewed-package", "RELATIVE_PATH"),
                                 ("/reviewed-package", "RELATIVE_PATH")):
            self.assert_error(code, entry.build_invocation_plan, **self.arguments(package_directory=directory))
        arguments = self.arguments()
        arguments.pop("package_directory")
        with self.assertRaises(TypeError):
            entry.build_invocation_plan(**arguments)
        data = inventory_dict()
        data["files"] = [item for item in data["files"] if not item["path"].endswith("/__main__.py")]
        self.assert_error("CANONICAL_MAIN_NOT_INVENTORIED", entry.build_invocation_plan,
                          **self.arguments(inventory=parse_value(data)))

    def test_every_runtime_input_has_an_inventoried_role(self):
        for change in ({"entry_path": "missing.py"}, {"spec_path": "scope.json"},
                       {"scope_path": "spec.json"}, {"source_elf_path": "entry.py"}):
            self.assert_error("INVOCATION_INPUT_NOT_INVENTORIED", entry.build_invocation_plan, **self.arguments(**change))
        self.assert_error("INVENTORY_CHANGED", entry.build_invocation_plan,
                          **self.arguments(inventory=replace(valid_inventory(), files=())))

    def test_absolute_paths_and_startup_path_set_are_strict(self):
        for change in ({"root": "relative"}, {"interpreter": "python3"},
                       {"interpreter": "C:\\python.exe"}, {"ledger_directory": "/"}):
            self.assert_error("ABSOLUTE_POSIX_PATH", entry.build_invocation_plan, **self.arguments(**change))
        for paths in ((), [], ("/one",) * 5):
            self.assert_error("STDLIB_PATHS_REQUIRED", entry.build_invocation_plan, **self.arguments(stdlib_paths=paths))
        self.assert_error("DUPLICATE_STDLIB_PATH", entry.build_invocation_plan,
                          **self.arguments(stdlib_paths=("/one", "/one")))
        self.assert_error("ABSOLUTE_POSIX_PATH", entry.build_invocation_plan,
                          **self.arguments(stdlib_paths=("editable",)))

    def test_ledger_cannot_overlap_control_tree_interpreter_or_startup_libraries(self):
        for ledger in (ROOT, ROOT + "/ledger", "/srv"):
            self.assert_error("LEDGER_CONTROL_OVERLAP", entry.build_invocation_plan, **self.arguments(ledger_directory=ledger))
        for ledger in ("/opt", "/opt/review-python/bin/python3", "/opt/review-python/lib/python3.14/ledger"):
            self.assert_error("STARTUP_CONTROL_OVERLAP", entry.build_invocation_plan, **self.arguments(ledger_directory=ledger))
        for stdlib in ((ROOT,), (ROOT + "/lib",), ("/srv",)):
            self.assert_error("STARTUP_CONTROL_OVERLAP", entry.build_invocation_plan, **self.arguments(stdlib_paths=stdlib))
        # Merely sharing a string prefix is not a directory overlap.
        plan = entry.build_invocation_plan(**self.arguments(ledger_directory=ROOT + "-ledger"))
        self.assertEqual(plan.ledger_directory, ROOT + "-ledger")


class LoadIdentityTests(BootstrapAssertions):
    def test_existing_unprivileged_identity_without_groups_or_channels_passes(self):
        identity = entry.LoadIdentity(10001, 10001, (), ())
        self.assertIs(entry.check_load_identity(identity, control_uid=0, forbidden_gids=(0, 10, 27)), identity)

    def test_root_control_identity_administrative_groups_and_channels_are_rejected(self):
        baseline = entry.LoadIdentity(10001, 10001, (), ())
        cases = (({"uid": 0}, "LOAD_CONTROL_IDENTITY"), ({"uid": 500}, "LOAD_CONTROL_IDENTITY"),
                 ({"gid": 0}, "ADMIN_PRIMARY_GROUP"), ({"gid": 27}, "ADMIN_PRIMARY_GROUP"),
                 ({"supplementary_gids": (10001,)}, "SUPPLEMENTARY_GROUPS_FORBIDDEN"),
                 ({"supplementary_gids": []}, "SUPPLEMENTARY_GROUPS_FORBIDDEN"),
                 ({"administrative_channels": ("docker.sock",)}, "ADMINISTRATIVE_CHANNEL"),
                 ({"administrative_channels": []}, "ADMINISTRATIVE_CHANNEL"))
        for changes, code in cases:
            self.assert_error(code, entry.check_load_identity, replace(baseline, **changes), control_uid=500, forbidden_gids=(0, 27))

    def test_identity_and_group_policy_cannot_use_booleans_or_omit_root(self):
        baseline = entry.LoadIdentity(10001, 10001, (), ())
        self.assert_error("LOAD_IDENTITY_REQUIRED", entry.check_load_identity, object(), control_uid=0, forbidden_gids=(0,))
        for field in ("uid", "gid"):
            for value in (True, -1, 1 << 32, "10001"):
                self.assert_error("IDENTITY_INTEGER", entry.check_load_identity,
                                  replace(baseline, **{field: value}), control_uid=0, forbidden_gids=(0,))
        for policy in ([], (), (27,), (0, True), (0, -1), (0, 1 << 32)):
            code = "IDENTITY_INTEGER" if policy in ((0, -1), (0, 1 << 32)) else "ADMIN_GROUP_POLICY"
            self.assert_error(code, entry.check_load_identity, baseline, control_uid=0, forbidden_gids=policy)


class FakeIdentityDatabase:
    """Invented pwd/grp data, never the host's accounts or authorization policy."""
    def __init__(self):
        self.user = SimpleNamespace(pw_name="fixture-load", pw_uid=10001, pw_gid=10001,
                                    pw_dir="/nonexistent", pw_shell="/usr/sbin/nologin")
        self.groups = {
            "fixture-load": SimpleNamespace(gr_name="fixture-load", gr_gid=10001, gr_mem=[]),
            "root": SimpleNamespace(gr_name="root", gr_gid=0, gr_mem=[]),
            "sudo": SimpleNamespace(gr_name="sudo", gr_gid=27, gr_mem=[]),
            "wheel": SimpleNamespace(gr_name="wheel", gr_gid=10, gr_mem=[]),
            "docker": SimpleNamespace(gr_name="docker", gr_gid=999, gr_mem=[]),
            "lxd": SimpleNamespace(gr_name="lxd", gr_gid=998, gr_mem=[]),
            "libvirt": SimpleNamespace(gr_name="libvirt", gr_gid=997, gr_mem=[]),
            "adm": SimpleNamespace(gr_name="adm", gr_gid=4, gr_mem=[]),
            "disk": SimpleNamespace(gr_name="disk", gr_gid=6, gr_mem=[]),
            "shadow": SimpleNamespace(gr_name="shadow", gr_gid=42, gr_mem=[]),
            "systemd-journal": SimpleNamespace(gr_name="systemd-journal", gr_gid=996, gr_mem=[]),
        }
        self.grouplist = [self.user.pw_gid]
        self.pwd = ModuleType("pwd")
        self.pwd.getpwnam = Mock(side_effect=self.getpwnam)
        self.pwd.getpwuid = Mock(side_effect=self.getpwuid)
        self.grp = ModuleType("grp")
        self.grp.getgrnam = Mock(side_effect=self.getgrnam)
        self.grp.getgrgid = Mock(side_effect=self.getgrgid)
        self.grp.getgrall = Mock(side_effect=lambda: list(self.groups.values()))
        self.getgrouplist = Mock(side_effect=lambda name, gid: list(self.grouplist))

    def getpwnam(self, name):
        if name != self.user.pw_name:
            raise KeyError(name)
        return self.user

    def getpwuid(self, uid):
        if uid != self.user.pw_uid:
            raise KeyError(uid)
        return self.user

    def getgrnam(self, name):
        if name not in self.groups:
            raise KeyError(name)
        return self.groups[name]

    def getgrgid(self, gid):
        matches = [group for group in self.groups.values() if group.gr_gid == gid]
        if not matches:
            raise KeyError(gid)
        return matches[0]


@contextmanager
def mocked_posix(fake):
    replacements = {name: getattr(fake, name) for name in
                    ("open", "close", "fstat", "listxattr", "listdir", "read")}
    replacements.update({name: getattr(fake, name) for name in
                         ("O_NOFOLLOW", "O_DIRECTORY", "O_CLOEXEC", "O_NONBLOCK")})
    with patch.object(entry.sys, "platform", "linux"), patch.multiple(entry.os, create=True, **replacements):
        yield fake


def complete_fixture():
    """Invented full assembly and external approval, held only as test data."""
    python_paths = (entry.ENTRY_PATH, entry.WRAPPER_PATH,
                    "package/systemd_memory_runtime/__init__.py",
                    "package/systemd_memory_runtime/__main__.py",
                    "package/systemd_memory_runtime/contracts.py",
                    "package/systemd_memory_runtime/payload_distribution.py",
                    "package/systemd_memory_runtime/physical_cgroup.py")
    blobs = {path: ("# invented non-executed fixture: " + path + "\n").encode("ascii") for path in python_paths}
    blobs["package/systemd_memory_runtime/__init__.py"] = b""
    roles = {path: "python" for path in python_paths}
    elf = b"\x7fELFnever-executed-fixture"
    spec_mapping = dict(run="fixture-run", load_uid=10001, load_gid=10001, load_groups=[10001],
                        scope_ref="fixture-scope-ref", payload_expected_sha256=digest(elf),
                        t0_us=1000, work_deadline_us=50_001_000, cleanup_deadline_us=60_001_000)
    blobs.update({entry.SPEC_PATH: encode_inventory(spec_mapping),
                  entry.SCOPE_PATH: b"invented scope data, not an authorization\n",
                  entry.CONTEXT_PATH: encode_inventory({"fixture": "context"}),
                  entry.YAML_PATH: b"name: invented-review-fixture\n", entry.ELF_PATH: elf})
    roles.update({entry.SPEC_PATH: "spec", entry.SCOPE_PATH: "scope", entry.CONTEXT_PATH: "data",
                  entry.YAML_PATH: "data", entry.ELF_PATH: "elf"})
    manifest = {"schema": entry.SOURCE_SCHEMA, "repository": entry.REPOSITORY,
                "source_commit": "1" * 40,
                "files": [{"path": path, "sha256": digest(blob), "size": len(blob)}
                          for path, blob in sorted(blobs.items()) if path in python_paths]}
    blobs[entry.SOURCE_MANIFEST_PATH] = encode_inventory(manifest)
    roles[entry.SOURCE_MANIFEST_PATH] = "data"
    policy = {"/etc/passwd": b"invented passwd fixture\n", "/etc/group": b"invented group fixture\n",
              "/etc/nsswitch.conf": b"passwd: files\ngroup: files\ninitgroups: files\n", "/etc/sudoers": b"invented reviewed fixture policy\n"}
    startup = {entry.VM_INTERPRETER: b"invented interpreter bytes, never executed",
               entry.VM_STDLIB_PATHS[0] + "/os.py": b"invented startup bytes, never imported",
               entry.VM_STDLIB_PATHS[0] + "/fixture-empty.py": b"",
               entry.VM_STDLIB_PATHS[1] + "/fixture-extension.so": b"invented extension bytes, never loaded"}
    startup.update({path: b"invented native dependency bytes, never loaded"
                    for path in entry.VM_NATIVE_DEPENDENCIES})
    pins = lambda data: [{"path": path, "sha256": digest(blob), "size": len(blob)}
                        for path, blob in sorted(data.items())]
    approval = dict(schema=entry.APPROVAL_SCHEMA, repository=entry.REPOSITORY,
                    source_commit="1" * 40, branch="fixture-synthetic", authorization_ref="fixture-authorization",
                    scope_document_sha256=digest(blobs[entry.SCOPE_PATH]), yaml_sha256=digest(blobs[entry.YAML_PATH]),
                    source_manifest_sha256=digest(blobs[entry.SOURCE_MANIFEST_PATH]), elf_sha256=digest(elf),
                    event_context_sha256=digest(blobs[entry.CONTEXT_PATH]),
                    python_files=pins({path: blobs[path] for path in python_paths}),
                    interpreter=entry.VM_INTERPRETER,
                    stdlib_paths=list(entry.VM_STDLIB_PATHS), startup_files=pins(startup),
                    identity=dict(uid=10001, gid=10001, name="fixture-load", home="/nonexistent",
                                  shell="/usr/sbin/nologin", policy_files=pins(policy),
                                  policy_directories=["/etc/sudoers.d", "/etc/polkit-1/rules.d",
                                                      "/usr/share/polkit-1/rules.d", "/etc/pam.d", "/etc/security"]))
    approval_raw = encode_inventory(approval)
    blobs[entry.APPROVAL_PATH] = approval_raw
    roles[entry.APPROVAL_PATH] = "data"
    inventory = parse_value(inventory_dict(blobs, roles))
    inputs = entry.ProtectedInputs(ROOT, inventory, MappingProxyType({"inventory.json": inventory.raw, **blobs}),
                                   approval_raw, digest(approval_raw))
    return SimpleNamespace(inputs=inputs, approval=approval, blobs=blobs, roles=roles,
                           policy=policy, startup=startup, spec_mapping=spec_mapping)


def complete_observations(fixture):
    directories = {"/", "/srv", ROOT}
    for relative in fixture.inputs.blobs:
        parent = PurePosixPath(ROOT + "/" + relative).parent
        while str(parent) != "/":
            directories.add(str(parent))
            parent = parent.parent
    nodes = [entry.NodeObservation(path, "directory", 0, 0o555, 2, True) for path in sorted(directories)]
    nodes.extend(entry.NodeObservation(ROOT + "/" + path, "file", 0, 0o444, 1, True, content=blob)
                 for path, blob in sorted(fixture.inputs.blobs.items()))
    return tuple(nodes)


def fake_components(fixture=None):
    fixture = complete_fixture() if fixture is None else fixture
    wrapper = ModuleType("_elogistix_reviewed_pilot")
    wrapper.__file__ = ROOT + "/" + entry.WRAPPER_PATH
    wrapper.AUTHORIZATION_SCOPE_REF = "fixture-scope-ref"
    wrapper.parse_strict_json = Mock(side_effect=lambda raw, **kwargs: json.loads(raw))
    wrapper.extract_approved_scope = Mock(return_value=SimpleNamespace(values={
        "authorization_ref": fixture.approval["authorization_ref"], "scope_ref": wrapper.AUTHORIZATION_SCOPE_REF}))
    wrapper.validate_scope = Mock(return_value={"status": "CONSISTENT_DATA_ONLY", "runtime_ready": False})
    contracts = ModuleType("systemd_memory_runtime.contracts")
    contracts.__file__ = ROOT + "/package/systemd_memory_runtime/contracts.py"
    contracts.WORK_US, contracts.CLEANUP_US = 50_000_000, 60_000_000
    contracts.MEMORY_MAX_BYTES, contracts.TASKS_MAX = 32 * 1024 * 1024, 8
    contracts.MAX_PACKET_BYTES, contracts.MAX_DEPTH = 131_072, 16
    def canonical_spec(mapping):
        values = dict(mapping)
        values["load_groups"] = tuple(values["load_groups"])
        return SimpleNamespace(**values)
    contracts.RunSpec = SimpleNamespace(from_mapping=Mock(side_effect=canonical_spec))
    central = ModuleType("systemd_memory_runtime.__main__")
    central.__file__ = ROOT + "/package/systemd_memory_runtime/__main__.py"
    central.main = Mock(return_value=0)
    central.monotonic_us = Mock(return_value=1100)
    components = entry.ReviewedComponents(fixture.inputs, wrapper, contracts, central.main, central.monotonic_us)
    return SimpleNamespace(fixture=fixture, components=components, central=central, wrapper=wrapper, contracts=contracts)


def fake_binding():
    assembled = fake_components()
    spec = assembled.contracts.RunSpec.from_mapping(assembled.fixture.spec_mapping)
    identity = entry.LoadIdentity(10001, 10001, (), ())
    assembled.binding = entry.ScopeSpecBinding(assembled.components, spec, identity,
                                              MappingProxyType({"status": "CONSISTENT_DATA_ONLY", "runtime_ready": False}))
    return assembled


class ReviewMemoryFS:
    """In-memory Path I/O fixture; no host chmod, ACL, ownership or directory write."""
    def __init__(self):
        self.parent = Path("invented-review-parent")
        self.directories = {self.parent, self.parent.parent}
        self.files = {}
        self.mkdir_requests = []

    def mkdir(self, path, mode=0o777, parents=False, exist_ok=False):
        self.mkdir_requests.append((path, mode, parents, exist_ok))
        if path in self.files or path in self.directories and not exist_ok:
            raise FileExistsError(str(path))
        if not parents and path.parent not in self.directories:
            raise FileNotFoundError(str(path.parent))
        if parents:
            for parent in reversed(path.parents):
                self.directories.add(parent)
        self.directories.add(path)

    def open(self, path, mode="r", *args, **kwargs):
        if mode != "xb":
            raise AssertionError("Review writes must be binary and exclusive")
        if path in self.files or path in self.directories:
            raise FileExistsError(str(path))
        if path.parent not in self.directories:
            raise FileNotFoundError(str(path.parent))
        filesystem = self

        class Writer(io.BytesIO):
            def __exit__(self, *exc):
                filesystem.files[path] = self.getvalue()
                self.close()

        return Writer()

    def patches(self):
        filesystem = self
        return patch.multiple(type(Path()),
                              mkdir=lambda path, *args, **kwargs: filesystem.mkdir(path, *args, **kwargs),
                              open=lambda path, *args, **kwargs: filesystem.open(path, *args, **kwargs))


class ReviewDataWriterTests(BootstrapAssertions):
    def test_fresh_review_tree_contains_only_exact_inventoried_data(self):
        inventory = valid_inventory()
        filesystem = ReviewMemoryFS()
        with filesystem.patches():
            destination = filesystem.parent / "review-data"
            self.assertEqual(entry.write_review_data(destination, inventory, FIXTURE_BLOBS), destination)
            actual = {path.relative_to(destination).as_posix(): blob for path, blob in filesystem.files.items()}
            self.assertEqual(actual, {"inventory.json": inventory.raw, **FIXTURE_BLOBS})
            expected_mode = 0o700 if os.name == "posix" else 0o777
            self.assertTrue(all(request[1] == expected_mode for request in filesystem.mkdir_requests))
            with self.assertRaises(FileExistsError):
                entry.write_review_data(destination, inventory, FIXTURE_BLOBS)
            self.assertEqual(filesystem.files[destination / "entry.py"], FIXTURE_BLOBS["entry.py"])

    def test_review_directory_modes_are_data_only_and_do_not_change_host_acl(self):
        for platform, expected_mode in (("posix", 0o700), ("nt", 0o777)):
            with self.subTest(platform=platform):
                filesystem = ReviewMemoryFS()
                destination = filesystem.parent / "review-data"
                # Replace only the launcher's os reference; pathlib keeps its host
                # platform and all mkdir/open operations remain in memory.
                with filesystem.patches(), patch.object(entry, "os", SimpleNamespace(name=platform)):
                    entry.write_review_data(destination, valid_inventory(), FIXTURE_BLOBS)
                self.assertTrue(filesystem.mkdir_requests)
                self.assertTrue(all(request[1] == expected_mode for request in filesystem.mkdir_requests))
                self.assertEqual({path.relative_to(destination).as_posix(): blob
                                  for path, blob in filesystem.files.items()},
                                 {"inventory.json": valid_inventory().raw, **FIXTURE_BLOBS})

    def test_invalid_data_is_rejected_before_destination_creation(self):
        filesystem = ReviewMemoryFS()
        with filesystem.patches():
            destination = filesystem.parent / "review-data"
            self.assert_error("UNINVENTORIED_OR_MISSING_FILE", entry.write_review_data,
                              destination, valid_inventory(), {})
            self.assertNotIn(destination, filesystem.directories)
            self.assert_error("DESTINATION_PATH", entry.write_review_data,
                              str(destination), valid_inventory(), FIXTURE_BLOBS)
            self.assertNotIn(destination, filesystem.directories)
            self.assertEqual(filesystem.files, {})
            self.assertEqual(filesystem.mkdir_requests, [])

    def test_missing_parent_is_not_created_implicitly(self):
        filesystem = ReviewMemoryFS()
        with filesystem.patches():
            destination = filesystem.parent / "absent-parent" / "review-data"
            with self.assertRaises(FileNotFoundError):
                entry.write_review_data(destination, valid_inventory(), FIXTURE_BLOBS)
            self.assertNotIn(destination.parent, filesystem.directories)
            self.assertEqual(filesystem.files, {})


class ProtectedReadTests(BootstrapAssertions):
    def read(self, fake, fixture, **pins):
        values = dict(inventory_sha256=fixture.inputs.inventory.sha256,
                      approval_sha256=fixture.inputs.approval_sha256)
        values.update(pins)
        with mocked_posix(fake):
            return entry.read_protected_inputs(ROOT, **values)

    def test_real_descriptor_reader_returns_exact_retained_immutable_bytes(self):
        fixture = complete_fixture()
        fake = FakePosix(complete_observations(fixture))
        result = self.read(fake, fixture)
        self.assertEqual(result, fixture.inputs)
        self.assertEqual(dict(result.blobs), {"inventory.json": fixture.inputs.inventory.raw, **fixture.blobs})
        with self.assertRaises(TypeError):
            result.blobs[entry.SPEC_PATH] = b"modified"
        path = ROOT + "/" + entry.ENTRY_PATH
        fake.nodes[path] = replace(fake.nodes[path], content=b"changed after the retained read")
        self.assertEqual(result.blobs[entry.ENTRY_PATH], fixture.blobs[entry.ENTRY_PATH])
        self.assertEqual(fake.fds, {})
        self.assertEqual(set(fake.closed), set(fake.opened))

    def test_inventory_pin_is_checked_before_tree_parser_or_approval(self):
        fixture = complete_fixture()
        fake = FakePosix(complete_observations(fixture))
        with patch.object(entry, "_read_posix_tree") as tree_mock, patch.object(entry, "_parse_approval") as approval_mock:
            self.assert_error("INVENTORY_HASH", self.read, fake, fixture, inventory_sha256="0" * 64)
        tree_mock.assert_not_called()
        approval_mock.assert_not_called()
        self.assertEqual(fake.fds, {})

    def test_approval_hash_is_independent_of_dynamic_inventory_hash(self):
        fixture = complete_fixture()
        fake = FakePosix(complete_observations(fixture))
        self.assert_error("EXTERNAL_APPROVAL_HASH", self.read, fake, fixture,
                          approval_sha256=fixture.inputs.inventory.sha256)
        self.assertEqual(fake.fds, {})

    def test_dynamic_hash_does_not_approve_changed_or_additional_python(self):
        for extra in (False, True):
            fixture = complete_fixture()
            blobs, roles = dict(fixture.blobs), dict(fixture.roles)
            path = "package/extra.py" if extra else entry.ENTRY_PATH
            blobs[path], roles[path] = b"# changed or extra unapproved source\n", "python"
            inventory = parse_value(inventory_dict(blobs, roles))
            fixture.inputs = replace(fixture.inputs, inventory=inventory,
                                     blobs=MappingProxyType({"inventory.json": inventory.raw, **blobs}))
            fake = FakePosix(complete_observations(fixture))
            self.assert_error("UNAPPROVED_PYTHON_SOURCE", self.read, fake, fixture)
            self.assertEqual(fake.fds, {})

    def test_package_extension_shadowing_is_rejected_before_any_import(self):
        for path, role in (("package/systemd_memory_runtime/__main__.so", "data"),
                           ("package/systemd_memory_runtime/__init__.so", "elf")):
            fixture = complete_fixture()
            blobs, roles = dict(fixture.blobs), dict(fixture.roles)
            blobs[path], roles[path] = b"unapproved extension fixture", role
            inventory = parse_value(inventory_dict(blobs, roles))
            fixture.inputs = replace(fixture.inputs, inventory=inventory,
                                     blobs=MappingProxyType({"inventory.json": inventory.raw, **blobs}))
            with patch.object(importlib, "import_module") as importer:
                with self.assertRaises(entry.BootstrapError):
                    self.read(FakePosix(complete_observations(fixture)), fixture)
            importer.assert_not_called()

    def test_changed_scope_yaml_manifest_or_elf_cannot_be_approved_by_inventory(self):
        for path in (entry.SCOPE_PATH, entry.YAML_PATH, entry.SOURCE_MANIFEST_PATH, entry.ELF_PATH, entry.CONTEXT_PATH):
            fixture = complete_fixture()
            blobs = {**fixture.blobs, path: fixture.blobs[path] + b"changed"}
            inventory = parse_value(inventory_dict(blobs, fixture.roles))
            fixture.inputs = replace(fixture.inputs, inventory=inventory,
                                     blobs=MappingProxyType({"inventory.json": inventory.raw, **blobs}))
            self.assert_error("APPROVED_DATA_PIN", self.read, FakePosix(complete_observations(fixture)), fixture)

    def test_inventory_mutation_between_first_read_and_tree_read_is_rejected(self):
        fixture = complete_fixture()
        altered = {**fixture.inputs.blobs, "inventory.json": b"changed second read"}
        with patch.object(entry, "_read_single_protected_file", return_value=fixture.inputs.inventory.raw), \
                patch.object(entry, "_read_posix_tree", return_value=MappingProxyType(altered)), \
                patch.object(entry, "_parse_approval") as approval_mock:
            self.assert_error("INVENTORY_CHANGED", entry.read_protected_inputs, ROOT,
                              inventory_sha256=fixture.inputs.inventory.sha256,
                              approval_sha256=fixture.inputs.approval_sha256)
        approval_mock.assert_not_called()

    def test_missing_approval_is_rejected_after_exact_tree_read(self):
        fixture = complete_fixture()
        blobs = {path: blob for path, blob in fixture.blobs.items() if path != entry.APPROVAL_PATH}
        roles = {path: role for path, role in fixture.roles.items() if path != entry.APPROVAL_PATH}
        inventory = parse_value(inventory_dict(blobs, roles))
        fixture.inputs = replace(fixture.inputs, inventory=inventory,
                                 blobs=MappingProxyType({"inventory.json": inventory.raw, **blobs}))
        self.assert_error("EXTERNAL_APPROVAL_MISSING", self.read, FakePosix(complete_observations(fixture)), fixture)

    def test_first_inventory_short_extra_byte_stat_change_and_acl_rejections_close_fds(self):
        fixture = complete_fixture()
        inventory_path = ROOT + "/inventory.json"
        scenarios = (("short", "FILE_SIZE"), ("extra", "FILE_SIZE"),
                     ("stat", "NODE_CHANGED_DURING_READ"), ("acl", "ACL_FORBIDDEN"),
                     ("symlink", "PROTECTED_TREE_UNAVAILABLE"), ("hardlink", "FILE_HARDLINK"))
        for change, code in scenarios:
            fake = FakePosix(complete_observations(fixture))
            if change in ("short", "extra"):
                fake.read_override[inventory_path] = fixture.inputs.inventory.raw[:-1] if change == "short" else fixture.inputs.inventory.raw + b"x"
            elif change == "stat":
                fake.change_at[inventory_path] = 3
            elif change == "acl":
                fake.nodes[inventory_path] = replace(fake.nodes[inventory_path], acl_names=("security.capability",))
            elif change == "symlink":
                fake.nodes[inventory_path] = replace(fake.nodes[inventory_path], kind="symlink")
            else:
                fake.nodes[inventory_path] = replace(fake.nodes[inventory_path], nlink=2)
            with self.subTest(change=change):
                self.assert_error(code, self.read, fake, fixture)
                self.assertEqual(fake.fds, {})
                self.assertEqual(set(fake.closed), set(fake.opened))

    def test_refresh_rejects_caller_constructed_changed_snapshot(self):
        fixture = complete_fixture()
        altered = replace(fixture.inputs, blobs=MappingProxyType({**fixture.inputs.blobs, entry.SPEC_PATH: b"forged"}))
        with patch.object(entry, "read_protected_inputs", return_value=fixture.inputs):
            self.assert_error("PROTECTED_INPUTS_CHANGED", entry._refresh_inputs, altered)
        self.assert_error("PROTECTED_INPUTS_REQUIRED", entry._refresh_inputs, object())


class ObservedIdentityTests(BootstrapAssertions):
    def observe(self, database=None, fixture=None):
        database = FakeIdentityDatabase() if database is None else database
        fixture = complete_fixture() if fixture is None else fixture
        def policy_reader(path, **kwargs):
            raw = fixture.policy[path]
            return raw if kwargs.get("_retain", True) else (len(raw), digest(raw))
        with patch.dict(sys.modules, {"pwd": database.pwd, "grp": database.grp}), \
                patch.object(entry.os, "getgrouplist", database.getgrouplist, create=True), \
                patch.object(entry, "_read_single_protected_file", side_effect=policy_reader):
            return entry._observe_identity(fixture.approval)

    def test_primary_gid_is_observed_and_excluded_only_from_supplementary_gids(self):
        database = FakeIdentityDatabase()
        self.assertEqual(self.observe(database), entry.LoadIdentity(10001, 10001, (), ()))
        database.getgrouplist.assert_called_once_with("fixture-load", 10001)
        database.pwd.getpwuid.assert_called_once_with(10001)
        database.pwd.getpwnam.assert_called_once_with("fixture-load")
        database.grp.getgrgid.assert_called_once_with(10001)

    def test_extra_groups_missing_primary_and_boolean_group_are_rejected(self):
        for groups, code in (([10001, 20001], "SUPPLEMENTARY_GROUPS_FORBIDDEN"),
                             ([10001, 27], "SUPPLEMENTARY_GROUPS_FORBIDDEN"),
                             ([], "OBSERVED_GROUPS"), ([20001], "SUPPLEMENTARY_GROUPS_FORBIDDEN")):
            database = FakeIdentityDatabase()
            database.grouplist = groups
            self.assert_error(code, self.observe, database)
        database = FakeIdentityDatabase()
        fixture = complete_fixture()
        database.user.pw_gid = 1
        database.groups["fixture-load"].gr_gid = 1
        database.grouplist = [True]
        fixture.approval["identity"]["gid"] = 1
        self.assert_error("IDENTITY_INTEGER", self.observe, database, fixture)

    def test_administrative_primary_or_group_database_membership_is_rejected(self):
        database = FakeIdentityDatabase()
        fixture = complete_fixture()
        database.user.pw_gid = 27
        database.grouplist = [27]
        fixture.approval["identity"]["gid"] = 27
        self.assert_error("ADMIN_PRIMARY_GROUP", self.observe, database, fixture)
        database = FakeIdentityDatabase()
        database.groups["docker"].gr_mem = ["fixture-load"]
        self.assert_error("ADMINISTRATIVE_CHANNEL", self.observe, database)

    def test_unavailable_or_changed_account_is_rejected(self):
        for failure in (KeyError("fixture missing"), OSError("fixture NSS unavailable"), AttributeError("fixture API missing")):
            database = FakeIdentityDatabase()
            database.getgrouplist.side_effect = failure
            self.assert_error("LOAD_ACCOUNT_UNAVAILABLE", self.observe, database)
        for field, value in (("pw_dir", "/root"), ("pw_shell", "/bin/bash"), ("pw_name", "different")):
            database = FakeIdentityDatabase()
            setattr(database.user, field, value)
            with self.subTest(field=field):
                with self.assertRaises(entry.BootstrapError):
                    self.observe(database)

    def test_remote_duplicate_or_missing_nss_sources_are_rejected_before_account_lookup(self):
        for data in (b"passwd: files systemd\ngroup: files\n", b"passwd: files\ngroup: ldap\n",
                     b"passwd: files\npasswd: files\ngroup: files\n", b"passwd: files\n"):
            fixture = complete_fixture()
            fixture.policy["/etc/nsswitch.conf"] = data
            for pin in fixture.approval["identity"]["policy_files"]:
                if pin["path"] == "/etc/nsswitch.conf":
                    pin.update(size=len(data), sha256=digest(data))
            database = FakeIdentityDatabase()
            self.assert_error("REMOTE_IDENTITY_SOURCE", self.observe, database, fixture)
            database.pwd.getpwuid.assert_not_called()

    def test_policy_hash_mismatch_precedes_identity_observation(self):
        fixture = complete_fixture()
        fixture.policy["/etc/sudoers"] += b"changed"
        database = FakeIdentityDatabase()
        self.assert_error("IDENTITY_POLICY_CHANGED", self.observe, database, fixture)
        database.pwd.getpwuid.assert_not_called()

    def test_remote_initgroups_source_is_rejected_before_getgrouplist(self):
        for data in (b"passwd: files\ngroup: files\ninitgroups: files sss\n",
                     b"passwd: files\ngroup: files\ninitgroups: files systemd\n"):
            fixture = complete_fixture()
            fixture.policy["/etc/nsswitch.conf"] = data
            for pin in fixture.approval["identity"]["policy_files"]:
                if pin["path"] == "/etc/nsswitch.conf":
                    pin.update(size=len(data), sha256=digest(data))
            database = FakeIdentityDatabase()
            self.assert_error("REMOTE_IDENTITY_SOURCE", self.observe, database, fixture)
            database.getgrouplist.assert_not_called()


class NativeBootstrapDataTests(BootstrapAssertions):
    def arguments(self, fixture=None, **changes):
        fixture = complete_fixture() if fixture is None else fixture
        values = dict(approval_raw=fixture.inputs.approval_raw, approval_sha256=fixture.inputs.approval_sha256,
                      inventory_raw=fixture.inputs.inventory.raw, inventory_sha256=fixture.inputs.inventory.sha256,
                      source_directory="/srv/fixture-ingress", protected_root=ROOT,
                      auxiliary_output_directory="/var/tmp/fixture-output")
        values.update(changes)
        return values

    def test_native_recipe_is_bounded_literal_data_and_python_is_last_clean_exec(self):
        fixture = complete_fixture()
        recipe = entry.build_native_bootstrap(**self.arguments(fixture))
        script = recipe.stdin_script.decode("ascii")
        self.assertEqual(recipe.bootstrap_argv, ("/usr/bin/dash", "-eu"))
        self.assertEqual(recipe.environment, ())
        self.assertEqual(recipe.cwd, "/")
        self.assertEqual(recipe.script_sha256, digest(recipe.stdin_script))
        self.assertLessEqual(len(recipe.stdin_script), entry.MAX_NATIVE_RECIPE_BYTES)
        self.assertEqual(recipe.python_argv[:5], (fixture.approval["interpreter"], "-I", "-S", "-B", ROOT + "/" + entry.ENTRY_PATH))
        self.assertIn(fixture.inputs.inventory.sha256, recipe.python_argv)
        self.assertIn(fixture.inputs.approval_sha256, recipe.python_argv)
        self.assertEqual(script.count("\nexec "), 1)
        self.assertTrue(script.splitlines()[-1].startswith("exec /usr/bin/env -i LANG=C.UTF-8 LC_ALL=C.UTF-8 "))
        self.assertTrue(script.splitlines()[-1].endswith(" < /dev/null"))
        self.assertIn("set -C\n", script)
        self.assertIn("/usr/bin/mkdir -m 0700 -- '" + ROOT + "' || die", script)
        self.assertIn("iflag=nofollow,nonblock,count_bytes", script)
        self.assertIn("security[.]capability", script)
        self.assertIn("u=$(/usr/bin/stat -c %u -- \"$1\") || die", script)
        self.assertIn("l=$(/usr/bin/stat -c %h -- \"$1\") || die", script)
        self.assertIn("z=$(/usr/bin/stat -c %s -- \"$1\") || die", script)
        self.assertNotRegex(script, r"/usr/bin/find[^\n]*?(?<!\|)\|(?!\|)")
        self.assertIn("n=$(/usr/bin/find '/srv/fixture-ingress' -print) || die", script)
        for forbidden in ("eval ", "source ", "sudo ", "systemctl ", "mkdir -p", "--preserve", "cp -a", "chown ", "chmod "):
            self.assertNotIn(forbidden, script)
        before_exec = script.rsplit("\nexec ", 1)[0]
        for item in fixture.approval["python_files"] + fixture.approval["startup_files"]:
            self.assertIn(item["sha256"], before_exec)

    def test_shell_and_hash_injection_or_control_overlap_are_rejected_as_data(self):
        for change in ({"source_directory": "/safe/$(id)"}, {"protected_root": "/safe/'x"},
                       {"auxiliary_output_directory": "/safe/x\nexec"}, {"source_directory": "-option"},
                       {"approval_sha256": "0" * 64 + "';exec id"},
                       {"protected_root": "/srv/fixture-ingress/subdirectory"},
                       {"auxiliary_output_directory": ROOT}, {"auxiliary_output_directory": "/usr"}):
            with self.subTest(change=change):
                with self.assertRaises(entry.BootstrapError):
                    entry.build_native_bootstrap(**self.arguments(**change))

    def test_unresolved_approval_or_unapproved_extension_cannot_generate_recipe(self):
        fixture = complete_fixture()
        fixture.approval["authorization_ref"] = "PENDING_FIXTURE"
        raw = encode_inventory(fixture.approval)
        self.assert_error("APPROVAL_UNRESOLVED", entry.build_native_bootstrap,
                          **self.arguments(approval_raw=raw, approval_sha256=digest(raw)))
        fixture = complete_fixture()
        blobs, roles = dict(fixture.blobs), dict(fixture.roles)
        blobs["package/systemd_memory_runtime/__main__.so"] = b"unapproved fixture"
        roles["package/systemd_memory_runtime/__main__.so"] = "data"
        inventory = parse_value(inventory_dict(blobs, roles))
        with self.assertRaises(entry.BootstrapError):
            entry.build_native_bootstrap(**self.arguments(fixture, inventory_raw=inventory.raw, inventory_sha256=inventory.sha256))


class BoundMainTests(BootstrapAssertions):
    def bind(self, assembled):
        with patch.object(entry, "_refresh_inputs", return_value=assembled.fixture.inputs), \
                patch.dict(entry._owned_bindings, {id(assembled.binding): assembled.binding}), \
                patch.object(entry, "_bound_main_created", set()):
            return entry.make_bound_main(assembled.binding)

    def test_binding_captures_original_main_and_forwards_only_two_keyword_hooks(self):
        assembled = fake_binding()
        original = assembled.central.main
        bound = self.bind(assembled)
        assembled.central.main = Mock(side_effect=AssertionError("Replacement main must never run"))
        sink, abort = Mock(), Mock()
        with patch.object(entry, "_refresh_inputs", return_value=assembled.fixture.inputs):
            self.assertEqual(bound(evidence_sink=sink, abort_requested=abort), 0)
        original.assert_called_once_with(["run", "--spec", ROOT + "/" + entry.SPEC_PATH,
                                         "--source-elf", ROOT + "/" + entry.ELF_PATH],
                                        evidence_sink=sink, abort_requested=abort)
        assembled.central.main.assert_not_called()
        sink.assert_not_called()
        abort.assert_not_called()

    def test_single_invocation_is_consumed_after_success_failure_or_bad_hooks(self):
        for failure in (None, RuntimeError("invented main failure"), "bad-hooks"):
            assembled = fake_binding()
            if isinstance(failure, Exception):
                assembled.central.main.side_effect = failure
            bound = self.bind(assembled)
            with patch.object(entry, "_refresh_inputs", return_value=assembled.fixture.inputs):
                if failure == "bad-hooks":
                    self.assert_error("REVIEWED_HOOKS_REQUIRED", bound, evidence_sink=False, abort_requested=None)
                elif failure is None:
                    self.assertEqual(bound(evidence_sink=Mock(), abort_requested=Mock()), 0)
                else:
                    with self.assertRaises(RuntimeError):
                        bound(evidence_sink=Mock(), abort_requested=Mock())
                self.assert_error("BOUND_MAIN_ALREADY_INVOKED", bound, evidence_sink=Mock(), abort_requested=Mock())
            self.assertEqual(assembled.central.main.call_count, 0 if failure == "bad-hooks" else 1)

    def test_refresh_failure_prevents_call_and_consumes_invocation(self):
        assembled = fake_binding()
        bound = self.bind(assembled)
        with patch.object(entry, "_refresh_inputs", side_effect=entry.BootstrapError("PROTECTED_INPUTS_CHANGED")):
            self.assert_error("PROTECTED_INPUTS_CHANGED", bound, evidence_sink=Mock(), abort_requested=Mock())
        with patch.object(entry, "_refresh_inputs", return_value=assembled.fixture.inputs):
            self.assert_error("BOUND_MAIN_ALREADY_INVOKED", bound, evidence_sink=Mock(), abort_requested=Mock())
        assembled.central.main.assert_not_called()

    def test_arbitrary_binding_paths_callables_and_positional_hooks_are_not_admitted(self):
        self.assert_error("SCOPE_SPEC_BINDING_REQUIRED", entry.make_bound_main, object())
        assembled = fake_binding()
        bound = self.bind(assembled)
        with self.assertRaises(TypeError):
            bound(Mock(), Mock())
        for keyword in ("main", "clock_us", "consumer", "spec_path", "source_elf_path", "preflight_fn", "run_fn"):
            with self.assertRaises(TypeError):
                bound(evidence_sink=Mock(), abort_requested=Mock(), **{keyword: Mock()})
        assembled.central.main.assert_not_called()

    def test_unregistered_binding_and_second_factory_call_cannot_create_main(self):
        assembled = fake_binding()
        self.assert_error("UNBOUND_SCOPE_SPEC", entry.make_bound_main, assembled.binding)
        with patch.object(entry, "_refresh_inputs", return_value=assembled.fixture.inputs), \
                patch.dict(entry._owned_bindings, {id(assembled.binding): assembled.binding}), \
                patch.object(entry, "_bound_main_created", set()):
            entry.make_bound_main(assembled.binding)
            self.assert_error("BOUND_MAIN_ALREADY_CREATED", entry.make_bound_main, assembled.binding)
        assembled.central.main.assert_not_called()


@contextmanager
def mocked_component_loader(assembled, *, wrapper_mutates_main=False):
    """Mock every central/wrapper loader; no fixture source bytes are executed."""
    fixture = assembled.fixture
    original_calls = Mock(return_value=0)
    def original_main(argv, *, evidence_sink, abort_requested):
        return original_calls(argv, evidence_sink=evidence_sink, abort_requested=abort_requested)
    original_main.__module__ = "systemd_memory_runtime.__main__"
    original_main.__code__ = original_main.__code__.replace(co_filename=ROOT + "/package/systemd_memory_runtime/__main__.py")
    assembled.central.main = original_main
    assembled.original_calls = original_calls
    assembled.original_function = original_main
    assembled.original_clock = assembled.central.monotonic_us
    package = ModuleType("systemd_memory_runtime")
    package.__file__ = ROOT + "/package/systemd_memory_runtime/__init__.py"
    package.__path__ = [ROOT + "/package/systemd_memory_runtime"]
    assembled.package = package
    loaders = {}
    def execute(module):
        if module is assembled.wrapper and wrapper_mutates_main:
            assembled.central.main = Mock(side_effect=AssertionError("Wrapper replacement must not be selected"))
            assembled.central.monotonic_us = Mock(side_effect=AssertionError("Wrapper replacement clock must not be selected"))
    def create_spec(name, path, **kwargs):
        loader = SimpleNamespace(exec_module=Mock(side_effect=execute))
        loaders[name] = loader
        return SimpleNamespace(name=name, loader=loader, origin=path)
    def create_module(spec):
        return assembled.wrapper if spec.name == "_elogistix_reviewed_pilot" else package
    def import_module(name):
        module = {"systemd_memory_runtime.__main__": assembled.central,
                  "systemd_memory_runtime.contracts": assembled.contracts}[name]
        sys.modules[name] = module
        return module
    def read_startup(path, **kwargs):
        raw = fixture.startup[path]
        return raw if kwargs.get("_retain", True) else (len(raw), digest(raw))
    with ExitStack() as stack:
        stack.enter_context(patch.dict(sys.modules, {}))
        # Invented source bytes cannot stand in for the actual sealed wrapper.
        # This explicit test-only pin change never affects the production source.
        stack.enter_context(patch.object(entry, "REVIEWED_WRAPPER_V9_SHA256",
                                        digest(fixture.blobs[entry.WRAPPER_PATH])))
        stack.enter_context(patch.object(sys, "path", [entry.VM_ABSENT_STARTUP_ZIP, *entry.VM_STDLIB_PATHS]))
        stack.enter_context(patch.object(entry, "__file__", ROOT + "/" + entry.ENTRY_PATH))
        stack.enter_context(patch.dict(entry._owned_components, {}))
        stack.enter_context(patch.object(sys, "platform", "linux"))
        stack.enter_context(patch.object(sys, "flags", SimpleNamespace(isolated=1, no_site=1, dont_write_bytecode=1)))
        stack.enter_context(patch.object(sys, "executable", fixture.approval["interpreter"]))
        stack.enter_context(patch.dict(os.environ, dict(entry.EXPECTED_ENVIRONMENT), clear=True))
        stack.enter_context(patch.object(os, "getuid", return_value=0, create=True))
        stack.enter_context(patch.object(os, "geteuid", return_value=0, create=True))
        stack.enter_context(patch.object(os, "getcwd", return_value=ROOT))
        assembled.refresh = stack.enter_context(patch.object(entry, "_refresh_inputs", return_value=fixture.inputs))
        assembled.startup_reader = stack.enter_context(patch.object(entry, "_read_single_protected_file_os", side_effect=read_startup))
        assembled.spec_factory = stack.enter_context(patch.object(importlib.util, "spec_from_file_location", side_effect=create_spec))
        assembled.module_factory = stack.enter_context(patch.object(importlib.util, "module_from_spec", side_effect=create_module))
        assembled.importer = stack.enter_context(patch.object(importlib, "import_module", side_effect=import_module))
        assembled.loaders = loaders
        yield assembled


class ReviewedComponentLoaderTests(BootstrapAssertions):
    def test_rejected_v8_is_blocked_under_v9_or_matching_pin_before_startup_reads_or_imports(self):
        rejected_hash = "3f49b50ae37679334b2c439ecdefec252071f54646c16b2c90337137014d9983"
        self.assertIs(type(entry.REJECTED_SUPERVISOR_SHA256), frozenset)
        self.assertIn(rejected_hash, entry.REJECTED_SUPERVISOR_SHA256)
        self.assertEqual(entry.REVIEWED_WRAPPER_V8_SHA256, rejected_hash)
        approved_hash = entry.REVIEWED_WRAPPER_V9_SHA256
        self.assertNotIn(approved_hash, entry.REJECTED_SUPERVISOR_SHA256)
        for accepted_pin in (approved_hash, rejected_hash):
            assembled = fake_components()
            inventory_mapping = json.loads(assembled.fixture.inputs.inventory.raw)
            for item in inventory_mapping["files"]:
                if item["path"] == entry.WRAPPER_PATH:
                    item["sha256"] = rejected_hash
            # Only inventory data is replaced; no real wrapper bytes are retrieved,
            # imported or executed. Mocked refresh is explicit and returns this data.
            assembled.fixture.inputs = replace(assembled.fixture.inputs,
                                               inventory=parse_value(inventory_mapping))
            with mocked_component_loader(assembled), patch.object(entry, "REVIEWED_WRAPPER_V9_SHA256", accepted_pin):
                self.assertEqual(next(item.sha256 for item in assembled.fixture.inputs.inventory.files
                                      if item.path == entry.WRAPPER_PATH), rejected_hash)
                with self.subTest(accepted_pin=accepted_pin):
                    self.assert_error("WRAPPER_SINGLE_INVOCATION_DELTA_REVIEW_REQUIRED",
                                      entry.load_reviewed_components, assembled.fixture.inputs)
                assembled.refresh.assert_called_once_with(assembled.fixture.inputs)
                assembled.startup_reader.assert_not_called()
                assembled.spec_factory.assert_not_called()
                assembled.module_factory.assert_not_called()
                assembled.importer.assert_not_called()
                assembled.original_calls.assert_not_called()

    def test_final_v9_pin_is_fixed_and_mismatch_precedes_all_startup_reads_or_imports(self):
        self.assertEqual(entry.REVIEWED_WRAPPER_V9_SHA256,
                         "a7c3d0ddca8d10047426da8ba591169fe0387baf531882def3a44386bbaf4208")
        assembled = fake_components()
        with mocked_component_loader(assembled), patch.object(entry, "REVIEWED_WRAPPER_V9_SHA256", "0" * 64):
            self.assert_error("REVIEWED_WRAPPER_PIN", entry.load_reviewed_components, assembled.fixture.inputs)
            assembled.startup_reader.assert_not_called()
            assembled.spec_factory.assert_not_called()
            assembled.module_factory.assert_not_called()
            assembled.importer.assert_not_called()

    def test_matching_v9_inventory_metadata_reaches_only_mocked_loader_stage(self):
        approved_hash = entry.REVIEWED_WRAPPER_V9_SHA256
        assembled = fake_components()
        inventory_mapping = json.loads(assembled.fixture.inputs.inventory.raw)
        for item in inventory_mapping["files"]:
            if item["path"] == entry.WRAPPER_PATH:
                item["sha256"] = approved_hash
        # A loader-stage unit test, never a claim that invented fixture bytes
        # hash to the sealed owner source. Every protected refresh/import is mocked.
        assembled.fixture.inputs = replace(assembled.fixture.inputs,
                                           inventory=parse_value(inventory_mapping))
        with mocked_component_loader(assembled), patch.object(entry, "REVIEWED_WRAPPER_V9_SHA256", approved_hash):
            result = entry.load_reviewed_components(assembled.fixture.inputs)
            self.assertIs(result.inputs, assembled.fixture.inputs)
            self.assertIs(result.wrapper, assembled.wrapper)
            self.assertIs(entry._owned_components[id(result)], result)
            self.assertEqual(assembled.refresh.call_count, 2)
            self.assertEqual(assembled.startup_reader.call_count, len(assembled.fixture.approval["startup_files"]))
            assembled.spec_factory.assert_any_call("_elogistix_reviewed_pilot", ROOT + "/" + entry.WRAPPER_PATH)
            self.assertEqual(assembled.importer.call_args_list,
                             [unittest.mock.call("systemd_memory_runtime.__main__"),
                              unittest.mock.call("systemd_memory_runtime.contracts")])
            assembled.original_calls.assert_not_called()

    def test_fixed_paths_original_main_and_clock_are_captured_before_wrapper_runs(self):
        assembled = fake_components()
        with mocked_component_loader(assembled, wrapper_mutates_main=True):
            components = entry.load_reviewed_components(assembled.fixture.inputs)
            self.assertIs(components.original_main, assembled.original_function)
            self.assertIs(components.clock_us, assembled.original_clock)
            self.assertIs(components.wrapper, assembled.wrapper)
            self.assertIs(components.contracts, assembled.contracts)
            self.assertEqual(sys.path, list(entry.VM_STDLIB_PATHS) + [ROOT + "/package"])
            self.assertEqual(assembled.importer.call_args_list,
                             [unittest.mock.call("systemd_memory_runtime.__main__"),
                              unittest.mock.call("systemd_memory_runtime.contracts")])
            assembled.spec_factory.assert_any_call("_elogistix_reviewed_pilot", ROOT + "/" + entry.WRAPPER_PATH)
            assembled.spec_factory.assert_any_call("systemd_memory_runtime",
                                                   ROOT + "/package/systemd_memory_runtime/__init__.py",
                                                   submodule_search_locations=[ROOT + "/package/systemd_memory_runtime"])
            self.assertEqual(assembled.refresh.call_count, 2)
            assembled.original_calls.assert_not_called()

    def test_closed_startup_flags_interpreter_environment_cwd_and_uid_precede_imports(self):
        cases = (("flags", "PYTHON_STARTUP_FLAGS"), ("interpreter", "PYTHON_INTERPRETER_CHANGED"),
                 ("environment", "AMBIENT_ENVIRONMENT"), ("cwd", "CONTROL_CWD_CHANGED"),
                 ("uid", "CONTROL_AUTHORITY_REQUIRED"), ("entry", "ENTRY_OUTSIDE_PROTECTED_TREE"),
                 ("initial-path", "INITIAL_STARTUP_PATH_CHANGED"))
        for change, code in cases:
            assembled = fake_components()
            with mocked_component_loader(assembled), ExitStack() as stack:
                if change == "flags":
                    stack.enter_context(patch.object(sys, "flags", SimpleNamespace(isolated=0, no_site=1, dont_write_bytecode=1)))
                elif change == "interpreter":
                    stack.enter_context(patch.object(sys, "executable", "/editable/python"))
                elif change == "environment":
                    stack.enter_context(patch.dict(os.environ, {"PYTHONPATH": "/editable"}))
                elif change == "cwd":
                    stack.enter_context(patch.object(os, "getcwd", return_value="/editable"))
                elif change == "uid":
                    stack.enter_context(patch.object(os, "geteuid", return_value=10001))
                elif change == "entry":
                    stack.enter_context(patch.object(entry, "__file__", "/editable/entry.py"))
                else:
                    stack.enter_context(patch.object(sys, "path", ["/editable", *entry.VM_STDLIB_PATHS]))
                self.assert_error(code, entry.load_reviewed_components, assembled.fixture.inputs)
                assembled.importer.assert_not_called()
                assembled.spec_factory.assert_not_called()

    def test_startup_pin_mismatch_and_preloaded_runtime_are_rejected_before_loader(self):
        assembled = fake_components()
        with mocked_component_loader(assembled):
            assembled.startup_reader.side_effect = None
            assembled.startup_reader.return_value = (1, "0" * 64)
            self.assert_error("STARTUP_CLOSURE_CHANGED", entry.load_reviewed_components, assembled.fixture.inputs)
            assembled.importer.assert_not_called()
        for name in ("_elogistix_reviewed_pilot", "systemd_memory_runtime", "systemd_memory_runtime.__main__"):
            assembled = fake_components()
            with mocked_component_loader(assembled), patch.dict(sys.modules, {name: object()}):
                self.assert_error("PRELOADED_RUNTIME_MODULE", entry.load_reviewed_components, assembled.fixture.inputs)
                assembled.importer.assert_not_called()
                assembled.spec_factory.assert_not_called()

    def test_wrong_main_origin_fails_before_wrapper_and_cleans_loaded_aliases(self):
        for attribute in ("module", "filename"):
            assembled = fake_components()
            with mocked_component_loader(assembled):
                if attribute == "module":
                    assembled.original_function.__module__ = "unreviewed"
                else:
                    assembled.original_function.__code__ = assembled.original_function.__code__.replace(co_filename="/editable/main.py")
                self.assert_error("ORIGINAL_MAIN_ORIGIN", entry.load_reviewed_components, assembled.fixture.inputs)
                assembled.loaders["_elogistix_reviewed_pilot"].exec_module.assert_not_called()
                self.assertFalse(any(name == "_elogistix_reviewed_pilot" or name.startswith("systemd_memory_runtime")
                                     for name in sys.modules))

    def test_package_origin_and_uninventoried_submodule_are_rejected_and_aliases_removed(self):
        for change, code in (("package", "IMPORT_OUTSIDE_CONTROL_TREE"), ("submodule", "UNINVENTORIED_IMPORT")):
            assembled = fake_components()
            with mocked_component_loader(assembled):
                if change == "package":
                    assembled.package.__file__ = "/editable/__init__.py"
                else:
                    extra = ModuleType("systemd_memory_runtime.extra")
                    extra.__file__ = ROOT + "/package/systemd_memory_runtime/extra.py"
                    def execute(module):
                        if module is assembled.wrapper:
                            sys.modules[extra.__name__] = extra
                    assembled.spec_factory.side_effect = lambda name, path, **kwargs: SimpleNamespace(
                        name=name, origin=path, loader=SimpleNamespace(exec_module=Mock(side_effect=execute)))
                self.assert_error(code, entry.load_reviewed_components, assembled.fixture.inputs)
                self.assertFalse(any(name == "_elogistix_reviewed_pilot" or name.startswith("systemd_memory_runtime")
                                     for name in sys.modules))


class ScopeSpecBindingTests(BootstrapAssertions):
    def bind(self, assembled):
        with patch.object(entry, "_refresh_inputs", return_value=assembled.fixture.inputs), \
                patch.dict(entry._owned_components, {id(assembled.components): assembled.components}), \
                patch.dict(entry._owned_bindings, {}), \
                patch.object(entry, "_observe_identity", return_value=entry.LoadIdentity(10001, 10001, (), ())):
            return entry.bind_scope_spec_identity(assembled.fixture.inputs, assembled.components)

    def test_owner_validators_receive_exact_bytes_and_primary_gid_is_in_spec(self):
        assembled = fake_components()
        binding = self.bind(assembled)
        self.assertEqual(binding.spec.load_groups, (binding.identity.gid,))
        assembled.wrapper.extract_approved_scope.assert_called_once_with(assembled.fixture.blobs[entry.SCOPE_PATH])
        kwargs = assembled.wrapper.validate_scope.call_args.kwargs
        self.assertEqual(kwargs["expected_branch"], assembled.fixture.approval["branch"])
        self.assertEqual(kwargs["expected_source_commit"], assembled.fixture.approval["source_commit"])
        self.assertEqual(kwargs["yaml_bytes"], assembled.fixture.blobs[entry.YAML_PATH])
        self.assertEqual(kwargs["manifest_bytes"], assembled.fixture.blobs[entry.SOURCE_MANIFEST_PATH])
        self.assertEqual(kwargs["manifest_keys"], entry.SOURCE_MANIFEST_KEYS)
        self.assertEqual(kwargs["entry_keys"], entry.SOURCE_ENTRY_KEYS)
        self.assertEqual(set(kwargs["source_files"]), {pin["path"] for pin in assembled.fixture.approval["python_files"]})
        self.assertEqual(binding.scope_receipt, {"status": "CONSISTENT_DATA_ONLY", "runtime_ready": False})
        with self.assertRaises(TypeError):
            binding.scope_receipt["runtime_ready"] = True
        self.assertIn(unittest.mock.call(assembled.fixture.blobs[entry.SPEC_PATH],
                                        max_bytes=assembled.contracts.MAX_PACKET_BYTES,
                                        max_depth=assembled.contracts.MAX_DEPTH), assembled.wrapper.parse_strict_json.call_args_list)

    def test_empty_groups_wrong_uid_gid_scope_or_elf_cannot_bind(self):
        changes = (({"load_groups": []}, "SPEC_IDENTITY_MISMATCH"),
                   ({"load_uid": 10002}, "SPEC_IDENTITY_MISMATCH"), ({"load_gid": 10002}, "SPEC_IDENTITY_MISMATCH"),
                   ({"scope_ref": "different"}, "SPEC_SCOPE_MISMATCH"),
                   ({"payload_expected_sha256": "0" * 64}, "SPEC_ELF_MISMATCH"))
        for values, code in changes:
            assembled = fake_components()
            mapping = {**assembled.fixture.spec_mapping, **values}
            assembled.contracts.RunSpec.from_mapping.side_effect = lambda ignored, mapping=mapping: SimpleNamespace(
                **{**mapping, "load_groups": tuple(mapping["load_groups"])})
            with self.subTest(values=values):
                self.assert_error(code, self.bind, assembled)

    def test_authorization_ref_and_original_work_deadline_cannot_be_changed(self):
        assembled = fake_components()
        assembled.wrapper.extract_approved_scope.return_value.values["authorization_ref"] = "different"
        self.assert_error("SCOPE_AUTHORIZATION_BINDING", self.bind, assembled)
        for now in (999, 50_001_000, True):
            assembled = fake_components()
            assembled.central.monotonic_us.return_value = now
            self.assert_error("ORIGINAL_WORK_DEADLINE", self.bind, assembled)

    def test_manifest_cannot_reference_dynamic_spec_or_omit_approved_python(self):
        for kind, code in (("dynamic", "SOURCE_DYNAMIC_REFERENCE"), ("missing", "SOURCE_MANIFEST_MISSING_PYTHON")):
            assembled = fake_components()
            manifest = json.loads(assembled.fixture.blobs[entry.SOURCE_MANIFEST_PATH])
            if kind == "dynamic":
                manifest["files"].append({"path": entry.SPEC_PATH, "size": len(assembled.fixture.blobs[entry.SPEC_PATH]), "sha256": "0" * 64})
            else:
                manifest["files"].pop()
            altered = MappingProxyType({**assembled.fixture.inputs.blobs, entry.SOURCE_MANIFEST_PATH: encode_inventory(manifest)})
            assembled.fixture.inputs = replace(assembled.fixture.inputs, blobs=altered)
            assembled.components = replace(assembled.components, inputs=assembled.fixture.inputs)
            self.assert_error(code, self.bind, assembled)
            assembled.wrapper.validate_scope.assert_not_called()

    def test_components_must_share_the_exact_refreshed_inputs(self):
        assembled = fake_components()
        assembled.components = replace(assembled.components, inputs=replace(assembled.fixture.inputs, root="/different"))
        self.assert_error("COMPONENT_INPUTS_CHANGED", self.bind, assembled)


def supervision_fixture(binding, *, incomplete=False, pending=()):
    """Invented V8 data shape; never a receipt of an actual runtime invocation."""
    capture = {"retained_bytes": 0, "observed_bytes": 0, "discarded_observed_bytes": 0,
               "eof": True, "overflow": False, "sha256_retained": digest(b""),
               "sha256_full": digest(b""), "status": "COMPLETE", "reason": None}
    consumer = {"run": binding.spec.run, "cleanup_deadline_us": binding.spec.cleanup_deadline_us,
                "invocation_attempted": True, "exit_code": None, "bound_main_called": False,
                "invocation_error": None, "stdout": dict(capture), "stderr": dict(capture),
                "capture_outcome": "CAPTURE_COMPLETE", "composition_status": "DATA_OBSERVED_ONLY",
                "evidence_delivery_attempted": True, "evidence_acknowledged": True,
                "evidence_bytes": 0, "evidence_sha256": digest(b""), "abort_requested": False,
                "first_failure": None, "authorization_authenticated": False,
                "custody_authenticated": False, "certificate_verified_by_wrapper": False,
                "runtime_ready": False}
    return {"process_exit_code": 0, "process_reaped": True, "capture_outcome": "CAPTURE_COMPLETE",
            "supervision_status": "INCOMPLETE" if incomplete else "DATA_OBSERVED_ONLY",
            "consumer": consumer, "remote_ack_sent": True, "abort_sent": False,
            "control_error": None, "evidence_eof": True, "evidence_frame_consumed": True,
            "evidence_wire_prefix": b"invented-untrusted-wire", "runtime_ready": False,
            "certificate_verified": False, "runtime_child_pid": 4242, "exit_main": 0,
            "child_return": {"exit_main": 0, "remote_acknowledged": True, "bridge_error": None},
            "forced_stop_requested": False, "forced_stop_reaped": False, "forced_stop_error": None,
            "forced_stop_exit_code": None,
            "publication": {"status": "FILES_WRITTEN", "writer_pid": 4343, "writer_reaped": True,
                            "writer_exit_code": 0, "error": None, "durability_guaranteed": False,
                            "custody_authenticated": False},
            "owned_child_reaped": True, "fd_cleanup_complete": True,
            "local_consumer_receipt_scope": "PARENT_CAPTURE_COPY_NO_LOCAL_INVOCATION",
            "pending_owned_children": tuple(pending), "pending_owned_child_pids": [h.pid for h in pending]}


class SupervisionAndEntryTests(BootstrapAssertions):
    def test_supervision_uses_same_run_deadline_clock_and_fd_owner_api(self):
        assembled = fake_binding()
        consumer = object()
        assembled.wrapper.V5InvocationConsumer = Mock(return_value=consumer)
        result = supervision_fixture(assembled.binding)
        assembled.wrapper.supervise_bound = Mock(return_value=result)
        with patch.object(entry, "_refresh_inputs", return_value=assembled.fixture.inputs), \
                patch.dict(entry._owned_bindings, {id(assembled.binding): assembled.binding}), \
                patch.object(entry, "_bound_main_created", set()), \
                patch.object(entry, "_open_auxiliary_output", return_value=901) as output, \
                patch.object(entry, "_prepare_supervision_fds") as prepare, \
                patch.object(entry, "_retained_supervision_returns", []) as retained, \
                patch.object(entry, "_pending_custody_handles", []), \
                patch.object(os, "close") as close:
            actual = entry.run_supervised(assembled.binding, auxiliary_output_directory="/var/tmp/fixture-output")
        self.assertIs(actual, result)
        arguments = assembled.wrapper.V5InvocationConsumer.call_args.kwargs
        self.assertEqual(arguments["run"], assembled.binding.spec.run)
        self.assertEqual(arguments["cleanup_deadline_us"], assembled.binding.spec.cleanup_deadline_us)
        self.assertIs(arguments["clock_us"], assembled.components.clock_us)
        self.assertEqual(arguments["shared_constants"], {"WORK_US": 50_000_000, "CLEANUP_US": 60_000_000,
                                                        "MEMORY_MAX_BYTES": 32 * 1024 * 1024, "TASKS_MAX": 8})
        self.assertEqual(assembled.wrapper.supervise_bound.call_args.args[0], consumer)
        self.assertTrue(callable(assembled.wrapper.supervise_bound.call_args.args[1]))
        self.assertEqual(assembled.wrapper.supervise_bound.call_args.kwargs, {"output_dir_fd": 901})
        output.assert_called_once_with("/var/tmp/fixture-output", assembled.fixture.inputs)
        prepare.assert_called_once_with(901)
        self.assertEqual(retained, [result])
        close.assert_called_once_with(901)
        assembled.central.main.assert_not_called()

    def test_supervisor_failure_closes_output_fd_and_missing_api_prevents_constructor(self):
        assembled = fake_binding()
        assembled.wrapper.V5InvocationConsumer = Mock(return_value=object())
        with patch.dict(entry._owned_bindings, {id(assembled.binding): assembled.binding}):
            self.assert_error("REVIEWED_SUPERVISOR_API_MISSING", entry.run_supervised,
                              assembled.binding, auxiliary_output_directory="/var/tmp/fixture-output")
        assembled.wrapper.V5InvocationConsumer.assert_not_called()
        assembled.wrapper.supervise_bound = Mock(side_effect=RuntimeError("invented supervisor failure"))
        with patch.object(entry, "_refresh_inputs", return_value=assembled.fixture.inputs), \
                patch.dict(entry._owned_bindings, {id(assembled.binding): assembled.binding}), \
                patch.object(entry, "_bound_main_created", set()), \
                patch.object(entry, "_open_auxiliary_output", return_value=901), \
                patch.object(entry, "_prepare_supervision_fds"), patch.object(os, "close") as close:
            with self.assertRaises(RuntimeError):
                entry.run_supervised(assembled.binding, auxiliary_output_directory="/var/tmp/fixture-output")
        close.assert_called_once_with(901)

    def test_return_contract_failure_retains_only_original_handles_and_closes_output(self):
        assembled = fake_binding()
        handle = SimpleNamespace(pid=4242, returncode=None, poll=Mock(), kill=Mock())
        result = supervision_fixture(assembled.binding, incomplete=True, pending=(handle,))
        result["pending_owned_child_pids"] = [9999]
        assembled.wrapper.V5InvocationConsumer = Mock(return_value=object())
        assembled.wrapper.supervise_bound = Mock(return_value=result)
        with patch.object(entry, "_refresh_inputs", return_value=assembled.fixture.inputs), \
                patch.dict(entry._owned_bindings, {id(assembled.binding): assembled.binding}), \
                patch.object(entry, "_bound_main_created", set()), \
                patch.object(entry, "_open_auxiliary_output", return_value=901), \
                patch.object(entry, "_prepare_supervision_fds"), \
                patch.object(entry, "_retained_supervision_returns", []) as retained, \
                patch.object(entry, "_pending_custody_handles", []) as handles, patch.object(os, "close") as close:
            self.assert_error("PENDING_CUSTODY_IDENTITY", entry.run_supervised, assembled.binding,
                              auxiliary_output_directory="/var/tmp/fixture-output")
            self.assertEqual(retained, [result])
            self.assertEqual(handles, [handle])
            self.assertIs(handles[0], handle)
        close.assert_called_once_with(901)
        handle.poll.assert_not_called()
        handle.kill.assert_not_called()

    def test_preparation_failure_prevents_supervisor_and_closes_output(self):
        assembled = fake_binding()
        assembled.wrapper.V5InvocationConsumer = Mock(return_value=object())
        assembled.wrapper.supervise_bound = Mock()
        with patch.object(entry, "_refresh_inputs", return_value=assembled.fixture.inputs), \
                patch.dict(entry._owned_bindings, {id(assembled.binding): assembled.binding}), \
                patch.object(entry, "_bound_main_created", set()), \
                patch.object(entry, "_open_auxiliary_output", return_value=901), \
                patch.object(entry, "_prepare_supervision_fds", side_effect=entry.BootstrapError("STDIN_NOT_DEV_NULL")), \
                patch.object(os, "close") as close:
            self.assert_error("STDIN_NOT_DEV_NULL", entry.run_supervised, assembled.binding,
                              auxiliary_output_directory="/var/tmp/fixture-output")
        assembled.wrapper.supervise_bound.assert_not_called()
        close.assert_called_once_with(901)

    def test_entry_uses_real_assembly_order_and_prints_data_only_metadata_without_handles_or_wire(self):
        assembled = fake_binding()
        argv = ["--root", ROOT, "--inventory-sha256", assembled.fixture.inputs.inventory.sha256,
                "--approval-sha256", assembled.fixture.inputs.approval_sha256,
                "--auxiliary-output-directory", "/var/tmp/fixture-output"]
        for incomplete, expected_status in ((False, 0), (True, 3)):
            result = supervision_fixture(assembled.binding, incomplete=incomplete)
            operations = Mock()
            with patch.object(sys, "platform", "linux"), ExitStack() as stack:
                for name, value in (("read_protected_inputs", assembled.fixture.inputs),
                                    ("load_reviewed_components", assembled.components),
                                    ("bind_scope_spec_identity", assembled.binding), ("run_supervised", result)):
                    operation = stack.enter_context(patch.object(entry, name, return_value=value))
                    operations.attach_mock(operation, name)
                output = io.StringIO()
                with redirect_stdout(output):
                    self.assertEqual(entry.main(argv), expected_status)
            self.assertEqual([call[0] for call in operations.mock_calls],
                             ["read_protected_inputs", "load_reviewed_components", "bind_scope_spec_identity", "run_supervised"])
            metadata = json.loads(output.getvalue())
            self.assertNotIn("pending_owned_children", metadata)
            self.assertNotIn("evidence_wire_prefix", metadata)
            self.assertEqual(metadata["evidence_wire_prefix_bytes"], len(result["evidence_wire_prefix"]))
            self.assertIs(metadata["native_runtime_certified"], False)
            self.assertIs(metadata["runtime_ready"], False)
            self.assertIs(metadata["certificate_verified"], False)

    def test_asus_platform_fails_before_any_read_import_binding_or_supervision(self):
        with patch.object(sys, "platform", "win32"), ExitStack() as stack:
            operations = [stack.enter_context(patch.object(entry, name)) for name in
                          ("read_protected_inputs", "load_reviewed_components", "bind_scope_spec_identity", "run_supervised")]
            output = io.StringIO()
            with redirect_stdout(output):
                self.assertEqual(entry.main(["--anything"]), 3)
            evidence = json.loads(output.getvalue())
            self.assertEqual(evidence["error"], "PLATFORM_NOT_SUPPORTED")
            self.assertIs(evidence["native_runtime_certified"], False)
            for operation in operations:
                operation.assert_not_called()

    def test_entry_rejects_argument_flags_booleans_and_callables_before_reads(self):
        valid = ["--root", ROOT, "--inventory-sha256", "0" * 64, "--approval-sha256", "1" * 64,
                 "--auxiliary-output-directory", "/var/tmp/fixture-output"]
        for values in ([], valid + ["--allow-production"], ["--main", *valid[1:]],
                       [*valid[:1], Mock(), *valid[2:]], [*valid[:1], True, *valid[2:]]):
            with patch.object(sys, "platform", "linux"), patch.object(entry, "read_protected_inputs") as reader:
                output = io.StringIO()
                with redirect_stdout(output):
                    self.assertEqual(entry.main(values), 3)
                self.assertEqual(json.loads(output.getvalue())["error"], "ENTRY_ARGUMENTS")
                reader.assert_not_called()


class SupervisionReturnContractTests(BootstrapAssertions):
    def changed(self, path, value, *, code, incomplete=False):
        assembled = fake_binding()
        result = supervision_fixture(assembled.binding, incomplete=incomplete)
        target = result
        for key in path[:-1]:
            target = target[key]
        target[path[-1]] = value
        self.assert_error(code, entry._validate_supervision_return, result, assembled.binding)

    def test_fd_cleanup_complete_is_mandatory_even_for_incomplete_data(self):
        assembled = fake_binding()
        for incomplete in (False, True):
            result = supervision_fixture(assembled.binding, incomplete=incomplete)
            del result["fd_cleanup_complete"]
            self.assert_error("SUPERVISOR_RESULT_KEYS", entry._validate_supervision_return, result, assembled.binding)

    def test_fd_cleanup_complete_requires_exact_bool(self):
        for value in (0, 1, None, "true", object()):
            self.changed(("fd_cleanup_complete",), value, code="SUPERVISOR_RESULT_TYPE", incomplete=True)

    def test_failed_fd_cleanup_prevents_data_observed_only_but_remains_incomplete_data(self):
        self.changed(("fd_cleanup_complete",), False, code="SUPERVISOR_SUCCESS_INCONSISTENT")
        assembled = fake_binding()
        result = supervision_fixture(assembled.binding, incomplete=True)
        result["fd_cleanup_complete"] = False
        self.assertIs(entry._validate_supervision_return(result, assembled.binding), result)

    def test_exact_shapes_reject_missing_or_extra_fields_at_every_level(self):
        layers = (((), "SUPERVISOR_RESULT_KEYS"), (("child_return",), "CHILD_RETURN_KEYS"),
                  (("publication",), "PUBLICATION_KEYS"), (("consumer",), "CONSUMER_RETURN_KEYS"),
                  (("consumer", "stdout"), "CAPTURE_RETURN_KEYS"),
                  (("consumer", "stderr"), "CAPTURE_RETURN_KEYS"))
        for path, code in layers:
            for change in ("missing", "extra"):
                assembled = fake_binding()
                result = supervision_fixture(assembled.binding)
                target = result
                for key in path:
                    target = target[key]
                if change == "missing":
                    del target[next(iter(target))]
                else:
                    target["invented_extra_field"] = None
                with self.subTest(path=path, change=change):
                    self.assert_error(code, entry._validate_supervision_return, result, assembled.binding)
        assembled = fake_binding()
        for value in (0, object(), [], MappingProxyType(supervision_fixture(assembled.binding))):
            self.assert_error("SUPERVISOR_RESULT_KEYS", entry._validate_supervision_return, value, assembled.binding)

    def test_booleans_in_integer_slots_and_integers_in_boolean_slots_are_rejected(self):
        cases = ((("process_reaped",), 1, "SUPERVISOR_RESULT_TYPE"),
                 (("process_exit_code",), True, "SUPERVISOR_RESULT_TYPE"),
                 (("runtime_child_pid",), True, "SUPERVISOR_RESULT_TYPE"),
                 (("exit_main",), True, "SUPERVISOR_RESULT_TYPE"),
                 (("child_return", "remote_acknowledged"), 1, "CHILD_RETURN_TYPE"),
                 (("publication", "writer_pid"), True, "PUBLICATION_TYPE"),
                 (("publication", "writer_reaped"), 1, "PUBLICATION_TYPE"),
                 (("consumer", "invocation_attempted"), 1, "CONSUMER_RETURN_TYPE"),
                 (("consumer", "exit_code"), False, "CONSUMER_RETURN_TYPE"),
                 (("consumer", "stdout", "retained_bytes"), False, "CAPTURE_RETURN_TYPE"),
                 (("consumer", "stderr", "observed_bytes"), -1, "CAPTURE_RETURN_TYPE"),
                 (("consumer", "stdout", "eof"), 1, "CAPTURE_RETURN_TYPE"))
        for path, value, code in cases:
            with self.subTest(path=path):
                self.changed(path, value, code=code)

    def test_certification_and_custody_bits_remain_exact_false(self):
        paths = [(key,) for key in ("runtime_ready", "certificate_verified")]
        paths += [("consumer", key) for key in ("authorization_authenticated", "custody_authenticated",
                                                "certificate_verified_by_wrapper", "runtime_ready")]
        paths += [("publication", key) for key in ("durability_guaranteed", "custody_authenticated")]
        for path in paths:
            code = ("SUPERVISOR_CERTIFICATION_FORBIDDEN" if len(path) == 1 else
                    "CONSUMER_CERTIFICATION_FORBIDDEN" if path[0] == "consumer" else "PUBLICATION_TYPE")
            for value in (True, 0, None):
                with self.subTest(path=path, value=value):
                    self.changed(path, value, code=code, incomplete=True)

    def test_domains_wire_bound_and_original_run_deadline_are_enforced(self):
        cases = ((("exit_main",), 1, "EXIT_MAIN_DOMAIN"),
                 (("capture_outcome",), "SUCCESS", "SUPERVISOR_STATUS_DOMAIN"),
                 (("supervision_status",), "CERTIFIED", "SUPERVISOR_STATUS_DOMAIN"),
                 (("evidence_wire_prefix",), "not-bytes", "SUPERVISOR_EVIDENCE_BOUND"),
                 (("evidence_wire_prefix",), b"x" * 524301, "SUPERVISOR_EVIDENCE_BOUND"),
                 (("local_consumer_receipt_scope",), "LOCAL_INVOCATION", "SUPERVISOR_PARENT_RECEIPT_SCOPE"),
                 (("consumer", "run"), "different-run", "SUPERVISOR_RUN_DEADLINE_CHANGED"),
                 (("consumer", "cleanup_deadline_us"), 60_001_001, "SUPERVISOR_RUN_DEADLINE_CHANGED"),
                 (("consumer", "cleanup_deadline_us"), True, "SUPERVISOR_RUN_DEADLINE_CHANGED"))
        for path, value, code in cases:
            with self.subTest(path=path):
                self.changed(path, value, code=code, incomplete=True)
        assembled = fake_binding()
        result = supervision_fixture(assembled.binding, incomplete=True)
        result["evidence_wire_prefix"] = b"x" * 524300
        self.assertIs(entry._validate_supervision_return(result, assembled.binding), result)

    def test_parent_exit_or_ack_cannot_masquerade_as_completed_child_evidence(self):
        cases = ((("process_exit_code",), 3), (("process_reaped",), False),
                 (("owned_child_reaped",), False), (("capture_outcome",), "INCOMPLETE"),
                 (("evidence_eof",), False), (("evidence_frame_consumed",), False),
                 (("remote_ack_sent",), False), (("abort_sent",), True),
                 (("control_error",), "invented"), (("child_return",), None),
                 (("child_return", "remote_acknowledged"), False),
                 (("child_return", "bridge_error"), "invented"),
                 (("consumer", "abort_requested"), True), (("consumer", "evidence_acknowledged"), False),
                 (("publication", "status"), "INCOMPLETE"), (("publication", "writer_reaped"), False),
                 (("publication", "writer_exit_code"), None), (("publication", "error"), "invented"),
                 (("consumer", "stdout", "eof"), False), (("consumer", "stderr", "overflow"), True),
                 (("consumer", "stdout", "status"), "INCOMPLETE"))
        for path, value in cases:
            with self.subTest(path=path):
                self.changed(path, value, code="SUPERVISOR_SUCCESS_INCONSISTENT")
        self.changed(("child_return", "exit_main"), 2, code="CHILD_RETURN_TYPE")
        assembled = fake_binding()
        result = supervision_fixture(assembled.binding)
        result.update(exit_main=2, process_exit_code=0)
        result["child_return"]["exit_main"] = 2
        result["consumer"]["exit_code"] = 0
        self.assert_error("SUPERVISOR_SUCCESS_INCONSISTENT", entry._validate_supervision_return,
                          result, assembled.binding)

    def test_parent_invocation_fields_are_data_independent_of_child_success(self):
        assembled = fake_binding()
        for attempt, called, exit_code in ((True, False, None), (False, False, None), (True, True, 3)):
            result = supervision_fixture(assembled.binding)
            result["consumer"].update(invocation_attempted=attempt, bound_main_called=called, exit_code=exit_code)
            self.assertIs(entry._validate_supervision_return(result, assembled.binding), result)
        incomplete = supervision_fixture(assembled.binding, incomplete=True)
        incomplete.update(process_exit_code=None, process_reaped=False, owned_child_reaped=False,
                          exit_main=None, child_return=None, capture_outcome="INCOMPLETE", evidence_eof=False)
        self.assertIs(entry._validate_supervision_return(incomplete, assembled.binding), incomplete)

    def test_pending_custody_accepts_only_exact_original_handles_and_matching_pid_list(self):
        assembled = fake_binding()
        handle = SimpleNamespace(pid=4242, returncode=None, poll=Mock(), kill=Mock())
        result = supervision_fixture(assembled.binding, incomplete=True, pending=(handle,))
        self.assertIs(entry._validate_supervision_return(result, assembled.binding), result)
        handle.poll.assert_not_called()
        handle.kill.assert_not_called()
        cases = (("pending_owned_children", [handle], "PENDING_CUSTODY_TYPE"),
                 ("pending_owned_children", (handle,) * 3, "PENDING_CUSTODY_TYPE"),
                 ("pending_owned_children", (object(),), "PENDING_CUSTODY_HANDLE"),
                 ("pending_owned_child_pids", (4242,), "PENDING_CUSTODY_TYPE"),
                 ("pending_owned_child_pids", [True], "PENDING_CUSTODY_TYPE"),
                 ("pending_owned_child_pids", [9999], "PENDING_CUSTODY_IDENTITY"))
        for key, value, code in cases:
            invalid = supervision_fixture(assembled.binding, incomplete=True, pending=(handle,))
            invalid[key] = value
            self.assert_error(code, entry._validate_supervision_return, invalid, assembled.binding)
        result = supervision_fixture(assembled.binding, incomplete=True, pending=(handle, handle))
        self.assert_error("PENDING_CUSTODY_IDENTITY", entry._validate_supervision_return, result, assembled.binding)
        result = supervision_fixture(assembled.binding, pending=(handle,))
        self.assert_error("SUPERVISOR_SUCCESS_INCONSISTENT", entry._validate_supervision_return, result, assembled.binding)


@contextmanager
def mocked_supervision_fds():
    """Own-process observations represented only by integers and memory objects."""
    signal_module = ModuleType("signal")
    signal_module.SIGCHLD, signal_module.SIG_DFL = 17, 0
    signal_module.getsignal = Mock(return_value=0)
    null = SimpleNamespace(st_mode=stat.S_IFCHR | 0o666, st_rdev=123)
    state = SimpleNamespace(fds={0, 1, 2, 41, 901}, tasks=["10001"], closed=[],
                            stats={0: null, 1: SimpleNamespace(st_mode=stat.S_IFIFO, st_rdev=0), 2: null},
                            null=null, names_override=None, skip_removal=set(), close_error=None,
                            enumerated_closed_fd=10000, fstat_errors={}, enumerations=0,
                            on_enumeration=None)
    def open_probe(path, flags):
        if path != "/proc/self/fd":
            raise AssertionError("Unexpected path; no actual filesystem is observed")
        state.fds.add(99)
        return 99
    def list_directory(path):
        if path == "/proc/self/task":
            return list(state.tasks)
        if path == 99:
            state.enumerations += 1
            if state.on_enumeration is not None:
                state.on_enumeration(state.enumerations)
            if state.names_override is not None:
                return list(state.names_override)
            names = {str(fd) for fd in state.fds}
            if state.enumerated_closed_fd is not None:
                # Faithful Linux observation: listdir's duplicated descriptor
                # was live during enumeration and is closed before return.
                names.add(str(state.enumerated_closed_fd))
            return sorted(names)
        raise AssertionError("Unexpected directory")
    def fstat(fd):
        import errno
        if fd in state.fstat_errors:
            raise state.fstat_errors[fd]
        if fd not in state.fds:
            raise OSError(errno.EBADF, "invented closed descriptor")
        return state.stats.get(fd, SimpleNamespace(st_mode=stat.S_IFDIR, st_rdev=0))
    def close(fd):
        state.closed.append(fd)
        if fd not in state.skip_removal:
            state.fds.discard(fd)
        if fd == 41 and state.close_error is not None:
            raise state.close_error
    with ExitStack() as stack:
        stack.enter_context(patch.dict(sys.modules, {"signal": signal_module}))
        state.listdir = stack.enter_context(patch.object(os, "listdir", side_effect=list_directory))
        state.lstat = stack.enter_context(patch.object(os, "lstat", side_effect=lambda path: state.null))
        state.fstat = stack.enter_context(patch.object(os, "fstat", side_effect=fstat))
        state.open = stack.enter_context(patch.object(os, "open", side_effect=open_probe))
        state.close = stack.enter_context(patch.object(os, "close", side_effect=close))
        for name, value in (("O_DIRECTORY", 0x10000), ("O_NOFOLLOW", 0x20000), ("O_CLOEXEC", 0x80000)):
            stack.enter_context(patch.object(os, name, value, create=True))
        state.signal = signal_module
        yield state


class SupervisionFDHygieneTests(BootstrapAssertions):
    def test_single_thread_default_sigchld_null_stdin_and_pipe_stdio_keep_only_allowlisted_fds(self):
        with mocked_supervision_fds() as state:
            entry._prepare_supervision_fds(901)
            self.assertEqual(state.fds, {0, 1, 2, 901})
            self.assertEqual(state.closed, [41, 99])
            state.lstat.assert_called_once_with("/dev/null")
            self.assertEqual(state.fstat.call_args_list[:3], [unittest.mock.call(0), unittest.mock.call(1), unittest.mock.call(2)])
            self.assertEqual(state.fstat.call_args_list.count(unittest.mock.call(10000)), 2)
            self.assertEqual(state.open.call_args.args, ("/proc/self/fd", os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW | os.O_CLOEXEC))

    def test_unsafe_signal_threads_stdio_and_output_fd_fail_before_descriptor_inventory(self):
        for change, code in (("signal", "SIGCHLD_NOT_DEFAULT"), ("threads", "MULTITHREADED_ENTRY"),
                             ("thread-name", "MULTITHREADED_ENTRY"), ("null-symlink", "STDIN_NOT_DEV_NULL"),
                             ("stdin-file", "STDIN_NOT_DEV_NULL"), ("stdin-rdev", "STDIN_NOT_DEV_NULL"),
                             ("stdout-file", "UNSAFE_STDIO_CONTROL_ASSET"),
                             ("stderr-socket", "UNSAFE_STDIO_CONTROL_ASSET"), ("output-bool", "OUTPUT_FD_INVALID"),
                             ("output-stdio", "OUTPUT_FD_INVALID")):
            with mocked_supervision_fds() as state:
                output = 901
                if change == "signal":
                    state.signal.getsignal.return_value = 1
                elif change == "threads":
                    state.tasks = ["1", "2"]
                elif change == "thread-name":
                    state.tasks = ["not-a-thread-id"]
                elif change == "null-symlink":
                    state.null = SimpleNamespace(st_mode=stat.S_IFLNK, st_rdev=123)
                elif change == "stdin-file":
                    state.stats[0] = SimpleNamespace(st_mode=stat.S_IFREG, st_rdev=123)
                elif change == "stdin-rdev":
                    state.stats[0] = SimpleNamespace(st_mode=stat.S_IFCHR, st_rdev=999)
                elif change == "stdout-file":
                    state.stats[1] = SimpleNamespace(st_mode=stat.S_IFREG, st_rdev=123)
                elif change == "stderr-socket":
                    state.stats[2] = SimpleNamespace(st_mode=stat.S_IFSOCK, st_rdev=0)
                elif change == "output-bool":
                    output = True
                else:
                    output = 2
                with self.subTest(change=change):
                    self.assert_error(code, entry._prepare_supervision_fds, output)
                state.open.assert_not_called()
                state.close.assert_not_called()

    def test_invalid_or_excessive_fd_inventory_closes_probe_without_closing_arbitrary_fds(self):
        for names in (["0", "unexpected"], [str(fd) for fd in range(257)]):
            with mocked_supervision_fds() as state:
                state.names_override = names
                self.assert_error("FD_INVENTORY_BOUND", entry._prepare_supervision_fds, 901)
                self.assertEqual(state.closed, [99])
                self.assertEqual(state.fds, {0, 1, 2, 41, 901})

    def test_disappeared_fd_is_allowed_but_other_close_errors_propagate_and_probe_closes(self):
        import errno
        with mocked_supervision_fds() as state:
            state.close_error = OSError(errno.EBADF, "invented descriptor already closed")
            entry._prepare_supervision_fds(901)
            self.assertEqual(state.closed, [41, 99])
        with mocked_supervision_fds() as state:
            state.close_error = OSError(errno.EIO, "invented close failure")
            with self.assertRaises(OSError) as error:
                entry._prepare_supervision_fds(901)
            self.assertEqual(error.exception.errno, errno.EIO)
            self.assertEqual(state.closed, [41, 99])

    def test_inventory_after_close_must_equal_exact_allowed_set(self):
        for change in ("unclosed", "missing-output"):
            with mocked_supervision_fds() as state:
                if change == "unclosed":
                    state.skip_removal = {41}
                else:
                    state.fds.discard(901)
                self.assert_error("UNEXPECTED_OPEN_FD", entry._prepare_supervision_fds, 901)
                self.assertEqual(state.closed[-1], 99)

    def test_linux_listdir_closed_temporary_descriptor_is_observed_ebadf_and_never_closed_again(self):
        with mocked_supervision_fds() as state:
            entry._prepare_supervision_fds(901)
            self.assertEqual(state.enumerations, 2)
            self.assertEqual(state.fstat.call_args_list.count(unittest.mock.call(state.enumerated_closed_fd)), 2)
            self.assertNotIn(state.enumerated_closed_fd, state.closed)
            self.assertEqual(state.closed, [41, 99])
            self.assertEqual(state.fds, {0, 1, 2, 901})

    def test_temporary_number_is_not_blindly_ignored_if_live_in_final_enumeration(self):
        with mocked_supervision_fds() as state:
            state.on_enumeration = lambda count: state.fds.add(10000) if count == 2 else None
            self.assert_error("UNEXPECTED_OPEN_FD", entry._prepare_supervision_fds, 901)
            self.assertEqual(state.closed, [41, 99])
            self.assertIn(10000, state.fds)
            state.fstat.assert_any_call(10000)

    def test_enumerated_descriptor_fstat_error_other_than_ebadf_propagates_and_probe_closes(self):
        import errno
        for error_number in (errno.EIO, errno.EACCES):
            with mocked_supervision_fds() as state:
                state.fstat_errors[10000] = OSError(error_number, "invented descriptor observation failure")
                with self.assertRaises(OSError) as error:
                    entry._prepare_supervision_fds(901)
                self.assertEqual(error.exception.errno, error_number)
                self.assertEqual(state.closed, [99])
                self.assertIn(41, state.fds)

    @unittest.skipUnless(sys.platform == "linux", "Real FD integration is Linux only; no child process on Asus")
    def test_real_linux_fd_hygiene_in_only_own_isolated_child_with_null_and_pipes(self):
        # All process/filesystem operations are below the Linux-only skip. This
        # never runs on Asus; an independent Linux reviewer may execute it.
        import subprocess
        import tempfile
        child_code = """
import errno, importlib.util, json, os, stat, sys
spec = importlib.util.spec_from_file_location('owned_fd_integration_entry', sys.argv[1])
entry = importlib.util.module_from_spec(spec)
sys.modules[spec.name] = entry
spec.loader.exec_module(entry)
output_fd = int(sys.argv[2])
extra = os.open('/dev/null', os.O_RDONLY | os.O_CLOEXEC)
entry._prepare_supervision_fds(output_fd)
try:
    os.fstat(extra)
except OSError as exc:
    assert exc.errno == errno.EBADF
else:
    raise AssertionError('extra own descriptor remained live')
assert stat.S_ISDIR(os.fstat(output_fd).st_mode)
assert stat.S_ISCHR(os.fstat(0).st_mode)
assert stat.S_ISFIFO(os.fstat(1).st_mode)
assert stat.S_ISFIFO(os.fstat(2).st_mode)
assert not any(name == '_elogistix_reviewed_pilot' or name.startswith('systemd_memory_runtime') for name in sys.modules)
print(json.dumps({'fd_cleanup_complete': True, 'own_extra_fd_closed': True, 'native_runtime_certified': False}))
"""
        self.assertTrue(Path(sys.executable).is_absolute())
        with tempfile.TemporaryDirectory(prefix="protected-entry-owned-fd-") as directory:
            output_fd = os.open(directory, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW | os.O_CLOEXEC)
            try:
                result = subprocess.run([sys.executable, "-I", "-S", "-B", "-c", child_code,
                                         str(ENTRY_PATH), str(output_fd)],
                                        stdin=subprocess.DEVNULL, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                                        pass_fds=(output_fd,), close_fds=True, timeout=5, cwd=directory,
                                        env={"LANG": "C.UTF-8", "LC_ALL": "C.UTF-8"}, check=False)
            finally:
                os.close(output_fd)
        self.assertEqual(result.returncode, 0, result.stderr.decode("utf-8", "replace"))
        self.assertEqual(result.stderr, b"")
        self.assertEqual(json.loads(result.stdout), {"fd_cleanup_complete": True,
                                                    "own_extra_fd_closed": True,
                                                    "native_runtime_certified": False})


class LateCustodyTests(BootstrapAssertions):
    def test_poll_and_single_kill_use_only_original_handle_until_reaped(self):
        handle = SimpleNamespace(pid=4242, returncode=None, poll=Mock(side_effect=[None, None, 0]), kill=Mock())
        output = io.StringIO()
        with patch.object(entry, "_pending_custody_handles", [handle]), \
                patch("time.sleep") as sleep, redirect_stdout(output):
            entry._retain_until_reaped()
        self.assertEqual(handle.poll.call_count, 3)
        handle.kill.assert_called_once_with()
        self.assertEqual(sleep.call_args_list, [unittest.mock.call(0.05), unittest.mock.call(0.05)])
        self.assertEqual(output.getvalue(), "")

    def test_reaped_handle_is_never_killed_and_failure_keeps_sticky_incomplete(self):
        reaped = SimpleNamespace(pid=4242, returncode=0, poll=Mock(return_value=0), kill=Mock())
        failed = SimpleNamespace(pid=4343, returncode=None, poll=Mock(side_effect=[None, None, 0]),
                                 kill=Mock(side_effect=OSError("invented kill failure")))
        output = io.StringIO()
        with patch.object(entry, "_pending_custody_handles", [reaped, failed]), \
                patch("time.sleep"), redirect_stdout(output):
            entry._retain_until_reaped()
        reaped.kill.assert_not_called()
        failed.kill.assert_called_once_with()
        self.assertEqual(json.loads(output.getvalue()), {"status": "INCOMPLETE", "error": "LATE_CUSTODY_ERROR",
                                                         "native_runtime_certified": False})

    def test_boolean_poll_is_not_exit_code_and_no_pending_handle_needs_waiting(self):
        handle = SimpleNamespace(pid=4242, returncode=None, poll=Mock(side_effect=[True, 0]), kill=Mock())
        output = io.StringIO()
        with patch.object(entry, "_pending_custody_handles", [handle]), \
                patch("time.sleep") as sleep, redirect_stdout(output):
            entry._retain_until_reaped()
        handle.kill.assert_not_called()
        sleep.assert_called_once_with(0.05)
        self.assertEqual(json.loads(output.getvalue())["status"], "INCOMPLETE")
        with patch.object(entry, "_pending_custody_handles", []), patch("time.sleep") as sleep:
            entry._retain_until_reaped()
        sleep.assert_not_called()


class AuxiliaryOutputAndOSReadTests(BootstrapAssertions):
    def output_fixture(self, **changes):
        fixture = complete_fixture()
        output = "/var/tmp/fixture-output"
        nodes = list(complete_observations(fixture))
        nodes.extend(entry.NodeObservation(path, "directory", 0, 0o555, 2, True)
                     for path in ("/var", "/var/tmp"))
        node = entry.NodeObservation(output, "directory", 0, 0o700, 2, True)
        nodes.append(replace(node, **changes))
        return fixture, output, FakePosix(tuple(nodes))

    def test_fresh_output_retains_only_its_fd_and_control_metadata_is_read_only(self):
        fixture, output, fake = self.output_fixture()
        with mocked_posix(fake), patch.object(os, "stat", return_value=SimpleNamespace(st_dev=1, st_ino=999)) as stat_mock:
            retained = entry._open_auxiliary_output(output, fixture.inputs)
        self.assertEqual(fake.fds, {retained: output})
        self.assertEqual(set(fake.closed), set(fake.opened) - {retained})
        self.assertTrue(all(call.args == (ROOT,) and call.kwargs == {"follow_symlinks": False}
                            for call in stat_mock.call_args_list))
        fake.close(retained)

    def test_nonprivate_nonempty_acl_writable_ancestor_symlink_or_alias_output_is_rejected(self):
        for changes, code in (({"mode": 0o755}, "AUXILIARY_OUTPUT_NOT_FRESH_PRIVATE"),
                              ({"acl_names": ("security.capability",)}, "ACL_FORBIDDEN"),
                              ({"kind": "symlink"}, "AUXILIARY_OUTPUT_UNAVAILABLE")):
            fixture, output, fake = self.output_fixture(**changes)
            with mocked_posix(fake), patch.object(os, "stat", return_value=SimpleNamespace(st_dev=1, st_ino=999)):
                self.assert_error(code, entry._open_auxiliary_output, output, fixture.inputs)
            self.assertEqual(fake.fds, {})
        for change, code in (("nonempty", "AUXILIARY_OUTPUT_NOT_FRESH_PRIVATE"),
                             ("ancestor", "WRITABLE_OR_SPECIAL_MODE"), ("alias", "AUXILIARY_CONTROL_ALIAS")):
            fixture, output, fake = self.output_fixture()
            if change == "nonempty":
                fake.extra_names[output] = ["invented-unwanted-file"]
            elif change == "ancestor":
                fake.nodes["/var"] = replace(fake.nodes["/var"], mode=0o777)
            root_identity = SimpleNamespace(st_dev=1, st_ino=sorted(fake.nodes).index(output) + 1 if change == "alias" else 999)
            with mocked_posix(fake), patch.object(os, "stat", return_value=root_identity):
                self.assert_error(code, entry._open_auxiliary_output, output, fixture.inputs)
            self.assertEqual(fake.fds, {})

    def test_lexical_control_overlap_rejects_before_opening_any_output_descriptor(self):
        fixture = complete_fixture()
        with patch.object(os, "open") as open_mock:
            for path in (ROOT, ROOT + "/output", "/srv"):
                self.assert_error("AUXILIARY_CONTROL_OVERLAP", entry._open_auxiliary_output, path, fixture.inputs)
        open_mock.assert_not_called()

    def test_os_hash_streaming_accepts_empty_pinned_file_and_never_executes_bytecode(self):
        directory = "/usr/lib/python3.12/__pycache__"
        path = directory + "/fixture.cpython-312.pyc"
        for raw in (b"", b"x" * 70_000):
            nodes = [entry.NodeObservation(parent, "directory", 0, 0o555, 2, True)
                     for parent in ("/", "/usr", "/usr/lib", "/usr/lib/python3.12", directory)]
            nodes.append(entry.NodeObservation(path, "file", 0, 0o444, 1, True, content=raw))
            fake = FakePosix(tuple(nodes))
            with mocked_posix(fake):
                result = entry._read_single_protected_file_os(path, maximum=128 * 1024 * 1024, _retain=False)
            self.assertEqual(result, (len(raw), digest(raw)))
            self.assertEqual(fake.fds, {})
            with patch.object(sys, "platform", "linux"), patch.object(os, "open") as open_mock:
                self.assert_error("BYTECODE_FORBIDDEN", entry._read_single_protected_file, path,
                                  maximum=128 * 1024 * 1024)
            open_mock.assert_not_called()


class StaticLauncherContractTests(BootstrapAssertions):
    def test_original_main_call_has_only_reviewed_hooks_and_no_launch_substitutes(self):
        tree = ast.parse(ENTRY_PATH.read_text(encoding="utf-8"))
        factory = next(node for node in tree.body if isinstance(node, ast.FunctionDef) and node.name == "make_bound_main")
        calls = [node for node in ast.walk(factory) if isinstance(node, ast.Call)
                 and isinstance(node.func, ast.Name) and node.func.id == "original_main"]
        self.assertEqual(len(calls), 1)
        self.assertEqual([argument.id for argument in calls[0].args], ["argv"])
        self.assertEqual([keyword.arg for keyword in calls[0].keywords], ["evidence_sink", "abort_requested"])
        forbidden = {"Popen", "system", "execv", "execve", "spawnv", "setuid", "setgid", "setgroups",
                     "chmod", "chown", "setxattr", "removexattr"}
        self.assertFalse(any(isinstance(node, ast.Call) and isinstance(node.func, ast.Attribute)
                             and node.func.attr in forbidden for node in ast.walk(tree)))
        self.assertFalse(any(isinstance(node, ast.Call) and isinstance(node.func, ast.Name)
                             and node.func.id in {"exec", "eval", "__import__"} for node in ast.walk(tree)))
        self.assertFalse(any(name == "_elogistix_reviewed_pilot" or name.startswith("systemd_memory_runtime")
                             for name in sys.modules), "Actual central/wrapper modules must not remain imported")


if __name__ == "__main__":
    unittest.main()
