#!/usr/bin/env python3
"""Review-only PG17.6 owned fixture. No execution on import or without Actions gates."""
import argparse, hashlib, json, os, re, shutil, subprocess, time, uuid
from pathlib import Path
HERE = Path(__file__).resolve().parent
REPO = HERE.parents[2]
BRANCH = 'review/protected-authority-registry-20261016'
REPOSITORY = 'jfcaicedoobando-arch/elogistix'
IMAGE = 'postgres@sha256:f3bd19c606e442c3d7bdfa8002e03fe260a1023351e0ea4598032022b68dd6e3'
SQL = REPO / 'docs/review/demo-flow-20261015/issuer'
ENV = {'PATH': os.environ.get('PATH', '/usr/bin:/bin'), 'LANG': 'C.UTF-8', 'HOME': '/tmp'}

def verify_inputs():
    pins = json.loads((HERE / 'source-pins.json').read_text())
    for row in pins['sources']:
        p = REPO / row['path']
        if p.is_symlink() or REPO not in p.resolve().parents: raise ValueError('Input escapes checkout')
        b = p.read_bytes()
        if len(b) != row['bytes'] or hashlib.sha256(b).hexdigest() != row['sha256']: raise ValueError('Authentic source drift: ' + row['path'])
    if (REPO / 'scripts/ci/demo-authentic-review/sql/registry.sql').read_bytes() != (SQL / '16-owner-registry.sql').read_bytes():
        raise ValueError('SQL16 fixture is not original SQL16')
    return pins

def guard(env, optin):
    if not optin or env.get('GITHUB_ACTIONS') != 'true' or env.get('DEMO_AUTHORITY_ISOLATED') != '1' or env.get('GITHUB_EVENT_NAME') != 'pull_request' or env.get('GITHUB_REPOSITORY') != REPOSITORY or env.get('GITHUB_HEAD_REF') != BRANCH:
        raise ValueError('Only the explicitly opted-in draft Actions lane is allowed')
    event = json.loads(Path(env['GITHUB_EVENT_PATH']).read_text())
    pr = event['pull_request']
    if pr['draft'] is not True or pr['head']['ref'] != BRANCH or pr['head']['repo']['full_name'] != REPOSITORY or pr['base']['ref'] != 'main':
        raise ValueError('Unexpected draft/repository/branch')
    if pr['base']['sha'] != '3a7c71fba35c9e7af509a8217a193929da21db9c': raise ValueError('Integrated base changed; review required')
    if not re.fullmatch('[0-9a-f]{40}', pr['head']['sha']): raise ValueError('Invalid head')
    return pr['head']['sha']

def command(args, stdin=None, timeout=120, check=True):
    return subprocess.run(args, input=stdin, text=True, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, timeout=timeout, check=check, env=ENV)

def inspect_owned(name, token):
    obj = json.loads(command(['docker', 'inspect', name]).stdout)[0]
    if obj['Config'].get('Image') != IMAGE or obj['Config']['Labels'].get('demo.authority.owner') != token or obj['HostConfig']['NetworkMode'] != 'none' or obj['HostConfig'].get('PortBindings') or obj['HostConfig'].get('Privileged') or any(m['Type'] == 'bind' for m in obj.get('Mounts', [])):
        raise RuntimeError('Container ownership/isolation mismatch')
    return obj

def run(output, optin=False):
    head = guard(os.environ, optin)  # Before ALL subprocess calls, even git/docker inspection.
    pins = verify_inputs()
    if command(['git', 'rev-parse', 'HEAD']).stdout.strip() != head: raise RuntimeError('Checkout is not exact PR head')
    output.mkdir(parents=True, exist_ok=False)
    token = uuid.uuid4().hex; name = 'authority-review-' + token; cid = None; created = False; processes = []
    result = {'head': head, 'base': pins['base'], 'demo': 'NOT_ADMITTED', 'business': 'NOT_RUN', 'rpc_authentication': 'NOT_RUN', 'restore_durability': 'NOT_ESTABLISHED', 'checks': [], 'cleanup_verified': False, 'status': 'FAIL'}
    stage = output / 'package'; stage.mkdir()
    authentic = REPO / 'scripts/ci/demo-authentic-review/sql'
    (stage / 'authentic').mkdir()
    for row in pins['sources']:
        if row['path'].startswith('scripts/ci/demo-authentic-review/sql/'):
            shutil.copy2(REPO / row['path'], stage / 'authentic' / Path(row['path']).name)
    shutil.copytree(HERE / 'sql', stage / 'authority')
    shutil.copy2(SQL / '17-protected-occurrence.sql', stage / '17-protected-occurrence.sql')
    shutil.copy2(SQL / '18-authority-reader.sql', stage / '18-authority-reader.sql')
    try:
        created = True  # Also handle an uncertain create that succeeded on the daemon.
        command(['docker', 'create', '--name', name, '--label', 'demo.authority.owner=' + token, '--network', 'none', '-e', 'POSTGRES_USER=supabase_admin', '-e', 'POSTGRES_HOST_AUTH_METHOD=trust', IMAGE, '-c', 'listen_addresses=', '-c', 'unix_socket_directories=/var/run/postgresql'], timeout=180)
        obj = inspect_owned(name, token); cid = obj['Id']
        if not re.fullmatch('[0-9a-f]{64}', cid): raise RuntimeError('Invalid owned container id')
        command(['docker', 'start', cid])
        command(['docker', 'exec', cid, 'sh', '-c', 'i=0; until [ "$(cat /proc/1/comm)" = postgres ] && pg_isready -h /var/run/postgresql -U supabase_admin; do i=$((i+1)); [ "$i" -lt 60 ] || exit 1; sleep 1; done'], timeout=75)
        def args(db, user='postgres'):
            inspect_owned(cid, token)
            return ['docker', 'exec', '-i', cid, 'psql', '-X', '-h', '/var/run/postgresql', '-U', user, '-d', db, '-v', 'ON_ERROR_STOP=1', '-qAt']
        def sql(db, text, user='postgres', okay=True):
            r = command(args(db, user), text, check=False)
            with (output / 'psql.log').open('a') as f: f.write('\n' + user + '@' + db + '\n' + r.stdout)
            if okay and r.returncode: raise RuntimeError('SQL stage failed: ' + r.stdout[-1500:])
            return r
        if sql('postgres', "SELECT current_setting('server_version_num')||':'||current_user||':'||(SELECT rolsuper FROM pg_roles WHERE rolname=current_user);", 'supabase_admin').stdout.strip() != '170006:supabase_admin:true': raise RuntimeError('Expected PostgreSQL 17.6 bootstrap')
        sql('postgres', 'CREATE ROLE postgres LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS NOINHERIT; CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN; CREATE ROLE service_role NOLOGIN; CREATE ROLE authority_outsider LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;', 'supabase_admin')
        db = 'elogistix_identity_test_authority_' + token[:12]
        sql('postgres', 'CREATE DATABASE ' + db + ' OWNER postgres;', 'supabase_admin')
        command(['docker', 'cp', str(stage), cid + ':/tmp/package'])
        setup = '\\i /tmp/package/authentic/setup.sql\n\\i /tmp/package/17-protected-occurrence.sql\n\\i /tmp/package/18-authority-reader.sql\n\\i /tmp/package/authority/empty.sql\n'
        installed = sql(db, setup).stdout
        if installed.splitlines().count('AUTHORITY_EMPTY_OWNER_ONLY_COMPLETE') != 1: raise RuntimeError('Installation/ACL assertions missing')
        result['checks'].append('empty_registry_owner_only_acl')
        for query in ['SELECT demo_flow_writer.read_authority(gen_random_uuid());', 'INSERT INTO demo_flow_writer.authority_fences VALUES (\'BAD\',1,\'BAD\',false,1,\'BAD\');', 'SELECT demo_flow_writer.issue_bound_context(gen_random_uuid());']:
            rejected = sql(db, query, 'authority_outsider', False)
            if rejected.returncode == 0 or 'permission denied' not in rejected.stdout: raise RuntimeError('Outsider was not denied')
        result['checks'].append('native_outsider_denials')
        sql(db, '\\i /tmp/package/authority/fixture.sql\n')
        checked = sql(db, '\\i /tmp/package/authority/assertions.sql\n').stdout
        if checked.splitlines().count('AUTHORITY_NATIVE_ASSERTIONS_COMPLETE') != 1: raise RuntimeError('Native authority assertions missing')
        result['checks'].append('native_registry_reader_negative_cases')
        row = json.loads(sql(db, 'SELECT demo_flow_writer.read_authority(context_id) FROM public.authority_test_result;').stdout)
        (output / 'native-authority.json').write_text(json.dumps(row, indent=2) + '\n')
        # Feed actual PostgreSQL output to the unchanged PR358 mapper.
        program = "import {readFileSync} from 'node:fs'; import {mapDeclaredVerifiedSnapshots} from './scripts/ci/demo-authority-bridge-review/contract.mjs'; const result=mapDeclaredVerifiedSnapshots(JSON.parse(readFileSync(process.argv[1],'utf8'))); if(result.binding.contract!=='OFFLINE_SCHEDULER_BINDING_REVIEW_V1')throw Error('mapper mismatch'); console.log('NATIVE_JSON_ORIGINAL_MAPPER_PASS');"
        mapped = command(['node', '--input-type=module', '-e', program, str(output / 'native-authority.json')]).stdout
        if mapped.strip() != 'NATIVE_JSON_ORIGINAL_MAPPER_PASS': raise RuntimeError('Original mapper failed')
        result['checks'].append('native_json_original_pr358_mapper')
        aid = sql(db, 'SELECT authority_id FROM public.authority_test_result;').stdout.strip()
        context = sql(db, 'SELECT context_id FROM public.authority_test_result;').stdout.strip()
        for value in (aid, context):
            if not re.fullmatch('[0-9a-f-]{36}', value): raise RuntimeError('Malformed fixture id')
        def start(text):
            p = subprocess.Popen(args(db), stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, env=ENV)
            p.stdin.write(text); p.stdin.close(); p.stdin = None; processes.append(p); return p
        reader = start("SET application_name='authority_reader_lock'; BEGIN; SELECT demo_flow_writer.read_authority('" + context + "'); SELECT pg_sleep(5); COMMIT;")
        def wait_activity(app, expected):
            end = time.monotonic() + 15
            while time.monotonic() < end:
                value = sql(db, "SELECT coalesce(wait_event_type,'')||':'||coalesce(wait_event,'') FROM pg_stat_activity WHERE application_name='" + app + "';").stdout.strip()
                if expected in value: return value
                time.sleep(.05)
            raise RuntimeError('Did not observe ' + app + ':' + expected)
        wait_activity('authority_reader_lock', 'PgSleep')
        revoke = start("SET application_name='authority_revoke_lock'; SELECT demo_flow_writer.revoke_occurrence('" + aid + "','CONCURRENT_FIXTURE_ONLY');")
        observed = wait_activity('authority_revoke_lock', 'Lock:')
        for label, p in [('reader', reader), ('revoke', revoke)]:
            out, _ = p.communicate(timeout=20); (output / (label + '-session.log')).write_text(out)
            if p.returncode: raise RuntimeError(label + ' concurrent session failed')
        denied = sql(db, "SELECT demo_flow_writer.read_authority('" + context + "');", okay=False)
        if denied.returncode == 0 or 'DEMO_AUTHORITY_REVOKED' not in denied.stdout: raise RuntimeError('Post-revocation read succeeded')
        result['concurrency'] = {'observed_wait': observed, 'reader_commit_before_revocation': True, 'post_revocation_read': 'DENIED'}
        result['checks'].append('native_two_session_revocation_serialization')
        result['status'] = 'PASS'
    except Exception as e:
        result['error'] = str(e)
        raise
    finally:
        for p in processes:
            if p.poll() is None:
                p.kill(); p.communicate(timeout=10)
        if created:
            lookup = command(['docker', 'inspect', name], check=False)
            if lookup.returncode == 0:
                obj = inspect_owned(name, token); cid = obj['Id']; volumes = [m['Name'] for m in obj.get('Mounts', []) if m['Type'] == 'volume']
                if obj['State']['Running']: command(['docker', 'stop', '--time', '10', cid], timeout=30)
                if inspect_owned(cid, token)['State']['Running']: raise RuntimeError('Owned container remains running')
                command(['docker', 'rm', '-v', cid])
                remaining = command(['docker', 'ps', '-a', '--filter', 'label=demo.authority.owner=' + token, '--format', '{{.ID}}']).stdout.strip()
                volume_names = command(['docker', 'volume', 'ls', '--format', '{{.Name}}']).stdout.splitlines()
                if remaining or any(v in volume_names for v in volumes): raise RuntimeError('Owned resources remain')
                result['cleanup_verified'] = True
        (output / 'result.json').write_text(json.dumps(result, indent=2) + '\n')
    return result

def main():
    parser = argparse.ArgumentParser(); parser.add_argument('--execute-disposable', action='store_true'); parser.add_argument('--output', type=Path); args = parser.parse_args()
    if not args.execute_disposable:
        verify_inputs(); print(json.dumps({'runtime': 'NOT_RUN', 'demo': 'NOT_ADMITTED'})); return
    if args.output is None: parser.error('--output required')
    print(json.dumps(run(args.output, args.execute_disposable)))
if __name__ == '__main__': main()
