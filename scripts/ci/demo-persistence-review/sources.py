"""Pinned Git-source intake, independent of the unavailable Library ZIP."""
import hashlib
import json
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[3]
SOURCE = ROOT / 'docs/review/demo-durable-owner-adapter-20261015'
SOURCE_COMMIT = '860ac59cc9b6d80887c1a7811e2c81ef8ef17ca8'
SOURCE_BASE = '5d1f00d27628100a58ab166367a067ea90068b84'
MANIFEST_SHA256 = 'd0a7c1655f9d137f7c88d5489318f42639f7c2548ec627fec7134363afbc2335'
STORE_SHA256 = 'fb7fa69c17eca7230606ecb6217086c6eb5317d75551df9efc268959f69140a7'
NAMES = frozenset(('README.md', 'RUNTIME_PLAN.md', 'SHA256SUMS.txt', 'config.example.json',
                   'driver.mjs', 'issuer.mjs', 'owner.mjs', 'owner.test.mjs', 'store.mjs',
                   'store.sql', 'tests.tap', 'validation.json'))


def require(ok, message):
    if not ok:
        raise ValueError('PERSISTENCE_SOURCE_' + message)


def digest(data):
    return hashlib.sha256(data).hexdigest()


def verify_sources(directory=SOURCE):
    directory = Path(directory)
    require(directory.is_dir() and not directory.is_symlink(), 'DIRECTORY')
    require({p.name for p in directory.iterdir()} == NAMES, 'EXACT_FILE_SET')
    require(all((directory / name).is_file() and not (directory / name).is_symlink()
                for name in NAMES), 'REGULAR_FILES')
    raw = {name: (directory / name).read_bytes() for name in NAMES}
    manifest = raw['SHA256SUMS.txt']
    require(digest(manifest) == MANIFEST_SHA256, 'MANIFEST_HASH')
    checksums = {}
    for line in manifest.decode('utf-8').splitlines():
        match = re.fullmatch(r'([0-9a-f]{64})  ([A-Za-z0-9_.-]+)', line)
        require(match is not None, 'MANIFEST_RECORD')
        checksum, name = match.groups()
        require(name in NAMES and name not in checksums, 'MANIFEST_MEMBERS')
        checksums[name] = checksum
    require(set(checksums) == NAMES - {'SHA256SUMS.txt'}, 'MANIFEST_COVERAGE')
    require(all(digest(raw[name]) == checksum for name, checksum in checksums.items()), 'PAYLOAD_HASH')
    require(digest(raw['store.sql']) == STORE_SHA256, 'STORE_HASH')
    config = json.loads(raw['config.example.json'])
    require(isinstance(config, dict) and bool(config) and all(value == '' for value in config.values()), 'EMPTY_CONFIG')
    return {'source_commit': SOURCE_COMMIT, 'source_base': SOURCE_BASE,
            'source_route': 'pinned Git files; not Library ZIP materialization',
            'manifest_sha256': MANIFEST_SHA256, 'store_sha256': STORE_SHA256,
            'files': {name: digest(data) for name, data in sorted(raw.items())},
            'wire': 'UNBOUND', 'configuration': 'EMPTY'}
