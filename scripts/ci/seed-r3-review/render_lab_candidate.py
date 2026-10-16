"""Render a LAB-ONLY candidate without connecting to a database or running SQL.
API: render(baseline: dict) -> str; metadata_sql() -> str.
CLI: python render_lab_candidate.py baseline.json [output.sql]
"""
import hashlib
import json
import re
import sys
from pathlib import Path

if not __debug__:
    raise RuntimeError('LAB_RENDERER_SECURITY: Python optimization is forbidden')

ROOT = Path(__file__).parent

def metadata_sql() -> str:
    """Return the frozen first SELECT only, for read-only fixture metadata acquisition."""
    text = (ROOT / 'PROPOSAL_ledger_metadata_readonly.sql').read_text()
    text = '\n'.join(line for line in text.splitlines() if not line.lstrip().startswith('--'))
    return text.split(';', 1)[0] + ';'

def render(baseline: dict) -> str:
    assert baseline['environment_kind'] == 'isolated_local_test'
    assert re.fullmatch(r'(?:r3_ledger_lab_[a-z0-9_]+|qa_r3_cc_ledger_[a-z_]+)', baseline['database_name'])
    assert isinstance(baseline['database_oid'], int)
    assert baseline['server_addr'] is None or baseline['server_addr'] in ('127.0.0.1', '::1')
    assert baseline['server_port'] is None or isinstance(baseline['server_port'], int)
    assert baseline['reviewed_transport_has_no_autoregistration'] is True
    assert baseline['reviewed_no_other_appliers'] is True
    assert isinstance(baseline['ledger_metadata'], dict)
    assert re.fullmatch('[0-9a-f]{64}', baseline['supabase_history_digest'])
    history = baseline['history']
    assert len(history) == 20 and len({x['id'] for x in history}) == 20
    history = sorted(history, key=lambda x: x['id'])
    expected = json.loads((ROOT / 'expected-drizzle-preimage.json').read_text())
    assert sorted((x['hash'], x['created_at']) for x in history) == sorted((x['hash'], x['created_at']) for x in expected)
    source = (ROOT / 'PROPOSAL_R3_manual_ledger_wrapper.sql').read_text()
    assert source.count("RAISE EXCEPTION 'PROPOSAL_NOT_ADMITTED:") == 1
    # JSON is placed inside both an inner dollar literal and the outer DO literal.
    # Reject every dollar delimiter, including the outer one.
    for serialized in (json.dumps(baseline['ledger_metadata']), json.dumps(history)):
        if re.search(r'\$(?:[A-Za-z_][A-Za-z0-9_]*)?\$', serialized):
            raise ValueError('LAB_RENDERER_SECURITY: SQL dollar delimiter in baseline JSON')
    guard = f"""IF current_database() IS DISTINCT FROM '{baseline['database_name']}'
    OR (SELECT oid::bigint FROM pg_catalog.pg_database WHERE datname=current_database()) IS DISTINCT FROM {baseline['database_oid']}
    OR pg_catalog.host(inet_server_addr()) IS DISTINCT FROM {('NULL' if baseline['server_addr'] is None else repr(baseline['server_addr']))}
    OR inet_server_port() IS DISTINCT FROM {('NULL' if baseline['server_port'] is None else str(baseline['server_port']))} THEN
   RAISE EXCEPTION 'LAB_ONLY: exact isolated local fixture identity required';
 END IF;"""
    source = re.sub(r"RAISE EXCEPTION 'PROPOSAL_NOT_ADMITTED:[^']*';", guard, source, count=1)
    source = source.replace('v_transport_has_no_autoregistration constant boolean := NULL;', 'v_transport_has_no_autoregistration constant boolean := true;')
    source = re.sub(r'\$reviewed_metadata\$.*?\$reviewed_metadata\$', lambda _: '$reviewed_metadata$' + json.dumps(baseline['ledger_metadata'], separators=(',', ':')) + '$reviewed_metadata$', source, count=1, flags=re.S)
    source = re.sub(r'\$reviewed_history\$.*?\$reviewed_history\$', lambda _: '$reviewed_history$' + json.dumps(history, separators=(',', ':')) + '$reviewed_history$', source, count=1, flags=re.S)
    source = re.sub(r"v_expected_supabase_digest constant text := '[0-9a-f]{64}';", "v_expected_supabase_digest constant text := '" + baseline['supabase_history_digest'] + "';", source, count=1)
    if 'test_new_when' in baseline:
        test_when = baseline['test_new_when']
        assert type(test_when) is int and 1792058404766 < test_when < 9223372036854775807
        assert test_when != 1792084137000
        source = re.sub(r'v_new_when constant bigint := [0-9]+;', f'v_new_when constant bigint := {test_when};', source, count=1)
        source = re.sub(r"v_new_tag constant text := '[^']*';", "v_new_tag constant text := 'LAB_ONLY_NOT_A_MIGRATION';", source, count=1)
    return '-- LAB ONLY: exact fixture binding below; no remote execution permitted.\n' + source

def main() -> None:
    baseline_file = Path(sys.argv[1])
    source = render(json.loads(baseline_file.read_text()))
    output = Path(sys.argv[2]) if len(sys.argv) > 2 else ROOT / 'LAB_ONLY_R3_manual_ledger_candidate.sql'
    output.write_text(source)
    output.with_suffix('.manifest.json').write_text(json.dumps({
        'lab_baseline_sha256': hashlib.sha256(baseline_file.read_bytes()).hexdigest(),
        'candidate_sha256': hashlib.sha256(output.read_bytes()).hexdigest(),
        'proposal_sha256': hashlib.sha256((ROOT / 'PROPOSAL_R3_manual_ledger_wrapper.sql').read_bytes()).hexdigest(),
        'database_name': json.loads(baseline_file.read_text())['database_name'],
        'executed_sql': False,
        'production_proposal_modified': False,
    }, indent=2) + '\n')
    print(str(output))

if __name__ == '__main__':
    main()
