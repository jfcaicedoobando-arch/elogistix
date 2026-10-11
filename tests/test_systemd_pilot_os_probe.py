"""Synthetic data/FS mocks and small own pipe children; never an Asus probe."""
from contextlib import ExitStack, contextmanager
import hashlib
import importlib.abc
import importlib.util
import io
import json
from pathlib import Path
import stat
import sys
from types import SimpleNamespace
import unittest
from unittest.mock import Mock, patch

ROOT = Path(__file__).resolve().parents[1]
class NoNativeImports(importlib.abc.MetaPathFinder):
    def find_spec(self, fullname, path=None, target=None):
        if fullname.split('.', 1)[0] in {'systemd_memory_runtime', 'physical_cgroup', 'payload_distribution'}:
            raise AssertionError('Native runtime import forbidden')
        return None
GUARD = NoNativeImports()
sys.meta_path.insert(0, GUARD)
unittest.addModuleCleanup(lambda: sys.meta_path.remove(GUARD))
SPEC = importlib.util.spec_from_file_location('_own_os_probe_test', ROOT / 'scripts/ci/probe-systemd-pilot-os.py')
P = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(P)


def metadata(**changes):
    values = dict(st_mode=stat.S_IFREG | 0o644, st_uid=0, st_gid=0, st_size=6,
        st_dev=1, st_ino=2, st_nlink=1, st_mtime_ns=1, st_ctime_ns=1)
    values.update(changes)
    return SimpleNamespace(**values)


@contextmanager
def filesystem(info=None):
    info = info or metadata()
    with ExitStack() as stack:
        for index, name in enumerate(('O_CLOEXEC', 'O_NOFOLLOW', 'O_NONBLOCK', 'O_DIRECTORY')):
            stack.enter_context(patch.object(P.os, name, 1 << (20 + index), create=True))
        stat_call = stack.enter_context(patch.object(P.os, 'stat', return_value=info))
        opened = stack.enter_context(patch.object(P.os, 'open', return_value=123))
        stack.enter_context(patch.object(P.os, 'fstat', return_value=info))
        xattrs = stack.enter_context(patch.object(P.os, 'listxattr', return_value=[], create=True))
        read = stack.enter_context(patch.object(P.os, 'read', side_effect=[b'sample', b'']))
        close = stack.enter_context(patch.object(P.os, 'close'))
        stack.enter_context(patch.object(P.os, 'access', return_value=True))
        yield SimpleNamespace(stat=stat_call, opened=opened, xattrs=xattrs, read=read, close=close)


@contextmanager
def nss_data(*, nss='passwd: files\ngroup: files\n', accounts=None, groups=None, memberships=None):
    account = SimpleNamespace(pw_name='load', pw_uid=100, pw_gid=101,
        pw_dir='/nonexistent', pw_shell='/usr/sbin/nologin',
        pw_passwd='SECRET_PASSWORD_MUST_NOT_APPEAR', pw_gecos='SECRET_GECOS_MUST_NOT_APPEAR')
    accounts = accounts if accounts is not None else [account]
    groups = groups if groups is not None else [SimpleNamespace(gr_name='load', gr_gid=101,
        gr_mem=[], gr_passwd='SECRET_GROUP_PASSWORD_MUST_NOT_APPEAR')]
    pwd = SimpleNamespace(getpwall=Mock(return_value=accounts),
        getpwuid=Mock(side_effect=lambda uid: next(a for a in accounts if a.pw_uid == uid)),
        getpwnam=Mock(side_effect=lambda name: next(a for a in accounts if a.pw_name == name)))
    grp = SimpleNamespace(getgrall=Mock(return_value=groups))
    with patch.object(P.sys, 'platform', 'linux'), \
         patch('builtins.open', return_value=io.BytesIO(nss.encode())), \
         patch.dict(sys.modules, {'pwd': pwd, 'grp': grp}), \
         patch.object(P.os, 'getgrouplist', side_effect=memberships or (lambda name, gid: [gid]), create=True):
        yield account, pwd, grp


class ProfileAndPrivacyTests(unittest.TestCase):
    def test_only_files_and_optional_initgroups(self):
        for extra in ('', 'initgroups: files\n'):
            self.assertTrue(P.nss_profile('passwd: files\ngroup: files\n' + extra)['matches_entry_profile'])

    def test_systemd_remote_actions_duplicates_and_missing_database_are_incompatible(self):
        for text in ('passwd: files systemd\ngroup: files', 'passwd: sss\ngroup: files',
            'passwd: files\npasswd: files\ngroup: files', 'passwd: files\ngroup: files [SUCCESS=return]',
            'passwd: files\ngroup: files\ninitgroups: files sss', 'passwd: files'):
            self.assertFalse(P.nss_profile(text)['matches_entry_profile'])

    def test_classification_never_discards_known_mismatch_for_unknown(self):
        self.assertEqual(P.classify([], []), 'SUPPORTED')
        self.assertEqual(P.classify([], ['PermissionError']), 'INCOMPLETE')
        self.assertEqual(P.classify(['NSS'], ['PermissionError']), 'UNSUPPORTED_PROFILE')

    def test_sensitive_security_files_are_not_content_allowlisted(self):
        for path in ('/etc/security/opasswd', '/etc/security/opasswd.old', '/etc/shadow',
            '/etc/gshadow', '/etc/security/private.key', '/etc/security/token.conf'):
            self.assertFalse(P.policy_content_allowed(path), path)
        self.assertTrue(P.policy_content_allowed('/etc/security/limits.conf'))
        self.assertTrue(P.policy_content_allowed('/etc/security/limits.d/10-limit.conf'))

    def test_metadata_only_sensitive_entry_never_opens_reads_or_lists_xattrs(self):
        with filesystem() as fs:
            report = P.Probe().inspect('/etc/security/opasswd', content=False)
            self.assertEqual(report['status'], 'UNKNOWN')
            fs.opened.assert_not_called()
            fs.read.assert_not_called()
            fs.xattrs.assert_not_called()

    def test_file_hash_uses_nofollow_relative_fd_and_exact_bytes(self):
        with filesystem() as fs:
            report = P.Probe().inspect('/etc/pam.d/common-auth', dir_fd=44)
            self.assertEqual(report['sha256'], hashlib.sha256(b'sample').hexdigest())
            fs.stat.assert_called_once_with('common-auth', dir_fd=44, follow_symlinks=False)
            self.assertTrue(fs.opened.call_args.args[1] & P.os.O_NOFOLLOW)
            self.assertEqual(fs.opened.call_args.kwargs['dir_fd'], 44)
            fs.close.assert_called_once_with(123)

    def test_policy_permission_error_is_unknown_without_empty_policy(self):
        with filesystem() as fs:
            fs.opened.side_effect = PermissionError
            probe = P.Probe()
            report = probe.inspect('/etc/sudoers')
            self.assertEqual(report['status'], 'UNKNOWN')
            self.assertEqual(report['reason'], 'PermissionError')
            self.assertEqual(P.classify(probe.unsupported, probe.unknown), 'INCOMPLETE')
            self.assertNotIn('sha256', report)

    def test_symlink_or_writable_tool_is_rejected_before_open(self):
        for mode in (stat.S_IFLNK | 0o777, stat.S_IFREG | 0o666):
            with filesystem(metadata(st_mode=mode)) as fs:
                report = P.Probe().inspect('/usr/bin/id', executable=True)
                self.assertEqual(report['status'], 'UNSUPPORTED_PROFILE')
                fs.opened.assert_not_called()

    def test_nonexecutable_tool_is_rejected_before_open(self):
        with filesystem() as fs:
            report = P.Probe().inspect('/usr/bin/id', executable=True)
            self.assertFalse(report['executable_for_probe'])
            self.assertEqual(report['status'], 'UNSUPPORTED_PROFILE')
            fs.opened.assert_not_called()

    def test_file_limit_never_emits_hash_of_truncated_file(self):
        with filesystem() as fs, patch.object(P, 'FILE_BYTES', 5):
            probe = P.Probe()
            report = probe.inspect('/usr/bin/id')
            self.assertEqual(report['status'], 'UNKNOWN')
            self.assertNotIn('sha256', report)
            self.assertTrue(probe.unknown)
            fs.close.assert_called_once()

    def test_changed_file_cannot_keep_a_favorable_hash(self):
        with filesystem() as fs, patch.object(P.os, 'fstat', side_effect=[metadata(), metadata(st_ctime_ns=2)]):
            report = P.Probe().inspect('/etc/group')
            self.assertEqual(report['status'], 'UNKNOWN')
            self.assertNotIn('sha256', report)

    def test_total_read_limit_is_shared_across_operations(self):
        with filesystem() as fs, patch.object(P, 'TOTAL_READ_BYTES', 5):
            report = P.Probe().inspect('/etc/group')
            self.assertEqual(report['reason'], 'ValueError')
            self.assertEqual(report['status'], 'UNKNOWN')


class SyntheticNssTests(unittest.TestCase):
    def test_candidate_reports_profile_only_without_password_or_gecos(self):
        with nss_data():
            report = P.nss_worker()
        self.assertEqual(report['status'], 'OBSERVED')
        self.assertTrue(report['candidates'][0]['matches_group_profile'])
        self.assertIn('REVIEW_REQUIRED', report['candidates'][0]['account_authorization'])
        self.assertNotIn('SECRET_', json.dumps(report))

    def test_nologin_with_admin_nominal_membership_is_not_eligible(self):
        groups = [SimpleNamespace(gr_name='load', gr_gid=101, gr_mem=[]),
                  SimpleNamespace(gr_name='sudo', gr_gid=27, gr_mem=['load'])]
        with nss_data(groups=groups):
            report = P.nss_worker()
        self.assertFalse(report['candidates'][0]['matches_group_profile'])
        self.assertEqual(report['candidates'][0]['administrative_groups'], ['sudo'])

    def test_supplementary_group_rejects_profile_even_without_admin_name(self):
        with nss_data(memberships=lambda name, gid: [gid, 777]):
            report = P.nss_worker()
        self.assertFalse(report['candidates'][0]['matches_group_profile'])

    def test_remote_nss_never_calls_pwd_or_grp(self):
        with nss_data(nss='passwd: files sss\ngroup: files') as (_, pwd, grp):
            report = P.nss_worker()
            pwd.getpwall.assert_not_called()
            grp.getgrall.assert_not_called()
        self.assertEqual(report['status'], 'UNSUPPORTED_PROFILE')

    def test_uid_name_disagreement_rejects_candidate(self):
        with nss_data() as (_, pwd, __):
            pwd.getpwuid.return_value = None
            pwd.getpwuid.side_effect = None
            report = P.nss_worker()
        self.assertFalse(report['candidates'][0]['uid_name_match'])
        self.assertFalse(report['candidates'][0]['matches_group_profile'])

    def test_large_group_evidence_is_unknown_instead_of_silent_truncation(self):
        with nss_data(memberships=lambda name, gid: list(range(129))):
            report = P.nss_worker()
        self.assertEqual(report['status'], 'UNKNOWN')
        self.assertEqual(report['reason'], 'IDENTITY_FIELD_LIMIT')

    def test_record_limit_is_explicit_unknown(self):
        groups = [SimpleNamespace(gr_name='g', gr_gid=i, gr_mem=[]) for i in range(257)]
        with nss_data(groups=groups):
            report = P.nss_worker()
        self.assertEqual(report['status'], 'UNKNOWN')
        self.assertEqual(report['reason'], 'NSS_RECORD_LIMIT')


class OwnPipeLimitTests(unittest.TestCase):
    def command(self, code):
        return [str(Path(sys.executable).resolve()), '-I', '-S', '-B', '-c', code]

    def test_small_synthetic_child_retains_both_channels_and_hashes(self):
        report = P.Probe().command(self.command("import os; os.write(1,b'OWN'); os.write(2,b'ERR')"))
        self.assertEqual(report['status'], 'OBSERVED')
        self.assertEqual(report['_stdout'], b'OWN')
        self.assertEqual(report['_stderr'], b'ERR')
        self.assertEqual(report['stderr_sha256_retained'], hashlib.sha256(b'ERR').hexdigest())
        self.assertNotIn('pending_own_child_pid', report)

    def test_output_overflow_is_bounded_failure_and_own_child_reaped(self):
        with patch.object(P, 'STREAM_BYTES', 256):
            probe = P.Probe()
            report = probe.command(self.command("import os,time; os.write(1,b'X'*8192); time.sleep(20)"))
        self.assertEqual(report['status'], 'UNKNOWN')
        self.assertEqual(len(report['_stdout']), 256)
        self.assertEqual(report['reason'], 'ValueError')
        self.assertNotIn('pending_own_child_pid', report)
        self.assertTrue(probe.unknown)

    def test_timeout_uses_same_global_end_without_new_budget(self):
        with patch.object(P, 'OP_SECONDS', .12):
            probe = P.Probe()
            original = probe.end
            report = probe.command(self.command('import time; time.sleep(20)'))
        self.assertEqual(probe.end, original)
        self.assertEqual(report['status'], 'UNKNOWN')
        self.assertEqual(report['reason'], 'TimeoutError')
        self.assertNotIn('pending_own_child_pid', report)

    def test_expired_global_budget_prevents_child_creation(self):
        probe = P.Probe()
        probe.end = probe.start
        with patch.object(P.subprocess, 'Popen') as popen:
            report = probe.command(self.command("print('not run')"))
            popen.assert_not_called()
        self.assertEqual(report['status'], 'UNKNOWN')


class MainAndWorkflowTests(unittest.TestCase):
    def run_main(self, argv, collect=None, worker=None, *, linux=False):
        out = SimpleNamespace(buffer=io.BytesIO())
        env = {'GITHUB_ACTIONS': 'true', 'RUNNER_ENVIRONMENT': 'github-hosted'}
        with patch.object(P.sys, 'argv', argv), patch.object(P.sys, 'stdout', out), \
             patch.object(P.sys, 'platform', 'linux' if linux else 'win32'), \
             patch.dict(P.os.environ, env, clear=True), \
             patch.object(P.os, 'geteuid', return_value=1001, create=True), \
             patch.object(P, 'collect', side_effect=collect) as collector, \
             patch.object(P, 'nss_worker', side_effect=worker) as nss:
            code = P.main()
        return code, json.loads(out.buffer.getvalue()), collector, nss

    def test_wrong_platform_collects_no_asus_facts(self):
        code, report, collect, worker = self.run_main(['probe.py'])
        self.assertEqual(code, 3)
        self.assertFalse(report['facts_collected'])
        self.assertTrue(report['diagnostic_only'])
        self.assertFalse(report['trusted_producer_input'])
        collect.assert_not_called()
        worker.assert_not_called()

    def test_output_limit_emits_failure_and_exit3_even_if_prior_status_observed(self):
        code, report, _, __ = self.run_main(['probe.py', '--nss-worker'],
            worker=lambda: {'status': 'OBSERVED', 'synthetic': 'X' * (P.REPORT_BYTES + 1)})
        self.assertEqual(code, 3)
        self.assertEqual(report['classification'], 'INCOMPLETE')
        self.assertEqual(report['reason'], 'REPORT_OUTPUT_LIMIT')
        self.assertFalse(report['trusted_producer_input'])

    def test_collect_exception_retains_prior_evidence_and_no_favorable_exit(self):
        def failing(probe):
            probe.report = {'image': {'ImageVersion': 'SYNTHETIC_TEST_NOT_VM_FACT'}}
            probe.unknown.append('POLICY_UNKNOWN')
            raise TimeoutError
        code, report, _, __ = self.run_main(['probe.py'], collect=failing, linux=True)
        self.assertEqual(code, 3)
        self.assertEqual(report['image']['ImageVersion'], 'SYNTHETIC_TEST_NOT_VM_FACT')
        self.assertEqual(report['classification'], 'INCOMPLETE')
        self.assertTrue(report['partial_evidence'])

    def test_diagnostic_supported_never_claims_account_approval(self):
        code, report, _, __ = self.run_main(['probe.py'], linux=True,
            collect=lambda probe: {'classification': 'SUPPORTED'})
        self.assertEqual(code, 0)
        self.assertEqual(report['schema'], 'elogistix.systemd-pilot.os-probe.v1')
        self.assertEqual(report['account_authorization'], 'REVIEW_REQUIRED')
        self.assertFalse(report['trusted_producer_input'])

    def test_workflow_is_one_blocked_job_without_unreviewed_fork_or_privileges(self):
        text = (ROOT / '.github/workflows/ci-systemd-os-profile-probe.yml').read_text()
        self.assertIn('false &&', text)
        self.assertIn('exit 3', text)
        self.assertIn("github.repository == 'jfcaicedoobando-arch/elogistix'", text)
        self.assertIn("github.run_attempt == '1'", text)
        self.assertIn('contents: read', text)
        self.assertIn('persist-credentials: false', text)
        self.assertIn('ref: PENDING_REVIEWED_OS_PROBE_SOURCE_R', text)
        self.assertNotIn('github.sha ==', text)  # W cannot embed its own Git SHA
        self.assertNotIn('ref: ${{ github.sha }}', text)
        self.assertEqual(text.count('runs-on:'), 1)
        for unsafe in ('pull_request_target', 'workflow_dispatch', 'secrets.', 'sudo ', 'apt-get', 'pip install'):
            self.assertNotIn(unsafe, text)


class FullReportSyntheticTests(unittest.TestCase):
    def collect(self, *, worker=None, controllers=b'memory pids cpu', zip_error=FileNotFoundError,
                directory_status='UNKNOWN', identity_groups=None):
        class FakeProbe(P.Probe):
            def inspect(self, path, **kwargs):
                result = {'path': path, 'status': 'OBSERVED', 'dev': 1, 'inode': 2}
                if path == '/etc/os-release':
                    result['_raw'] = b'ID=ubuntu\nVERSION_ID="24.04"\n'
                if path == '/etc/nsswitch.conf':
                    result['_raw'] = b'passwd: files\ngroup: files\n'
                if path in P.POLICY_DIRS:
                    result['status'] = directory_status
                return result
            def command(self, argv):
                if argv[-1] == '--nss-worker':
                    data = worker or {'status': 'OBSERVED', 'candidates': [{'matches_group_profile': True}]}
                    code = 0 if data['status'] == 'OBSERVED' else 3
                    if code:
                        self.unknown.append('OWN_NSS_WORKER_EXIT3')
                    raw = json.dumps(data).encode()
                else:
                    raw = b'systemd 255 (SYNTHETIC_TEST_BUILD)' if argv[-1] == '--version' else b'255.4'
                    code = 0
                return {'status': 'OBSERVED' if code == 0 else 'UNKNOWN', 'returncode': code,
                        '_stdout': raw, '_stderr': b''}
        probe = FakeProbe()
        def lstat(path):
            if path == '/usr/lib/python312.zip':
                raise zip_error
            return SimpleNamespace(st_mode=stat.S_IFCHR | 0o666, st_rdev=1)
        with ExitStack() as stack:
            for name in ('O_DIRECTORY', 'O_NOFOLLOW', 'O_CLOEXEC', 'O_NONBLOCK', 'getgrouplist',
                         'listxattr', 'fork', 'waitpid', 'geteuid', 'getegid', 'getgroups'):
                if name in ('geteuid', 'getegid'):
                    value = Mock(return_value=1001)
                elif name == 'getgroups':
                    value = Mock(return_value=[1001] if identity_groups is None else identity_groups)
                else:
                    value = Mock()
                stack.enter_context(patch.object(P.os, name, value, create=True))
            stack.enter_context(patch.object(P.os, 'supports_dir_fd', {P.os.open}))
            stack.enter_context(patch.object(P.os.path, 'realpath', return_value='/usr/bin/python3.12'))
            stack.enter_context(patch.object(P.Path, 'resolve', return_value=ROOT / 'scripts/ci/probe-systemd-pilot-os.py'))
            stack.enter_context(patch.object(P.sys, 'executable', '/usr/bin/python3.12'))
            stack.enter_context(patch.object(P.sys, 'version_info', (3, 12)))
            stack.enter_context(patch.object(P.platform, 'release', return_value='SYNTHETIC_KERNEL'))
            stack.enter_context(patch.object(P.platform, 'machine', return_value='x86_64'))
            stack.enter_context(patch.dict(P.os.environ, {'ImageOS': 'SYNTHETIC_IMAGE',
                'ImageVersion': 'SYNTHETIC_VERSION'}, clear=True))
            stack.enter_context(patch.object(P.os, 'lstat', side_effect=lstat))
            stack.enter_context(patch.object(P.os, 'listdir', return_value=['own-test-task']))
            stack.enter_context(patch.object(P.signal, 'getsignal', return_value=0))
            stack.enter_context(patch.object(P.signal, 'SIG_DFL', 0))
            stack.enter_context(patch.object(P.signal, 'SIGCHLD', 42, create=True))
            stack.enter_context(patch('builtins.open', side_effect=[
                io.BytesIO(b'1 0 0:1 / /sys/fs/cgroup rw - cgroup2 cgroup rw\n'), io.BytesIO(controllers)]))
            scan = stack.enter_context(patch.object(P.os, 'scandir'))
            report = P.collect(probe)
            scan.assert_not_called()  # unsafe/unknown policy directories never followed
        self.assertNotIn('_raw', json.dumps(report))
        return report

    def test_failed_nss_worker_preserves_its_reason_and_partial_candidates(self):
        worker = {'status': 'UNKNOWN', 'reason': 'CANDIDATE_LIMIT',
                  'candidates': [{'matches_group_profile': True, 'name': 'synthetic'}]}
        report = self.collect(worker=worker)
        self.assertEqual(report['accounts'], worker)
        self.assertEqual(report['classification'], 'INCOMPLETE')
        self.assertIn('ACCOUNT_EVIDENCE_UNKNOWN', report['unknown_evidence'])

    def test_reobserved_nss_mismatch_remains_unsupported_and_has_unknown_gaps(self):
        report = self.collect(worker={'status': 'UNSUPPORTED_PROFILE', 'reason': 'NSS_NOT_ONLY_FILES'})
        self.assertEqual(report['classification'], 'UNSUPPORTED_PROFILE')
        self.assertIn('NSS_WORKER_REOBSERVED_UNSUPPORTED_PROFILE', report['unsupported_evidence'])
        self.assertTrue(report['unknown_evidence'])

    def test_cgroup2_without_memory_or_pids_is_not_supported(self):
        report = self.collect(controllers=b'cpu io')
        self.assertEqual(report['classification'], 'UNSUPPORTED_PROFILE')
        self.assertIn('CGROUP2_MEMORY_OR_PIDS_UNAVAILABLE', report['unsupported_evidence'])

    def test_startup_zip_permission_error_never_becomes_absent(self):
        report = self.collect(zip_error=PermissionError)
        self.assertEqual(report['startup_zip_absent'], 'UNKNOWN')
        self.assertIn('STARTUP_ZIP_OBSERVATION_UNKNOWN', report['unknown_evidence'])

    def test_rejected_policy_directory_is_never_enumerated(self):
        report = self.collect(directory_status='UNSUPPORTED_PROFILE')
        self.assertTrue(all(d['closure_status'] == 'UNKNOWN' for d in report['policy_directories']))
        self.assertEqual(report['classification'], 'INCOMPLETE')

    def test_current_runner_group_overflow_is_explicitly_unknown(self):
        report = self.collect(identity_groups=list(range(129)))
        identity = report['probe_identity']
        self.assertEqual(identity['groups_observed_count'], 129)
        self.assertTrue(identity['groups_truncated'])
        self.assertEqual(len(identity['groups']), 128)
        self.assertIn('PROBE_IDENTITY_GROUP_LIMIT', report['unknown_evidence'])


if __name__ == '__main__':
    unittest.main()
