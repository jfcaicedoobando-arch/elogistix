#!/usr/bin/env python3
"""Check deterministic generated overlays against the reviewed output hashes."""
import hashlib
import json
from pathlib import Path
import sys

PLAN = Path(__file__).resolve().parent


def verify_overlay(output, write_manifest=False):
    expected = json.loads((PLAN / 'overlay-contract.json').read_text())
    allowed = set(expected) | ({'SHA256SUMS'} if (output / 'SHA256SUMS').exists() else set())
    if {p.name for p in output.iterdir()} != allowed:
        raise ValueError('Unexpected overlay files')
    for name, digest in expected.items():
        path = output / name
        if path.is_symlink() or not path.is_file() or hashlib.sha256(path.read_bytes()).hexdigest() != digest:
            raise ValueError(f'Generated overlay hash mismatch: {name}')
    manifest = ''.join(f'{digest}  {name}\n' for name, digest in sorted(expected.items()))
    if write_manifest:
        if (output / 'SHA256SUMS').exists():
            raise ValueError('Refusing to overwrite overlay manifest')
        (output / 'SHA256SUMS').write_text(manifest)
        # run-ci uses umask 077, but the different unprivileged container UID
        # must be able to read these allowlisted synthetic-only bind inputs.
        output.chmod(0o755)
        for name in [*expected, 'SHA256SUMS']:
            (output / name).chmod(0o644)
    elif (output / 'SHA256SUMS').read_text() != manifest:
        raise ValueError('Overlay manifest mismatch')
    return expected


if __name__ == '__main__':
    if len(sys.argv) not in (2, 3) or (len(sys.argv) == 3 and sys.argv[2] != '--write-manifest'):
        raise SystemExit('Usage: verify-overlay.py DIRECTORY [--write-manifest]')
    print(json.dumps(verify_overlay(Path(sys.argv[1]), len(sys.argv) == 3), indent=2))
