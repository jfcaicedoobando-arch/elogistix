"""Strict, committed CRM client races. Uses the existing owned-clone transport."""
import json
from pathlib import Path
import re
import uuid

PAYLOAD = {'nombre': 'Different legal name', 'rfc': 'XAXX010101000',
           'contacto': 'Synthetic contact', 'email': 'fixture@test.invalid', 'telefono': '5555555555',
           'cp': '06600', 'regimen_fiscal': '601', 'uso_cfdi_default': 'G03',
           'forma_pago_default': '99', 'metodo_pago_default': 'PPD', 'direccion': 'Synthetic address'}

HELPER = r"""
CREATE FUNCTION pg_temp.client_case(kind text, target uuid, payload jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER AS $helper$
DECLARE result jsonb;
BEGIN
 IF current_user <> 'authenticated' OR auth.uid() IS NULL OR auth.role() <> 'authenticated'
   OR public.org_scope() IS NULL THEN RAISE EXCEPTION 'BAD_TEST_AUTH'; END IF;
 BEGIN
  CASE kind
   WHEN 'create' THEN
     SELECT to_jsonb(c) INTO result FROM public.crear_clientes(jsonb_build_array(payload)) c;
   WHEN 'convert' THEN result := public.convertir_prospecto_a_cliente_rpc(target,payload);
   WHEN 'delete' THEN UPDATE public.crm_empresas SET deleted_at=clock_timestamp() WHERE id=target;
   WHEN 'combined' THEN
     UPDATE public.crm_empresas SET cliente_id=gen_random_uuid(),deleted_at=clock_timestamp() WHERE id=target;
   WHEN 'clear' THEN UPDATE public.crm_empresas SET cliente_id=NULL WHERE id=target;
   WHEN 'demote' THEN UPDATE public.crm_empresas SET estado_crm='Lead' WHERE id=target;
   WHEN 'insert_deleted' THEN
     INSERT INTO public.crm_empresas(organization_id,nombre,estado_crm,deleted_at)
       VALUES(public.org_scope(),'Invalid synthetic company','Cliente',clock_timestamp());
   ELSE RAISE EXCEPTION 'UNKNOWN_TEST_CASE';
  END CASE;
  RETURN jsonb_build_object('value',result,'caller',current_user,'subject',auth.uid());
 EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('error',SQLERRM,'state',SQLSTATE,'caller',current_user,'subject',auth.uid());
 END;
END $helper$;
"""

def run(context, m):
    m.require(context.database.startswith('crm_prospecto_kam_'), 'Owned adapter clone required')
    h = m.Harness(context)
    record = {'status': 'running', 'source_commit': context.source_commit, 'cases': [], 'events': []}
    def case_session(f, label, kam=False):
        s = m.Session(h,label)
        s.execute(HELPER)
        actor = dict(f)
        if not kam:
            actor['actor'] = f.get('operator',f['actor'])
        s.begin(actor)
        return s
    def call(s, kind, target=None, payload=None, wait=True):
        sql = 'SELECT pg_temp.client_case(' + m.literal(kind) + ',' + (
            m.literal(target) + '::uuid' if target else 'NULL') + ',' + m.literal(json.dumps(payload or PAYLOAD)) + '::jsonb);'
        s.start(sql)
        return result(s) if wait else None
    def result(s):
        r = m.one_json(s.finish(),s.label)
        m.require(r['caller']=='authenticated' and r['subject']==s.actor, 'Wrong test identity')
        h.events.append({'session':s.label,'outcome':r})
        return r
    def ok(r):
        m.require('error' not in r, 'Unexpected rejection: '+str(r))
        return r['value']
    def denied(r, code=None):
        m.require('error' in r and (code is None or code in r['error']), 'Expected controlled rejection: '+str(r))
    def operator(f):
        f['operator'] = str(uuid.uuid4())
        q=m.literal
        roles=h.query("BEGIN; INSERT INTO auth.users(id,email) VALUES ("+q(f['operator'])+","+q(f['operator']+'@test.invalid')+"); "
                "INSERT INTO public.organization_members(organization_id,user_id,role) VALUES ("+q(f['org'])+","+q(f['operator'])+",'customer_service'); "
                "UPDATE public.organization_members SET role='operador' WHERE user_id="+q(f['operator'])+"; "
                "INSERT INTO public.user_roles(user_id,role) VALUES ("+q(f['operator'])+",'operador') ON CONFLICT (user_id) DO UPDATE SET role=EXCLUDED.role; "
                "SELECT jsonb_build_object('membership',(SELECT role FROM public.organization_members WHERE user_id="+q(f['operator'])+" AND organization_id="+q(f['org'])+"),'global',(SELECT role FROM public.user_roles WHERE user_id="+q(f['operator'])+")); COMMIT;",'operator')
        m.require(roles=={'membership':'operador','global':'operador'},'Exact operator mirrors required')
    def seed(quote=False):
        f,_=h.seed()
        if quote:
            s=case_session(f,'prepare-kam-'+str(h.sequence),kam=True)
            op=s.call()
            s.commit()
            s.close()
            f['op']=op['oportunidad_id']
            f['quote']=str(uuid.uuid4())
            q=m.literal
            h.query("BEGIN; INSERT INTO public.cotizaciones(id,organization_id,folio,modo,tipo,oportunidad_id,es_prospecto,prospecto_empresa,created_by) VALUES ("+
                    ','.join((q(f['quote']),q(f['org']),q('CRM-QA-'+f['quote']),q('Marítimo'),q('Importación'),q(f['op']),"true",q('Prospecto identity'),q(f['actor'])))+"); "
                    "UPDATE public.cotizaciones SET estado='Aceptada' WHERE id="+q(f['quote'])+"; "
                    "SELECT jsonb_build_object('lead',lead_id) FROM public.crm_oportunidades WHERE id="+q(f['op'])+"; COMMIT;",'quote-fixture')
        operator(f)
        return f
    def snap(f,label):
        value=h.snapshot(f,label)
        value['quotes']=h.query("SELECT jsonb_build_object('rows',coalesce(jsonb_agg(to_jsonb(c)||jsonb_build_object('__ctid',c.ctid::text,'__xmin',c.xmin::text) ORDER BY c.id),'[]'::jsonb)) FROM public.cotizaciones c WHERE organization_id="+m.literal(f['org'])+';',label+'-quotes')['rows']
        return value
    def client_company(after,f,cid):
        rows=[r for r in after['companies'] if r['cliente_id']==cid]
        m.require(len(rows)==1 and rows[0]['id']==f['company'] and rows[0]['deleted_at'] is None
                  and rows[0]['estado_crm']=='Cliente','Missing or duplicated exact destination')
    def done(name):
        record['cases'].append(name)

    try:
        # Two independent creates finish while an old homonym is locked.
        f=seed()
        q=m.literal
        h.query("INSERT INTO public.crm_empresas(organization_id,nombre,created_by) VALUES ("+
                q(f['org'])+",'KAM concurrency company',"+q(f['actor'])+"); SELECT jsonb_build_object('ok',true);",'homonym')
        before=snap(f,'independent-before')
        a,b=case_session(f,'independent-A'),case_session(f,'independent-B')
        a.execute("SELECT id FROM public.crm_empresas WHERE id="+q(f['company'])+" FOR UPDATE;")
        p=dict(PAYLOAD,nombre='  KAM concurrency company  ')
        ca=ok(call(a,'create',payload=p))['id']
        cb=ok(call(b,'create',payload=p))['id'] # Must finish before A releases the old company.
        m.require(ca!=cb,'Independent clients collapsed')
        a.commit(); b.commit()
        after=snap(f,'independent-after')
        m.require(len(after['clients'])==2 and len(after['companies'])==len(before['companies'])+2,'Independent counts')
        for old in before['companies']:
            m.require(old in after['companies'],'Old homonym physically rewritten')
        for cid in (ca,cb):
            m.require(len([r for r in after['companies'] if r['cliente_id']==cid])==1,'Lost independent link')
        done('independent_homonyms_no_old_row_lock')

        # New client must bind the exact company before the INSERT trigger.
        f=seed(True)
        before=snap(f,'explicit-before')
        s=case_session(f,'explicit')
        c=ok(call(s,'convert',f['quote']))
        m.require(c['creado'] is True,'Expected new client')
        s.commit()
        after=snap(f,'explicit-after')
        client_company(after,f,c['cliente_id'])
        m.require(len(after['companies'])==len(before['companies']),'Duplicate automatic company')
        s=case_session(f,'explicit-retry')
        retry=ok(call(s,'convert',f['quote']))
        m.require(retry['cliente_id']==c['cliente_id'] and retry['sin_cambios'] is True,'Wrong retry')
        s.commit()
        m.require(snap(f,'explicit-retry-after')==after,'Retry physically rewrote rows')
        for kind in ('clear','demote','delete'):
            s=case_session(f,'guard-'+kind)
            denied(call(s,kind,f['company']),'LC_CRM_EMPRESA_ES_CLIENTE'); s.commit()
        done('explicit_new_identity_retry_and_clear_then_delete')

        # RFC reuse must also bind the exact target, without duplicating a company.
        f=seed(True)
        p=dict(PAYLOAD,rfc='AAA010101AAA')
        s=case_session(f,'rfc-create')
        existing=ok(call(s,'create',payload=p))['id']; s.commit()
        before=snap(f,'rfc-before')
        s=case_session(f,'rfc-convert')
        converted=ok(call(s,'convert',f['quote'],p)); s.commit()
        m.require(converted['cliente_id']==existing and converted['creado'] is False,'RFC reuse lost')
        after=snap(f,'rfc-after')
        m.require(len(after['clients'])==1 and len(after['companies'])==len(before['companies']),'RFC reuse duplicated rows')
        target=next(r for r in after['companies'] if r['id']==f['company'])
        m.require(target['cliente_id']==existing and target['created_by']==f['actor'],'RFC target attribution changed')
        done('rfc_reuse_exact_target')

        # Same explicit identity: serialize, then the waiter is a physical no-op.
        f=seed(True)
        a,b=case_session(f,'same-A'),case_session(f,'same-B')
        first=ok(call(a,'convert',f['quote']))
        call(b,'convert',f['quote'],wait=False)
        h.wait_blocked(b,a)
        a.commit()
        second=ok(result(b))
        committed=snap(f,'same-first-committed')
        m.require(second['cliente_id']==first['cliente_id'] and second['sin_cambios'] is True,'Waiter did not reuse conversion')
        b.commit()
        m.require(snap(f,'same-both-committed')==committed,'Waiter changed persisted rows')
        client_company(committed,f,first['cliente_id'])
        done('same_identity_two_committed_conversions')

        # Both orders of association/deletion must be checked after the real wait.
        for delete_first in (True,False):
            f=seed(True)
            before=snap(f,'delete-order-before-'+str(delete_first))
            a,b=case_session(f,'delete-A-'+str(delete_first)),case_session(f,'delete-B-'+str(delete_first))
            if delete_first:
                ok(call(a,'delete',f['company']))
                call(b,'convert',f['quote'],wait=False)
            else:
                first=ok(call(a,'convert',f['quote']))
                call(b,'delete',f['company'],wait=False)
            h.wait_blocked(b,a); a.commit()
            denied(result(b),'LC_CRM_EMPRESA_NO_ENCONTRADA' if delete_first else 'LC_CRM_EMPRESA_ES_CLIENTE')
            b.commit()
            after=snap(f,'delete-order-after-'+str(delete_first))
            if delete_first:
                m.require(after['clients']==before['clients'],'Deleted target created a client')
                m.require(next(r for r in after['companies'] if r['id']==f['company'])['cliente_id'] is None,'Deleted target linked')
            else:
                client_company(after,f,first['cliente_id'])
            done('delete_before_association' if delete_first else 'association_before_delete')

        # PR366 stays exercised with a true KAM; neither lock order deadlocks.
        for kam_first in (True,False):
            f=seed(True)
            kam=case_session(f,'kam-'+str(kam_first),kam=True)
            conv=case_session(f,'kam-conv-'+str(kam_first))
            if kam_first:
                r=kam.call()
                m.require(r['sin_cambios'] is True,'Existing KAM opportunity expected')
                call(conv,'convert',f['quote'],wait=False)
                h.wait_blocked(conv,kam); kam.commit()
                c=ok(result(conv)); conv.commit()
            else:
                c=ok(call(conv,'convert',f['quote']))
                kam.call(asynchronous=True)
                h.wait_blocked(kam,conv); conv.commit()
                r=kam.result(); kam.commit()
            m.require(r['oportunidad_id']==f['op'] and r['sin_cambios'] is True,'KAM lineage changed')
            client_company(snap(f,'kam-final-'+str(kam_first)),f,c['cliente_id'])
            done('kam_before_conversion' if kam_first else 'conversion_before_kam')

        # Invalid destinations and combined NEW state are rejected without writes.
        for mutation in ('deleted','cross_org','ambiguous','conflict'):
            f=seed(True); q=m.literal
            if mutation=='deleted':
                sql="UPDATE public.crm_empresas SET deleted_at=clock_timestamp() WHERE id="+q(f['company'])+";"
            elif mutation=='cross_org':
                sql="UPDATE public.crm_empresas SET organization_id="+q(f['other_org'])+" WHERE id="+q(f['company'])+";"
            elif mutation=='ambiguous':
                extra=str(uuid.uuid4())
                sql="INSERT INTO public.crm_empresas(id,organization_id,nombre,created_by) VALUES ("+q(extra)+","+q(f['org'])+",'Same display name',"+q(f['actor'])+"); "
                sql+="INSERT INTO public.crm_oportunidad_empresa(organization_id,oportunidad_id,empresa_id) VALUES ("+q(f['org'])+","+q(f['op'])+","+q(extra)+");"
            else:
                s=case_session(f,'conflict-create'); cid=ok(call(s,'create'))['id'];s.commit()
                sql="UPDATE public.crm_empresas SET cliente_id="+q(cid)+" WHERE id="+q(f['company'])+";"
            h.query(sql+" SELECT jsonb_build_object('ok',true);",'mutate-'+mutation)
            before=snap(f,'invalid-before-'+mutation)
            s=case_session(f,'invalid-'+mutation)
            denied(call(s,'convert',f['quote']),{'deleted':'LC_CRM_EMPRESA_NO_ENCONTRADA',
                   'cross_org':'LC_ORG_AJENA','ambiguous':'LC_CONVERSION_INCONSISTENTE',
                   'conflict':'LC_CONVERSION_INCONSISTENTE'}[mutation]);s.commit()
            m.require(snap(f,'invalid-after-'+mutation)==before,'Rejected conversion wrote rows')
            done('reject_'+mutation)
        f=seed()
        for kind in ('combined','insert_deleted'):
            s=case_session(f,'new-guard-'+kind)
            denied(call(s,kind,f['company']),'LC_CRM_EMPRESA_ES_CLIENTE');s.commit()
        done('guard_new_deleted_customer')

        # Replay and runtime must not change PR366 owner/security/body/ACL.
        record.update(status='pass',both_committed=True)
    finally:
        for s in h.sessions:
            s.close()
        record['events']=h.events
        (h.out/'result.json').write_text(json.dumps(record,indent=2)+'\n')
    return record

