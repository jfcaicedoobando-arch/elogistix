"""Synthetic archives test intake rejection, never the unavailable proposal."""
import hashlib
import io
from pathlib import Path
import stat
import tempfile
import unittest
import zipfile

from intake import InputError, _validate_archive, verify_bundle


def synthetic_archive(payload=None, manifest=None, extra_entries=()):
    payload = payload if payload is not None else {'proposal/store.sql': b'-- SYNTHETIC; not the proposed SQL\r\n'}
    if manifest is None:
        manifest = ''.join(hashlib.sha256(data).hexdigest() + '  ' + name.removeprefix('proposal/') + '\n'
                           for name, data in payload.items()).encode()
    out = io.BytesIO()
    with zipfile.ZipFile(out, 'w') as archive:
        for name, data in payload.items():
            archive.writestr(name, data)
        archive.writestr('proposal/TRANSFER-SHA256SUMS', manifest)
        for name, data in extra_entries:
            archive.writestr(name, data)
    return out.getvalue()


def validate_synthetic(data):
    return _validate_archive(data, hashlib.sha256(data).hexdigest())


class IntakeTests(unittest.TestCase):
    def test_exact_raw_store_bytes_no_newline_normalization(self):
        data = synthetic_archive()
        result = validate_synthetic(data)
        self.assertEqual(result['store_sha256'], hashlib.sha256(b'-- SYNTHETIC; not the proposed SQL\r\n').hexdigest())
        self.assertEqual(result['postgres_lane'], 'NOT_RUN')
        self.assertEqual(result['wire'], 'UNBOUND')

    def test_public_verifier_cannot_accept_synthetic_zip_or_override_pin(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'synthetic.zip'
            path.write_bytes(synthetic_archive())
            with self.assertRaisesRegex(InputError, 'ZIP SHA256 mismatch'):
                verify_bundle(path)

    def test_absent_input(self):
        with tempfile.TemporaryDirectory() as directory:
            with self.assertRaisesRegex(InputError, 'materialization is absent'):
                verify_bundle(Path(directory) / 'absent.zip')

    def test_member_tampering(self):
        manifest = (hashlib.sha256(b'original').hexdigest() + '  store.sql\n').encode()
        with self.assertRaisesRegex(InputError, 'TRANSFER-SHA256SUMS mismatch'):
            validate_synthetic(synthetic_archive(manifest=manifest))

    def test_unlisted_payload(self):
        with self.assertRaisesRegex(InputError, 'cover exactly'):
            validate_synthetic(synthetic_archive(extra_entries=[('proposal/unlisted.txt', b'payload')]))

    def test_missing_manifest_payload(self):
        manifest = (hashlib.sha256(b'x').hexdigest() + '  absent.sql\n').encode()
        with self.assertRaisesRegex(InputError, 'cover exactly'):
            validate_synthetic(synthetic_archive(manifest=manifest))

    def test_traversal_absolute_and_windows_paths(self):
        for name in ('../store.sql', '/store.sql', 'C:/store.sql', 'a\\store.sql', 'a/./store.sql', 'a//store.sql'):
            with self.subTest(name=name), self.assertRaises(InputError):
                validate_synthetic(synthetic_archive(payload={name: b'x'}, manifest=b''))

    def test_case_collision(self):
        with self.assertRaisesRegex(InputError, 'case-colliding'):
            validate_synthetic(synthetic_archive(extra_entries=[('proposal/STORE.SQL', b'x')]))

    def test_nul_header_cannot_be_hidden_by_zipfile_filename_truncation(self):
        payload = b'-- SYNTHETIC'
        out = io.BytesIO()
        with zipfile.ZipFile(out, 'w') as archive:
            archive.writestr('proposal/store.sqlXevil', payload)
            archive.writestr('proposal/TRANSFER-SHA256SUMS',
                             hashlib.sha256(payload).hexdigest() + '  store.sql\n')
        # Change both length-preserving header names; payload and its CRC stay intact.
        raw = out.getvalue().replace(b'proposal/store.sqlXevil', b'proposal/store.sql\x00evil')
        with self.assertRaisesRegex(InputError, 'normalized or truncated'):
            validate_synthetic(raw)

    def test_duplicate_checksum(self):
        record = hashlib.sha256(b'x').hexdigest() + '  store.sql\n'
        with self.assertRaisesRegex(InputError, 'Duplicate checksum'):
            validate_synthetic(synthetic_archive(manifest=(record * 2).encode()))

    def test_duplicate_manifest(self):
        with self.assertRaisesRegex(InputError, 'Exactly one TRANSFER'):
            validate_synthetic(synthetic_archive(extra_entries=[('other/TRANSFER-SHA256SUMS', b'')]))

    def test_symlink_member(self):
        link = zipfile.ZipInfo('proposal/link')
        link.create_system = 3
        link.external_attr = (stat.S_IFLNK | 0o777) << 16
        with self.assertRaisesRegex(InputError, 'symlinks refused'):
            validate_synthetic(synthetic_archive(extra_entries=[(link, b'store.sql')]))

    def test_store_cannot_be_substituted(self):
        with self.assertRaisesRegex(InputError, 'Exactly one store.sql'):
            validate_synthetic(synthetic_archive(payload={'proposal/fixture.sql': b'-- synthetic'}))

    def test_malformed_checksum(self):
        with self.assertRaisesRegex(InputError, 'Unsupported TRANSFER'):
            validate_synthetic(synthetic_archive(manifest=b'not-a-digest  store.sql\n'))

    def test_invalid_zip(self):
        with self.assertRaisesRegex(InputError, 'Unreadable ZIP'):
            validate_synthetic(b'not-a-zip')


if __name__ == '__main__':
    unittest.main()
