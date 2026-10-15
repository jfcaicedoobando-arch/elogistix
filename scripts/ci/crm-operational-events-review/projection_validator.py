"""Offline Draft 2020-12 validation for synthetic projection review only.

The command and schema path are fixed repository inputs. Projection values go
only through standard input, never into shell syntax, environment or argv.
No database connector, transport assertion or admission mode is implemented.
"""
import hashlib
import json
from pathlib import Path
import subprocess


REPOSITORY = Path(__file__).resolve().parents[3]
_COMMAND = r"""$ErrorActionPreference='Stop'
try {
  $json = [Console]::In.ReadToEnd()
  $schema = 'scripts/ci/crm-canonical-review/operational-capture/evidence.schema.json'
  if (-not (Test-Json -Json $json -SchemaFile $schema -ErrorAction Stop)) {
    throw 'CRM_COMPARATOR_PROJECTION_SCHEMA'
  }
  [Console]::Out.Write('CRM_COMPARATOR_SCHEMA_VALID')
} catch {
  [Console]::Error.Write('CRM_COMPARATOR_PROJECTION_SCHEMA')
  exit 1
}
"""


class ProjectionSchemaError(ValueError):
    """Fixed diagnostics deliberately exclude projection values."""


class ProjectionValidator:
    """Actual pwsh Test-Json validation, with per-instance content cache."""
    def __init__(self):
        self._accepted = set()
        self.formally_validated = 0

    def __call__(self, envelope):
        try:
            raw = json.dumps(envelope, ensure_ascii=True, allow_nan=False,
                             separators=(',', ':'), sort_keys=True)
            digest = hashlib.sha256(raw.encode('ascii')).digest()
        except (TypeError, ValueError, RecursionError):
            raise ProjectionSchemaError('CRM_COMPARATOR_PROJECTION_JSON') from None
        if digest in self._accepted:
            return True
        try:
            result = subprocess.run(
                ['pwsh', '-NoLogo', '-NoProfile', '-NonInteractive', '-Command', _COMMAND],
                input=raw, text=True, encoding='utf8', capture_output=True,
                check=False, timeout=30, cwd=REPOSITORY)
        except (OSError, subprocess.SubprocessError):
            raise ProjectionSchemaError('CRM_COMPARATOR_PROJECTION_VALIDATOR_UNAVAILABLE') from None
        if (result.returncode != 0 or result.stdout != 'CRM_COMPARATOR_SCHEMA_VALID'
                or result.stderr):
            raise ProjectionSchemaError('CRM_COMPARATOR_PROJECTION_SCHEMA')
        self._accepted.add(digest)
        self.formally_validated += 1
        return True
