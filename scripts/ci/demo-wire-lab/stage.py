"""Stage pinned public software on the Actions host, before starting the network-none lab."""
import hashlib
import importlib.util
import io
import json
import os
from pathlib import Path
import shutil
import subprocess
import tarfile
import urllib.request

ROOT = Path(__file__).resolve().parents[3]
HERE = Path(__file__).resolve().parent
NODE_VERSION = '24.19.0'
NODE_ARCHIVE = 'node-v24.19.0-linux-x64.tar.xz'
NODE_URL = 'https://nodejs.org/dist/v24.19.0/' + NODE_ARCHIVE
NODE_SHA256 = '14b342e71204f811bde6153be8e04b62aef63c236fef92b55f9c83154b409647'
PG_VERSION = '8.23.1'
PG_INTEGRITY = 'sha512-aL96AHANtWjPLDOLqnhx+ngp9+UK7ETEU8VJrDCGvsSSi/mGLcWYsS6Herg7lmaBJe4uwrfqsa7gTEFaSizDoQ=='
PG_COMMIT = '0980cefebe0ae461da8883703be049fe13ca96cf'
PG_SOURCE_BLOBS = {
    'lib/client.js': '2b13c1de74ce2742e521eb2ef71803b1da579439',
    'lib/connection.js': '85f3113a19a2f2e017630e58211c07ff04ad01ef',
    'lib/query.js': '3b93cb5bade3b5c3ac77ffe9a54086853d1a6b1a',
    'lib/result.js': '329fbf9fc615874e725d55a1026b4715414928fe',
    'lib/stream.js': 'edc3018332d999139e6b6573230e8c0553650bc0',
    'lib/connection-parameters.js': '37987fd688a49d10327aef1ab21fa7dea43b8389',
}


def require(ok, message):
    if not ok:
        raise RuntimeError('WIRE_STAGE_' + message)


def sha(data):
    return hashlib.sha256(data).hexdigest()


def validate_lock(lock):
    require(lock['lockfileVersion'] == 3 and lock['packages']['']['dependencies'] == {'pg': PG_VERSION}, 'LOCK_ROOT')
    pg = lock['packages']['node_modules/pg']
    require(pg['version'] == PG_VERSION and pg['integrity'] == PG_INTEGRITY, 'PG_IDENTITY')
    for name, package in lock['packages'].items():
        if not name:
            continue
        require(name.startswith('node_modules/') and '..' not in name.split('/') and '\\' not in name, 'PACKAGE_PATH')
        require(package['resolved'].startswith('https://registry.npmjs.org/') and package['integrity'].startswith('sha512-'), 'OFFICIAL_INTEGRITY')
        require(not package.get('hasInstallScript') and name != 'node_modules/pg-native', 'NO_NATIVE_OR_INSTALL_SCRIPT')
    return lock


def stage_runtime(output):
    require(os.environ.get('GITHUB_ACTIONS') == 'true' and os.name == 'posix', 'ACTIONS_LINUX_ONLY')
    output = Path(output)
    require(not output.exists(), 'FRESH_DIRECTORY')
    output.mkdir(parents=True)
    source_spec = importlib.util.spec_from_file_location('wire_lab_original_sources', ROOT / 'scripts/ci/demo-persistence-review/sources.py')
    sources = importlib.util.module_from_spec(source_spec)
    source_spec.loader.exec_module(sources)
    source_manifest = sources.verify_sources()
    lock_bytes = (HERE / 'deps/package-lock.json').read_bytes()
    lock = validate_lock(json.loads(lock_bytes))
    tree = output / 'tree'
    deps = tree / 'deps'
    deps.mkdir(parents=True)
    (deps / 'package.json').write_bytes((HERE / 'deps/package.json').read_bytes())
    (deps / 'package-lock.json').write_bytes(lock_bytes)
    npm = shutil.which('npm')
    node = shutil.which('node')
    require(npm and node, 'HOST_NODE_NPM_REQUIRED')
    # No inherited npm settings, auth, git credentials, lifecycle scripts or root package install.
    home = output / 'empty-home'
    home.mkdir()
    user_config, global_config = output / 'empty-user.npmrc', output / 'empty-global.npmrc'
    user_config.write_text('')
    global_config.write_text('')
    env = {'PATH': str(Path(node).parent) + ':/usr/bin:/bin', 'HOME': str(home.resolve()), 'LANG': 'C',
           'npm_config_userconfig': str(user_config.resolve()), 'npm_config_globalconfig': str(global_config.resolve()),
           'npm_config_cache': str((output / 'npm-cache').resolve()), 'npm_config_registry': 'https://registry.npmjs.org/',
           'npm_config_update_notifier': 'false'}
    install = subprocess.run([npm, 'ci', '--ignore-scripts', '--audit=false', '--fund=false'], cwd=deps,
                             env=env, capture_output=True, timeout=120)
    (output / 'npm.stdout').write_bytes(install.stdout)
    (output / 'npm.stderr').write_bytes(install.stderr)
    require(install.returncode == 0, 'NPM_CI_FAILED')
    require((deps / 'package-lock.json').read_bytes() == lock_bytes, 'LOCK_CHANGED')
    require(json.loads((deps / 'node_modules/pg/package.json').read_text())['version'] == PG_VERSION, 'INSTALLED_PG_VERSION')
    for name, expected_blob in PG_SOURCE_BLOBS.items():
        source_bytes = (deps / 'node_modules/pg' / name).read_bytes()
        git_blob = hashlib.sha1(b'blob ' + str(len(source_bytes)).encode('ascii') + b'\0' + source_bytes).hexdigest()
        require(git_blob == expected_blob, 'AUDITED_PG_SOURCE_BYTES')
    archive_path = output / NODE_ARCHIVE
    with urllib.request.urlopen(NODE_URL, timeout=60) as response:
        archive_path.write_bytes(response.read(80 * 1024 * 1024 + 1))
    archive_bytes = archive_path.read_bytes()
    require(sha(archive_bytes) == NODE_SHA256, 'NODE_ARCHIVE_SHA256')
    with tarfile.open(fileobj=io.BytesIO(archive_bytes), mode='r:xz') as archive:
        binary = archive.getmember('node-v24.19.0-linux-x64/bin/node')
        require(binary.isreg() and binary.size < 200 * 1024 * 1024, 'NODE_BINARY_MEMBER')
        (tree / 'node').write_bytes(archive.extractfile(binary).read())
    for name in ('lab_wire.mjs', 'runtime.mjs'):
        (tree / name).write_bytes((HERE / name).read_bytes())
    (tree / 'source').mkdir()
    for name in ('driver.mjs', 'owner.mjs', 'issuer.mjs', 'store.mjs'):
        (tree / 'source' / name).write_bytes((sources.SOURCE / name).read_bytes())
    files = {}
    tar_path = output / 'runtime.tar'
    with tarfile.open(tar_path, 'w', format=tarfile.USTAR_FORMAT) as tar:
        for item in sorted(tree.rglob('*')):
            require(not item.is_symlink(), 'NO_SYMLINKS')
            if item.is_dir():
                continue
            require(item.is_file(), 'REGULAR_FILES_ONLY')
            relative = item.relative_to(tree).as_posix()
            data = item.read_bytes()
            info = tarfile.TarInfo(relative)
            info.size, info.mode, info.mtime = len(data), 0o755 if relative == 'node' else 0o644, 0
            tar.addfile(info, io.BytesIO(data))
            files[relative] = sha(data)
    manifest = {'scope': 'SYNTHETIC_ACTIONS_ONLY', 'tar_sha256': sha(tar_path.read_bytes()), 'files': files,
                'node': {'version': NODE_VERSION, 'archive_sha256': NODE_SHA256, 'official_url': NODE_URL},
                'driver': {'name': 'pg', 'version': PG_VERSION, 'git_commit': PG_COMMIT, 'npm_integrity': PG_INTEGRITY,
                           'audited_source_git_blobs': PG_SOURCE_BLOBS},
                'dependency_lock_sha256': sha(lock_bytes), 'source_manifest_sha256': source_manifest['manifest_sha256'],
                'operational_wire': 'UNBOUND'}
    return tar_path, manifest
