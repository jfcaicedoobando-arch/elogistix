#!/usr/bin/env python3
"""Fail-closed mutation controls. Only in run-local.sh or the disposable Actions service."""
from pathlib import Path
import json, os, subprocess

ROOT = Path(__file__).resolve().parents[3]
if (os.environ.get('GLOBAL_CATALOG_OWNED_CLUSTER') != '1'
        or os.environ.get('PGHOST') not in ('127.0.0.1', 'localhost')
        or os.environ.get('PGUSER') != 'postgres'
        or os.environ.get('PGDATABASE') != 'postgres'
        or any(os.environ.get(k) for k in ['DATABASE_URL', 'SUPABASE_DB_URL', 'PGHOSTADDR', 'PGSERVICE', 'PGSERVICEFILE'])):
    raise SystemExit('Refusing: run through run-local.sh in its disposable cluster')
CHECK = (ROOT / 'supabase/tests/rls/_ci_check_global_catalog_acl.sql').read_text()
PAYLOAD = (ROOT / 'supabase/migrations/20261013040000_global_catalog_permission_hardening.sql').read_text()
TABLES = ['planes', 'navieras', 'puertos', 'tipos_contenedor', 'tipos_cambio_dof']
RESULTS = []

def run(sql):
    return subprocess.run(['psql', '-X', '-qAt', '-v', 'ON_ERROR_STOP=1'], input=sql, text=True, capture_output=True)

def must_reject(name, mutation, expected):
    result = run('BEGIN;\n' + mutation + '\n' + CHECK + '\nROLLBACK;')
    if result.returncode == 0 or expected not in result.stderr:
        raise AssertionError((name, result.returncode, result.stdout, result.stderr))
    RESULTS.append({'case': name, 'status': 'PASS'})

for table in TABLES:
    must_reject('anon table grant ' + table, f'GRANT SELECT ON public.{table} TO anon;', 'GLOBAL_CATALOG_ANON_GRANT')
    for privilege in ['TRUNCATE', 'REFERENCES', 'TRIGGER', 'MAINTAIN']:
        must_reject(f'authenticated {table} {privilege}', f'GRANT {privilege} ON public.{table} TO authenticated;', 'GLOBAL_CATALOG_AUTH_GRANT')
for privilege in ['INSERT', 'UPDATE', 'DELETE']:
    must_reject('DOF ' + privilege, f'GRANT {privilege} ON public.tipos_cambio_dof TO authenticated;', 'GLOBAL_CATALOG_AUTH_GRANT')
must_reject('anon column grant', 'GRANT SELECT(nombre) ON public.planes TO anon;', 'GLOBAL_CATALOG_ANON_COLUMN_GRANT')
must_reject('DOF column grant', 'GRANT UPDATE(usd_mxn) ON public.tipos_cambio_dof TO authenticated;', 'GLOBAL_CATALOG_AUTH_COLUMN_GRANT')
must_reject('missing active-plan predicate', 'ALTER POLICY "Authenticated read planes" ON public.planes USING(true);', 'GLOBAL_CATALOG_EXACT_POLICY_SET_DRIFT')
must_reject('missing super-admin policy', 'DROP POLICY "Super admin CRUD planes" ON public.planes;', 'GLOBAL_CATALOG_EXACT_POLICY_SET_DRIFT')
must_reject('super-admin policy broadened with OR true', 'ALTER POLICY "Super admin CRUD planes" ON public.planes USING (((SELECT public.has_role((SELECT auth.uid()), \'super_admin\'::public.app_role)) OR true));', 'GLOBAL_CATALOG_EXACT_POLICY_SET_DRIFT')
must_reject('extra permissive plan policy', 'CREATE POLICY "QA forbidden permissive plane policy" ON public.planes FOR SELECT TO authenticated USING (true);', 'GLOBAL_CATALOG_EXACT_POLICY_SET_DRIFT')
must_reject('disabled RLS', 'ALTER TABLE public.planes DISABLE ROW LEVEL SECURITY;', 'GLOBAL_CATALOG_RLS_DISABLED')
must_reject('lost SELECT', 'REVOKE SELECT ON public.navieras FROM authenticated;', 'GLOBAL_CATALOG_AUTH_SELECT_MISSING')
must_reject('missing DOF EXECUTE', 'REVOKE EXECUTE ON FUNCTION public.tc_dof_upsert_manual(date,numeric,numeric) FROM authenticated;', 'GLOBAL_CATALOG_DOF_RPC_DRIFT')
must_reject('DOF invoker drift', 'ALTER FUNCTION public.tc_dof_upsert_manual(date,numeric,numeric) SECURITY INVOKER;', 'GLOBAL_CATALOG_DOF_RPC_DRIFT')

# Every rejected transaction must have rolled back; this also checks idempotency.
result = run('BEGIN;\n' + CHECK + '\n' + PAYLOAD + '\n' + PAYLOAD + '\n' + CHECK + '\nROLLBACK;')
if result.returncode:
    raise AssertionError(result.stderr)
RESULTS.append({'case': 'all failed mutations rolled back; canonical payload twice remains valid', 'status': 'PASS'})
print(json.dumps({'remote_writes': False, 'cases': RESULTS, 'passed': len(RESULTS)}, indent=2))
