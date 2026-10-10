"""Require every assertion notice, clean rollback and successful cluster disposal."""
import json
from pathlib import Path
import re
import sys

plan = Path(__file__).resolve().parent
evidence = Path(sys.argv[1])
expected = json.loads((plan / 'expected-notices.json').read_text())
actual = re.findall(r'NOTICE:  (PASS[^\r\n]+)', (evidence / 'replay.log').read_text())
if actual != expected:
    raise SystemExit('Missing, duplicate, unexpected or reordered assertion notices')
if (evidence / 'status.txt').read_text() != 'exit_code=0\ncluster_disposed=true\n':
    raise SystemExit('The isolated cluster did not exit successfully and dispose')
if (evidence / 'container-state.txt').read_text().strip() != '0 false ""':
    raise SystemExit('Container failed or was OOM-killed')
print(json.dumps({'status': 'passed', 'passed_notice_count': len(actual),
                  'assertions': actual, 'scope': 'bounded SQL replay only',
                  'application_execute_enabled': False,
                  'production_or_http_validation': False}, indent=2))
