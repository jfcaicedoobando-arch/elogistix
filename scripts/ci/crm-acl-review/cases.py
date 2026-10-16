"""Synthetic integration cases. Never imports a DB driver or accepts a DSN."""
import copy,re
from contextlib import contextmanager
F=['public._crm_empresa_no_borrar_cliente()','public._crm_empresa_no_delete_fisico()']
# PostgreSQL rejects RETURNS trigger functions with declared arguments (42P13).
# A legal scalar overload establishes signature drift without failing fixture setup.
SIGNATURE_DRIFT_SQL='DROP FUNCTION '+F[0]+' CASCADE;CREATE FUNCTION public._crm_empresa_no_borrar_cliente(integer) RETURNS integer LANGUAGE sql AS $$ SELECT $1 $$;'
@contextmanager
def database(r,name):
 db=r.clone(name)
 try:yield db
 finally:r.query('DROP DATABASE '+db+' WITH (FORCE);','drop-'+name,user='supabase_admin')
def semantic(s):
 s=copy.deepcopy(s)
 for p in s['pg_proc']:
  if p['proname'] in [x.split('.')[1].split('(')[0] for x in F]:p.pop('proacl')
 # Only ACL shared-dependency entries on the two helper objects may change.
 oids={p['oid'] for p in s['pg_proc'] if p['proname'] in [x.split('.')[1].split('(')[0] for x in F]}
 s['pg_shdepend']=[d for d in s['pg_shdepend'] if not (d['objid'] in oids and str(d['classid'])=='1255' and d['deptype']=='a')]
 return s

def run_cases(r):
 for mode in ('clean','replay','mixed'):
  with database(r,mode) as db:
   if mode=='mixed':r.query('REVOKE EXECUTE ON FUNCTION '+F[0]+' FROM service_role;','mixed-setup',db)
   before=r.snapshot(db,mode+'-before');r.query(r.candidate,mode,db);after=r.snapshot(db,mode+'-after')
   assert semantic(before)==semantic(after),'non-ACL semantic drift'
   rows=[p for p in after['pg_proc'] if p['proname'] in [f.split('.')[1].split('(')[0] for f in F]]
   assert len(rows)==2 and all(p['proacl']==['postgres=X/postgres'] for p in rows)
   assert r.query("SELECT has_function_privilege('service_role','public._crm_empresa_desde_cliente()','EXECUTE');",'0016-retains-execute',db).stdout.strip()=='t'
   if mode=='replay':
    r.query(r.candidate,'second-replay',db);assert r.snapshot(db,'replay-final')==after
   r.check(mode,semantic_catalog_preserved=True)
 with database(r,'dml') as db:
  r.query(r.candidate,'dml-migrate',db)
  assert r.query("SET ROLE authenticated;SELECT current_user='authenticated' AND NOT (SELECT rolsuper FROM pg_roles WHERE rolname=current_user);",'authenticated-context',db,user='supabase_admin').stdout.strip()=='t'
  r.query("INSERT INTO crm_empresas(id,organization_id,nombre,cliente_id,estado_crm) VALUES ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000099','Synthetic prospect',NULL,'Prospecto'),('00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000099','Synthetic linked','00000000-0000-0000-0000-000000000088','Prospecto'),('00000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000099','Synthetic client',NULL,'Cliente');",'dml-fixture',db)
  r.query("SET ROLE authenticated; UPDATE crm_empresas SET nombre=nombre||' updated'; UPDATE crm_empresas SET deleted_at=now() WHERE id='00000000-0000-0000-0000-000000000001';DELETE FROM crm_empresas WHERE id='00000000-0000-0000-0000-000000000001';",'authenticated-positive',db,user='supabase_admin')
  for suffix in ('2','3'):
   for op in ('UPDATE crm_empresas SET deleted_at=now()','DELETE FROM crm_empresas'):
    p=r.query("SET ROLE authenticated; "+op+" WHERE id='00000000-0000-0000-0000-00000000000"+suffix+"';",'authenticated-blocked',db,user='supabase_admin',expected=3)
    assert re.search(r'^ERROR:\s+23514:',p.stdout,re.M),p.stdout
  assert r.query("SELECT count(*)=2 AND bool_and(deleted_at IS NULL AND nombre LIKE '% updated') FROM crm_empresas;",'dml-outcome',db).stdout.strip()=='t'
  r.check('authenticated-DML-old-linked-and-client-23514')
 mutations={
 'missing':'DROP FUNCTION '+F[0]+' CASCADE;',
 'renamed':'ALTER FUNCTION '+F[0]+' RENAME TO synthetic_renamed;',
 'owner':'ALTER FUNCTION '+F[0]+' OWNER TO service_role;',
 'security':'ALTER FUNCTION '+F[0]+' SECURITY DEFINER;',
 'cost':'ALTER FUNCTION '+F[0]+' COST 101;',
 'volatile':'ALTER FUNCTION '+F[0]+' STABLE;',
 'strict':'ALTER FUNCTION '+F[0]+' STRICT;',
 'parallel':'ALTER FUNCTION '+F[0]+' PARALLEL SAFE;',
 'config':'ALTER FUNCTION '+F[0]+" SET search_path='pg_catalog';",
 'body':'CREATE OR REPLACE FUNCTION '+F[0]+' RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RETURN NEW; END $$;',
 'public':'GRANT EXECUTE ON FUNCTION '+F[0]+' TO PUBLIC;',
 'anon':'GRANT EXECUTE ON FUNCTION '+F[0]+' TO anon;',
 'authenticated':'GRANT EXECUTE ON FUNCTION '+F[0]+' TO authenticated;',
 'unknown':'GRANT EXECUTE ON FUNCTION '+F[0]+' TO synthetic_other;',
 'grant_option':'GRANT EXECUTE ON FUNCTION '+F[0]+' TO service_role WITH GRANT OPTION;',
 'empty_acl':'REVOKE EXECUTE ON FUNCTION '+F[0]+' FROM postgres,service_role;',
 'missing_owner':'REVOKE EXECUTE ON FUNCTION '+F[0]+' FROM postgres;',
 'recreated':'DROP FUNCTION '+F[0]+' CASCADE;CREATE FUNCTION '+F[0]+' RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RETURN NEW; END $$;',
 'signature':SIGNATURE_DRIFT_SQL,
 'unexpected_grantor':'GRANT EXECUTE ON FUNCTION '+F[0]+' TO service_role WITH GRANT OPTION;SET ROLE service_role;GRANT EXECUTE ON FUNCTION '+F[0]+' TO synthetic_other;RESET ROLE;',
 'trigger_type':'DROP TRIGGER trg_crm_empresa_no_borrar_cliente ON crm_empresas;CREATE TRIGGER trg_crm_empresa_no_borrar_cliente AFTER UPDATE OF deleted_at ON crm_empresas FOR EACH ROW EXECUTE FUNCTION '+F[0]+';',
 'trigger_attr':'DROP TRIGGER trg_crm_empresa_no_borrar_cliente ON crm_empresas;CREATE TRIGGER trg_crm_empresa_no_borrar_cliente BEFORE UPDATE OF nombre ON crm_empresas FOR EACH ROW EXECUTE FUNCTION '+F[0]+';',
 'trigger_when':"DROP TRIGGER trg_crm_empresa_no_borrar_cliente ON crm_empresas;CREATE TRIGGER trg_crm_empresa_no_borrar_cliente BEFORE UPDATE OF deleted_at ON crm_empresas FOR EACH ROW WHEN (NEW.nombre IS NOT NULL) EXECUTE FUNCTION "+F[0]+';',
 'trigger_function':'DROP TRIGGER trg_crm_empresa_no_borrar_cliente ON crm_empresas;CREATE TRIGGER trg_crm_empresa_no_borrar_cliente BEFORE UPDATE OF deleted_at ON crm_empresas FOR EACH ROW EXECUTE FUNCTION '+F[1]+';',
 'partition':'ALTER TABLE crm_empresas RENAME TO synthetic_old;CREATE TABLE crm_empresas (LIKE synthetic_old) PARTITION BY HASH (id);',
 'trigger_missing':'DROP TRIGGER trg_crm_empresa_no_borrar_cliente ON crm_empresas;',
 'trigger_disabled':'ALTER TABLE crm_empresas DISABLE TRIGGER trg_crm_empresa_no_borrar_cliente;',
 'trigger_renamed':'ALTER TRIGGER trg_crm_empresa_no_borrar_cliente ON crm_empresas RENAME TO synthetic_renamed;',
 'trigger_extra':'CREATE TRIGGER synthetic_extra BEFORE DELETE ON crm_empresas FOR EACH ROW EXECUTE FUNCTION '+F[1]+';',
 'trigger_other_table':'CREATE TRIGGER synthetic_other BEFORE DELETE ON clientes FOR EACH ROW EXECUTE FUNCTION '+F[1]+';',
 'inheritance':'CREATE TABLE synthetic_child () INHERITS (crm_empresas);',
 'table_replaced':'ALTER TABLE crm_empresas RENAME TO synthetic_old;CREATE TABLE crm_empresas (LIKE synthetic_old INCLUDING ALL);',
 }
 for name,sql in mutations.items():
  with database(r,'drift_'+name) as db:
   r.query(sql,'setup-'+name,db,user='supabase_admin' if name in ('owner','unexpected_grantor') else 'postgres')
   before=r.snapshot(db,name+'-before');p=r.query(r.candidate,'reject-'+name,db,expected=3)
   assert re.search(r'^ERROR:\s+P0001: CRM_ACL_',p.stdout,re.M),p.stdout
   assert r.snapshot(db,name+'-after')==before,'rollback differs: '+name
   r.check('reject-'+name,sqlstate=re.search(r'^ERROR:\s+([0-9A-Z]{5}):',p.stdout,re.M)[1],complete_rollback=True)
 # Catalog writes below are deliberately synthetic ADMIN fixture corruption,
 # never part of the candidate or a live operation. Each clone is destroyed.
 for name,expression in [('null_acl','proacl=NULL'),('binary',"probin='synthetic drift'"),('return_type',"prorettype='integer'::regtype"),('sqlbody',"prosqlbody=(SELECT prosqlbody FROM pg_proc WHERE oid='public.synthetic_sqlbody()'::regprocedure)")]:
  with database(r,'catalog_'+name) as db:
   if name=='sqlbody':r.query('CREATE FUNCTION public.synthetic_sqlbody() RETURNS integer LANGUAGE SQL RETURN 1;','sqlbody-fixture',db)
   r.query('UPDATE pg_catalog.pg_proc SET '+expression+" WHERE oid='"+F[0]+"'::regprocedure;",'synthetic-admin-corruption-'+name,db,user='supabase_admin')
   before=r.snapshot(db,name+'-before');p=r.query(r.candidate,'reject-catalog-'+name,db,expected=3)
   assert re.search(r'^ERROR:\s+P0001: CRM_ACL_',p.stdout,re.M);assert r.snapshot(db,name+'-after')==before
   r.check('reject-'+name,synthetic_admin_corruption=True,complete_rollback=True)
 # Global role mutations are undone in finally and cannot escape the disposable cluster.
 for name,setup,undo in [('inherited','GRANT postgres TO service_role;','REVOKE postgres FROM service_role;'),('superuser','ALTER ROLE service_role SUPERUSER;','ALTER ROLE service_role NOSUPERUSER;')]:
  with database(r,name) as db:
   try:
    r.query(setup,'role-setup-'+name,db,user='supabase_admin');before=r.snapshot(db,name+'-before')
    p=r.query(r.candidate,'role-reject-'+name,db,expected=3);assert re.search(r'^ERROR:\s+P0001: CRM_ACL_POSTCONDITION_FAILED$',p.stdout,re.M)
    assert r.snapshot(db,name+'-after')==before;r.check('role-'+name,complete_rollback=True)
   finally:r.query(undo,'role-undo-'+name,db,user='supabase_admin')
 for name,prefix in [('wrong_user','SET ROLE service_role;'),('isolation',"SET default_transaction_isolation='repeatable read';")]:
  with database(r,name) as db:
   before=r.snapshot(db,name+'-before');p=r.query(prefix+r.candidate,name,db,user='supabase_admin' if name=='wrong_user' else 'postgres',expected=3)
   assert re.search(r'^ERROR:\s+P0001: CRM_ACL_CONTEXT_MISMATCH$',p.stdout,re.M);assert r.snapshot(db,name+'-after')==before;r.check(name)
