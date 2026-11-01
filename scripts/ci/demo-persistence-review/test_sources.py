import json
from pathlib import Path
import shutil
import tempfile
import unittest

from sources import NAMES, SOURCE, SOURCE_COMMIT, STORE_SHA256, verify_sources


class GitInputTests(unittest.TestCase):
    def test_exact_authored_sources_and_empty_config(self):
        value = verify_sources()
        self.assertEqual(value['source_commit'], SOURCE_COMMIT)
        self.assertEqual(value['store_sha256'], STORE_SHA256)
        self.assertEqual(len(value['files']), 12)
        self.assertEqual(value['wire'], 'UNBOUND')
        self.assertEqual(value['configuration'], 'EMPTY')

    def test_source_tampering_and_extra_files_reject(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory) / 'input'
            shutil.copytree(SOURCE, root)
            store = root / 'store.sql'
            store.write_bytes(store.read_bytes().replace(b'\n', b'\r\n'))
            with self.assertRaisesRegex(ValueError, 'PAYLOAD_HASH'):
                verify_sources(root)
            store.write_bytes((SOURCE / 'store.sql').read_bytes())
            (root / 'unlisted.sql').write_bytes(b'-- SYNTHETIC')
            with self.assertRaisesRegex(ValueError, 'EXACT_FILE_SET'):
                verify_sources(root)

    def test_manifest_pin_cannot_be_rewritten(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory) / 'input'
            shutil.copytree(SOURCE, root)
            manifest = root / 'SHA256SUMS.txt'
            manifest.write_bytes(manifest.read_bytes() + b'\n')
            with self.assertRaisesRegex(ValueError, 'MANIFEST_HASH'):
                verify_sources(root)

    def test_missing_source_members_reject_before_hash_checks(self):
        for name in sorted(NAMES):
            with self.subTest(name=name), tempfile.TemporaryDirectory() as directory:
                root = Path(directory) / 'input'
                shutil.copytree(SOURCE, root)
                (root / name).unlink()
                with self.assertRaisesRegex(ValueError, '^PERSISTENCE_SOURCE_EXACT_FILE_SET$'):
                    verify_sources(root)

    def test_symlink_source_members_reject_before_hash_checks(self):
        for name in sorted(NAMES):
            with self.subTest(name=name), tempfile.TemporaryDirectory() as directory:
                root = Path(directory) / 'input'
                shutil.copytree(SOURCE, root)
                (root / name).unlink()
                (root / name).symlink_to(SOURCE / name)
                with self.assertRaisesRegex(ValueError, '^PERSISTENCE_SOURCE_REGULAR_FILES$'):
                    verify_sources(root)

    def test_source_member_directories_reject_before_hash_checks(self):
        for name in sorted(NAMES):
            with self.subTest(name=name), tempfile.TemporaryDirectory() as directory:
                root = Path(directory) / 'input'
                shutil.copytree(SOURCE, root)
                (root / name).unlink()
                (root / name).mkdir()
                with self.assertRaisesRegex(ValueError, '^PERSISTENCE_SOURCE_REGULAR_FILES$'):
                    verify_sources(root)

    def test_symlink_source_directory_rejects_before_inventory_checks(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory) / 'input'
            root.symlink_to(SOURCE, target_is_directory=True)
            with self.assertRaisesRegex(ValueError, '^PERSISTENCE_SOURCE_DIRECTORY$'):
                verify_sources(root)


if __name__ == '__main__':
    unittest.main()
