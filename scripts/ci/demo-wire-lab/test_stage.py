"""Offline supply-chain rejection checks; no npm, downloads or database."""
import copy
import io
import json
import os
from pathlib import Path
import subprocess
import sys
import tarfile
import tempfile
from types import SimpleNamespace
import unittest
from unittest.mock import patch
import stage
from stage import validate_lock, stage_runtime


class StageTests(unittest.TestCase):
    def setUp(self):
        self.lock = json.loads((Path(__file__).parent / 'deps/package-lock.json').read_text())

    def test_official_exact_driver(self):
        self.assertIs(validate_lock(self.lock), self.lock)

    def test_driver_integrity_drift(self):
        self.lock['packages']['node_modules/pg']['integrity'] = 'sha512-wrong'
        with self.assertRaisesRegex(RuntimeError, 'PG_IDENTITY'):
            validate_lock(self.lock)

    def test_registry_and_scripts(self):
        for key, value in [('resolved', 'https://untrusted.invalid/package.tgz'), ('hasInstallScript', True)]:
            changed = copy.deepcopy(self.lock)
            changed['packages']['node_modules/pg'][key] = value
            with self.assertRaises(RuntimeError):
                validate_lock(changed)

    def test_non_actions_refuses_before_files(self):
        import os
        from unittest.mock import patch
        with patch.dict(os.environ, {}, clear=True), self.assertRaisesRegex(RuntimeError, 'ACTIONS_LINUX_ONLY'):
            stage_runtime(Path('must-not-create-wire-runtime'))


def synthetic_tar(package, payload, *, name=None, kind=tarfile.REGTYPE, duplicate=False, declared_size=None):
    data = io.BytesIO()
    with tarfile.open(fileobj=data, mode='w') as archive:
        for _ in range(2 if duplicate else 1):
            member = tarfile.TarInfo(package['member'] if name is None else name)
            member.type = kind
            member.mode = 0o644
            if kind == tarfile.REGTYPE:
                member.size = len(payload) if declared_size is None else declared_size
                archive.addfile(member, io.BytesIO(payload))
            else:
                member.linkname = '/untrusted-host-file'
                archive.addfile(member)
    return data.getvalue()


class NativeLibraryTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.output = Path(self.directory.name)
        self.tree = self.output / 'tree'
        self.tree.mkdir()
        self.packages = copy.deepcopy(stage.LIBATOMIC_PACKAGES)
        self.payloads, self.archives, self.tars = {}, {}, {}
        for package in self.packages:
            payload = bytearray(package['bytes'])
            if package['package'] == 'libatomic1':
                payload[:7] = b'\x7fELF\x02\x01\x01'
                payload[16:20] = b'\x03\x00\x3e\x00'
            else:
                payload[:9] = b'COPYRIGHT'
            payload = bytes(payload)
            archive = (package['package'].encode() + b'\n').ljust(package['archive_bytes'], b'0')
            package.update(sha256=stage.sha(payload), archive_sha256=stage.sha(archive))
            self.payloads[package['package']] = payload
            self.archives[package['official_url']] = archive
            self.tars[package['archive']] = synthetic_tar(package, payload)
        self.files = {item['destination']: item['sha256'] for item in self.packages}
        self.addCleanup(patch.stopall)
        patch.object(stage, 'LIBATOMIC_PACKAGES', self.packages).start()
        patch.object(stage, 'LIBATOMIC_FILES', self.files).start()
        self.download = patch.object(stage.urllib.request, 'urlopen', side_effect=self.open_archive).start()
        patch.object(stage.shutil, 'which', return_value='/usr/bin/dpkg-deb').start()
        self.dpkg = patch.object(stage.subprocess, 'run', side_effect=self.unpack_archive).start()

    def open_archive(self, url, timeout):
        self.assertEqual(timeout, 30)
        self.assertIn(url, self.archives)
        return io.BytesIO(self.archives[url])

    def unpack_archive(self, argv, **kwargs):
        self.assertEqual(argv[:2], ['/usr/bin/dpkg-deb', '--fsys-tarfile'])
        self.assertEqual(kwargs, {'capture_output': True, 'env': {'PATH': '/usr/bin:/bin', 'LANG': 'C'}, 'timeout': 30})
        return SimpleNamespace(returncode=0, stdout=self.tars[Path(argv[2]).name], stderr=b'')

    def test_stages_only_verified_regular_library_and_complete_copyright(self):
        metadata = stage.stage_native_library(self.output, self.tree)
        self.assertEqual(metadata['files'], self.files)
        self.assertEqual(len(metadata['source_packages']), 2)
        self.assertEqual(set(p.relative_to(self.tree).as_posix() for p in self.tree.rglob('*') if p.is_file()), set(self.files))
        for package in self.packages:
            target = self.tree / package['destination']
            self.assertFalse(target.is_symlink())
            self.assertEqual(target.read_bytes(), self.payloads[package['package']])
            self.assertEqual(target.stat().st_mode & 0o777, 0o644)

    def test_changed_download_rejects_before_any_decompressor_or_library(self):
        url = self.packages[0]['official_url']
        self.archives[url] = b'X' + self.archives[url][1:]
        with self.assertRaisesRegex(RuntimeError, 'LIBATOMIC_ARCHIVE_SHA256'):
            stage.stage_native_library(self.output, self.tree)
        self.dpkg.assert_not_called()
        self.assertFalse((self.tree / 'lib').exists())

    def test_download_size_and_timeout_fail_before_decompression(self):
        url = self.packages[0]['official_url']
        self.archives[url] += b'oversize'
        with self.assertRaisesRegex(RuntimeError, 'LIBATOMIC_ARCHIVE_SIZE'):
            stage.stage_native_library(self.output, self.tree)
        self.dpkg.assert_not_called()
        self.download.side_effect = TimeoutError('private transport details')
        with self.assertRaisesRegex(RuntimeError, '^WIRE_STAGE_LIBATOMIC_DOWNLOAD_FAILED$'):
            stage.stage_native_library(self.output, self.tree)
        self.assertFalse((self.tree / 'lib').exists())

    def test_missing_duplicate_link_wrong_size_and_changed_payload_reject(self):
        package = self.packages[0]
        payload = self.payloads[package['package']]
        failures = [
            (synthetic_tar(package, payload, name='./other'), 'EXACT_MEMBER'),
            (synthetic_tar(package, payload, duplicate=True), 'EXACT_MEMBER'),
            (synthetic_tar(package, payload, kind=tarfile.SYMTYPE), 'REGULAR_MEMBER'),
            (synthetic_tar(package, payload, kind=tarfile.LNKTYPE), 'REGULAR_MEMBER'),
            (synthetic_tar(package, payload, declared_size=len(payload) - 1), 'MEMBER_SIZE'),
            (synthetic_tar(package, b'X' + payload[1:]), 'MEMBER_SHA256'),
        ]
        for number, (tar, code) in enumerate(failures):
            with self.subTest(code=code):
                output = self.output / str(number)
                tree = output / 'tree'
                tree.mkdir(parents=True)
                self.tars[package['archive']] = tar
                with self.assertRaisesRegex(RuntimeError, 'LIBATOMIC_' + code):
                    stage.stage_native_library(output, tree)
                self.assertFalse((tree / 'lib').exists())

    def test_copyright_failure_cannot_leave_a_loader_visible_library(self):
        package = self.packages[1]
        self.tars[package['archive']] = synthetic_tar(package, b'changed copyright')
        with self.assertRaisesRegex(RuntimeError, 'LIBATOMIC_MEMBER_SIZE'):
            stage.stage_native_library(self.output, self.tree)
        self.assertFalse((self.tree / 'lib').exists())

    def test_elf_machine_and_format_are_required_even_with_matching_payload_hash(self):
        package = self.packages[0]
        payload = bytearray(self.payloads[package['package']])
        payload[18:20] = b'\xb7\x00'  # AArch64 is not the frozen amd64 runtime.
        package['sha256'] = stage.sha(payload)
        self.tars[package['archive']] = synthetic_tar(package, bytes(payload))
        with self.assertRaisesRegex(RuntimeError, 'LIBATOMIC_ELF_LINUX_AMD64'):
            stage.stage_native_library(self.output, self.tree)

    def test_dpkg_timeout_failure_and_oversized_tar_do_not_create_library(self):
        for number, outcome in enumerate([
            subprocess.TimeoutExpired('dpkg-deb', 30),
            SimpleNamespace(returncode=2, stdout=b'', stderr=b'private host details'),
            SimpleNamespace(returncode=0, stdout=b'X' * (stage.MAX_DEB_TAR_BYTES + 1), stderr=b''),
        ]):
            with self.subTest(number=number):
                output = self.output / str(number)
                tree = output / 'tree'
                tree.mkdir(parents=True)
                self.dpkg.side_effect = outcome if isinstance(outcome, Exception) else None
                if not isinstance(outcome, Exception):
                    self.dpkg.return_value = outcome
                with self.assertRaisesRegex(RuntimeError, 'LIBATOMIC_(DPKG_TIMEOUT|DPKG_FAILED|TAR_SIZE)'):
                    stage.stage_native_library(output, tree)
                self.assertFalse((tree / 'lib').exists())

    def test_existing_library_directory_and_foreign_platform_reject_before_download(self):
        (self.tree / 'lib').symlink_to(self.output / 'untrusted-target')
        with self.assertRaisesRegex(RuntimeError, 'LIBATOMIC_FRESH_DIRECTORY'):
            stage.stage_native_library(self.output, self.tree)
        self.download.assert_not_called()
        with patch.object(stage.platform, 'machine', return_value='aarch64'):
            with self.assertRaisesRegex(RuntimeError, 'LIBATOMIC_LINUX_AMD64_ONLY'):
                stage.stage_native_library(self.output, self.tree)
        self.download.assert_not_called()

    def test_native_smoke_uses_only_private_loader_directory_and_no_inherited_env(self):
        output = self.output / 'smoke'
        expected = {'version': 'v' + stage.NODE_VERSION, 'loadedPinnedLibrary': True}
        calls = []
        def node_run(argv, **kwargs):
            calls.append((argv, kwargs))
            self.assertEqual(kwargs['env'], {'PATH': '/usr/bin:/bin', 'LANG': 'C',
                                            'LD_LIBRARY_PATH': str(output / 'tree/lib')})
            self.assertEqual(kwargs['cwd'], output)
            self.assertEqual(kwargs['timeout'], 30)
            return SimpleNamespace(returncode=0, stdout=(('v' + stage.NODE_VERSION + '\n').encode()
                                  if argv[1] == '--version' else json.dumps(expected).encode()), stderr=b'')
        with patch.object(stage, 'stage_native_library', return_value={'files': self.files}), \
             patch.dict(os.environ, {'LD_PRELOAD': '/private/preload', 'LD_LIBRARY_PATH': '/private/libs:',
                                     'NODE_OPTIONS': '--require=/private/inject', 'PGPASSWORD': 'private'}, clear=True):
            self.dpkg.side_effect = node_run
            result = stage.verify_native_runtime(output, Path('/bin/true'))
        self.assertEqual(result, {**expected, 'files': self.files})
        self.assertEqual(len(calls), 2)
        self.assertIn('process.report.getReport().sharedObjects.includes(p)', calls[1][0][-1])

    def test_native_smoke_rejects_wrong_node_version_and_unloaded_library(self):
        with patch.object(stage, 'stage_native_library', return_value={'files': self.files}):
            self.dpkg.side_effect = [SimpleNamespace(returncode=0, stdout=b'v24.22.1\n', stderr=b'')]
            with self.assertRaisesRegex(RuntimeError, 'LIBATOMIC_NODE_VERSION'):
                stage.verify_native_runtime(self.output / 'old-node', Path('/bin/true'))
            self.dpkg.side_effect = [
                SimpleNamespace(returncode=0, stdout=('v' + stage.NODE_VERSION + '\n').encode(), stderr=b''),
                SimpleNamespace(returncode=1, stdout=b'', stderr=b'private loader failure'),
            ]
            with self.assertRaisesRegex(RuntimeError, 'LIBATOMIC_LOADER_PROBE'):
                stage.verify_native_runtime(self.output / 'unloaded', Path('/bin/true'))


class NativeCliTests(unittest.TestCase):
    def test_invalid_node_path_has_bounded_public_json_without_host_details_or_download(self):
        with tempfile.TemporaryDirectory() as temporary:
            private = Path(temporary) / 'private-node-not-present'
            output = Path(temporary) / 'must-not-create'
            result = subprocess.run([sys.executable, '-B', str(Path(stage.__file__).resolve()),
                                     '--verify-native-runtime', '--output', str(output), '--node', str(private)],
                                    capture_output=True, timeout=5)
            self.assertEqual(result.returncode, 1)
            self.assertLess(len(result.stdout), 256)
            self.assertEqual(json.loads(result.stdout), {'status': 'FAIL', 'code': 'WIRE_STAGE_LIBATOMIC_SMOKE_FAILED'})
            self.assertEqual(result.stderr, b'')
            self.assertFalse(output.exists())
            self.assertNotIn(str(private).encode(), result.stdout)


if __name__ == '__main__':
    unittest.main()
