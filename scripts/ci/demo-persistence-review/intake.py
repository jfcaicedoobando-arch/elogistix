#!/usr/bin/env python3
"""Offline byte-integrity prerequisite; never connects, extracts, or executes SQL.

Run only on a local ZIP whose supported Library materialization has completed.
This verifier cannot repair Library transfer metadata or certify SQL behavior.
"""
import argparse
import hashlib
import io
import json
from pathlib import Path, PurePosixPath
import re
import stat
import zipfile

PACKAGE_NAME = 'Elogistix-persistencia-propuesta.zip'
EXPECTED_ZIP_SHA256 = '45ec554f587cc3a12048732254ac98bd98f09ceaf18383dde496eba6c227dfa1'
MAX_ARCHIVE_BYTES = 32 * 1024 * 1024
MAX_EXPANDED_BYTES = 32 * 1024 * 1024
MAX_MEMBERS = 1000


class InputError(ValueError):
    pass


def require(condition, message):
    if not condition:
        raise InputError(message)


def digest(data):
    return hashlib.sha256(data).hexdigest()


def safe_name(name):
    require(isinstance(name, str) and bool(name), 'Empty archive/manifest path')
    require(not any(c in name for c in ('\\', ':', '\x00', '\n', '\r')), 'Unsupported path character')
    require(not name.startswith('/'), 'Absolute archive/manifest path')
    require(all(part not in ('', '.', '..') for part in name.split('/')), 'Noncanonical archive/manifest path')
    return name


def _validate_archive(data, expected_sha256):
    """Internal primitive also exercised with clearly synthetic test ZIPs."""
    require(len(data) <= MAX_ARCHIVE_BYTES, 'ZIP exceeds offline intake limit')
    require(digest(data) == expected_sha256, 'ZIP SHA256 mismatch')
    try:
        with zipfile.ZipFile(io.BytesIO(data)) as archive:
            members = archive.infolist()
            require(len(members) <= MAX_MEMBERS, 'Too many ZIP members')
            names = set()
            case_names = set()
            files = {}
            total = 0
            for entry in members:
                # zipfile truncates filename at NUL; orig_filename retains the header.
                require(entry.orig_filename == entry.filename, 'ZIP filename was normalized or truncated')
                name = safe_name(entry.orig_filename.rstrip('/') if entry.is_dir() else entry.orig_filename)
                require(name not in names and name.casefold() not in case_names, 'Duplicate or case-colliding ZIP member')
                names.add(name)
                case_names.add(name.casefold())
                mode = entry.external_attr >> 16
                require(not stat.S_ISLNK(mode), 'ZIP symlinks refused')
                require(not entry.flag_bits & 1, 'Encrypted ZIP refused')
                if entry.is_dir():
                    continue
                total += entry.file_size
                require(total <= MAX_EXPANDED_BYTES, 'Expanded ZIP exceeds offline intake limit')
                files[name] = archive.read(entry)  # zipfile also verifies each member's CRC.
    except (zipfile.BadZipFile, RuntimeError, NotImplementedError) as error:
        raise InputError('Unreadable ZIP: ' + type(error).__name__) from error

    manifests = [name for name in files if PurePosixPath(name).name == 'TRANSFER-SHA256SUMS']
    require(len(manifests) == 1, 'Exactly one TRANSFER-SHA256SUMS required')
    manifest_name = manifests[0]
    try:
        manifest = files[manifest_name].decode('utf-8')
    except UnicodeDecodeError as error:
        raise InputError('TRANSFER-SHA256SUMS must be UTF-8') from error
    expected_files = {}
    parent = PurePosixPath(manifest_name).parent
    for line in manifest.splitlines():
        if not line:
            continue
        match = re.fullmatch(r'([0-9a-fA-F]{64}) [ *](.+)', line)
        require(match is not None, 'Unsupported TRANSFER-SHA256SUMS record')
        checksum, relative = match.groups()
        if relative.startswith('./'):
            relative = relative[2:]
        relative = safe_name(relative)
        name = str(parent / relative)
        require(name != manifest_name, 'Self-hashed checksum manifest refused')
        require(name not in expected_files, 'Duplicate checksum record')
        expected_files[name] = checksum.lower()
    require(set(expected_files) == set(files) - {manifest_name}, 'Checksum manifest does not cover exactly every payload file')
    for name, checksum in expected_files.items():
        require(digest(files[name]) == checksum, 'TRANSFER-SHA256SUMS mismatch: ' + name)
    stores = [name for name in files if PurePosixPath(name).name == 'store.sql']
    require(len(stores) == 1, 'Exactly one store.sql required; no inferred substitute')
    store_name = stores[0]
    return {
        'status': 'PASS',
        'scope': 'offline byte integrity only; no SQL execution',
        'zip_sha256': digest(data),
        'transfer_manifest_sha256': digest(files[manifest_name]),
        'store_member': store_name,
        'store_sha256': digest(files[store_name]),
        'verified_payload_files': len(expected_files),
        'postgres_lane': 'NOT_RUN',
        'wire': 'UNBOUND',
    }


def verify_bundle(path):
    path = Path(path)
    require(not path.is_symlink(), 'ZIP symlink refused')
    require(path.is_file(), 'Supported local Library materialization is absent')
    require(path.stat().st_size <= MAX_ARCHIVE_BYTES, 'ZIP exceeds offline intake limit')
    result = _validate_archive(path.read_bytes(), EXPECTED_ZIP_SHA256)
    result.update(expected_package=PACKAGE_NAME, library_metadata='NOT_VERIFIED_BY_THIS_TOOL')
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--zip', type=Path, required=True)
    args = parser.parse_args()
    try:
        result = verify_bundle(args.zip)
    except (InputError, OSError) as error:
        print(json.dumps({'status': 'FAIL' if args.zip.exists() else 'NOT_RUN',
                          'reason': str(error), 'postgres_lane': 'NOT_RUN', 'wire': 'UNBOUND'}))
        return 2
    print(json.dumps(result, indent=2))
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
