"""Exact canonical SQL; synthetic helper replay and explicitly adapted ledger witness."""
import hashlib,json,re
from adapter import fixture_sql
from cases import database,semantic,F

def owner_only(r,db,label):
 assert r.query("SELECT bool_and(proacl=ARRAY['postgres=X/postgres']::aclitem[]) FROM pg_proc WHERE oid=ANY(ARRAY['"+F[0]+"'::regprocedure::oid,'"+F[1]+"'::regprocedure::oid]);",label,db).stdout.strip()=='t'

def ledger(r,db,label):
 return json.loads(r.query("SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY id),'[]') FROM public.synthetic_registry x;",label,db).stdout)

def witness(candidate,fail=False):
 h=hashlib.sha256(candidate.encode()).hexdigest()
 # Deliberately synthetic explicit ID, not a model of the real sequence/default.
 guard="DO $$ BEGIN IF EXISTS(SELECT 1 FROM public.synthetic_registry WHERE id<>1 OR hash<>'"+h+"' OR created_at<>1792093404000) THEN RAISE EXCEPTION 'SYNTHETIC_LEDGER_CONFLICT'; END IF; END $$;"
 insert="INSERT INTO public.synthetic_registry SELECT 1,'"+h+"',1792093404000 WHERE NOT EXISTS(SELECT 1 FROM public.synthetic_registry);"
 abort="DO $$ BEGIN RAISE EXCEPTION 'SYNTHETIC_ROLLBACK_WITNESS'; END $$;" if fail else ''
 return "BEGIN;SET LOCAL statement_timeout='20s';LOCK TABLE public.synthetic_registry IN SHARE ROW EXCLUSIVE MODE NOWAIT;"+guard+candidate+insert+abort+'COMMIT;'

def run_canonical_cases(r):
 db='crm_acl_fixture_fresh_history'
 r.query('CREATE DATABASE '+db+' TEMPLATE template0 OWNER postgres;','fresh-create',user='supabase_admin')
 try:
  r.query(fixture_sql(),'fresh-helper-history-0016-0018',db)
  before=r.snapshot(db,'fresh-before');r.query(r.candidate,'fresh-exact-canonical',db);after=r.snapshot(db,'fresh-after')
  assert semantic(before)==semantic(after);owner_only(r,db,'fresh-acl')
  r.check('fresh-helper-history',scope='0016/0017/0018 on explicit synthetic dependencies, not full ERP history')
 finally:r.query('DROP DATABASE '+db+' WITH (FORCE);','fresh-drop',user='supabase_admin')
 with database(r,'equivalent_recreation') as db:
  # Source-equivalent recreated helpers and their links are valid for portable SQL.
  # The separate private envelope would be responsible for pinned installation identity.
  old=r.query("SELECT '"+F[0]+"'::regprocedure::oid;",'recreated-old-identity',db).stdout.strip()
  source=(__import__('pathlib').Path(__file__).parent/'inputs/sources/0017_crm_empresa_no_borrar_cliente.sql').read_text()
  r.query('DROP FUNCTION '+F[0]+' CASCADE;DROP FUNCTION '+F[1]+' CASCADE;'+source,'equivalent-recreation',db)
  new=r.query("SELECT '"+F[0]+"'::regprocedure::oid;",'recreated-new-identity',db).stdout.strip();assert old!=new
  before=r.snapshot(db,'recreated-before');r.query(r.candidate,'recreated-canonical',db);after=r.snapshot(db,'recreated-after')
  assert semantic(before)==semantic(after);owner_only(r,db,'recreated-owner-only');r.check('portable-equivalent-recreation',installation_envelope_claim=False)
 for name,sql in [('second_body','CREATE OR REPLACE FUNCTION '+F[1]+' RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RETURN OLD; END $$;'),('second_acl','GRANT EXECUTE ON FUNCTION '+F[1]+' TO anon;')]:
  with database(r,name) as db:
   r.query(sql,name+'-setup',db);before=r.snapshot(db,name+'-before');p=r.query(r.candidate,name+'-reject',db,expected=3)
   assert re.search(r'^ERROR:\s+P0001: CRM_ACL_',p.stdout,re.M);assert r.snapshot(db,name+'-after')==before;r.check(name,complete_rollback=True)
 for mode in ['commit','idempotent','rollback','conflict']:
  with database(r,'registry_'+mode) as db:
   r.query('CREATE TABLE public.synthetic_registry(id integer PRIMARY KEY,hash text NOT NULL,created_at bigint NOT NULL);','registry-create-'+mode,db)
   if mode=='idempotent':r.query(witness(r.candidate),'registry-first',db)
   if mode=='conflict':r.query("INSERT INTO public.synthetic_registry VALUES(1,'wrong',1792093404000);",'registry-conflict-setup',db)
   before=r.snapshot(db,'registry-'+mode+'-before');rows=ledger(r,db,'registry-'+mode+'-rows-before')
   fail=mode in ['rollback','conflict'];response=r.query(witness(r.candidate,mode=='rollback'),'registry-'+mode,db,expected=3 if fail else 0)
   after=r.snapshot(db,'registry-'+mode+'-after');rows_after=ledger(r,db,'registry-'+mode+'-rows-after')
   if fail:
    expected='SYNTHETIC_ROLLBACK_WITNESS' if mode=='rollback' else 'SYNTHETIC_LEDGER_CONFLICT'
    assert re.search(r'^ERROR:\s+P0001: '+expected+'$',response.stdout,re.M),response.stdout
    assert before==after and rows==rows_after
   else:
    assert semantic(before)==semantic(after);owner_only(r,db,'registry-'+mode+'-owner')
    assert rows_after==[dict(id=1,hash=hashlib.sha256(r.candidate.encode()).hexdigest(),created_at=1792093404000)]
    if mode=='idempotent':assert before==after and rows==rows_after
   r.check('registry-'+mode,witness='synthetic explicit-ID table; not operational ledger wrapper',complete_rollback=fail)
