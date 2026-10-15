"""Offline regression checks for source extraction, not financial acceptance."""
import hashlib
import unittest

from extract_catalog import CatalogError, classify, git_blob, inventory, split_sql


class LexicalBoundaries(unittest.TestCase):
    def test_function_body_and_string_semicolons_are_preserved(self):
        source = "CREATE FUNCTION public.f() RETURNS text AS $tag$ BEGIN RETURN 'a;b'; END; $tag$ LANGUAGE plpgsql;\nSELECT 'c;d';"
        statements = split_sql(source)
        self.assertEqual(len(statements), 2)
        self.assertEqual("".join(statements), source)

    def test_nested_comments_and_escaped_strings(self):
        source = "/* a; /* nested; */ x */ SELECT E'a\\\';b';-- tail;\nSELECT 'a'';b';"
        self.assertEqual(len(split_sql(source)), 2)
        source_with_trailing_comment = "SELECT 1; /* completed; */ -- trailing;"
        self.assertEqual(split_sql(source_with_trailing_comment), [source_with_trailing_comment])

    def test_unclosed_constructs_and_psql_are_rejected(self):
        for source in ("SELECT 'oops;", "SELECT $x$oops;", "/* open;", 'SELECT "oops;', "SELECT 1", "\\i unsafe.sql\n"):
            with self.subTest(source=source), self.assertRaises(CatalogError):
                split_sql(source)

    def test_git_blob_includes_git_header(self):
        data = b"abc\n"
        self.assertEqual(git_blob(data), hashlib.sha1(b"blob 4\0abc\n").hexdigest())

    def test_pin_rejects_even_valid_sql_with_wrong_bytes(self):
        with self.assertRaisesRegex(CatalogError, "integrity mismatch"):
            inventory(b"SELECT 1;")


class ClosureInventory(unittest.TestCase):
    SOURCE = b"""
CREATE TYPE public.moneda AS ENUM ('MXN');
CREATE TABLE public.proveedor_facturas (id uuid, moneda public.moneda);
CREATE TABLE public.support (id uuid);
CREATE TABLE public.effects (id uuid);
CREATE TABLE public.audit (id uuid);
CREATE FUNCTION public.first_guard() RETURNS trigger AS $$
BEGIN
 PERFORM public.secondary();
 INSERT INTO public.effects(id) VALUES (NEW.id);
 RETURN NEW;
END $$ LANGUAGE plpgsql;
CREATE FUNCTION public.secondary() RETURNS void AS $$ BEGIN PERFORM 1 FROM public.support; END $$ LANGUAGE plpgsql;
CREATE FUNCTION public.effect_guard() RETURNS trigger AS $$ BEGIN INSERT INTO public.audit(id) VALUES (NEW.id); RETURN NEW; END $$ LANGUAGE plpgsql;
CREATE FUNCTION public.unused_seed() RETURNS trigger AS $$ BEGIN RAISE EXCEPTION 'do not call'; END $$ LANGUAGE plpgsql;
CREATE TRIGGER root_guard BEFORE INSERT ON public.proveedor_facturas FOR EACH ROW EXECUTE FUNCTION public.first_guard();
CREATE TRIGGER child_guard AFTER INSERT ON public.effects FOR EACH ROW EXECUTE FUNCTION public.effect_guard();
CREATE TRIGGER not_a_write_target AFTER INSERT ON public.support FOR EACH ROW EXECUTE FUNCTION public.unused_seed();
ALTER TABLE ONLY public.proveedor_facturas ADD CONSTRAINT support_fk FOREIGN KEY (id) REFERENCES public.support(id);
CREATE UNIQUE INDEX factura_unique ON public.proveedor_facturas USING btree (id);
"""

    def test_transitive_mutations_pull_their_real_triggers(self):
        report, statements = inventory(self.SOURCE, enforce_pin=False)
        names = {s.name for s in statements}
        self.assertIn("secondary", names)
        self.assertIn("effect_guard", names)
        self.assertIn("child_guard", names)
        self.assertIn("support_fk", names)
        self.assertIn("factura_unique", names)
        self.assertIn("moneda", names)
        self.assertNotIn("unused_seed", names)
        self.assertNotIn("not_a_write_target", names)
        self.assertIn("audit", report["write_tables_requiring_triggers"])
        self.assertIn("support", report["support_tables_without_insert_trigger_certification"])
        self.assertFalse(report["complete"])
        dynamic = next(g for g in report["gates"] if g["gate"] == "dynamic_sql_review")
        self.assertEqual(dynamic["items"], [])  # EXECUTE FUNCTION in CREATE TRIGGER is static.

    def test_dynamic_sql_and_external_auth_are_blockers(self):
        source = self.SOURCE + b"""
CREATE FUNCTION public._cxp_validar_aprobacion() RETURNS void AS $$
BEGIN EXECUTE format('SELECT 1 FROM public.%I', 'effects'); PERFORM auth.uid(); END $$ LANGUAGE plpgsql;
"""
        report, _ = inventory(source, enforce_pin=False)
        gates = {gate["gate"]: gate for gate in report["gates"]}
        self.assertEqual(gates["dynamic_sql_review"]["status"], "BLOCKED")
        self.assertEqual(gates["external_dependency_fixture_review"]["items"], ["auth.uid"])
        self.assertFalse(report["complete"])

    def test_source_spans_keep_original_function_bytes(self):
        _, statements = inventory(self.SOURCE, enforce_pin=False)
        for s in statements:
            self.assertIn(s.sql.encode(), self.SOURCE)

    def test_classifier_handles_quoted_identifiers(self):
        statement = classify(1, 'CREATE TABLE "public"."proveedor_facturas" (id uuid);')
        self.assertEqual((statement.kind, statement.name), ("table", "proveedor_facturas"))


if __name__ == "__main__":
    unittest.main()
