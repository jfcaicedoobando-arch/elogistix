"""Stage pinned public software on the Actions host, before starting the network-none lab."""
import argparse
import hashlib
import importlib.util
import io
import json
import os
from pathlib import Path
import platform
import shutil
import subprocess
import sys
import tarfile
import urllib.request

ROOT = Path(__file__).resolve().parents[3]
HERE = Path(__file__).resolve().parent
NODE_VERSION = '26.13.0'
NODE_ARCHIVE = 'node-v26.13.0-linux-x64.tar.xz'
NODE_URL = 'https://nodejs.org/dist/v26.13.0/' + NODE_ARCHIVE
NODE_SHA256 = 'd28a96af6c38596f6d9d97c0ee531c13d238d757742387d1928de822d959e997'
LIBATOMIC_VERSION = '12.2.0-14+deb12u1'
LIBATOMIC_PACKAGES = (
    {'package': 'libatomic1', 'archive': 'libatomic1_' + LIBATOMIC_VERSION + '_amd64.deb',
     'official_url': 'https://deb.debian.org/debian/pool/main/g/gcc-12/libatomic1_' + LIBATOMIC_VERSION + '_amd64.deb',
     'archive_bytes': 9376, 'archive_sha256': 'fbd4e154a6b444229ea002cc209df099209c0adc09102e5fd21239a3d2b55e2d',
     'member': './usr/lib/x86_64-linux-gnu/libatomic.so.1.2.0', 'destination': 'lib/libatomic.so.1',
     'bytes': 30776, 'sha256': '107ab9f7661a1c47cddfb5cd1def99ec537a50a9a537fbe38cdde1b34b8ba280'},
    {'package': 'gcc-12-base', 'archive': 'gcc-12-base_' + LIBATOMIC_VERSION + '_amd64.deb',
     'official_url': 'https://deb.debian.org/debian/pool/main/g/gcc-12/gcc-12-base_' + LIBATOMIC_VERSION + '_amd64.deb',
     'archive_bytes': 37596, 'archive_sha256': '1896a2aacf4ad681ff5eacc24a5b0ca4d5d9c9b9c9e4b6de5197bc1e116ea619',
     'member': './usr/share/doc/gcc-12-base/copyright', 'destination': 'lib/libatomic1-copyright',
     'bytes': 68194, 'sha256': 'da8191658b3452ce9caf31638ba61dab31a38c619fa39df119812e050f592fd3'},
)
LIBATOMIC_FILES = {item['destination']: item['sha256'] for item in LIBATOMIC_PACKAGES}
MAX_DEB_TAR_BYTES = 128 * 1024
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


def deb_payload(output, package):
    """Read the two hash-pinned Debian packages; never install or execute their scripts."""
    try:
        with urllib.request.urlopen(package['official_url'], timeout=30) as response:
            archive_bytes = response.read(package['archive_bytes'] + 1)
    except (OSError, TimeoutError) as error:
        raise RuntimeError('WIRE_STAGE_LIBATOMIC_DOWNLOAD_FAILED') from error
    require(len(archive_bytes) == package['archive_bytes'], 'LIBATOMIC_ARCHIVE_SIZE')
    require(sha(archive_bytes) == package['archive_sha256'], 'LIBATOMIC_ARCHIVE_SHA256')
    archive_path = output / package['archive']
    require(not archive_path.exists() and not archive_path.is_symlink(), 'LIBATOMIC_FRESH_ARCHIVE')
    archive_path.write_bytes(archive_bytes)
    dpkg = shutil.which('dpkg-deb')
    require(dpkg, 'LIBATOMIC_DPKG_REQUIRED')
    try:
        result = subprocess.run([dpkg, '--fsys-tarfile', str(archive_path)], capture_output=True,
                                env={'PATH': '/usr/bin:/bin', 'LANG': 'C'}, timeout=30)
    except subprocess.TimeoutExpired as error:
        raise RuntimeError('WIRE_STAGE_LIBATOMIC_DPKG_TIMEOUT') from error
    except OSError as error:
        raise RuntimeError('WIRE_STAGE_LIBATOMIC_DPKG_FAILED') from error
    require(result.returncode == 0, 'LIBATOMIC_DPKG_FAILED')
    # The exact small .deb hash is checked before the decompressor sees it.
    require(len(result.stdout) <= MAX_DEB_TAR_BYTES, 'LIBATOMIC_TAR_SIZE')
    try:
        with tarfile.open(fileobj=io.BytesIO(result.stdout), mode='r:') as archive:
            members = [member for member in archive.getmembers() if member.name == package['member']]
            require(len(members) == 1, 'LIBATOMIC_EXACT_MEMBER')
            member = members[0]
            require(member.isreg() and not member.mode & 0o7000, 'LIBATOMIC_REGULAR_MEMBER')
            require(member.size == package['bytes'], 'LIBATOMIC_MEMBER_SIZE')
            payload = archive.extractfile(member).read(package['bytes'] + 1)
    except tarfile.TarError as error:
        raise RuntimeError('WIRE_STAGE_LIBATOMIC_TAR_FAILED') from error
    require(len(payload) == package['bytes'], 'LIBATOMIC_MEMBER_SIZE')
    require(sha(payload) == package['sha256'], 'LIBATOMIC_MEMBER_SHA256')
    if package['destination'] == 'lib/libatomic.so.1':
        require(payload[:7] == b'\x7fELF\x02\x01\x01' and payload[16:20] == b'\x03\x00\x3e\x00',
                'LIBATOMIC_ELF_LINUX_AMD64')
    return payload


def stage_native_library(output, tree):
    """Copy only libatomic's real file and its complete Debian copyright notice."""
    require(sys.platform == 'linux' and platform.machine() == 'x86_64', 'LIBATOMIC_LINUX_AMD64_ONLY')
    output, tree = Path(output), Path(tree)
    require(output.is_dir() and not output.is_symlink() and tree.is_dir() and not tree.is_symlink(),
            'LIBATOMIC_PLAIN_DIRECTORIES')
    lib = tree / 'lib'
    require(not lib.exists() and not lib.is_symlink(), 'LIBATOMIC_FRESH_DIRECTORY')
    # Validate both packages before creating any loader-visible output.
    payloads = [(package, deb_payload(output, package)) for package in LIBATOMIC_PACKAGES]
    lib.mkdir()
    for package, payload in payloads:
        target = tree / package['destination']
        target.write_bytes(payload)
        target.chmod(0o644)
    return {'package': 'libatomic1', 'version': LIBATOMIC_VERSION, 'debian_suite': 'bookworm',
            'platform': 'linux-x64', 'files': dict(LIBATOMIC_FILES),
            'source_packages': [{key: package[key] for key in
                                 ('package', 'official_url', 'archive_bytes', 'archive_sha256')}
                                for package in LIBATOMIC_PACKAGES]}


def verify_native_runtime(output, node):
    """Exercise the real staging path and an explicit Node loader env, without npm or a DB."""
    require(sys.platform == 'linux' and platform.machine() == 'x86_64', 'LIBATOMIC_LINUX_AMD64_ONLY')
    output = Path(output)
    require(not output.exists() and not output.is_symlink(), 'LIBATOMIC_FRESH_SMOKE_DIRECTORY')
    node = Path(node).resolve(strict=True)
    require(node.is_file() and os.access(node, os.X_OK), 'LIBATOMIC_NODE_EXECUTABLE')
    tree = output / 'tree'
    tree.mkdir(parents=True)
    metadata = stage_native_library(output, tree)
    env = {'PATH': '/usr/bin:/bin', 'LANG': 'C', 'LD_LIBRARY_PATH': str((tree / 'lib').resolve())}
    version = subprocess.run([str(node), '--version'], cwd=output, env=env,
                             capture_output=True, timeout=30)
    require(version.returncode == 0 and version.stdout == ('v' + NODE_VERSION + '\n').encode(),
            'LIBATOMIC_NODE_VERSION')
    probe = """const p = process.env.LD_LIBRARY_PATH + '/libatomic.so.1';
if (!process.report.getReport().sharedObjects.includes(p)) process.exit(1);
process.stdout.write(JSON.stringify({version:process.version,loadedPinnedLibrary:true}));"""
    result = subprocess.run([str(node), '--input-type=module', '-e', probe], cwd=output, env=env,
                            capture_output=True, timeout=30)
    require(result.returncode == 0 and len(result.stdout) <= 256, 'LIBATOMIC_LOADER_PROBE')
    require(json.loads(result.stdout) == {'version': 'v' + NODE_VERSION, 'loadedPinnedLibrary': True},
            'LIBATOMIC_LOADER_REPORT')
    return {'version': 'v' + NODE_VERSION, 'loadedPinnedLibrary': True, 'files': metadata['files']}


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
        binary = archive.getmember('node-v26.13.0-linux-x64/bin/node')
        require(binary.isreg() and binary.size < 200 * 1024 * 1024, 'NODE_BINARY_MEMBER')
        (tree / 'node').write_bytes(archive.extractfile(binary).read())
    native_library = stage_native_library(output, tree)
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
                'native_library': native_library,
                'driver': {'name': 'pg', 'version': PG_VERSION, 'git_commit': PG_COMMIT, 'npm_integrity': PG_INTEGRITY,
                           'audited_source_git_blobs': PG_SOURCE_BLOBS},
                'dependency_lock_sha256': sha(lock_bytes), 'source_manifest_sha256': source_manifest['manifest_sha256'],
                'operational_wire': 'UNBOUND'}
    return tar_path, manifest


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Verify the isolated pinned native-library staging path.')
    parser.add_argument('--verify-native-runtime', action='store_true', required=True)
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--node', type=Path, required=True)
    arguments = parser.parse_args()
    try:
        report = verify_native_runtime(arguments.output, arguments.node)
    except (RuntimeError, OSError, subprocess.SubprocessError, ValueError) as error:
        code = str(error) if isinstance(error, RuntimeError) and str(error).startswith('WIRE_STAGE_') \
            else 'WIRE_STAGE_LIBATOMIC_SMOKE_FAILED'
        print(json.dumps({'status': 'FAIL', 'code': code}, sort_keys=True))
        raise SystemExit(1)
    print(json.dumps(report, sort_keys=True))
