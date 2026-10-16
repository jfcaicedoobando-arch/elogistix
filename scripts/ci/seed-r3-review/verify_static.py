#!/usr/bin/env python3
"""Read-only checks. No SQL, subprocess, network, imports of runners, or writes."""
import ast
import hashlib
import json
import pathlib
import re

ROOT = pathlib.Path(__file__).resolve().parent
FIXED = {
    'run_isolated.py': '93ac69a3d0ae3cccbb9587ffdf07ba5751b99928d5a0ff8a4e747162731fa9f9',
    'snapshot.sql': '8214954821e88579ff76d10979b296edc6d5c47870c22e6e2c27e01df9e67fb0',
    'fixtures/R2.sql': '6be74b6205202a3288c654e055081fb088556ba2750f539a0e6a677bc34a19a4',
    'fixtures/TEST_ONLY_initial_functions.sql': '7e1169e7a0aa999d6469c2d8c68ba2d448163b19d7a882c89a3f677083b62f1d',
    'fixtures/dependencies.sql': '2adf086685863db5b86f62d7a3d1dd22c5344806687de47410c1aff538c5a7f8',
    'fixtures/event_drift.sql': 'da545e97acee5fb41504cf134af35e6d051487bb9cd389a948493c6267db0f09',
    'PROPOSAL_R3_rename_lock_admission.sql': '7f054e3071b243ca6ada6359028c66efa0ac2ba5047a8cf7133f70f1b7924d86',
}
assert json.loads((ROOT / 'provenance-sha256.json').read_text()) == FIXED
for name, expected in FIXED.items():
    assert hashlib.sha256((ROOT / name).read_bytes()).hexdigest() == expected, name
runner = (ROOT / 'run_isolated.py').read_text()
ast.parse(runner)
ast.parse(pathlib.Path(__file__).read_text())
sql = (ROOT / 'PROPOSAL_R3_rename_lock_admission.sql').read_text()
start = sql.index('IF NOT v_stopped THEN')
end = sql.index('END IF; -- replacements and intermediate postchecks only')
assert start < end < sql.index('$atomic_hashes_admission_terminal$') < sql.index("RAISE NOTICE 'R3: logical retry")
assert len(re.findall(r'EXECUTE \$atomic_stopped_definition_\d\$', sql[start:end])) == 4
outer = re.sub(r'EXECUTE \$atomic_stopped_definition_(\d)\$.*?\$atomic_stopped_definition_\1\$;', '', sql, flags=re.S)
assert not re.search(r'\bRETURN\s*;', outer, flags=re.I)
assert runner.index('start_attempted=True') < runner.index("'start')")
assert runner.index("'cleanup-status-after'") < runner.index('shutil.rmtree(t)')
assert runner.index("result['status']='pass'") > runner.index("result['cleanup']='confirmed_stopped_and_removed'")
for guard in ['--run-disposable-only', 'os.geteuid()==0', '--auth-host=reject', 'unconfirmed_or_failed_directory_preserved', 'postmaster.pid', 'assert after==before', 'assert logical(retry)==logical(after)']:
    assert guard in runner, guard
assert 'os.environ' not in runner
assert 'tempfile.TemporaryDirectory(' not in runner
print(json.dumps({'status': 'static_checks_pass', 'fixed_artifacts': len(FIXED), 'SQL_executed': False, 'multiuser_runtime': 'NOT_RUN', 'Vitest': 'NOT_RUN_BY_THIS_CHECK'}))
