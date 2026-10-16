#!/usr/bin/env python3
"""Reuse the strict PR366 adapter; no alternate connection or SQL input."""
import importlib.util
import json
from pathlib import Path
import re
import sys

HERE=Path(__file__).resolve().parent
ROOT=HERE.parents[2]
def module(name,path):
    spec=importlib.util.spec_from_file_location(name,path)
    value=importlib.util.module_from_spec(spec)
    sys.modules[name]=value
    spec.loader.exec_module(value)
    return value
adapter=module('crm_cliente_owned_adapter',HERE.parent/'crm-prospecto-kam/run-actions.py')
cases=module('crm_cliente_cases',HERE/'cases.py')
MIGRATION='supabase/migrations/20261016070000_crm_cliente_identidad_atomica.sql'
MIRRORS=['_crm_empresa_para_conversion.sql','crm_empresa_desde_cliente.sql',
         '_crm_empresa_validar_lead.sql',
         'crm_empresa_no_borrar_cliente.sql','_crm_lead_sync_estado_empresa.sql',
         'convertir_prospecto_a_cliente_rpc.sql']
original_verify=adapter.verify_sources
def verify_sources():
    original_verify() # Freeze PR366 body too.
    migration=(ROOT/MIGRATION).read_text(encoding='utf-8')
    for path in MIRRORS:
        mirror=(ROOT/'supabase/schema/crm'/path).read_text(encoding='utf-8')
        adapter.require(mirror in migration,'Complete canonical mirror missing: '+path)
    adapter.require('BEGIN;' in migration and migration.rstrip().endswith('COMMIT;'),'Atomic forward required')
    adapter.require('set_config(' not in migration,'Caller-controlled conversion context refused')
    return migration
adapter.verify_sources=verify_sources
adapter.EVIDENCE_SUBDIR='reports/crm-cliente-concurrency'
def run_cases(context):
    result=cases.run(context,adapter.m)
    print(json.dumps({'database':context.database,'status':result['status'],'cases':result['cases']}),flush=True)
    return result
adapter.m.run_concurrency=run_cases
if __name__=='__main__':
    adapter.main()

