#!/usr/bin/env python3
"""Synthetic R3 review only. No DSN, external container, or production mode."""
import argparse
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import re
import signal
import uuid
import subprocess
import sys
import textwrap

ROOT = Path(__file__).resolve().parent
REPOSITORY = 'jfcaicedoobando-arch/elogistix'
OWNER = 'jfcaicedoobando-arch'
BRANCH = 'fix/seed-r3-ledger-review-20261015'
BASE = 'c935c2593dfd725edb3c30dcab9bd6f0439ff71b'
IMAGE = 'postgres@sha256:f3bd19c606e442c3d7bdfa8002e03fe260a1023351e0ea4598032022b68dd6e3'
HASHES = {
    'ledger_cases.py': 'fde97d0a84ea5d9d4f7b9ac87c95f217c03849b95c1b697ae3c82bed0cac5f9f',
    'test_ledger_cases.py': '2fc9c008856c9d7bec0b0b524b960f746c4468d1f3e04b0cdba07363290526b2',
    'render_lab_candidate.py': '8db9ae16f23fc337811dcb520512d01bc90c815a420523ff6cec9a36a4a36836',
    'test_renderer_security.py': '8e759a81900df0217916a116aeda731a0ed0928bd6c9b5b2140d54ee5b4db0a1',
    'PROPOSAL_R3_manual_ledger_wrapper.sql': '23a7795c62fa4cac04f8a2e1b804763e18b3f0af1983dd38a29a337958ee3f4e',
    'PROPOSAL_ledger_metadata_readonly.sql': '865dbed17e07bbd6bf9615938e3cf8c6383dbca849350a8854b4fec605f1f449',
    'expected-drizzle-preimage.json': '11ecc9142e3a3d79be4f05b5b0b0b230251bcaf8b303c233305873cfc7cf5b98',

    'terminal_calls.py': 'ef2e686b8794890e0751a06ab8e09929c34407c2d4f1d9c0f4ddf4abc18ad7a5',
    'test_terminal_calls.py': '046b4165e724da6aa67c4f2fc6c6c2b4dd7eeae6713cf1075a0b50d2c3c9f117',

    'concurrency_cases.py': '6fa9de94b8f482a94213c0d55bef012a8f8c54b1ee4f38f724c52c51cac6e373',
    'test_concurrency_controls.py': '1b0276bd89920e2d110a7efd9131d574393ac543ebdec712c339691041f7d00a',
    'run_isolated.py': '93ac69a3d0ae3cccbb9587ffdf07ba5751b99928d5a0ff8a4e747162731fa9f9',
    'PROPOSAL_R3_rename_lock_admission.sql': '7f054e3071b243ca6ada6359028c66efa0ac2ba5047a8cf7133f70f1b7924d86',
    'snapshot.sql': '8214954821e88579ff76d10979b296edc6d5c47870c22e6e2c27e01df9e67fb0',
    'fixtures/R2.sql': '6be74b6205202a3288c654e055081fb088556ba2750f539a0e6a677bc34a19a4',
    'fixtures/TEST_ONLY_initial_functions.sql': '7e1169e7a0aa999d6469c2d8c68ba2d448163b19d7a882c89a3f677083b62f1d',
    'fixtures/dependencies.sql': '2adf086685863db5b86f62d7a3d1dd22c5344806687de47410c1aff538c5a7f8',
    'fixtures/event_drift.sql': 'da545e97acee5fb41504cf134af35e6d051487bb9cd389a948493c6267db0f09',
}

def require(condition, message):
    if not condition:
        raise RuntimeError(message)


def gate(event, env, head):
    p = event['pull_request']
    require(env.get('GITHUB_EVENT_NAME') == 'pull_request', 'PR event required')
    require(event['action'] in ('opened', 'synchronize', 'reopened'), 'Unsupported PR action')
    require(env.get('GITHUB_REPOSITORY') == REPOSITORY, 'Repository mismatch')
    require(event['repository']['full_name'] == REPOSITORY, 'Event repository mismatch')
    for side in ('base', 'head'):
        require(p[side]['repo']['full_name'] == REPOSITORY, 'Fork/repository rejected')
        require(p[side]['repo']['owner']['login'] == OWNER, 'Owner mismatch')
    require(p['base']['ref'] == 'main' and p['base']['sha'] == BASE, 'Base changed: review required')
    require(p['head']['ref'] == BRANCH, 'Head branch mismatch')
    require(p['draft'] is True, 'Draft PR required')
    require(re.fullmatch('[0-9a-f]{40}', p['head']['sha']) and head == p['head']['sha'], 'Checkout SHA mismatch')
    return p['head']['sha']


def verify_sources(root=ROOT):
    for name, expected in HASHES.items():
        path = root / name
        require(path.is_file() and not path.is_symlink() and path.resolve().is_relative_to(root.resolve()), 'Unsafe input path: ' + name)
        require(hashlib.sha256(path.read_bytes()).hexdigest() == expected, 'Input hash changed: ' + name)
    source = (root / 'run_isolated.py').read_text()
    start = source.index('        query("CREATE ROLE postgres')
    end = source.index("        result['status']='checks_pass_cleanup_pending';save()", start)
    reference = textwrap.dedent(source[start:end]).rstrip()
    adapter = Path(__file__).read_text().split('# BEGIN UNCHANGED MATRIX\n', 1)[1].split('# END UNCHANGED MATRIX', 1)[0]
    require(textwrap.dedent(adapter).rstrip() == reference, 'Regression matrix differs from reviewed source')


class Runner:
    def __init__(self, output, run_id):
        self.output = output
        self.run_id = run_id
        self.name = 'seed-r3-' + run_id
        self.cid = None
        self.token = uuid.uuid4().hex
        self.image_id = None
        self.counter = 0
        self.sessions = []
        self.env = {'PATH': '/usr/bin:/bin', 'LANG': 'C', 'HOME': str(output),
                    'DOCKER_CONFIG': str(output / 'docker-config'),
                    'DOCKER_HOST': 'unix:///var/run/docker.sock'}
        self.result = {'status': 'running', 'checks': [], 'historical_seed_invocations': 0,
                       'concurrency_two_sessions': 'NOT_RUN', 'terminal_direct_calls': 'NOT_RUN', 'ledger_cases': 'NOT_RUN', 'cleanup': 'pending'}

    def save(self):
        (self.output / 'result.json').write_text(json.dumps(self.result, indent=2) + '\n')

    def command(self, args, label, source=None, expected=0, timeout=60):
        self.counter += 1
        prefix = self.output / 'logs' / f'{self.counter:03d}-{label}'
        if source is not None:
            prefix.with_suffix('.sql').write_text(source)
        try:
            p = subprocess.run(args, input=source, text=True, capture_output=True, env=self.env, timeout=timeout)
        except subprocess.TimeoutExpired as exc:
            def string(value):
                return value.decode(errors='replace') if isinstance(value, bytes) else value or ''
            prefix.with_suffix('.stdout').write_text(string(exc.stdout))
            prefix.with_suffix('.stderr').write_text(string(exc.stderr))
            prefix.with_suffix('.timeout.json').write_text(json.dumps({'timeout': timeout, 'command': args}))
            raise
        prefix.with_suffix('.stdout').write_text(p.stdout)
        prefix.with_suffix('.stderr').write_text(p.stderr)
        if expected is not None:
            require(p.returncode == expected, f'{label}: exit {p.returncode}: {p.stderr}')
        return p

    def docker(self, args, label, **kwargs):
        return self.command(['docker'] + args, label, **kwargs)

    def inside(self, args, label, **kwargs):
        require(self.cid is not None, 'No owned container')
        return self.docker(['exec', '-i', self.cid] + args, label, **kwargs)

    def query(self, sql, label, db='postgres', user='postgres', expected=0):
        response = self.inside(['psql', '-X', '-w', '-qAt', '-h', '/tmp/r3/socket', '-p', '5432',
                            '-U', user, '-d', db, '-v', 'ON_ERROR_STOP=1', '-v', 'VERBOSITY=verbose'],
                           label, source=sql, expected=expected)
        if expected == 3:
            primary = re.findall(r'^ERROR:\s+([0-9A-Z]{5}): (.*)$', response.stderr, re.M)
            require(len(primary) == 1, 'Missing or ambiguous primary SQL error: ' + label)
            if label.startswith('admission-'):
                require(primary[0][0] == 'P0001', 'Unexpected admission SQLSTATE')
            elif label.startswith('stopped-'):
                require(primary[0] == ('55000', 'LC_SEED_DEMO_CONSERVACION_PENDIENTE: reseed bloqueado hasta verificar conservación y adopción'), 'Unexpected stopped primary error')
        return response

    def psqlctl(self, db, label):
        """Open a tracked persistent client only in an owned synthetic database."""
        require(re.fullmatch(r'qa_r3_cc_[a-z_]+', db), 'Unsafe synthetic database name')
        require(re.fullmatch(r'cc-[a-z_]+-[ab]', label), 'Unsafe session label')
        info = self.inspect_owned()
        require(info['State']['Running'], 'Owned container is not running')
        context = json.loads(self.query("SELECT jsonb_build_object('version',current_setting('server_version_num'),'user',current_user,'session',session_user,'superuser',(SELECT rolsuper FROM pg_roles WHERE rolname=current_user),'admin_member',pg_has_role(current_user,'supabase_admin','MEMBER'),'listen',current_setting('listen_addresses'));", 'persistent-context-' + label, db).stdout)
        require(context == {'version': '170006', 'user': 'postgres', 'session': 'postgres',
                            'superuser': False, 'admin_member': False, 'listen': ''}, 'Persistent session context mismatch')
        # Merge at the psql descriptor before Docker multiplexes its streams.
        # This constant wrapper never interpolates SQL, names, or arguments.
        args = ['docker', 'exec', '-i', self.cid, 'sh', '-c', 'exec "$@" 2>&1', 'sh',
                'psql', '-X', '-w', '-qAt', '-h', '/tmp/r3/socket',
                '-p', '5432', '-U', 'postgres', '-d', db, '-v', 'ON_ERROR_STOP=0', '-v', 'VERBOSITY=verbose']
        # Defer Python interruption until registration; do not inherit a blocked
        # signal mask into docker exec (the child must remain terminable).
        pending_signals = []
        watched = (signal.SIGTERM, signal.SIGINT, signal.SIGALRM)
        previous_handlers = {sig: signal.getsignal(sig) for sig in watched}
        try:
            for sig in watched:
                signal.signal(sig, lambda number, frame: pending_signals.append(number))
            process = subprocess.Popen(args, stdin=subprocess.PIPE, stdout=subprocess.PIPE,
                                       stderr=subprocess.STDOUT, text=True, bufsize=1, shell=False, env=self.env)
            self.sessions.append(process)
        finally:
            for sig, handler in previous_handlers.items():
                signal.signal(sig, handler)
        require(not pending_signals, 'Interrupted during owned session creation')
        return process

    def close_sessions(self):
        """Reap only Popen objects registered by this runner, before cluster shutdown."""
        failures = []
        for process in reversed(self.sessions):
            try:
                if process.poll() is None:
                    process.terminate()
                    try:
                        process.wait(timeout=5)
                    except subprocess.TimeoutExpired:
                        process.kill()
                        process.wait(timeout=5)
                else:
                    process.wait(timeout=5)
                for stream in (process.stdin, process.stdout, process.stderr):
                    if stream is not None and not stream.closed:
                        stream.close()
            except BaseException as exc:
                failures.append(str(exc))
        self.result['owned_psql_clients_closed'] = not failures
        if failures:
            self.result.update(status='failed', session_cleanup_errors=failures)

    def snapshot(self, db, label):
        value = json.loads(self.query((ROOT / 'snapshot.sql').read_text(), label, db).stdout)
        (self.output / (label + '.json')).write_text(json.dumps(value, indent=2) + '\n')
        return value

    def check(self, name, **details):
        self.result['checks'].append({'case': name, 'status': 'pass', **details})
        self.save()

    def create_args(self):
        return ['create', '--cidfile', str(self.output / 'owned.cid'), '--name', self.name,
                '--label', 'io.elogistix.seed-r3=disposable-review', '--label', 'io.elogistix.run-id=' + self.run_id,
                '--label', 'io.elogistix.ownership-token=' + self.token,
                '--network', 'none', '--user', 'postgres', '--read-only', '--cap-drop', 'ALL',
                '--security-opt', 'no-new-privileges', '--cpus', '2', '--memory', '1g', '--pids-limit', '128',
                '--tmpfs', '/tmp:rw,nosuid,nodev,size=768m,mode=1777',
                '--tmpfs', '/var/lib/postgresql/data:rw,nosuid,nodev,noexec,size=1m,mode=0700',
                '--entrypoint', '/bin/sleep', IMAGE, 'infinity']

    def inspect_owned(self, recovered_cid=None):
        cidfile = self.output / 'owned.cid'
        if recovered_cid is None:
            require(cidfile.is_file() and not cidfile.is_symlink(), 'Missing owned cidfile')
            cid = cidfile.read_text().strip()
        else:
            cid = recovered_cid
        require(re.fullmatch('[0-9a-f]{64}', cid), 'Invalid owned container ID')
        info = json.loads(self.docker(['inspect', cid], 'inspect-owned').stdout)[0]
        labels = info['Config']['Labels']
        require(info['Id'] == cid and info['Name'] == '/' + self.name, 'Container identity mismatch')
        require(labels.get('io.elogistix.seed-r3') == 'disposable-review' and labels.get('io.elogistix.run-id') == self.run_id, 'Ownership labels mismatch')
        require(labels.get('io.elogistix.ownership-token') == self.token, 'Ownership token mismatch')
        require(info['Config']['Image'] == IMAGE and info['Image'] == self.image_id, 'Image identity mismatch')
        h = info['HostConfig']
        require(h['NetworkMode'] == 'none' and h['ReadonlyRootfs'] and not h['Privileged'], 'Isolation mismatch')
        require(info['Config']['User'] == 'postgres' and h['CapDrop'] == ['ALL'], 'User/capability mismatch')
        require('no-new-privileges' in h['SecurityOpt'] and not h.get('CapAdd'), 'Privilege mismatch')
        require(h['Memory'] == 1073741824 and h['NanoCpus'] == 2000000000 and h['PidsLimit'] == 128, 'Resource limits mismatch')
        require(not h.get('Binds') and not h.get('PortBindings') and not h.get('Devices') and not h.get('VolumesFrom'), 'Forbidden host attachment')
        require(set(h['Tmpfs']) == {'/tmp', '/var/lib/postgresql/data'}, 'Unexpected tmpfs')
        require(all(m['Type'] == 'tmpfs' and m['Destination'] in h['Tmpfs'] for m in info.get('Mounts', [])), 'Unexpected mount')
        self.cid = cid
        if recovered_cid is not None:
            with cidfile.open('x') as handle:
                handle.write(cid + '\n')
        return info

    def start(self):
        self.docker(['pull', IMAGE], 'pull-digest', timeout=120)
        image = json.loads(self.docker(['image', 'inspect', IMAGE], 'inspect-image').stdout)[0]
        require(IMAGE in image['RepoDigests'], 'Pulled digest mismatch')
        self.image_id = image['Id']
        (self.output / 'ownership.json').write_text(json.dumps({'run_id': self.run_id, 'image_id': self.image_id, 'token': self.token}))
        self.result['phase'] = 'create_attempted'; self.save()
        self.docker(self.create_args(), 'create-owned')
        self.inspect_owned()
        self.docker(['start', self.cid], 'start-owned')
        self.result['phase'] = 'initdb_attempted'; self.save()
        self.inside(['sh', '-ceu', 'mkdir -m 700 /tmp/r3; mkdir -m 700 /tmp/r3/socket; initdb -D /tmp/r3/data -U supabase_admin --auth-local=trust --auth-host=reject --no-locale --encoding=UTF8'], 'initdb')
        self.result['phase'] = 'cluster_start_attempted'; self.save()
        self.inside(['pg_ctl', '-D', '/tmp/r3/data', '-l', '/tmp/r3/server.log', '-o', '-h "" -k /tmp/r3/socket -p 5432 -F -c unix_socket_permissions=0700 -c shared_preload_libraries=', '-w', '-t', '20', 'start'], 'start-cluster')
        self.result['phase'] = 'cluster_started'; self.save()

    def cleanup(self):
        self.close_sessions()
        if not (self.output / 'owned.cid').exists():
            found = self.docker(['ps', '-a', '--no-trunc', '--filter', 'name=^/' + self.name + '$', '--format', '{{.ID}}'], 'recover-owned-container')
            ids = found.stdout.split()
            if not ids:
                self.result['cleanup'] = 'no_container_created'
                return
            require(len(ids) == 1, 'Ambiguous owned container recovery')
            # A name is only a candidate: validate token, labels, image and isolation before touching it.
            info = self.inspect_owned(recovered_cid=ids[0])
        else:
            info = self.inspect_owned()
        cluster_error = None
        if info['State']['Running']:
            try:
                self.inside(['sh', '-c', 'test ! -f /tmp/r3/server.log || cat /tmp/r3/server.log'], 'server-log', expected=None)
                status = self.inside(['pg_ctl', '-D', '/tmp/r3/data', 'status'], 'cleanup-status-before', expected=None)
                require(status.returncode in (0, 3), 'Cannot establish owned cluster state')
                if status.returncode == 0:
                    self.inside(['pg_ctl', '-D', '/tmp/r3/data', '-m', 'immediate', '-w', '-t', '20', 'stop'], 'cleanup-stop')
                self.inside(['pg_ctl', '-D', '/tmp/r3/data', 'status'], 'cleanup-status-after', expected=3)
                self.inside(['test', '!', '-f', '/tmp/r3/data/postmaster.pid'], 'cleanup-no-pid')
                self.result['pg_status_3_and_no_pid'] = True
            except BaseException as exc:
                cluster_error = str(exc)
                self.result.update(status='failed', pg_status_3_and_no_pid=False, cluster_cleanup_error=cluster_error)
            # A failed/partial initdb cannot justify leaving this strictly owned container alive.
            self.docker(['stop', '--time', '10', self.cid], 'stop-owned')
            stopped = self.inspect_owned()
            require(not stopped['State']['Running'], 'Owned container still running')
        else:
            self.result['cluster_status'] = 'container_already_stopped'
        self.docker(['rm', self.cid], 'remove-owned')
        remaining = self.docker(['ps', '-a', '--no-trunc', '--filter', 'id=' + self.cid, '--format', '{{.ID}}'], 'confirm-removed')
        require(not remaining.stdout.strip(), 'Container removal unconfirmed')
        self.result['cleanup'] = 'confirmed_removed_after_cluster_error' if cluster_error else 'confirmed_stopped_and_removed'
        self.result['shutdown_confirmed'] = True


def matrix(query, snap, check, result, sqls, digest, extract_hashes, logical, SIGS):
# BEGIN UNCHANGED MATRIX
    query("CREATE ROLE postgres LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role;GRANT CREATE ON DATABASE postgres TO postgres;GRANT USAGE,CREATE ON SCHEMA public TO postgres;",'roles',user='supabase_admin')
    context=json.loads(query("SELECT jsonb_build_object('version',current_setting('server_version_num'),'user',current_user,'session',session_user,'superuser',(SELECT rolsuper FROM pg_roles WHERE rolname=current_user),'select',has_table_privilege(current_user,'pg_proc','SELECT'),'write',has_table_privilege(current_user,'pg_proc','INSERT,UPDATE,DELETE,TRUNCATE,MAINTAIN'),'admin_member',pg_has_role(current_user,'supabase_admin','MEMBER'),'listen_addresses',current_setting('listen_addresses'));",'context').stdout)
    assert context=={'version':'170006','user':'postgres','session':'postgres','superuser':False,'select':True,'write':False,'admin_member':False,'listen_addresses':''},context
    result['context']=context
    query("CREATE SCHEMA auth;CREATE TYPE public.app_role AS ENUM('super_admin');CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$SELECT NULL::uuid$$;CREATE FUNCTION public.has_role(uuid,public.app_role) RETURNS boolean LANGUAGE sql AS $$SELECT false$$;",'minimal-inert-dependencies')
    query('SET check_function_bodies=off;'+(ROOT/'fixtures/TEST_ONLY_initial_functions.sql').read_text(),'install-historical-definitions-only')
    query((ROOT/'fixtures/dependencies.sql').read_text(),'dependency-fixtures')
    query((ROOT/'fixtures/event_drift.sql').read_text(),'admin-event-fixture',user='supabase_admin')
    historical=extract_hashes(sqls['R2'],'atomic_historical_hashes');stopped=extract_hashes(sqls['R2'],'atomic_stopped_hashes')
    def body_hashes(s):return {x['row']['proname']+('(bigint)' if x['row']['proname']=='seed_demo_organization_guarded' else '()'):digest(x['row']['prosrc']) for x in s['functions'] if x['row']['proname'] in [z.split('(')[0] for z in SIGS]}
    template=snap('postgres','template-historical')
    assert body_hashes(template)==historical
    control=template['control'][0]['row']
    targets=sorted([x['row'] for x in template['functions'] if x['row']['proname'] in [z.split('(')[0] for z in SIGS]],key=lambda x:x['oid'])
    assert len(targets)==4 and targets[0]['proname']=='seed_demo_organization_core',targets
    assert control['first_oid']==targets[0]['oid'] and control['last_oid']==targets[-1]['oid']
    assert control['tracked']==[x['oid'] for x in targets]
    assert control['renames']==0 and not control['armed'] and not control['fired']
    def clone(name):query('CREATE DATABASE '+name+' TEMPLATE postgres OWNER postgres;','clone-'+name,user='supabase_admin')
    for version in ('R2','R3'):
        for state in ('historical','terminal'):
            for mutation in ('cost','prosrc'):
                db=f'qa_{version.lower()}_{state}_{mutation}';clone(db)
                if state=='terminal':query(sqls['R3'],'establish-terminal-'+db,db)
                query("UPDATE qa_fixture.control SET armed=true,mutation='"+mutation+"';",'arm-'+db,db,user='supabase_admin')
                before=snap(db,'before-'+db)
                bug=(version=='R2' and state=='terminal')
                p=query(sqls[version],'admission-'+db,db,expected=0 if bug else 3)
                after=snap(db,'after-'+db)
                if bug:
                    assert after['control'][0]['row']['fired'] and after['control'][0]['row']['renames']==8
                    target=after['control'][0]['row']['first_oid']
                    row=next(x['row'] for x in after['functions'] if x['row']['oid']==target)
                    assert row['procost']==101 if mutation=='cost' else 'QA_EVENT_DRIFT_MARKER' in row['prosrc']
                    assert after!=before
                    check(db,expected_R2_defect_reproduced=True)
                else:
                    phase='admission_terminal' if state=='terminal' else 'admission_0'
                    first_oid=before['control'][0]['row']['first_oid']
                    first_name=next(x['row']['proname'] for x in before['functions'] if x['row']['oid']==first_oid)
                    signature=first_name+('(bigint)' if first_name=='seed_demo_organization_guarded' else '()')
                    expected_message='ATOMIC_DEMO_POSTCHECK_'+phase+': body or complete metadata drift for '+signature
                    # Exact primary ERROR + SQLSTATE; a string in CONTEXT cannot pass.
                    assert re.search(r'^ERROR:\s+P0001: '+re.escape(expected_message)+r'$',p.stderr,re.M),p.stderr
                    assert after==before,'Rollback must restore all snapshotted rows, xmin/ctid and event fixture state'
                    check(db,complete_rollback=True)
    db='qa_clean';clone(db)
    before=snap(db,'before-clean')
    query(sqls['R3'],'clean-historical-to-stopped',db)
    after=snap(db,'after-clean-transition');assert body_hashes(after)==stopped
    # Non-body fields and original OIDs/ACL must match for all four targets.
    def metadata(s):return [{k:v for k,v in x['row'].items() if k not in ('prosrc','proconfig')} for x in s['functions']]
    assert metadata(after)==metadata(before)
    for old,new in zip(before['functions'],after['functions']):
        name=old['row']['proname']
        expected_config=['search_path=public','row_security=off'] if name=='seed_demo_organization_guarded' else old['row']['proconfig']
        assert new['row']['proconfig']==expected_config,(name,'unexpected proconfig change')
        if name not in [z.split('(')[0] for z in SIGS]:assert new==old,('unrelated function changed',name)
    # Every observed non-function object, including rewrite/triggers, is unchanged.
    for section in before:
        if section!='functions': assert after[section]==before[section],('changed snapshot section',section)
    query(sqls['R3'],'clean-terminal-retry',db)
    retry=snap(db,'after-clean-retry');assert logical(retry)==logical(after)
    changed=[x['row']['proname'] for x,y in zip(after['functions'],retry['functions']) if (x['xmin'],x['ctid'])!=(y['xmin'],y['ctid'])]
    assert set(changed)==set(z.split('(')[0] for z in SIGS),changed
    check('clean historical transition and terminal retry',physical_tuple_versions_changed=changed,logical_metadata_preserved=True)
    dep=json.loads(query("SELECT jsonb_build_object('view_guard_dependency',EXISTS(SELECT 1 FROM pg_depend d JOIN pg_rewrite r ON d.classid='pg_rewrite'::regclass AND d.objid=r.oid WHERE r.ev_class='qa_owned.guard_view'::regclass AND d.refclassid='pg_proc'::regclass AND d.refobjid='public.seed_demo_organization_guarded(bigint)'::regprocedure),'trigger_bridge_dependency',EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid='qa_owned.bridge_target'::regclass AND tgfoid='qa_owned.guard_bridge()'::regprocedure));",'verify-oid-dependencies',db).stdout)
    assert all(dep.values()),dep
    # These invocations occur ONLY after verified stopped body hashes.
    for label,statement in [('view','SELECT * FROM qa_owned.guard_view;'),('bridge','INSERT INTO qa_owned.bridge_target VALUES(1);')]:
        p=query("SET request.jwt.claims='{\"role\":\"service_role\"}';"+statement,'stopped-'+label,db,expected=3)
        assert '55000: LC_SEED_DEMO_CONSERVACION_PENDIENTE' in p.stderr,p.stderr
    assert snap(db,'after-dependency-checks')==retry
    check('existing view OID and RETURNS trigger bridge fail closed after R3',**dep)
# END UNCHANGED MATRIX


def run_concurrency(runner):
    # The module is hash-gated before Docker starts; no implicit discovery/import.
    spec = importlib.util.spec_from_file_location('reviewed_concurrency_cases', ROOT / 'concurrency_cases.py')
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    module.run_concurrency(runner)
    return module


def run_terminal_calls(runner, controls):
    spec = importlib.util.spec_from_file_location('reviewed_terminal_calls', ROOT / 'terminal_calls.py')
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    module.run_terminal_calls(runner, controls)



def run_ledger_cases(runner, controls):
    # All these inputs must be added to HASHES after explicit review, before enabling runtime.
    for filename in ('ledger_cases.py', 'render_lab_candidate.py'):
        require(filename in HASHES, 'Ledger input has not been reviewed: ' + filename)
    spec = importlib.util.spec_from_file_location('reviewed_ledger_renderer', ROOT / 'render_lab_candidate.py')
    renderer = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = renderer
    spec.loader.exec_module(renderer)
    spec = importlib.util.spec_from_file_location('reviewed_ledger_cases', ROOT / 'ledger_cases.py')
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    module.run_ledger_cases(runner, controls, renderer)
    require(runner.result.get('ledger_cases') == 'checks_pass_cleanup_pending', 'Ledger cases incomplete')
    return module


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--cleanup-only', action='store_true')
    args = parser.parse_args()
    require(sys.flags.optimize == 0, 'Python optimization would disable matrix assertions')
    event = json.loads(Path(os.environ['GITHUB_EVENT_PATH']).read_text())
    head = subprocess.check_output(['git', 'rev-parse', 'HEAD'], text=True).strip()
    sha = gate(event, os.environ, head)
    verify_sources()
    run_id = os.environ['GITHUB_RUN_ID'] + '-' + os.environ['GITHUB_RUN_ATTEMPT'] + '-' + sha[:12]
    require(re.fullmatch(r'[0-9]+-[0-9]+-[0-9a-f]{12}', run_id), 'Invalid run identity')
    output = Path(os.environ['RUNNER_TEMP']).resolve() / ('seed-r3-' + run_id)
    runner = Runner(output, run_id)
    if args.cleanup_only:
        if not output.exists():
            return
        ownership = output / 'ownership.json'
        if ownership.exists():
            state = json.loads(ownership.read_text())
            require(state['run_id'] == run_id, 'Saved ownership mismatch')
            runner.image_id = state['image_id']
            runner.token = state['token']
        if (output / 'result.json').exists():
            runner.result = json.loads((output / 'result.json').read_text())
        # Successful prior cleanup is checked again; never upgrades failed tests to pass.
        if runner.result.get('cleanup') in ('confirmed_stopped_and_removed', 'confirmed_removed_after_cluster_error'):
            require(not runner.docker(['ps', '-a', '--no-trunc', '--filter', 'name=^/' + runner.name + '$', '--format', '{{.ID}}'], 'external-confirm-removed').stdout.strip(), 'Unexpected owned container remains')
            return
        try:
            runner.cleanup()
        except BaseException as exc:
            runner.result.update(status='failed', cleanup='failed', cleanup_error=str(exc))
            raise
        finally:
            runner.save()
        return
    output.mkdir(mode=0o700, exist_ok=False)
    (output / 'logs').mkdir()
    (output / 'docker-config').mkdir(mode=0o700)
    runner.save()
    def interrupted(signum, frame):
        raise RuntimeError('Interrupted or total runtime exceeded: ' + str(signum))
    signal.signal(signal.SIGTERM, interrupted)
    signal.signal(signal.SIGINT, interrupted)
    signal.signal(signal.SIGALRM, interrupted)
    signal.alarm(540)
    passed = False
    ledger_module = None
    try:
        runner.start()
        spec = importlib.util.spec_from_file_location('reviewed_matrix_helpers', ROOT / 'run_isolated.py')
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        matrix(runner.query, runner.snapshot, runner.check, runner.result,
               {'R2': (ROOT / 'fixtures/R2.sql').read_text(), 'R3': (ROOT / 'PROPOSAL_R3_rename_lock_admission.sql').read_text()},
               module.digest, module.extract_hashes, module.logical, module.SIGS)
        controls = run_concurrency(runner)
        require(runner.result.get('concurrency_two_sessions') == 'PASS', 'Concurrency cases incomplete')
        run_terminal_calls(runner, controls)
        require(runner.result.get('terminal_direct_calls') == 'PASS', 'Terminal direct calls incomplete')
        ledger_module = run_ledger_cases(runner, controls)
        runner.result['status'] = 'checks_pass_cleanup_pending'
        passed = True
    except BaseException as exc:
        runner.result.update(status='failed', error=str(exc))
        if runner.result.get('concurrency_two_sessions') == 'RUNNING':
            runner.result['concurrency_two_sessions'] = 'FAILED'
        if runner.result.get('terminal_direct_calls') == 'RUNNING':
            runner.result['terminal_direct_calls'] = 'FAILED'
        if runner.result.get('ledger_cases') == 'RUNNING':
            runner.result['ledger_cases'] = 'FAILED'
    finally:
        signal.alarm(0)
        runner.save()
        try:
            runner.cleanup()
        except BaseException as exc:
            passed = False
            runner.result.update(status='failed', cleanup='failed', cleanup_error=str(exc))
        passed = (passed and runner.result.get('pg_status_3_and_no_pid') is True
                  and runner.result.get('owned_psql_clients_closed') is True)
        if passed:
            try:
                require(ledger_module is not None, 'Ledger finalizer missing')
                ledger_module.finalize_ledger_result(runner.result)
                require(runner.result.get('ledger_cases') == 'PASS', 'Ledger finalization incomplete')
            except BaseException as exc:
                passed = False
                runner.result.update(ledger_cases='FAILED', error=str(exc))
        elif runner.result.get('ledger_cases') == 'checks_pass_cleanup_pending':
            runner.result['ledger_cases'] = 'FAILED'
        runner.result['status'] = 'pass' if passed else 'failed'
        runner.save()
    require(passed, 'Review regression failed; inspect result.json and logs')
    print(json.dumps(runner.result, indent=2))


if __name__ == '__main__':
    main()
