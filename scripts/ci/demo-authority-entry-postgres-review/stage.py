"""New composition of the unchanged golden runtime. Never invoke its historical gate."""
import hashlib
import io
import json
import os
from pathlib import Path
import shutil
import subprocess
import tarfile
import urllib.request

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
GOLDEN = ROOT / 'scripts/ci/demo-wire-lab'
OWNER = 'docs/review/demo-durable-owner-adapter-20261015/'
MODULES = ('driver.mjs', 'issuer.mjs', 'store.mjs', 'authority-provider.mjs', 'issuer-entry.mjs')
CONTRACT = 'scripts/ci/demo-authority-bridge-review/contract.mjs'


def require(ok, code):
    if not ok:
        raise RuntimeError('ENTRY_STAGE_' + code)


def sha(data):
    return hashlib.sha256(data).hexdigest()


def stage_runtime(output, golden_stage, frozen):
    require(os.environ.get('GITHUB_ACTIONS') == 'true' and os.name == 'posix', 'ACTIONS_LINUX_ONLY')
    output = Path(output)
    require(not output.exists(), 'FRESH_DIRECTORY')
    output.mkdir(parents=True)
    tree, deps = output / 'tree', output / 'tree/deps'
    deps.mkdir(parents=True)
    lock_bytes = frozen['scripts/ci/demo-wire-lab/deps/package-lock.json']
    golden_stage.validate_lock(json.loads(lock_bytes))
    (deps / 'package.json').write_bytes(frozen['scripts/ci/demo-wire-lab/deps/package.json'])
    (deps / 'package-lock.json').write_bytes(lock_bytes)
    npm, node = shutil.which('npm'), shutil.which('node')
    require(npm and node, 'HOST_NODE_NPM_REQUIRED')
    home = output / 'empty-home'; home.mkdir()
    user_config, global_config = output / 'empty-user.npmrc', output / 'empty-global.npmrc'
    user_config.write_text(''); global_config.write_text('')
    env = {'PATH': str(Path(node).parent) + ':/usr/bin:/bin', 'HOME': str(home.resolve()), 'LANG': 'C',
           'npm_config_userconfig': str(user_config.resolve()), 'npm_config_globalconfig': str(global_config.resolve()),
           'npm_config_cache': str((output / 'npm-cache').resolve()), 'npm_config_registry': 'https://registry.npmjs.org/',
           'npm_config_update_notifier': 'false'}
    installed = subprocess.run([npm, 'ci', '--ignore-scripts', '--audit=false', '--fund=false'], cwd=deps,
                               env=env, capture_output=True, timeout=120)
    (output / 'npm.stdout').write_bytes(installed.stdout); (output / 'npm.stderr').write_bytes(installed.stderr)
    require(installed.returncode == 0, 'NPM_INSTALL_FAILED')
    require((deps / 'package-lock.json').read_bytes() == lock_bytes, 'LOCK_CHANGED')
    require(json.loads((deps / 'node_modules/pg/package.json').read_text())['version'] == golden_stage.PG_VERSION, 'PG_VERSION')
    for name, expected in golden_stage.PG_SOURCE_BLOBS.items():
        data = (deps / 'node_modules/pg' / name).read_bytes()
        require(hashlib.sha1(b'blob ' + str(len(data)).encode() + b'\0' + data).hexdigest() == expected, 'AUDITED_PG_SOURCE')
    with urllib.request.urlopen(golden_stage.NODE_URL, timeout=60) as response:
        archive_bytes = response.read(80 * 1024 * 1024 + 1)
    require(sha(archive_bytes) == golden_stage.NODE_SHA256, 'NODE_ARCHIVE')
    with tarfile.open(fileobj=io.BytesIO(archive_bytes), mode='r:xz') as archive:
        binary = archive.getmember('node-v24.19.0-linux-x64/bin/node')
        require(binary.isreg() and binary.size < 200 * 1024 * 1024, 'NODE_BINARY_MEMBER')
        (tree / 'node').write_bytes(archive.extractfile(binary).read())
    # Golden archive/transfer validators require its historical files unchanged.
    # Its runtime is preserved for provenance but is NEVER executed by this lane.
    for name in ('lab_wire.mjs', 'runtime.mjs'):
        (tree / name).write_bytes(frozen['scripts/ci/demo-wire-lab/' + name])
    (tree / 'source').mkdir()
    for name in ('driver.mjs', 'owner.mjs', 'issuer.mjs', 'store.mjs'):
        (tree / 'source' / name).write_bytes(frozen[OWNER + name])
    for path in [*(OWNER + name for name in MODULES), CONTRACT]:
        target = tree / 'repo' / path; target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(frozen[path])
    (tree / 'authority-runtime.mjs').write_bytes((HERE / 'runtime.mjs').read_bytes())
    files = {}
    tar_path = output / 'runtime.tar'
    with tarfile.open(tar_path, 'w', format=tarfile.USTAR_FORMAT) as archive:
        for item in sorted(tree.rglob('*')):
            require(not item.is_symlink(), 'SYMLINK')
            if item.is_dir():
                continue
            require(item.is_file(), 'REGULAR_FILE')
            relative = item.relative_to(tree).as_posix(); data = item.read_bytes()
            info = tarfile.TarInfo(relative)
            info.size, info.mode, info.mtime = len(data), 0o755 if relative == 'node' else 0o644, 0
            archive.addfile(info, io.BytesIO(data)); files[relative] = sha(data)
    return tar_path, {'scope': 'ISOLATED_AUTHORITY_ENTRY_INTEGRATION_ONLY',
        'tar_sha256': sha(tar_path.read_bytes()), 'files': files,
        'node': {'version': golden_stage.NODE_VERSION, 'archive_sha256': golden_stage.NODE_SHA256},
        'driver': {'name': 'pg', 'version': golden_stage.PG_VERSION, 'git_commit': golden_stage.PG_COMMIT,
                   'npm_integrity': golden_stage.PG_INTEGRITY, 'audited_source_git_blobs': golden_stage.PG_SOURCE_BLOBS},
        'dependency_lock_sha256': sha(lock_bytes), 'operational_wire': 'UNBOUND'}
