"""Hermetic tests of the native pre-run preparation recipe as inert data.

Invented bytes and OS pins below never authenticate a VM or authorize execution.
Only the owned launcher is imported; central/wrapper/native tools never run.
"""
from __future__ import annotations

from dataclasses import FrozenInstanceError
import hashlib
import importlib.util
import json
from pathlib import Path
import shlex
import sys
import unittest
from unittest.mock import patch


ENTRY_FILE = Path(__file__).resolve().parents[1] / "scripts" / "ci" / "systemd-pilot-protected-entry.py"
MODULE_NAME = "os_preparation_entry_under_test"
MODULE_SPEC = importlib.util.spec_from_file_location(MODULE_NAME, ENTRY_FILE)
entry = importlib.util.module_from_spec(MODULE_SPEC)
sys.modules[MODULE_NAME] = entry
MODULE_SPEC.loader.exec_module(entry)

INGRESS = "/srv/mutable-checkout"
DESTINATION = "/srv/prepared-source"
INTENT_PATH = "data/run-intent.json"
READER_UID = 2042
READER_GID = 2043
SCOPE_REF = "Sentinel_5d6cf0688f788191ad0503a9a351e1a7"


def digest(raw):
    return hashlib.sha256(raw).hexdigest()


def encode(value):
    return json.dumps(value, sort_keys=True, separators=(",", ":")).encode("ascii")


def pin(path):
    return {"path": path, "sha256": digest(("synthetic OS bytes " + path).encode("ascii")), "size": 1}


class PreparationFixture:
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
        self.elf = b"\x7fELF\x02\x01synthetic-pre-run-ELF-never-executed"
        self.scope = b"```json approved-scope\n{}\n```\n"
        self.yaml = b"name: synthetic\njobs: {}\n"
        self.context_raw = encode({"repository": entry.REPOSITORY, "event_name": "create",
            "ref_type": "branch", "event_ref": "synthetic-review", "ref": "refs/heads/synthetic-review",
            "run_attempt": "1", "workflow_commit": "b" * 40, "source_commit": "a" * 40})
        self.source_manifest_raw = encode({"schema": entry.SOURCE_SCHEMA, "repository": entry.REPOSITORY,
            "source_commit": "a" * 40, "files": [{"path": p, "sha256": digest(raw), "size": len(raw)}
                                                 for p, raw in sorted(self.static_blobs.items())]})
        self.approval = {"schema": entry.APPROVAL_SCHEMA, "repository": entry.REPOSITORY,
            "source_commit": "a" * 40, "branch": "synthetic-review",
            "authorization_ref": "synthetic-reviewed-authorization", "scope_document_sha256": digest(self.scope),
            "yaml_sha256": digest(self.yaml), "source_manifest_sha256": digest(self.source_manifest_raw),
            "elf_sha256": digest(self.elf), "event_context_sha256": digest(self.context_raw),
            "python_files": [{"path": p, "sha256": digest(raw), "size": len(raw)}
                             for p, raw in sorted(self.python_blobs.items())],
            "interpreter": entry.VM_INTERPRETER, "stdlib_paths": list(entry.VM_STDLIB_PATHS),
            "startup_files": sorted([pin(entry.VM_INTERPRETER),
                pin("/usr/lib/python3.12/encodings/__init__.py"),
                pin("/usr/lib/python3.12/lib-dynload/synthetic.so"),
                *(pin(p) for p in entry.VM_NATIVE_DEPENDENCIES),
                *(pin(p) for p in entry.PREPARATION_NATIVE_TOOLS)], key=lambda item: item["path"]),
            "identity": {"uid": READER_UID, "gid": READER_GID, "name": "synthetic_load",
                "home": "/nonexistent", "shell": "/usr/sbin/nologin",
                "policy_files": [pin(p) for p in ("/etc/group", "/etc/nsswitch.conf", "/etc/passwd", "/etc/sudoers")],
                "policy_directories": ["/etc/sudoers.d", "/etc/polkit-1/rules.d",
                                       "/usr/share/polkit-1/rules.d", "/etc/pam.d", "/etc/security"]}}
        self.intent = {"schema": entry.RUN_INTENT_SCHEMA, "run": "1" * 32,
            "slots": [{"slot": i, "unit_name": "elogistix-memory-adapter-" + str(i + 2) * 32 + ".service",
                       "scenario": scenario, "memory_max_bytes": 33_554_432, "tasks_max": 8}
                      for i, scenario in enumerate(("OVERLAP", "LEADER_EXIT_THREAD_SURVIVES", "DESCENDANT_IGNORES_TERM"))],
            "load_uid": READER_UID, "load_gid": READER_GID, "load_groups": [READER_GID],
            "payload_expected_sha256": digest(self.elf), "cleanup_policy_id": "physical-cleanup-union-v1",
            "scope_ref": SCOPE_REF}
        self.rebuild()

    def rebuild(self):
        self.approval_raw = encode(self.approval)
        self.intent_raw = encode(self.intent)
        self.blobs = {**self.static_blobs, entry.SCOPE_PATH: self.scope, entry.YAML_PATH: self.yaml,
            entry.CONTEXT_PATH: self.context_raw, entry.SOURCE_MANIFEST_PATH: self.source_manifest_raw,
            entry.APPROVAL_PATH: self.approval_raw, entry.ELF_PATH: self.elf, INTENT_PATH: self.intent_raw}
        self.roles = {path: "python" for path in self.python_blobs}
        self.roles.update({path: "data" for path in self.blobs if path not in self.roles})
        self.roles.update({entry.SCOPE_PATH: "scope", entry.ELF_PATH: "elf"})
        self.rebuild_inventory()

    def rebuild_inventory(self):
        self.inventory = {"schema": entry.INVENTORY_SCHEMA,
            "files": [{"path": path, "sha256": digest(raw), "size": len(raw), "role": self.roles[path]}
                      for path, raw in sorted(self.blobs.items())]}
        self.inventory_raw = encode(self.inventory)

    def arguments(self):
        return {"approval_raw": self.approval_raw, "approval_sha256": digest(self.approval_raw),
            "inventory_raw": self.inventory_raw, "inventory_sha256": digest(self.inventory_raw),
            "run_intent_raw": self.intent_raw, "source_directory": INGRESS,
            "protected_source_directory": DESTINATION, "reader_uid": READER_UID, "reader_gid": READER_GID}


class OSPreparationTests(unittest.TestCase):
    def setUp(self):
        self.fixture = PreparationFixture()

    def build(self, **changes):
        values = self.fixture.arguments()
        values.update(changes)
        return entry.build_os_preparation_recipe(**values)

    def assert_rejected(self, function=None):
        with self.assertRaises(entry.BootstrapError) as caught:
            (self.build if function is None else function)()
        self.assertIs(type(caught.exception.code), str)
        self.assertTrue(caught.exception.code)

    def replace_intent_raw(self, raw):
        self.fixture.intent_raw = raw
        self.fixture.blobs[INTENT_PATH] = raw
        self.fixture.rebuild_inventory()

    def test_preparation_returns_frozen_inert_recipe_without_python_or_origin(self):
        with patch("builtins.open", side_effect=AssertionError("unexpected filesystem IO")), \
             patch.object(entry.os, "open", side_effect=AssertionError("unexpected native IO")), \
             patch("importlib.import_module", side_effect=AssertionError("unexpected runtime import")):
            recipe = self.build()
        self.assertIs(type(recipe), entry.NativePreparationData)
        self.assertEqual(recipe.bootstrap_argv, ("/usr/bin/dash", "-eu"))
        self.assertEqual(recipe.environment, ())
        self.assertEqual(recipe.cwd, "/")
        self.assertEqual(recipe.script_sha256, digest(recipe.stdin_script))
        self.assertEqual(recipe.protected_source_directory, DESTINATION)
        self.assertEqual(recipe.inventory_sha256, digest(self.fixture.inventory_raw))
        self.assertEqual(recipe.approval_sha256, digest(self.fixture.approval_raw))
        self.assertEqual(recipe.timing_boundary, "BEFORE_ORIGINAL_RUNSPEC_T0")
        self.assertNotIn("python_argv", recipe.__dataclass_fields__)
        with self.assertRaises(FrozenInstanceError):
            recipe.cwd = DESTINATION
        text = recipe.stdin_script.decode("ascii")
        self.assertNotIn("exec /usr/bin/env", text)
        self.assertNotIn("monotonic", text)
        self.assertNotIn("date ", text)
        self.assertNotIn("t0_us", text)
        self.assertNotIn("work_deadline_us", text)
        self.assertNotIn("cleanup_deadline_us", text)
        self.assertTrue(text.endswith("exit 0\n"))

    def test_mutable_ingress_path_is_only_data_and_never_enumerated(self):
        text = self.build().stdin_script.decode("ascii")
        self.assertNotIn("/usr/bin/find '" + INGRESS + "'", text)
        self.assertNotIn("node '" + INGRESS + "'", text)
        self.assertNotIn("file '" + INGRESS + "/", text)
        for path in self.fixture.blobs:
            self.assertIn(INGRESS + "/" + path, text)
            self.assertIn(DESTINATION + "/" + path, text)
        self.assertNotIn("run-spec.json", text)

    def test_exact_destination_bytes_and_inventory_are_hash_checked(self):
        text = self.build().stdin_script.decode("ascii")
        for item in self.fixture.inventory["files"]:
            with self.subTest(path=item["path"]):
                self.assertIn(item["sha256"], text)
                self.assertIn(DESTINATION + "/" + item["path"], text)
        self.assertIn(digest(self.fixture.inventory_raw), text)
        self.assertIn(digest(self.fixture.intent_raw), text)

    def test_approval_inventory_and_intent_bytes_are_pinned(self):
        for values in ({"approval_sha256": "c" * 64}, {"inventory_sha256": "c" * 64},
                       {"run_intent_raw": self.fixture.intent_raw + b" "}):
            with self.subTest(values=values):
                self.assert_rejected(lambda: self.build(**values))

    def test_pre_run_layout_rejects_started_spec_even_if_inventoried(self):
        self.fixture.blobs[entry.SPEC_PATH] = b'{"t0_us":"1000000"}'
        self.fixture.roles[entry.SPEC_PATH] = "spec"
        self.fixture.rebuild_inventory()
        self.assert_rejected()

    def test_pre_run_inventory_is_accepted_only_by_explicit_preparation_mode(self):
        inventory = entry.parse_inventory(self.fixture.inventory_raw,
                                          expected_sha256=digest(self.fixture.inventory_raw))
        entry._validate_installation_pins(inventory, self.fixture.approval, pre_run=True)
        self.assert_rejected(lambda: entry._validate_installation_pins(inventory, self.fixture.approval))

    def test_preparation_mode_cannot_consume_final_spec_layout(self):
        raw = self.fixture.blobs.pop(INTENT_PATH)
        self.fixture.roles.pop(INTENT_PATH)
        self.fixture.blobs[entry.SPEC_PATH] = raw
        self.fixture.roles[entry.SPEC_PATH] = "spec"
        self.fixture.rebuild_inventory()
        inventory = entry.parse_inventory(self.fixture.inventory_raw,
                                          expected_sha256=digest(self.fixture.inventory_raw))
        entry._validate_installation_pins(inventory, self.fixture.approval)
        # Layout accepts the static role only; the existing canonical spec parser
        # remains responsible for rejecting intent bytes during actual binding.
        self.assert_rejected(lambda: entry._validate_installation_pins(inventory, self.fixture.approval, pre_run=True))

    def test_pre_run_layout_requires_intent_with_data_role(self):
        for mutation in (lambda f: f.blobs.pop(INTENT_PATH),
                         lambda f: f.roles.update({INTENT_PATH: "spec"})):
            with self.subTest(mutation=mutation):
                self.fixture = PreparationFixture()
                mutation(self.fixture)
                self.fixture.rebuild_inventory()
                self.assert_rejected()

    def test_intent_is_closed_without_past_future_or_cleanup_times(self):
        for key in ("t0_us", "work_deadline_us", "cleanup_deadline_us", "future_t0_us", "unreviewed_extra"):
            with self.subTest(key=key):
                self.fixture = PreparationFixture()
                self.fixture.intent[key] = "1000000000"
                self.fixture.rebuild()
                self.assert_rejected()

    def test_intent_requires_every_original_non_timing_field_and_schema(self):
        for key in tuple(self.fixture.intent):
            with self.subTest(missing=key):
                self.fixture = PreparationFixture()
                self.fixture.intent.pop(key)
                self.fixture.rebuild()
                self.assert_rejected()
        self.fixture = PreparationFixture()
        self.fixture.intent["schema"] = "unreviewed.schema"
        self.fixture.rebuild()
        self.assert_rejected()

    def test_intent_raw_json_is_strict_and_bounded(self):
        valid = self.fixture.intent_raw
        for raw in (b"\xff", b"[]", b"null", b"{", b'{"schema":"duplicate",' + valid[1:],
                    valid[:-1] + b',"extra":NaN}', b" " * (entry.MAX_INVENTORY_BYTES + 1)):
            with self.subTest(raw_prefix=raw[:80]):
                self.fixture = PreparationFixture()
                self.replace_intent_raw(raw)
                self.assert_rejected()

    def test_intent_identity_and_groups_match_approved_existing_load(self):
        for key, value in (("load_uid", 0), ("load_uid", True), ("load_uid", READER_UID + 1),
                           ("load_gid", 0), ("load_gid", READER_GID + 1),
                           ("load_groups", []), ("load_groups", [READER_GID, READER_GID + 1])):
            with self.subTest(key=key, value=value):
                self.fixture = PreparationFixture()
                self.fixture.intent[key] = value
                self.fixture.rebuild()
                self.assert_rejected()

    def test_intent_cannot_change_approved_elf_hash(self):
        self.fixture.intent["payload_expected_sha256"] = "c" * 64
        self.fixture.rebuild()
        self.assert_rejected()

    def test_semantic_intent_fields_stay_pinned_data_for_existing_canonical_validator(self):
        # This helper prepares content only. It cannot issue an approved RunSpec
        # or replace the central/wrapper validators with a second implementation.
        for mutate in (lambda value: value.update(slots=[]),
                       lambda value: value["slots"].pop(),
                       lambda value: value["slots"][0].update(extra=True),
                       lambda value: value["slots"][0].update(memory_max_bytes=80 * 1024 * 1024),
                       lambda value: value["slots"][0].update(tasks_max=9),
                       lambda value: value["slots"][0].update(scenario="UNKNOWN"),
                       lambda value: value["slots"][0].update(unit_name="unreserved.service"),
                       lambda value: value["slots"][1].update(unit_name=value["slots"][0]["unit_name"]),
                       lambda value: value.update(scope_ref="another_scope"),
                       lambda value: value.update(cleanup_policy_id="another_cleanup_policy")):
            with self.subTest(mutation=mutate):
                self.fixture = PreparationFixture()
                mutate(self.fixture.intent)
                self.fixture.rebuild()
                recipe = self.build()
                text = recipe.stdin_script.decode("ascii")
                self.assertIn("file '" + DESTINATION + "/" + INTENT_PATH + "' " +
                              str(len(self.fixture.intent_raw)) + " '" + digest(self.fixture.intent_raw) + "'", text)
                self.assertNotIn("python_argv", recipe.__dataclass_fields__)
                self.assertEqual(recipe.timing_boundary, "BEFORE_ORIGINAL_RUNSPEC_T0")

    def test_each_native_preparation_tool_requires_independent_os_pin(self):
        for path in entry.PREPARATION_NATIVE_TOOLS:
            with self.subTest(path=path):
                self.fixture = PreparationFixture()
                self.fixture.approval["startup_files"] = [item for item in self.fixture.approval["startup_files"]
                                                         if item["path"] != path]
                self.fixture.rebuild()
                self.assert_rejected()

    def test_native_os_profile_and_policy_pins_precede_every_copy(self):
        text = self.build().stdin_script.decode("ascii")
        first_copy = text.index("/usr/bin/mkfifo -m 0600 --")
        for item in self.fixture.approval["startup_files"] + self.fixture.approval["identity"]["policy_files"]:
            with self.subTest(path=item["path"]):
                command = "file '%s' %d '%s'" % (item["path"], item["size"], item["sha256"])
                self.assertLess(text.index(command), first_copy)
        self.assertIn("[ ! -e '" + entry.VM_ABSENT_STARTUP_ZIP + "' ] || die", text)
        self.assertIn("[ ! -L '" + entry.VM_ABSENT_STARTUP_ZIP + "' ] || die", text)

    def test_destination_has_new_root_private_nodes_and_fail_closed_acl_checks(self):
        text = self.build().stdin_script.decode("ascii")
        self.assertLess(text.index("node '/srv'"), text.index("/usr/bin/mkdir -m 0700 -- '" + DESTINATION + "' || die"))
        self.assertIn("node '" + DESTINATION + "'", text)
        self.assertIn("[ ! -L \"$1\" ] || die", text)
        self.assertIn("u=$(/usr/bin/stat -c %u -- \"$1\") || die\n  [ \"$u\" = 0 ] || die", text)
        self.assertIn("m=$(/usr/bin/stat -c %a -- \"$1\") || die\n  [ $((0$m & 07022)) = 0 ] || die", text)
        self.assertIn("security[.]capability", text)
        self.assertIn("posix_acl_access|posix_acl_default|nfs4_acl|richacl", text)
        self.assertIn('2>/dev/null) || die\n  [ -z "$a" ] || die', text)
        self.assertIn('l=$(/usr/bin/stat -c %h -- "$1") || die\n  [ "$l" = 1 ] || die', text)
        self.assertIn('z=$(/usr/bin/stat -c %s -- "$1") || die\n  [ "$z" = "$2" ] || die', text)

    def test_mutable_ingress_reads_only_fixed_unprivileged_dd_and_never_target_fd(self):
        text = self.build().stdin_script.decode("ascii")
        ingress_lines = [line for line in text.splitlines() if INGRESS + "/" in line]
        self.assertEqual(len(ingress_lines), len(self.fixture.blobs) + 1)
        pipe = DESTINATION + "/.ingress-copy.pipe"
        privilege = ("exec /usr/bin/setpriv --reuid=%d --regid=%d --clear-groups "
                     "--inh-caps=-all --ambient-caps=-all --bounding-set=-all --no-new-privs "
                     "/usr/bin/dash -eu -c " % (READER_UID, READER_GID))
        for line in ingress_lines:
            with self.subTest(line=line):
                self.assertTrue(line.startswith("/usr/bin/timeout --kill-after=1 2 /usr/bin/dash -eu -c '" + privilege))
                self.assertTrue(line.endswith("< /dev/null > " + pipe + "' || reader_status=$?"))
                self.assertIn("iflag=nofollow,nonblock,count_bytes", line)
                self.assertEqual(line.count(DESTINATION), 1)
                self.assertNotIn(" of=", line)
                self.assertNotIn("exec python", line)

    def test_reader_existing_uid_and_primary_gid_are_checked_after_policy_hashes_before_copy(self):
        text = self.build().stdin_script.decode("ascii")
        lookup = ("u=$(/usr/bin/id -u -- '%d') || die\n[ \"$u\" = '%d' ] || die\n"
                  "g=$(/usr/bin/id -g -- '%d') || die\n[ \"$g\" = '%d' ] || die"
                  % (READER_UID, READER_UID, READER_UID, READER_GID))
        lookup_index = text.index(lookup)
        self.assertLess(lookup_index, text.index("/usr/bin/mkfifo -m 0600 --"))
        for item in self.fixture.approval["startup_files"] + self.fixture.approval["identity"]["policy_files"]:
            command = "file '%s' %d '%s'" % (item["path"], item["size"], item["sha256"])
            with self.subTest(path=item["path"]):
                self.assertLess(text.index(command), lookup_index)

    def test_nested_reader_quoting_preserves_fixed_post_drop_identity_checks_before_dd(self):
        text = self.build().stdin_script.decode("ascii")
        ingress_lines = [line for line in text.splitlines() if INGRESS + "/" in line]
        expected_checks = ("u=$(/usr/bin/id -u) || exit 3; [ \"$u\" = %d ] || exit 3; "
                           "g=$(/usr/bin/id -g) || exit 3; [ \"$g\" = %d ] || exit 3; "
                           % (READER_UID, READER_GID))
        expected_privilege = ["exec", "/usr/bin/setpriv", "--reuid=" + str(READER_UID),
                              "--regid=" + str(READER_GID), "--clear-groups", "--inh-caps=-all",
                              "--ambient-caps=-all", "--bounding-set=-all", "--no-new-privs",
                              "/usr/bin/dash", "-eu", "-c"]
        pipe = DESTINATION + "/.ingress-copy.pipe"
        # shlex only parses text; no shell or OS tools execute in this test.
        for line in ingress_lines:
            with self.subTest(line=line):
                outer = shlex.split(line, posix=True)
                self.assertEqual(outer[:6], ["/usr/bin/timeout", "--kill-after=1", "2",
                                            "/usr/bin/dash", "-eu", "-c"])
                self.assertEqual(outer[7:], ["||", "reader_status=$?"])
                middle = shlex.split(outer[6], posix=True)
                self.assertEqual(middle[:12], expected_privilege)
                self.assertEqual(middle[13:], ["<", "/dev/null", ">", pipe])
                checked_read = middle[12]
                self.assertTrue(checked_read.startswith(expected_checks + "exec /usr/bin/dd if=" + INGRESS + "/"))
                self.assertEqual(checked_read.count("exec /usr/bin/dd"), 1)
                self.assertNotIn(DESTINATION, checked_read)
                self.assertNotIn(" > ", checked_read)
                self.assertNotIn(" of=", checked_read)
                self.assertIn("iflag=nofollow,nonblock,count_bytes", checked_read)
                self.assertEqual(len(middle), 17)

    def test_root_writer_alone_creates_destination_regular_file_after_noclobber(self):
        text = self.build().stdin_script.decode("ascii")
        lines = text.splitlines()
        writer_lines = [line for line in lines if line.endswith(" &")]
        self.assertEqual(len(writer_lines), len(self.fixture.blobs) + 1)
        self.assertLess(text.index("set -C\n"), text.index(writer_lines[0]))
        for relative, raw in ((entry.INVENTORY_NAME, self.fixture.inventory_raw), *self.fixture.blobs.items()):
            target = DESTINATION + "/" + relative
            command = ("/usr/bin/timeout --kill-after=1 2 /usr/bin/dd if='" + DESTINATION +
                       "/.ingress-copy.pipe' iflag=nofollow,count_bytes count=" + str(len(raw) + 1) +
                       " bs=65536 status=none < /dev/null > '" + target + "' &")
            with self.subTest(path=relative):
                self.assertIn(command, writer_lines)
                target_writers = [line for line in lines if "> '" + target + "'" in line]
                self.assertEqual(target_writers, [command])
                self.assertNotIn(INGRESS, command)

    def test_outer_reader_timeout_precedes_fifo_open_and_both_process_statuses_are_required(self):
        text = self.build().stdin_script.decode("ascii")
        lines = text.splitlines()
        writer_positions = [i for i, line in enumerate(lines) if line.endswith(" &")]
        for start in writer_positions:
            block = lines[start:start + 9]
            with self.subTest(writer=block[0]):
                self.assertEqual(block[1], "writer=$!")
                self.assertEqual(block[2], "reader_status=0")
                self.assertTrue(block[3].startswith("/usr/bin/timeout --kill-after=1 2 /usr/bin/dash -eu -c 'exec "))
                self.assertTrue(block[3].endswith(".ingress-copy.pipe' || reader_status=$?"))
                self.assertEqual(block[4], "writer_status=0")
                self.assertEqual(block[5], 'wait "$writer" || writer_status=$?')
                self.assertEqual(block[6], "/usr/bin/rm -- '" + DESTINATION + "/.ingress-copy.pipe' || die")
                self.assertEqual(block[7], '[ "$reader_status" = 0 ] && [ "$writer_status" = 0 ] || die')
                self.assertTrue(block[8].startswith("file '" + DESTINATION + "/"))

    def test_destination_exact_tree_and_all_asset_rehashes_follow_last_reader_writer(self):
        text = self.build().stdin_script.decode("ascii")
        final_tree = "n=$(/usr/bin/find '" + DESTINATION + "' -print) || die"
        tree_index = text.index(final_tree)
        self.assertLess(text.rindex('wait "$writer" || writer_status=$?'), tree_index)
        self.assertLess(text.rindex("/usr/bin/rm -- '" + DESTINATION + "/.ingress-copy.pipe' || die"), tree_index)
        self.assertIn('s=$(printf \'%s\\n\' "$n" | /usr/bin/sort) || die', text[tree_index:])
        for relative, raw in ((entry.INVENTORY_NAME, self.fixture.inventory_raw), *self.fixture.blobs.items()):
            command = "file '%s/%s' %d '%s'" % (DESTINATION, relative, len(raw), digest(raw))
            with self.subTest(path=relative):
                self.assertEqual(text.count(command), 2)
                self.assertGreater(text.rindex(command), tree_index)

    def test_inventory_does_not_expand_to_arbitrary_repository_extras(self):
        self.fixture.blobs["README-from-checkout.txt"] = b"unreviewed repository extra"
        self.fixture.roles["README-from-checkout.txt"] = "data"
        self.fixture.rebuild_inventory()
        self.assert_rejected()

    def test_reader_identity_requires_nonzero_exact_integer_uid_gid(self):
        for values in ({"reader_uid": 0}, {"reader_gid": 0}, {"reader_uid": True},
                       {"reader_gid": False}, {"reader_uid": -1}, {"reader_gid": 1 << 32}):
            with self.subTest(values=values):
                self.assert_rejected(lambda: self.build(**values))

    def test_reader_identity_rejects_linux_all_bits_one_sentinel_and_overflow(self):
        for name in ("reader_uid", "reader_gid"):
            for value in (0xFFFFFFFF, 0x100000000, True, False):
                with self.subTest(name=name, value=value):
                    self.assert_rejected(lambda: self.build(**{name: value}))

    def test_source_and_destination_paths_are_absolute_closed_and_separate(self):
        for values in ({"source_directory": "relative"}, {"source_directory": "/srv/../mutable"},
                       {"source_directory": "/srv/shell;injection"},
                       {"protected_source_directory": INGRESS},
                       {"protected_source_directory": INGRESS + "/nested"},
                       {"source_directory": DESTINATION + "/nested"},
                       {"protected_source_directory": "/usr/lib/python3.12/injected"}):
            with self.subTest(values=values):
                self.assert_rejected(lambda: self.build(**values))


if __name__ == "__main__":
    unittest.main()
