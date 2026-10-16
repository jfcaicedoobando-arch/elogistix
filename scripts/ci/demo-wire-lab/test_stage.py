"""Offline supply-chain rejection checks; no npm, downloads or database."""
import copy
import json
from pathlib import Path
import unittest
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


if __name__ == '__main__':
    unittest.main()
