import json
from pathlib import Path
import shutil
import tempfile
import unittest

from public_source import BODY_SHA256, UPSTREAM, verify_source


class PublicSource(unittest.TestCase):
    def test_exact_public_source_is_reversibly_verified(self):
        result = verify_source()
        self.assertEqual(result['body_sha256'], BODY_SHA256)
        self.assertEqual(len(result['body']), 729)
        self.assertEqual(result['scope'], 'PUBLIC_SOURCE_ONLY_NOT_OPERATIONAL_ADMISSION')

    def test_body_whitespace_is_not_normalized(self):
        with tempfile.TemporaryDirectory() as temp:
            path = Path(temp)
            shutil.copytree(UPSTREAM, path, dirs_exist_ok=True)
            body = path / 'pgrst_ddl_watch.prosrc'
            body.write_bytes(body.read_bytes().strip())
            with self.assertRaisesRegex(ValueError, 'BODY_BYTES'):
                verify_source(path)

    def test_full_migration_and_license_are_bound_too(self):
        for filename in ('20220321174452_fix-postgrest-alter-type-event-trigger.sql', 'LICENSE'):
            with self.subTest(filename=filename), tempfile.TemporaryDirectory() as temp:
                path = Path(temp)
                shutil.copytree(UPSTREAM, path, dirs_exist_ok=True)
                file = path / filename
                file.write_bytes(file.read_bytes() + b'\n')
                with self.assertRaises(ValueError):
                    verify_source(path)

    def test_retargeted_provenance_is_rejected(self):
        with tempfile.TemporaryDirectory() as temp:
            path = Path(temp)
            shutil.copytree(UPSTREAM, path, dirs_exist_ok=True)
            file = path / 'provenance.json'
            value = json.loads(file.read_text())
            value['commit'] = '0' * 40
            file.write_text(json.dumps(value))
            with self.assertRaisesRegex(ValueError, 'PROVENANCE'):
                verify_source(path)


if __name__ == '__main__':
    unittest.main()
