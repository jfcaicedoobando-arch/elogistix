#!/usr/bin/env python3
"""Stream the final real-function block suite into the exact Actions service.

Uses the local-socket/temporary-config verification pattern of run-actions.py.
No discovery, containers, pulls, URLs, grants or changes to the SQL guard.
"""
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import tempfile

ROOT = Path(__file__).resolve().parents[3]
SUITE = ROOT / 'supabase/tests/rls/test_rls_demo_seed_disabled.sql'
PIN = 'postgres@sha256:66b6a97eac1771fc78bd201b918b4253859f436c6913aeede97bd5366cce89ae'
PREFLIGHT = b"""SELECT json_build_object('database',current_database(),
 'current_user',current_user,'session_user',session_user,'server_addr',inet_server_addr(),
 'owner',(SELECT pg_get_userbyid(datdba) FROM pg_database WHERE datname=current_database()));
"""


def require(ok, message):
    if not ok:
        raise RuntimeError('DEMO_COMPAT_CI: ' + message)


def main():
    require(len(sys.argv) == 1, 'No alternate suite or connection arguments accepted')
    require(os.environ.get('GITHUB_ACTIONS') == 'true'
            and os.environ.get('ISOLATED_QA_DB') == '1'
            and os.environ.get('DEMO_COMPAT_DISPOSABLE') == '1', 'Explicit isolated Actions opt-in required')
    container = os.environ.get('DEMO_COMPAT_POSTGRES_SERVICE_ID', '')
    require(re.fullmatch(r'[a-f0-9]{64}', container) is not None, 'Exact service ID required')
    require(os.environ.get('POSTGRES_IMAGE') == PIN, 'Unexpected image pin')
    require(not any(os.environ.get(k) for k in
            ('DATABASE_URL', 'SUPABASE_DB_URL', 'PGSERVICE', 'PGSERVICEFILE', 'PGHOSTADDR')),
            'Ambient remote/database routing refused')
    sql = SUITE.read_bytes()
    with tempfile.TemporaryDirectory(prefix='demo-compat-docker-') as config:
        env = {'PATH': os.environ.get('PATH', '/usr/bin:/bin'), 'LANG': 'C', 'LC_ALL': 'C',
               'DOCKER_HOST': 'unix:///var/run/docker.sock', 'DOCKER_CONFIG': config}

        def inspect():
            p = subprocess.run(['docker', 'inspect', container], env=env, capture_output=True,
                               timeout=15, check=True)
            items = json.loads(p.stdout)
            require(len(items) == 1 and items[0]['Id'] == container
                    and items[0]['State']['Running'] is True
                    and items[0]['Config']['Image'] == PIN, 'Service identity/state/image mismatch')

        argv = ['docker', 'exec', '-i', container, '/usr/bin/env', '-i',
                'PATH=/usr/lib/postgresql/17/bin:/usr/bin:/bin', 'LANG=C', 'LC_ALL=C',
                'PGHOST=/var/run/postgresql', 'PGUSER=postgres', 'PGPORT=5432', 'PGDATABASE=postgres',
                'PGCONNECT_TIMEOUT=5', 'PGPASSFILE=/tmp/demo-compat-nonexistent.pgpass',
                'psql', '-X', '-w', '-q', '-v', 'ON_ERROR_STOP=1']
        inspect()
        p = subprocess.run(argv + ['-A', '-t', '-f', '-'], env=env, input=PREFLIGHT,
                           capture_output=True, timeout=30)
        require(p.returncode == 0, 'Read-only service preflight failed')
        require(json.loads(p.stdout) == {'database': 'postgres', 'current_user': 'postgres',
                'session_user': 'postgres', 'server_addr': None, 'owner': 'postgres'},
                'Owned socket database context required')
        inspect()
        p = subprocess.run(argv + ['-f', '-'], env=env, input=sql, capture_output=True, timeout=180)
        sys.stdout.buffer.write(p.stdout)
        sys.stderr.buffer.write(p.stderr)
        return p.returncode


if __name__ == '__main__':
    try:
        raise SystemExit(main())
    except (RuntimeError, OSError, ValueError, KeyError, TypeError, subprocess.SubprocessError) as error:
        print(str(error), file=sys.stderr)
        raise SystemExit(1)
