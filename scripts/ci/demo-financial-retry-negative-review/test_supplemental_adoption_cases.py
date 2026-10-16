"""Offline source and denial-branch checks; PostgreSQL execution remains NOT_RUN."""

from __future__ import annotations

import importlib.util
import json
from pathlib import Path
import re
import sys
import unittest


HERE = Path(__file__).resolve().parent
CANONICAL = HERE.parent / "demo-financial-compile-recovery"
UPSTREAM = CANONICAL / "upstream"
BASELINE = HERE.parents[2] / "supabase" / "schema" / "baseline.sql"


def load(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    sys.modules[name] = module
    spec.loader.exec_module(module)
    return module


subject = load("supplemental_adoption_test_subject", HERE / "supplemental_adoption_cases.py")


def uncomment(sql):
    return re.sub(r"--[^\n]*", "", sql)


def insert_columns(sql, table):
    return [[c.strip() for c in match.split(",")]
            for match in re.findall(r"INSERT INTO public\." + table + r"\((.*?)\)\s*VALUES", sql, re.S)]


class SupplementalAdoptionSourceTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.baseline = BASELINE.read_text(encoding="utf-8")
        cls.engine = (UPSTREAM / "flow/sql/04-engine.sql").read_text(encoding="utf-8")
        cls.bridge = (UPSTREAM / "authentic/bridge.sql").read_text(encoding="utf-8")
        cls.approval = (UPSTREAM / "flow/issuer/12-approval-main.sql").read_text(encoding="utf-8")
        manifest_sql = (UPSTREAM / "flow/sql/02-manifest.sql").read_text(encoding="utf-8")
        manifest = json.loads(re.search(r"\$manifest\$(.*?)\$manifest\$", manifest_sql, re.S).group(1))
        cls.fixtures = {f["id"]: f for f in manifest["fixtures"]}

    def test_two_fresh_supplements_leave_delivered_nine_case_provider_unchanged(self):
        existing = load("supplemental_existing_nine_provider", HERE / "suite.py")
        self.assertEqual(9, len(existing.CASES))
        self.assertEqual({"foreign_bound_concept_id", "foreign_bound_payment_id"},
                         {case["id"] for case in subject.CASES})
        self.assertFalse({c["id"] for c in subject.CASES} & {c["id"] for c in existing.CASES})
        for case in subject.CASES:
            self.assertEqual("fresh", case["phase"])
            self.assertEqual("23514", case["expected_sqlstate"])
            self.assertEqual("DEMO_FINANCIAL_ADOPTION_DENIED", case["expected_message"])
            self.assertNotIn("__", case["mutation_sql"] + case["proof_sql"])

    def test_both_collision_branches_exist_in_exact_native_bridge_denial(self):
        guard = re.search(r"IF EXISTS\(SELECT 1 FROM public\.proveedor_facturas WHERE id=.*?"
                          r"RAISE EXCEPTION 'DEMO_FINANCIAL_ADOPTION_DENIED' USING ERRCODE='23514'",
                          self.bridge, re.S).group(0)
        self.assertIn("public.proveedor_facturas_conceptos WHERE id IN(SELECT value::uuid", guard)
        self.assertIn("public.pagos_proveedor WHERE id=(b->>'payment_id')::uuid", guard)

    def test_auxiliary_default_uuid_columns_and_insert_contracts_are_canonical(self):
        for table in ("proveedor_facturas", "proveedor_facturas_conceptos"):
            self.assertRegex(self.baseline, r"CREATE TABLE public\." + table
                             + r" \(\s+id uuid DEFAULT gen_random_uuid\(\) NOT NULL")
        expected_header = insert_columns(self.engine, "proveedor_facturas")[0][1:]
        expected_concept = insert_columns(self.engine, "proveedor_facturas_conceptos")[0]
        expected_payment = insert_columns(self.engine, "pagos_proveedor")[0]
        for case in subject.CASES:
            sql = uncomment(case["mutation_sql"])
            self.assertEqual([expected_header], insert_columns(sql, "proveedor_facturas"))
            self.assertIn("RETURNING id INTO parent_id", sql)
            self.assertIn("parent_id=ANY(bound_ids)", sql)
        concept_sql, payment_sql = [uncomment(c["mutation_sql"]) for c in subject.CASES]
        self.assertEqual([expected_concept], insert_columns(concept_sql, "proveedor_facturas_conceptos"))
        self.assertEqual([expected_concept[1:]], insert_columns(payment_sql, "proveedor_facturas_conceptos"))
        self.assertIn("RETURNING id INTO auxiliary_id", payment_sql)
        self.assertEqual([expected_payment], insert_columns(payment_sql, "pagos_proveedor"))

    def test_canonical_payment_fixture_meets_approval_tax_balance_and_date_guards(self):
        fixture = self.fixtures["ofc-parcial"]
        self.assertEqual(fixture["subtotal"], sum(c["quantity"] * c["amount"] for c in fixture["concepts"]))
        self.assertLessEqual(fixture["vat"], fixture["subtotal"] * .16 + .02)
        self.assertEqual(fixture["total"], fixture["subtotal"] + fixture["vat"])
        self.assertEqual("MXN", fixture["currency"])
        self.assertEqual(fixture["currency"], fixture["payment"]["currency"])
        self.assertGreater(fixture["payment"]["amount"], 0)
        self.assertLess(fixture["payment"]["amount"], fixture["total"])
        self.assertLessEqual(fixture["issuedOffset"], fixture["payment"]["dateOffset"])
        self.assertLessEqual(fixture["payment"]["dateOffset"], 0)
        self.assertEqual(fixture["payment"]["remaining"], fixture["total"] - fixture["payment"]["amount"])

    def test_payment_approval_runs_native_human_branch_and_restores_complete_actor_fixture(self):
        human = self.approval.split("CREATE FUNCTION demo_flow_writer.human_approval_main", 1)[1].split(
            "CREATE FUNCTION demo_flow_writer.demo_approval_main", 1)[0]
        for guard in ("auth.uid()", "public.user_roles", "public.organization_members",
                      "p_expected_updated_at", "public._cxp_validar_aprobacion",
                      "set_config('app.aprobando_cxp'", "public.bitacora_actividad"):
            self.assertIn(guard, human)
        self.assertIn("IF p_run IS NULL THEN RETURN demo_flow_writer.human_approval_main", self.approval)
        sql = uncomment(subject.CASES[1]["mutation_sql"])
        self.assertIn("common_approval(parent_id,true,NULL,invoice_version.updated_at,NULL,NULL)", sql)
        self.assertLess(sql.index("RETURNING id INTO auxiliary_id"),
                        sql.index("SELECT * INTO STRICT invoice_version"))
        self.assertIn("(v.binding->>'shipment_id')::uuid", sql)
        for restored in ("subject_user_id=saved_auth.subject_user_id",
                         "role_name=saved_auth.role_name", "jwt_claims=saved_auth.jwt_claims"):
            self.assertIn(restored, sql)
        self.assertNotIn("set_config('app.aprobando_cxp'", sql)
        self.assertNotRegex(sql, r"UPDATE\s+public\.proveedor_facturas\s+SET\s+estado_aprobacion")

    def test_second_positive_origin_check_follows_all_auxiliaries_and_precedes_target(self):
        for case in subject.CASES:
            sql = uncomment(case["mutation_sql"])
            checks = [match.start() for match in re.finditer(
                r"PERFORM demo_flow_writer\.verify_identity_receipt\(v\.receipt_id\);", sql)]
            self.assertEqual(2, len(checks))
            parent_insert = sql.index("INSERT INTO public.proveedor_facturas(")
            target_table = "proveedor_facturas_conceptos" if "concept" in case["id"] else "pagos_proveedor"
            target_insert = sql.index("INSERT INTO public." + target_table + "(id,")
            self.assertLess(checks[0], parent_insert)
            self.assertLess(parent_insert, checks[1])
            self.assertLess(checks[1], target_insert)
            if target_table == "pagos_proveedor":
                self.assertLess(sql.index("jwt_claims=saved_auth.jwt_claims"), checks[1])
            self.assertIn("before_target:=pg_temp.financial_snapshot();", sql[checks[1]:target_insert])
            self.assertNotIn("EXCEPTION WHEN", sql)

    def test_independent_collision_truth_tables_and_exact_post_target_rows_are_required(self):
        for case, concept_count, payment_count in zip(subject.CASES, (1, 0), (0, 1)):
            proof = uncomment(case["proof_sql"])
            invoice, concepts, payment = re.findall(
                r"WHERE (?:f|c|p)\.id=.*?\)\)<>(\d+)", proof, re.S)
            self.assertEqual(("0", str(concept_count), str(payment_count)), (invoice, concepts, payment))
            self.assertIn("pg_temp.financial_snapshot() IS DISTINCT FROM v.post_target_rows", proof)
            self.assertIn("v.pre_target_rows IS NOT DISTINCT FROM v.post_target_rows", proof)
            self.assertIn("IS DISTINCT FROM v.target_snapshot", proof)
            self.assertIn("IS DISTINCT FROM v.auxiliary_document_snapshot", proof)
            self.assertIn("PERFORM demo_fixture_identity.verify_preparation_origin(v.receipt_id)", proof)
            self.assertIn("IS DISTINCT FROM v.auth_snapshot", proof)

    def test_no_private_evidence_writes_uuid_minting_or_guard_bypass(self):
        for case in subject.CASES:
            sql = uncomment(case["mutation_sql"] + case["proof_sql"])
            self.assertNotRegex(sql, r"(?i)\b(?:gen_random_uuid|uuid_generate_v4)\s*\(")
            self.assertNotRegex(sql, r"(?i)\b(?:UPDATE|DELETE FROM|INSERT INTO)\s+demo_")
            self.assertNotRegex(sql, r"(?i)\b(?:ALTER|GRANT|TRUNCATE|DISABLE|BYPASSRLS)\b")
            self.assertNotRegex(sql, r"(?i)\bCREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\b")
            self.assertNotRegex(sql, r"\b[0-9a-fA-F]{8}(?:-[0-9a-fA-F]{4}){3}-[0-9a-fA-F]{12}\b")
            self.assertIn("t.tgenabled IS DISTINCT FROM 'O'", sql)

    def test_required_public_triggers_and_human_helper_dependencies_are_installed(self):
        catalog = load("supplemental_adoption_catalog", CANONICAL / "catalog.py")
        bundle = catalog.build_catalog(BASELINE.read_bytes())
        installed_triggers = {(o["parent_name"], o["name"]) for o in bundle.manifest["objects"]
                              if o["kind"] == "trigger"}
        needed = re.findall(r"\('public\.([a-z_]+)'::regclass,'([a-z_0-9]+)'\)", subject._TRIGGER_ASSERT)
        self.assertEqual(18, len(needed))
        for pair in needed:
            self.assertIn(pair, installed_triggers)
        installed_functions = {f["name"] for f in bundle.manifest["functions"]}
        self.assertIn("_cxp_validar_aprobacion", installed_functions)
        self.assertIn("guard_aprobacion_proveedor_factura", installed_functions)
        self.assertIn("guard_pago_proveedor", installed_functions)


if __name__ == "__main__":
    unittest.main()
