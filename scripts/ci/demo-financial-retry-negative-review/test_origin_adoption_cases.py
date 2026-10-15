"""Offline source-contract checks; these never execute PostgreSQL or a client."""

from __future__ import annotations

import importlib.util
from pathlib import Path
import re
import sys
import unittest


HERE = Path(__file__).resolve().parent
UPSTREAM = HERE.parent / "demo-financial-compile-recovery" / "upstream"
BASELINE = HERE.parents[2] / "supabase" / "schema" / "baseline.sql"


def load(name: str, path: Path):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    sys.modules[name] = module
    spec.loader.exec_module(module)
    return module


adoption = load("retry_review_adoption_contract", HERE / "adoption_cases.py")
drift = load("retry_review_drift_contract", HERE / "origin_materialization_cases.py")
CASES = adoption.CASES + drift.CASES


class OriginAdoptionSourceContractTests(unittest.TestCase):
    def test_expected_native_errors_remain_in_canonical_verifiers(self):
        """A guard renamed upstream must fail this preparation, not accept any error."""
        sources = {
            "foreign_financial_adoption": UPSTREAM / "authentic" / "bridge.sql",
            "origin_drift": UPSTREAM / "authentic" / "producer.sql",
            "materialization_drift": UPSTREAM / "flow" / "sql" / "04-engine.sql",
        }
        for case in CASES:
            with self.subTest(case=case["id"]):
                source = sources[case["category"]].read_text(encoding="utf-8")
                native_raise = (
                    r"RAISE\s+EXCEPTION\s+'" + re.escape(case["expected_message"])
                    + r"'\s+USING\s+ERRCODE\s*=\s*'"
                    + re.escape(case["expected_sqlstate"]) + "'"
                )
                self.assertRegex(source, native_raise)

    def test_foreign_header_uses_canonical_writer_insert_contract(self):
        engine = (UPSTREAM / "flow" / "sql" / "04-engine.sql").read_text(encoding="utf-8")
        pattern = r"INSERT INTO public\.proveedor_facturas\((.*?)\)\s*VALUES"
        writer_columns = re.search(pattern, engine, re.S).group(1)
        collision_columns = re.search(pattern, adoption.CASES[0]["mutation_sql"], re.S).group(1)
        columns = lambda value: [column.strip() for column in value.split(",")]
        self.assertEqual(columns(writer_columns), columns(collision_columns))

    def test_folio_update_guard_really_resets_canonical_approval(self):
        baseline = BASELINE.read_text(encoding="utf-8")
        guard = re.search(
            r"CREATE FUNCTION public\.guard_edicion_factura_proveedor\(\).*?AS \$\$(.*?)\$\$;",
            baseline, re.S,
        ).group(1)
        self.assertRegex(guard, r"NEW\.folio_proveedor IS DISTINCT FROM OLD\.folio_proveedor")
        for assignment in (
            "NEW.estado_aprobacion := 'pendiente'",
            "NEW.aprobada_por := NULL", "NEW.aprobada_at := NULL",
            "NEW.aprobacion_heredada := false",
        ):
            self.assertIn(assignment, guard)

    def test_required_public_triggers_are_in_the_canonical_install_closure(self):
        catalog = load("retry_review_source_catalog", HERE.parent / "demo-financial-compile-recovery" / "catalog.py")
        bundle = catalog.build_catalog(BASELINE.read_bytes())
        installed = {(obj["parent_name"], obj["name"]) for obj in bundle.manifest["objects"]
                     if obj["kind"] == "trigger"}
        required = {
            "proveedor_facturas": {
                "trg_org_proveedor_facturas_embarque_id", "trg_org_proveedor_facturas_proveedor_id",
                "trg_proveedor_factura_no_provisional", "trg_proveedor_facturas_total_guard",
                "trg_proveedor_facturas_set_fecha_vencimiento", "trg_periodo_proveedor_facturas",
                "trg_set_folio_interno_proveedor_factura", "trg_proveedor_facturas_dedupe_folio",
                "trg_proveedor_facturas_folio_unico", "trg_cierre_financiero",
                "trg_cxp_edicion_sensible", "trg_proveedor_facturas_updated",
            },
            "proveedores": {"update_proveedores_updated_at"},
        }
        for table, triggers in required.items():
            for trigger in triggers:
                with self.subTest(table=table, trigger=trigger):
                    self.assertIn((table, trigger), installed)

    def test_fragments_cannot_mint_ids_or_rewrite_immutable_evidence(self):
        for case in CASES:
            with self.subTest(case=case["id"]):
                sql = re.sub(r"--[^\n]*", "", case["mutation_sql"] + case["proof_sql"])
                self.assertNotRegex(sql, r"(?i)\b(?:gen_random_uuid|uuid_generate_v4)\s*\(")
                self.assertNotRegex(sql, r"(?i)\b(?:UPDATE|DELETE FROM|INSERT INTO)\s+demo_")
                self.assertNotRegex(sql, r"(?i)\b(?:GRANT|TRUNCATE|DISABLE|BYPASSRLS)\b")
                self.assertNotRegex(sql, r"(?i)\bsession_replication_role\b|\bCREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\b")
                self.assertNotRegex(sql, r"\b[0-9a-fA-F]{8}(?:-[0-9a-fA-F]{4}){3}-[0-9a-fA-F]{12}\b")


if __name__ == "__main__":
    unittest.main()
