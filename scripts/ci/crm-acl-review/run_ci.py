#!/usr/bin/env python3
"""Synthetic CRM ACL review only. No DSN, external container, or production mode."""
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
BRANCH = 'fix/crm-helper-acl-review-20261015'
BASE = '70a55d4e29784fb1a78ed74f164473153bead704'
IMAGE = 'postgres@sha256:f3bd19c606e442c3d7bdfa8002e03fe260a1023351e0ea4598032022b68dd6e3'
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


class Runner:
    def __init__(self, output, run_id):
        self.output = output
        self.run_id = run_id
        self.name = 'crm-acl-' + run_id
        self.cid = None
        self.token = uuid.uuid4().hex
        self.image_id = None
        self.counter = 0
        self.sessions = []
        self.env = {'PATH': '/usr/bin:/bin', 'LANG': 'C', 'HOME': str(output),
                    'DOCKER_CONFIG': str(output / 'docker-config'),
                    'DOCKER_HOST': 'unix:///var/run/docker.sock'}
        self.result = {'status': 'running', 'checks': [], 'live_database_actions': 0,
                       'concurrency_two_sessions': 'NOT_RUN', 'cleanup': 'pending'}

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
            require(p.returncode == expected, f'{label}: exit {p.returncode}: {p.stdout} {p.stderr}')
        return p

    def docker(self, args, label, **kwargs):
        return self.command(['docker'] + args, label, **kwargs)

    def inside(self, args, label, **kwargs):
        require(self.cid is not None, 'No owned container')
        return self.docker(['exec', '-i', self.cid] + args, label, **kwargs)

    def query(self, sql, label, db='postgres', user='postgres', expected=0):
        response = self.inside(['sh', '-c', 'exec "$@" 2>&1', 'sh', 'psql', '-X', '-w', '-qAt', '-h', '/tmp/crm/socket', '-p', '5432',
                            '-U', user, '-d', db, '-v', 'ON_ERROR_STOP=1', '-v', 'VERBOSITY=verbose'],
                           label, source=sql, expected=expected)
        if expected == 3:
            require(re.search(r'^ERROR:\s+[0-9A-Z]{5}:', response.stdout, re.M), 'Missing SQLSTATE: '+label)
        return response

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
                '--label', 'io.elogistix.crm-acl=disposable-review', '--label', 'io.elogistix.run-id=' + self.run_id,
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
        require(labels.get('io.elogistix.crm-acl') == 'disposable-review' and labels.get('io.elogistix.run-id') == self.run_id, 'Ownership labels mismatch')
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
        self.inside(['sh', '-ceu', 'mkdir -m 700 /tmp/crm; mkdir -m 700 /tmp/crm/socket; initdb -D /tmp/crm/data -U supabase_admin --auth-local=trust --auth-host=reject --no-locale --encoding=UTF8'], 'initdb')
        self.result['phase'] = 'cluster_start_attempted'; self.save()
        self.inside(['pg_ctl', '-D', '/tmp/crm/data', '-l', '/tmp/crm/server.log', '-o', '-h "" -k /tmp/crm/socket -p 5432 -F -c unix_socket_permissions=0700 -c shared_preload_libraries=', '-w', '-t', '20', 'start'], 'start-cluster')
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
                self.inside(['sh', '-c', 'test ! -f /tmp/crm/server.log || cat /tmp/crm/server.log'], 'server-log', expected=None)
                status = self.inside(['pg_ctl', '-D', '/tmp/crm/data', 'status'], 'cleanup-status-before', expected=None)
                require(status.returncode in (0, 3), 'Cannot establish owned cluster state')
                if status.returncode == 0:
                    self.inside(['pg_ctl', '-D', '/tmp/crm/data', '-m', 'immediate', '-w', '-t', '20', 'stop'], 'cleanup-stop')
                self.inside(['pg_ctl', '-D', '/tmp/crm/data', 'status'], 'cleanup-status-after', expected=3)
                self.inside(['test', '!', '-f', '/tmp/crm/data/postmaster.pid'], 'cleanup-no-pid')
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


class CRMRunner(Runner):
    def psql_args(self,db,user='postgres',stop='1'):
        require(re.fullmatch(r'(postgres|crm_acl_fixture_[a-z0-9_]+)',db),'Unsafe fixture DB')
        require(user in ('postgres','supabase_admin','authenticated','service_role'),'Unsafe role')
        return ['docker','exec','-i',self.cid,'sh','-c','exec "$@" 2>&1','sh','psql','-X','-w','-qAt','-h','/tmp/crm/socket','-p','5432','-U',user,'-d',db,'-v','ON_ERROR_STOP='+stop,'-v','VERBOSITY=verbose']

    def session(self,sql,label,db,user='postgres'):
        self.inspect_owned()
        pending=[]
        watched=(signal.SIGTERM,signal.SIGINT)
        previous={sig:signal.getsignal(sig) for sig in watched}
        try:
            for sig in watched:signal.signal(sig,lambda number,frame:pending.append(number))
            p=subprocess.Popen(self.psql_args(db,user=user),stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True,bufsize=1,env=self.env)
            self.sessions.append(p)
        finally:
            for sig,handler in previous.items():signal.signal(sig,handler)
        require(not pending,'Interrupted while registering owned client')
        (self.output/'logs'/(label+'.sql')).write_text(sql)
        self.release(p,sql)
        return p

    def release(self,p,sql):
        require(p in self.sessions,'Unowned session')
        p.stdin.write(sql+'\n');p.stdin.flush()

    def finish_session(self,p,label,expected=0):
        require(p in self.sessions,'Unowned session')
        p.stdin.close();p.stdin=None
        try:out,_=p.communicate(timeout=40)
        except subprocess.TimeoutExpired:
            p.kill();out,_=p.communicate(timeout=10)
            (self.output/'logs'/(label+'.stdout')).write_text(out)
            raise
        (self.output/'logs'/(label+'.stdout')).write_text(out)
        result=subprocess.CompletedProcess(p.args,p.returncode,out,'')
        if expected is not None:require(result.returncode==expected,label+': '+out)
        return result

    def wait_lock(self,app,db):
        import time
        require(re.fullmatch(r'[a-zA-Z0-9_-]+',app),'Unsafe app')
        deadline=time.monotonic()+10
        while time.monotonic()<deadline:
            row=json.loads(self.query("SELECT coalesce(jsonb_agg(jsonb_build_object('pid',a.pid,'wait_event_type',a.wait_event_type,'wait_event',a.wait_event,'locks',(SELECT jsonb_agg(to_jsonb(l)) FROM pg_locks l WHERE l.pid=a.pid))),'[]') FROM pg_stat_activity a WHERE application_name='"+app+"';",'observe-'+app,db,user='supabase_admin').stdout)
            if any(x['wait_event_type']=='Lock' for x in row):return row
            time.sleep(.03)
        raise RuntimeError('Actual lock wait not observed: '+app)

    def clone(self,name):
        require(re.fullmatch(r'[a-z0-9_]+',name),'Unsafe clone name')
        db='crm_acl_fixture_'+name
        self.query('CREATE DATABASE '+db+' TEMPLATE crm_acl_fixture_template OWNER postgres;','clone-'+name,user='supabase_admin')
        return db

    def prepare(self):
        from adapter import fixture_sql,bind_candidate
        self.query('CREATE ROLE postgres LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;CREATE ROLE anon NOLOGIN;CREATE ROLE authenticated NOLOGIN;CREATE ROLE service_role NOLOGIN;CREATE ROLE synthetic_other NOLOGIN;CREATE DATABASE crm_acl_fixture_template OWNER postgres;','roles',user='supabase_admin')
        context=json.loads(self.query("SELECT jsonb_build_object('version',current_setting('server_version_num'),'user',current_user,'superuser',(SELECT rolsuper FROM pg_roles WHERE rolname=current_user),'admin_member',pg_has_role(current_user,'supabase_admin','MEMBER'),'listen',current_setting('listen_addresses'),'catalog_write',has_table_privilege(current_user,'pg_proc','INSERT,UPDATE,DELETE,TRUNCATE'));",'context','crm_acl_fixture_template').stdout)
        require(context=={'version':'170006','user':'postgres','superuser':False,'admin_member':False,'listen':'','catalog_write':False},'Context mismatch: '+str(context))
        self.result['context']=context
        self.query(fixture_sql(),'fixture-stdin','crm_acl_fixture_template')
        contract=json.loads(self.query((ROOT/'inputs/export_contract.sql').read_text(),'fixture-export','crm_acl_fixture_template').stdout)
        self.candidate=bind_candidate(contract)
        (self.output/'fixture-contract.json').write_text(json.dumps(contract,indent=2)+'\n')
        (self.output/'fixture-bound-candidate.sql').write_text(self.candidate)
        self.result['fixture_bound_sha256']=hashlib.sha256(self.candidate.encode()).hexdigest()
        self.result['sanitized_template_sha256']=hashlib.sha256((ROOT/'inputs/proposed-owner-only.sql').read_bytes()).hexdigest()
        self.result['fixture_sha256']=hashlib.sha256((ROOT/'inputs/fixture.sql').read_bytes()).hexdigest()
        self.result['postgres_version']=self.query('SELECT version();','version','crm_acl_fixture_template').stdout.strip()
        self.save()


def main():
    from adapter import verify_inputs
    from cases import run_cases
    from concurrency_cases import run_concurrency_cases
    ap=argparse.ArgumentParser(description='CI-only synthetic CRM ACL checks, no DSN or external container accepted')
    ap.add_argument('--output',type=Path,required=True)
    a=ap.parse_args()
    require(os.environ.get('GITHUB_ACTIONS')=='true','GitHub Actions only; no local SQL/Docker execution')
    event=json.loads(Path(os.environ['GITHUB_EVENT_PATH']).read_text())
    head=subprocess.run(['git','rev-parse','HEAD'],check=True,text=True,capture_output=True).stdout.strip()
    commit=gate(event,os.environ,head)
    manifest=verify_inputs()
    a.output.mkdir(parents=True,exist_ok=False);(a.output/'logs').mkdir()
    r=CRMRunner(a.output,uuid.uuid4().hex)
    r.result.update(source_commit=BASE,workflow_commit=commit,run_url='https://github.com/'+REPOSITORY+'/actions/runs/'+os.environ['GITHUB_RUN_ID'],input_manifest=manifest,limits=['Synthetic fixture only; no production application','No permanent DDL freeze or broad future-dependency exclusion','Full catalog coverage limited to named snapshot sections; no physical xmin/ctid invariant'])
    def interrupted(number,frame):raise RuntimeError('Interrupted by signal '+str(number))
    for sig in (signal.SIGTERM,signal.SIGINT):signal.signal(sig,interrupted)
    r.save()
    try:
        r.start();r.prepare();run_cases(r);run_concurrency_cases(r)
        names=[item['case'] for item in r.result['checks']]
        require(len(names)==98 and len(set(names))==98,'Incomplete or duplicate named case matrix')
        require(all(item['status']=='pass' or (item['status']=='observed_limit' and item['case'].startswith('f2-')) for item in r.result['checks']),'Unexpected case status')
        r.result['concurrency_two_sessions']='pass'
        r.result['status']='checks_pass_cleanup_pending';r.save()
    except BaseException as exc:
        r.result.update(status='failed',error=str(exc));r.save();raise
    finally:
        try:r.cleanup()
        except BaseException as exc:r.result.update(status='failed',cleanup='failed',cleanup_error=str(exc));raise
        finally:r.save()
    require(r.result['status']=='checks_pass_cleanup_pending','Tests or cleanup failed')
    require(r.result['cleanup']=='confirmed_stopped_and_removed','Cleanup not complete')
    r.result['status']='pass';r.save();print(json.dumps(r.result,indent=2))

if __name__=='__main__':main()
