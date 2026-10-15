"""Read-only source/protocol checks. No SQL, subprocess network or installation."""
from pathlib import Path
import subprocess,sys
R=Path(__file__).resolve().parent
commands=[
 [sys.executable,'-I','verify_manifest.py'],
 [sys.executable,'-I','public_contract_test.py'],
 [sys.executable,'-I','issuer/static_tests.py'],
 [sys.executable,'-I','identity/tests/bridge/test_contract.py'],
 ['node','--experimental-strip-types','--test','rpc/rpc-attempt.test.mjs']]
for command in commands:
 subprocess.run(command,cwd=R,check=True)
print('Offline contracts only: PASS. PostgreSQL/HTTP/financial execution: NOT_RUN. Overall: HOLD.')
