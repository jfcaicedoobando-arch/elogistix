"""Offline source regressions only; no Docker, SQL execution or database."""
import hashlib
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

import catalog


SOURCE = b"""
CREATE TYPE public.app_role AS ENUM ('admin_org');
CREATE FUNCTION public.fixture_org() RETURNS uuid LANGUAGE sql AS $$ SELECT NULL::uuid $$;
CREATE TABLE public.organizations (id uuid, organization_id uuid DEFAULT public.fixture_org());
CREATE TABLE public.organization_members (user_id uuid, organization_id uuid, role public.app_role);
CREATE TABLE public.user_roles (user_id uuid, role public.app_role);
CREATE TABLE public.provisioning_log (organization_id uuid);
CREATE FUNCTION public._log_provisioning_step(p_org uuid) RETURNS void LANGUAGE sql AS $$ INSERT INTO public.provisioning_log(organization_id) VALUES(p_org) $$;
CREATE FUNCTION public.handle_new_organization() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN PERFORM public._log_provisioning_step(NEW.id); RETURN NEW; END; $$;
CREATE FUNCTION public._bloquear_rol_legacy_insert() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RETURN NEW; END; $$;
CREATE FUNCTION public._bloquear_rol_plataforma_om() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RETURN NEW; END; $$;
CREATE FUNCTION public._sync_user_roles_desde_membership() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN INSERT INTO public.user_roles(user_id,role) VALUES(NEW.user_id,NEW.role); RETURN NEW; END; $$;
CREATE TRIGGER trg_handle_new_organization AFTER INSERT ON public.organizations FOR EACH ROW EXECUTE FUNCTION public.handle_new_organization();
CREATE TRIGGER trg_bloquear_rol_legacy_om BEFORE INSERT ON public.organization_members FOR EACH ROW EXECUTE FUNCTION public._bloquear_rol_legacy_insert();
CREATE TRIGGER trg_bloquear_rol_legacy_ur BEFORE INSERT ON public.user_roles FOR EACH ROW EXECUTE FUNCTION public._bloquear_rol_legacy_insert();
CREATE TRIGGER trg_bloquear_rol_plataforma_om BEFORE INSERT ON public.organization_members FOR EACH ROW EXECUTE FUNCTION public._bloquear_rol_plataforma_om();
CREATE TRIGGER trg_sync_user_roles_om_ins AFTER INSERT ON public.organization_members FOR EACH ROW EXECUTE FUNCTION public._sync_user_roles_desde_membership();
CREATE INDEX org_id_idx ON public.organizations USING btree(id);
ALTER TABLE ONLY public.organizations ADD CONSTRAINT org_id_unique UNIQUE(id);
CREATE VIEW public.unselected_view AS SELECT id FROM public.organizations;
"""


DYNAMIC = b"""
CREATE FUNCTION public._assert_padre_misma_org() RETURNS trigger LANGUAGE plpgsql AS $_$
DECLARE v_col text := TG_ARGV[0]; v_padre text := TG_ARGV[1]; v_org uuid; v_id uuid;
BEGIN
 EXECUTE format(
   'SELECT organization_id FROM public.%I WHERE id = $1', v_padre
 ) INTO v_org USING v_id;
 RETURN NEW;
END;
$_$;
CREATE TRIGGER same_org BEFORE INSERT ON public.organization_members FOR EACH ROW EXECUTE FUNCTION public._assert_padre_misma_org('organization_id', 'organizations');
"""


class CatalogSource(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.extractor = catalog.load_extractor()

    def build(self, source=SOURCE):
        return catalog._assemble(source, self.extractor, enforce_pin=False)

    def test_upstream_is_exact_and_never_edited_to_add_write_roots(self):
        self.assertEqual(catalog.sha(catalog.EXTRACTOR.read_bytes()), catalog.EXTRACTOR_SHA256)
        original = self.extractor.ADDITIONAL_WRITE_ROOTS
        self.build()
        self.assertEqual(self.extractor.ADDITIONAL_WRITE_ROOTS, original)
        self.assertNotIn('organizations', original)

    def test_missing_or_changed_extractor_fails_closed(self):
        with tempfile.TemporaryDirectory(dir=Path(__file__).resolve().parent) as directory:
            path = Path(directory) / 'extract_catalog.py'
            with patch.object(catalog, 'EXTRACTOR', path), self.assertRaisesRegex(catalog.CatalogBuildError, 'ABSENT'):
                catalog.load_extractor()
            path.write_bytes(b'# SYNTHETIC changed upstream\n')
            with patch.object(catalog, 'EXTRACTOR', path), self.assertRaisesRegex(catalog.CatalogBuildError, 'BYTES_CHANGED'):
                catalog.load_extractor()

    def test_default_entrypoint_rejects_an_unpinned_baseline_before_emission(self):
        with self.assertRaisesRegex(ValueError, 'baseline integrity mismatch'):
            catalog.build_catalog(SOURCE)

    def test_regression_fixture_insert_triggers_pull_real_provisioning_and_role_dependencies(self):
        before, _ = self.extractor.inventory(SOURCE, enforce_pin=False)
        old = {s['name'] for s in before['objects']}
        self.assertNotIn('trg_handle_new_organization', old)
        self.assertNotIn('provisioning_log', old)
        bundle = self.build()
        names = {s['name'] for s in bundle.manifest['objects']}
        for name in ('trg_handle_new_organization', 'handle_new_organization', '_log_provisioning_step',
                     'provisioning_log', 'trg_bloquear_rol_legacy_om', 'trg_bloquear_rol_legacy_ur',
                     'trg_bloquear_rol_plataforma_om', '_bloquear_rol_legacy_insert',
                     '_bloquear_rol_plataforma_om', 'trg_sync_user_roles_om_ins', '_sync_user_roles_desde_membership'):
            self.assertIn(name, names)
        self.assertEqual(bundle.report['fixture_write_roots'], sorted(catalog.FIXTURE_WRITE_ROOTS))

    def test_original_spans_hashes_and_ordinals_are_preserved_after_install_ordering(self):
        bundle = self.build()
        originals = {i: sql for i, sql in enumerate(self.extractor.split_sql(SOURCE.decode()), 1)}
        reconstructed = []
        for row in bundle.manifest['objects']:
            source = originals[row['source_ordinal']].encode()
            self.assertEqual(catalog.sha(source), row['source_sha256'])
            reconstructed.append(source)
        self.assertTrue(bundle.catalog_sql.endswith(b'\n'.join(reconstructed) + b'\n'))
        self.assertEqual(catalog.sha(bundle.catalog_sql), bundle.manifest['catalog_sha256'])
        self.assertEqual(catalog.sha(bundle.validation_sql), bundle.manifest['validation_sha256'])

    def test_table_defaults_keep_their_function_before_table_and_attachments_move_after_objects(self):
        bundle = self.build()
        ordered = [(s['kind'], s['name']) for s in bundle.manifest['objects']]
        self.assertLess(ordered.index(('type', 'app_role')), ordered.index(('table', 'organization_members')))
        self.assertLess(ordered.index(('function', 'fixture_org')), ordered.index(('table', 'organizations')))
        self.assertLess(ordered.index(('table', 'organizations')), ordered.index(('constraint', 'org_id_unique')))
        self.assertLess(ordered.index(('constraint', 'org_id_unique')), ordered.index(('index', 'org_id_idx')))
        self.assertLess(ordered.index(('function', 'handle_new_organization')), ordered.index(('trigger', 'trg_handle_new_organization')))

    def test_mandatory_second_pass_enables_body_validation_and_preserves_each_raw_body(self):
        bundle = self.build()
        self.assertIn(b'SET check_function_bodies = off;', bundle.catalog_sql)
        self.assertIn(b'SET check_function_bodies = on;', bundle.validation_sql)
        self.assertNotIn(b'check_function_bodies = off', bundle.validation_sql)
        self.assertTrue(bundle.manifest['mandatory_function_validation'])
        validation_statements = self.extractor.split_sql(bundle.validation_sql.decode())[1:]
        rows = bundle.manifest['functions']
        self.assertEqual(len(validation_statements), len(rows))
        for sql, row in zip(validation_statements, rows):
            statement = self.extractor.classify(row['source_ordinal'], sql)
            _, body, language = catalog.function_parts(statement)
            self.assertIn('CREATE OR REPLACE FUNCTION', sql)
            self.assertEqual(catalog.sha(body.encode()), row['body_sha256'])
            self.assertEqual(language, row['language'])

    def test_tagged_body_is_not_confused_with_dollar_text_in_a_quoted_default(self):
        sql = "CREATE FUNCTION public.f(label text DEFAULT 'AS $$ not body') RETURNS text LANGUAGE sql AS $function$ SELECT 'a;b'; $function$;"
        statement = self.extractor.classify(1, sql)
        _, body, language = catalog.function_parts(statement)
        self.assertEqual(body, " SELECT 'a;b'; ")
        self.assertEqual(language, 'sql')
        updated, updated_body, _ = catalog.replacement_statement(statement)
        self.assertEqual(updated_body, body)
        self.assertEqual(updated.decode().replace('CREATE OR REPLACE FUNCTION', 'CREATE FUNCTION', 1), sql)

    def test_unreviewed_language_or_function_trailer_fails_closed(self):
        for sql in ('CREATE FUNCTION public.f() RETURNS int LANGUAGE c AS $$x$$;',
                    'CREATE FUNCTION public.f() RETURNS int LANGUAGE sql AS $$SELECT 1$$ LANGUAGE sql;'):
            with self.subTest(sql=sql), self.assertRaises(catalog.CatalogBuildError):
                catalog.function_parts(self.extractor.classify(1, sql))

    def test_finite_dynamic_identifier_map_is_reviewed_without_marking_global_complete(self):
        bundle = self.build(SOURCE + DYNAMIC)
        rows = bundle.report['dynamic_argument_review']
        self.assertEqual(len(rows), 1)
        self.assertEqual((rows[0]['child_table'], rows[0]['column_argument'], rows[0]['parent_table_argument']),
                         ('organization_members', 'organization_id', 'organizations'))
        self.assertEqual(rows[0]['identifier_interpolation'], 'format %I')
        self.assertFalse(bundle.manifest['complete'])
        self.assertFalse(bundle.report['complete'])
        self.assertTrue(bundle.report['source_closure_reviewed'])
        dynamic_gate = next(g for g in bundle.report['gates'] if g['gate'] == 'dynamic_sql_review')
        self.assertEqual(dynamic_gate['status'], 'BLOCKED')

    def test_dynamic_argument_or_helper_shape_drift_is_a_hold(self):
        for changed in (DYNAMIC.replace(b"'organizations'", b"'unknown_parent'"),
                        DYNAMIC.replace(b"'organization_id', 'organizations'", b"current_setting('SYNTHETIC'), 'organizations'"),
                        DYNAMIC.replace(b'public.%I', b'public.%s')):
            with self.subTest(changed=changed), self.assertRaises(catalog.CatalogBuildError):
                self.build(SOURCE + changed)

    def test_new_dynamic_function_or_historical_seed_is_not_silently_admitted(self):
        dynamic = SOURCE + b"""
CREATE FUNCTION public.new_dynamic() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN EXECUTE format('SELECT 1'); RETURN NEW; END; $$;
CREATE TRIGGER new_dynamic_trigger BEFORE INSERT ON public.organizations FOR EACH ROW EXECUTE FUNCTION public.new_dynamic();
"""
        with self.assertRaisesRegex(catalog.CatalogBuildError, 'UNREVIEWED_DYNAMIC_SQL'):
            self.build(dynamic)
        historic = SOURCE + b"""
CREATE FUNCTION public.seed_demo_organization_core() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RETURN NEW; END; $$;
CREATE TRIGGER unsafe_seed AFTER INSERT ON public.organizations FOR EACH ROW EXECUTE FUNCTION public.seed_demo_organization_core();
"""
        with self.assertRaisesRegex(catalog.CatalogBuildError, 'HISTORICAL_SEED'):
            self.build(historic)

    def test_output_is_fresh_and_compile_only_with_no_runtime_promotion(self):
        bundle = self.build()
        with tempfile.TemporaryDirectory(dir=Path(__file__).resolve().parent) as directory:
            output = Path(directory) / 'output'
            catalog.write_bundle(bundle, output)
            self.assertEqual({p.name for p in output.iterdir()},
                             {'catalog.sql', 'validate-functions.sql', 'catalog-manifest.json', 'dependency-report.json'})
            self.assertEqual((output / 'catalog.sql').read_bytes(), bundle.catalog_sql)
            self.assertEqual((output / 'validate-functions.sql').read_bytes(), bundle.validation_sql)
            self.assertFalse(json.loads((output / 'catalog-manifest.json').read_text())['complete'])
            with self.assertRaisesRegex(catalog.CatalogBuildError, 'FRESH_OUTPUT'):
                catalog.write_bundle(bundle, output)
        self.assertEqual(bundle.manifest['runtime'], 'NOT_RUN')
        self.assertFalse(bundle.report['compile_recovery']['accepted_business_behavior'])


if __name__ == '__main__':
    unittest.main()
