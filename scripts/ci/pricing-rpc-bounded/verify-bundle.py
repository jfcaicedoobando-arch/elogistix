"""Fail closed on changes to frozen inputs; no database or network access."""
import hashlib
import json
from pathlib import Path
import re

plan = Path(__file__).resolve().parent
allowed = {
    'bootstrap-synthetic.sql', 'auth-uid.sql', 'auth-jwt.sql', 'auth-role.sql',
    'replay.sql', 'assertions.sql', 'expected-notices.json', 'provenance.json',
    'run.sh', 'run-ci.sh', 'verify-bundle.py', 'verify-evidence.py',
    'README.md', 'SHA256SUMS',
}
if {p.name for p in plan.iterdir()} != allowed:
    raise SystemExit('Unexpected or missing bundle input')
if any(p.is_symlink() or not p.is_file() for p in plan.iterdir()):
    raise SystemExit('Bundle inputs must be regular files, never symlinks')
expected = {}
for line in (plan / 'SHA256SUMS').read_text().splitlines():
    match = re.fullmatch(r'([a-f0-9]{64})  ([a-zA-Z0-9_.-]+)', line)
    if not match or match[2] in expected:
        raise SystemExit('Malformed or duplicate hash entry')
    expected[match[2]] = match[1]
if set(expected) != allowed - {'SHA256SUMS'}:
    raise SystemExit('Incomplete input hash manifest')
for name, digest in expected.items():
    data = (plan / name).read_bytes()
    if hashlib.sha256(data).hexdigest() != digest:
        raise SystemExit(f'Frozen input mismatch: {name}')
    text = data.decode('utf-8')
    if name.endswith('.sql'):
        if re.search(r'https?://|postgres(?:ql)?://|/workspace/|-----BEGIN|eyJ[A-Za-z0-9_-]{20,}|(?:gh[pousr]_|sb_secret_|sk_live_|AKIA)[A-Za-z0-9]{12,}', text):
            raise SystemExit(f'Endpoint, machine path or credential-like input: {name}')
        for email in re.findall(r'[\w.+-]+@[\w.-]+\.[A-Za-z]+', text):
            if not email.endswith('@replay.invalid'):
                raise SystemExit(f'Non-synthetic email in {name}')
        for line in text.splitlines():
            if line.lstrip().startswith('\\') and line != '\\set ON_ERROR_STOP on':
                raise SystemExit(f'Unexpected psql command in {name}')
provenance = json.loads((plan / 'provenance.json').read_text())
frozen_sql = provenance['frozen_sql_sha256']
if not isinstance(frozen_sql, list) or any(
    not isinstance(entry, dict) or set(entry) != {'path', 'sha256'}
    or not isinstance(entry['path'], str) or not isinstance(entry['sha256'], str)
    for entry in frozen_sql
):
    raise SystemExit('Malformed frozen SQL provenance')
sql_inputs = {name for name in allowed if name.endswith('.sql')}
if len(frozen_sql) != len(sql_inputs) or {entry['path'] for entry in frozen_sql} != sql_inputs:
    raise SystemExit('Incomplete or duplicate frozen SQL provenance')
for entry in frozen_sql:
    if expected.get(entry['path']) != entry['sha256']:
        raise SystemExit(f"Frozen source provenance mismatch: {entry['path']}")
source_notices = re.findall(r"RAISE NOTICE '(PASS[^']+)'", (plan / 'assertions.sql').read_text())
notices = json.loads((plan / 'expected-notices.json').read_text())
if source_notices != notices or len(notices) != 30 or len(set(notices)) != 30:
    raise SystemExit('Assertion notice contract changed')
print(json.dumps({'status': 'verified', 'files': expected,
                  'sql_executed': False, 'expected_notice_count': len(notices)}, indent=2))
