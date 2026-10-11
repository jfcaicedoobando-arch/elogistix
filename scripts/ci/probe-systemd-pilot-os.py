"""Read-only GitHub Ubuntu24 facts, not bootstrap, account approval or pilot."""
from __future__ import annotations
import hashlib
import json
import os
from pathlib import Path
import platform
import re
import signal
import stat
import subprocess
import sys
import time

GLOBAL_SECONDS = 30
OP_SECONDS = 2
STREAM_BYTES = 65_536
TEXT_BYTES = 65_536
FILE_BYTES = 16 * 1024 * 1024
TOTAL_READ_BYTES = 32 * 1024 * 1024
REPORT_BYTES = 256 * 1024
POLICY_ENTRIES = 128
CANDIDATES = 16
TOOLS = tuple('/usr/bin/' + name for name in (
    'dash', 'stat', 'getfattr', 'sha256sum', 'mkdir', 'find', 'sort', 'timeout',
    'dd', 'env', 'id', 'mkfifo', 'setpriv', 'rm'))
OS_FILES = ('/usr/bin/python3.12',
    '/usr/lib/x86_64-linux-gnu/ld-linux-x86-64.so.2',
    '/usr/lib/x86_64-linux-gnu/libc.so.6', '/usr/lib/x86_64-linux-gnu/libm.so.6')
OS_DIRS = ('/usr/lib/python3.12', '/usr/lib/python3.12/lib-dynload')
ANCESTORS = ('/', '/usr', '/usr/bin', '/usr/lib', '/usr/lib/x86_64-linux-gnu',
    '/etc', '/etc/polkit-1', '/usr/share', '/usr/share/polkit-1')
POLICY_FILES = ('/etc/passwd', '/etc/group', '/etc/nsswitch.conf', '/etc/sudoers')
POLICY_DIRS = ('/etc/sudoers.d', '/etc/polkit-1/rules.d',
    '/usr/share/polkit-1/rules.d', '/etc/pam.d', '/etc/security')
ADMIN = frozenset(('root', 'sudo', 'admin', 'wheel', 'docker', 'lxd',
    'incus-admin', 'libvirt', 'disk', 'kmem', 'shadow', 'systemd-journal'))
SHELLS = frozenset(('/usr/sbin/nologin', '/sbin/nologin', '/bin/false'))
SECURITY_CONFIGS = frozenset(('access.conf', 'faillock.conf', 'group.conf',
    'limits.conf', 'namespace.conf', 'namespace.init', 'pam_env.conf',
    'sepermit.conf', 'time.conf', 'pwquality.conf'))
FORBIDDEN_XATTRS = frozenset(('system.posix_acl_access', 'system.posix_acl_default',
    'system.nfs4_acl', 'system.richacl', 'security.capability'))
IMAGE_ENV = ('ImageOS', 'ImageVersion', 'RUNNER_OS', 'RUNNER_ARCH',
    'RUNNER_ENVIRONMENT', 'GITHUB_REPOSITORY', 'GITHUB_SHA', 'GITHUB_RUN_ID',
    'GITHUB_RUN_ATTEMPT', 'GITHUB_REF')


def nss_profile(text):
    lines = [line.split('#', 1)[0].strip() for line in text.splitlines()]
    entries = {name: [line.split(':', 1)[1].split() for line in lines
                      if line.startswith(name + ':')]
               for name in ('passwd', 'group', 'initgroups')}
    matches = (entries['passwd'] == [['files']] and entries['group'] == [['files']]
               and entries['initgroups'] in ([], [['files']]))
    return {'entries': entries, 'matches_entry_profile': matches}


def policy_content_allowed(path):
    path = Path(path)
    if path.parent.as_posix() == '/etc/security':
        return path.name in SECURITY_CONFIGS
    if path.parent.as_posix() == '/etc/security/limits.d':
        return bool(re.fullmatch(r'[A-Za-z0-9_-]{1,80}\.conf', path.name))
    parent = path.parent.as_posix()
    if parent in ('/etc/polkit-1/rules.d', '/usr/share/polkit-1/rules.d'):
        return bool(re.fullmatch(r'[A-Za-z0-9_.-]{1,80}\.rules', path.name))
    return parent in ('/etc/pam.d', '/etc/sudoers.d') and bool(
        re.fullmatch(r'[A-Za-z0-9_-]{1,80}', path.name))


def classify(unsupported, unknown):
    # Definite mismatch takes precedence, but missing evidence is never erased.
    return 'UNSUPPORTED_PROFILE' if unsupported else 'INCOMPLETE' if unknown else 'SUPPORTED'


class Probe:
    def __init__(self):
        self.start = time.monotonic()
        self.end = self.start + GLOBAL_SECONDS
        self.read_bytes = 0
        self.unsupported, self.unknown = [], []

    def check(self, end=None):
        if time.monotonic() >= min(self.end - .3, end or self.end):
            raise TimeoutError('READ_BUDGET')

    def inspect(self, path, *, directory=False, retain=False, content=True, dir_fd=None, executable=False):
        result = {'path': path, 'status': 'UNKNOWN'}
        fd = None
        try:
            self.check()
            leaf = os.path.basename(path) if dir_fd is not None else path
            before = os.stat(leaf, dir_fd=dir_fd, follow_symlinks=False)
            result.update(uid=before.st_uid, gid=before.st_gid,
                mode=oct(stat.S_IMODE(before.st_mode)), size=before.st_size,
                dev=before.st_dev, inode=before.st_ino, nlink=before.st_nlink,
                symlink=stat.S_ISLNK(before.st_mode))
            correct = stat.S_ISDIR(before.st_mode) if directory else stat.S_ISREG(before.st_mode)
            if not correct:
                result['status'] = 'UNSUPPORTED_PROFILE'
                self.unsupported.append(path + ':TYPE')
                return result
            if before.st_uid != 0 or before.st_mode & 0o7022 or (not directory and before.st_nlink != 1):
                self.unsupported.append(path + ':METADATA')
                result['status'] = 'UNSUPPORTED_PROFILE'
                return result
            if executable:
                result['executable_for_probe'] = bool(before.st_mode & 0o111) and os.access(path, os.X_OK)
                if not result['executable_for_probe']:
                    self.unsupported.append(path + ':NOT_EXECUTABLE')
                    result['status'] = 'UNSUPPORTED_PROFILE'
                    return result
            if not content and not directory:
                result['reason'] = 'CONTENT_NOT_ALLOWLISTED_NEVER_OPENED'
                self.unknown.append(path + ':CONTENT_UNKNOWN')
                return result
            flags = os.O_RDONLY | os.O_CLOEXEC | os.O_NOFOLLOW | os.O_NONBLOCK
            fd = os.open(leaf, flags | (os.O_DIRECTORY if directory else 0), dir_fd=dir_fd)
            opened = os.fstat(fd)
            if (opened.st_dev, opened.st_ino) != (before.st_dev, before.st_ino):
                raise OSError('FILE_CHANGED')
            result['forbidden_xattrs'] = sorted(FORBIDDEN_XATTRS.intersection(os.listxattr(fd)))
            if result['forbidden_xattrs']:
                self.unsupported.append(path + ':ACL_OR_CAPABILITY')
                result['status'] = 'UNSUPPORTED_PROFILE'
                return result
            if not directory and content:
                limit = TEXT_BYTES if retain else FILE_BYTES
                end = min(self.end - .3, time.monotonic() + OP_SECONDS)
                digest, size, chunks = hashlib.sha256(), 0, []
                while True:
                    self.check(end)
                    raw = os.read(fd, min(65_536, limit - size + 1))
                    if not raw:
                        break
                    size += len(raw)
                    self.read_bytes += len(raw)
                    if size > limit or self.read_bytes > TOTAL_READ_BYTES:
                        raise ValueError('READ_OUTPUT_LIMIT')
                    digest.update(raw)
                    if retain:
                        chunks.append(raw)
                after = os.fstat(fd)
                if (opened.st_size, opened.st_mtime_ns, opened.st_ctime_ns) != (
                        after.st_size, after.st_mtime_ns, after.st_ctime_ns):
                    raise OSError('FILE_CHANGED')
                result.update(sha256=digest.hexdigest(), bytes_read=size)
                if retain:
                    result['_raw'] = b''.join(chunks)
            result['status'] = 'OBSERVED'
        except FileNotFoundError:
            result['reason'] = 'MISSING'
            self.unsupported.append(path + ':MISSING')
        except (OSError, ValueError, TimeoutError) as error:
            result['reason'] = type(error).__name__
            self.unknown.append(path + ':' + type(error).__name__)
        finally:
            if fd is not None:
                try:
                    os.close(fd)
                except OSError:
                    result['status'] = 'UNKNOWN'
                    self.unknown.append(path + ':CLOSE_ERROR')
        return result

    def command(self, argv):
        """Fixed callers only; bounded raw pipes, own-child kill/reap, no shell."""
        output = {'status': 'UNKNOWN', 'argv': argv, 'returncode': None}
        child, channels, retained = None, {}, {'stdout': bytearray(), 'stderr': bytearray()}
        try:
            self.check()
            stop = min(self.end - .3, time.monotonic() + OP_SECONDS)
            child = subprocess.Popen(argv, stdin=subprocess.DEVNULL,
                stdout=subprocess.PIPE, stderr=subprocess.PIPE, close_fds=True,
                shell=False, cwd='/', env={'LANG': 'C.UTF-8', 'LC_ALL': 'C.UTF-8'})
            for name in retained:
                stream = getattr(child, name)
                os.set_blocking(stream.fileno(), False)
                channels[name] = stream
            while channels or child.poll() is None:
                self.check(stop)
                progress = False
                for name, stream in list(channels.items()):
                    try:
                        raw = os.read(stream.fileno(), 8192)
                    except BlockingIOError:
                        continue
                    if raw == b'':
                        del channels[name]
                    else:
                        progress = True
                        room = STREAM_BYTES - len(retained[name])
                        retained[name].extend(raw[:room])
                        if len(raw) > room:
                            raise ValueError('COMMAND_OUTPUT_LIMIT')
                if not progress:
                    time.sleep(.005)
            output['returncode'] = child.poll()
            output['status'] = 'OBSERVED' if output['returncode'] == 0 else 'UNKNOWN'
            if output['returncode'] != 0:
                self.unknown.append(argv[0] + ':COMMAND_FAILED')
        except (OSError, ValueError, TimeoutError) as error:
            output['reason'] = type(error).__name__
            self.unknown.append(argv[0] + ':' + type(error).__name__)
        finally:
            if child is not None:
                try:
                    if child.poll() is None:
                        child.kill()  # this exact own child only
                    child.wait(timeout=max(.001, min(.2, self.end - time.monotonic())))
                    output['returncode'] = child.returncode
                except (OSError, subprocess.TimeoutExpired):
                    output['pending_own_child_pid'] = child.pid
                    output['status'] = 'UNKNOWN'
                    self.unknown.append(argv[0] + ':OWN_CHILD_NOT_REAPED')
                for name in retained:
                    stream = getattr(child, name)
                    if stream is not None:
                        try:
                            stream.close()
                        except OSError:
                            output['status'] = 'UNKNOWN'
                            self.unknown.append(argv[0] + ':PIPE_CLOSE_ERROR')
            for name, value in retained.items():
                output[name + '_bytes_retained'] = len(value)
                output[name + '_sha256_retained'] = hashlib.sha256(value).hexdigest()
                output['_' + name] = bytes(value)
        return output


def nss_worker():
    """Only local-files NSS; parent puts this own child under its 2s bound."""
    if sys.platform != 'linux':
        return {'status': 'UNKNOWN', 'reason': 'LINUX_ONLY'}
    with open('/etc/nsswitch.conf', 'rb') as source:
        raw = source.read(TEXT_BYTES + 1)
    if len(raw) > TEXT_BYTES or not nss_profile(raw.decode('ascii'))['matches_entry_profile']:
        return {'status': 'UNSUPPORTED_PROFILE', 'reason': 'NSS_NOT_ONLY_FILES'}
    import pwd
    import grp
    accounts, groups = pwd.getpwall(), grp.getgrall()
    if len(accounts) > 128 or len(groups) > 256:
        return {'status': 'UNKNOWN', 'reason': 'NSS_RECORD_LIMIT'}
    group_by_gid = {g.gr_gid: g.gr_name for g in groups}
    candidates = []
    for account in sorted(accounts, key=lambda a: (a.pw_uid, a.pw_name)):
        if not (0 < account.pw_uid < 0xffffffff and 0 < account.pw_gid < 0xffffffff
                and re.fullmatch(r'[a-z_][a-z0-9_-]{0,31}', account.pw_name)
                and account.pw_shell in SHELLS):
            continue
        actual = sorted(set(os.getgrouplist(account.pw_name, account.pw_gid)))
        if len(actual) > 128 or len(account.pw_dir) > 256 or any(
                len(group_by_gid.get(g, 'UNKNOWN')) > 80 for g in actual):
            return {'status': 'UNKNOWN', 'reason': 'IDENTITY_FIELD_LIMIT', 'candidates': candidates}
        admin = sorted(g.gr_name for g in groups if g.gr_name in ADMIN and
            (g.gr_gid in actual or account.pw_name in g.gr_mem))
        same = account == pwd.getpwuid(account.pw_uid) == pwd.getpwnam(account.pw_name)
        candidate = {'name': account.pw_name, 'uid': account.pw_uid, 'gid': account.pw_gid,
            'home': account.pw_dir[:256], 'shell': account.pw_shell, 'groups': actual[:128],
            'group_names': [group_by_gid.get(g, 'UNKNOWN') for g in actual[:128]],
            'administrative_groups': admin, 'uid_name_match': same,
            'matches_group_profile': same and actual == [account.pw_gid] and
                account.pw_gid in group_by_gid and not admin,
            'account_authorization': 'REVIEW_REQUIRED_NEVER_INFERRED_FROM_SHELL'}
        candidates.append(candidate)
        if len(candidates) > CANDIDATES:
            return {'status': 'UNKNOWN', 'reason': 'CANDIDATE_LIMIT', 'candidates': candidates[:CANDIDATES]}
    return {'status': 'OBSERVED', 'passwd_records': len(accounts), 'group_records': len(groups),
            'candidates': candidates, 'administrative_group_names_present': sorted(
                g.gr_name for g in groups if g.gr_name in ADMIN)}


def collect(probe):
    report = {'schema': 'elogistix.systemd-pilot.os-probe.v1',
        'scope': 'READ_ONLY_PROFILE_FACTS_NOT_ACCOUNT_OR_PILOT_APPROVAL',
        'image': {key: os.environ.get(key, 'UNKNOWN')[:256] for key in IMAGE_ENV},
        'kernel': {'release': platform.release(), 'machine': platform.machine()},
        'python': {'version': sys.version[:512], 'executable': sys.executable,
            'real_executable': os.path.realpath(sys.executable), 'sys_path': list(sys.path),
            'isolated': sys.flags.isolated, 'no_site': sys.flags.no_site,
            'dont_write_bytecode': sys.dont_write_bytecode},
        'unsupported_evidence': probe.unsupported, 'unknown_evidence': probe.unknown}
    probe.report = report  # preserve every earlier observation on later failures
    groups = os.getgroups()
    report['probe_identity'] = {'euid': os.geteuid(), 'egid': os.getegid(),
        'groups': groups[:128], 'groups_observed_count': len(groups),
        'groups_truncated': len(groups) > 128}
    if len(groups) > 128:
        probe.unknown.append('PROBE_IDENTITY_GROUP_LIMIT')
    if sys.version_info[:2] != (3, 12) or os.path.realpath(sys.executable) != '/usr/bin/python3.12':
        probe.unsupported.append('PYTHON_PROFILE')
    if platform.machine() != 'x86_64':
        probe.unsupported.append('ARCH_PROFILE')
    if any(report['image'][key] == 'UNKNOWN' for key in ('ImageOS', 'ImageVersion')):
        probe.unknown.append('IMAGE_VERSION_UNKNOWN')
    release = probe.inspect('/etc/os-release', retain=True)
    # Ubuntu os-release is commonly a symlink: read its fixed OS target explicitly.
    if release.get('symlink'):
        probe.unsupported.remove('/etc/os-release:TYPE')
        release = probe.inspect('/usr/lib/os-release', retain=True)
    raw_release = release.pop('_raw', b'').decode('utf-8', 'replace')
    values = dict(re.findall(r'^([A-Z_]+)=(.*)$', raw_release, re.M))
    report['os_release'] = {key: values.get(key, 'UNKNOWN').strip('"')
                            for key in ('ID', 'VERSION_ID', 'PRETTY_NAME')}
    if report['os_release']['ID'] != 'ubuntu' or report['os_release']['VERSION_ID'] != '24.04':
        (probe.unknown if not raw_release else probe.unsupported).append('UBUNTU_24_PROFILE')
    report['ancestors'] = [probe.inspect(path, directory=True) for path in ANCESTORS]
    report['tools'] = [probe.inspect(path, executable=True) for path in TOOLS]
    report['entry_paths'] = [probe.inspect(path, executable=path == '/usr/bin/python3.12') for path in OS_FILES] + [
        probe.inspect(path, directory=True) for path in OS_DIRS]
    try:
        os.lstat('/usr/lib/python312.zip')
        report['startup_zip_absent'] = False
        probe.unsupported.append('STARTUP_ZIP_PRESENT_INCLUDING_DANGLING_SYMLINK')
    except FileNotFoundError:
        report['startup_zip_absent'] = True
    except OSError:
        report['startup_zip_absent'] = 'UNKNOWN'
        probe.unknown.append('STARTUP_ZIP_OBSERVATION_UNKNOWN')
    api_names = ('O_DIRECTORY', 'O_NOFOLLOW', 'O_CLOEXEC', 'O_NONBLOCK',
        'getgrouplist', 'listxattr', 'fork', 'waitpid', 'set_blocking')
    report['linux_api_available'] = {name: hasattr(os, name) for name in api_names}
    report['linux_api_available']['open_dir_fd'] = os.open in os.supports_dir_fd
    if not all(report['linux_api_available'].values()):
        probe.unsupported.append('ENTRY_LINUX_API_MISSING')
    try:
        null = os.lstat('/dev/null')
        report['dev_null'] = {'character_device': stat.S_ISCHR(null.st_mode), 'rdev': null.st_rdev}
        if not report['dev_null']['character_device']:
            probe.unsupported.append('DEV_NULL_PROFILE')
        report['proc'] = {'task_count': len(os.listdir('/proc/self/task')),
            'fd_count': len(os.listdir('/proc/self/fd')),
            'sigchld_default': signal.getsignal(signal.SIGCHLD) == signal.SIG_DFL}
    except OSError as error:
        probe.unknown.append('PROC_OR_DEV_NULL:' + type(error).__name__)
    systemctl = probe.inspect('/usr/bin/systemctl', executable=True)
    report['diagnostic_tools'] = [systemctl]
    for name, argv in (('systemd_binary', ['/usr/bin/systemctl', '--version']),
                       ('systemd_manager', ['/usr/bin/systemctl', 'show', '--property=Version', '--value'])):
        if systemctl['status'] != 'OBSERVED':
            report[name] = {'status': 'UNKNOWN', 'reason': 'DIAGNOSTIC_TOOL_NOT_OBSERVED'}
            probe.unknown.append(name + ':NOT_QUERIED')
            continue
        result = probe.command(argv)
        result['version_text'] = result.pop('_stdout', b'').decode('utf-8', 'replace')[:4096]
        result['stderr_prefix'] = result.pop('_stderr', b'').decode('utf-8', 'replace')[:4096]
        report[name] = result
        if result['status'] == 'OBSERVED':
            match = re.search(r'(?:systemd\s+)?(\d{3})(?:[.\s(+-]|$)', result['version_text'])
            if not match:
                probe.unknown.append(name + ':VERSION_UNKNOWN')
            elif match[1] != '255':
                probe.unsupported.append(name + ':CENTRAL_V255_PROFILE_MISMATCH')
    try:
        with open('/proc/self/mountinfo', 'rb') as source:
            mounts = source.read(TEXT_BYTES + 1)
        if len(mounts) > TEXT_BYTES:
            raise ValueError('MOUNTINFO_LIMIT')
        matches = [line for line in mounts.splitlines() if b' - cgroup2 ' in line and
                   line.split(b' - ', 1)[0].split()[4] == b'/sys/fs/cgroup']
        report['cgroup2'] = {'mounted_at_expected_path': len(matches) == 1}
        if len(matches) != 1:
            probe.unsupported.append('CGROUP2_PROFILE')
        with open('/sys/fs/cgroup/cgroup.controllers', 'rb') as source:
            controllers = source.read(4097)
        if len(controllers) > 4096:
            raise ValueError('CONTROLLER_LIMIT')
        report['cgroup2']['controllers'] = controllers.decode('ascii').split()
        if not {'memory', 'pids'} <= set(report['cgroup2']['controllers']):
            probe.unsupported.append('CGROUP2_MEMORY_OR_PIDS_UNAVAILABLE')
    except (OSError, ValueError) as error:
        probe.unknown.append('CGROUP2:' + type(error).__name__)
    report['policy_files'] = []
    nss = None
    for path in POLICY_FILES:
        result = probe.inspect(path, retain=path == '/etc/nsswitch.conf')
        if path == '/etc/nsswitch.conf' and '_raw' in result:
            nss = nss_profile(result.pop('_raw').decode('ascii'))
        report['policy_files'].append(result)
    report['nss'] = nss or {'status': 'UNKNOWN'}
    if nss and not nss['matches_entry_profile']:
        probe.unsupported.append('NSS_NOT_ONLY_FILES')
    if nss and nss['matches_entry_profile']:
        worker = probe.command([sys.executable, '-I', '-S', '-B', str(Path(__file__).resolve()), '--nss-worker'])
        if worker['_stdout'] and 'reason' not in worker:
            try:
                report['accounts'] = json.loads(worker['_stdout'])
                if report['accounts'].get('status') == 'UNSUPPORTED_PROFILE':
                    probe.unsupported.append('NSS_WORKER_REOBSERVED_UNSUPPORTED_PROFILE')
            except (ValueError, UnicodeError):
                probe.unknown.append('NSS_WORKER_JSON')
        else:
            probe.unknown.append('NSS_OBSERVATION_UNKNOWN')
        worker.pop('_stdout', None)
        worker.pop('_stderr', None)
        report['nss_command'] = worker
    else:
        report['accounts'] = {'status': 'UNKNOWN', 'reason': 'NSS_CALLS_SKIPPED_UNSUPPORTED_OR_UNKNOWN_PROFILE'}
    accounts = report.get('accounts', {'status': 'UNKNOWN'})
    if accounts.get('status') != 'OBSERVED':
        probe.unknown.append('ACCOUNT_EVIDENCE_UNKNOWN')
    elif not any(c['matches_group_profile'] for c in accounts['candidates']):
        probe.unsupported.append('NO_OBSERVED_ACCOUNT_MATCHING_GROUP_PROFILE')
    report['policy_directories'] = []
    pending = [(path, 0) for path in POLICY_DIRS]
    entries = 0
    while pending:
        path, depth = pending.pop(0)
        result = probe.inspect(path, directory=True)
        report['policy_directories'].append(result)
        if result['status'] != 'OBSERVED':
            result['closure_status'] = 'UNKNOWN'
            probe.unknown.append(path + ':DIRECTORY_NOT_TRAVERSED')
            continue
        directory_fd = None
        try:
            probe.check()
            directory_fd = os.open(path, os.O_RDONLY | os.O_CLOEXEC | os.O_DIRECTORY | os.O_NOFOLLOW)
            identity = os.fstat(directory_fd)
            if (identity.st_dev, identity.st_ino) != (result['dev'], result['inode']):
                raise OSError('DIRECTORY_CHANGED')
            with os.scandir(directory_fd) as children:
                for child in children:
                    child_path = path + '/' + child.name
                    entries += 1
                    if entries > POLICY_ENTRIES:
                        raise ValueError('POLICY_ENTRY_LIMIT')
                    if child.is_dir(follow_symlinks=False):
                        if depth >= 2:
                            raise ValueError('POLICY_DEPTH_LIMIT')
                        pending.append((child_path, depth + 1))
                    else:
                        result.setdefault('entries', []).append(probe.inspect(child_path,
                            content=policy_content_allowed(child_path), dir_fd=directory_fd))
        except (OSError, ValueError, TimeoutError) as error:
            result['closure_status'] = 'UNKNOWN'
            probe.unknown.append(path + ':CLOSURE_' + type(error).__name__)
            if isinstance(error, (ValueError, TimeoutError)):
                break
        finally:
            if directory_fd is not None:
                os.close(directory_fd)
    report['stdlib_transitive_closure_pins'] = 'NOT_COLLECTED_BY_THIS_BOUNDED_PROBE'
    report['account_authorization'] = 'REVIEW_REQUIRED'
    report['elapsed_seconds'] = round(time.monotonic() - probe.start, 6)
    report['classification'] = classify(probe.unsupported, probe.unknown)
    report['limits'] = {'global_seconds': GLOBAL_SECONDS, 'operation_seconds': OP_SECONDS,
        'stream_bytes_each': STREAM_BYTES, 'text_bytes': TEXT_BYTES,
        'file_bytes': FILE_BYTES, 'total_read_bytes': TOTAL_READ_BYTES,
        'policy_entries': POLICY_ENTRIES, 'candidates': CANDIDATES, 'report_bytes': REPORT_BYTES,
        'arbitrary_host_suspension_or_kernel_io_bound_guaranteed': False}
    return report


def main():
    worker_mode = len(sys.argv) == 2 and sys.argv[1] == '--nss-worker'
    if worker_mode:
        try:
            report = nss_worker()
        except (OSError, KeyError, ValueError, UnicodeError, AttributeError) as error:
            report = {'status': 'UNKNOWN', 'reason': type(error).__name__}
    elif len(sys.argv) != 1 or sys.platform != 'linux' or (
            os.environ.get('GITHUB_ACTIONS') != 'true' or
            os.environ.get('RUNNER_ENVIRONMENT') != 'github-hosted' or os.geteuid() == 0):
        report = {'classification': 'INCOMPLETE', 'reason': 'ONLY_REVIEWED_GITHUB_HOSTED_LINUX_VM',
                  'facts_collected': False}
    else:
        probe = Probe()
        try:
            report = collect(probe)
        except (OSError, ValueError, TimeoutError, UnicodeError) as error:
            probe.unknown.append(type(error).__name__)
            report = getattr(probe, 'report', {})
            report.update(classification=classify(probe.unsupported, probe.unknown),
                unsupported_evidence=probe.unsupported, unknown_evidence=probe.unknown,
                reason=type(error).__name__, partial_evidence=True)
    report.setdefault('schema', 'elogistix.systemd-pilot.os-probe-nss.v1' if worker_mode
                      else 'elogistix.systemd-pilot.os-probe.v1')
    report.update(diagnostic_only=True, trusted_producer_input=False,
                  account_authorization='REVIEW_REQUIRED')
    if not worker_mode:
        report.setdefault('unsupported_evidence', [])
        report.setdefault('unknown_evidence', [])
    raw = json.dumps(report, ensure_ascii=True, sort_keys=True, separators=(',', ':')).encode()
    if len(raw) > REPORT_BYTES:
        report = {'schema': report['schema'], 'diagnostic_only': True,
            'trusted_producer_input': False, 'account_authorization': 'REVIEW_REQUIRED',
            'classification': classify(report.get('unsupported_evidence', []), ['REPORT_OUTPUT_LIMIT']),
            'reason': 'REPORT_OUTPUT_LIMIT', 'original_bytes': len(raw),
            'unsupported_evidence': report.get('unsupported_evidence', [])[:32],
            'unknown_evidence': report.get('unknown_evidence', [])[:32],
            'discarded_report_sha256': hashlib.sha256(raw).hexdigest(), 'partial_evidence': True}
        raw = json.dumps(report).encode()
    sys.stdout.buffer.write(raw + b'\n')
    return 0 if report.get('classification') == 'SUPPORTED' or report.get('status') == 'OBSERVED' else 3


if __name__ == '__main__':
    raise SystemExit(main())
