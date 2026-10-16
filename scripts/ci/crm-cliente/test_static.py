"""Offline source contracts; runtime races are only claimed by run-actions.py."""
import importlib.util
from pathlib import Path
import re
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

if __name__=='__main__':
    unittest.main()

