"""Hermetic protocol/evidence tests. No Linux kernel, systemd or cgroup writes.

The fake filesystem retains node objects after unlink/replacement just as an
already-open descriptor retains its original object. Tests intentionally run
on Windows too; injected evidence is never called Linux kernel validation.
Run: python -m unittest discover -s scripts/ci/systemd_memory_runtime/tests -v
"""
from __future__ import annotations

import errno
import importlib.util
import sys
import threading
import time
import unittest
from dataclasses import dataclass, field, replace
from pathlib import Path
from unittest.mock import patch


MODULE_PATH = Path(__file__).resolve().parents[1] / "physical_cgroup.py"
SPEC = importlib.util.spec_from_file_location("physical_cgroup_hermetic", MODULE_PATH)
assert SPEC is not None and SPEC.loader is not None
pc = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = pc
SPEC.loader.exec_module(pc)


class FakeClock:
    def __init__(self):
        self.now = 100_000

    def __call__(self):
        result = self.now
        self.now += 1
        return result

    def advance(self, amount):
        self.now += amount


@dataclass
class Node:
    label: str
    identity: object
    children: dict = field(default_factory=dict)
    files: dict = field(default_factory=dict)
    symlink: bool = False


@dataclass(eq=False)
class Handle:
    owner: object
    node: Node
    closed: bool = False


class FakeFilesystem:
    """Trusted injected backend; all effects concern only in-memory nodes."""

    def __init__(self, clock):
        self.clock = clock
        self.calls = []
        self.counts = {}
        self.hooks = {}
        self.faults = {}
        self.handles = []
        self.next_inode = 200
        self.mount = pc.CgroupMount(31, 17, "0:44", "/", "/sys/fs/cgroup",
                                   "rw,nosuid,nodev,noexec", (), "cgroup", "rw")
        self.current_context = pc.MountContext(
            "11111111-2222-4333-8444-555555555555", 4, 600,
            (self.mount,))
        self.root = self._new_node("root", mount_id=1)
        sys_node = self._new_node("sys", mount_id=1)
        fs_node = self._new_node("fs", mount_id=1)
        cgroup_node = self._new_node("cgroup")
        self.parent = self._new_node("parent")
        self.leaf = self._new_node("leaf")
        self.root.children["sys"] = sys_node
        sys_node.children["fs"] = fs_node
        fs_node.children["cgroup"] = cgroup_node
        cgroup_node.children["pilot"] = self.parent
        self.parent.children["slot"] = self.leaf
        self.leaf.files.update({
            "memory.max": b"1048576\n",
            "memory.high": b"max\n",
            "memory.swap.max": b"0\n",
            "memory.peak": b"8192\n",
            "cgroup.events": b"populated 0\nfrozen 0\n",
            "cgroup.procs": b"",
        })

    def _new_node(self, label, **changes):
        identity = pc.NodeIdentity(44, self.next_inode, 31,
                                   pc.CGROUP2_SUPER_MAGIC, 2)
        self.next_inode += 1
        return Node(label, replace(identity, **changes))

    def _perform(self, name, function, deadline=None):
        number = self.counts.get(name, 0) + 1
        self.counts[name] = number
        self.calls.append((name, number, deadline))
        hook = self.hooks.get((name, number))
        if hook is not None:
            hook()
        fault = self.faults.get((name, number))
        if fault is not None:
            raise fault
        return function()

    def hook_next(self, name, callback):
        self.hooks[(name, self.counts.get(name, 0) + 1)] = callback

    def fault_next(self, name, error):
        self.faults[(name, self.counts.get(name, 0) + 1)] = error

    def _handle(self, node):
        result = Handle(self, node)
        self.handles.append(result)
        return result

    def _node(self, handle):
        if not isinstance(handle, Handle) or handle.owner is not self or handle.closed:
            raise OSError(errno.EBADF, "not an internally owned open handle")
        return handle.node

    def open_root(self, deadline_ns):
        return self._perform("open_root", lambda: self._handle(self.root), deadline_ns)

    def open_dir_at(self, parent, name, deadline_ns):
        def open_child():
            if not name or name in (".", "..") or "/" in name or "\x00" in name:
                raise ValueError("one canonical component required")
            node = self._node(parent)
            if name not in node.children:
                raise FileNotFoundError(errno.ENOENT, "exact directory name absent", name)
            child = node.children[name]
            if child.symlink:
                raise OSError(errno.ELOOP, "directory symlink refused")
            return self._handle(child)
        return self._perform("open_dir_at:" + name, open_child, deadline_ns)

    def identity(self, handle, deadline_ns):
        node = self._node(handle)
        return self._perform("identity:" + node.label,
                             lambda: self._node(handle).identity, deadline_ns)

    def read_at(self, handle, name, cap, deadline_ns):
        def read_file():
            node = self._node(handle)
            if name not in node.files:
                raise FileNotFoundError(errno.ENOENT, "controller file absent", name)
            result = node.files[name]
            if len(result) > cap:
                raise OSError(errno.EFBIG, "byte cap exceeded")
            return result
        return self._perform("read_at:" + name, read_file, deadline_ns)

    def context(self, cap, deadline_ns):
        return self._perform("context", lambda: self.current_context, deadline_ns)

    def close(self, handle):
        node = self._node(handle)
        self._perform("close:" + node.label, lambda: setattr(handle, "closed", True))

    def detach_leaf(self):
        self.parent.children.pop("slot", None)
        self.leaf.identity = replace(self.leaf.identity, nlink=0)

    def rename_leaf(self):
        """A live retained node remains linked; only its original name vanishes."""
        self.parent.children["renamed_slot"] = self.parent.children.pop("slot")

    def restore_original_leaf(self):
        self.leaf.identity = replace(self.leaf.identity, nlink=2)
        self.parent.children["slot"] = self.leaf

    def replace_leaf(self, **identity_changes):
        original = self.leaf
        original.identity = replace(original.identity, nlink=0)
        replacement = self._new_node("replacement", **identity_changes)
        replacement.files.update(original.files)
        self.parent.children["slot"] = replacement
        return replacement

    def rename_parent(self):
        mount = self.root.children["sys"].children["fs"].children["cgroup"]
        mount.children["renamed"] = mount.children.pop("pilot")

    def detach_parent(self):
        mount = self.root.children["sys"].children["fs"].children["cgroup"]
        mount.children.pop("pilot", None)
        self.parent.identity = replace(self.parent.identity, nlink=0)

    @property
    def live_handles(self):
        return [handle for handle in self.handles if not handle.closed]


class FakeIdentitySource:
    def __init__(self, identity):
        self.current = identity
        self.count = 0
        self.deadlines = []
        self.changes = {}
        self.faults = {}

    def snapshot(self, deadline_ns):
        self.count += 1
        self.deadlines.append(deadline_ns)
        if self.count in self.changes:
            self.current = self.changes[self.count]
        if self.count in self.faults:
            raise self.faults[self.count]
        return self.current


def manager(**changes):
    values = dict(run_id="a" * 32, slot_id=0, manager_owner=":1.42",
                  manager_guid="b" * 32, unit="pilot-memory-slot.service",
                  invocation_id="c" * 32, control_group="/pilot/slot",
                  control_group_id=987654321, unit_binding_ref="d" * 64,
                  source_ref="transport:snapshot:1")
    values.update(changes)
    return pc.ManagerIdentity(**values)


class ObserverTests(unittest.TestCase):
    def setUp(self):
        self.clock = FakeClock()
        self.fs = FakeFilesystem(self.clock)
        self.expected = manager()
        self.source = FakeIdentitySource(self.expected)
        self.observers = []

    def tearDown(self):
        for observer in self.observers:
            observer.close()

    def reset_fixture(self):
        """End each subcase's handle ownership before constructing its next FS."""
        self.tearDown()
        self.setUp()

    def bind_result(self, **kwargs):
        result = pc.bind_before_go(self.expected, self.source, filesystem=self.fs,
                                  clock=self.clock, **kwargs)
        if result.observer is not None:
            self.observers.append(result.observer)
        return result

    def bind(self):
        result = self.bind_result()
        self.assertEqual(result.observation.status, pc.Status.COMPLETE,
                         result.observation.issues)
        self.assertIsNotNone(result.observer)
        return result.observer

    def policy(self, observer, **changes):
        values = dict(policy_id="external-enforcement-1",
                      source_ref="policy:evidence:1", binding_ref=observer.binding_ref,
                      exclusions=frozenset({"rename", "replacement", "migration"}),
                      valid_from_ns=0, valid_until_ns=100_000_000_000)
        values.update(changes)
        return pc.AbsencePolicy(**values)

    def assert_incomplete(self, observation):
        self.assertEqual(observation.status, pc.Status.INCOMPLETE)
        self.assertTrue(observation.issues)
        self.assertTrue(observation.evidence)

    def assert_unavailable(self, observation):
        self.assert_incomplete(observation)
        self.assertEqual(observation.value.kind, pc.ClosureKind.UNAVAILABLE)
        self.assertIsNone(observation.value.populated)

    def records(self, observation, operation):
        return [item for item in observation.evidence if item.operation == operation]

    def test_bind_retains_exact_original_parent_and_leaf(self):
        observer = self.bind()
        self.assertEqual(len(self.fs.live_handles), 2)
        self.assertEqual({h.node.label for h in self.fs.live_handles}, {"parent", "leaf"})
        self.assertEqual(observer.binding.leaf, self.fs.leaf.identity)
        self.assertEqual(observer.binding.parent, self.fs.parent.identity)
        self.assertEqual(observer.binding.manager, self.expected)
        self.assertNotEqual(observer.binding.manager.control_group_id,
                            observer.binding.leaf.inode)
        self.assertGreaterEqual(self.source.count, 2)
        self.assertGreaterEqual(self.fs.counts["context"], 2)

    def test_bind_has_typed_provenance_and_no_handles_in_evidence(self):
        result = self.bind_result()
        observation = result.observation
        self.assertEqual(observation.origin, "injected-filesystem")
        self.assertIsNone(observation.binding_ref)
        self.assertTrue(observation.ref)
        for item in observation.evidence:
            self.assertNotIsInstance(item.value, Handle)
            self.assertLessEqual(observation.started_ns, item.started_ns)
            self.assertLessEqual(item.started_ns, item.finished_ns)
            self.assertLessEqual(item.finished_ns, observation.finished_ns)

    def test_every_manager_component_is_compared_before_bind(self):
        alternatives = dict(run_id="e" * 32, slot_id=1, manager_owner=":1.43",
                            manager_guid="f" * 32, unit="other.service",
                            invocation_id="1" * 32, control_group="/pilot/other",
                            control_group_id=987654322, unit_binding_ref="2" * 64)
        for field_name, value in alternatives.items():
            with self.subTest(field=field_name):
                self.reset_fixture()
                self.source.current = replace(self.expected, **{field_name: value})
                result = self.bind_result()
                self.assert_incomplete(result.observation)
                self.assertIsNone(result.observer)
                self.assertFalse(self.fs.live_handles)

    def test_every_manager_component_is_compared_after_bind(self):
        alternatives = dict(run_id="e" * 32, slot_id=2, manager_owner=":1.44",
                            manager_guid="f" * 32, unit="other.service",
                            invocation_id="1" * 32, control_group="/pilot/other",
                            control_group_id=2, unit_binding_ref="2" * 64)
        for field_name, value in alternatives.items():
            with self.subTest(field=field_name):
                self.reset_fixture()
                self.source.changes[2] = replace(self.expected, **{field_name: value})
                result = self.bind_result()
                self.assert_incomplete(result.observation)
                self.assertIsNone(result.observer)
                self.assertFalse(self.fs.live_handles)

    def test_fresh_source_ref_does_not_change_identity(self):
        self.source.changes[2] = replace(self.expected, source_ref="transport:snapshot:2")
        observer = self.bind()
        observation = pc.observe_census(observer)
        self.assertEqual(observation.status, pc.Status.COMPLETE)
        refs = [r.value.source_ref for r in self.records(observation, "manager_identity")]
        self.assertIn("transport:snapshot:2", refs)

    def test_invalid_expected_fields_fail_closed(self):
        cases = [("run_id", "not-hex"), ("slot_id", True), ("slot_id", -1),
                 ("slot_id", 3), ("manager_owner", "org.freedesktop.systemd1"),
                 ("manager_guid", "z" * 32), ("invocation_id", ""),
                 ("control_group_id", True), ("control_group_id", -1),
                 ("control_group_id", 1 << 64), ("unit_binding_ref", "bad"),
                 ("source_ref", ""), ("unit", "a\x00b")]
        for field_name, value in cases:
            with self.subTest(field=field_name, value=value):
                self.reset_fixture()
                self.expected = replace(self.expected, **{field_name: value})
                self.source.current = self.expected
                result = self.bind_result()
                self.assert_incomplete(result.observation)
                self.assertIsNone(result.observer)
                self.assertFalse(self.fs.live_handles)

    def test_noncanonical_control_group_is_rejected(self):
        for path in ("relative", "/", "/pilot/../slot", "/pilot/./slot",
                     "/pilot//slot", "/pilot/slot/", "/pilot\\slot", "/pilot/\x00slot"):
            with self.subTest(path=path):
                self.reset_fixture()
                self.expected = replace(self.expected, control_group=path)
                self.source.current = self.expected
                result = self.bind_result()
                self.assert_incomplete(result.observation)
                self.assertIsNone(result.observer)

    def test_missing_leaf_during_bind_is_not_a_closure_proof(self):
        self.fs.detach_leaf()
        result = self.bind_result()
        self.assert_incomplete(result.observation)
        self.assertIsNone(result.observer)
        self.assertFalse(self.fs.live_handles)

    def test_symlink_component_is_refused(self):
        self.fs.parent.symlink = True
        result = self.bind_result()
        self.assert_incomplete(result.observation)
        self.assertIsNone(result.observer)
        self.assertTrue(any(r.errno == errno.ELOOP for r in result.observation.evidence))
        self.assertFalse(self.fs.live_handles)

    def test_leaf_filesystem_device_mount_inode_nlink_checks(self):
        changes = ({"filesystem_magic": 0xEF53}, {"device": 999},
                   {"mount_id": 999}, {"inode": 0}, {"nlink": 0})
        for change in changes:
            with self.subTest(change=change):
                self.reset_fixture()
                self.fs.leaf.identity = replace(self.fs.leaf.identity, **change)
                result = self.bind_result()
                self.assert_incomplete(result.observation)
                self.assertIsNone(result.observer)
                self.assertFalse(self.fs.live_handles)

    def test_parent_mount_must_match_mountinfo(self):
        self.fs.parent.identity = replace(self.fs.parent.identity, mount_id=91)
        result = self.bind_result()
        self.assert_incomplete(result.observation)
        self.assertFalse(self.fs.live_handles)

    def test_ambiguous_or_nonroot_mount_fails_closed(self):
        for mounts in ((self.fs.mount, self.fs.mount),
                       (replace(self.fs.mount, root="/delegated"),), ()):
            with self.subTest(mounts=mounts):
                self.fs.current_context = replace(self.fs.current_context, mounts=mounts)
                result = self.bind_result()
                self.assert_incomplete(result.observation)
                self.assertIsNone(result.observer)

    def test_bind_rechecks_boot_namespace_and_mount_context(self):
        changes = ({"boot_id": "99999999-2222-4333-8444-555555555555"},
                   {"namespace_device": 5}, {"namespace_inode": 601},
                   {"mounts": (replace(self.fs.mount, mount_id=32),)})
        for change in changes:
            with self.subTest(change=change):
                self.reset_fixture()
                altered = replace(self.fs.current_context, **change)
                self.fs.hooks[("context", 2)] = lambda value=altered: setattr(
                    self.fs, "current_context", value)
                result = self.bind_result()
                self.assert_incomplete(result.observation)
                self.assertIsNone(result.observer)
                self.assertFalse(self.fs.live_handles)

    def test_limits_preserve_zero_and_typed_unbounded(self):
        observation = pc.observe_limits(self.bind())
        self.assertEqual(observation.status, pc.Status.COMPLETE, observation.issues)
        self.assertEqual(observation.value.memory_max, 1048576)
        self.assertIs(observation.value.memory_high, pc.Unbounded.MAX)
        self.assertEqual(observation.value.memory_swap_max, 0)
        self.assertTrue(self.records(observation, "read:memory.high"))

    def test_unknown_limit_is_none_not_unbounded_or_zero(self):
        observer = self.bind()
        del self.fs.leaf.files["memory.max"]
        observation = pc.observe_limits(observer)
        self.assert_incomplete(observation)
        self.assertIsNone(observation.value.memory_max)
        self.assertEqual(observation.value.memory_swap_max, 0)

    def test_census_reports_direct_members_and_descendant_population(self):
        observer = self.bind()
        self.fs.leaf.files["cgroup.events"] = b"populated 1\nfrozen 0\n"
        observation = pc.observe_census(observer)
        self.assertEqual(observation.status, pc.Status.COMPLETE)
        self.assertEqual(observation.value.populated, 1)
        self.assertEqual(observation.value.pids, ())
        self.assertIn("descendants", observation.value.scope)
        self.assertIsNotNone(observation.value.events_ref)
        self.assertIsNotNone(observation.value.procs_ref)

    def test_census_preserves_pid_order_and_possible_kernel_duplicates(self):
        observer = self.bind()
        self.fs.leaf.files["cgroup.procs"] = b"42\n7\n42\n"
        observation = pc.observe_census(observer)
        self.assertEqual(observation.status, pc.Status.COMPLETE)
        self.assertEqual(observation.value.pids, (42, 7, 42))

    def test_census_partial_unknown_does_not_invent_population(self):
        observer = self.bind()
        del self.fs.leaf.files["cgroup.events"]
        observation = pc.observe_census(observer)
        self.assert_incomplete(observation)
        self.assertIsNone(observation.value.populated)
        self.assertEqual(observation.value.pids, ())

    def test_peak_has_census_and_identity_on_both_sides(self):
        observer = self.bind()
        observation = pc.observe_memory_peak(observer)
        self.assertEqual(observation.status, pc.Status.COMPLETE, observation.issues)
        self.assertEqual(observation.value.bytes, 8192)
        self.assertEqual(observation.value.before.populated, 0)
        self.assertEqual(observation.value.after.populated, 0)
        operations = [item.operation for item in observation.evidence]
        peak_index = operations.index("read:memory.peak")
        self.assertLess(operations.index("read:cgroup.events"), peak_index)
        self.assertLess(peak_index, len(operations) - 1 - operations[::-1].index("read:cgroup.events"))
        self.assertEqual(len(self.records(observation, "manager_identity")), 2)
        self.assertEqual(len(self.records(observation, "mount_context")), 2)
        self.assertEqual(observation.value.reading_ref,
                         self.records(observation, "read:memory.peak")[0].ref)

    def test_peak_zero_is_known_only_after_a_valid_read(self):
        observer = self.bind()
        self.fs.leaf.files["memory.peak"] = b"0\n"
        observation = pc.observe_memory_peak(observer)
        self.assertEqual(observation.status, pc.Status.COMPLETE)
        self.assertEqual(observation.value.bytes, 0)
        self.assertIsNotNone(observation.value.reading_ref)

    def test_peak_io_errors_preserve_unknown_and_errno(self):
        for number in (errno.ENOENT, errno.EACCES, errno.EIO, errno.EFBIG):
            with self.subTest(errno=number):
                observer = self.bind()
                self.fs.fault_next("read_at:memory.peak", OSError(number, "injected read fault"))
                observation = pc.observe_memory_peak(observer)
                self.assert_incomplete(observation)
                self.assertIsNone(observation.value.bytes)
                self.assertIsNone(observation.value.reading_ref)
                read = self.records(observation, "read:memory.peak")[0]
                self.assertEqual(read.errno, number)
                self.assertIsNone(read.value)

    def test_peak_partial_read_error_preserves_bounded_raw_prefix(self):
        observer = self.bind()
        self.fs.fault_next("read_at:memory.peak",
                           pc._ReadError(errno.EFBIG, "oversize read", b"7" * 90))
        observation = pc.observe_memory_peak(observer, budget=pc.Budget(max_file_bytes=32))
        self.assert_incomplete(observation)
        self.assertIsNone(observation.value.bytes)
        read = self.records(observation, "read:memory.peak")[0]
        self.assertEqual(read.value, b"7" * 32)
        self.assertEqual(read.errno, errno.EFBIG)

    def test_peak_timeout_keeps_unknown_and_raw_returned_bytes(self):
        observer = self.bind()
        self.fs.hook_next("read_at:memory.peak", lambda: self.clock.advance(1_000_000_001))
        observation = pc.observe_memory_peak(observer)
        self.assert_incomplete(observation)
        self.assertIsNone(observation.value.bytes)
        read = self.records(observation, "read:memory.peak")[0]
        self.assertEqual(read.value, b"8192\n")
        self.assertIn("TimeoutError", read.error)

    def test_peak_parse_failure_preserves_raw_evidence(self):
        observer = self.bind()
        self.fs.leaf.files["memory.peak"] = b"max\n"
        observation = pc.observe_memory_peak(observer)
        self.assert_incomplete(observation)
        self.assertIsNone(observation.value.bytes)
        self.assertEqual(self.records(observation, "read:memory.peak")[0].value, b"max\n")
        self.assertTrue(self.records(observation, "parse:memory.peak")[0].error)

    def test_peak_post_identity_failure_keeps_measured_value_but_incomplete(self):
        observer = self.bind()
        self.fs.hook_next("read_at:memory.peak", lambda: setattr(
            self.source, "current", replace(self.expected, invocation_id="f" * 32)))
        observation = pc.observe_memory_peak(observer)
        self.assert_incomplete(observation)
        self.assertEqual(observation.value.bytes, 8192)
        self.assertIsNotNone(observation.value.reading_ref)

    def test_peak_bad_census_is_not_certified(self):
        observer = self.bind()
        self.fs.leaf.files["cgroup.events"] = b"populated 9\n"
        observation = pc.observe_memory_peak(observer)
        self.assert_incomplete(observation)
        self.assertEqual(observation.value.bytes, 8192)
        self.assertIsNone(observation.value.before.populated)
        self.assertIsNone(observation.value.after.populated)

    def test_present_empty_requires_direct_populated_read(self):
        observer = self.bind()
        observation = pc.observe_closure(observer)
        self.assertEqual(observation.status, pc.Status.COMPLETE, observation.issues)
        self.assertEqual(observation.value.kind, pc.ClosureKind.PRESENT_EMPTY)
        self.assertEqual(observation.value.populated, 0)
        read = self.records(observation, "read:cgroup.events")[0]
        self.assertEqual(observation.value.events_ref, read.ref)
        self.assertEqual(len(self.records(observation, "closure_identity")), 2)
        self.assertEqual(len(observation.references), 2)
        self.assertIn("no reap/reclamation", observation.value.meaning)

    def test_still_populated_is_unavailable_and_does_not_copy_one_into_closure(self):
        observer = self.bind()
        self.fs.leaf.files["cgroup.events"] = b"populated 1\n"
        observation = pc.observe_closure(observer)
        self.assert_unavailable(observation)
        self.assertEqual(self.records(observation, "parse:cgroup.events")[0].value, 1)

    def test_controller_enoent_is_not_original_absent_even_with_policy(self):
        observer = self.bind()
        del self.fs.leaf.files["cgroup.events"]
        observation = pc.observe_closure(observer, policy=self.policy(observer))
        self.assert_unavailable(observation)
        self.assertFalse(self.records(observation, "absence_policy"))
        self.assertEqual(self.records(observation, "read:cgroup.events")[0].errno, errno.ENOENT)

    def test_controller_errors_never_prove_absence(self):
        for number in (errno.EACCES, errno.EIO):
            with self.subTest(errno=number):
                observer = self.bind()
                self.fs.fault_next("read_at:cgroup.events", OSError(number, "controller failure"))
                observation = pc.observe_closure(observer, policy=self.policy(observer))
                self.assert_unavailable(observation)

    def test_original_absent_retains_enoent_reference_and_policy(self):
        observer = self.bind()
        self.fs.detach_leaf()
        observation = pc.observe_closure(observer, policy=self.policy(observer))
        self.assertEqual(observation.status, pc.Status.COMPLETE, observation.issues)
        self.assertEqual(observation.value.kind, pc.ClosureKind.ORIGINAL_ABSENT)
        self.assertIsNone(observation.value.populated)
        self.assertIsNone(observation.value.events_ref)
        self.assertEqual(observation.value.policy_ref, "policy:evidence:1")
        lookups = self.records(observation, "lookup_exact_leaf")
        self.assertEqual(len(lookups), 2)
        self.assertTrue(all(item.errno == errno.ENOENT and item.error for item in lookups))
        self.assertTrue(all(item.ref in observation.references for item in lookups))
        self.assertIn("policy:evidence:1", observation.references)
        self.assertFalse(self.records(observation, "read:cgroup.events"))
        self.assertIn("no reap/reclamation", observation.value.meaning)

    def test_live_renamed_leaf_is_not_absent_under_arbitrary_policy_strings(self):
        observer = self.bind()
        self.fs.leaf.files["cgroup.events"] = b"populated 1\n"
        original_inode = self.fs.leaf.identity.inode
        self.fs.rename_leaf()
        self.assertEqual(self.fs.leaf.identity.nlink, 2)
        observation = pc.observe_closure(observer, policy=self.policy(observer))
        self.assert_unavailable(observation)
        self.assertEqual(observer.binding.leaf.inode, original_inode)
        self.assertIn("renamed_slot", self.fs.parent.children)
        self.assertFalse(self.records(observation, "read:cgroup.events"))

    def test_live_leaf_name_absence_is_sticky_across_all_observation_apis(self):
        for first_function in (pc.observe_closure, pc.observe_census, pc.observe_memory_peak):
            with self.subTest(first=first_function.__name__):
                self.reset_fixture()
                observer = self.bind()
                self.fs.rename_leaf()
                first = first_function(observer)
                self.assert_incomplete(first)
                self.assertEqual(self.fs.leaf.identity.nlink, 2)
                self.fs.parent.children["slot"] = self.fs.parent.children.pop("renamed_slot")
                self.assertIs(self.fs.parent.children["slot"], self.fs.leaf)
                census = pc.observe_census(observer)
                peak = pc.observe_memory_peak(observer)
                closure = pc.observe_closure(observer)
                self.assert_incomplete(census)
                self.assertIsNone(census.value.populated)
                self.assertIsNone(census.value.pids)
                self.assert_incomplete(peak)
                self.assertIsNone(peak.value.bytes)
                self.assert_unavailable(closure)
                self.assertFalse(self.records(census, "read:cgroup.events"))
                self.assertFalse(self.records(peak, "read:memory.peak"))

    def test_deleted_leaf_absence_from_nonclosure_read_stays_invalid_after_restore(self):
        for first_function in (pc.observe_census, pc.observe_memory_peak):
            with self.subTest(first=first_function.__name__):
                self.reset_fixture()
                observer = self.bind()
                self.fs.detach_leaf()
                first = first_function(observer)
                self.assert_incomplete(first)
                self.fs.restore_original_leaf()
                self.assert_incomplete(pc.observe_census(observer))
                peak = pc.observe_memory_peak(observer)
                self.assert_incomplete(peak)
                self.assertIsNone(peak.value.bytes)
                self.assert_unavailable(pc.observe_closure(observer))

    def test_deleted_leaf_seen_by_limits_can_later_certify_original_absence(self):
        observer = self.bind()
        self.fs.detach_leaf()
        limits = pc.observe_limits(observer)
        self.assert_incomplete(limits)
        self.assertEqual(self.fs.leaf.identity.nlink, 0)
        self.assertTrue(self.records(limits, "lookup_exact_leaf"))
        closure = pc.observe_closure(observer, policy=self.policy(observer))
        self.assertEqual(closure.status, pc.Status.COMPLETE, closure.issues)
        self.assertEqual(closure.value.kind, pc.ClosureKind.ORIGINAL_ABSENT)
        self.assertIsNone(closure.value.populated)
        self.assertFalse(self.records(closure, "read:cgroup.events"))

    def test_absence_requires_policy(self):
        observer = self.bind()
        self.fs.detach_leaf()
        self.assert_unavailable(pc.observe_closure(observer))

    def test_absence_rejects_every_missing_exclusion(self):
        for missing in ("rename", "replacement", "migration"):
            with self.subTest(missing=missing):
                self.reset_fixture()
                observer = self.bind()
                self.fs.detach_leaf()
                exclusions = frozenset({"rename", "replacement", "migration"} - {missing})
                observation = pc.observe_closure(observer, policy=self.policy(observer, exclusions=exclusions))
                self.assert_unavailable(observation)

    def test_absence_rejects_policy_without_valid_reference_or_interval(self):
        cases = ({"policy_id": ""}, {"source_ref": ""}, {"binding_ref": "other"},
                 {"valid_from_ns": 10_000_000}, {"valid_until_ns": 1})
        for change in cases:
            with self.subTest(change=change):
                self.reset_fixture()
                observer = self.bind()
                self.fs.detach_leaf()
                observation = pc.observe_closure(observer, policy=self.policy(observer, **change))
                self.assert_unavailable(observation)

    def test_absence_post_lookup_reappearance_is_unavailable(self):
        observer = self.bind()
        self.fs.detach_leaf()
        second_lookup = self.fs.counts["open_dir_at:slot"] + 2
        self.fs.hooks[("open_dir_at:slot", second_lookup)] = self.fs.restore_original_leaf
        observation = pc.observe_closure(observer, policy=self.policy(observer))
        self.assert_unavailable(observation)

    def test_absence_policy_must_cover_final_finished_timestamp(self):
        observer = self.bind()
        self.fs.detach_leaf()
        baseline = pc.observe_closure(observer, policy=self.policy(observer))
        self.assertEqual(baseline.status, pc.Status.COMPLETE)
        # Replay the same deterministic clock interval with expiry precisely
        # at its final timestamp, later than the in-body policy check.
        self.clock.now = baseline.started_ns
        observation = pc.observe_closure(
            observer, policy=self.policy(observer, valid_until_ns=baseline.finished_ns))
        self.assert_unavailable(observation)
        self.assertTrue(any("expired before" in issue for issue in observation.issues))

    def test_leaf_disappears_during_populated_read_is_unavailable(self):
        observer = self.bind()
        self.fs.hook_next("read_at:cgroup.events", self.fs.detach_leaf)
        observation = pc.observe_closure(observer, policy=self.policy(observer))
        self.assert_unavailable(observation)
        self.assertEqual(self.records(observation, "parse:cgroup.events")[0].value, 0)

    def test_post_identity_change_invalidates_present_empty(self):
        observer = self.bind()
        self.fs.hook_next("read_at:cgroup.events", lambda: setattr(
            self.source, "current", replace(self.expected, manager_owner=":1.99")))
        observation = pc.observe_closure(observer)
        self.assert_unavailable(observation)
        self.assertEqual(self.records(observation, "parse:cgroup.events")[0].value, 0)

    def test_replacement_never_adopts_empty_substitute(self):
        observer = self.bind()
        original_identity = observer.binding.leaf
        replacement = self.fs.replace_leaf()
        replacement.files["cgroup.events"] = b"populated 0\n"
        observation = pc.observe_closure(observer, policy=self.policy(observer))
        self.assert_unavailable(observation)
        self.assertEqual(observer.binding.leaf, original_identity)
        self.assertFalse(self.records(observation, "read:cgroup.events"))
        self.assertTrue(any(h.node is self.fs.leaf for h in self.fs.live_handles))
        self.assertFalse(any(h.node is replacement for h in self.fs.live_handles))

    def test_same_device_inode_different_mount_is_not_original_leaf(self):
        observer = self.bind()
        self.fs.replace_leaf(inode=self.fs.leaf.identity.inode, mount_id=32)
        self.assert_unavailable(pc.observe_closure(observer, policy=self.policy(observer)))

    def test_parent_rename_and_parent_absence_are_unavailable(self):
        for change in ("rename_parent", "detach_parent"):
            with self.subTest(change=change):
                self.reset_fixture()
                observer = self.bind()
                self.fs.detach_leaf()
                getattr(self.fs, change)()
                observation = pc.observe_closure(observer, policy=self.policy(observer))
                self.assert_unavailable(observation)
                self.assertFalse(self.records(observation, "lookup_exact_leaf"))

    def test_parent_identity_error_is_not_leaf_absence(self):
        observer = self.bind()
        self.fs.detach_leaf()
        self.fs.fault_next("identity:parent", OSError(errno.ENOENT, "parent unavailable"))
        observation = pc.observe_closure(observer, policy=self.policy(observer))
        self.assert_unavailable(observation)
        self.assertFalse(self.records(observation, "lookup_exact_leaf"))

    def test_parent_path_absence_stays_invalid_after_exact_parent_is_restored(self):
        observer = self.bind()
        original_parent = self.fs.parent
        self.fs.rename_parent()
        first = pc.observe_closure(observer)
        self.assert_unavailable(first)
        failure = self.records(first, "open_component:pilot")[0]
        self.assertEqual(failure.errno, errno.ENOENT)
        mount = self.fs.root.children["sys"].children["fs"].children["cgroup"]
        mount.children["pilot"] = mount.children.pop("renamed")
        self.assertIs(mount.children["pilot"], original_parent)
        second = pc.observe_closure(observer)
        self.assert_unavailable(second)
        self.assertFalse(self.records(second, "read:cgroup.events"))
        self.assertTrue(any("sticky" in issue for issue in second.issues))

    def test_missing_dbus_unit_is_not_leaf_absence(self):
        observer = self.bind()
        self.fs.detach_leaf()
        self.source.faults[self.source.count + 1] = FileNotFoundError(errno.ENOENT, "unit absent")
        observation = pc.observe_closure(observer, policy=self.policy(observer))
        self.assert_unavailable(observation)
        self.assertEqual(self.records(observation, "closure_identity")[0].errno, errno.ENOENT)
        self.assertFalse(self.records(observation, "lookup_exact_leaf"))

    def test_boot_namespace_or_mount_change_invalidates_absence(self):
        changes = ({"boot_id": "99999999-2222-4333-8444-555555555555"},
                   {"namespace_device": 5}, {"namespace_inode": 601},
                   {"mounts": (replace(self.fs.mount, super_options="ro"),)})
        for change in changes:
            with self.subTest(change=change):
                self.reset_fixture()
                observer = self.bind()
                self.fs.detach_leaf()
                self.fs.current_context = replace(self.fs.current_context, **change)
                self.assert_unavailable(pc.observe_closure(observer, policy=self.policy(observer)))

    def test_identity_mismatch_is_sticky_after_source_recovers(self):
        observer = self.bind()
        self.source.current = replace(self.expected, invocation_id="f" * 32)
        self.assert_incomplete(pc.observe_census(observer))
        self.source.current = self.expected
        observation = pc.observe_memory_peak(observer)
        self.assert_incomplete(observation)
        self.assertIsNone(observation.value.bytes)
        self.assertFalse(self.records(observation, "read:memory.peak"))

    def test_context_mismatch_is_sticky_after_context_recovers(self):
        observer = self.bind()
        original = self.fs.current_context
        self.fs.current_context = replace(original, namespace_inode=900)
        self.assert_incomplete(pc.observe_census(observer))
        self.fs.current_context = original
        self.assert_unavailable(pc.observe_closure(observer))

    def test_replacement_mismatch_is_sticky_after_original_name_is_restored(self):
        observer = self.bind()
        self.fs.replace_leaf()
        self.assert_unavailable(pc.observe_closure(observer))
        self.fs.restore_original_leaf()
        observation = pc.observe_memory_peak(observer)
        self.assert_incomplete(observation)
        self.assertIsNone(observation.value.bytes)
        self.assertFalse(self.records(observation, "read:memory.peak"))

    def test_max_file_byte_budget_rejects_peak(self):
        observer = self.bind()
        self.fs.leaf.files["memory.peak"] = b"12345678901234567890\n"
        budget = pc.Budget(max_file_bytes=20)
        observation = pc.observe_memory_peak(observer, budget=budget)
        self.assert_incomplete(observation)
        self.assertIsNone(observation.value.bytes)
        self.assertEqual(self.records(observation, "read:memory.peak")[0].errno, errno.EFBIG)

    def test_total_byte_budget_blocks_new_reads_after_exhaustion(self):
        observer = self.bind()
        budget = pc.Budget(max_total_bytes=21)
        observation = pc.observe_memory_peak(observer, budget=budget)
        self.assert_incomplete(observation)
        self.assertIsNone(observation.value.bytes)
        self.assertFalse(self.records(observation, "read:memory.peak"))
        self.assertFalse(self.records(observation, "read:cgroup.procs"))
        raw_size = sum(len(item.value) for item in observation.evidence
                       if isinstance(item.value, bytes))
        self.assertLessEqual(raw_size, budget.max_total_bytes)
        self.assertTrue(any("byte budget exhausted" in issue for issue in observation.issues))

    def test_partial_read_prefix_counts_against_remaining_total_bytes(self):
        observer = self.bind()
        self.fs.fault_next("read_at:memory.peak",
                           pc._ReadError(errno.EFBIG, "oversize read", b"8192\n"))
        budget = pc.Budget(max_total_bytes=23)
        observation = pc.observe_memory_peak(observer, budget=budget)
        self.assert_incomplete(observation)
        self.assertIsNone(observation.value.bytes)
        read = self.records(observation, "read:memory.peak")[0]
        self.assertEqual(read.value, b"81")
        raw_size = sum(len(item.value) for item in observation.evidence
                       if isinstance(item.value, bytes))
        self.assertEqual(raw_size, budget.max_total_bytes)

    def test_descriptor_bytes_count_against_total_budget(self):
        observer = self.bind()
        self.fs.parent.identity = replace(self.fs.parent.identity, bytes_read=16)
        observation = pc.observe_census(observer, budget=pc.Budget(max_total_bytes=31))
        self.assert_incomplete(observation)
        self.assertIsNone(observation.value.populated)
        self.assertFalse(self.records(observation, "read:cgroup.events"))
        self.assertTrue(any("descriptor read crossed total byte budget" in issue
                            for issue in observation.issues))

    def test_read_byte_accounting_is_not_physical_identity(self):
        observer = self.bind()
        self.fs.current_context = replace(self.fs.current_context, bytes_read=10)
        self.fs.parent.identity = replace(self.fs.parent.identity, bytes_read=1)
        self.fs.leaf.identity = replace(self.fs.leaf.identity, bytes_read=2)
        observation = pc.observe_census(observer)
        self.assertEqual(observation.status, pc.Status.COMPLETE, observation.issues)
        self.assertEqual(observation.value.populated, 0)
        self.assertEqual(observation.value.pids, ())

    def test_unknown_nlink_is_incomplete_without_escaping_exception(self):
        observer = self.bind()
        self.fs.parent.identity = replace(self.fs.parent.identity, nlink=None)
        self.assert_unavailable(pc.observe_closure(observer))

    def test_namespace_change_during_context_read_is_sticky(self):
        observer = self.bind()
        self.fs.fault_next("context", ValueError("mount namespace changed during context read"))
        first = pc.observe_census(observer)
        self.assert_incomplete(first)
        self.assertIn("mount namespace changed during context read",
                      self.records(first, "mount_context")[0].error)
        after = pc.observe_memory_peak(observer)
        self.assert_incomplete(after)
        self.assertIsNone(after.value.bytes)
        self.assertFalse(self.records(after, "read:memory.peak"))

    def test_pid_budget_rejects_census_without_zero_substitution(self):
        observer = self.bind()
        self.fs.leaf.files["cgroup.procs"] = b"1\n2\n3\n"
        observation = pc.observe_census(observer, budget=pc.Budget(max_pids=2))
        self.assert_incomplete(observation)
        self.assertIsNone(observation.value.pids)
        self.assertEqual(observation.value.populated, 0)

    def test_step_budget_stops_before_controller_read(self):
        observer = self.bind()
        observation = pc.observe_memory_peak(observer, budget=pc.Budget(max_steps=1))
        self.assert_incomplete(observation)
        self.assertIsNone(observation.value.bytes)
        self.assertFalse(self.records(observation, "read:memory.peak"))

    def test_deadline_failure_never_makes_present_empty(self):
        observer = self.bind()
        observation = pc.observe_closure(observer, budget=pc.Budget(timeout_ns=1))
        self.assert_unavailable(observation)
        self.assertTrue(any("deadline" in issue for issue in observation.issues))

    def test_lock_wait_is_inside_deadline_for_every_public_observation(self):
        for function in (pc.observe_limits, pc.observe_census,
                         pc.observe_memory_peak, pc.observe_closure):
            with self.subTest(function=function.__name__):
                self.reset_fixture()
                armed = threading.Event()
                session_started = threading.Event()
                result = {}

                def observed_clock():
                    # Python 3.12 Windows monotonic uses GetTickCount64 with
                    # 15.625 ms resolution. QPC is monotonic and resolves this
                    # 20 ms lock-wait assertion without weakening its bound.
                    value = time.perf_counter_ns()
                    if armed.is_set():
                        session_started.set()
                    return value

                self.clock = observed_clock
                observer = self.bind()
                calls_before = len(self.fs.calls)
                snapshots_before = self.source.count

                def observe_in_thread():
                    try:
                        result["observation"] = function(
                            observer, budget=pc.Budget(timeout_ns=20_000_000))
                    except BaseException as error:
                        result["error"] = error

                worker = threading.Thread(target=observe_in_thread, daemon=True)
                observer._lock.acquire()
                started_before_release = False
                try:
                    armed.set()
                    worker.start()
                    # The injected clock signals session creation. An API that
                    # starts its session only after acquiring the lock fails
                    # here; scheduling latency cannot be mistaken for wait.
                    started_before_release = session_started.wait(1.0)
                    threading.Event().wait(0.080)
                finally:
                    observer._lock.release()
                    worker.join(1.0)
                    armed.clear()
                self.assertFalse(worker.is_alive(), "observation worker did not terminate")
                self.assertTrue(started_before_release,
                                "observation session started after its lock wait")
                self.assertNotIn("error", result, result.get("error"))
                observation = result["observation"]
                self.assert_incomplete(observation)
                self.assertGreaterEqual(observation.finished_ns - observation.started_ns,
                                        20_000_000)
                self.assertEqual(len(self.fs.calls), calls_before,
                                 "filesystem was called after deadline expired waiting for lock")
                self.assertEqual(self.source.count, snapshots_before,
                                 "identity transport was called after lock-wait timeout")

    def test_lock_acquired_after_deadline_is_released_without_io(self):
        observer = self.bind()
        real_lock = observer._lock
        clock = self.clock

        class LateLock:
            def __init__(self):
                self.held = False
                self.acquisitions = 0
                self.releases = 0

            def acquire(self, timeout):
                self.acquisitions += 1
                self.held = True
                clock.advance(1001)
                return True

            def release(self):
                if not self.held:
                    raise RuntimeError("releasing an unheld fake lock")
                self.releases += 1
                self.held = False

        late_lock = LateLock()
        calls_before = len(self.fs.calls)
        snapshots_before = self.source.count
        observer._lock = late_lock
        try:
            observation = pc.observe_memory_peak(observer, budget=pc.Budget(timeout_ns=1000))
        finally:
            observer._lock = real_lock
        self.assert_incomplete(observation)
        self.assertIsNone(observation.value.bytes)
        self.assertEqual(late_lock.acquisitions, 1)
        self.assertEqual(late_lock.releases, 1)
        self.assertFalse(late_lock.held)
        self.assertEqual(len(self.fs.calls), calls_before)
        self.assertEqual(self.source.count, snapshots_before)
        release = self.records(observation, "release_observer_lock")[0]
        self.assertLessEqual(release.finished_ns, observation.finished_ns)
        self.assertTrue(self.records(observation, "acquire_observer_lock")[0].error)

    def test_late_handle_is_closed_even_if_acquisition_timed_out(self):
        self.fs.hook_next("open_root", lambda: self.clock.advance(1_000_000_001))
        result = self.bind_result()
        self.assert_incomplete(result.observation)
        self.assertIsNone(result.observer)
        self.assertFalse(self.fs.live_handles)
        self.assertTrue(any("deadline" in issue for issue in result.observation.issues))

    def test_late_named_leaf_handle_is_closed_and_never_adopted(self):
        observer = self.bind()
        self.fs.hook_next("open_dir_at:slot", lambda: self.clock.advance(1_000_000_001))
        observation = pc.observe_closure(observer)
        self.assert_unavailable(observation)
        self.assertEqual(len(self.fs.live_handles), 2)
        self.assertTrue(all(h.node in (self.fs.leaf, self.fs.parent)
                            for h in self.fs.live_handles))
        self.assertNotIsInstance(self.records(observation, "lookup_exact_leaf")[0].value,
                                 Handle)

    def test_context_reads_count_against_total_byte_budget(self):
        self.fs.current_context = replace(self.fs.current_context, bytes_read=24)
        result = self.bind_result(budget=pc.Budget(max_total_bytes=47))
        self.assert_incomplete(result.observation)
        self.assertIsNone(result.observer)
        self.assertFalse(self.fs.live_handles)
        self.assertTrue(any("byte budget" in issue for issue in result.observation.issues))

    def test_invalid_context_fields_fail_closed(self):
        cases = ({"namespace_device": True}, {"namespace_inode": 0},
                 {"boot_id": "not-a-boot-uuid"}, {"mounts": (object(),)},
                 {"bytes_read": -1}, {"bytes_read": True})
        for change in cases:
            with self.subTest(change=change):
                self.reset_fixture()
                self.fs.current_context = replace(self.fs.current_context, **change)
                result = self.bind_result()
                self.assert_incomplete(result.observation)
                self.assertIsNone(result.observer)
                self.assertFalse(self.fs.live_handles)

    def test_close_failure_is_evidence_and_close_is_never_retried(self):
        observer = self.bind()
        original_leaf_handle = next(h for h in self.fs.live_handles if h.node is self.fs.leaf)
        self.fs.hook_next("close:leaf", lambda: setattr(original_leaf_handle, "closed", True))
        self.fs.fault_next("close:leaf", OSError(errno.EINTR, "ambiguous close after release"))
        observation = observer.close()
        self.assert_incomplete(observation)
        failures = [r for r in self.records(observation, "close_internal_handle") if r.error]
        self.assertEqual(len(failures), 1)
        self.assertEqual(failures[0].errno, errno.EINTR)
        count = self.fs.counts["close:leaf"]
        observer.close()
        self.assertEqual(self.fs.counts["close:leaf"], count)
        self.assertFalse(self.fs.live_handles)

    def test_ephemeral_close_failure_invalidates_closure(self):
        observer = self.bind()
        self.fs.hook_next("close:root", lambda: setattr(
            next(h for h in reversed(self.fs.handles) if not h.closed and h.node is self.fs.root),
            "closed", True))
        self.fs.fault_next("close:root", OSError(errno.EINTR, "ambiguous ephemeral close"))
        observation = pc.observe_closure(observer)
        self.assert_unavailable(observation)
        self.assertTrue(any(r.errno == errno.EINTR for r in observation.evidence))
        self.assertEqual(len(self.fs.live_handles), 2)

    def test_close_is_idempotent_and_invalidates_observer(self):
        observer = self.bind()
        observer.close()
        observer.close()
        self.assertFalse(self.fs.live_handles)
        observation = pc.observe_memory_peak(observer)
        self.assert_incomplete(observation)
        self.assertIsNone(observation.value.bytes)

    def test_fork_inherited_observer_is_rejected(self):
        observer = self.bind()
        with patch.object(pc.os, "getpid", return_value=observer._pid + 1):
            self.assert_unavailable(pc.observe_closure(observer))

    def test_public_api_rejects_raw_fd_instead_of_adopting_it(self):
        with self.assertRaises((TypeError, AttributeError)):
            pc.observe_census(37)
        with self.assertRaises(TypeError):
            pc.bind_before_go(self.expected, self.source, filesystem=self.fs,
                              clock=self.clock, leaf_fd=37)

    def test_external_constructor_cannot_adopt_caller_handles(self):
        observer = self.bind()
        with self.assertRaises(TypeError):
            pc.BoundCgroup(self.fs, self.source, observer.binding, 37, 38,
                           observer.binding_ref, self.clock, pc.Budget(),
                           "injected-filesystem")


class ParserTests(unittest.TestCase):
    def test_validator_does_not_double_count_descriptor_metadata(self):
        clock = FakeClock()
        session = pc._Session("metadata_accounting", pc.Budget(max_total_bytes=150),
                              clock, None, "injected-filesystem")
        identity = pc.NodeIdentity(44, 200, 31, pc.CGROUP2_SUPER_MAGIC, 2,
                                   bytes_read=100)
        value, _ = session.call("descriptor_identity", lambda: identity,
                                metadata_read=True)
        session.call("validate_descriptor_identity", lambda: pc._validate_node(value))
        observation = session.finish(value)
        self.assertEqual(session.total_bytes, 100)
        self.assertEqual(observation.status, pc.Status.COMPLETE, observation.issues)
        self.assertIs(observation.value, identity)

    def test_decimal_peak_rejects_noncanonical_unknown_and_overflow(self):
        cases = (b"", b"max\n", b"+1\n", b"-1\n", b"01\n", b" 1\n",
                 b"1 \n", b"1\n2\n", b"1\r\n", b"1\x00", b"1\n\n",
                 b"18446744073709551616\n", b"9" * 1000, b"\xff")
        for data in cases:
            with self.subTest(data=data[:40]):
                with self.assertRaises(ValueError):
                    pc._number(data)
        self.assertEqual(pc._number(b"0\n"), 0)
        self.assertEqual(pc._number(b"18446744073709551615\n"), (1 << 64) - 1)

    def test_events_reject_unknown_population_duplicates_and_bad_newlines(self):
        cases = (b"", b"frozen 0\n", b"populated 2\n", b"populated -1\n",
                 b"populated 0\npopulated 0\n", b"populated 0 \n",
                 b"populated\t0\n", b"populated 0\r\n", b"populated 0\n\n",
                 b"populated 0\x00\n", b"populated 0\nfrozen 2\n",
                 b"populated 0\nbad 18446744073709551616\n")
        for data in cases:
            with self.subTest(data=data[:40]):
                with self.assertRaises(ValueError):
                    pc._events(data)
        self.assertEqual(pc._events(b"populated 0\nfrozen 0\n"), 0)

    def test_pid_parser_rejects_invalid_ids_and_bad_newlines(self):
        for data in (b"0\n", b"2147483648\n", b"-1\n", b"01\n", b"1 2\n",
                     b"1\r\n", b"1\n\n", b"\x001\n", b"1\x0b2\n"):
            with self.subTest(data=data):
                with self.assertRaises(ValueError):
                    pc._pids(data, 10)
        self.assertEqual(pc._pids(b"", 10), ())
        self.assertEqual(pc._pids(b"2147483647\n", 10), (2147483647,))

    def test_budget_rejects_bool_zero_negative_and_nonintegers(self):
        for name in pc.Budget.__dataclass_fields__:
            for value in (True, 0, -1, 1.5, "2"):
                with self.subTest(name=name, value=value):
                    with self.assertRaises(ValueError):
                        pc.Budget(**{name: value})

    def test_mountinfo_parser_preserves_cgroup2_identity_and_escapes(self):
        data = (b"12 1 8:1 / / rw - ext4 /dev/root rw\n"
                b"31 12 0:44 / /sys/fs/cgroup\\040pilot rw shared:8 - cgroup2 cgroup rw\n")
        mounts = pc.LinuxFilesystem._mounts(data)
        self.assertEqual(len(mounts), 1)
        self.assertEqual(mounts[0].mount_id, 31)
        self.assertEqual(mounts[0].mount_point, "/sys/fs/cgroup pilot")
        self.assertEqual(mounts[0].optional_fields, ("shared:8",))

    def test_mountinfo_parser_rejects_duplicate_ids_and_malformed_records(self):
        record = b"31 12 0:44 / /sys/fs/cgroup rw - cgroup2 cgroup rw\n"
        for data in (record + record, b"missing separator\n",
                     b"0 12 0:44 / /x rw - cgroup2 cgroup rw\n",
                     b"31 12 wrong / /x rw - cgroup2 cgroup rw\n",
                     b"31 12 0:44 / /x\\999 rw - cgroup2 cgroup rw\n",
                     b"\xff"):
            with self.subTest(data=data[:60]):
                with self.assertRaises((ValueError, UnicodeDecodeError)):
                    pc.LinuxFilesystem._mounts(data)

    def test_linux_backend_refuses_windows_before_syscalls(self):
        backend = pc.LinuxFilesystem()
        with patch.object(pc.sys, "platform", "win32"), patch.object(pc.os, "open") as open_mock:
            for function in (lambda: backend.open_root(1 << 63),
                             lambda: backend.open_dir_at(37, "slot", 1 << 63),
                             lambda: backend.identity(37, 1 << 63),
                             lambda: backend.read_at(37, "memory.peak", 32, 1 << 63),
                             lambda: backend.context(4096, 1 << 63)):
                with self.subTest(function=function):
                    with self.assertRaises(OSError) as caught:
                        function()
                    self.assertEqual(caught.exception.errno, errno.ENOSYS)
            open_mock.assert_not_called()


class RuntimePhysicalObserverTests(unittest.TestCase):
    """Final-contract adapter using real validators and injected facts only."""

    @classmethod
    def setUpClass(cls):
        import hashlib
        import os

        supplied = os.environ.get("ELOGISTIX_CONTRACTS_PATH")
        contract_path = Path(supplied) if supplied else MODULE_PATH.with_name("contracts.py")
        if not contract_path.is_file():
            raise AssertionError("final contracts.py must be supplied explicitly or adjacent to physical_cgroup.py")
        cls.assert_contract_sha = hashlib.sha256(contract_path.read_bytes()).hexdigest()
        if cls.assert_contract_sha != "2dcfd29d4938820dcd38e7eef51e4717aa4a3b446f82e8dd2428f449b56f3f8d":
            raise AssertionError("adapter tests require the verified final central contract")
        contract_spec = importlib.util.spec_from_file_location("contracts", contract_path)
        assert contract_spec is not None and contract_spec.loader is not None
        cls.C = importlib.util.module_from_spec(contract_spec)
        sys.modules[contract_spec.name] = cls.C
        contract_spec.loader.exec_module(cls.C)

    def setUp(self):
        self.clock = FakeClock()
        self.fs = FakeFilesystem(self.clock)
        self.fs.leaf.files["memory.max"] = str(self.C.MEMORY_MAX_BYTES).encode("ascii") + b"\n"
        self.fs.leaf.files["cgroup.events"] = b"populated 1\nfrozen 0\n"
        self.fs.leaf.files["cgroup.procs"] = b"77\n"
        self.generation = {
            "pid": 77, "start_ticks": "700",
            "boot_id": self.fs.current_context.boot_id,
            "pid_namespace_ref": "pid:[500]", "mount_namespace_ref": "mnt:[600]",
        }
        manager_generation = dict(self.generation, pid=1, start_ticks="100")
        self.manager_mapping = {
            "boot_id": self.fs.current_context.boot_id, "bus_guid": "b" * 32,
            "owner_unique_name": ":1.42", "manager_pid_generation": manager_generation,
            "authority_lease_until_us": "70000000",
        }
        self.spec = self.C.RunSpec(
            run="a" * 32, t0_us=0, work_deadline_us=self.C.WORK_US,
            cleanup_deadline_us=self.C.CLEANUP_US,
            slots=tuple(self.C.SlotSpec(index,
                        "elogistix-memory-adapter-" + str(index + 1) * 32 + ".service",
                        scenario) for index, scenario in enumerate(self.C.SCENARIOS)),
            load_uid=1000, load_gid=1000, load_groups=(),
            payload_expected_sha256="e" * 64, cleanup_policy_id=self.C.CLEANUP_POLICY_ID,
            scope_ref="scope:fixture",
        )
        self.unit = self.C.UnitBinding.from_mapping({
            "slot": 0, "name": self.spec.slots[0].unit_name,
            "object_path": "/org/freedesktop/systemd1/unit/fixture",
            "invocation_id": "c" * 32,
            "manager_binding_ref": self.C.digest_record(self.manager_mapping),
            "control_group": "/pilot/slot", "control_group_id": "987654321",
            "keeper_generation_ref": self.C.digest_record(self.generation),
        })
        self.expected = manager(unit=self.unit.values["name"],
                                unit_binding_ref=self.C.digest_record(self.unit))
        self.source = FakeIdentitySource(self.expected)
        self.manager_calls = []
        self.identity_factory_calls = []
        self.keeper_calls = []
        self.factory_calls = []
        self.manager_hook = None
        self.keeper_hook = None
        self.keeper_current = dict(self.generation)
        self.manager_result = None
        self.keeper_result = None
        self.absence_enabled = True
        self.policy_result = None
        self.adapters = []

    def tearDown(self):
        for adapter in self.adapters:
            close = getattr(adapter, "close", None)
            if close is not None:
                close()

    def manager_binding(self, deadline_ns):
        self.manager_calls.append(deadline_ns)
        if self.manager_hook is not None:
            self.manager_hook()
        if self.manager_result is not None:
            return self.manager_result
        return self.C.ManagerBinding.from_mapping(self.manager_mapping)

    def identity_source(self, unit_mapping, deadline_ns):
        self.identity_factory_calls.append((unit_mapping, deadline_ns))
        return self.source

    def keeper_observation(self, generation_mapping, deadline_ns):
        self.keeper_calls.append((generation_mapping, deadline_ns))
        before = self.clock()
        if self.keeper_hook is not None:
            self.keeper_hook()
        after = self.clock()
        if self.keeper_result is not None:
            return self.keeper_result
        return pc.KeeperObservation(dict(self.keeper_current), before, after, "4" * 64)

    def absence_policy(self, binding_ref, binding, deadline_ns):
        if not self.absence_enabled:
            return None
        if self.policy_result is not None:
            return self.policy_result
        return pc.AbsencePolicy(
            "fixture-policy", "policy:fixture:1", binding_ref,
            frozenset({"rename", "replacement", "migration"}), 0,
            int(self.manager_mapping["authority_lease_until_us"]) * 1000)

    def new_adapter(self, **producer_changes):
        fields = dict(manager_binding=self.manager_binding,
                      identity_source=self.identity_source,
                      keeper_observation=self.keeper_observation,
                      absence_policy=self.absence_policy, filesystem=self.fs,
                      clock=self.clock, budget=pc.Budget())
        fields.update(producer_changes)

        def factory(spec):
            self.factory_calls.append(spec)
            return pc.PhysicalProducer(**fields)

        adapter = pc.RuntimePhysicalObserver(self.spec, producer_factory=factory)
        self.adapters.append(adapter)
        return adapter

    def bind(self, adapter=None):
        adapter = adapter or self.new_adapter()
        root = adapter.preflight(self.spec)
        self.assertIsInstance(root, self.C.ObserverRootBinding)
        physical = adapter.bind_leaf(self.unit, self.generation, self.spec.work_deadline_us)
        self.assertIsInstance(physical, self.C.PhysicalBinding)
        return adapter, physical

    def call_counts(self):
        return (len(self.fs.calls), len(self.manager_calls),
                len(self.identity_factory_calls), len(self.keeper_calls), self.source.count)

    def assert_adapter_error(self, function, code=None):
        with self.assertRaises(pc.AdapterError) as caught:
            function()
        if code is not None:
            self.assertEqual(caught.exception.code, code)
        return caught.exception

    def records(self, adapter):
        import hashlib
        import json

        exported = adapter.export_evidence()
        self.assertEqual(set(exported), {"fixture_only", "records"})
        self.assertIs(exported["fixture_only"], True)
        records = exported["records"]
        self.assertIsInstance(records, list)
        for entry in records:
            self.assertEqual(set(entry), {"ref", "record"})
            payload = json.dumps(entry["record"], ensure_ascii=False, sort_keys=True,
                                 separators=(",", ":"), allow_nan=False).encode("utf-8")
            self.assertEqual(entry["ref"], hashlib.sha256(payload).hexdigest())
        return {entry["ref"]: entry["record"] for entry in records}

    def backend_receipts(self):
        """Only reference retention is claimed; settlement policy stays external."""
        start = {"kind": "fixture-start", "state": "UNKNOWN", "sequence": 1}
        stop = {"kind": "fixture-stop", "state": "UNKNOWN", "sequence": 2}
        final = {"kind": "fixture-final-unit", "state": "UNKNOWN", "sequence": 3}
        return {
            "start_receipt": start, "start_settlement_ref": self.C.digest_record(start),
            "stop_receipt": stop, "stop_settlement_ref": self.C.digest_record(stop),
            "final_unit_receipt": final,
            "final_unit_receipt_ref": self.C.digest_record(final),
            "keeper_reap_receipt": {"kind": "fixture-keeper-reap", "state": "UNKNOWN"},
            "start_settled": False, "stop_settled": False, "reap_accepted": False,
        }

    def cleanup(self, adapter, physical, receipts=None):
        return adapter.probe_cleanup(physical, self.unit,
            self.backend_receipts() if receipts is None else receipts, "6" * 64,
            self.spec.cleanup_deadline_us)

    def correlated_cleanup_proof(self, adapter, physical, evidence):
        proof = adapter.cleanup_proof(evidence, physical, self.spec.cleanup_deadline_us)
        binding = self.original_binding_proof(adapter, physical)
        self.C.validate_cleanup_proof(proof.to_mapping(), binding.to_mapping(),
                                      evidence.to_mapping(), physical.to_mapping())
        return proof

    def original_binding_proof(self, adapter, physical):
        expected_keys = {"physical_binding_ref", "original_leaf_identity",
                         "original_parent_identity", "before_us", "after_us"}
        matches = [record for record in self.records(adapter).values()
                   if set(record) == expected_keys and
                   record["physical_binding_ref"] == self.C.digest_record(physical)]
        self.assertEqual(len(matches), 1)
        self.C.validate_binding_proof(matches[0], physical.to_mapping())
        return self.C.BindingProof.from_mapping(matches[0])

    def replace_cgroup_root_path(self):
        """Substitute the named mount root, retaining the exact parent/leaf subtree."""
        mount_parent = self.fs.root.children["sys"].children["fs"]
        original = mount_parent.children["cgroup"]
        replacement = self.fs._new_node("replacement-cgroup-root")
        replacement.children.update(original.children)
        mount_parent.children["cgroup"] = replacement
        return original

    def test_no_producer_constructor_is_inert_and_preflight_fails_closed(self):
        adapter = pc.RuntimePhysicalObserver(self.spec, producer_factory=None)
        self.adapters.append(adapter)
        self.assertEqual(self.call_counts(), (0, 0, 0, 0, 0))
        self.assert_adapter_error(lambda: adapter.preflight(self.spec), "DEPENDENCY_MISSING")
        self.assertEqual(self.call_counts(), (0, 0, 0, 0, 0))

    def test_factory_boolean_cannot_supply_physical_authority(self):
        adapter = pc.RuntimePhysicalObserver(self.spec, producer_factory=lambda spec: True)
        self.adapters.append(adapter)
        self.assert_adapter_error(lambda: adapter.preflight(self.spec))
        self.assertFalse(self.fs.calls)

    def test_preflight_exports_full_original_cgroup_root_and_fixture_origin(self):
        adapter = self.new_adapter()
        root = adapter.preflight(self.spec)
        self.assertIsInstance(root, self.C.ObserverRootBinding)
        value = self.C.validate_observer_root_binding(root.to_mapping())
        identity = value["original_root_identity"]
        self.assertEqual(identity["cgroup_path"], "/")
        self.assertEqual(identity["mount_namespace_ref"], "mnt:[600]")
        self.assertEqual(identity["mount_id"], "31")
        self.assertEqual(identity["inode"], str(
            self.fs.root.children["sys"].children["fs"].children["cgroup"].identity.inode))
        self.assertTrue(adapter.fixture_only)
        self.assertIn(self.C.digest_record(root), self.records(adapter))

    def test_bind_returns_real_contract_record_and_full_correlated_proof(self):
        adapter, physical = self.bind()
        value = self.C.validate_physical_binding(physical.to_mapping())
        self.assertEqual(value["unit_binding_ref"], self.C.digest_record(self.unit))
        self.assertEqual(value["control_group_id"], "987654321")
        self.assertEqual(value["inode"], str(self.fs.leaf.identity.inode))
        self.assertNotEqual(value["control_group_id"], value["inode"])
        self.assertTrue(value["physical_ref"].startswith("leaf:"))
        self.assertTrue(value["parent_ref"].startswith("parent:"))
        proof = adapter.binding_proof(physical, self.spec.work_deadline_us)
        self.assertIsInstance(proof, self.C.BindingProof)
        validated = self.C.validate_binding_proof(proof.to_mapping(), physical.to_mapping())
        self.assertEqual(validated["physical_binding_ref"], self.C.digest_record(physical))
        self.assertEqual(validated["original_parent_identity"]["cgroup_path"], "/pilot")
        self.assertIn(self.C.digest_record(proof), self.records(adapter))

    def test_foreign_registry_tokens_and_modified_binding_are_rejected_without_io(self):
        adapter, physical = self.bind()
        for changes in ({"physical_ref": "leaf:foreign"}, {"parent_ref": "parent:foreign"},
                        {"inode": str(self.fs.leaf.identity.inode + 1)},
                        {"control_group_id": "987654322"}):
            with self.subTest(changes=changes):
                altered = dict(physical.to_mapping(), **changes)
                before = len(self.fs.calls), self.source.count
                self.assert_adapter_error(lambda: adapter.binding_proof(
                    altered, self.spec.work_deadline_us))
                self.assertEqual((len(self.fs.calls), self.source.count), before)

    def test_other_observer_cannot_adopt_same_filesystem_physical_binding(self):
        adapter, physical = self.bind()
        other = self.new_adapter()
        other.preflight(self.spec)
        before = len(self.fs.calls), self.source.count
        self.assert_adapter_error(lambda: other.binding_proof(
            physical, self.spec.work_deadline_us))
        self.assertEqual((len(self.fs.calls), self.source.count), before)

    def test_bind_requires_keeper_generation_from_unit_binding(self):
        adapter = self.new_adapter()
        adapter.preflight(self.spec)
        altered = dict(self.generation, start_ticks="701")
        before = len(self.fs.calls), self.source.count
        self.assert_adapter_error(lambda: adapter.bind_leaf(
            self.unit, altered, self.spec.work_deadline_us))
        self.assertEqual(self.source.count, before[1])
        self.assertFalse(any(name in ("open_dir_at:slot", "identity:leaf",
                                     "read_at:cgroup.procs")
                             for name, _, _ in self.fs.calls[before[0]:]))

    def test_bind_rejects_authenticated_keeper_snapshot_for_another_generation(self):
        self.keeper_current["start_ticks"] = "701"
        adapter = self.new_adapter()
        adapter.preflight(self.spec)
        self.assert_adapter_error(lambda: adapter.bind_leaf(
            self.unit, self.generation, self.spec.work_deadline_us))

    def test_keeper_boolean_and_stale_snapshot_never_enable_sampling(self):
        for result in (True, pc.KeeperObservation(dict(self.generation), 0, 1, "4" * 64)):
            with self.subTest(result=result):
                self.keeper_result = result
                adapter = self.new_adapter()
                adapter.preflight(self.spec)
                self.assert_adapter_error(lambda: adapter.bind_leaf(
                    self.unit, self.generation, self.spec.work_deadline_us))

    def test_peak_sample_passes_real_validator_and_preserves_checkpoint_refs(self):
        adapter, physical = self.bind()
        sample = adapter.sample_peak(physical, self.generation, "5" * 64,
                                     self.spec.work_deadline_us)
        self.assertIsInstance(sample, self.C.MemorySample)
        value = self.C.validate_memory_sample(sample.to_mapping())
        self.assertEqual(value["bytes"], "8192")
        self.assertEqual(value["ledger_checkpoint_ref"], "5" * 64)
        self.assertEqual(value["unit_binding_ref"], self.C.digest_record(self.unit))
        self.assertEqual(value["physical_binding_ref"], self.C.digest_record(physical))
        self.assertEqual(value["keeper_generation_ref"], self.C.digest_record(self.generation))
        self.assertEqual(value["identity_before_ref"], value["identity_after_ref"])
        exported = self.records(adapter)
        self.assertIn(value["identity_before_ref"], exported)
        self.assertIn(self.C.digest_record(sample), exported)

    def test_unknown_peak_never_becomes_a_zero_sample(self):
        for raw in (b"max\n", b"\n", b"-1\n", b"8192\ntrailing\n"):
            with self.subTest(raw=raw):
                adapter, physical = self.bind()
                self.fs.leaf.files["memory.peak"] = raw
                self.assert_adapter_error(lambda: adapter.sample_peak(
                    physical, self.generation, "5" * 64, self.spec.work_deadline_us))
                self.assertFalse(any(record.get("metric") == "memory.peak"
                                     for record in self.records(adapter).values()))
                self.fs.leaf.files["memory.peak"] = b"8192\n"

    def test_missing_controller_and_unknown_census_do_not_produce_samples(self):
        adapter, physical = self.bind()
        self.fs.fault_next("read_at:memory.peak", FileNotFoundError(errno.ENOENT, "controller"))
        self.assert_adapter_error(lambda: adapter.sample_peak(
            physical, self.generation, "5" * 64, self.spec.work_deadline_us))
        self.fs.leaf.files["cgroup.events"] = b"frozen 0\n"
        self.assert_adapter_error(lambda: adapter.sample_peak(
            physical, self.generation, "5" * 64, self.spec.work_deadline_us))

    def test_keeper_must_remain_in_direct_census_for_peak_sample(self):
        adapter, physical = self.bind()
        self.fs.leaf.files["cgroup.procs"] = b"88\n"
        self.assert_adapter_error(lambda: adapter.sample_peak(
            physical, self.generation, "5" * 64, self.spec.work_deadline_us))

    def test_keeper_identity_changes_during_peak_sampling_fail_closed(self):
        adapter, physical = self.bind()
        self.keeper_current["start_ticks"] = "701"
        self.assert_adapter_error(lambda: adapter.sample_peak(
            physical, self.generation, "5" * 64, self.spec.work_deadline_us))

    def test_expired_deadline_rejects_bind_before_producer_or_filesystem_io(self):
        adapter = self.new_adapter()
        adapter.preflight(self.spec)
        before = self.call_counts()
        self.assert_adapter_error(lambda: adapter.bind_leaf(
            self.unit, self.generation, self.clock.now // 1000), "DEADLINE")
        self.assertEqual(self.call_counts(), before)

    def test_expired_deadline_rejects_peak_without_io(self):
        adapter, physical = self.bind()
        before = self.call_counts()
        self.assert_adapter_error(lambda: adapter.sample_peak(
            physical, self.generation, "5" * 64, self.clock.now // 1000), "DEADLINE")
        self.assertEqual(self.call_counts(), before)

    def test_expired_original_work_deadline_rejects_peak_despite_later_argument(self):
        adapter, physical = self.bind()
        self.clock.now = self.spec.work_deadline_us * 1000
        before = self.call_counts()
        self.assert_adapter_error(lambda: adapter.sample_peak(
            physical, self.generation, "5" * 64, self.spec.cleanup_deadline_us), "DEADLINE")
        self.assertEqual(self.call_counts(), before)

    def test_expired_authority_lease_rejects_peak_without_io(self):
        adapter, physical = self.bind()
        self.clock.now = int(self.manager_mapping["authority_lease_until_us"]) * 1000
        before = self.call_counts()
        self.assert_adapter_error(lambda: adapter.sample_peak(
            physical, self.generation, "5" * 64, self.clock.now // 1000 + 1_000_000), "DEADLINE")
        self.assertEqual(self.call_counts(), before)

    def test_keeper_callback_exceeding_deadline_cannot_start_filesystem_sampling(self):
        adapter, physical = self.bind()
        deadline_us = self.clock.now // 1000 + 1000
        calls_at_expiry = []

        def expire():
            calls_at_expiry.append(len(self.fs.calls))
            self.clock.now = deadline_us * 1000 + 1

        self.keeper_hook = expire
        self.assert_adapter_error(lambda: adapter.sample_peak(
            physical, self.generation, "5" * 64, deadline_us), "DEADLINE")
        self.assertEqual(len(calls_at_expiry), 1)
        self.assertEqual(len(self.fs.calls), calls_at_expiry[0])

    def test_manager_boolean_never_establishes_root_authority(self):
        self.manager_result = True
        adapter = self.new_adapter()
        self.assert_adapter_error(lambda: adapter.preflight(self.spec))
        self.assertFalse(self.fs.calls)

    def test_present_empty_is_real_direct_read_with_full_correlated_closure_proof(self):
        adapter, physical = self.bind()
        self.fs.leaf.files["cgroup.events"] = b"populated 0\nfrozen 0\n"
        self.fs.leaf.files["cgroup.procs"] = b""
        self.absence_enabled = False
        evidence = self.cleanup(adapter, physical)
        self.assertIsInstance(evidence, self.C.CleanupEvidence)
        value = self.C.validate_cleanup_evidence(evidence.to_mapping())
        self.assertEqual(value["physical"]["tag"], "PresentEmpty")
        self.assertEqual(value["physical"]["populated"], 0)
        proof = self.correlated_cleanup_proof(adapter, physical, evidence)
        self.assertIsInstance(proof, self.C.ClosureProof)
        operation = proof.values["operation"]
        self.assertEqual(operation["kind"], "DIRECT_EVENTS_EMPTY")
        self.assertEqual(operation["populated"], 0)
        self.assertEqual(proof.values["original_identity"]["cgroup_path"], "/pilot/slot")
        self.assertEqual(value["identity_brackets_ref"], self.C.digest_record(proof))

    def test_removed_original_leaf_requires_policy_and_uses_original_parent_proof(self):
        adapter, physical = self.bind()
        binding = adapter.binding_proof(physical, self.spec.work_deadline_us)
        self.fs.detach_leaf()
        evidence = self.cleanup(adapter, physical)
        self.assertEqual(evidence.values["physical"]["tag"], "OriginalAbsent")
        self.assertIsNone(evidence.values["physical"]["populated"])
        proof = adapter.cleanup_proof(evidence, physical, self.spec.cleanup_deadline_us)
        self.assertIsInstance(proof, self.C.ClosureProof)
        self.C.validate_cleanup_proof(proof.to_mapping(), binding.to_mapping(),
                                      evidence.to_mapping(), physical.to_mapping())
        self.assertEqual(proof.values["original_identity"]["cgroup_path"], "/pilot")
        self.assertEqual(proof.values["operation"]["kind"], "OPENAT_ORIGINAL_ABSENT")
        self.assertEqual(proof.values["operation"]["errno"], "ENOENT")

    def test_leaf_absence_without_external_policy_is_typed_unavailable(self):
        adapter, physical = self.bind()
        binding = adapter.binding_proof(physical, self.spec.work_deadline_us)
        self.absence_enabled = False
        self.fs.detach_leaf()
        evidence = self.cleanup(adapter, physical)
        fact = evidence.values["physical"]
        self.assertEqual(fact["tag"], "Unavailable")
        self.assertIsNone(fact["populated"])
        proof = adapter.cleanup_proof(evidence, physical, self.spec.cleanup_deadline_us)
        self.assertIsInstance(proof, self.C.ClosureUnavailable)
        self.C.validate_cleanup_proof(proof.to_mapping(), binding.to_mapping(),
                                      evidence.to_mapping(), physical.to_mapping())
        self.assertEqual(set(proof.values),
                         {"tag", "physical_binding_ref", "reason", "observation_ref"})
        self.assertEqual(evidence.values["identity_brackets_ref"], self.C.digest_record(proof))

    def test_renamed_linked_original_leaf_cannot_be_absent_under_valid_policy(self):
        adapter, physical = self.bind()
        self.fs.rename_leaf()
        evidence = self.cleanup(adapter, physical)
        self.assertEqual(evidence.values["physical"]["tag"], "Unavailable")
        self.assertIsNone(evidence.values["physical"]["populated"])
        proof = adapter.cleanup_proof(evidence, physical, self.spec.cleanup_deadline_us)
        self.assertIsInstance(proof, self.C.ClosureUnavailable)
        self.assertEqual(proof.values["reason"], "IDENTITY_CHANGED")

    def test_live_population_is_unavailable_and_none_in_closed_wire_records(self):
        adapter, physical = self.bind()
        evidence = self.cleanup(adapter, physical)
        fact = evidence.values["physical"]
        self.assertEqual(fact["tag"], "Unavailable")
        self.assertIsNone(fact["populated"])
        self.assertIn("PHYSICAL_OBSERVATION", evidence.values["missing_evidence"])
        proof = adapter.cleanup_proof(evidence, physical, self.spec.cleanup_deadline_us)
        self.assertIsInstance(proof, self.C.ClosureUnavailable)
        self.C.validate_cleanup_proof(proof.to_mapping(), evidence=evidence.to_mapping(),
                                      physical=physical.to_mapping())
        with self.assertRaises(self.C.ContractError):
            self.C.validate_closure_proof(proof.to_mapping())
        exported = self.records(adapter)
        self.assertIn(fact["observation_ref"], exported)
        self.assertIn(self.C.digest_record(proof), exported)

    def test_controller_enoent_permission_io_timeout_remain_unavailable(self):
        faults = (
            FileNotFoundError(errno.ENOENT, "events controller absent"),
            PermissionError(errno.EACCES, "events permission"),
            OSError(errno.EIO, "events I/O"),
            TimeoutError(errno.ETIMEDOUT, "events timeout"),
        )
        for fault in faults:
            with self.subTest(fault=fault):
                adapter, physical = self.bind()
                self.fs.fault_next("read_at:cgroup.events", fault)
                evidence = self.cleanup(adapter, physical)
                fact = evidence.values["physical"]
                self.assertEqual(fact["tag"], "Unavailable")
                self.assertIsNone(fact["populated"])
                proof = adapter.cleanup_proof(evidence, physical, self.spec.cleanup_deadline_us)
                self.assertIsInstance(proof, self.C.ClosureUnavailable)
                self.C.validate_closure_unavailable(proof.to_mapping(), evidence.to_mapping(),
                                                    physical.to_mapping())

    def test_full_backend_receipts_are_retained_and_refs_do_not_come_from_flags(self):
        adapter, physical = self.bind()
        receipts = self.backend_receipts()
        self.fs.leaf.files["cgroup.events"] = b"populated 0\nfrozen 0\n"
        self.fs.leaf.files["cgroup.procs"] = b""
        evidence = self.cleanup(adapter, physical, receipts)
        value = evidence.to_mapping()
        self.assertEqual(value["start_settlement_ref"],
                         self.C.digest_record(receipts["start_receipt"]))
        self.assertEqual(value["stop_settlement_ref"],
                         self.C.digest_record(receipts["stop_receipt"]))
        self.assertEqual(value["final_unit_observation_ref"],
                         self.C.digest_record(receipts["final_unit_receipt"]))
        self.assertEqual(value["reap_ledger_ref"], "6" * 64)
        self.assertEqual(value["physical"]["tag"], "PresentEmpty")
        retained = self.records(adapter)
        self.assertEqual(retained[self.C.digest_record(receipts)], receipts)
        self.assertFalse(retained[self.C.digest_record(receipts)]["reap_accepted"])

    def test_missing_or_modified_receipt_refs_fail_before_physical_io(self):
        adapter, physical = self.bind()
        for key in ("start_receipt", "start_settlement_ref", "stop_receipt",
                    "stop_settlement_ref", "final_unit_receipt", "final_unit_receipt_ref"):
            with self.subTest(key=key):
                receipts = self.backend_receipts()
                receipts.pop(key)
                before = len(self.fs.calls)
                self.assert_adapter_error(lambda: self.cleanup(adapter, physical, receipts),
                                          "TRANSPORT_UNKNOWN")
                self.assertEqual(len(self.fs.calls), before)
        receipts = self.backend_receipts()
        receipts["stop_settlement_ref"] = "f" * 64
        before = len(self.fs.calls)
        self.assert_adapter_error(lambda: self.cleanup(adapter, physical, receipts),
                                  "TRANSPORT_UNKNOWN")
        self.assertEqual(len(self.fs.calls), before)

    def test_cleanup_rejects_an_opaque_settlement_reference_and_boolean_receipts(self):
        adapter, physical = self.bind()
        for receipts in ("7" * 64, True, {"start_settled": True, "stop_settled": True}):
            with self.subTest(receipts=receipts):
                before = len(self.fs.calls)
                self.assert_adapter_error(lambda: self.cleanup(adapter, physical, receipts))
                self.assertEqual(len(self.fs.calls), before)

    def test_cleanup_proof_retrieves_exact_old_operation_without_new_filesystem_io(self):
        adapter, physical = self.bind()
        binding = adapter.binding_proof(physical, self.spec.work_deadline_us)
        self.fs.leaf.files["cgroup.events"] = b"populated 0\nfrozen 0\n"
        self.fs.leaf.files["cgroup.procs"] = b""
        first = self.cleanup(adapter, physical)
        first_proof = adapter.cleanup_proof(first, physical, self.spec.cleanup_deadline_us)
        self.clock.advance(10_000)
        self.fs.detach_leaf()
        second = self.cleanup(adapter, physical)
        second_proof = adapter.cleanup_proof(second, physical, self.spec.cleanup_deadline_us)
        self.assertEqual(second.values["physical"]["tag"], "OriginalAbsent")
        self.assertNotEqual(self.C.digest_record(first_proof), self.C.digest_record(second_proof))
        before = len(self.fs.calls)
        retrieved = adapter.cleanup_proof(first, physical, self.spec.cleanup_deadline_us)
        self.assertEqual(retrieved.to_mapping(), first_proof.to_mapping())
        self.assertEqual(len(self.fs.calls), before)
        self.C.validate_cleanup_proof(retrieved.to_mapping(), binding.to_mapping(),
                                      first.to_mapping(), physical.to_mapping())

    def test_cleanup_proof_rejects_tampered_evidence_without_new_filesystem_io(self):
        adapter, physical = self.bind()
        evidence = self.cleanup(adapter, physical)
        altered = dict(evidence.to_mapping(), identity_brackets_ref="f" * 64)
        before = len(self.fs.calls)
        self.assert_adapter_error(lambda: adapter.cleanup_proof(
            altered, physical, self.spec.cleanup_deadline_us), "IDENTITY_CHANGED")
        self.assertEqual(len(self.fs.calls), before)

    def test_expired_cleanup_deadline_rejects_probe_and_proof_without_io(self):
        adapter, physical = self.bind()
        evidence = self.cleanup(adapter, physical)
        self.clock.now = self.spec.cleanup_deadline_us * 1000
        before = self.call_counts()
        self.assert_adapter_error(lambda: self.cleanup(adapter, physical), "DEADLINE")
        self.assertEqual(self.call_counts(), before)
        self.assert_adapter_error(lambda: adapter.cleanup_proof(
            evidence, physical, self.clock.now // 1000 + 1000), "DEADLINE")
        self.assertEqual(self.call_counts(), before)

    def test_export_is_defensive_and_contains_no_received_or_internal_handles(self):
        adapter, physical = self.bind()
        exported = adapter.export_evidence()
        original = self.records(adapter)
        exported["records"][0]["record"]["mutated"] = True
        exported["records"].append({"ref": "f" * 64, "record": {"fd": 47}})
        self.assertEqual(self.records(adapter), original)
        before = len(self.fs.calls)
        altered = dict(physical.to_mapping(), physical_ref=47)
        self.assert_adapter_error(lambda: adapter.binding_proof(
            altered, self.spec.work_deadline_us))
        self.assertEqual(len(self.fs.calls), before)

    def test_preflight_storage_failure_releases_new_root_and_invalidates_observer(self):
        adapter = self.new_adapter()
        original_put = adapter._put
        rejected = []

        def failing_put(value, **kwargs):
            if isinstance(value, pc.Observation) and value.kind == "adapter_preflight":
                rejected.append(value)
                raise pc.AdapterError("DEPENDENCY_UNAVAILABLE", "storagefault")
            return original_put(value, **kwargs)

        with patch.object(adapter, "_put", side_effect=failing_put):
            self.assert_adapter_error(lambda: adapter.preflight(self.spec),
                                      "DEPENDENCY_UNAVAILABLE")
        self.assertTrue(rejected)
        self.assertTrue(self.fs.handles)
        self.assertTrue(all(handle.closed for handle in self.fs.handles))
        self.assertFalse(self.fs.live_handles)
        before = len(self.fs.calls)
        self.assert_adapter_error(lambda: adapter.preflight(self.spec), "IDENTITY_CHANGED")
        self.assertEqual(len(self.fs.calls), before)

    def test_bind_storage_failure_releases_leaf_parent_and_preserves_preflight_root(self):
        adapter = self.new_adapter()
        adapter.preflight(self.spec)
        retained_root = tuple(self.fs.live_handles)
        self.assertEqual(len(retained_root), 1)
        previous_handles = set(self.fs.handles)
        original_put = adapter._put
        rejected = []

        def failing_put(value, **kwargs):
            if isinstance(value, pc.Observation) and value.kind == "bind_before_go":
                rejected.append(value)
                raise pc.AdapterError("DEPENDENCY_UNAVAILABLE", "storagefault")
            return original_put(value, **kwargs)

        with patch.object(adapter, "_put", side_effect=failing_put):
            self.assert_adapter_error(lambda: adapter.bind_leaf(
                self.unit, self.generation, self.spec.work_deadline_us),
                "DEPENDENCY_UNAVAILABLE")
        self.assertTrue(rejected)
        acquired_handles = set(self.fs.handles) - previous_handles
        self.assertTrue(acquired_handles)
        self.assertTrue(any(handle.node is self.fs.leaf for handle in acquired_handles))
        self.assertTrue(any(handle.node is self.fs.parent for handle in acquired_handles))
        self.assertTrue(all(handle.closed for handle in acquired_handles))
        self.assertEqual(tuple(self.fs.live_handles), retained_root)
        self.assertTrue(all(not handle.closed for handle in retained_root))

    def test_close_storage_failure_releases_all_three_leaves_and_root_with_partial_facts(self):
        def source_for_unit(unit_mapping, deadline_ns):
            return FakeIdentitySource(manager(
                slot_id=unit_mapping["slot"], unit=unit_mapping["name"],
                invocation_id=unit_mapping["invocation_id"],
                control_group=unit_mapping["control_group"],
                control_group_id=int(unit_mapping["control_group_id"]),
                unit_binding_ref=self.C.digest_record(unit_mapping)))

        def observe_keeper(generation_mapping, deadline_ns):
            return pc.KeeperObservation(dict(generation_mapping), self.clock(), self.clock(),
                                        "4" * 64)

        adapter = self.new_adapter(identity_source=source_for_unit,
                                   keeper_observation=observe_keeper)
        adapter.preflight(self.spec)
        for slot in range(3):
            name = "slot" if slot == 0 else "slot" + str(slot)
            if slot:
                leaf = self.fs._new_node("leaf" + str(slot))
                leaf.files.update(self.fs.leaf.files)
                self.fs.parent.children[name] = leaf
            else:
                leaf = self.fs.leaf
            generation = dict(self.generation, pid=77 + slot, start_ticks=str(700 + slot))
            leaf.files["cgroup.procs"] = (str(generation["pid"]) + "\n").encode("ascii")
            unit = dict(self.unit.to_mapping(), slot=slot,
                        name=self.spec.slots[slot].unit_name,
                        invocation_id=str(slot + 1) * 32,
                        control_group="/pilot/" + name,
                        control_group_id=str(987654321 + slot),
                        keeper_generation_ref=self.C.digest_record(generation))
            adapter.bind_leaf(unit, generation, self.spec.work_deadline_us)
        retained = tuple(self.fs.live_handles)
        self.assertEqual(len(retained), 7)
        with patch.object(adapter, "_put", side_effect=pc.AdapterError(
                "DEPENDENCY_UNAVAILABLE", "storagefault")):
            error = self.assert_adapter_error(adapter.close, "DEPENDENCY_UNAVAILABLE")
        self.assertTrue(all(handle.closed for handle in retained))
        self.assertFalse(self.fs.live_handles)
        self.assertIsInstance(error.partial_fact, tuple)
        self.assertEqual(len(error.partial_fact), 4)
        self.assertEqual([fact.kind for fact in error.partial_fact].count("close"), 3)
        self.assertEqual([fact.kind for fact in error.partial_fact].count("adapter_close"), 1)
        for fact in error.partial_fact:
            self.assertIsInstance(fact, pc.Observation)
            self.assertEqual(fact.status, pc.Status.COMPLETE)
            self.assertTrue(fact.evidence)
            self.assertLessEqual(fact.started_ns, fact.finished_ns)

    def test_cross_call_clock_regression_preserves_fact_and_invalidates_permanently(self):
        adapter, physical = self.bind()
        previous_time = self.clock.now
        self.clock.now = 1
        before = self.call_counts()
        error = self.assert_adapter_error(lambda: adapter.binding_proof(
            physical, self.spec.work_deadline_us), "DEADLINE")
        self.assertEqual(self.call_counts(), before)
        exported = self.records(adapter)
        failure = exported[error.evidence_ref]
        self.assertIn("partial_fact_ref", failure)
        facts = exported[failure["partial_fact_ref"]]
        self.assertEqual(facts["observed_ns"], "1")
        self.assertGreater(int(facts["previous_ns"]), 1)
        self.clock.now = previous_time + 1
        before = self.call_counts()
        self.assert_adapter_error(lambda: adapter.binding_proof(
            physical, self.spec.work_deadline_us), "IDENTITY_CHANGED")
        self.assertEqual(self.call_counts(), before)

    def test_keeper_generation_restoration_cannot_reverse_observed_invalidation(self):
        adapter, physical = self.bind()
        self.keeper_current["start_ticks"] = "701"
        self.assert_adapter_error(lambda: adapter.binding_proof(
            physical, self.spec.work_deadline_us), "IDENTITY_CHANGED")
        self.keeper_current = dict(self.generation)
        before = self.call_counts()
        self.assert_adapter_error(lambda: adapter.sample_peak(
            physical, self.generation, "5" * 64, self.spec.work_deadline_us),
            "IDENTITY_CHANGED")
        self.assertEqual(self.call_counts(), before)
        evidence = self.cleanup(adapter, physical)
        self.assertEqual(evidence.values["physical"]["tag"], "Unavailable")
        proof = adapter.cleanup_proof(evidence, physical, self.spec.cleanup_deadline_us)
        self.assertIsInstance(proof, self.C.ClosureUnavailable)
        self.C.validate_closure_unavailable(proof.to_mapping(), evidence.to_mapping(),
                                            physical.to_mapping())

    def test_bind_requires_known_live_resident_keeper_census(self):
        cases = ((b"populated 0\nfrozen 0\n", b""),
                 (b"populated 1\nfrozen 0\n", b"88\n"),
                 (b"frozen 0\n", b"77\n"),
                 (b"populated 1\nfrozen 0\n", b"unknown\n"))
        for events, procs in cases:
            with self.subTest(events=events, procs=procs):
                self.tearDown()
                self.setUp()
                adapter = self.new_adapter()
                adapter.preflight(self.spec)
                retained_root = tuple(self.fs.live_handles)
                self.fs.leaf.files["cgroup.events"] = events
                self.fs.leaf.files["cgroup.procs"] = procs
                self.assert_adapter_error(lambda: adapter.bind_leaf(
                    self.unit, self.generation, self.spec.work_deadline_us))
                self.assertEqual(tuple(self.fs.live_handles), retained_root)

    def test_binding_proof_requires_known_live_resident_keeper_before_load(self):
        cases = ((b"populated 0\nfrozen 0\n", b""),
                 (b"populated 1\nfrozen 0\n", b"88\n"),
                 (b"frozen 0\n", b"77\n"),
                 (b"populated 1\nfrozen 0\n", b"unknown\n"))
        for events, procs in cases:
            with self.subTest(events=events, procs=procs):
                self.tearDown()
                self.setUp()
                adapter, physical = self.bind()
                self.fs.leaf.files["cgroup.events"] = events
                self.fs.leaf.files["cgroup.procs"] = procs
                self.assert_adapter_error(lambda: adapter.binding_proof(
                    physical, self.spec.work_deadline_us))

    def test_root_identity_is_checked_before_bind_proof_peak_and_cleanup(self):
        for operation in ("bind", "proof", "peak", "cleanup"):
            with self.subTest(operation=operation):
                self.tearDown()
                self.setUp()
                adapter = self.new_adapter()
                adapter.preflight(self.spec)
                physical = None if operation == "bind" else adapter.bind_leaf(
                    self.unit, self.generation, self.spec.work_deadline_us)
                self.replace_cgroup_root_path()
                before = self.fs.counts.get("read_at:cgroup.events", 0)
                if operation == "bind":
                    self.assert_adapter_error(lambda: adapter.bind_leaf(
                        self.unit, self.generation, self.spec.work_deadline_us))
                elif operation == "proof":
                    self.assert_adapter_error(lambda: adapter.binding_proof(
                        physical, self.spec.work_deadline_us))
                elif operation == "peak":
                    self.assert_adapter_error(lambda: adapter.sample_peak(
                        physical, self.generation, "5" * 64, self.spec.work_deadline_us))
                else:
                    evidence = self.cleanup(adapter, physical)
                    self.assertEqual(evidence.values["physical"]["tag"], "Unavailable")
                    self.assertIsNone(evidence.values["physical"]["populated"])
                    proof = adapter.cleanup_proof(evidence, physical, self.spec.cleanup_deadline_us)
                    self.assertIsInstance(proof, self.C.ClosureUnavailable)
                self.assertEqual(self.fs.counts.get("read_at:cgroup.events", 0), before)
                after = self.call_counts()
                self.assert_adapter_error(lambda: adapter.preflight(self.spec), "IDENTITY_CHANGED")
                self.assertEqual(self.call_counts(), after)

    def test_root_identity_is_checked_after_bind_proof_peak_and_cleanup(self):
        for operation in ("bind", "proof", "peak", "cleanup"):
            with self.subTest(operation=operation):
                self.tearDown()
                self.setUp()
                adapter = self.new_adapter()
                adapter.preflight(self.spec)
                physical = None if operation == "bind" else adapter.bind_leaf(
                    self.unit, self.generation, self.spec.work_deadline_us)
                changes = []

                def change_root():
                    changes.append(self.replace_cgroup_root_path())

                hook = "read_at:memory.peak" if operation == "peak" else "read_at:cgroup.events"
                self.fs.hook_next(hook, change_root)
                if operation == "bind":
                    self.assert_adapter_error(lambda: adapter.bind_leaf(
                        self.unit, self.generation, self.spec.work_deadline_us))
                elif operation == "proof":
                    self.assert_adapter_error(lambda: adapter.binding_proof(
                        physical, self.spec.work_deadline_us))
                elif operation == "peak":
                    self.assert_adapter_error(lambda: adapter.sample_peak(
                        physical, self.generation, "5" * 64, self.spec.work_deadline_us))
                else:
                    self.fs.leaf.files["cgroup.events"] = b"populated 0\nfrozen 0\n"
                    self.fs.leaf.files["cgroup.procs"] = b""
                    evidence = self.cleanup(adapter, physical)
                    self.assertEqual(evidence.values["physical"]["tag"], "Unavailable")
                    self.assertIsNone(evidence.values["physical"]["populated"])
                    proof = adapter.cleanup_proof(evidence, physical, self.spec.cleanup_deadline_us)
                    self.assertIsInstance(proof, self.C.ClosureUnavailable)
                self.assertEqual(len(changes), 1)
                self.fs.root.children["sys"].children["fs"].children["cgroup"] = changes[0]
                before = self.call_counts()
                self.assert_adapter_error(lambda: adapter.preflight(self.spec), "IDENTITY_CHANGED")
                self.assertEqual(self.call_counts(), before)

    def test_cached_success_is_rejected_after_root_invalidation_but_failure_is_retained(self):
        adapter, physical = self.bind()
        self.fs.leaf.files["cgroup.events"] = b"populated 0\nfrozen 0\n"
        self.fs.leaf.files["cgroup.procs"] = b""
        success = self.cleanup(adapter, physical)
        self.assertIsInstance(adapter.cleanup_proof(success, physical,
                          self.spec.cleanup_deadline_us), self.C.ClosureProof)
        original = self.replace_cgroup_root_path()
        failure = self.cleanup(adapter, physical)
        self.assertEqual(failure.values["physical"]["tag"], "Unavailable")
        retained_failure = adapter.cleanup_proof(failure, physical, self.spec.cleanup_deadline_us)
        self.fs.root.children["sys"].children["fs"].children["cgroup"] = original
        before = len(self.fs.calls)
        self.assert_adapter_error(lambda: adapter.cleanup_proof(
            success, physical, self.spec.cleanup_deadline_us), "IDENTITY_CHANGED")
        retrieved = adapter.cleanup_proof(failure, physical, self.spec.cleanup_deadline_us)
        self.assertEqual(retrieved.to_mapping(), retained_failure.to_mapping())
        self.assertIsInstance(retrieved, self.C.ClosureUnavailable)
        self.assertEqual(len(self.fs.calls), before)

    def test_cached_success_is_rejected_after_core_invalidation_but_failure_is_retained(self):
        adapter, physical = self.bind()
        self.fs.leaf.files["cgroup.events"] = b"populated 0\nfrozen 0\n"
        self.fs.leaf.files["cgroup.procs"] = b""
        success = self.cleanup(adapter, physical)
        self.assertIsInstance(adapter.cleanup_proof(success, physical,
                          self.spec.cleanup_deadline_us), self.C.ClosureProof)
        self.fs.replace_leaf()
        failure = self.cleanup(adapter, physical)
        self.assertEqual(failure.values["physical"]["tag"], "Unavailable")
        retained_failure = adapter.cleanup_proof(failure, physical, self.spec.cleanup_deadline_us)
        self.fs.restore_original_leaf()
        before = len(self.fs.calls)
        self.assert_adapter_error(lambda: adapter.cleanup_proof(
            success, physical, self.spec.cleanup_deadline_us), "IDENTITY_CHANGED")
        retrieved = adapter.cleanup_proof(failure, physical, self.spec.cleanup_deadline_us)
        self.assertEqual(retrieved.to_mapping(), retained_failure.to_mapping())
        self.assertIsInstance(retrieved, self.C.ClosureUnavailable)
        self.assertEqual(len(self.fs.calls), before)

    def test_preflight_waiting_for_lock_cannot_reopen_root_closed_while_waiting(self):
        adapter = self.new_adapter()
        adapter.preflight(self.spec)
        waiting = threading.Event()
        resume = threading.Event()
        failures = []
        results = []

        class PausedAcquireLock:
            def __init__(self):
                self.lock = threading.Lock()
                self.acquired = self.released = 0

            def acquire(self, timeout):
                waiting.set()
                if not resume.wait(2):
                    raise AssertionError("close race was not coordinated")
                result = self.lock.acquire(timeout=timeout)
                if result:
                    self.acquired += 1
                return result

            def release(self):
                self.released += 1
                self.lock.release()

            def __enter__(self):
                self.lock.acquire()
                return self

            def __exit__(self, *args):
                self.lock.release()

        def preflight_waiter():
            try:
                results.append(adapter.preflight(self.spec))
            except Exception as error:
                failures.append(error)

        controlled_lock = PausedAcquireLock()
        with patch.object(adapter, "_lock", controlled_lock):
            thread = threading.Thread(target=preflight_waiter)
            thread.start()
            try:
                self.assertTrue(waiting.wait(2))
                adapter.close()
                before = self.call_counts()
            finally:
                resume.set()
                thread.join(2)
            self.assertFalse(thread.is_alive())
            self.assertFalse(results)
            self.assertEqual(len(failures), 1)
            self.assertIsInstance(failures[0], pc.AdapterError)
            self.assertEqual(failures[0].code, "IDENTITY_CHANGED")
            self.assertEqual(self.call_counts(), before)
            self.assertFalse(self.fs.live_handles)
            self.assertEqual(controlled_lock.acquired, 1)
            self.assertEqual(controlled_lock.released, 1)

    def test_late_owned_handle_close_failure_keeps_deadline_and_unknown_outcome_without_retry(self):
        deadline_ns = self.clock.now + 1000
        gate = pc._AdapterGate(self.clock, deadline_ns, self.clock.now)
        filesystem = pc._DeadlineFilesystem(self.fs, gate)
        self.fs.hook_next("open_root", lambda: setattr(self.clock, "now", deadline_ns + 1))
        self.fs.fault_next("close:root", OSError(errno.EINTR, "close outcome ambiguous"))
        error = self.assert_adapter_error(lambda: filesystem.open_root(deadline_ns), "DEADLINE")
        self.assertEqual(self.fs.counts["open_root"], 1)
        self.assertEqual(self.fs.counts["close:root"], 1)
        self.assertEqual(len(self.fs.handles), 1)
        self.assertFalse(self.fs.handles[0].closed)
        self.assertEqual(error.partial_fact["kind"], "LATE_OWNED_HANDLE_CLOSE")
        self.assertEqual(error.partial_fact["close_errno"], errno.EINTR)
        self.assertIs(error.partial_fact["close_attempted"], True)
        self.assertEqual(error.partial_fact["close_outcome"], "UNKNOWN")
        self.assertIn("DEADLINE", error.partial_fact["deadline_error"])
        self.assertIn("ambiguous", error.partial_fact["close_error"])
        adapter = self.new_adapter()
        retained_error = adapter._failure(error)
        self.assertEqual(retained_error.code, "DEADLINE")
        exported = self.records(adapter)
        failure = exported[retained_error.evidence_ref]
        fact = exported[failure["partial_fact_ref"]]
        self.assertEqual(fact["close_outcome"], "UNKNOWN")
        self.assertEqual(fact["close_errno"], str(errno.EINTR))
        self.assertEqual(self.fs.counts["close:root"], 1)

    def test_provenance_exact_native_chain_is_inspected_without_native_syscalls(self):
        native = pc.LinuxFilesystem()
        native.native = False
        gate = pc._AdapterGate(self.clock, 1_000_000_000, self.clock.now)
        once = pc._DeadlineFilesystem(native, gate)
        nested = pc._DeadlineFilesystem(pc._DeadlineFilesystem(once, gate), gate)
        with patch.object(pc.os, "open") as open_call, \
                patch.object(pc.os, "read") as read_call, \
                patch.object(pc.os, "fstat") as stat_call:
            self.assertEqual(pc._filesystem_provenance(native), "linux-kernel")
            self.assertEqual(pc._filesystem_provenance(once), "linux-kernel")
            self.assertEqual(pc._filesystem_provenance(nested), "linux-kernel")
            open_call.assert_not_called()
            read_call.assert_not_called()
            stat_call.assert_not_called()
        self.assertFalse(self.fs.calls)

    def test_provenance_native_flags_subclasses_and_unknown_proxies_remain_injected(self):
        class NativeSubclass(pc.LinuxFilesystem):
            native = True

        class UnknownProxy:
            native = True

            def __init__(self, original):
                self.original = original

        class WrapperSubclass(pc._DeadlineFilesystem):
            pass

        self.fs.native = True
        gate = pc._AdapterGate(self.clock, 1_000_000_000, self.clock.now)
        native = pc.LinuxFilesystem()
        cycle = pc._DeadlineFilesystem(native, gate)
        cycle.original = cycle
        too_deep = native
        for _ in range(17):
            too_deep = pc._DeadlineFilesystem(too_deep, gate)
        values = (self.fs, NativeSubclass(), UnknownProxy(native),
                  pc._DeadlineFilesystem(self.fs, gate),
                  pc._DeadlineFilesystem(NativeSubclass(), gate),
                  WrapperSubclass(native, gate),
                  pc._DeadlineFilesystem(UnknownProxy(native), gate), cycle, too_deep)
        with patch.object(pc.os, "open") as open_call:
            for value in values:
                with self.subTest(type_name=type(value).__name__):
                    self.assertEqual(pc._filesystem_provenance(value), "injected-filesystem")
            open_call.assert_not_called()
        self.assertFalse(self.fs.calls)

    def test_provenance_native_method_test_doubles_cannot_claim_kernel_origin(self):
        native = pc.LinuxFilesystem()
        with patch.object(native, "read_at", return_value=b"fixture\n") as instance_double:
            self.assertEqual(pc._filesystem_provenance(native), "injected-filesystem")
            instance_double.assert_not_called()
        self.assertEqual(pc._filesystem_provenance(native), "linux-kernel")
        with patch.object(pc.LinuxFilesystem, "read_at", return_value=b"fixture\n") as class_double:
            self.assertEqual(pc._filesystem_provenance(native), "injected-filesystem")
            class_double.assert_not_called()
        self.assertEqual(pc._filesystem_provenance(native), "linux-kernel")
        method = pc.LinuxFilesystem.read_at
        original_code = method.__code__

        def replacement_read(self, handle, name, cap, deadline_ns):
            return b"fixture\n"

        try:
            method.__code__ = replacement_read.__code__
            self.assertEqual(pc._filesystem_provenance(native), "injected-filesystem")
        finally:
            method.__code__ = original_code
        self.assertEqual(pc._filesystem_provenance(native), "linux-kernel")
        with patch.object(pc.LinuxFilesystem, "__getattribute__",
                          lambda instance, name: object.__getattribute__(instance, name),
                          create=True):
            self.assertEqual(pc._filesystem_provenance(native), "injected-filesystem")
        self.assertEqual(pc._filesystem_provenance(native), "linux-kernel")

    def test_provenance_deadline_wrapper_method_overrides_remain_injected(self):
        native = pc.LinuxFilesystem()
        gate = pc._AdapterGate(self.clock, 1_000_000_000, self.clock.now)
        wrapper = pc._DeadlineFilesystem(native, gate)
        nested = pc._DeadlineFilesystem(wrapper, gate)
        with patch.object(wrapper, "read_at", return_value=b"fixture\n") as instance_double:
            self.assertEqual(pc._filesystem_provenance(wrapper), "injected-filesystem")
            self.assertEqual(pc._filesystem_provenance(nested), "injected-filesystem")
            instance_double.assert_not_called()
        self.assertEqual(pc._filesystem_provenance(nested), "linux-kernel")
        with patch.object(pc._DeadlineFilesystem, "read_at", return_value=b"fixture\n") as class_double:
            self.assertEqual(pc._filesystem_provenance(nested), "injected-filesystem")
            class_double.assert_not_called()
        self.assertEqual(pc._filesystem_provenance(nested), "linux-kernel")
        method = pc._DeadlineFilesystem.read_at
        original_code = method.__code__

        def replacement_read(self, handle, name, cap, deadline_ns):
            return b"fixture\n"

        try:
            method.__code__ = replacement_read.__code__
            self.assertEqual(pc._filesystem_provenance(nested), "injected-filesystem")
        finally:
            method.__code__ = original_code
        self.assertEqual(pc._filesystem_provenance(nested), "linux-kernel")
        with patch.object(pc._DeadlineFilesystem, "__getattribute__",
                          lambda instance, name: object.__getattribute__(instance, name),
                          create=True):
            self.assertEqual(pc._filesystem_provenance(nested), "injected-filesystem")
        self.assertEqual(pc._filesystem_provenance(nested), "linux-kernel")

    def test_provenance_full_fixture_observations_remain_injected_with_external_facts(self):
        self.fs.native = True
        adapter, physical = self.bind()
        adapter.sample_peak(physical, self.generation, "5" * 64, self.spec.work_deadline_us)
        self.fs.detach_leaf()
        evidence = self.cleanup(adapter, physical)
        self.assertEqual(evidence.values["physical"]["tag"], "OriginalAbsent")
        proof = adapter.cleanup_proof(evidence, physical, self.spec.cleanup_deadline_us)
        self.assertIsInstance(proof, self.C.ClosureProof)
        retained = self.records(adapter)
        observations = [record for record in retained.values()
                        if "origin" in record and "evidence" in record]
        self.assertTrue(observations)
        self.assertEqual({record["origin"] for record in observations}, {"injected-filesystem"})
        self.assertTrue({"bind_before_go", "memory_peak", "closure"}.issubset(
            {record["kind"] for record in observations}))
        self.assertTrue(adapter.fixture_only)
        self.assertEqual(retained[self.C.digest_record(self.manager_mapping)], self.manager_mapping)
        self.assertEqual(retained[self.C.digest_record(self.unit)], self.unit.to_mapping())

        def mappings(value):
            if isinstance(value, dict):
                yield value
                for child in value.values():
                    yield from mappings(child)
            elif isinstance(value, list):
                for child in value:
                    yield from mappings(child)

        sources = {record["source_ref"] for record in mappings(list(retained.values()))
                   if "source_ref" in record}
        self.assertIn(self.expected.source_ref, sources)
        self.assertIn("4" * 64, sources)
        self.assertIn("policy:fixture:1", sources)


class TerminalIdentityObservationTests(unittest.TestCase):
    """New terminal cases only; no older test methods are inherited."""
    setUpClass = classmethod(RuntimePhysicalObserverTests.setUpClass.__func__)
    tearDown = RuntimePhysicalObserverTests.tearDown
    manager_binding = RuntimePhysicalObserverTests.manager_binding
    identity_source = RuntimePhysicalObserverTests.identity_source
    keeper_observation = RuntimePhysicalObserverTests.keeper_observation
    absence_policy = RuntimePhysicalObserverTests.absence_policy
    new_adapter = RuntimePhysicalObserverTests.new_adapter
    bind = RuntimePhysicalObserverTests.bind
    records = RuntimePhysicalObserverTests.records
    cleanup = RuntimePhysicalObserverTests.cleanup
    correlated_cleanup_proof = RuntimePhysicalObserverTests.correlated_cleanup_proof
    original_binding_proof = RuntimePhysicalObserverTests.original_binding_proof
    assert_adapter_error = RuntimePhysicalObserverTests.assert_adapter_error
    call_counts = RuntimePhysicalObserverTests.call_counts

    class Source(FakeIdentitySource):
        """Authenticates original in-memory facts, never Linux/systemd/pidfds.

        Output mutations model a broken source after fixture authentication.
        Caller probe mappings are independent of the original retained graph.
        """
        def __init__(self, f):
            super().__init__(f.expected)
            self.fixture = f
            self.original_unit = f.unit.to_mapping()
            self.original_manager = f.clone(f.manager_mapping)
            self.retained_graph = self.graph_seal = self.original_receipts = None
            self.terminal_enabled = self.unloaded = False
            self.mode = 'NO_SUCH_UNIT'
            self.closure_count = 0
            self.authenticated = []
            self.mutate = self.closure_fault = self.closure_hook = self.snapshot_result = None

        def snapshot(self, deadline_ns):
            value = super().snapshot(deadline_ns)
            if self.snapshot_result is not None:
                return self.snapshot_result
            if self.unloaded:
                raise FileNotFoundError(errno.ENOENT, 'org.freedesktop.systemd1.NoSuchUnit')
            return value

        def retain(self, graph):
            f = self.fixture
            self.retained_graph = f.clone(graph)
            self.graph_seal = f.C.digest_record(graph)
            self.original_receipts = {key:f.clone(graph[key]) for key in
                ('start_receipt','stop_receipt','final_unit_receipt','keeper_reap_receipt')}

        def authenticate(self, before, after, deadline_ns):
            f, graph = self.fixture, self.retained_graph
            if graph is None or f.C.digest_record(graph) != self.graph_seal:
                raise ValueError('original producer execution graph unavailable or altered')
            if before != self.original_manager or after != self.original_manager:
                raise ValueError('original manager epoch unavailable')
            if f.clock.now >= min(deadline_ns,int(self.original_manager['authority_lease_until_us'])*1000):
                raise TimeoutError('original execution authority expired')
            if any(graph.get(key) != value for key,value in self.original_receipts.items()):
                raise ValueError('receipt not produced by original fixture')
            self.authenticated.append((f.clock.now,self.graph_seal))
            return f.clone(graph)

        def closure_snapshot(self, deadline_ns):
            f = self.fixture
            self.closure_count += 1
            if self.closure_fault is not None:
                raise self.closure_fault
            if not self.terminal_enabled:
                return self.snapshot(deadline_ns)
            started = f.clock()
            before = f.manager_binding(deadline_ns).to_mapping()
            if self.closure_hook is not None:
                self.closure_hook()
            state = ({'kind':'NO_SUCH_UNIT','error_name':'org.freedesktop.systemd1.NoSuchUnit',
                      'object_path':self.original_unit['object_path']} if self.mode == 'NO_SUCH_UNIT'
                     else {'kind':'TERMINAL_CLEARED','snapshot':f.terminal_snapshot(cleared=True)})
            after = f.manager_binding(deadline_ns).to_mapping()
            graph = self.authenticate(before,after,deadline_ns)
            value = pc.TerminalIdentityObservation('SETTLED_ORIGINAL',f.clone(self.original_unit),
                before,after,graph,state,started,f.clock(),'terminal:fixture:original')
            return self.mutate(value) if self.mutate is not None else value

    def setUp(self):
        RuntimePhysicalObserverTests.setUp(self)
        name = self.unit.values['name']
        escaped = ''.join(c if c.isascii() and c.isalnum() else '_'+format(ord(c),'02x') for c in name)
        self.unit = self.C.UnitBinding.from_mapping(dict(self.unit.to_mapping(),
            object_path='/org/freedesktop/systemd1/unit/'+escaped))
        self.expected = manager(unit=name,unit_binding_ref=self.C.digest_record(self.unit))
        self.source = self.Source(self)
        self.settlement_order = []

    @staticmethod
    def clone(value):
        import json
        return json.loads(json.dumps(value,allow_nan=False))

    def reset_fixture(self):
        self.tearDown()
        self.setUp()

    def terminal_snapshot(self, *, cleared=False):
        return {'object_path':self.unit.values['object_path'],'unit':{
            'Id':self.unit.values['name'],'InvocationID':self.unit.values['invocation_id'],
            'Transient':True,'DefaultDependencies':False,'ActiveState':'inactive',
            'SubState':'dead','Job':[0,'/']},'service':{'MainPID':0,'ControlPID':0,
            'ControlGroup':'' if cleared else self.unit.values['control_group'],
            'ControlGroupId':0 if cleared else int(self.unit.values['control_group_id'])}}

    def settle(self, *, cleared=False):
        """Retain execution facts BEFORE physical closure: no ClosureProof prerequisite."""
        self.clock.advance(10_000)
        stamp = str(self.clock.now//1000)
        graph = {}
        for kind,job_id in (('start',1),('stop',2)):
            path = '/org/freedesktop/systemd1/job/'+str(job_id)
            job = {'kind':kind,'slot':0,'boot_id':self.manager_mapping['boot_id'],
                'bus_guid':self.manager_mapping['bus_guid'],'owner':self.manager_mapping['owner_unique_name'],
                'job_id':job_id,'job_path':path,'unit_name':self.unit.values['name']}
            event = {'boot_id':job['boot_id'],'bus_guid':job['bus_guid'],'owner_unique_name':job['owner'],
                'job_id':job_id,'job_path':path,'unit_name':job['unit_name'],'result':'done','observed_us':int(stamp)}
            graph[kind+'_receipt'] = {'kind':kind,'job_ref':self.C.digest_record(job),
                'request_ref':self.C.digest_record({'kind':kind,'original_dispatch':job_id,
                                                   'original_unit_binding_ref':self.C.digest_record(self.unit)}),
                'event':event}
        graph['final_unit_receipt'] = {'original_unit_binding_ref':self.C.digest_record(self.unit),
            'manager_binding_ref':self.C.digest_record(self.manager_mapping),
            'invocation_id':self.unit.values['invocation_id'],'snapshot':self.terminal_snapshot(cleared=cleared),
            'before_us':stamp,'after_us':stamp}
        exit_fact = {'tag':'SYSTEMD_MAIN_EXIT','original_process_generation':dict(self.generation),
            'invocation_id':self.unit.values['invocation_id'],'exec_main_pid':self.generation['pid'],
            'exec_main_code':'CLD_EXITED','exec_main_status':0,'start_timestamp_us':'10',
            'exit_timestamp_us':stamp,'before_us':stamp,'after_us':stamp}
        release = {'tag':'PIDFD_TASK_RELEASED','original_process_generation':dict(self.generation),
            'pidfd_identity_ref':'pidfd:fixture-original','procfs_namespace_ref':'pid:[500]',
            'fdinfo_pid':-1,'retained_original':True,'not_closed_or_reused':True,'before_us':stamp,'after_us':stamp}
        self.C.validate_main_release_facts(exit_fact,release)
        graph['keeper_reap_receipt'] = {'systemd_main_exit':exit_fact,'pidfd_task_released':release}
        graph.update(activations_settled=True,stop_settled=True,terminal_no_pending_execution=True,
                     keeper_reaped=True,missing_evidence=[],test_boundary=True)
        self.rehash(graph)
        self.source.retain(graph)
        self.settlement_order.append(('EXECUTION_FACTS_RETAINED',self.clock.now))
        self.source.mode = 'TERMINAL_CLEARED' if cleared else 'NO_SUCH_UNIT'
        self.source.terminal_enabled = self.source.unloaded = True
        return self.clone(graph)

    def rehash(self, graph):
        for record,ref in (('start_receipt','start_settlement_ref'),('stop_receipt','stop_settlement_ref'),
                ('final_unit_receipt','final_unit_receipt_ref'),('keeper_reap_receipt','keeper_reap_receipt_ref')):
            graph[ref] = self.C.digest_record(graph[record])
        return graph

    def change_graph(self, capture, change):
        graph = self.clone(capture.cleanup_graph)
        change(graph)
        self.rehash(graph)
        return replace(capture,cleanup_graph=graph)

    def observer(self, adapter):
        return adapter._leaves[0].observer

    def unavailable(self, adapter, physical, evidence):
        validated = self.C.validate_cleanup_evidence(evidence.to_mapping())
        self.assertEqual(validated['physical']['tag'],'Unavailable')
        self.assertIsNone(validated['physical']['populated'])
        self.assertIn('PHYSICAL_OBSERVATION',validated['missing_evidence'])
        proof = self.correlated_cleanup_proof(adapter,physical,evidence)
        self.assertIsInstance(proof,self.C.ClosureUnavailable)
        self.assertIn(proof.values['observation_ref'],self.records(adapter))
        return proof

    def test_terminal_unloaded_original_absent_after_live_bind_and_sample(self):
        adapter,physical = self.bind()
        self.C.validate_memory_sample(adapter.sample_peak(physical,self.generation,'5'*64,
                                                         self.spec.work_deadline_us).to_mapping())
        graph = self.settle()
        self.assertEqual(len(graph),14)
        self.assertFalse(any('closure' in key.lower() or 'physical' in key.lower() for key in graph))
        self.fs.detach_leaf()
        evidence = self.cleanup(adapter,physical,graph)
        self.assertEqual(evidence.values['physical']['tag'],'OriginalAbsent')
        self.assertIsNone(evidence.values['physical']['populated'])
        proof = self.correlated_cleanup_proof(adapter,physical,evidence)
        self.assertEqual(proof.values['operation']['kind'],'OPENAT_ORIGINAL_ABSENT')
        self.assertEqual(proof.values['original_identity']['cgroup_path'],'/pilot')
        self.assertGreaterEqual(len(self.source.authenticated),2)
        self.assertTrue(all(stamp >= self.settlement_order[0][1] for stamp,_ in self.source.authenticated))
        exported = self.records(adapter)
        self.assertIn(self.C.digest_record(graph),exported)
        for key,ref in (('start_receipt','start_settlement_ref'),('stop_receipt','stop_settlement_ref'),
                         ('final_unit_receipt','final_unit_receipt_ref')):
            self.assertEqual(exported[graph[ref]],graph[key])
        captures = [item['value'] for record in exported.values() if record.get('kind')=='closure'
                    for item in record.get('evidence',[]) if isinstance(item.get('value'),dict)
                    and item['value'].get('kind')=='SETTLED_ORIGINAL']
        self.assertGreaterEqual(len(captures),2)
        self.assertEqual({capture['source_ref'] for capture in captures},{'terminal:fixture:original'})
        self.assertTrue(adapter.fixture_only)

    def test_terminal_cleared_present_empty_requires_direct_events_and_two_captures(self):
        adapter,physical = self.bind()
        graph = self.settle(cleared=True)
        self.fs.leaf.files['cgroup.events'] = b'populated 0\nfrozen 0\n'
        self.fs.leaf.files['cgroup.procs'] = b''
        count = self.fs.counts['read_at:cgroup.events']
        evidence = self.cleanup(adapter,physical,graph)
        self.assertEqual(evidence.values['physical']['tag'],'PresentEmpty')
        self.assertEqual(evidence.values['physical']['populated'],0)
        self.assertGreater(self.fs.counts['read_at:cgroup.events'],count)
        proof = self.correlated_cleanup_proof(adapter,physical,evidence)
        self.assertEqual(proof.values['operation']['kind'],'DIRECT_EVENTS_EMPTY')
        self.assertGreaterEqual(self.source.closure_count,2)

    def test_terminal_capture_is_irreversible_cleanup_only_despite_restored_live_source(self):
        adapter,physical = self.bind()
        graph = self.settle(cleared=True)
        self.fs.leaf.files['cgroup.events'] = b'populated 0\nfrozen 0\n'
        self.assertEqual(self.cleanup(adapter,physical,graph).values['physical']['tag'],'PresentEmpty')
        self.source.terminal_enabled = self.source.unloaded = False
        self.fs.leaf.files['cgroup.events'] = b'populated 1\nfrozen 0\n'
        count = self.source.closure_count
        self.assert_adapter_error(lambda:adapter.binding_proof(physical,self.spec.work_deadline_us))
        self.assert_adapter_error(lambda:adapter.sample_peak(physical,self.generation,'5'*64,
                                                             self.spec.work_deadline_us))
        self.assertEqual(self.source.closure_count,count)
        for operation in (pc.observe_limits,pc.observe_census,pc.observe_memory_peak):
            observation = operation(self.observer(adapter))
            self.assertEqual(observation.status,pc.Status.INCOMPLETE)
            self.assertTrue(any('cleanup-only' in issue for issue in observation.issues))
        self.unavailable(adapter,physical,self.cleanup(adapter,physical,graph))

    def test_terminal_api_is_exclusive_to_closure_and_cannot_bind_or_sample(self):
        adapter,physical = self.bind()
        adapter.sample_peak(physical,self.generation,'5'*64,self.spec.work_deadline_us)
        self.assertEqual(self.source.closure_count,0)
        graph = self.settle()
        self.source.snapshot_result = self.source.closure_snapshot(self.spec.cleanup_deadline_us*1000)
        self.source.unloaded = False
        result = pc.bind_before_go(self.expected,self.source,filesystem=self.fs,clock=self.clock)
        self.assertEqual(result.observation.status,pc.Status.INCOMPLETE)
        self.assertIsNone(result.observer)
        count = self.source.closure_count
        self.assert_adapter_error(lambda:adapter.sample_peak(physical,self.generation,'5'*64,
                                                             self.spec.work_deadline_us))
        self.assertEqual(self.source.closure_count,count)
        self.source.snapshot_result = None
        self.fs.detach_leaf()
        self.assertEqual(self.cleanup(adapter,physical,graph).values['physical']['tag'],'OriginalAbsent')

    def test_terminal_missing_authentication_flags_stop_snapshot_or_pidfd_is_unknown(self):
        for label in ('no-auth','flags-only','stop','snapshot','pidfd'):
            with self.subTest(label=label):
                self.reset_fixture(); adapter,physical = self.bind(); graph = self.settle()
                if label=='no-auth':
                    self.source.retained_graph = None
                else:
                    def mutate(capture):
                        bad = self.clone(capture.cleanup_graph)
                        if label=='flags-only':
                            for key in ('start_receipt','stop_receipt','final_unit_receipt','keeper_reap_receipt'):
                                bad.pop(key)
                        elif label=='stop':
                            bad['stop_receipt'] = {}; self.rehash(bad)
                        elif label=='snapshot':
                            bad['final_unit_receipt'].pop('snapshot'); self.rehash(bad)
                        else:
                            bad['keeper_reap_receipt'].pop('pidfd_task_released'); self.rehash(bad)
                        return replace(capture,cleanup_graph=bad)
                    self.source.mutate = mutate
                self.fs.detach_leaf()
                self.unavailable(adapter,physical,self.cleanup(adapter,physical,graph))
                self.assertIsNone(self.observer(adapter)._terminal_ref)

    def test_terminal_caller_rehash_or_bool_integer_changes_do_not_match_authoritative_graph(self):
        for label in ('request','flag','boundary','status'):
            with self.subTest(label=label):
                self.reset_fixture(); adapter,physical = self.bind(); graph = self.settle()
                forged = self.clone(graph)
                if label=='request':
                    forged['stop_receipt']['request_ref'] = '7'*64; self.rehash(forged)
                elif label=='flag':
                    forged['activations_settled'] = 1
                elif label=='boundary':
                    forged['test_boundary'] = 1
                else:
                    forged['keeper_reap_receipt']['systemd_main_exit']['exec_main_status'] = False
                    self.rehash(forged)
                self.fs.detach_leaf()
                evidence = self.cleanup(adapter,physical,forged)
                self.unavailable(adapter,physical,evidence)
                raw = self.records(adapter)[evidence.values['physical']['observation_ref']]
                self.assertTrue(any('differs from authenticated' in issue for issue in raw['issues']))
                self.assertEqual(self.source.retained_graph,graph)

    def test_terminal_changed_manager_before_or_after_is_sticky(self):
        for field in ('current_manager_before','current_manager_after'):
            for key in ('owner_unique_name','bus_guid','manager_pid_generation'):
                with self.subTest(field=field,key=key):
                    self.reset_fixture(); adapter,physical = self.bind(); graph = self.settle()
                    def mutate(capture):
                        bad = self.clone(getattr(capture,field))
                        bad[key] = (':1.43' if key=='owner_unique_name' else 'f'*32 if key=='bus_guid'
                                    else dict(bad[key],start_ticks='101'))
                        return replace(capture,**{field:bad})
                    self.source.mutate = mutate; self.fs.detach_leaf()
                    self.unavailable(adapter,physical,self.cleanup(adapter,physical,graph))
                    self.assertIsNotNone(self.observer(adapter)._invalid_ref)
                    self.source.mutate = None
                    self.unavailable(adapter,physical,self.cleanup(adapter,physical,graph))

    def test_terminal_foreign_unit_and_keeper_generation_are_unknown(self):
        for label in ('unit','keeper','pidfd','not-retained'):
            with self.subTest(label=label):
                self.reset_fixture(); adapter,physical = self.bind(); graph = self.settle()
                def mutate(capture):
                    if label=='unit':
                        return replace(capture,original_unit_binding=dict(capture.original_unit_binding,
                                                                          invocation_id='d'*32))
                    def change(bad):
                        keeper = bad['keeper_reap_receipt']
                        if label=='keeper':
                            keeper['systemd_main_exit']['original_process_generation']['start_ticks'] = '701'
                        if label in ('keeper','pidfd'):
                            keeper['pidfd_task_released']['original_process_generation']['start_ticks'] = '701'
                        else:
                            keeper['pidfd_task_released']['retained_original'] = False
                    return self.change_graph(capture,change)
                self.source.mutate = mutate; self.fs.detach_leaf()
                self.unavailable(adapter,physical,self.cleanup(adapter,physical,graph))

    def test_terminal_exact_unit_read_rejects_permissions_unknown_partial_clear_and_pending_job(self):
        for label in ('permission','unknown','foreign','noncleared','pending'):
            with self.subTest(label=label):
                self.reset_fixture(); adapter,physical = self.bind(); graph = self.settle()
                def mutate(capture):
                    state = self.clone(capture.unit_state_read)
                    if label=='permission': state['error_name'] = 'org.freedesktop.DBus.Error.AccessDenied'
                    elif label=='unknown': state = {'kind':'UNKNOWN'}
                    elif label=='foreign': state['object_path'] = '/org/freedesktop/systemd1/unit/foreign'
                    else:
                        snapshot = self.terminal_snapshot(cleared=label!='noncleared')
                        if label=='pending': snapshot['unit']['Job'] = [2,'/job/2']
                        state = {'kind':'TERMINAL_CLEARED','snapshot':snapshot}
                    return replace(capture,unit_state_read=state)
                self.source.mutate = mutate; self.fs.detach_leaf()
                self.unavailable(adapter,physical,self.cleanup(adapter,physical,graph))

    def test_terminal_linked_rename_and_restored_same_object_stay_unavailable(self):
        adapter,physical = self.bind(); graph = self.settle(); self.fs.rename_leaf()
        self.assertEqual(self.fs.leaf.identity.nlink,2)
        self.unavailable(adapter,physical,self.cleanup(adapter,physical,graph))
        self.fs.restore_original_leaf(); self.fs.leaf.files['cgroup.events'] = b'populated 0\nfrozen 0\n'
        self.unavailable(adapter,physical,self.cleanup(adapter,physical,graph))

    def test_terminal_substitute_empty_inode_is_not_adopted(self):
        adapter,physical = self.bind(); graph = self.settle(); replacement = self.fs.replace_leaf()
        replacement.files['cgroup.events'] = b'populated 0\nfrozen 0\n'
        self.unavailable(adapter,physical,self.cleanup(adapter,physical,graph))
        self.assertNotEqual(replacement.identity.inode,self.observer(adapter).binding.leaf.inode)
        self.assertTrue(any(h.node is self.fs.leaf for h in self.fs.live_handles))

    def test_terminal_reappearance_after_absence_invalidates_cached_success(self):
        adapter,physical = self.bind(); graph = self.settle(); self.fs.detach_leaf()
        first = self.cleanup(adapter,physical,graph)
        self.assertEqual(first.values['physical']['tag'],'OriginalAbsent')
        self.fs.restore_original_leaf(); self.fs.leaf.files['cgroup.events'] = b'populated 0\nfrozen 0\n'
        self.unavailable(adapter,physical,self.cleanup(adapter,physical,graph)); self.fs.detach_leaf()
        self.unavailable(adapter,physical,self.cleanup(adapter,physical,graph))
        self.assert_adapter_error(lambda:adapter.cleanup_proof(first,physical,self.spec.cleanup_deadline_us))

    def test_terminal_mount_namespace_parent_boot_and_mount_changes_are_unknown(self):
        for label in ('namespace','boot','parent','mount'):
            with self.subTest(label=label):
                self.reset_fixture(); adapter,physical = self.bind(); graph = self.settle(); self.fs.detach_leaf()
                if label=='parent': self.fs.rename_parent()
                elif label=='namespace': self.fs.current_context = replace(self.fs.current_context,namespace_inode=601)
                elif label=='boot': self.fs.current_context = replace(self.fs.current_context,
                    boot_id='22222222-2222-4333-8444-555555555555')
                else: self.fs.current_context = replace(self.fs.current_context,mounts=(replace(self.fs.mount,mount_id=32),))
                self.unavailable(adapter,physical,self.cleanup(adapter,physical,graph))

    def test_terminal_stale_capture_and_future_or_reversed_fact_times_are_unknown(self):
        for label in ('stale','future-capture','future-fact','reversed'):
            with self.subTest(label=label):
                self.reset_fixture(); adapter,physical = self.bind(); graph = self.settle()
                def mutate(capture):
                    if label=='stale': return replace(capture,started_ns=0,finished_ns=1)
                    if label=='future-capture': return replace(capture,finished_ns=capture.finished_ns+1000)
                    def change(bad):
                        final = bad['final_unit_receipt']
                        if label=='future-fact': final['after_us'] = str(capture.finished_ns//1000+1)
                        else: final.update(before_us='101',after_us='100')
                    return self.change_graph(capture,change)
                self.source.mutate = mutate; self.fs.detach_leaf(); observer = self.observer(adapter)
                observation = pc.observe_closure(observer,policy=self.absence_policy(observer.binding_ref,
                    observer.binding,self.spec.cleanup_deadline_us*1000))
                self.assertEqual(observation.status,pc.Status.INCOMPLETE)
                self.assertIsNone(observation.value.populated)
                self.unavailable(adapter,physical,self.cleanup(adapter,physical,graph))

    def test_terminal_missing_expired_incomplete_or_foreign_policy_is_unknown(self):
        for label in ('missing','expired','exclusions','foreign'):
            with self.subTest(label=label):
                self.reset_fixture(); adapter,physical = self.bind(); graph = self.settle(); self.fs.detach_leaf()
                observer = self.observer(adapter)
                policy = self.absence_policy(observer.binding_ref,observer.binding,self.spec.cleanup_deadline_us*1000)
                if label=='missing': self.absence_enabled = False
                elif label=='expired': self.policy_result = replace(policy,valid_until_ns=self.clock.now)
                elif label=='exclusions': self.policy_result = replace(policy,exclusions=frozenset({'replacement','migration'}))
                else: self.policy_result = replace(policy,binding_ref='foreign')
                self.unavailable(adapter,physical,self.cleanup(adapter,physical,graph))

    def test_terminal_expired_deadline_has_no_source_or_filesystem_reads(self):
        adapter,physical = self.bind(); graph = self.settle(); self.fs.detach_leaf()
        before = self.call_counts(),self.source.closure_count
        self.assert_adapter_error(lambda:adapter.probe_cleanup(physical,self.unit,graph,'6'*64,
                                                               self.clock.now//1000),'DEADLINE')
        self.assertEqual((self.call_counts(),self.source.closure_count),before)

    def test_terminal_capture_timeout_retains_unknown_and_stops_filesystem_io(self):
        adapter,physical = self.bind(); graph = self.settle(); self.fs.detach_leaf()
        deadline_us = self.clock.now//1000+1000
        calls_at_expiry = []
        def expire():
            calls_at_expiry.append(len(self.fs.calls)); self.clock.now = deadline_us*1000+1
        self.source.closure_hook = expire
        error = self.assert_adapter_error(lambda:adapter.probe_cleanup(physical,self.unit,graph,'6'*64,
                                                                       deadline_us),'DEADLINE')
        self.assertEqual(len(calls_at_expiry),1)
        self.assertEqual(len(self.fs.calls),calls_at_expiry[0])
        self.assertIsNotNone(error.evidence_ref)
        exported = self.records(adapter)
        fault = exported[error.evidence_ref]
        self.assertEqual(fault['kind'],'ADAPTER_INCOMPLETE')
        self.assertEqual(fault['code'],'DEADLINE')
        self.assertIn(fault['cause_ref'],exported)
        raw = exported[fault['cause_ref']]
        self.assertEqual(raw['value']['kind'],'Unavailable')
        self.assertIsNone(raw['value']['populated'])

    def test_terminal_permission_io_and_controller_enoent_do_not_mean_leaf_absence(self):
        for label in ('permission','io','controller'):
            with self.subTest(label=label):
                self.reset_fixture(); adapter,physical = self.bind(); graph = self.settle(cleared=True)
                self.fs.leaf.files['cgroup.events'] = b'populated 0\nfrozen 0\n'
                if label=='permission': self.source.closure_fault = PermissionError(errno.EACCES,'unit denied')
                elif label=='io': self.source.closure_fault = OSError(errno.EIO,'transport unavailable')
                else: self.fs.leaf.files.pop('cgroup.events')
                count = self.source.count
                self.unavailable(adapter,physical,self.cleanup(adapter,physical,graph))
                self.assertEqual(self.source.count,count,'failed terminal capture cannot fall back to LIVE')

    def test_terminal_bounded_plain_metadata_and_unknown_population(self):
        for label in ('oversize','cycle','nonplain','subclass','depth','still-populated'):
            with self.subTest(label=label):
                self.reset_fixture(); adapter,physical = self.bind(); graph = self.settle(cleared=True)
                def mutate(capture):
                    if label=='oversize': return replace(capture,source_ref='x'*(5*1024*1024))
                    if label=='cycle': capture.cleanup_graph['missing_evidence'].append(capture.cleanup_graph)
                    elif label=='nonplain': return replace(capture,unit_state_read=object())
                    elif label=='subclass':
                        class Derived(pc.TerminalIdentityObservation): pass
                        return Derived(**vars(capture))
                    elif label=='depth':
                        nested = []
                        for _ in range(25): nested = [nested]
                        capture.cleanup_graph['missing_evidence'] = nested
                    return capture
                self.source.mutate = mutate
                self.unavailable(adapter,physical,self.cleanup(adapter,physical,graph))

    def test_terminal_missing_method_allows_fresh_live_but_none_or_property_never_falls_back(self):
        for label in ('missing','none','property'):
            with self.subTest(label=label):
                self.reset_fixture(); adapter,physical = self.bind(); graph = self.settle()
                self.source.terminal_enabled = self.source.unloaded = False
                self.fs.leaf.files['cgroup.events'] = b'populated 0\nfrozen 0\n'
                original = self.source
                class Source:
                    def snapshot(self,deadline_ns): return original.snapshot(deadline_ns)
                if label=='none': Source.closure_snapshot = None
                elif label=='property':
                    def unavailable(instance): raise AttributeError('terminal source unavailable')
                    Source.closure_snapshot = property(unavailable)
                adapter._leaves[0].source = Source()
                count = original.count; evidence = self.cleanup(adapter,physical,graph)
                if label=='missing':
                    self.assertEqual(evidence.values['physical']['tag'],'PresentEmpty')
                    self.assertGreater(original.count,count)
                else:
                    self.unavailable(adapter,physical,evidence)
                    self.assertEqual(original.count,count)

    def test_terminal_exit_status_and_pidfd_tokens_match_contract(self):
        for code,status,token in (('CLD_EXITED',256,None),('CLD_KILLED',0,None),('CLD_KILLED',65,None),
                                 ('CLD_DUMPED',0,None),('CLD_EXITED',0,'42'),('CLD_EXITED',0,'pidfd:bad\x00token')):
            with self.subTest(code=code,status=status,token=token):
                self.reset_fixture(); adapter,physical = self.bind(); graph = self.settle()
                def mutate(capture):
                    def change(bad):
                        keeper = bad['keeper_reap_receipt']
                        keeper['systemd_main_exit'].update(exec_main_code=code,exec_main_status=status)
                        if token is not None: keeper['pidfd_task_released']['pidfd_identity_ref'] = token
                    return self.change_graph(capture,change)
                self.source.mutate = mutate; self.fs.detach_leaf(); observer = self.observer(adapter)
                observation = pc.observe_closure(observer,policy=self.absence_policy(observer.binding_ref,
                    observer.binding,self.spec.cleanup_deadline_us*1000))
                self.assertEqual(observation.status,pc.Status.INCOMPLETE)
                self.assertIsNone(observation.value.populated)
                self.unavailable(adapter,physical,self.cleanup(adapter,physical,graph))

    def test_terminal_capture_detaches_mutable_graph_and_preserves_first_full_bracket(self):
        adapter,physical = self.bind(); graph = self.settle(cleared=True)
        self.fs.leaf.files['cgroup.events'] = b'populated 0\nfrozen 0\n'
        captures = []; self.source.mutate = lambda capture:captures.append(capture) or capture
        def alter_after_first_capture():
            self.assertEqual(len(captures),1)
            captures[0].cleanup_graph['final_unit_receipt']['invocation_id'] = 'd'*32
            self.source.retained_graph['final_unit_receipt']['invocation_id'] = 'd'*32
        self.fs.hook_next('read_at:cgroup.events',alter_after_first_capture)
        evidence = self.cleanup(adapter,physical,graph); self.unavailable(adapter,physical,evidence)
        raw = self.records(adapter)[evidence.values['physical']['observation_ref']]
        retained = [item['value'] for item in raw['evidence'] if isinstance(item.get('value'),dict)
                    and item['value'].get('kind')=='SETTLED_ORIGINAL']
        self.assertEqual(len(retained),1)
        self.assertEqual(retained[0]['cleanup_graph']['final_unit_receipt']['invocation_id'],'c'*32)
        self.assertEqual(captures[0].cleanup_graph['final_unit_receipt']['invocation_id'],'d'*32)

    def test_terminal_standalone_post_identity_work_cannot_outlive_original_lease(self):
        self.manager_mapping['authority_lease_until_us'] = '1000'
        self.unit = self.C.UnitBinding.from_mapping(dict(self.unit.to_mapping(),
            manager_binding_ref=self.C.digest_record(self.manager_mapping)))
        self.expected = manager(unit=self.unit.values['name'],unit_binding_ref=self.C.digest_record(self.unit))
        self.source = self.Source(self)
        adapter,physical = self.bind(); self.settle(cleared=True)
        self.fs.leaf.files['cgroup.events'] = b'populated 0\nfrozen 0\n'
        captures = []; self.source.mutate = lambda capture:captures.append(capture) or capture
        self.fs.hooks[('context',self.fs.counts.get('context',0)+2)] = lambda:setattr(self.clock,'now',1_000_001)
        observation = pc.observe_closure(self.observer(adapter),budget=pc.Budget(timeout_ns=5_000_000))
        self.assertEqual(len(captures),2)
        self.assertTrue(all(capture.finished_ns<1_000_000 for capture in captures))
        self.assertEqual(observation.status,pc.Status.INCOMPLETE)
        self.assertEqual(observation.value.kind,pc.ClosureKind.UNAVAILABLE)
        self.assertIsNone(observation.value.populated)
        self.assertLess(observation.finished_ns,observation.started_ns+5_000_000)
        self.assertTrue(any('deadline' in issue.lower() or 'timeout' in issue.lower() for issue in observation.issues))

    def test_terminal_validated_marker_remains_latched_if_validation_postcheck_times_out(self):
        adapter,physical = self.bind(); self.settle(cleared=True)
        self.fs.leaf.files['cgroup.events'] = b'populated 0\nfrozen 0\n'
        observer = self.observer(adapter)
        actual = pc._validate_terminal
        def validate_then_expire(value,expected,boot,start,end,deadline):
            result = actual(value,expected,boot,start,end,deadline)
            self.clock.now = deadline+1
            return result
        with patch.object(pc,'_validate_terminal',side_effect=validate_then_expire):
            observation = pc.observe_closure(observer)
        self.assertEqual(observation.status,pc.Status.INCOMPLETE)
        self.assertIsNone(observation.value.populated)
        self.assertIsNotNone(observer._terminal_ref)
        self.source.terminal_enabled = self.source.unloaded = False
        for operation in (pc.observe_census,pc.observe_memory_peak):
            self.assertEqual(operation(observer).status,pc.Status.INCOMPLETE)

if __name__ == "__main__":
    unittest.main()
