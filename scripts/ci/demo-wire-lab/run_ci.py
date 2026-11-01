#!/usr/bin/env python3
"""Actions-only physical Unix-socket lab; no operational configuration or DSN."""
import argparse
import hashlib
import importlib.util
import io
import json
import os
from pathlib import Path
import re
import signal
import subprocess
import sys
import tarfile
import uuid

from stage import LIBATOMIC_FILES


ROOT = Path(__file__).resolve().parents[3]
REPOSITORY = 'jfcaicedoobando-arch/elogistix'
OWNER = 'jfcaicedoobando-arch'
BRANCH = 'codex/physical-wire-main-20261015'
BASE_REF = 'main'
BASE = 'd1de16b7cafda5f739511cf7cfef645a7733651a'
PERSISTENCE = ROOT / 'scripts/ci/demo-persistence-review/run_ci.py'
PERSISTENCE_SHA256 = '09cf6d2035b14005006b656649cf2e3f5f99322eb6776f80927586c522c204fe'
SYNTHETIC_FIXTURE = Path(__file__).resolve().parent / 'synthetic_fixture.sql'
CONTAINER_ROOT = '/tmp/crm/wire-lab'
NODE_VERSION = 'v26.13.0'
BASE_TMPFS = '/tmp:rw,nosuid,nodev,size=768m,mode=1777'
EXEC_TMPFS = '/tmp:rw,nosuid,nodev,exec,size=768m,mode=1777'
EXPECTED_TMPFS = {'/tmp': EXEC_TMPFS.split(':', 1)[1],
                  '/var/lib/postgresql/data': 'rw,nosuid,nodev,noexec,size=1m,mode=0700'}
SHARED_LIBRARY = re.compile(r'(?<![A-Za-z0-9_+.-])(lib[A-Za-z0-9_+.-]{0,64}\.so(?:\.[0-9]{1,5}){0,4})(?![A-Za-z0-9_+.-])')
MAX_TAR_BYTES = 256 * 1024 * 1024
MAX_EXPANDED_BYTES = 256 * 1024 * 1024
MAX_MEMBERS = 2000
RUNTIME_CASES = ('empty_config_zero_transport', 'claim_commit_then_business_same_socket', 'duplicate_sealed',
                 'missing_dispatch_sealed', 'business_sql_error_claim_retained', 'claim_commit_ack_uncertain',
                 'business_commit_ack_uncertain', 'close_after_claim_no_business', 'sql_error_terminal_no_replay')
PRIVATE_PREFIX = 'lib' + 'file' + '_'
PROFILE_PATH = re.compile(r'(?i)(?:[a-z]:[\\/]+users[\\/]+|/(?:users|home)/)')


def require(ok, message):
    if not ok:
        raise RuntimeError(message)


def gate(event, env, head):
    require(env.get('GITHUB_ACTIONS') == 'true', 'GitHub Actions only')
    require(env.get('GITHUB_EVENT_NAME') == 'pull_request', 'PR event required')
    require(env.get('GITHUB_REPOSITORY') == REPOSITORY, 'Repository mismatch')
    require(event['action'] in ('opened', 'synchronize', 'reopened'), 'Unsupported PR action')
    require(event['repository']['full_name'] == REPOSITORY, 'Event repository mismatch')
    pr = event['pull_request']
    for side in ('head', 'base'):
        require(pr[side]['repo']['full_name'] == REPOSITORY
                and pr[side]['repo']['owner']['login'] == OWNER, 'Foreign repository or owner')
    require(pr['draft'] is True, 'Draft PR required')
    require(pr['base']['ref'] == BASE_REF and pr['base']['sha'] == BASE, 'Exact main base required')
    require(pr['head']['ref'] == BRANCH, 'Head branch mismatch')
    require(re.fullmatch(r'[0-9a-f]{40}', head) and head == pr['head']['sha'], 'Checkout SHA mismatch')
    return head


def load_persistence():
    require(hashlib.sha256(PERSISTENCE.read_bytes()).hexdigest() == PERSISTENCE_SHA256,
            'Pinned persistence runner changed')
    # Import the existing runner once; its Actions entry point is never invoked.
    sys.path.insert(0, str(PERSISTENCE.parent))
    spec = importlib.util.spec_from_file_location('physical_wire_persistence_runner', PERSISTENCE)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def public_payload(value, ownership_token=None):
    encoded = json.dumps(value, ensure_ascii=True)
    require(PRIVATE_PREFIX not in encoded and not PROFILE_PATH.search(encoded), 'Private metadata in public evidence')
    require(not ownership_token or ownership_token not in encoded, 'Ownership token in public evidence')
    forbidden = {'secretkey', 'password', 'connectionstring', 'dsn', 'ownershiptoken', 'ownership_token', 'hostpath'}
    def inspect(item):
        if isinstance(item, dict):
            require(not any(str(key).lower() in forbidden for key in item), 'Sensitive evidence field refused')
            for child in item.values():
                inspect(child)
        elif isinstance(item, list):
            for child in item:
                inspect(child)
    inspect(value)
    return value


def validate_tar(data):
    require(isinstance(data, bytes) and len(data) <= MAX_TAR_BYTES, 'Runtime archive size exceeded')
    files, names, size = {}, set(), 0
    with tarfile.open(fileobj=io.BytesIO(data), mode='r:*') as archive:
        members = archive.getmembers()
        require(len(members) <= MAX_MEMBERS, 'Too many runtime archive members')
        for member in members:
            name = member.name[:-1] if member.isdir() and member.name.endswith('/') else member.name
            require(name and not name.startswith('/') and not any(c in name for c in ('\\', ':', '\x00', '\n', '\r'))
                    and all(part not in ('', '.', '..') for part in name.split('/')), 'Unsafe runtime member')
            require(name.casefold() not in names, 'Duplicate runtime archive member')
            names.add(name.casefold())
            require(member.isdir() or member.isreg(), 'Runtime archive links/devices refused')
            require(not member.mode & 0o7000, 'Runtime archive special mode refused')
            if name.casefold() == 'lib':
                require(name == 'lib' and member.isdir(), 'Native library directory required')
            elif name.casefold().startswith('lib/'):
                require(name in LIBATOMIC_FILES and member.isreg() and member.mode == 0o644,
                        'Unexpected runtime native library file')
            if member.isdir():
                continue
            size += member.size
            require(size <= MAX_EXPANDED_BYTES, 'Expanded runtime archive size exceeded')
            if name == 'node':
                require(member.mode & 0o111, 'Node binary is not executable')
            payload = archive.extractfile(member).read()
            require(len(payload) == member.size, 'Truncated runtime member')
            files[name] = hashlib.sha256(payload).hexdigest()
            if name in LIBATOMIC_FILES:
                require(files[name] == LIBATOMIC_FILES[name], 'Runtime native library hash mismatch')
    require({'node', 'lab_wire.mjs', 'runtime.mjs'} <= set(files), 'Incomplete runtime archive')
    require(set(LIBATOMIC_FILES) <= set(files), 'Missing pinned Node native library or copyright')
    require(any(name.startswith('deps/node_modules/pg/') for name in files)
            and any(name.startswith('source/') for name in files), 'Missing pg or original source files')
    return {'tar_sha256': hashlib.sha256(data).hexdigest(), 'expanded_bytes': size, 'files': files}


def node_command(*arguments):
    # Only the owned Node process receives this path. Docker and PostgreSQL keep
    # their existing environments and the container image remains unchanged.
    return ['/usr/bin/env', '-i', 'PATH=/usr/bin:/bin', 'LANG=C', 'GITHUB_ACTIONS=true',
            'HOME=' + CONTAINER_ROOT, 'LD_LIBRARY_PATH=' + CONTAINER_ROOT + '/lib',
            CONTAINER_ROOT + '/node', *arguments]


def runtime_report(stdout):
    # A single JSON document is the complete protocol. Incidental logging fails closed.
    value = json.loads(stdout)
    require(isinstance(value, dict), 'Runtime report must be an object')
    public_payload(value)
    require(value.get('status') == 'PASS_SYNTHETIC_ONLY', 'Physical wire cases did not pass')
    require(value.get('scope') == 'SYNTHETIC', 'Synthetic runtime scope required')
    require(value.get('operationalWire') == 'UNBOUND', 'Operational wire must remain UNBOUND')
    require(isinstance(value.get('physicalWire'), dict) and value['physicalWire'], 'Physical wire evidence absent')
    require(isinstance(value.get('cases'), list) and value['cases'], 'Runtime case matrix absent')
    names = []
    for case in value['cases']:
        require(isinstance(case, dict) and re.fullmatch(r'[a-z0-9_-]+', case.get('case', ''))
                and case.get('status') == 'PASS', 'Invalid or failed runtime case')
        names.append(case['case'])
    require(len(names) == len(set(names)), 'Duplicate runtime cases')
    require(names == list(RUNTIME_CASES), 'Incomplete or reordered physical runtime case matrix')
    require(isinstance(value.get('timeline'), list) and value['timeline'], 'Physical wire timeline absent')
    return value


def runtime_failure_report(stdout):
    """Accept only the explicit safe failure protocol, never raw error text."""
    try:
        value = json.loads(stdout)
    except ValueError:
        return None
    if not isinstance(value, dict) or value.get('status') != 'FAIL_SYNTHETIC_ONLY':
        return None
    require(set(value) == {'status', 'scope', 'cases', 'timeline', 'physicalWire', 'operationalWire', 'failure'},
            'Unknown runtime failure field')
    public_payload(value)
    require(value['scope'] == 'SYNTHETIC' and value['operationalWire'] == 'UNBOUND',
            'Unsafe runtime failure scope')
    failure = value['failure']
    require(isinstance(failure, dict) and set(failure) == {'case', 'code'}
            and isinstance(failure['case'], str) and re.fullmatch(r'[a-z0-9_-]{1,96}', failure['case'])
            and isinstance(failure['code'], str) and re.fullmatch(r'[A-Za-z0-9_-]{1,96}', failure['code']),
            'Invalid runtime failure identifier')
    require(isinstance(value['cases'], list) and isinstance(value['timeline'], list)
            and isinstance(value['physicalWire'], dict), 'Invalid runtime failure evidence shape')
    names = []
    for case in value['cases']:
        require(isinstance(case, dict) and isinstance(case.get('case'), str)
                and case.get('status') == 'PASS', 'Invalid completed failure case')
        names.append(case['case'])
    require(names == list(RUNTIME_CASES[:len(names)]), 'Invalid completed failure case prefix')
    def reject_raw_details(item):
        if isinstance(item, dict):
            require(not any(str(key).lower() in {'message', 'stack', 'stderr', 'stdout'} for key in item),
                    'Raw runtime failure details refused')
            for child in item.values():
                reject_raw_details(child)
        elif isinstance(item, list):
            for child in item:
                reject_raw_details(child)
    reject_raw_details(value)
    return value


def node_execution_failure(result):
    """Expose a bounded loader classification, never its raw stdout/stderr."""
    require(type(result.returncode) is int and -255 <= result.returncode <= 255, 'Invalid Node probe exit code')
    diagnostic = (result.stdout or '') + '\n' + (result.stderr or '')
    libraries = sorted(set(SHARED_LIBRARY.findall(diagnostic)))[:8]
    return {'code': 'NODE_EXECUTION_FAILED', 'exitCode': result.returncode, 'sharedLibraryNames': libraries}


def runtime_mount_options(stdout):
    """Only validated options of the exact /tmp tmpfs may enter public evidence."""
    rows = stdout.splitlines()
    require(len(rows) == 1, 'Expected one exact /tmp tmpfs mount')
    options = rows[0].split(',')
    allowed = {'rw', 'nosuid', 'nodev', 'exec', 'relatime', 'noatime', 'strictatime',
               'inode64', 'mode=1777', 'mode=01777', 'size=786432k', 'size=805306368'}
    require(len(options) == len(set(options)) and set(options) <= allowed,
            'Unexpected /tmp tmpfs mount options')
    require({'rw', 'nosuid', 'nodev'} <= set(options)
            and len(set(options) & {'size=786432k', 'size=805306368'}) == 1,
            'Required /tmp tmpfs isolation absent')
    return options


def runner_class(persistence):
    base = persistence.runner_class(persistence.load_infrastructure())
    class WireLabRunner(base):
        def create_args(self):
            args = super().create_args()
            require(args.count(BASE_TMPFS) == 1 and args[args.index(BASE_TMPFS) - 1] == '--tmpfs',
                    'Pinned base /tmp tmpfs argument changed')
            args[args.index(BASE_TMPFS)] = EXEC_TMPFS
            return args

        def inspect_owned(self, recovered_cid=None):
            info = super().inspect_owned(recovered_cid)
            require(info['HostConfig']['Tmpfs'] == EXPECTED_TMPFS, 'Exact lab tmpfs options mismatch')
            self.result['runtime_tmpfs_hostconfig_verified'] = True
            return info

        def verify_runtime_execution_surface(self):
            mode = self.inside(['stat', '-c', '%a', '--', CONTAINER_ROOT + '/node'],
                               'wire-node-file-mode', expected=None)
            require(mode.returncode == 0 and mode.stdout.strip() == '755', 'Node file mode mismatch')
            self.result['runtime_node_mode'] = '755'
            mount = self.inside(['awk', '$2 == "/tmp" && $3 == "tmpfs" {print $4}', '/proc/mounts'],
                                'wire-tmpfs-mount-options', expected=None)
            require(mount.returncode == 0, 'Cannot observe exact /tmp tmpfs mount')
            options = runtime_mount_options(mount.stdout)
            self.result.update(runtime_tmpfs_mount_options=options,
                               runtime_tmpfs_rw_nosuid_nodev_without_noexec=True)

        def prepare(self):
            super().prepare()
            # The unchanged parent verifies the original business entrypoint is absent first.
            # An explicitly labelled lab fixture may then bind it only in this owned DB.
            require(SYNTHETIC_FIXTURE.is_file() and not SYNTHETIC_FIXTURE.is_symlink(), 'Synthetic lab fixture absent')
            source = SYNTHETIC_FIXTURE.read_bytes()
            self.query(source.decode('utf-8'), 'wire-synthetic-business-fixture', self.database)
            self.result['synthetic_business_fixture_sha256'] = hashlib.sha256(source).hexdigest()
            self.result['business_entrypoint_binding'] = 'SYNTHETIC_DISPOSABLE_FIXTURE_ONLY'
            self.check('synthetic-business-fixture-installed', synthetic_only=True,
                       real_business_engine_certified=False, operational_wire='UNBOUND')

        def install_runtime(self, tar_path, manifest):
            self.inspect_owned()
            path = Path(tar_path)
            require(path.is_file() and not path.is_symlink() and path.resolve().is_relative_to(self.output.resolve()),
                    'Runtime tar must be an owned staging file')
            require(path.stat().st_size <= MAX_TAR_BYTES, 'Runtime archive size exceeded')
            archive = path.read_bytes()
            observed = validate_tar(archive)
            public_payload(manifest, self.token)
            require(manifest['tar_sha256'] == observed['tar_sha256'] and manifest['files'] == observed['files'],
                    'Staged runtime manifest mismatch')
            self.inside(['mkdir', '-m', '700', CONTAINER_ROOT], 'wire-create-owned-tmpfs-directory')
            self.counter += 1
            prefix = self.output / 'logs' / f'{self.counter:03d}-wire-runtime-binary-transfer'
            args = ['docker', 'exec', '-i', '--user', 'postgres', self.cid, 'tar', '-xf', '-',
                    '--no-same-owner', '--no-same-permissions', '-C', CONTAINER_ROOT]
            result = subprocess.run(args, input=archive, capture_output=True, env=self.env, timeout=30)
            prefix.with_suffix('.stdout').write_bytes(result.stdout)
            prefix.with_suffix('.stderr').write_bytes(result.stderr)
            require(result.returncode == 0, 'Runtime tmpfs transfer failed')
            self.inspect_owned()
            hashes = self.inside(['sha256sum', '--'] + [CONTAINER_ROOT + '/' + name for name in sorted(observed['files'])],
                                 'wire-verify-extracted-file-bytes').stdout
            extracted = {}
            for line in hashes.splitlines():
                checksum, name = line.split('  ', 1)
                require(name.startswith(CONTAINER_ROOT + '/') and re.fullmatch(r'[0-9a-f]{64}', checksum),
                        'Invalid extracted file hash result')
                relative = name[len(CONTAINER_ROOT) + 1:]
                require(relative not in extracted, 'Duplicate extracted file hash result')
                extracted[relative] = checksum
            require(extracted == observed['files'], 'Extracted runtime bytes differ from verified archive')
            self.result.update(runtime_tar_sha256=observed['tar_sha256'], runtime_expanded_bytes=observed['expanded_bytes'],
                               runtime_transfer='binary stdin into owned tmpfs; no mount or network',
                               runtime_extracted_file_hashes_verified=True)
            self.runtime_manifest = manifest
            self.verify_runtime_execution_surface()
            probe = self.inside(node_command('--version'),
                                'wire-node-version-probe', expected=None)
            if probe.returncode != 0 or probe.stdout.strip() != NODE_VERSION:
                failure = node_execution_failure(probe)
                public_payload(failure, self.token)
                self.result.update(status='failed', physical_wire_lab='FAIL', runtime_node_version=None,
                                   runtime_node_failure=failure)
                raise RuntimeError('NODE_EXECUTION_FAILED')
            self.result['runtime_node_version'] = NODE_VERSION

        def run_physical_cases(self):
            self.inspect_owned()
            args = ['docker', 'exec', '-i', '--user', 'postgres', self.cid,
                    *node_command(CONTAINER_ROOT + '/runtime.mjs')]
            pending = []
            watched = (signal.SIGTERM, signal.SIGINT)
            previous = {sig: signal.getsignal(sig) for sig in watched}
            try:
                for sig in watched:
                    signal.signal(sig, lambda number, frame: pending.append(number))
                process = subprocess.Popen(args, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                                           text=True, encoding='utf-8', env=self.env)
                self.sessions.append(process)
                process._crm_label = 'wire-lab-node'
            finally:
                for sig, handler in previous.items():
                    signal.signal(sig, handler)
            require(not pending, 'Interrupted while registering owned Node client')
            try:
                stdout, stderr = process.communicate(input='', timeout=180)
            except subprocess.TimeoutExpired:
                process.kill()
                stdout, stderr = process.communicate(timeout=10)
                (self.output / 'logs/wire-runtime.stdout').write_text(stdout, encoding='utf-8')
                (self.output / 'logs/wire-runtime.stderr').write_text(stderr, encoding='utf-8')
                raise RuntimeError('Physical runtime timed out') from None
            (self.output / 'logs/wire-runtime.stdout').write_text(stdout, encoding='utf-8')
            (self.output / 'logs/wire-runtime.stderr').write_text(stderr, encoding='utf-8')
            failure = runtime_failure_report(stdout)
            if failure is not None:
                public_payload(failure, self.token)
                self.physical_report = failure
                self.result.update(status='failed', physical_wire_lab='FAIL', runtime_failure=failure['failure'],
                                   physical_case_names=[case['case'] for case in failure['cases']],
                                   physical_case_count=len(failure['cases']), node_process_exit_code=process.returncode)
            require(process.returncode == 0, 'Physical runtime exited unsuccessfully')
            report = runtime_report(stdout)
            public_payload(report, self.token)
            self.physical_report = report
            self.result.update(physical_case_names=[case['case'] for case in report['cases']],
                               physical_case_count=len(report['cases']), node_process_exit_code=0)
            self.inspect_owned()

        def close_sessions(self):
            super().close_sessions()
            owned_nodes = [p for p in self.sessions if getattr(p, '_crm_label', None) == 'wire-lab-node']
            self.result['owned_node_clients_reaped'] = all(p.poll() is not None for p in owned_nodes)
            require(self.result['owned_node_clients_reaped'], 'Owned Node client still running')
    return WireLabRunner


def publish(public_dir, runner):
    # The inherited ownership file, cidfile, raw inspect output and staging files stay private.
    public_payload(runner.result, runner.token)
    (public_dir / 'result.json').write_text(json.dumps(runner.result, indent=2) + '\n', encoding='utf-8')
    if hasattr(runner, 'physical_report'):
        (public_dir / 'runtime.json').write_text(json.dumps(public_payload(runner.physical_report, runner.token), indent=2) + '\n', encoding='utf-8')
        (public_dir / 'timeline.json').write_text(json.dumps(runner.physical_report['timeline'], indent=2) + '\n', encoding='utf-8')
    if hasattr(runner, 'runtime_manifest'):
        (public_dir / 'runtime-manifest.json').write_text(json.dumps(public_payload(runner.runtime_manifest, runner.token), indent=2) + '\n', encoding='utf-8')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    env = os.environ
    require(env.get('GITHUB_ACTIONS') == 'true', 'GitHub Actions only')
    event = json.loads(Path(env['GITHUB_EVENT_PATH']).read_text())
    head = subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=ROOT, text=True).strip()
    gate(event, env, head)
    persistence = load_persistence()
    source_manifest = persistence.verify_sources()
    require(not args.output.exists(), 'Fresh evidence directory required')
    private_dir, public_dir = args.output / 'private', args.output / 'public'
    (private_dir / 'logs').mkdir(parents=True)
    public_dir.mkdir()
    runner = runner_class(persistence)(private_dir, uuid.uuid4().hex)
    runner.result.update(workflow_commit=head, event_base_sha=BASE,
                         run_url='https://github.com/' + REPOSITORY + '/actions/runs/' + env['GITHUB_RUN_ID'],
                         input_manifest=source_manifest, persistence_runner_sha256=PERSISTENCE_SHA256,
                         physical_wire_lab='NOT_RUN', wire='UNBOUND', configuration='EMPTY',
                         concurrency_two_sessions='NOT_RUN',
                         concurrency_scope={'sql_races': 'NOT_RUN_IN_THIS_LANE',
                                            'previous_sql_lane': 'Separate existing lane; no previous result reused'},
                         limits=['Synthetic physical Unix-socket lab only; no real issuer, identity or business engine',
                                 'No production endpoint, credential, pooler or operational configuration is supplied',
                                 'Inherited PostgreSQL uses fsync=off and tmpfs: no crash/WAL/failover durability certification',
                                 'At-most-once with quarantine; no exactly-once or availability guarantee'])
    def interrupted(number, frame):
        raise RuntimeError('Interrupted by signal ' + str(number))
    for sig in (signal.SIGTERM, signal.SIGINT):
        signal.signal(sig, interrupted)
    started = False
    runner.save()
    try:
        from stage import stage_runtime
        tar_path, manifest = stage_runtime(private_dir / 'stage')
        started = True
        runner.start()
        runner.prepare()
        runner.install_runtime(tar_path, manifest)
        runner.run_physical_cases()
        runner.result.update(status='checks_pass_cleanup_pending', physical_wire_lab='CHECKS_PASS_CLEANUP_PENDING')
    except BaseException as error:
        runner.result.update(status='failed', physical_wire_lab='FAIL', error_type=type(error).__name__)
        raise
    finally:
        try:
            if started:
                runner.cleanup()
            else:
                runner.close_sessions()
                runner.result['cleanup'] = 'no_container_created'
        except BaseException as error:
            runner.result.update(status='failed', physical_wire_lab='FAIL', cleanup='failed', cleanup_error_type=type(error).__name__)
            raise
        finally:
            runner.save()
            publish(public_dir, runner)
    require(runner.result['status'] == 'checks_pass_cleanup_pending'
            and runner.result['cleanup'] == 'confirmed_stopped_and_removed'
            and runner.result.get('pg_status_3_and_no_pid') is True
            and runner.result.get('shutdown_confirmed') is True
            and runner.result['owned_node_clients_reaped'], 'Tests or owned cleanup incomplete')
    runner.result.update(status='pass', physical_wire_lab='PASS_SYNTHETIC_ONLY', phase='complete_owned_cleanup_confirmed')
    runner.save()
    publish(public_dir, runner)
    print(json.dumps(runner.result, indent=2))


if __name__ == '__main__':
    main()
