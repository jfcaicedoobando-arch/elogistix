#!/usr/bin/env python3
"""Historical AUD54 oracle stays independent of later closure forwards; no DB."""
import hashlib
import importlib.util
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
GENERATOR = ROOT / "scripts/ci/audit54-cxc-runtime-fixtures.py"
FIXTURE = Path("scripts/ci/fixtures/audit54-cierre-post-forward.sql")
MIGRATIONS = [
    Path("supabase/migrations/20261007001300_audit139_cierre_saldo_atribuido.sql"),
    Path("supabase/migrations/20261009005400_audit54_cierre_cxc_saldo_real.sql"),
]


class HistoricalOracleTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        for relative in [FIXTURE, *MIGRATIONS]:
            target = self.root / relative
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(ROOT / relative, target)

    def generate(self):
        return subprocess.run(
            [sys.executable, str(GENERATOR), str(self.root), str(self.root / "out")],
            text=True, capture_output=True, check=False,
        )

    def test_uses_pinned_audit54_source_without_current_mirror(self):
        # No current schema mirror exists here; future forwards cannot affect it.
        result = self.generate()
        self.assertEqual(result.returncode, 0, result.stderr)
        spec = importlib.util.spec_from_file_location("audit54_fixtures", GENERATOR)
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        source = module.source((self.root / FIXTURE).read_text())
        self.assertEqual(hashlib.sha256(source.encode()).hexdigest(),
                         "17217b03c4a5d5241347d41f1edffe261ef7b905ddd7b0dcb26078a9f1ccaf77")
        assertion = (self.root / "out/assert-after.sql").read_text()
        self.assertEqual(assertion, module.source_assertion(source))
        self.assertNotIn("facturas_sin_cobertura", assertion)
        self.assertIn("AUD54 late body fault injection", (self.root / "out/late-body.sql").read_text())

    def test_fixture_drift_is_rejected(self):
        fixture = self.root / FIXTURE
        fixture.write_text(fixture.read_text().replace("BEGIN\n", "BEGIN\n-- unexpected drift\n", 1))
        result = self.generate()
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("AUD54 historical post-forward fixture changed", result.stderr)


if __name__ == "__main__":
    unittest.main()
