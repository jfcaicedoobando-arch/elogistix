#!/usr/bin/env python3
"""Static controls only: these checks do not count as PostgreSQL evidence."""
import ast
import importlib.util
import json
import tempfile
import unittest
from pathlib import Path

HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('acceptance_runner', HERE / 'run.py')
runner = importlib.util.module_from_spec(spec)
spec.loader.exec_module(runner)


class HarnessStaticChecks(unittest.TestCase):
    def test_runner_syntax(self):
        ast.parse((HERE / 'run.py').read_text())

    def test_inventory_and_blocked_candidate(self):
        contract, index = runner.static_check()
        self.assertEqual(contract['state'], 'blocked_pending_semantic_review')
        self.assertIsNone(contract['approved_candidate'])
        self.assertGreater(len(index['files']), 1000)

    def test_git_blob_hash(self):
        self.assertEqual(runner.blob(b''), 'e69de29bb2d1d6434b8b29ae775ad8c2e48c5391')

    def test_regular_accepts_only_local_regular(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / 'safe.sql').write_text('SELECT 1;')
            self.assertEqual(runner.regular(root, 'safe.sql'), root / 'safe.sql')
            for unsafe in ('../outside.sql', '/absolute.sql', 'missing.sql'):
                with self.assertRaises(RuntimeError):
                    runner.regular(root, unsafe)
            (root / 'alias.sql').symlink_to('safe.sql')
            with self.assertRaises(RuntimeError):
                runner.regular(root, 'alias.sql')
            (root / 'folder').mkdir()
            (root / 'folder' / 'file.sql').write_text('SELECT 1;')
            (root / 'linked-folder').symlink_to('folder', target_is_directory=True)
            with self.assertRaises(RuntimeError):
                runner.regular(root, 'linked-folder/file.sql')

    def test_no_business_mock_in_new_sql(self):
        # Newly defined functions are temporary test helpers or explicit
        # fail-closed platform boundaries; public business functions are replayed.
        for name in ('neutral-cases.sql', 'preconditions.sql', 'platform-failclosed.sql'):
            content = (HERE / name).read_text()
            self.assertNotRegex(content, r'(?i)CREATE(?: OR REPLACE)? FUNCTION public\.')
            self.assertNotRegex(content, r'(?i)(DISABLE TRIGGER|session_replication_role|ALTER POLICY|\bBYPASSRLS\b|GRANT EXECUTE)')
        sql = (HERE / 'neutral-cases.sql').read_text()
        self.assertIn("ok IS DISTINCT FROM true", sql)
        self.assertIn("SQLSTATE IS DISTINCT FROM code", sql)
        self.assertTrue(sql.rstrip().endswith('ROLLBACK;'))


if __name__ == '__main__':
    unittest.main(verbosity=2)
