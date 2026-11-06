"""Offline source contracts; runtime races are only claimed by run-actions.py."""
import importlib.util
from pathlib import Path
import re
import json
import tempfile
from unittest.mock import patch
import unittest
ROOT=Path(__file__).resolve().parents[3]
HERE=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('crm_cliente_adapter',HERE/'run-actions.py')
adapter=importlib.util.module_from_spec(spec)
spec.loader.exec_module(adapter)

class Contracts(unittest.TestCase):
    def test_whole_forward_and_canonical_mirrors(self):
        adapter.verify_sources()
    def test_independent_trigger_has_no_name_inference_or_existing_row_update(self):
        sql=(ROOT/'supabase/schema/crm/crm_empresa_desde_cliente.sql').read_text(encoding='utf-8')
        self.assertNotIn('LIMIT 1',sql)
        self.assertNotIn('UPDATE public.crm_empresas',sql)
        self.assertNotIn('btrim',sql)
        self.assertIn('organization_id = NEW.organization_id',sql)
    def test_identity_lock_precedes_customer_insert_and_legacy_rpc_stays_retired(self):
        sql=(ROOT/'supabase/schema/crm/convertir_prospecto_a_cliente_rpc.sql').read_text(encoding='utf-8')
        self.assertLess(sql.index('_crm_empresa_para_conversion('),sql.index('FOR UPDATE'))
        self.assertLess(sql.index('UPDATE public.crm_empresas SET cliente_id'),sql.index('INSERT INTO public.clientes'))
        self.assertIn('cliente_id IS NULL',sql)
        self.assertIn('IF v_empresa IS NOT NULL AND NOT v_creado',sql)
        self.assertNotIn('convertir_lead_rpc(',adapter.verify_sources())
    def test_guards_cover_new_old_and_later_clear_or_reclassification(self):
        sql=(ROOT/'supabase/schema/crm/crm_empresa_no_borrar_cliente.sql').read_text(encoding='utf-8')
        for fragment in ('NEW.cliente_id IS NOT NULL','NEW.estado_crm', 'OLD.cliente_id',
                         'NEW.cliente_id IS DISTINCT FROM OLD.cliente_id',
                         'BEFORE INSERT OR UPDATE OF deleted_at, cliente_id, estado_crm'):
            self.assertIn(fragment,sql)
    def test_reuses_strict_adapter_and_runtime_lock_barriers(self):
        sql=(HERE/'cases.py').read_text(encoding='utf-8')
        for fragment in ('h.wait_blocked(b,a)', 'h.wait_blocked(conv,kam)',
                         'h.wait_blocked(kam,conv)',"ok(call(b,'create'",'before[\'companies\']'):
            self.assertIn(fragment,sql)
        self.assertIn('original_verify()', (HERE/'run-actions.py').read_text(encoding='utf-8'))
    def test_full_identity_equality_and_claim_serialization(self):
        sql=(ROOT/'supabase/schema/crm/convertir_prospecto_a_cliente_rpc.sql').read_text(encoding='utf-8')
        self.assertEqual(sql.count('v_empresa_ids IS DISTINCT FROM v_empresa_esperada'),2)
        helper=(ROOT/'supabase/schema/crm/_crm_empresa_para_conversion.sql').read_text(encoding='utf-8')
        self.assertIn('v_emp.lead_origen_id IS DISTINCT FROM p_lead',helper)
        self.assertIn('ORDER BY empresa_id FOR SHARE',helper)
        guard=(ROOT/'supabase/schema/crm/_crm_empresa_validar_lead.sql').read_text(encoding='utf-8')
        self.assertIn('WHERE id = NEW.lead_origen_id FOR UPDATE',guard)
        self.assertIn('BEFORE INSERT OR UPDATE OF lead_origen_id, organization_id',guard)

class StageContracts(unittest.TestCase):
    def test_final_source_is_complete_and_independently_pinned(self):
        catalog=adapter.module('crm_final_contract_test', HERE/'current-catalog.py')
        expected=catalog.expected_catalog()
        self.assertEqual(len(expected),8)
        self.assertIn("v_estado NOT IN ('Borrador', 'Aceptada')",expected['convertir_prospecto_a_cliente_rpc(uuid,jsonb)']['body'])
        self.assertIn('LC_COT_PROSPECTO_SOLO_BORRADOR',expected['_cotizaciones_validar_prospecto()']['body'])
    def test_final_identity_metadata_rejects_each_drift(self):
        catalog=adapter.module('crm_final_metadata_test', HERE/'current-catalog.py')
        for signature,contract in catalog.expected_catalog().items():
            row=dict(body=contract['body'],owner='postgres',definer=contract['definer'],
                     config=['search_path=public'],language='plpgsql',returns=contract['returns'],acl=contract['acl'])
            catalog.verify_row(signature,row,contract)
            for key,value in dict(body='changed',owner='other',definer=not contract['definer'],
                                  config=[],language='sql',returns='text',acl=['=X/postgres']).items():
                with self.subTest(signature=signature,field=key),self.assertRaises(RuntimeError):
                    catalog.verify_row(signature,{**row,key:value},contract)
    def test_current_runner_has_no_historical_replay_or_skip_flag(self):
        text=(HERE/'run-final-actions.py').read_text()
        self.assertNotIn('query(name, migration',text)
        self.assertNotIn('whole_migration_replay',text)
        self.assertNotIn('skip_replay',text)
        for fragment in ("quote_stage='Borrador'", 'Final catalog verification changed catalog',
                         'Final clone catalog/security changed during cases', 'm.owned_clone_present',
                         'for iteration in (1, 2)', "'stage': 'final-0034-verify-only'"):
            self.assertIn(fragment,text)
        self.assertIn('query(name, migration', (HERE.parent/'crm-prospecto-kam/run-actions.py').read_text())
    def test_historical_checkpoint_is_fail_closed_before_first_evolved_history(self):
        script=(ROOT/'scripts/ci/rls-prepare-db.sh').read_text()
        self.assertIn('scripts/ci/drizzle-history/0026_comisiones_recalcular_al_asignar_vendedora.sql',script)
        self.assertIn('python3 scripts/ci/crm-cliente/run-actions.py || exit 1',script)
        self.assertIn('python3 scripts/ci/crm-cliente/verify-evidence.py historical || exit 1',script)
        self.assertIn('Missing CRM identity historical checkpoint',script)
        self.assertLess(script.index('python3 scripts/ci/crm-cliente/run-actions.py'),script.index('echo "▶ Isolated Drizzle history: $f"'))
        workflow=(ROOT/'.github/workflows/rls-tests.yml').read_text()
        self.assertIn("CRM_IDENTITY_CI: '1'",workflow)
        self.assertIn('python3 scripts/ci/crm-cliente/run-final-actions.py',workflow)
        self.assertIn('python3 scripts/ci/crm-cliente/verify-evidence.py both',workflow)

class EvidenceContracts(unittest.TestCase):
    def test_requires_both_exact_stages_and_all_cases(self):
        verifier=adapter.module('crm_identity_evidence_test', HERE/'verify-evidence.py')
        with tempfile.TemporaryDirectory() as directory:
            root=Path(directory)
            with patch.object(verifier,'ROOT',root):
                for stage,folder,key in [('historical','crm-cliente-concurrency','whole_migration_replay'),
                                         ('final','crm-cliente-final-concurrency','current_catalog_verification')]:
                    base=root/'reports'/folder
                    runs=[]
                    for i in (1,2):
                        run=base/f'run-{i}';run.mkdir(parents=True)
                        (run/'result.json').write_text(json.dumps(dict(source_commit='sha',status='pass',both_committed=True,cases=verifier.EXPECTED_CASES)))
                        runs.append(dict(iteration=i,database=f'clone-{i}',created=True,dropped=True,status='pass',**{key:'pass'}))
                    record=dict(source_commit='sha',status='pass',source_preserved=True,runtime_tested=True,clone_runs=runs,stage='final-0034-verify-only')
                    path=base/'actions-result.json';path.write_text(json.dumps(record))
                    verifier.verify(stage,'sha')
                    with self.assertRaises(AssertionError): verifier.verify(stage,'other-sha')
                    runs[0]['dropped']=False;path.write_text(json.dumps(record))
                    with self.assertRaises(AssertionError): verifier.verify(stage,'sha')
                    runs[0]['dropped']=True;path.write_text(json.dumps(record))
                    result=base/'run-1/result.json';value=json.loads(result.read_text());value['cases']=value['cases'][:-1];result.write_text(json.dumps(value))
                    with self.assertRaises(AssertionError): verifier.verify(stage,'sha')

if __name__=='__main__':
    unittest.main()

