"""No database: test assertion sensitivity and CLI refusal, not race execution."""
import copy
import importlib.util
import json
from pathlib import Path
import subprocess
import sys
import unittest
from types import SimpleNamespace
from unittest.mock import patch

HERE=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('cxp_concurrency',HERE/'concurrency.py')
m=importlib.util.module_from_spec(spec)
sys.modules[spec.name]=m
spec.loader.exec_module(m)

class Assertions(unittest.TestCase):
    def setUp(self):
        self.f={'invoice':'inv','other_invoice':'other','org':'org','other_org':'other_org'}
        self.row={'id':'inv','organization_id':'org','created_by':'a','aprobada_por':'a','aprobada_at':'2026-10-13T00:00:00.123456+00:00',
                  'estado_aprobacion':'aprobada','moneda':'MXN','tipo_cambio_usd':1,'subtotal':100,'total':100}
        other={'id':'other','organization_id':'other_org'}
        self.before={'invoices':[dict(self.row,aprobada_por=None,aprobada_at=None,estado_aprobacion='pendiente'),other],
                     'concepts':[{'id':'c','monto':100}], 'payments':[], 'memberships':[{'id':'m'}], 'roles':[{'id':'r'}], 'users':[{'id':'a'}], 'audit':[]}
        self.after=copy.deepcopy(self.before)
        self.after['invoices'][0]=copy.deepcopy(self.row)
        self.event={'entidad_id':'inv','accion':'aprobar_factura_proveedor','fuente_evento':'rpc_aprobar_factura_proveedor',
                    'usuario_id':'a','usuario_email':'a@test.invalid','organization_id':'org','modulo':'cxp',
                    'detalles':{'aprobada':True,'total':100,'moneda':'MXN','tipo_cambio_usd':1,
                                'motivo':m.JUSTIFICATION,'justificacion_sin_vinculo':m.JUSTIFICATION}}
        self.after['audit']=[self.event]
    def verify(self):
        m.verify_final(self.before,self.after,self.f,'a',self.row)
    def test_valid_final(self):
        self.verify()
    def test_missing_audit(self):
        self.after['audit']=[]
        with self.assertRaises(RuntimeError): self.verify()
    def test_second_actor_audit_is_not_hidden(self):
        self.after['audit'].append(dict(self.event,usuario_id='b'))
        with self.assertRaises(RuntimeError): self.verify()
    def test_rejection_event_is_not_hidden(self):
        self.after['audit'].append(dict(self.event,accion='rechazar_factura_proveedor'))
        with self.assertRaises(RuntimeError): self.verify()
    def test_wrong_email(self):
        self.event['usuario_email']=''
        with self.assertRaises(RuntimeError): self.verify()
    def test_wrong_winner(self):
        self.event['usuario_id']='b'
        with self.assertRaises(RuntimeError): self.verify()
    def test_wrong_org(self):
        self.event['organization_id']='wrong'
        with self.assertRaises(RuntimeError): self.verify()
    def test_wrong_payload(self):
        for key,value in [('aprobada',False),('total',200),('moneda','USD'),('tipo_cambio_usd',20),('motivo',''),('justificacion_sin_vinculo','')]:
            original=self.event['detalles'][key]
            self.event['detalles'][key]=value
            with self.subTest(key=key),self.assertRaises(RuntimeError): self.verify()
            self.event['detalles'][key]=original
    def test_all_immutable_snapshots(self):
        for key in ('concepts','payments','memberships','roles','users'):
            self.after[key].append({'unexpected':'row'})
            with self.subTest(key=key),self.assertRaises(RuntimeError): self.verify()
            self.after[key].pop()
    def test_unrelated_invoice(self):
        self.after['invoices'][1]['changed']=True
        with self.assertRaises(RuntimeError): self.verify()
    def test_unrelated_audit(self):
        self.after['audit'].append(dict(self.event,entidad_id='other',organization_id='other_org'))
        with self.assertRaises(RuntimeError): self.verify()
    def test_loser_overwrite(self):
        self.after['invoices'][0]['aprobada_por']='b'
        with self.assertRaises(RuntimeError): self.verify()
    def test_missing_invoice(self):
        self.after['invoices']=self.after['invoices'][1:]
        with self.assertRaises(RuntimeError): self.verify()
    def test_bad_rpc_success(self):
        for result in ({'ok':False,'sqlstate':'P0001'}, {'ok':True,'value':dict(self.row,aprobada_at=None)},
                       {'ok':True,'value':dict(self.row,aprobada_por='b')}):
            with self.subTest(result=result),self.assertRaises(RuntimeError): m.approved(result,'a','a')
    def test_json_timestamp_precision(self):
        value='2026-10-13T00:00:00.123456+00:00'
        self.assertEqual(m.one_json(json.dumps({'updated_at':value}),'timestamp')['updated_at'],value)
    def test_ambiguous_json_rejected(self):
        for value in ('', '{}\n{}','COMMIT\n{}'):
            with self.subTest(value=value),self.assertRaises((RuntimeError,ValueError)): m.one_json(value,'test')
    def barrier_harness(self, queued=False, blocker=11):
        h=object.__new__(m.Harness)
        h.deadline=m.time.monotonic()+2
        h.events=[]
        h.context=SimpleNamespace(database='owned')
        h.query=lambda sql,label: {'holder':11,'waiter':12,'blockers':[blocker],
                                  'state':'active','wait_event_type':'Lock','database':'owned','application_name':'waiter'}
        a=SimpleNamespace(pid=11)
        b=SimpleNamespace(pid=12,process=SimpleNamespace(poll=lambda:None),pending='marker',
                          lines=SimpleNamespace(empty=lambda:not queued),application_name='waiter')
        return h,a,b
    def test_exact_blocker_barrier(self):
        h,a,b=self.barrier_harness()
        h.wait_blocked(b,a,'case')
        self.assertEqual(h.events[0]['proof']['blockers'],[11])
    def test_early_completed_waiter_rejected(self):
        h,a,b=self.barrier_harness(queued=True)
        with self.assertRaises(RuntimeError): h.wait_blocked(b,a,'case')
    def test_wrong_blocker_rejected(self):
        h,a,b=self.barrier_harness(blocker=99)
        with patch.object(m,'BARRIER_SECONDS',.002),self.assertRaises(TimeoutError): h.wait_blocked(b,a,'case')
    def test_literal(self):
        self.assertEqual(m.literal("a'b"),"'a''b'")
    def test_standalone_database_cli_removed(self):
        for environment in ({'PATH':'/usr/bin:/bin'}, {'PATH':'/usr/bin:/bin','CXP_APPROVAL_DISPOSABLE':'1'}):
            p=subprocess.run([sys.executable,str(HERE/'concurrency.py'),'--socket-dir','/tmp',
                              '--source-commit',m.EXPECTED_SOURCE,'--evidence-dir','/tmp/no-output'],
                             env=environment,text=True,capture_output=True)
            self.assertNotEqual(p.returncode,0)
            self.assertIn('Standalone database CLI is unsupported',p.stderr)
    def test_actions_requires_explicit_service(self):
        p=subprocess.run([sys.executable,str(HERE/'run-actions.py')],
                         env={'PATH':'/usr/bin:/bin'},text=True,capture_output=True)
        self.assertNotEqual(p.returncode,0)
        self.assertIn('Explicit isolated GitHub Actions service required',p.stderr)
    def test_actions_rejects_unverified_service_id(self):
        p=subprocess.run([sys.executable,str(HERE/'run-actions.py')],
                         env={'PATH':'/usr/bin:/bin','GITHUB_ACTIONS':'true','ISOLATED_QA_DB':'1',
                              'CXP_APPROVAL_DISPOSABLE':'1','CXP_POSTGRES_SERVICE_ID':'postgres'},text=True,capture_output=True)
        self.assertNotEqual(p.returncode,0)
        self.assertIn('Exact Actions service container ID required',p.stderr)
    def test_all_invoice_fields_frozen_except_approval_allowlist(self):
        fields = {'id':'changed','organization_id':'changed','created_by':'changed',
                  'moneda':'USD','tipo_cambio_usd':2,'subtotal':200,'iva':16,'retenciones':8,
                  'total':200,'ieps':10,'dias_credito':30,'fecha_vencimiento':'2026-11-01',
                  'fecha_programada_pago':'2026-11-01','estado':'Pagada','estado_captura':'pagada',
                  'future_financial_column':123}
        for field, changed in fields.items():
            with self.subTest(field=field):
                before=copy.deepcopy(self.before)
                after=copy.deepcopy(self.after)
                returned=copy.deepcopy(self.row)
                before['invoices'][0].setdefault(field,None)
                after['invoices'][0][field]=changed
                returned[field]=changed
                with self.assertRaises(RuntimeError):
                    m.verify_final(before,after,self.f,'a',returned)
    def test_iva_mutant_with_matching_returned_row_rejected(self):
        self.before['invoices'][0]['iva']=0
        self.after['invoices'][0]['iva']=16
        self.row['iva']=16
        with self.assertRaises(RuntimeError): self.verify()
    def test_removed_invoice_column_rejected(self):
        self.before['invoices'][0]['iva']=0
        with self.assertRaises(RuntimeError): self.verify()
    def test_explicit_approval_fields_allow_changes(self):
        self.assertEqual(m.APPROVAL_MUTABLE_FIELDS, {'estado_aprobacion','aprobada_por','aprobada_at',
            'motivo_rechazo','aprobacion_heredada','justificacion_sin_vinculo','updated_at'})
        for field in m.APPROVAL_MUTABLE_FIELDS:
            before=copy.deepcopy(self.before);after=copy.deepcopy(self.after);returned=copy.deepcopy(self.row)
            before['invoices'][0][field]='old'
            after['invoices'][0][field]='new';returned[field]='new'
            m.verify_final(before,after,self.f,'a',returned)
    def test_cleanup_exact_oid_and_owner(self):
        self.assertTrue(m.owned_clone_present([{'oid':123,'owner':'postgres'}],123))
    def test_cleanup_missing_database_no_drop(self):
        self.assertFalse(m.owned_clone_present([],123))
    def test_cleanup_changed_identity_never_reaches_drop(self):
        for rows,oid in (([{'oid':124,'owner':'postgres'}],123),
                         ([{'oid':123,'owner':'someone_else'}],123),
                         ([{'oid':123,'owner':'postgres'}]*2,123),
                         ([{'oid':0,'owner':'postgres'}],None)):
            dropped=[]
            with self.subTest(rows=rows),self.assertRaises(RuntimeError):
                if m.owned_clone_present(rows,oid): dropped.append('DROP')
            self.assertEqual(dropped,[])
    def test_actual_oid_string_wire_reproduces_safe_refusal(self):
        # Exact cleanup response from Actions run 38465149137, clone 1.
        wire = '{"rows": [{"oid": "31064", "owner": "postgres"}]}'
        rows=json.loads(wire)['rows']
        with self.assertRaises(RuntimeError): m.owned_clone_present(rows,31064)
    def test_projected_numeric_oid_wire_preserves_exact_identity(self):
        rows=json.loads('{"rows": [{"oid": 31064, "owner": "postgres"}]}')['rows']
        self.assertTrue(m.owned_clone_present(rows,31064))
        with self.assertRaises(RuntimeError): m.owned_clone_present(rows,31065)
        rows[0]['owner']='other'
        with self.assertRaises(RuntimeError): m.owned_clone_present(rows,31064)
    def test_actions_cleanup_query_projects_numeric_oid(self):
        spec=importlib.util.spec_from_file_location('cxp_actions_test',HERE/'run-actions.py')
        actions=importlib.util.module_from_spec(spec);spec.loader.exec_module(actions)
        sql=actions.clone_identity_sql('cxp_approval_race_test')
        self.assertIn("'oid',oid::bigint,'owner',pg_get_userbyid(datdba)",sql)
        self.assertNotIn("'oid',oid,'owner'",sql)
        self.assertTrue(sql.endswith("WHERE datname='cxp_approval_race_test';"))
    def test_cleanup_ambiguous_create_reconciliation(self):
        self.assertTrue(m.owned_clone_present([{'oid':123,'owner':'postgres'}],None))
        self.assertFalse(m.owned_clone_present([],None))
        with self.assertRaises(RuntimeError):m.owned_clone_present([{'oid':123,'owner':'other'}],None)

if __name__=='__main__':unittest.main()
