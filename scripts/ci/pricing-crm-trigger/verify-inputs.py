#!/usr/bin/env python3
"""Validate the complete frozen bundle and the separate CI-only candidate."""
import hashlib
import json
from pathlib import Path
import re
import subprocess
import sys

PLAN = Path(__file__).resolve().parent
BUNDLE = PLAN.parent / 'pricing-rpc-bounded'
IMAGE = 'postgres@sha256:66b6a97eac1771fc78bd201b918b4253859f436c6913aeede97bd5366cce89ae'
FROZEN_HEAD = 'd1e94d2d45195e21a55b4d40970a8f0275d4a2af'
MIGRATION_HASH = '25548288f0ca87b0cd458de65a0a5aa1ababd09e6be2e7f25763bf75540a1c74'
BUILDER_HASH = 'd3154291e5041dcac8fbf197380486518a9f640b3f294a9fb52fed23eb8d54ce'


def verify_manifest(directory, manifest, excluded=()):
    if manifest.is_symlink() or not manifest.is_file():
        raise ValueError('Missing or symlinked manifest')
    entries = {}
    for line in manifest.read_text().splitlines():
        match = re.fullmatch(r'([a-f0-9]{64})  ([a-zA-Z0-9_.-]+)', line)
        if not match or match[2] in entries:
            raise ValueError('Malformed or duplicate hash entry')
        entries[match[2]] = match[1]
    if not entries or set(entries) != {p.name for p in directory.iterdir()} - set(excluded):
        raise ValueError('Unexpected or missing manifest input')
    for name, digest in entries.items():
        path = directory / name
        if path.is_symlink() or not path.is_file() or hashlib.sha256(path.read_bytes()).hexdigest() != digest:
            raise ValueError(f'Input hash mismatch or nonregular file: {name}')
    return entries


def verify_inputs():
    frozen = verify_manifest(BUNDLE, PLAN / 'frozen-SHA256SUMS')
    candidate = verify_manifest(PLAN, PLAN / 'SHA256SUMS', ('SHA256SUMS',))
    if candidate['candidate-migration.sql'] != MIGRATION_HASH or candidate['build-overlay.py'] != BUILDER_HASH:
        raise ValueError('Candidate does not match the independently reviewed migration/overlay')
    subprocess.run([sys.executable, '-B', str(BUNDLE / 'verify-bundle.py')], check=True, capture_output=True)
    old = (BUNDLE / 'run.sh').read_text()
    # The extracted load/revoke and final ACL SQL must remain literally equivalent.
    load = old.split('cat > "$RUN/load.sql" <<SQL\n', 1)[1].split("\\i '$ASSERTIONS'", 1)[0]
    load = load.replace("'$PLAN/", "'/bundle/").replace("'$REPLAY'", "'/bundle/replay.sql'").replace('\\$', '$')
    acl = 'DO $final_acl$' + old.split('DO \\$final_acl\\$', 1)[1].split('\\$final_acl\\$;', 1)[0] + '$final_acl$;\n'
    if (PLAN / 'load.sql').read_text() != load or (PLAN / 'final-acl.sql').read_text() != acl:
        raise ValueError('Frozen load/revoke or final ACL contract was changed')
    return {'status': 'verified', 'frozen_head': FROZEN_HEAD, 'frozen_files': frozen,
            'candidate_files': candidate, 'image': IMAGE, 'sql_executed': False}


if __name__ == '__main__':
    if len(sys.argv) != 1:
        raise SystemExit('No external input paths are accepted')
    print(json.dumps(verify_inputs(), indent=2))
