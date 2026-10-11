"""Keeper protocol checks; Linux source/kernel checks are never simulated on Windows.

Run manually with Python's unittest runner. No manager, cgroup or privileged load
is started. The Linux harness compiles the real keeper translation unit and calls
its pure validators; operational service tests remain a separate review step.
"""

from __future__ import annotations

import json
import importlib.util
import importlib.machinery
import ast
import contextlib
import importlib
import io
import hashlib
import os
from dataclasses import replace
from dataclasses import FrozenInstanceError
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import time
import types
import unittest


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "native" / "keeper.c"
RUN = "a" * 32
REF = "b" * 64
GOLDEN_RECORDS = {
    "initial_thread_token": {
        "canonical": "{\"generation\":{\"boot_id\":\"12345678-1234-1234-1234-123456789abc\",\"mount_namespace_ref\":\"mnt:[4026531841]\",\"pid\":101,\"pid_namespace_ref\":\"pid:[4026531836]\",\"start_ticks\":\"123\"},\"role\":\"INITIAL_THREAD\"}",
        "size": 199,
        "sha256": "685157cea948e33087f4a5b7d060aed56225737a0aa1fdddfd4e027ddf950eaa"
    },
    "KEEPER_HELLO_creation_ref": {
        "canonical": "{\"cap_amb\":\"0\",\"cap_eff\":\"0\",\"cap_inh\":\"0\",\"cap_perm\":\"0\",\"exe_sha256\":\"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\",\"gid\":1001,\"groups\":[1001],\"no_new_privs\":true,\"pid\":101,\"start_ticks\":\"123\",\"uid\":1001}",
        "size": 226,
        "sha256": "44b5cef2c5e0a1cd1d8bf999a91046a3f0d278c8bca923850a775933779f9ac2"
    },
    "SPAWNED_creation_ref": {
        "canonical": "{\"child_generation\":{\"boot_id\":\"12345678-1234-1234-1234-123456789abc\",\"mount_namespace_ref\":\"mnt:[4026531841]\",\"pid\":102,\"pid_namespace_ref\":\"pid:[4026531836]\",\"start_ticks\":\"124\"},\"parent_generation_ref\":\"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\",\"role\":\"LOAD\",\"spawn_record_ref\":\"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\"}",
        "size": 372,
        "sha256": "8a11c29d9b48a0f2931774b32c67061ae39fe2819b48b45501e8f6148b112868"
    }
}



def load_distribution():
    # Standalone pure checks still consume the exact shared SlotSpec. This
    # private fixture namespace conveys no nominal production authority.
    package_name = "keeper_protocol_pure_distribution_fixture"
    package = types.ModuleType(package_name)
    package.__path__ = [str(ROOT)]
    sys.modules[package_name] = package
    contracts = types.ModuleType(package_name + ".contracts")
    contracts.__package__ = package_name
    sys.modules[contracts.__name__] = contracts
    exec(compile(shared_input("contracts"), "<verified-pure-slot-contracts>", "exec"), contracts.__dict__)
    name = package_name + ".payload_distribution"
    spec = importlib.util.spec_from_file_location(name, ROOT / "payload_distribution.py")
    module = importlib.util.module_from_spec(spec)
    sys.modules[name] = module
    spec.loader.exec_module(module)
    return module


CENTRAL_INPUTS = {
    "contracts.py": (43495, "2dcfd29d4938820dcd38e7eef51e4717aa4a3b446f82e8dd2428f449b56f3f8d"),
    "__main__.py": (91048, "50c630a38cc3240a3fe4b0c4b41eeb003ebce462bc862794cf2fd0451e2a21ed"),
    "coordinator.py": (18931, "692b6d591d0377cc6f73436c35bc75aa702a4e42ffdc83bb842cdfbb167ee391"),
    "preflight.py": (14835, "f95d41cc7adc21d51f70fcb4ad70102c9f9d9ff1dc61b8580c6599537561c53a"),
    "sd_bus_transport.py": (41441, "a9829d218539e627f04f263db60183e76df88354d560dfdd656af0d75dc92f72"),
    "systemd_backend.py": (54918, "935c79d7375599725593b678e7774bbab0f6ab059c338c71d704338bcdf3f120"),
    "watchdog.py": (71660, "6e6382a2a7ba19132a182ec13a5310179ae6e18eab30233c3149a7a9051d62d0"),
    "tests/test_watchdog.py": (116056, "f910e4978c1c1ea4eead9757e8e4de57bacd808e44d0bed0fc8847fb5aff2582"),
}
SHARED_INPUTS = {name: (name + ".py", CENTRAL_INPUTS[name + ".py"][1])
                 for name in ("contracts", "__main__", "systemd_backend")}


def central_input(filename):
    """Read only one bounded, final source adjacent to this repository test."""
    expected_size, expected_hash = CENTRAL_INPUTS[filename]
    path = ROOT / filename
    if not path.is_file():
        raise AssertionError("Required final central source unavailable: " + filename)
    if not path.resolve().is_relative_to(ROOT.resolve()) or path.stat().st_size != expected_size:
        raise AssertionError("Final central source path or size changed: " + filename)
    raw = path.read_bytes()
    if len(raw) != expected_size or hashlib.sha256(raw).hexdigest() != expected_hash:
        raise AssertionError("Final central source hash changed: " + filename)
    return raw


def shared_input(name):
    filename, _ = SHARED_INPUTS[name]
    raw = central_input(filename)
    return raw.decode("utf-8")


DISTRIBUTION = load_distribution()


_DELTA_MODULES = None
_REAL_MODULES = None


def require_namespace(name, directory):
    """Allow an existing unittest namespace only at this same repository root."""
    module = sys.modules.get(name)
    if module is None:
        return
    spec = getattr(module, "__spec__", None)
    paths = getattr(module, "__path__", ())
    if (module.__name__ != name or spec is None or spec.name != name or spec.origin is not None
            or getattr(module, "__file__", None) is not None
            or {Path(path).resolve() for path in paths} != {directory.resolve()}):
        raise AssertionError("Foreign canonical namespace: " + name)


def require_module_origin(name, path):
    module = sys.modules.get(name)
    if module is None:
        return
    spec = getattr(module, "__spec__", None)
    filename = getattr(module, "__file__", None)
    if (module.__name__ != name or module.__package__ != name.rpartition(".")[0]
            or spec is None or spec.name != name or not isinstance(spec.origin, str)
            or not isinstance(filename, str)
            or Path(spec.origin).resolve() != path.resolve()
            or Path(filename).resolve() != path.resolve()):
        raise AssertionError("Foreign canonical source: " + name)


def delta_modules():
    """Pure ABI test namespace, with the original authority class unbound.

    Its verified class definition is extracted from the supplied launcher to
    avoid importing missing coordinator/preflight dependencies. No backend is
    created or substituted. This cannot establish Linux kernel or local backend
    custody and never issues a positive release authorization.
    """
    global _DELTA_MODULES
    if _DELTA_MODULES is not None:
        return _DELTA_MODULES
    package_name = "keeper_distribution_delta_fixture"
    package = types.ModuleType(package_name)
    package.__path__ = [str(ROOT)]
    sys.modules[package_name] = package
    contracts = types.ModuleType(package_name + ".contracts")
    contracts.__package__ = package_name
    sys.modules[contracts.__name__] = contracts
    exec(compile(shared_input("contracts"), "<verified-contracts-v3>", "exec"), contracts.__dict__)
    runtime = types.ModuleType(package_name + ".__main__")
    runtime.__package__ = package_name
    runtime.C, runtime.sys, runtime.time = contracts, sys, time
    runtime.monotonic_us = lambda: time.monotonic_ns() // 1000
    sys.modules[runtime.__name__] = runtime
    tree = ast.parse(shared_input("__main__"))
    authority = [node for node in tree.body if isinstance(node, ast.ClassDef)
                 and node.name == "NativeSettlementAuthority"]
    if len(authority) != 1:
        raise AssertionError("Original nominal authority definition unavailable")
    exec(compile(ast.Module(body=authority, type_ignores=[]), "<verified-unbound-authority-v3>", "exec"), runtime.__dict__)
    name = package_name + ".payload_distribution"
    spec = importlib.util.spec_from_file_location(name, ROOT / "payload_distribution.py")
    distribution = importlib.util.module_from_spec(spec)
    sys.modules[name] = distribution
    spec.loader.exec_module(distribution)
    _DELTA_MODULES = distribution, contracts, runtime
    return _DELTA_MODULES


def real_package_modules():
    """Import complete hash-verified central sources; no class/dependency stubs.

    Import alone is permitted. The central entry module's actual __name__ guard
    must keep its CLI inert; no main(), preflight(), backend constructor, socket
    or workload is invoked. The repository's actual distribution is imported
    alongside these sources, so relative nominal resolution is exercised.
    """
    global _REAL_MODULES
    # Verify all eight direct dependencies before imports and before cache use.
    # No handoff manifest, absolute user path, secondary tree or source copies.
    for filename in CENTRAL_INPUTS:
        central_input(filename)
    package_name = "systemd_memory_runtime"
    if (ROOT / "__init__.py").exists() or (ROOT / "tests/__init__.py").exists():
        raise AssertionError("Unexpected non-namespace package initializer")
    require_namespace(package_name, ROOT)
    require_namespace(package_name + ".tests", ROOT / "tests")
    for filename in (*CENTRAL_INPUTS, "payload_distribution.py", "tests/test_keeper_protocol.py"):
        name = package_name + "." + filename.removesuffix(".py").replace("/", ".")
        require_module_origin(name, ROOT / filename)
    if _REAL_MODULES is not None:
        return _REAL_MODULES
    previous_path = list(sys.path)
    sys.path.insert(0, str(ROOT.parent))
    captured_out, captured_error = io.StringIO(), io.StringIO()
    try:
        with contextlib.redirect_stdout(captured_out), contextlib.redirect_stderr(captured_error):
            loaded = {name: importlib.import_module(package_name + "." + name)
                      for name in ("contracts", "__main__", "coordinator", "preflight", "watchdog",
                                   "sd_bus_transport", "systemd_backend", "payload_distribution",
                                   "tests.test_watchdog")}
        if captured_out.getvalue() or captured_error.getvalue():
            raise AssertionError("Import unexpectedly produced CLI output")
        for filename in CENTRAL_INPUTS:
            central_input(filename)
        require_namespace(package_name, ROOT)
        require_namespace(package_name + ".tests", ROOT / "tests")
        for name, module in loaded.items():
            require_module_origin(package_name + "." + name, ROOT / (name.replace(".", "/") + ".py"))
    finally:
        sys.path[:] = previous_path
    _REAL_MODULES = loaded
    return loaded


def run_spec():
    scenarios = ("OVERLAP", "LEADER_EXIT_THREAD_SURVIVES", "DESCENDANT_IGNORES_TERM")
    return dict(run=RUN, t0_us="1", work_deadline_us="50000001",
                cleanup_deadline_us="60000001", load_uid=1001, load_gid=1001,
                load_groups=[1001, 1002], payload_expected_sha256=REF,
                cleanup_policy_id="physical-cleanup-union-v1", scope_ref="authorized:hermetic-fixture",
                slots=[dict(slot=i, unit_name="elogistix-memory-adapter-" + str(i) * 32 + ".service",
                            scenario=scenarios[i], memory_max_bytes=33554432, tasks_max=8)
                       for i in range(3)])


def native_proof_fixture():
    """Full shape fixture only; no kernel producer or native authority is claimed."""
    generation = json.loads(GOLDEN_RECORDS["initial_thread_token"]["canonical"])["generation"]
    exit_fact = dict(tag="SYSTEMD_MAIN_EXIT", original_process_generation=generation,
                     invocation_id="e" * 32, exec_main_pid=generation["pid"],
                     exec_main_code="CLD_EXITED", exec_main_status=0,
                     start_timestamp_us="2", exit_timestamp_us="10", before_us="11", after_us="12")
    release_fact = dict(tag="PIDFD_TASK_RELEASED", original_process_generation=generation,
                        pidfd_identity_ref="pidfd:" + REF,
                        procfs_namespace_ref=generation["pid_namespace_ref"], fdinfo_pid=-1,
                        retained_original=True, not_closed_or_reused=True, before_us="13", after_us="14")
    manager_ref = "c" * 64
    graph = dict(
        start_receipt=dict(kind="start", job_ref="1" * 64, request_ref="2" * 64,
                           event=dict(boot_id=generation["boot_id"], bus_guid="3" * 32,
                                      owner_unique_name=":1.1", job_id=1,
                                      job_path="/org/freedesktop/systemd1/job/1",
                                      unit_name=run_spec()["slots"][2]["unit_name"], result="done", observed_us=3)),
        stop_receipt=dict(kind="stop", job_ref="4" * 64, request_ref="5" * 64,
                          event=dict(boot_id=generation["boot_id"], bus_guid="3" * 32,
                                     owner_unique_name=":1.1", job_id=2,
                                     job_path="/org/freedesktop/systemd1/job/2",
                                     unit_name=run_spec()["slots"][2]["unit_name"], result="done", observed_us=15)),
        final_unit_receipt=dict(original_unit_binding_ref="6" * 64, manager_binding_ref=manager_ref,
                                invocation_id="e" * 32,
                                snapshot=dict(object_path="/org/freedesktop/systemd1/unit/fixture",
                                              unit=dict(ActiveState="inactive", SubState="dead", Job=[0, "/"]),
                                              service=dict(MainPID=0, ControlPID=0)), before_us="15", after_us="16"),
        keeper_reap_receipt=dict(systemd_main_exit=exit_fact, pidfd_task_released=release_fact),
        activations_settled=True, stop_settled=True, terminal_no_pending_execution=True,
        keeper_reaped=True, missing_evidence=[], test_boundary=False)
    for record, ref in (("start_receipt", "start_settlement_ref"), ("stop_receipt", "stop_settlement_ref"),
                        ("final_unit_receipt", "final_unit_receipt_ref"), ("keeper_reap_receipt", "keeper_reap_receipt_ref")):
        graph[ref] = DISTRIBUTION.canonical_digest(graph[record])
    bases = ("NOT_RESERVED_NOT_DISPATCHED", "RESERVED_NOT_DISPATCHED", "START_DISPATCHED_BOUND")
    return dict(run=RUN, payload_binding_ref=REF, slots=[
        dict(slot=i, run=RUN, reservation_ref=None if i == 0 else str(i) * 64,
             payload_binding_ref=REF, manager_binding_ref=manager_ref, basis=bases[i],
             no_future_own_exec=True, observed_us="20", authority_lease_until_us="90",
             cleanup_receipts=graph if i == 2 else None, test_boundary=False) for i in range(3)])


def settlement_facts():
    slot_fields = dict(original_unit_binding_ref=REF, original_physical_binding_ref=REF,
                       start_settlement_ref=REF, stop_settlement_ref=REF,
                       activation_settlement_ref=REF, reap_ledger_ref=REF, keeper_exit_ref=REF,
                       final_unit_observation_ref=REF, physical_observation_ref=REF,
                       physical_tag="OriginalAbsent", leaf_status="CLOSED_REMOVED",
                       observed_us="20", lease_until_us="100")
    return DISTRIBUTION.SettlementFacts(
        run=RUN, payload_binding_ref=REF, cleanup_policy_id="physical-cleanup-union-v1",
        cleanup_deadline_us="100", authority_binding_ref=REF, slot_ledger_ref=REF,
        slots=tuple(DISTRIBUTION.SettledSlotEvidence(slot=i, **(slot_fields | {
            "original_unit_binding_ref": hashlib.sha256(f"unit-{i}".encode()).hexdigest(),
            "original_physical_binding_ref": hashlib.sha256(f"physical-{i}".encode()).hexdigest(),
        })) for i in range(3)),
        no_future_exec_ref=REF, observed_us="30", lease_until_us="90")


class HermeticDistribution(unittest.TestCase):
    """Real Python validators and local token provenance; no kernel mocks."""

    def test_v3_golden_canonical_records_match_official_bytes_and_digests(self):
        # Fixture-only protocol vectors, never claimed kernel identities.
        for name, vector in GOLDEN_RECORDS.items():
            with self.subTest(name=name):
                encoded = vector["canonical"].encode("utf-8")
                self.assertEqual(len(encoded), vector["size"])
                self.assertEqual(hashlib.sha256(encoded).hexdigest(), vector["sha256"])
                self.assertEqual(DISTRIBUTION._record_ref(json.loads(encoded)), vector["sha256"])

    def test_canonical_digest_uses_sorted_utf8_bytes(self):
        record = {"z": "módulo", "a": {"µs": "01", "origin": "1"}}
        expected_bytes = '{"a":{"origin":"1","µs":"01"},"z":"módulo"}'.encode("utf-8")
        self.assertEqual(DISTRIBUTION._record_ref(record),
                         hashlib.sha256(expected_bytes).hexdigest())
        self.assertEqual(DISTRIBUTION._record_ref(dict(reversed(list(record.items())))),
                         hashlib.sha256(expected_bytes).hexdigest())

    def test_canonical_digest_rejects_nonfinite_values(self):
        for value in (float("nan"), float("inf"), -float("inf")):
            with self.subTest(value=value):
                with self.assertRaises((ValueError, DISTRIBUTION.DistributionError)):
                    DISTRIBUTION._record_ref({"untrusted": value})

    def test_runtime_factory_requires_explicit_dependencies(self):
        for config in (None, {}, True, DISTRIBUTION.SettlementAuthority()):
            with self.subTest(config=config):
                with self.assertRaises(DISTRIBUTION.DistributionError) as caught:
                    DISTRIBUTION.RuntimeDistribution(run_spec(), config=config)
                self.assertEqual(caught.exception.code, "CONFIG_REQUIRED")

    def test_v3_keyword_factory_uses_separate_source_and_local_authority(self):
        authority = DISTRIBUTION.SettlementAuthority()
        distributor = DISTRIBUTION.RuntimeDistribution(
            source_elf="/trusted/keeper.elf", control_uid=1000, settlement_authority=authority)
        self.assertEqual(distributor._state, "NEW")
        self.assertEqual(str(distributor._source), "/trusted/keeper.elf")
        self.assertIs(distributor._authority, authority)
        self.assertIsNone(distributor._listener)
        self.assertIsNone(distributor._listener_creator_pid)
        self.assertIsNone(distributor._elf_fd)

    def test_unbound_local_registry_cannot_authorize_runtime_prepare_or_release(self):
        authority = DISTRIBUTION.SettlementAuthority()
        local_facts = settlement_facts()
        local_receipt = authority.issue(local_facts)
        distributor = DISTRIBUTION.RuntimeDistribution(
            source_elf="/trusted/keeper.elf", control_uid=1000, settlement_authority=authority)
        for action in (lambda: distributor.prepare(run_spec(), "50000001"),
                       lambda: distributor.release(None, local_receipt, "60000001")):
            with self.assertRaises(DISTRIBUTION.DistributionError) as caught:
                action()
            self.assertEqual(caught.exception.code, "AUTHORITY_ABI_PENDING")
        self.assertIs(authority._facts_for(local_receipt), local_facts)
        self.assertEqual(distributor._state, "NEW")
        self.assertIsNone(distributor._elf_fd)
        self.assertIsNone(distributor._listener)

    def test_configuration_cannot_be_overridden_by_mixed_factory_arguments(self):
        config = DISTRIBUTION.DistributionConfig(
            "/trusted/keeper.elf", 1000, DISTRIBUTION.SettlementAuthority())
        for extra in ({"source_elf": "/foreign/keeper.elf"}, {"control_uid": 1002},
                      {"settlement_authority": DISTRIBUTION.SettlementAuthority()},
                      {"staging_parent": "/tmp"}, {"allow_test_root": True}):
            with self.subTest(extra=extra):
                with self.assertRaises(DISTRIBUTION.DistributionError) as caught:
                    DISTRIBUTION.RuntimeDistribution(config=config, **extra)
                self.assertEqual(caught.exception.code, "CONFIG_REQUIRED")

    def test_prepare_explicit_deadline_cannot_extend_original_work_before_io(self):
        distributor = DISTRIBUTION.RuntimeDistribution(
            source_elf="/trusted/keeper.elf", control_uid=1000,
            settlement_authority=DISTRIBUTION.SettlementAuthority())
        for deadline, expected_code in (("50000002", "DEADLINE"), ("60000001", "DEADLINE"),
                                        ("01", "INVALID_SPEC"), (True, "INVALID_SPEC"),
                                        ("18446744073709551616", "INVALID_SPEC")):
            with self.subTest(deadline=deadline):
                with self.assertRaises(DISTRIBUTION.DistributionError) as caught:
                    distributor.prepare(run_spec(), deadline)
                self.assertEqual(caught.exception.code, expected_code)
        self.assertEqual(distributor._state, "NEW")
        self.assertIsNone(distributor._elf_fd)
        self.assertEqual(distributor._dirs, [])

    def test_config_and_factory_are_immutable(self):
        config = DISTRIBUTION.DistributionConfig(
            "/trusted/keeper.elf", 1000, DISTRIBUTION.SettlementAuthority())
        factory = DISTRIBUTION.make_runtime_distribution_factory(config)
        with self.assertRaises(FrozenInstanceError):
            config.control_uid = 1001
        with self.assertRaises(FrozenInstanceError):
            factory.config = None

    def test_factory_construction_has_no_staging_or_listener_authority(self):
        authority = DISTRIBUTION.SettlementAuthority()
        config = DISTRIBUTION.DistributionConfig("/trusted/keeper.elf", 1000, authority)
        distributor = DISTRIBUTION.make_runtime_distribution_factory(config)(run_spec())
        self.assertEqual(distributor._state, "NEW")
        self.assertIs(distributor._authority, authority)
        self.assertIsNone(distributor._elf_fd)
        self.assertEqual(distributor._dirs, [])
        with self.assertRaises(DISTRIBUTION.DistributionError) as caught:
            distributor.keeper_listener()
        self.assertEqual(caught.exception.code, "INVALID_STATE")
        with self.assertRaises(DISTRIBUTION.DistributionError):
            _ = distributor.keeper_listener_path

    def test_runtime_constructor_spec_cannot_be_replaced(self):
        config = DISTRIBUTION.DistributionConfig(
            "/trusted/keeper.elf", 1000, DISTRIBUTION.SettlementAuthority())
        distributor = DISTRIBUTION.RuntimeDistribution(run_spec(), config=config)
        changes = ({"scope_ref": "authorized:other"}, {"load_uid": 1002},
                   {"payload_expected_sha256": "c" * 64}, {"run": "d" * 32})
        for change in changes:
            with self.subTest(change=change):
                with self.assertRaises(DISTRIBUTION.DistributionError) as caught:
                    distributor.prepare(run_spec() | change)
                self.assertEqual(caught.exception.code, "INVALID_STATE")
        self.assertEqual(distributor._state, "NEW")

    def test_run_spec_fingerprint_preserves_all_original_fields(self):
        original = run_spec()
        digest = DISTRIBUTION.run_spec_fingerprint(original)
        self.assertEqual(digest, DISTRIBUTION.run_spec_fingerprint(
            dict(reversed(list(original.items())))))
        changes = ({"scope_ref": "authorized:other"}, {"load_uid": 1002},
                   {"load_gid": 1002}, {"load_groups": [1001]},
                   {"payload_expected_sha256": "c" * 64}, {"run": "d" * 32},
                   {"t0_us": "2", "work_deadline_us": "50000002", "cleanup_deadline_us": "60000002"})
        for change in changes:
            with self.subTest(change=change):
                self.assertNotEqual(digest, DISTRIBUTION.run_spec_fingerprint(original | change))
        changed_slots = run_spec()
        changed_slots["slots"][0]["scenario"] = "DESCENDANT_IGNORES_TERM"
        self.assertNotEqual(digest, DISTRIBUTION.run_spec_fingerprint(changed_slots))
        changed_slots = run_spec()
        changed_slots["slots"][0]["unit_name"] = "elogistix-memory-adapter-" + "e" * 32 + ".service"
        self.assertNotEqual(digest, DISTRIBUTION.run_spec_fingerprint(changed_slots))

    def rejected_spec(self, change):
        value = run_spec()
        value.update(change)
        with self.assertRaises(DISTRIBUTION.DistributionError):
            DISTRIBUTION.validate_run_spec(value)

    def rejected_facts(self, facts):
        with self.assertRaises(DISTRIBUTION.DistributionError):
            DISTRIBUTION.SettlementAuthority().issue(facts)

    def test_valid_closed_run_spec(self):
        parsed = DISTRIBUTION.validate_run_spec(run_spec())
        self.assertEqual(parsed.run, RUN)
        self.assertEqual(parsed.work_deadline_us - parsed.t0_us, 50000000)
        self.assertEqual(parsed.cleanup_deadline_us - parsed.t0_us, 60000000)

    def test_spec_missing_or_extra_fields(self):
        self.rejected_spec({"unexpected": 1})
        value = run_spec()
        del value["scope_ref"]
        with self.assertRaises(DISTRIBUTION.DistributionError):
            DISTRIBUTION.validate_run_spec(value)

    def test_normal_uid_and_integer_types(self):
        for change in ({"load_uid": 0}, {"load_uid": True}, {"load_gid": False},
                       {"load_uid": -1}, {"load_uid": 1 << 32}, {"load_uid": "1001"}):
            with self.subTest(change=change):
                self.rejected_spec(change)

    def test_origin_is_never_extended(self):
        for change in ({"work_deadline_us": "50000002"}, {"cleanup_deadline_us": "60000002"},
                       {"work_deadline_us": "50000000"},
                       {"t0_us": "18446744073709551615"}):
            with self.subTest(change=change):
                self.rejected_spec(change)

    def test_canonical_decimal_and_overflow(self):
        for value in ("01", "-1", "+1", " 1", "1.0", "1e0", "18446744073709551616", True):
            with self.subTest(value=value):
                self.rejected_spec({"t0_us": value})

    def test_nonce_and_hash_have_closed_syntax(self):
        for change in ({"run": "A" * 32}, {"run": "a" * 31}, {"run": RUN + "\x00"},
                       {"payload_expected_sha256": "B" * 64},
                       {"payload_expected_sha256": "pending"}):
            with self.subTest(change=change):
                self.rejected_spec(change)

    def test_groups_sorted_distinct_bounded(self):
        for value in ([1002, 1001], [1001, 1001], [True], [1 << 32], list(range(33)), "1001"):
            with self.subTest(value=value):
                self.rejected_spec({"load_groups": value})

    def test_exactly_three_slots_and_original_order(self):
        for slots in (run_spec()["slots"][:2], run_spec()["slots"] + [run_spec()["slots"][0]],
                      list(reversed(run_spec()["slots"]))):
            with self.subTest(slots=slots):
                self.rejected_spec({"slots": slots})

    def test_slot_policy_has_no_larger_or_smaller_fallback(self):
        for change in ({"memory_max_bytes": 33554433}, {"memory_max_bytes": 33554431},
                       {"tasks_max": 9}, {"tasks_max": 7}, {"slot": False}, {"extra": 1}):
            slots = run_spec()["slots"]
            slots[0].update(change)
            with self.subTest(change=change):
                self.rejected_spec({"slots": slots})

    def test_closed_scenarios_and_unique_unit_names(self):
        for value in ("EXEC", ["OVERLAP"], {"scenario": "OVERLAP"}):
            slots = run_spec()["slots"]
            slots[0]["scenario"] = value
            with self.subTest(value=value):
                self.rejected_spec({"slots": slots})
        slots = run_spec()["slots"]
        slots[1]["unit_name"] = slots[0]["unit_name"]
        self.rejected_spec({"slots": slots})
        slots = run_spec()["slots"]
        slots[0]["unit_name"] = "foreign.service"
        self.rejected_spec({"slots": slots})

    def test_scope_and_cleanup_policy_are_required(self):
        for change in ({"scope_ref": ""}, {"scope_ref": "x" * 513}, {"scope_ref": "x\x00y"},
                       {"cleanup_policy_id": "unreviewed"}):
            with self.subTest(change=change):
                self.rejected_spec(change)

    def test_typed_external_settlement_required(self):
        for value in (True, False, {"settled": True}, {}, None):
            with self.subTest(value=value):
                self.rejected_facts(value)
        with self.assertRaises(DISTRIBUTION.DistributionError):
            DISTRIBUTION.SettledCleanupReceipt()

    def test_external_receipt_scope_refs_are_not_unknown(self):
        valid = settlement_facts()
        for field in ("run", "payload_binding_ref", "authority_binding_ref", "slot_ledger_ref", "no_future_exec_ref"):
            with self.subTest(field=field):
                self.rejected_facts(replace(valid, **{field: "pending"}))
        self.rejected_facts(replace(valid, cleanup_policy_id="unknown"))

    def test_receipt_requires_original_slots(self):
        valid = settlement_facts()
        for slots in (valid.slots[:2], (*valid.slots, valid.slots[0]),
                      tuple(reversed(valid.slots)), list(valid.slots),
                      (valid.slots[0], replace(valid.slots[1], slot=True), valid.slots[2])):
            with self.subTest(slots=slots):
                self.rejected_facts(replace(valid, slots=slots))

    def test_each_independent_receipt_is_required(self):
        valid = settlement_facts()
        fields = ("start_settlement_ref", "stop_settlement_ref", "activation_settlement_ref",
                  "reap_ledger_ref", "keeper_exit_ref", "final_unit_observation_ref",
                  "physical_observation_ref", "original_unit_binding_ref", "original_physical_binding_ref")
        for field in fields:
            with self.subTest(field=field):
                slot = replace(valid.slots[0], **{field: "pending"})
                self.rejected_facts(replace(valid, slots=(slot, *valid.slots[1:])))

    def test_physical_uncertainty_and_mismatched_union_tags_rejected(self):
        valid = settlement_facts()
        for tag, status in (("Unavailable", "UNKNOWN"), ("OriginalAbsent", "CLOSED_EMPTY"),
                            ("PresentEmpty", "CLOSED_REMOVED"), ("OriginalAbsent", "UNKNOWN")):
            with self.subTest(tag=tag, status=status):
                item = replace(valid.slots[0], physical_tag=tag, leaf_status=status)
                self.rejected_facts(replace(valid, slots=(item, *valid.slots[1:])))

    def test_deadline_and_lease_brackets(self):
        valid = settlement_facts()
        for change in ({"lease_until_us": "101"},
                       {"observed_us": "90"}, {"observed_us": "91"},
                       {"cleanup_deadline_us": "89"}, {"observed_us": "030"}):
            with self.subTest(change=change):
                self.rejected_facts(replace(valid, **change))

    def test_all_slot_leases_cover_receipt(self):
        valid = settlement_facts()
        for change in ({"lease_until_us": "89"}, {"lease_until_us": "101"},
                       {"observed_us": "31"}, {"observed_us": "01"}):
            with self.subTest(change=change):
                slot = replace(valid.slots[0], **change)
                self.rejected_facts(replace(valid, slots=(slot, *valid.slots[1:])))

    def test_never_activated_slots_need_no_fabricated_unit_or_reap(self):
        valid = settlement_facts()
        slots = tuple(DISTRIBUTION.NeverActivatedSlotEvidence(
            slot=i, reservation_ref=hashlib.sha256(f"reservation-{i}".encode()).hexdigest(), dispatch_state="NOT_DISPATCHED",
            activation_settlement_ref=REF, no_future_exec_ref=REF,
            observed_us="20", lease_until_us="100") for i in range(3))
        authority = DISTRIBUTION.SettlementAuthority()
        facts = replace(valid, slots=slots)
        self.assertIs(authority._facts_for(authority.issue(facts)), facts)

    def test_consumed_or_unknown_start_cannot_be_never_activated(self):
        valid = settlement_facts()
        for state in ("UNKNOWN", "CONSUMED", "DISPATCHED", "SETTLED", True):
            with self.subTest(state=state):
                slot = DISTRIBUTION.NeverActivatedSlotEvidence(
                    slot=0, reservation_ref=REF, dispatch_state=state,
                    activation_settlement_ref=REF, no_future_exec_ref=REF,
                    observed_us="20", lease_until_us="100")
                self.rejected_facts(replace(valid, slots=(slot, *valid.slots[1:])))

    def test_never_activated_requires_irreversible_external_receipts(self):
        valid = settlement_facts()
        original = DISTRIBUTION.NeverActivatedSlotEvidence(
            slot=0, reservation_ref=REF, dispatch_state="NOT_DISPATCHED",
            activation_settlement_ref=REF, no_future_exec_ref=REF,
            observed_us="20", lease_until_us="100")
        for change in ({"reservation_ref": "pending"}, {"activation_settlement_ref": "pending"},
                       {"no_future_exec_ref": "pending"}, {"slot": False},
                       {"observed_us": "31"}, {"lease_until_us": "89"}):
            with self.subTest(change=change):
                self.rejected_facts(replace(valid, slots=(replace(original, **change), *valid.slots[1:])))

    def test_replayed_identity_cannot_certify_another_slot(self):
        valid = settlement_facts()
        for field in ("original_unit_binding_ref", "original_physical_binding_ref"):
            with self.subTest(field=field):
                copied = replace(valid.slots[1], **{field: getattr(valid.slots[0], field)})
                self.rejected_facts(replace(valid, slots=(valid.slots[0], copied, valid.slots[2])))
        first = DISTRIBUTION.NeverActivatedSlotEvidence(
            slot=0, reservation_ref=REF, dispatch_state="NOT_DISPATCHED",
            activation_settlement_ref=REF, no_future_exec_ref=REF,
            observed_us="20", lease_until_us="100")
        self.rejected_facts(replace(valid, slots=(first, replace(first, slot=1), valid.slots[2])))

    def test_parent_and_source_paths_are_closed_without_fallback(self):
        authority = DISTRIBUTION.SettlementAuthority()
        for parent, source in (("/tmp", "/trusted/keeper"), ("/run/../tmp", "/trusted/keeper"),
                               ("//run", "/trusted/keeper"), ("/run", "relative"),
                               ("/run", "/trusted//keeper"), ("/run", "/trusted/keeper\x00"),
                               (None, "/trusted/keeper")):
            with self.subTest(parent=parent, source=source):
                with self.assertRaises(DISTRIBUTION.DistributionError):
                    DISTRIBUTION.PayloadDistributor(parent, source, 1000, settlement_authority=authority)

    def test_constructor_requires_typed_local_authority_and_control_uid(self):
        for change in ({"control_uid": True}, {"control_uid": -1},
                       {"settlement_authority": {"settled": True}}, {"allow_test_root": "yes"}):
            args = dict(control_uid=1000, settlement_authority=DISTRIBUTION.SettlementAuthority())
            args.update(change)
            with self.subTest(change=change):
                with self.assertRaises(DISTRIBUTION.DistributionError):
                    DISTRIBUTION.PayloadDistributor("/run", "/trusted/keeper", **args)

    def test_token_is_bound_to_local_issuer(self):
        authority = DISTRIBUTION.SettlementAuthority()
        facts = settlement_facts()
        receipt = authority.issue(facts)
        self.assertIs(authority._facts_for(receipt), facts)
        with self.assertRaises(DISTRIBUTION.DistributionError):
            DISTRIBUTION.SettlementAuthority()._facts_for(receipt)
        with self.assertRaises(DISTRIBUTION.DistributionError):
            authority._facts_for({"token": receipt})

    def test_receipt_tampering_cannot_replace_authentic_issued_facts(self):
        authority = DISTRIBUTION.SettlementAuthority()
        facts = settlement_facts()
        receipt = authority.issue(facts)
        try:
            receipt._facts = replace(facts, run="d" * 32)
        except (AttributeError, DISTRIBUTION.DistributionError):
            pass
        try:
            returned = authority._facts_for(receipt)
        except DISTRIBUTION.DistributionError:
            return
        self.assertIs(returned, facts)

    def test_consumed_token_cannot_be_replayed(self):
        authority = DISTRIBUTION.SettlementAuthority()
        receipt = authority.issue(settlement_facts())
        authority._consume(receipt)
        with self.assertRaises(DISTRIBUTION.DistributionError):
            authority._facts_for(receipt)

    def test_unissued_token_is_rejected(self):
        authority = DISTRIBUTION.SettlementAuthority()
        fake = object.__new__(DISTRIBUTION.SettledCleanupReceipt)
        object.__setattr__(fake, "_issuer", authority)
        object.__setattr__(fake, "_token", object())
        with self.assertRaises(DISTRIBUTION.DistributionError):
            authority._facts_for(fake)

    @unittest.skipUnless(sys.platform == "win32", "Windows platform boundary check")
    def test_windows_never_stages_or_claims_linux_kernel_validation(self):
        authority = DISTRIBUTION.SettlementAuthority()
        distributor = DISTRIBUTION.PayloadDistributor(
            "/run", "/trusted/keeper.elf", 1000, settlement_authority=authority)
        with self.assertRaises(DISTRIBUTION.DistributionError) as caught:
            distributor.prepare(run_spec())
        self.assertEqual(caught.exception.code, "UNSUPPORTED_PLATFORM")
        self.assertEqual(distributor._state, "NEW")
        self.assertIsNone(distributor._elf_fd)
        self.assertEqual(distributor._dirs, [])


def packet(event="LOAD_PERMIT", body=None, **updates):
    if body is None:
        body = {
            "unit_binding_ref": REF,
            "physical_binding_ref": "c" * 64,
            "scenario": "OVERLAP",
            "work_deadline_us": "50000001",
            "cleanup_deadline_us": "60000001",
        }
    value = dict(v=3, run=RUN, sender="WATCHDOG", seq=1, slot=0,
                 event=event, request=None, mono_us="1", body=body)
    value.update(updates)
    return json.dumps(value, separators=(",", ":")).encode("utf-8")


class RuntimeIntegrationDelta(unittest.TestCase):
    """Pure final-snapshot ABI checks; no kernel mock or positive native proof."""

    @classmethod
    def setUpClass(cls):
        cls.D, cls.C, cls.R = delta_modules()

    def proof(self, value=None, **changes):
        arguments = dict(run=RUN, payload_binding_ref=REF, t0_us="1", cleanup_deadline_us="100",
                         deadline_us="80", observed_now_us="30")
        arguments.update(changes)
        return self.D.validate_native_release_proof(native_proof_fixture() if value is None else value, **arguments)

    def test_three_shared_source_snapshots_have_exact_frozen_hashes(self):
        for name in SHARED_INPUTS:
            with self.subTest(input=name):
                self.assertTrue(shared_input(name))

    def test_payload_mapping_matches_actual_shared_validator_and_digest(self):
        binding = self.D.PayloadBinding(kind="VERIFIED_STAGED_ELF", sha256=REF,
                    absolute_path="/run/elogistix-memory-" + RUN + "/keeper.elf",
                    dev="1", inode="2", mount_namespace_ref="mnt:[4026531841]", owner_uid=0,
                    protected_ancestor_refs=("ancestor:fixture",), exec_identity_proof_ref="PENDING_BEFORE_EXEC")
        plain = self.C.validate_payload_binding(binding)
        self.assertEqual(plain, binding.to_mapping())
        self.assertEqual(self.C.digest_record(binding), binding.reference)
        with self.assertRaises(TypeError):
            binding["owner_uid"] = 1
        plain["protected_ancestor_refs"].append("ancestor:other")
        self.assertEqual(binding.protected_ancestor_refs, ("ancestor:fixture",))

    def test_shared_typed_run_spec_preserves_complete_distribution_fingerprint(self):
        original = run_spec()
        typed = self.C.RunSpec.from_mapping(original)
        self.assertEqual(self.D.run_spec_fingerprint(typed), self.D.run_spec_fingerprint(original))
        self.assertEqual(self.D.run_spec_fingerprint(typed.to_mapping()), self.D.run_spec_fingerprint(original))

    def test_nominal_authority_is_original_unbound_class_and_factory_is_inert(self):
        authority = self.R.NativeSettlementAuthority(self.C.RunSpec.from_mapping(run_spec()))
        self.assertIs(self.D._require_native_authority(authority), self.R.NativeSettlementAuthority)
        distribution = self.D.RuntimeDistribution(source_elf="/trusted/keeper.elf", control_uid=0,
                                                  settlement_authority=authority)
        self.assertIsNone(authority.backend)
        self.assertEqual(distribution._state, "NEW")
        self.assertIsNone(distribution._elf_fd)
        self.assertIsNone(distribution._listener)
        self.assertIsNone(distribution._listener_creator_pid)
        self.assertEqual(distribution._dirs, [])

    def test_resolver_uses_canonical_class_despite_active_m_metadata(self):
        # Pure module-metadata fixture. The full package import has a separate
        # integration test; this never runs a CLI or supplies native authority.
        entry = types.ModuleType("__main__")
        entry.__package__ = self.D.__package__
        qualified = self.D.__package__ + ".__main__"
        entry.__spec__ = importlib.machinery.ModuleSpec(qualified, loader=None)
        entry.C, entry.sys, entry.time = self.C, sys, time
        entry.monotonic_us = lambda: time.monotonic_ns() // 1000
        tree = ast.parse(shared_input("__main__"))
        nodes = [node for node in tree.body if isinstance(node, ast.ClassDef)
                 and node.name == "NativeSettlementAuthority"]
        exec(compile(ast.Module(body=nodes, type_ignores=[]), "<pure-m-entry-metadata-fixture>", "exec"), entry.__dict__)
        previous = sys.modules.get("__main__")
        try:
            sys.modules["__main__"] = entry
            self.assertIs(self.D._native_authority_class(), self.R.NativeSettlementAuthority)
            with self.assertRaises(self.D.DistributionError):
                self.D._require_native_authority(entry.NativeSettlementAuthority(self.C.RunSpec.from_mapping(run_spec())))
            entry.__package__ = "foreign_package"
            self.assertIs(self.D._native_authority_class(), self.R.NativeSettlementAuthority)
            entry.__package__ = self.D.__package__
            entry.__spec__ = importlib.machinery.ModuleSpec("foreign_package.__main__", loader=None)
            self.assertIs(self.D._native_authority_class(), self.R.NativeSettlementAuthority)
            entry.__spec__ = importlib.machinery.ModuleSpec(qualified, loader=None)
            entry.NativeSettlementAuthority = self.R.NativeSettlementAuthority
            self.assertIs(self.D._native_authority_class(), self.R.NativeSettlementAuthority)
        finally:
            if previous is None:
                sys.modules.pop("__main__", None)
            else:
                sys.modules["__main__"] = previous

    def test_duck_local_registry_and_subclass_do_not_supply_native_authority(self):
        class Duck:
            def attach_once(self, backend):
                raise AssertionError("Untrusted method must not be called")

            def prove_release_allowed(self, payload, deadline):
                raise AssertionError("Untrusted method must not be called")

        class Subclass(self.R.NativeSettlementAuthority):
            pass

        for authority in (Duck(), Subclass(self.C.RunSpec.from_mapping(run_spec())), True, {}):
            with self.subTest(authority=type(authority).__name__):
                with self.assertRaises(self.D.DistributionError):
                    self.D.RuntimeDistribution(source_elf="/trusted/keeper.elf", control_uid=0,
                                               settlement_authority=authority)
        # Legacy construction remains an explicit inert review adapter; its
        # local registry cannot enable the production preparation path.
        legacy = self.D.RuntimeDistribution(source_elf="/trusted/keeper.elf", control_uid=0,
                                            settlement_authority=self.D.SettlementAuthority())
        with self.assertRaises(self.D.DistributionError) as caught:
            legacy.prepare(run_spec(), "50000001")
        self.assertEqual(caught.exception.code, "AUTHORITY_ABI_PENDING")
        self.assertIsNone(legacy._elf_fd)
        self.assertIsNone(legacy._listener)

    def test_unbound_original_authority_cannot_issue_release_even_for_full_fixture(self):
        authority = self.R.NativeSettlementAuthority(self.C.RunSpec.from_mapping(run_spec()))
        with self.assertRaises(ValueError):
            authority.prove_release_allowed(native_proof_fixture(), 80)
        self.assertIsNone(authority.backend)

    def test_changed_original_authority_spec_and_foreign_run_fail_before_io(self):
        authority = self.R.NativeSettlementAuthority(self.C.RunSpec.from_mapping(run_spec()))
        distribution = self.D.RuntimeDistribution(source_elf="/trusted/keeper.elf", control_uid=0,
                                                  settlement_authority=authority)
        with self.assertRaises(self.D.DistributionError):
            distribution.prepare(run_spec() | {"scope_ref": "authorized:other"}, "50000001")
        authority.spec = self.C.RunSpec.from_mapping(run_spec() | {"scope_ref": "authorized:other"})
        with self.assertRaises(self.D.DistributionError):
            distribution.prepare(run_spec(), "50000001")
        self.assertEqual(distribution._state, "NEW")
        self.assertIsNone(distribution._elf_fd)
        self.assertIsNone(distribution._listener)

    def test_unprepared_listener_and_caller_cleanup_flags_do_not_authorize_io(self):
        authority = self.R.NativeSettlementAuthority(self.C.RunSpec.from_mapping(run_spec()))
        distribution = self.D.RuntimeDistribution(source_elf="/trusted/keeper.elf", control_uid=0,
                                                  settlement_authority=authority)
        for action in (distribution.keeper_listener,
                       lambda: distribution.release(None, native_proof_fixture(), "60000001"),
                       lambda: distribution.release(None, True, "60000001")):
            with self.assertRaises(self.D.DistributionError) as caught:
                action()
            self.assertEqual(caught.exception.code, "INVALID_STATE")
        self.assertIsNone(authority.backend)
        self.assertEqual(distribution._state, "NEW")
        self.assertIsNone(distribution._listener)

    @unittest.skipUnless(sys.platform == "win32", "Windows platform boundary")
    def test_actual_nominal_runtime_prepare_on_windows_stops_before_staging(self):
        value = run_spec()
        now = time.monotonic_ns() // 1000
        value.update(t0_us=str(now), work_deadline_us=str(now + 50_000_000), cleanup_deadline_us=str(now + 60_000_000))
        authority = self.R.NativeSettlementAuthority(self.C.RunSpec.from_mapping(value))
        distribution = self.D.RuntimeDistribution(source_elf="/trusted/keeper.elf", control_uid=0,
                                                  settlement_authority=authority)
        with self.assertRaises(self.D.DistributionError) as caught:
            distribution.prepare(value, now + 1_000_000)
        self.assertEqual(caught.exception.code, "UNSUPPORTED_PLATFORM")
        self.assertEqual(distribution._state, "NEW")
        self.assertIsNone(distribution._elf_fd)
        self.assertIsNone(distribution._listener)
        self.assertEqual(distribution._dirs, [])

    def test_full_shape_fixture_retains_three_original_receipts_and_whole_graph(self):
        value = native_proof_fixture()
        proof = self.proof(value)
        self.assertEqual(proof.to_mapping(), value)
        # The aggregate retained proof can be deeper than an IPC contract
        # record. Check exact canonical bytes independently; no envelope is sent.
        encoded = json.dumps(value, ensure_ascii=False, sort_keys=True,
                             separators=(",", ":"), allow_nan=False).encode("utf-8")
        self.assertEqual(proof.reference, hashlib.sha256(encoded).hexdigest())
        self.assertEqual((proof.lease_until_us, proof.observed_us), (90, 20))
        self.assertIsNone(proof.record["slots"][0]["cleanup_receipts"])
        self.assertIsNone(proof.record["slots"][1]["cleanup_receipts"])
        keeper = proof.record["slots"][2]["cleanup_receipts"]["keeper_reap_receipt"]
        self.C.validate_main_release_facts(keeper["systemd_main_exit"], keeper["pidfd_task_released"])

    def test_full_shape_fixture_is_immutable_and_copies_do_not_mutate_retained_graph(self):
        value = native_proof_fixture()
        proof = self.proof(value)
        original = proof.to_mapping()
        value["slots"][2]["cleanup_receipts"]["keeper_reap_receipt"]["pidfd_task_released"]["fdinfo_pid"] = 0
        exported = proof.to_mapping()
        exported["slots"][2]["cleanup_receipts"]["missing_evidence"].append("KEEPER_REAP")
        self.assertEqual(proof.to_mapping(), original)
        with self.assertRaises(TypeError):
            proof.record["slots"][2]["no_future_own_exec"] = False

    def test_unknown_dispatch_partial_graph_flags_and_missing_evidence_are_rejected(self):
        for case in ("unknown", "partial", "flags", "missing", "test_boundary", "no_future"):
            value = native_proof_fixture()
            slot = value["slots"][2]
            graph = slot["cleanup_receipts"]
            if case == "unknown":
                slot["basis"] = "START_DISPATCHED_UNKNOWN"
            elif case == "partial":
                del graph["keeper_reap_receipt"]
            elif case == "flags":
                graph["keeper_reap_receipt"] = True
            elif case == "missing":
                graph["missing_evidence"] = ["KEEPER_REAP"]
            elif case == "test_boundary":
                graph["test_boundary"] = True
            else:
                slot["no_future_own_exec"] = False
            with self.subTest(case=case), self.assertRaises(self.D.DistributionError):
                self.proof(value)

    def test_not_dispatched_does_not_accept_invented_unit_graph_or_reservation(self):
        for case in ("unreserved_graph", "unreserved_reservation", "reserved_graph", "reserved_missing_ref"):
            value = native_proof_fixture()
            if case == "unreserved_graph":
                value["slots"][0]["cleanup_receipts"] = value["slots"][2]["cleanup_receipts"]
            elif case == "unreserved_reservation":
                value["slots"][0]["reservation_ref"] = "d" * 64
            elif case == "reserved_graph":
                value["slots"][1]["cleanup_receipts"] = value["slots"][2]["cleanup_receipts"]
            else:
                value["slots"][1]["reservation_ref"] = None
            with self.subTest(case=case), self.assertRaises(self.D.DistributionError):
                self.proof(value)

    def test_proof_replays_wrong_scope_manager_order_or_record_digest_are_rejected(self):
        for case in ("run", "payload", "manager", "order", "missing_slot", "digest", "reservation"):
            value = native_proof_fixture()
            if case == "run":
                value["run"] = "d" * 32
            elif case == "payload":
                value["slots"][2]["payload_binding_ref"] = "d" * 64
            elif case == "manager":
                value["slots"][1]["manager_binding_ref"] = "d" * 64
            elif case == "order":
                value["slots"].reverse()
            elif case == "missing_slot":
                value["slots"].pop()
            elif case == "reservation":
                value["slots"][2]["reservation_ref"] = value["slots"][1]["reservation_ref"]
            else:
                value["slots"][2]["cleanup_receipts"]["keeper_reap_receipt"]["pidfd_task_released"]["fdinfo_pid"] = 0
            with self.subTest(case=case), self.assertRaises(self.D.DistributionError):
                self.proof(value)

    def test_original_deadline_lease_and_observation_brackets_cannot_extend(self):
        for change in ({"observed_now_us": "80"}, {"deadline_us": "101"}, {"observed_now_us": "0"},
                       {"observed_now_us": "19"}, {"deadline_us": "30"}):
            with self.subTest(change=change), self.assertRaises(self.D.DistributionError):
                self.proof(**change)
        value = native_proof_fixture()
        value["slots"][2]["authority_lease_until_us"] = "30"
        with self.assertRaises(self.D.DistributionError):
            self.proof(value)


class PortableCentralInventory(unittest.TestCase):
    """Missing/corrupt neighbors and foreign module origins fail before cache."""

    def test_missing_final_neighbor_is_an_explicit_failure(self):
        from unittest.mock import patch
        original = Path.is_file
        missing = ROOT / "contracts.py"
        with patch.object(Path, "is_file", lambda path: False if path == missing else original(path)):
            with self.assertRaisesRegex(AssertionError, "Required final central source unavailable: contracts.py"):
                central_input("contracts.py")

    def test_corrupt_final_neighbor_is_rejected_before_cached_modules(self):
        from unittest.mock import patch
        original = Path.read_bytes
        corrupted = ROOT / "contracts.py"

        def read(path):
            raw = original(path)
            return raw[:-1] + bytes([raw[-1] ^ 1]) if path == corrupted else raw

        with patch.object(sys.modules[__name__], "_REAL_MODULES", object()), patch.object(Path, "read_bytes", read):
            with self.assertRaisesRegex(AssertionError, "Final central source hash changed: contracts.py"):
                real_package_modules()

    def test_foreign_canonical_source_is_rejected_before_cached_modules(self):
        from unittest.mock import patch
        name = "systemd_memory_runtime.contracts"
        foreign = types.ModuleType(name)
        foreign.__package__ = name.rpartition(".")[0]
        foreign.__file__ = str(ROOT.parent / "foreign/contracts.py")
        foreign.__spec__ = importlib.machinery.ModuleSpec(name, loader=None, origin=foreign.__file__)
        with patch.object(sys.modules[__name__], "_REAL_MODULES", object()), patch.dict(sys.modules, {name: foreign}):
            with self.assertRaisesRegex(AssertionError, "Foreign canonical source: " + name):
                real_package_modules()


class RealRuntimeModuleIntegration(unittest.TestCase):
    """Actual assembled imports, distinct from the preceding pure AST fixtures."""

    @classmethod
    def setUpClass(cls):
        cls.M = real_package_modules()
        cls.D, cls.C = cls.M["payload_distribution"], cls.M["contracts"]

    def test_real_entry_import_is_inert_and_accepts_its_own_nominal_authority(self):
        runtime = self.M["__main__"]
        self.assertEqual(runtime.__spec__.name, self.D.__package__ + ".__main__")
        self.assertNotEqual(runtime.__name__, "__main__")
        authority = runtime.NativeSettlementAuthority(self.C.RunSpec.from_mapping(run_spec()))
        self.assertEqual(type(authority).__module__, runtime.__name__)
        self.assertIs(self.D._native_authority_class(), type(authority))
        distribution = self.D.RuntimeDistribution(source_elf="/trusted/keeper.elf", control_uid=0,
                                                  settlement_authority=authority)
        self.assertIs(distribution._authority, authority)
        self.assertIsNone(authority.backend)
        self.assertEqual(distribution._state, "NEW")
        self.assertIsNone(distribution._elf_fd)
        self.assertIsNone(distribution._listener)
        self.assertEqual(distribution._dirs, [])

    def test_real_canonical_authority_matches_delegating_m_guard(self):
        runtime = self.M["__main__"]
        tree = ast.parse(Path(runtime.__file__).read_text(encoding="utf-8"))
        guards = [node for node in tree.body if isinstance(node, ast.If)
                  and ast.dump(node.test) == ast.dump(ast.parse('__name__ == "__main__"', mode="eval").body)]
        self.assertEqual(len(guards), 1)
        expected = ast.parse('raise SystemExit(importlib.import_module(__package__ + ".__main__").main())').body[0]
        self.assertEqual(ast.dump(guards[0].body[0]), ast.dump(expected))
        # The entry alias may coexist with the canonical module. It cannot
        # replace the nominal class selected by the actual distribution.
        entry = types.ModuleType("__main__")
        entry.__package__ = self.D.__package__
        entry.__spec__ = importlib.machinery.ModuleSpec(runtime.__name__, loader=None)
        entry.NativeSettlementAuthority = object
        previous = sys.modules.get("__main__")
        try:
            sys.modules["__main__"] = entry
            self.assertIs(self.D._native_authority_class(), runtime.NativeSettlementAuthority)
        finally:
            if previous is None:
                sys.modules.pop("__main__", None)
            else:
                sys.modules["__main__"] = previous

    def test_real_arm_retains_original_binding_and_projects_wire_mapping(self):
        """Actual ARM core plus explicit pure phase boundary; no ELF/kernel I/O.

        prepare/verify are intentionally stopped at a retained-object seam.
        The production _known guard runs unchanged. This proves the object ABI,
        not staging, hash-to-exec identity, Linux authentication or authority.
        """
        h = self.M["tests.test_watchdog"].Harness()
        D = self.D
        authority = self.M["__main__"].NativeSettlementAuthority(h.spec)
        retained = D.RuntimeDistribution(source_elf="/trusted/keeper.elf", control_uid=0,
                                         settlement_authority=authority)
        binding = D.PayloadBinding("VERIFIED_STAGED_ELF", h.spec.payload_expected_sha256,
                    "/run/elogistix-memory-" + h.spec.run + "/keeper.elf", "2", "3", "mnt:[fixture]",
                    0, ("parent:root", "parent:run", "parent:staging"), "PENDING_BEFORE_EXEC")
        retained._state = "PREPARED"
        retained._binding = binding
        retained._spec = D.validate_run_spec(h.spec)
        calls = []
        case = self
        call_deadline = min(h.spec.work_deadline_us, h.clock.now + self.M["watchdog"].RPC_MAX_US)

        class RetainedPhaseBoundary:
            fixture_only = True

            def prepare(self, spec, deadline):
                case.assertEqual(D.run_spec_fingerprint(spec), D.run_spec_fingerprint(h.spec))
                case.assertEqual(deadline, call_deadline)
                calls.append(("prepare", binding))
                return binding

            def verify(self, payload, deadline):
                D.PayloadDistributor._known(retained, payload)
                case.assertEqual(deadline, call_deadline)
                calls.append(("verify", payload))

            def release(self, *args, **kwargs):
                raise AssertionError("ARM must not release a payload")

        def listener(payload, deadline):
            D.PayloadDistributor._known(retained, payload)
            case.assertEqual(deadline, call_deadline)
            calls.append(("listener", payload))

        h.watchdog.distribution = RetainedPhaseBoundary()
        h.watchdog.listener_factory = listener
        messages = h.arm()
        self.assertIs(type(h.watchdog), self.M["watchdog"].Watchdog)
        self.assertEqual(h.watchdog.state, "ARMED", h.watchdog.snapshot())
        self.assertEqual([name for name, _ in calls], ["prepare", "verify", "listener"])
        self.assertTrue(all(payload is binding for _, payload in calls))
        self.assertIs(h.watchdog.payload_local, binding)
        self.assertIs(type(h.watchdog.payload), dict)
        self.assertEqual(h.watchdog.payload, binding.to_mapping())
        self.assertIs(type(h.watchdog.payload["protected_ancestor_refs"]), list)
        self.assertIsNot(h.watchdog.payload, binding)
        armed = [packet for packet in messages if packet.event == "ARMED"]
        self.assertEqual(len(armed), 1)
        self.assertEqual(armed[0].to_mapping()["body"]["payload_binding"], binding.to_mapping())
        evidence = h.watchdog.export_evidence()
        self.assertEqual(evidence["payload_binding"], binding.to_mapping())
        self.assertTrue(evidence["fixture_only"])
        self.assertFalse(h.watchdog.snapshot()["runtime_certificate"])
        self.assertEqual(h.backend.start_calls, [])
        self.assertEqual(h.backend.stop_calls, [])
        self.assertIsNone(authority.backend)
        self.assertIsNone(retained._elf_fd)
        self.assertIsNone(retained._listener)
        # Exact dataclass clones and the valid wire projection have no custody.
        for foreign in (dict(binding.to_mapping()), replace(binding)):
            with self.subTest(foreign=type(foreign).__name__):
                with self.assertRaises(D.DistributionError) as caught:
                    D.PayloadDistributor._known(retained, foreign)
                self.assertEqual(caught.exception.code, "INVALID_STATE")


class ResourceProfileQuotaDelta(unittest.TestCase):
    """Closed approved quota compatibility; no kernel claims.

    Derive quotas from the complete, verified shared SlotSpec's closed defaults.
    Exact centrally approved expectations additionally pin 32 MiB and 8 tasks;
    a stale 80 MiB source cannot silently pass this compatibility regression.
    No test parameters, environment variables, or <= aggregate-budget fallback.
    """

    @classmethod
    def setUpClass(cls):
        modules = real_package_modules()
        cls.M = modules
        cls.D, cls.C = modules["payload_distribution"], modules["contracts"]

    def shared_profile_spec(self):
        value = run_spec()
        value["slots"] = [self.C.SlotSpec(item["slot"], item["unit_name"], item["scenario"]).to_mapping()
                          for item in value["slots"]]
        return value

    def test_shared_closed_profile_matches_distribution_without_free_quota_parameters(self):
        value = self.shared_profile_spec()
        typed = self.C.RunSpec.from_mapping(value)
        self.assertEqual(self.D.validate_run_spec(value), self.D.validate_run_spec(typed))
        self.assertEqual(self.D.run_spec_fingerprint(value), self.D.run_spec_fingerprint(typed))
        self.assertEqual(len(value["slots"]), 3)
        self.assertEqual([item["slot"] for item in value["slots"]], [0, 1, 2])
        self.assertTrue(all(item["memory_max_bytes"] == 33_554_432 and item["tasks_max"] == 8
                            for item in value["slots"]))
        self.assertEqual(sum(item["memory_max_bytes"] for item in value["slots"]), 100_663_296)
        self.assertEqual(sum(item["tasks_max"] for item in value["slots"]), 24)

    def test_shared_closed_profile_rejects_each_neighbor_and_noninteger_quota(self):
        for slot in range(3):
            for field in ("memory_max_bytes", "tasks_max"):
                original = self.shared_profile_spec()["slots"][slot][field]
                for foreign in (original - 1, original + 1, str(original), float(original),
                                original + 0.5, True, False, None):
                    value = self.shared_profile_spec()
                    value["slots"][slot][field] = foreign
                    with self.subTest(slot=slot, field=field, foreign=foreign):
                        with self.assertRaises(self.C.ContractError):
                            self.C.RunSpec.from_mapping(value)
                        with self.assertRaises(self.D.DistributionError) as caught:
                            self.D.validate_run_spec(value)
                        self.assertEqual(caught.exception.code, "INVALID_SPEC")

    def test_old_and_compensated_profiles_remain_rejected(self):
        old = self.shared_profile_spec()
        for item in old["slots"]:
            item["memory_max_bytes"] = 83_886_080
        compensated = self.shared_profile_spec()
        compensated["slots"][0]["memory_max_bytes"] += 1
        compensated["slots"][1]["memory_max_bytes"] -= 1
        tasks = self.shared_profile_spec()
        tasks["slots"][0]["tasks_max"] += 1
        tasks["slots"][1]["tasks_max"] -= 1
        for value in (old, compensated, tasks):
            with self.subTest(slots=value["slots"]):
                with self.assertRaises(self.C.ContractError):
                    self.C.RunSpec.from_mapping(value)
                with self.assertRaises(self.D.DistributionError):
                    self.D.validate_run_spec(value)

    def test_policy_resolver_rejects_foreign_alias_and_subclass(self):
        original = self.C.SlotSpec

        class Foreign:
            def __init__(self, **kwargs):
                raise AssertionError("foreign quota constructor must not run")

        class Subclass(original):
            pass

        try:
            for foreign in (Foreign, Subclass, object, {}):
                with self.subTest(foreign=repr(foreign)):
                    self.C.SlotSpec = foreign
                    with self.assertRaises(self.D.DistributionError):
                        self.D._contract_slot_spec_class()
        finally:
            self.C.SlotSpec = original

    def test_verified_start_properties_matches_closed_slot_profile(self):
        # Pure property construction only, never a bus connection or Start call.
        value = self.shared_profile_spec()
        slot = value["slots"][0]
        prefix = "/run/elogistix-memory-" + value["run"] + "/"
        argv = (prefix + "keeper.elf", "--run", value["run"], "--slot", "0",
                "--ipc", prefix + "watchdog.sock", "--t0-us", value["t0_us"],
                "--work-deadline-us", value["work_deadline_us"],
                "--cleanup-deadline-us", value["cleanup_deadline_us"],
                "--watchdog-pid", "100", "--watchdog-start-ticks", "1000")
        transport = self.M["sd_bus_transport"]
        request = transport.StartRequest(slot["unit_name"], argv, value["load_uid"], value["load_gid"],
                                         tuple(value["load_groups"]), 40_000_000)
        properties = {name: (signature, item) for name, signature, item in transport.start_properties(request)}
        self.assertEqual(properties["MemoryMax"], ("t", slot["memory_max_bytes"]))
        self.assertEqual(properties["TasksMax"], ("t", slot["tasks_max"]))


class KeeperLoadProfileSourceRegression(unittest.TestCase):
    """Byte-level scope check only; Linux compilation is separately required."""

    def test_only_authorized_load_bytes_define_changed(self):
        raw = SOURCE.read_bytes()
        current = b"#define LOAD_BYTES (8u * 1024u * 1024u)"
        previous = b"#define LOAD_BYTES (12u * 1024u * 1024u)"
        self.assertEqual(raw.count(current), 1)
        self.assertEqual(raw.count(previous), 0)
        self.assertEqual(hashlib.sha256(raw.replace(current, previous, 1)).hexdigest(),
                         "98589118bde58c238d18e966b7471b1c060a84d02e9e57c6dbda006975d2c758")


class NativeValidators(unittest.TestCase):
    """Direct production C checks, skipped when Linux/compiler are absent."""

    @classmethod
    def setUpClass(cls):
        if sys.platform != "linux":
            raise unittest.SkipTest("Linux C validation not executed on Windows")
        compiler = shutil.which("cc") or shutil.which("gcc") or shutil.which("clang")
        if not compiler:
            raise unittest.SkipTest("No existing Linux C compiler; none installed")
        cls.temp = tempfile.TemporaryDirectory(prefix="keeper-protocol-")
        cls.addClassCleanup(cls.temp.cleanup)
        folder = Path(cls.temp.name)
        cls.harness = folder / "protocol-check"
        cls.binary = folder / "keeper"
        included = str(SOURCE).replace("\\", "\\\\").replace('"', '\\"')
        code = r'''
#define _GNU_SOURCE
#define main keeper_program_main
#include "KEEPER_SOURCE"
#undef main
static int count_open_fds(void) {
    DIR *directory = opendir("/proc/self/fd");
    struct dirent *entry;
    int count = 0;
    if (!directory) return -1;
    while ((entry = readdir(directory))) {
        if (entry->d_name[0] != '.') count++;
    }
    closedir(directory);
    return count;
}
static int fixture_generation(struct generation *value, pid_t pid) {
    memset(value, 0, sizeof(*value));
    value->pid = pid; value->ticks = 123; value->pidfd = -1;
    strcpy(value->boot, "12345678-1234-1234-1234-123456789abc");
    strcpy(value->pidns, "pid:[5]"); strcpy(value->mntns, "mnt:[6]");
    return format_generation(value);
}
int main(int argc, char **argv) {
    if (argc < 2) return 99;
    if (!strcmp(argv[1], "load-bytes")) {
        if (argc != 2) return 99;
        printf("%zu\n", (size_t)LOAD_BYTES);
        return 0;
    }
    if (!strcmp(argv[1], "u64")) {
        uint64_t value = 0;
        if (argc != 3) return 99;
        return parse_u64(argv[2], &value) == 0 ? 0 : 1;
    }
    if (!strcmp(argv[1], "wait")) {
        if (argc != 5) return 99;
        return waitpid_consumed((pid_t)strtol(argv[2], NULL, 10),
             (pid_t)strtol(argv[3], NULL, 10), (int)strtol(argv[4], NULL, 10)) ? 0 : 1;
    }
    if (!strcmp(argv[1], "deadline")) {
        if (argc != 6) return 99;
        return deadline_pair_valid(strtoull(argv[2], NULL, 10),
            strtoull(argv[3], NULL, 10), strtoull(argv[4], NULL, 10),
            strtoull(argv[5], NULL, 10)) ? 0 : 1;
    }
    if (!strcmp(argv[1], "schema")) {
        char data[16385];
        size_t length = fread(data, 1, sizeof(data), stdin);
        struct json_doc doc;
        struct inbound message;
        if (json_parse(data, length, &doc) != 0) return 1;
        return validate_envelope(&doc, "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
                                 0, 1, &message) == 0 ? 0 : 1;
    }
    if (!strcmp(argv[1], "json")) {
        char data[16385];
        size_t length = fread(data, 1, sizeof(data), stdin);
        struct json_doc doc;
        return json_parse(data, length, &doc) == 0 ? 0 : 1;
    }
    if (!strcmp(argv[1], "sha")) {
        char digest[65];
        if (argc != 3) return 99;
        hash_text(argv[2], digest);
        puts(digest);
        return 0;
    }
    if (!strcmp(argv[1], "canonical")) {
        char data[16385], output[RECORD_MAX + 1], ref[65];
        size_t length = fread(data, 1, sizeof(data) - 1, stdin);
        data[length] = 0;
        if (canonical_json(data, output, sizeof(output)) || canonical_digest(data, ref)) return 1;
        puts(output); puts(ref); return 0;
    }
    if (!strcmp(argv[1], "generation")) {
        struct generation value;
        if (fixture_generation(&value, 23)) return 1;
        puts(value.json); puts(value.ref); return 0;
    }
    if (!strcmp(argv[1], "initial-thread")) {
        struct generation value;
        char ref[65];
        if (argc != 4 || fixture_generation(&value, (pid_t)strtol(argv[2], NULL, 10))) return 99;
        value.ticks = strtoull(argv[3], NULL, 10);
        strcpy(value.pidns, "pid:[4026531836]"); strcpy(value.mntns, "mnt:[4026531841]");
        if (format_generation(&value) || initial_thread_token(&value, ref)) return 1;
        puts(ref); return 0;
    }
    if (!strcmp(argv[1], "checkpoint")) {
        const char *refs[32];
        char ref[65];
        int i;
        if (argc < 3 || argc > 35) return 99;
        for (i = 3; i < argc; i++) refs[i - 3] = argv[i];
        if (checkpoint_digest_refs(argv[2], refs, (size_t)(argc - 3), ref)) return 1;
        puts(ref); return 0;
    }
    if (!strcmp(argv[1], "receipt")) {
        struct generation child, reaper;
        char output[RECORD_MAX + 1];
        if (argc != 8 || fixture_generation(&child, 23) || fixture_generation(&reaper, 7)) return 99;
        if (!strcmp(argv[7], "boot")) strcpy(reaper.boot, "22345678-1234-1234-1234-123456789abc");
        if (!strcmp(argv[7], "namespace")) strcpy(reaper.pidns, "pid:[9]");
        if (!strcmp(argv[7], "self")) reaper.pid = child.pid;
        if (format_generation(&reaper)) return 99;
        if (format_waitpid_receipt(&child, &reaper, (pid_t)strtol(argv[2], NULL, 10),
            (pid_t)strtol(argv[3], NULL, 10), (int)strtol(argv[4], NULL, 10),
            strtoull(argv[5], NULL, 10), strtoull(argv[6], NULL, 10), output, sizeof(output))) return 1;
        puts(output); return 0;
    }
    if (!strcmp(argv[1], "fdclean")) return inherited_fds_clean() == 0 ? 0 : 1;
    if (!strcmp(argv[1], "gate")) {
        int ends[2], result;
        if (argc != 3 || pipe(ends)) return 99;
        if (!strcmp(argv[2], "G") && write(ends[1], "G", 1) != 1) return 99;
        close(ends[1]);
        result = child_gate(ends[0], -1, mono_us() + 100000);
        close(ends[0]);
        return result == 0 ? 0 : 1;
    }
    if (!strcmp(argv[1], "received-rights")) {
        struct keeper keeper;
        struct inbound inbound;
        int sockets[2], pipe_fds[2], passcred = 1, before, after, received;
        union { struct cmsghdr alignment; unsigned char bytes[CMSG_SPACE(sizeof(int))]; } ancillary;
        struct cmsghdr *header;
        struct msghdr message;
        struct iovec vector;
        char data[16385];
        size_t length = fread(data, 1, sizeof(data), stdin);
        memset(&keeper, 0, sizeof(keeper));
        memset(&message, 0, sizeof(message));
        memset(&ancillary, 0, sizeof(ancillary));
        if (socketpair(AF_UNIX, SOCK_SEQPACKET | SOCK_CLOEXEC, 0, sockets) || pipe(pipe_fds)) return 99;
        if (setsockopt(sockets[1], SOL_SOCKET, SO_PASSCRED, &passcred, sizeof(passcred))) return 99;
        if (generation_read(getpid(), &keeper.watchdog)) return 99;
        keeper.channel = sockets[1];
        keeper.peer.pid = getpid(); keeper.peer.uid = getuid(); keeper.peer.gid = getgid();
        strcpy(keeper.run, "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa");
        keeper.slot = 0;
        vector.iov_base = data; vector.iov_len = length;
        message.msg_iov = &vector; message.msg_iovlen = 1;
        message.msg_control = ancillary.bytes; message.msg_controllen = sizeof(ancillary.bytes);
        header = CMSG_FIRSTHDR(&message);
        header->cmsg_level = SOL_SOCKET; header->cmsg_type = SCM_RIGHTS;
        header->cmsg_len = CMSG_LEN(sizeof(int));
        memcpy(CMSG_DATA(header), &pipe_fds[0], sizeof(int));
        before = count_open_fds();
        if (sendmsg(sockets[0], &message, 0) != (ssize_t)length) return 99;
        received = receive_packet(&keeper, &inbound);
        after = count_open_fds();
        close(pipe_fds[0]); close(pipe_fds[1]); close(sockets[0]); close(sockets[1]);
        close(keeper.watchdog.pidfd);
        return received < 0 && before == after ? 0 : 1;
    }
    return 99;
}
'''.replace("KEEPER_SOURCE", included)
        harness_source = folder / "protocol-check.c"
        harness_source.write_text(code, encoding="utf-8")
        cls.compile_commands = []
        for source, binary in ((harness_source, cls.harness), (SOURCE, cls.binary)):
            command = [compiler, "-std=c11", "-O2", "-Wall", "-Wextra", "-Werror",
                       "-pthread", str(source), "-o", str(binary)]
            cls.compile_commands.append(command)
            result = subprocess.run(command, capture_output=True, text=True, timeout=60)
            if result.returncode:
                raise AssertionError("Real Linux compilation failed:\n" + result.stderr)

    def check(self, mode, *args, data=None):
        result = subprocess.run([str(self.harness), mode, *map(str, args)],
                                input=data, capture_output=True, timeout=5)
        self.assertIn(result.returncode, (0, 1), result.stderr.decode(errors="replace"))
        return result.returncode == 0

    def test_native_load_bytes_keep_two_workers_within_closed_slot_cap(self):
        # Reads a compiled production macro; never calls synthetic_load().
        result = subprocess.run([str(self.harness), "load-bytes"], capture_output=True, text=True, timeout=5)
        self.assertEqual(result.returncode, 0, result.stderr)
        load_bytes = int(result.stdout.strip())
        self.assertEqual(load_bytes, 8_388_608)
        self.assertEqual(2 * load_bytes, 16_777_216)
        self.assertLess(2 * load_bytes, 33_554_432)

    def test_canonical_uint64(self):
        for value in ("0", "1", "18446744073709551615"):
            with self.subTest(value=value):
                self.assertTrue(self.check("u64", value))
        for value in ("", "00", "01", "-1", "+1", " 1", "1 ", "1.0", "1e2",
                      "18446744073709551616", "١", "0x1"):
            with self.subTest(value=value):
                self.assertFalse(self.check("u64", value))

    def test_waitpid_requires_consumed_original_terminal_child(self):
        self.assertTrue(self.check("wait", 23, 23, 0))
        self.assertTrue(self.check("wait", 23, 23, 7 << 8))
        self.assertTrue(self.check("wait", 23, 23, 9))
        for returned, status in ((0, 0), (-1, 0), (24, 0), (23, 0x137f), (23, 0xffff),
                                 (23, -1), (23, 65536), (23, 128), (23, 65),
                                 (23, (7 << 8) | 9), (23, (255 << 8) | 128)):
            with self.subTest(returned=returned, status=status):
                self.assertFalse(self.check("wait", 23, returned, status))
        self.assertFalse(self.check("wait", 0, 0, 0))
        self.assertTrue(self.check("wait", 23, 23, 11 | 128))
        self.assertTrue(self.check("wait", 23, 23, 255 << 8))

    def test_original_deadlines_and_boundary(self):
        self.assertTrue(self.check("deadline", 1, 50000001, 60000001, 2))
        for args in ((1, 50000002, 60000001, 2), (1, 50000001, 60000002, 2),
                     (1, 50000001, 60000001, 50000001),
                     (10, 50000010, 60000010, 9),
                     (18446744073709551600, 40, 50, 1)):
            with self.subTest(args=args):
                self.assertFalse(self.check("deadline", *args))

    def test_load_permit_envelope(self):
        self.assertTrue(self.check("schema", data=packet()))
        self.assertTrue(self.check("schema", data=packet().replace(b'"OVERLAP"', b'"OVER\\u004cAP"')))

    def test_envelope_replays_wrong_channel_and_unknown_fields(self):
        for change in ({"seq": 0}, {"seq": 2}, {"seq": True}, {"v": 2}, {"v": True},
                       {"run": "d" * 32}, {"run": "A" * 32}, {"slot": 1},
                       {"slot": None}, {"sender": "COORDINATOR"},
                       {"event": "ARM"}, {"extra": 1}, {"request": 0},
                       {"mono_us": "01"}, {"mono_us": 1}):
            with self.subTest(change=change):
                self.assertFalse(self.check("schema", data=packet(**change)))

    def test_duplicate_keys_floats_and_packet_limit(self):
        valid = packet()
        cases = [valid.replace(b'"v":3', b'"v":3,"v":3'),
                 valid.replace(b'"v":3', b'"v":3,"\\u0076":3'),
                 valid.replace(b'"v":3', b'"v":3.0'),
                 valid.replace(b'"seq":1', b'"seq":NaN'),
                 valid + b"x", valid + b" " * 16385,
                 valid.replace(b'"scenario":"OVERLAP"', b'"scenario":"OVERLAP","scenario":"OVERLAP"'),
                 valid.replace(b'"OVERLAP"', b'"\xff"'), b""]
        for index, invalid in enumerate(cases):
            with self.subTest(index=index):
                self.assertFalse(self.check("schema", data=invalid))

    def test_closed_permit_body_and_local_refs(self):
        valid_body = json.loads(packet())["body"]
        for change in ({"scenario": "custom-command"}, {"unit_binding_ref": 3},
                       {"physical_binding_ref": 9}, {"unit_binding_ref": "pending"},
                       {"work_deadline_us": "01"}, {"extra": 1}):
            with self.subTest(change=change):
                self.assertFalse(self.check("schema", data=packet(body=valid_body | change)))
        self.assertFalse(self.check("schema", data=packet(body={"work_deadline_us": "1"})))

    def test_ack_schema_is_closed(self):
        good = packet(event="ACK", body={"accepted_seq": 3, "ledger_record_sha256": REF}, request=3)
        self.assertTrue(self.check("schema", data=good))
        self.assertTrue(self.check("schema", data=packet(
            event="ACK", body={"accepted_seq": 3, "ledger_record_sha256": REF}, request=3, slot=None)))
        for body in ({"accepted_seq": True, "ledger_record_sha256": REF},
                     {"accepted_seq": 0, "ledger_record_sha256": REF},
                     {"accepted_seq": 3, "ledger_record_sha256": "pending"},
                     {"accepted_seq": 3, "ledger_record_sha256": REF, "fd": 8}):
            with self.subTest(body=body):
                self.assertFalse(self.check("schema", data=packet(event="ACK", body=body, request=3)))
        for request in (None, 2, 4):
            with self.subTest(request=request):
                self.assertFalse(self.check("schema", data=packet(
                    event="ACK", body={"accepted_seq": 3, "ledger_record_sha256": REF}, request=request)))

    def test_closed_argv_rejection_does_not_run_workload(self):
        for arguments in ([], ["--help"], ["--run", RUN], ["--run", RUN, "--run", RUN]):
            with self.subTest(arguments=arguments):
                result = subprocess.run([str(self.binary), *arguments], capture_output=True, timeout=5)
                self.assertEqual(result.returncode, 78)

    def test_json_depth_and_array_size_boundaries(self):
        for count in (0, 32):
            self.assertTrue(self.check("json", data=json.dumps({"a": list(range(count))}).encode()))
        self.assertFalse(self.check("json", data=json.dumps({"a": list(range(33))}).encode()))
        value = 0
        for _ in range(5):
            value = {"a": value}
        self.assertTrue(self.check("json", data=json.dumps(value).encode()))
        self.assertFalse(self.check("json", data=json.dumps({"a": value}).encode()))

    def test_native_hash_matches_independent_sha256_vectors(self):
        for value in ("", "abc", "a" * 1000):
            result = subprocess.run([str(self.harness), "sha", value], capture_output=True, text=True, timeout=5)
            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertEqual(result.stdout.strip(), hashlib.sha256(value.encode()).hexdigest())

    def test_native_canonical_json_matches_exact_utf8_python_encoding(self):
        records = [{"z": "módulo", "a": {"µs": "1", "origin": "18446744073709551615"}},
                   {"emoji": "🚀", "control": "\b\f\n\r\t\x01", "quote": '"\\/', "array": [True, None, 3]}]
        for record in records:
            with self.subTest(record=record):
                result = subprocess.run([str(self.harness), "canonical"],
                                        input=json.dumps(record, ensure_ascii=True).encode(),
                                        capture_output=True, timeout=5)
                self.assertEqual(result.returncode, 0, result.stderr.decode(errors="replace"))
                expected = json.dumps(record, ensure_ascii=False, sort_keys=True,
                                      separators=(",", ":"), allow_nan=False).encode("utf-8")
                self.assertEqual(result.stdout.splitlines(),
                                 [expected, hashlib.sha256(expected).hexdigest().encode()])

    def test_process_generation_contains_no_remote_pidfd_and_has_canonical_ref(self):
        result = subprocess.run([str(self.harness), "generation"], capture_output=True, timeout=5)
        self.assertEqual(result.returncode, 0, result.stderr.decode(errors="replace"))
        encoded, ref = result.stdout.splitlines()
        generation = json.loads(encoded)
        self.assertEqual(generation, {"pid": 23, "start_ticks": "123",
                                     "boot_id": "12345678-1234-1234-1234-123456789abc",
                                     "pid_namespace_ref": "pid:[5]", "mount_namespace_ref": "mnt:[6]"})
        self.assertEqual(encoded, json.dumps(generation, ensure_ascii=False, sort_keys=True,
                                            separators=(",", ":"), allow_nan=False).encode())
        self.assertEqual(ref.decode(), hashlib.sha256(encoded).hexdigest())

    def test_waitpid_receipt_retains_original_full_generations_options_and_bracket(self):
        result = subprocess.run([str(self.harness), "receipt", "23", "23", "9", "17", "21", "same"],
                                capture_output=True, timeout=5)
        self.assertEqual(result.returncode, 0, result.stderr.decode(errors="replace"))
        value = json.loads(result.stdout)
        self.assertEqual(set(value), {"tag", "child_generation", "reaper_generation", "before_us", "after_us",
                                      "requested_pid", "options", "returned_pid", "raw_wait_status"})
        self.assertEqual(value["tag"], "WAITPID_CONSUMED")
        self.assertEqual(value["options"], "WNOHANG")
        self.assertEqual((value["requested_pid"], value["returned_pid"], value["raw_wait_status"]), (23, 23, 9))
        self.assertEqual((value["before_us"], value["after_us"]), ("17", "21"))
        self.assertEqual(value["child_generation"]["pid"], 23)
        self.assertEqual(value["reaper_generation"]["pid"], 7)
        self.assertNotIn("pidfd_ref", value["child_generation"])
        for args in ((23, 0, 0, 17, 21, "same"), (23, 24, 0, 17, 21, "same"),
                     (24, 24, 0, 17, 21, "same"), (23, 23, 128, 17, 21, "same"),
                     (23, 23, 0, 21, 17, "same"), (23, 23, 0, 17, 21, "boot"),
                     (23, 23, 0, 17, 21, "namespace"), (23, 23, 0, 17, 21, "self")):
            with self.subTest(args=args):
                self.assertFalse(self.check("receipt", *args))

    def test_initial_thread_token_matches_v3_generation_and_role_golden(self):
        result = subprocess.run([str(self.harness), "initial-thread", "101", "123"],
                                capture_output=True, text=True, timeout=5)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(result.stdout.strip(), GOLDEN_RECORDS["initial_thread_token"]["sha256"])
        for pid, ticks in ((102, 123), (101, 124)):
            with self.subTest(pid=pid, ticks=ticks):
                generation = json.loads(GOLDEN_RECORDS["initial_thread_token"]["canonical"])["generation"]
                generation.update(pid=pid, start_ticks=str(ticks))
                record = {"generation": generation, "role": "INITIAL_THREAD"}
                expected = hashlib.sha256(json.dumps(record, ensure_ascii=False, sort_keys=True,
                                                     separators=(",", ":")).encode()).hexdigest()
                changed = subprocess.run([str(self.harness), "initial-thread", str(pid), str(ticks)],
                                         capture_output=True, text=True, timeout=5)
                self.assertEqual(changed.returncode, 0, changed.stderr)
                self.assertEqual(changed.stdout.strip(), expected)
                self.assertNotEqual(changed.stdout.strip(), result.stdout.strip())

    def test_initial_creation_refs_hash_existing_body_only(self):
        for name in ("KEEPER_HELLO_creation_ref", "SPAWNED_creation_ref"):
            with self.subTest(name=name):
                vector = GOLDEN_RECORDS[name]
                result = subprocess.run([str(self.harness), "canonical"],
                                        input=vector["canonical"].encode(), capture_output=True, timeout=5)
                self.assertEqual(result.returncode, 0, result.stderr.decode(errors="replace"))
                self.assertEqual(result.stdout.splitlines(),
                                 [vector["canonical"].encode(), vector["sha256"].encode()])
                body = json.loads(vector["canonical"])
                wrapped = json.dumps({"event": name.removesuffix("_creation_ref"), "body": body})
                wrong = subprocess.run([str(self.harness), "canonical"], input=wrapped.encode(),
                                       capture_output=True, timeout=5)
                self.assertEqual(wrong.returncode, 0, wrong.stderr.decode(errors="replace"))
                self.assertNotEqual(wrong.stdout.splitlines()[1], vector["sha256"].encode())

    def test_checkpoint_refs_digest_sorted_body_or_receipt_hashes(self):
        for kind in ("spawns", "reaps"):
            for refs in ([], ["c" * 64, "a" * 64, "b" * 64]):
                with self.subTest(kind=kind, refs=refs):
                    expected = hashlib.sha256(json.dumps({kind: sorted(refs)}, sort_keys=True,
                                                         separators=(",", ":")).encode()).hexdigest()
                    result = subprocess.run([str(self.harness), "checkpoint", kind, *refs],
                                            capture_output=True, text=True, timeout=5)
                    self.assertEqual(result.returncode, 0, result.stderr)
                    self.assertEqual(result.stdout.strip(), expected)

    def test_actual_inherited_descriptor_is_rejected(self):
        clean = subprocess.run([str(self.harness), "fdclean"], stdin=subprocess.DEVNULL,
                               capture_output=True, timeout=5)
        self.assertEqual(clean.returncode, 0)
        read_fd, write_fd = os.pipe()
        try:
            result = subprocess.run([str(self.harness), "fdclean"], pass_fds=(read_fd,),
                                    stdin=subprocess.DEVNULL, capture_output=True, timeout=5)
            self.assertEqual(result.returncode, 1)
        finally:
            os.close(read_fd)
            os.close(write_fd)

    def test_real_pipe_gate_accepts_permit_then_expected_writer_close(self):
        self.assertTrue(self.check("gate", "G"))
        self.assertFalse(self.check("gate", "EOF"))

    def test_received_rights_are_rejected_and_closed_on_truncated_packet(self):
        self.assertTrue(self.check("received-rights", data=packet()))
        self.assertTrue(self.check("received-rights", data=packet() + b" " * 16385))


if __name__ == "__main__":
    unittest.main(verbosity=2)
