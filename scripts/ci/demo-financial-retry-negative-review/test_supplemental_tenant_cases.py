"""Offline source and scope contracts; no database client is imported or invoked."""

import importlib.util
from pathlib import Path
import re
import sys
import unittest


HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
UPSTREAM = HERE.parent / "demo-financial-compile-recovery" / "upstream"
BASELINE = ROOT / "supabase" / "schema" / "baseline.sql"


def load(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    sys.modules[name] = module
    spec.loader.exec_module(module)
    return module


supplement = load("retry_supplement_tenant_contract", HERE / "supplemental_tenant_cases.py")


class SupplementalTenantSourceTests(unittest.TestCase):
    def test_native_denial_requires_original_tenant_before_global_role(self):
        source = (UPSTREAM / "flow" / "issuer" / "16-owner-registry.sql").read_text(encoding="utf-8")
        scheduler = re.search(
            r"CREATE FUNCTION demo_flow_writer\.validated_scheduler\(.*?AS \$\$(.*?)\$\$;",
            source, re.S,
        ).group(1)
        predicate = re.search(
            r"PERFORM 1 FROM public\.organization_members om(.*?)"
            r"IF NOT FOUND THEN RAISE EXCEPTION 'DEMO_SPONSOR_MEMBERSHIP_REQUIRED' "
            r"USING ERRCODE='42501'; END IF;", scheduler, re.S,
        )
        self.assertIsNotNone(predicate)
        self.assertIn("om.user_id=a.sponsor_user_id", predicate.group(1))
        self.assertIn("om.organization_id=a.organization_id", predicate.group(1))
        self.assertLess(predicate.start(), scheduler.index("PERFORM 1 FROM public.user_roles"))
        context_reader = re.search(
            r"CREATE OR REPLACE FUNCTION demo_flow_writer\.read_server_context\(.*?AS \$\$(.*?)\$\$;",
            source, re.S,
        ).group(1)
        self.assertIn("validated_scheduler(c.scheduler_approval_id)", context_reader)
        self.assertEqual(supplement.CASES[0]["expected_sqlstate"], "42501")
        self.assertEqual(supplement.CASES[0]["expected_message"], "DEMO_SPONSOR_MEMBERSHIP_REQUIRED")

    def test_every_canonical_membership_update_trigger_is_role_qualified_and_installed(self):
        baseline = BASELINE.read_text(encoding="utf-8")
        declarations = re.findall(
            r"^CREATE TRIGGER ([a-z_]+) (.*?) ON public\.organization_members (.*?);$",
            baseline, re.M,
        )
        updates = {name: (events, action) for name, events, action in declarations if "UPDATE" in events}
        self.assertEqual(set(updates), {
            "trg_bloquear_rol_plataforma_om", "trg_log_role_change_om", "trg_sync_user_roles_om_upd",
        })
        for name, (events, _) in updates.items():
            with self.subTest(trigger=name):
                self.assertRegex(events, r"\bUPDATE OF role(?:$| OR )")
        catalog = load("retry_supplement_tenant_catalog", HERE.parent / "demo-financial-compile-recovery" / "catalog.py")
        bundle = catalog.build_catalog(BASELINE.read_bytes())
        installed = {obj["name"] for obj in bundle.manifest["objects"]
                     if obj["kind"] == "trigger" and obj["parent_name"] == "organization_members"}
        self.assertTrue(set(updates).issubset(installed))

    def test_existing_membership_constraints_accept_only_the_measured_existing_target(self):
        baseline = BASELINE.read_text(encoding="utf-8")
        for invariant in (
            "organization_members_organization_id_user_id_key UNIQUE (organization_id, user_id)",
            "organization_members_pkey PRIMARY KEY (id)",
            "organization_members_user_id_unique UNIQUE (user_id)",
            "organization_members_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id)",
        ):
            self.assertIn(invariant, baseline)
        mutation = supplement.CASES[0]["mutation_sql"]
        updates = re.findall(r"\bUPDATE\s+([a-z_.]+)\s+SET\s+(.*?)\s+WHERE\b", mutation, re.I | re.S)
        self.assertEqual(updates, [("public.organization_members", "organization_id=v_second_tenant")])
        self.assertIn("GET DIAGNOSTICS v_changed=ROW_COUNT", mutation)
        self.assertIn("pg_temp.financial_manual_sentinels", mutation)
        self.assertIn("WHERE id=v_second_tenant AND activo IS TRUE", mutation)

    def test_supplement_cannot_forge_context_or_relax_guards(self):
        self.assertEqual(len(supplement.CASES), 1)
        case = supplement.CASES[0]
        self.assertEqual(case["phase"], "materialized")
        self.assertEqual(case["rejection_stage"], "rpc")
        self.assertEqual(case["boundary_tag"], "current-tenant-membership")
        for key in ("mutation_sql", "proof_sql"):
            sql = re.sub(r"--[^\n]*", "", case[key])
            self.assertNotRegex(sql, r"(?i)\b(?:INSERT|DELETE|GRANT|ALTER|TRUNCATE|DISABLE)\b")
            self.assertNotRegex(sql, r"(?i)\b(?:gen_random_uuid|uuid_generate_v4|set_config)\s*\(")
            self.assertNotRegex(sql, r"(?i)\bUPDATE\s+(?:demo_|pg_temp\.)")
            self.assertNotRegex(sql, r"(?i)session_replication_role|request\.jwt")
            self.assertNotRegex(sql, r"\b[0-9a-fA-F]{8}(?:-[0-9a-fA-F]{4}){3}-[0-9a-fA-F]{12}\b")
        self.assertEqual(supplement.BLOCKED_CASES[0]["status"], "BLOCKED")
        self.assertNotIn("expected_sqlstate", supplement.BLOCKED_CASES[0])


if __name__ == "__main__":
    unittest.main()
