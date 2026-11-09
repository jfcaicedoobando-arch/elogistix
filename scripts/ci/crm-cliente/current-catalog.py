"""Pinned final CRM identity contract, read-only; never returns executable SQL."""
import hashlib
import importlib.util
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[3]
HISTORY = 'drizzle/migrations/0034_prospecto_solo_borrador.sql'
SHA256 = 'b4daeecf283e43b5e85ab0fc1dec0f1c322c4a0150549c5d4bbb23b48210e0b5'
HOUSEKEEPING_HISTORY = 'drizzle/migrations/0041_prospecto_housekeeping_historicos.sql'
HOUSEKEEPING_SHA256 = '4bc3ec9e2f34c10bd7091e8f1b9eb5e3458dce2b3f6d7664d8eec129fd27fd53'
SIGNATURES = {
    '_crm_empresa_para_conversion': 'uuid,uuid,uuid',
    '_crm_empresa_validar_lead': '', '_crm_empresa_desde_cliente': '',
    '_crm_empresa_no_borrar_cliente': '', '_crm_empresa_no_delete_fisico': '',
    '_crm_lead_sync_estado_empresa': '', 'convertir_prospecto_a_cliente_rpc': 'uuid,jsonb',
    '_cotizaciones_validar_prospecto': '',
}

def definitions(sql):
    pattern = r'CREATE OR REPLACE FUNCTION public\.(\w+)\([^;]*?\)\s*(.*?)AS\s+(\$\w*\$)(.*?)\3;'
    return {name: (header, body) for name, header, _, body in re.findall(pattern, sql, re.S)}

def expected_catalog():
    spec = importlib.util.spec_from_file_location('crm_identity_historical_sources', Path(__file__).with_name('run-actions.py'))
    historical = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(historical)
    old = definitions(historical.verify_sources())
    current = (ROOT / HISTORY).read_bytes()
    if hashlib.sha256(current).hexdigest() != SHA256:
        raise RuntimeError('Final 0034 source changed without contract review')
    mirror = ROOT / 'scripts/ci/drizzle-history/0034_prospecto_solo_borrador.sql'
    if mirror.read_bytes() != current:
        raise RuntimeError('Final 0034 isolated mirror differs')
    final = definitions(current.decode())
    if set(final) != {'convertir_prospecto_a_cliente_rpc', '_cotizaciones_validar_prospecto'}:
        raise RuntimeError('Complete final 0034 definitions required')
    # 0041 evolves only the quotation trigger; the conversion RPC remains 0034.
    housekeeping = (ROOT / HOUSEKEEPING_HISTORY).read_bytes()
    if hashlib.sha256(housekeeping).hexdigest() != HOUSEKEEPING_SHA256:
        raise RuntimeError('Final 0041 source changed without contract review')
    mirror = ROOT / 'scripts/ci/drizzle-history/0041_prospecto_housekeeping_historicos.sql'
    if mirror.read_bytes() != housekeeping:
        raise RuntimeError('Final 0041 isolated mirror differs')
    evolved = definitions(housekeeping.decode())
    if set(evolved) != {'_cotizaciones_validar_prospecto'}:
        raise RuntimeError('Complete final 0041 trigger definition required')
    old.update(final)
    old.update(evolved)
    if set(old) != set(SIGNATURES):
        raise RuntimeError('Complete final CRM identity catalog required')
    result = {}
    for name, args in SIGNATURES.items():
        header, body = old[name]
        acl = ['postgres=X/postgres']
        if 'SECURITY DEFINER' in header:
            acl.append('service_role=X/postgres')
        if name == 'convertir_prospecto_a_cliente_rpc':
            acl.append('authenticated=X/postgres')
        if name == '_cotizaciones_validar_prospecto':
            # Existing product ACL, checked in strict replay before CI grants.
            acl += ['=X/postgres', 'authenticated=X/postgres']
        result[name + '(' + args + ')'] = {'body': body, 'definer': 'SECURITY DEFINER' in header, 'acl': acl,
            'returns': re.search(r'RETURNS\s+(\w+)', header, re.I).group(1).lower()}
    return result


def verify_row(signature, row, contract):
    expected = {'body': contract['body'], 'owner': 'postgres',
                'definer': contract['definer'], 'config': ['search_path=public'],
                'language': 'plpgsql', 'returns': contract['returns'],
                'acl': sorted(contract['acl'])}
    actual = {**row, 'acl': sorted(row.get('acl') or [])}
    if actual != expected:
        raise RuntimeError('Final identity function body/security/ACL mismatch: ' + signature)
