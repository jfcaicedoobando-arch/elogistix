"""Offline source/mutation regressions; no PostgreSQL, network or subprocess.

These checks protect fixture scope and the genuine producer invocation. They do
not execute SQL, validate authentication, or accept financial behavior. The runner
separately pins canonical bytes and records its authorized three-label lab variant.
"""
import json
from pathlib import Path
import re
import unittest
import uuid


HERE = Path(__file__).resolve().parent
REPO = HERE.parents[2]
FIXTURE = (HERE / 'sql/fixture.sql').read_text(encoding='utf-8')
PREPARE = (HERE / 'sql/prepare-context.sql').read_text(encoding='utf-8')
UPSTREAM = HERE.parent / 'demo-financial-compile-recovery/upstream'
BASELINE = (REPO / 'supabase/schema/baseline.sql').read_text(encoding='utf-8')


def code(text):
    return re.sub(r'--[^\n]*', '', text)


def compact(text):
    return ' '.join(code(text).split()).lower()


def require(ok, message):
    if not ok:
        raise ValueError(message)


def targets(text):
    return re.findall(r'\bINSERT\s+INTO\s+([a-z_][a-z_0-9]*\.[a-z_][a-z_0-9]*)', code(text), re.I)


def shared_contract(text):
    source, folded = code(text), compact(text)
    for guard in ["current_database()<>'demo_financial_compile_recovery_lab'",
                  "current_user<>'postgres'", "session_user<>'postgres'",
                  "current_setting('server_version_num')<>'170006'",
                  "current_setting('listen_addresses')<>''", 'inet_server_addr() is not null',
                  "current_setting('transaction_isolation')<>'read committed'",
                  'not rolsuper', 'rolbypassrls and not rolinherit and not rolcreatedb',
                  'not rolcreaterole and not rolreplication',
                  "pg_has_role(current_user,'supabase_admin','member')",
                  "rolname='service_role' and not rolcanlogin", 'not rolbypassrls']:
        require(guard in folded, 'candidate boundary')
    require(text.startswith('\\set ON_ERROR_STOP on\n'), 'psql fail closed')
    require(re.search(r'\bBEGIN\s*;', source) and re.search(r'\bCOMMIT\s*;', source), 'atomic preparation')
    require(not re.search(r'\b(?:GRANT|REVOKE|TRUNCATE|DELETE|COPY)\b|DISABLE\s+TRIGGER|session_replication_role', source, re.I),
            'scope/trigger bypass')
    require(not re.search(r'\b(?:CREATE|ALTER|DROP)\s+(?:ROLE|DATABASE|SCHEMA|FUNCTION|TRIGGER|POLICY)\b', source, re.I),
            'authority/canonical DDL')
    require(not re.search(r'\bCREATE\s+(?!TEMP\s+TABLE\b)', source, re.I), 'only TEMP DDL')
    require('SYNTHETIC' in text, 'fixture scope label')
    return folded


def mapping(text):
    rows = re.findall(r"\('(aap-vencida|ttn-vigente|ofc-parcial)','(cliente\.[a-z]+)',"
                      r"'([0-9a-f-]+)','([0-9a-f-]+)','([^']+)'\)", code(text))
    require(len(rows) == 3, 'three explicit UUID mappings')
    result = {row[0]: row[1:] for row in rows}
    require(set(result) == {'aap-vencida', 'ttn-vigente', 'ofc-parcial'}, 'fixture set')
    require({row[1] for row in rows} == {'cliente.pacifico', 'cliente.monterrey', 'cliente.bajio'}, 'client keys')
    ids = [uuid.UUID(value) for row in rows for value in row[2:4]]
    require(len(set(ids)) == 6 and all(value.version == 4 for value in ids), 'unique explicit IDs')
    return result


def fixture_contract(text):
    folded = shared_contract(text)
    allowed = {'pg_temp.financial_fixture_ids', 'public.organizations', 'auth.users',
               'public.organization_members', 'financial_compile_fixture.auth_context',
               'public.presupuesto_categorias', 'public.configuracion', 'public.proveedores',
               'public.embarques', 'pg_temp.financial_manual_sentinels', 'demo_flow_writer.control'}
    require(set(targets(text)) == allowed, 'fixture DML inventory')
    require(re.findall(r'\bUPDATE\s+([a-z_]+\.[a-z_]+)\s+SET\b', code(text), re.I)
            == ['financial_compile_fixture.auth_context'], 'fixture UPDATE inventory')
    require(re.findall(r'CREATE\s+TEMP\s+TABLE\s+([a-z_]+)', code(text), re.I)
            == ['financial_fixture_ids', 'financial_client_bindings', 'financial_manual_sentinels'], 'TEMP handshake')
    require('demo_fixture_identity.ensure(k.fixture_key)' in folded, 'authentic identity helper')
    require('join pg_temp.financial_client_bindings c on c.fixture_key=x.fixture_key' in folded,
            'explicit client UUID join')
    require(not re.search(r'\bJOIN\b[^;]*(?:\.nombre\s*=|\.expediente\s*=)', code(text), re.I),
            'no editable-label adoption')
    require("'admin_org'" in folded and not re.search(r"'admin'|'super_admin'|'viewer'|'operador'", code(text)),
            'nonlegacy sponsor')
    require('canonical_membership_mirror_required' in folded, 'canonical role mirror assertion')
    require('id,organization_id,nombre,rfc,categoria,tipo,dias_credito,estado_alta' in folded
            and "'logistico','transportista'" in folded, 'supplier discriminators')
    require("'terrestre','nacional','confirmado',20,22" in folded, 'shipment required fields')
    require("'sin categor\u00eda','costodirectoembarque'" in folded, 'real category')
    require("'contabilidad','cierre_periodo_fecha','null'::jsonb" in folded, 'explicit open-period row')
    require("select 'public','proveedores',p.id,p.organization_id,to_jsonb(p)" in folded,
            'full-row sentinel preimages')
    require("subject_user_id=null,role_name='service_role'" in folded
            and 'auth.uid() is not null' in folded, 'sponsor not current RPC human')
    require("'fixture':'synthetic'" not in folded and '"fixture":"synthetic"' in folded, 'labelled auth fixture')
    require(text.count("SELECT 'FINANCIAL_BEHAVIOR_SYNTHETIC_FIXTURE_COMPLETE';") == 1, 'completion marker')
    return mapping(text)


def prepare_contract(text):
    folded = shared_contract(text)
    require(set(targets(text)) == {'demo_flow_writer.transport_approvals', 'demo_flow_writer.scheduler_approvals',
                                 'demo_fixture_identity.preparation_admissions', 'demo_fixture_identity.preparation_bindings'},
            'preparation DML inventory')
    require(not re.search(r'\bUPDATE\s+[a-z_]+\.[a-z_]+\s+SET\b', code(text), re.I), 'preparation UPDATE inventory')
    require(re.findall(r'CREATE\s+TEMP\s+TABLE\s+([a-z_]+)', code(text), re.I)
            == ['identity_producer_input', 'financial_context'], 'TEMP context contract')
    for actual in ['to_jsonb(category) category_snapshot', "'supplier_snapshot',to_jsonb(p)",
                   "'shipment_snapshot',to_jsonb(e)", 'join public.proveedores p on p.id=x.supplier_id',
                   'join public.embarques e on e.id=x.shipment_id', 'to_jsonb(p),to_jsonb(t)',
                   'jsonb_to_recordset(i.bindings)', 'owner_reviewed_existing_fixture_ids']:
        require(actual in folded, 'actual row/policy preimage')
    require(len(re.findall(r'\bdemo_fixture_identity\.prepare_identity_receipt\s*\(', code(text))) == 1,
            'authentic producer call')
    require(len(re.findall(r'\bdemo_flow_writer\.issue_scheduler_context\s*\(', code(text))) == 1
            and 'demo_fixture_identity.prepare_identity_receipt(i.admission_id),120) context_id' in folded,
            'authentic issuer consumes real receipt')
    require('perform demo_fixture_identity.verify_preparation_origin(receipt)' in folded, 'independent origin revalidation')
    for empty in ['runs', 'lineages', 'authorization_receipts', 'seed_checkpoints']:
        require('exists(select 1 from demo_flow_writer.' + empty + ')' in folded, 'no manual materialization')
    require(text.count("SELECT 'FINANCIAL_BEHAVIOR_AUTHENTIC_CONTEXT_PREPARED_SYNTHETIC';") == 1,
            'preparation completion marker')


class FixtureSource(unittest.TestCase):
    def test_current_fixture_and_preparation_contracts(self):
        fixture_contract(FIXTURE)
        prepare_contract(PREPARE)

    def test_explicit_ids_do_not_overlap_manual_sentinels_or_tenants(self):
        rows = mapping(FIXTURE)
        admitted = {uuid.UUID(value) for values in rows.values() for value in values[1:3]}
        manual = {uuid.UUID('10000000-0000-4000-8000-000000000101'),
                  uuid.UUID('10000000-0000-4000-8000-000000000102')}
        self.assertFalse(admitted & manual)
        self.assertIn("'00000000-0000-4000-8000-000000000001'", FIXTURE)
        self.assertIn("'00000000-0000-4000-8000-000000000002'", FIXTURE)

    def test_fixture_values_are_real_canonical_enums_and_supplier_shape(self):
        for name, value in [('modo_transporte', 'Terrestre'), ('tipo_operacion', 'Nacional'),
                            ('estado_embarque', 'Confirmado'), ('categoria_proveedor', 'Logistico'),
                            ('tipo_proveedor', 'Transportista'), ('tipo_contable_categoria', 'CostoDirectoEmbarque')]:
            body = re.search(r'CREATE TYPE public\.' + name + r' AS ENUM \((.*?)\);', BASELINE, re.S)
            self.assertIsNotNone(body)
            self.assertIn("'" + value + "'", body[1])
        self.assertIn("categoria = 'Logistico'::public.categoria_proveedor) AND (tipo IS NOT NULL)", BASELINE)
        self.assertIn('cliente_id uuid NOT NULL', BASELINE)

    def test_regression_authorized_lab_labels_respect_real_check_and_preserve_original_source(self):
        manifest_sql = (UPSTREAM / 'flow/sql/02-manifest.sql').read_text(encoding='utf-8')
        manifest = json.loads(re.search(r'\$manifest\$(.*?)\$manifest\$', manifest_sql, re.S)[1])
        constraint = re.search(r'ADD CONSTRAINT embarques_expediente_formato_valido.*?;', BASELINE, re.S)[0]
        patterns = re.findall(r"expediente ~ '([^']+)'", constraint)
        self.assertEqual(len(patterns), 2)
        rows = mapping(FIXTURE)
        expected = {'aap-vencida': ('SYNTHETIC-SHIPMENT-1', 'DEMO-2026-1'),
                    'ttn-vigente': ('SYNTHETIC-SHIPMENT-2', 'DEMO-2026-2'),
                    'ofc-parcial': ('SYNTHETIC-SHIPMENT-3', 'DEMO-2026-3')}
        for spec in manifest['fixtures']:
            self.assertEqual(spec['shipmentExpediente'], expected[spec['id']][0])
            self.assertFalse(any(re.search(p, spec['shipmentExpediente']) for p in patterns))
            actual = rows[spec['id']][-1]
            self.assertEqual(actual, expected[spec['id']][1])
            self.assertTrue(any(re.search(p, actual) for p in patterns))
            self.assertNotEqual(actual, spec['shipmentExpediente'])
        engine = (UPSTREAM / 'flow/sql/04-engine.sql').read_text(encoding='utf-8')
        self.assertIn("v_shipment.expediente IS DISTINCT FROM v_spec->>'shipmentExpediente'", engine)
        self.assertIn('AUTHORIZED LAB MANIFEST VARIANT', FIXTURE)
        self.assertIn('records before/after hashes', FIXTURE)
        self.assertNotIn('CREATE OR REPLACE', code(FIXTURE + PREPARE))

    def test_real_organization_and_membership_triggers_are_source_prerequisites(self):
        for source in ['CREATE TRIGGER trg_handle_new_organization AFTER INSERT ON public.organizations',
                       'CREATE TRIGGER trg_sync_user_roles_om_ins AFTER INSERT ON public.organization_members',
                       'EXECUTE FUNCTION public.handle_new_organization()',
                       'EXECUTE FUNCTION public._sync_user_roles_desde_membership()']:
            self.assertIn(source, BASELINE)
        self.assertNotIn('public.user_roles', targets(FIXTURE))
        self.assertLess(FIXTURE.index('INSERT INTO public.organizations'), FIXTURE.index('INSERT INTO public.organization_members'))

    def test_registry_source_receives_owner_reviewed_inputs_not_manual_receipts(self):
        producer = (UPSTREAM / 'authentic/producer.sql').read_text(encoding='utf-8')
        registry = (UPSTREAM / 'flow/issuer/16-owner-registry.sql').read_text(encoding='utf-8')
        self.assertIn('CREATE FUNCTION demo_fixture_identity.prepare_identity_receipt(p_admission uuid)', producer)
        self.assertIn('CREATE FUNCTION demo_flow_writer.issue_scheduler_context(', registry)
        self.assertIn("a.manifest_sha256 IS DISTINCT FROM demo_flow_writer.manifest_sha256()", registry)
        self.assertIn("clock_timestamp()+interval '30 minutes'", PREPARE)
        self.assertIn("clock_timestamp()+interval '20 minutes' valid_until", PREPARE)

    def test_mutation_missing_guard_and_trigger_bypass_are_rejected(self):
        for source in [FIXTURE.replace("OR current_user<>'postgres'", ''),
                       FIXTURE + '\nALTER TABLE public.embarques DISABLE TRIGGER ALL;\n',
                       FIXTURE + '\nSET session_replication_role=replica;\n']:
            with self.assertRaises(ValueError):
                fixture_contract(source)

    def test_mutation_manual_authority_or_financial_provenance_is_rejected(self):
        for table in ['public.user_roles', 'demo_fixture_identity.registry',
                      'demo_fixture_identity.prepared_receipts', 'demo_fixture_identity.preparation_runs',
                      'demo_flow_writer.runs', 'demo_flow_writer.lineages', 'demo_flow_writer.authorization_receipts',
                      'demo_flow_writer.seed_checkpoints', 'public.proveedor_facturas']:
            with self.subTest(table=table), self.assertRaisesRegex(ValueError, 'DML inventory'):
                fixture_contract(FIXTURE + '\nINSERT INTO ' + table + ' VALUES(NULL);\n')
            with self.subTest(prepare=table), self.assertRaisesRegex(ValueError, 'DML inventory'):
                prepare_contract(PREPARE + '\nINSERT INTO ' + table + ' VALUES(NULL);\n')

    def test_mutation_duplicate_or_label_inferred_mapping_is_rejected(self):
        duplicate = FIXTURE.replace('30000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000001')
        with self.assertRaisesRegex(ValueError, 'unique explicit IDs'):
            fixture_contract(duplicate)
        with self.assertRaisesRegex(ValueError, 'explicit client UUID join'):
            fixture_contract(FIXTURE.replace('c.fixture_key=x.fixture_key', 'c.nombre=x.nombre'))

    def test_mutation_updates_to_canonical_or_provenance_rows_are_rejected(self):
        for table in ['public.proveedores', 'demo_fixture_identity.prepared_receipts',
                      'demo_flow_writer.transport_approvals', 'demo_flow_writer.server_admissions']:
            with self.subTest(table=table), self.assertRaisesRegex(ValueError, 'UPDATE inventory'):
                fixture_contract(FIXTURE + '\nUPDATE ' + table + ' SET id=NULL;\n')
            with self.subTest(prepare=table), self.assertRaisesRegex(ValueError, 'UPDATE inventory'):
                prepare_contract(PREPARE + '\nUPDATE ' + table + ' SET id=NULL;\n')

    def test_mutation_legacy_role_or_incomplete_required_columns_is_rejected(self):
        for old, new in [("'admin_org'", "'admin'"), ("'Logistico','Transportista'", "'Logistico',NULL"),
                         ("'Terrestre','Nacional','Confirmado',20,22", "NULL,'Nacional','Confirmado',20,22")]:
            with self.subTest(new=new), self.assertRaises(ValueError):
                fixture_contract(FIXTURE.replace(old, new))

    def test_mutation_partial_or_fabricated_snapshots_are_rejected(self):
        with self.assertRaisesRegex(ValueError, 'full-row sentinel preimages'):
            fixture_contract(FIXTURE.replace('to_jsonb(p)', "jsonb_build_object('id',p.id)"))
        for actual in ['to_jsonb(category)', 'to_jsonb(p)', 'to_jsonb(e)']:
            with self.subTest(actual=actual), self.assertRaisesRegex(ValueError, 'actual row/policy preimage'):
                prepare_contract(PREPARE.replace(actual, "'{}'::jsonb"))

    def test_mutation_synthetic_receipt_shortcut_is_rejected(self):
        with self.assertRaisesRegex(ValueError, 'authentic producer call'):
            prepare_contract(PREPARE.replace('demo_fixture_identity.prepare_identity_receipt(i.admission_id)',
                                             "'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid"))
        with self.assertRaisesRegex(ValueError, 'authentic issuer consumes real receipt'):
            prepare_contract(PREPARE.replace('demo_flow_writer.issue_scheduler_context', 'pg_catalog.gen_random_uuid'))

    def test_mutation_sponsor_as_current_authenticated_rpc_human_is_rejected(self):
        with self.assertRaisesRegex(ValueError, 'sponsor not current RPC human'):
            fixture_contract(FIXTURE.replace("subject_user_id=NULL,role_name='service_role'",
                                             "subject_user_id='40000000-0000-4000-8000-000000000001',role_name='service_role'"))


if __name__ == '__main__':
    unittest.main()
