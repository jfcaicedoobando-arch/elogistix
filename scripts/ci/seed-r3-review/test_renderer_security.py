"""Renderer security unit tests. Render in memory only; no SQL is executed."""
import copy
import importlib.util
import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).parent
spec = importlib.util.spec_from_file_location('lab_renderer_under_test', ROOT / 'render_lab_candidate.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
baseline = {
    'environment_kind': 'isolated_local_test',
    'database_name': 'qa_r3_cc_ledger_unit',
    'database_oid': 123456,  # synthetic unit input only, never used against a DB
    'server_addr': None,
    'server_port': None,
    'reviewed_transport_has_no_autoregistration': True,
    'reviewed_no_other_appliers': True,
    'ledger_metadata': {'unit_test_synthetic': True},
    'supabase_history_digest': '0' * 64,
    'history': [dict(row, id=index + 1) for index, row in enumerate(json.loads((ROOT / 'expected-drizzle-preimage.json').read_text()))],
    'test_new_when': 1900000000000,
}
rendered = module.render(baseline)
assert "RAISE EXCEPTION 'PROPOSAL_NOT_ADMITTED:" not in rendered
assert "RAISE EXCEPTION 'LAB_ONLY:" in rendered
assert 'v_new_when constant bigint := 1900000000000;' in rendered
assert "v_new_tag constant text := 'LAB_ONLY_NOT_A_MIGRATION';" in rendered
for delimiter in ('$reviewed_metadata$', '$reviewed_history$', '$r3_manual_ledger_proposal$', '$$'):
    bad = copy.deepcopy(baseline)
    bad['ledger_metadata']['injection_probe'] = delimiter
    try:
        module.render(bad)
    except ValueError as exc:
        assert 'dollar delimiter' in str(exc)
    else:
        raise AssertionError(f'Unsafe delimiter accepted: {delimiter}')
optimized = subprocess.run(
    [sys.executable, '-O', '-c', 'import runpy; runpy.run_path(' + repr(str(ROOT / 'render_lab_candidate.py')) + ')'],
    capture_output=True, text=True, check=False,
)
assert optimized.returncode != 0 and 'Python optimization is forbidden' in optimized.stderr
query = module.metadata_sql()
assert query.count(';') == 1
assert 'sequence_metadata' in query and 'triggers_sha256' in query
assert query.rstrip().endswith("WHERE c.oid=pg_catalog.to_regclass('drizzle.__drizzle_migrations');")
print('PASS: in-memory render, test-only identity, dollar-delimiter rejection, optimized-mode rejection, complete metadata SELECT. No SQL executed.')
