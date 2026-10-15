"""Verify vendored public source. No deployment metadata or network access."""
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent
UPSTREAM = ROOT / 'upstream'
COMMIT = '8b0ef1ef942e18493bf5c89087eff7b030c0e26d'
PATH = 'migrations/db/migrations/20220321174452_fix-postgrest-alter-type-event-trigger.sql'
BODY_SHA256 = 'de987df746eb39647098459e7993bd8595e592969b0cd647828a3d13d37cffe0'
SOURCE_SHA256 = '674bfe11a9cb828c55ca7c9e00d4f4edcbcb0003d956d8866c9563810e7f0f0e'
LICENSE_SHA256 = 'fd313c784c2e3c964fe043fdb7bcffa8f84627d53d2cf3a61c61586ff6c3f4c1'
SOURCE_BLOB = '339def9bd8bbf2381cff6d6040bad585ec5dcc68'
LICENSE_BLOB = 'ab15a1ed6a7cc34c8c22305d74c818248ca40ea4'


def require(ok, message):
    if not ok:
        raise ValueError('CRM_EVENT_SOURCE_' + message)


def git_blob(raw):
    return hashlib.sha1(b'blob ' + str(len(raw)).encode('ascii') + b'\0' + raw).hexdigest()


def verify_source(directory=UPSTREAM):
    directory = Path(directory)
    source = (directory / Path(PATH).name).read_bytes()
    body = (directory / 'pgrst_ddl_watch.prosrc').read_bytes()
    license_bytes = (directory / 'LICENSE').read_bytes()
    provenance = json.loads((directory / 'provenance.json').read_text(encoding='utf8'))
    require(provenance['format'] == 'public-upstream-source-v1'
            and provenance['repository'] == 'supabase/postgres'
            and provenance['commit'] == COMMIT and provenance['source_path'] == PATH,
            'PROVENANCE')
    require(hashlib.sha256(source).hexdigest() == SOURCE_SHA256
            and git_blob(source) == SOURCE_BLOB, 'MIGRATION_BYTES')
    require(hashlib.sha256(license_bytes).hexdigest() == LICENSE_SHA256
            and git_blob(license_bytes) == LICENSE_BLOB, 'LICENSE_BYTES')
    opening = b'CREATE OR REPLACE FUNCTION extensions.pgrst_ddl_watch() RETURNS event_trigger AS $$'
    require(source.count(opening) == 1, 'FUNCTION_BOUNDARY')
    extracted = source.split(opening, 1)[1].split(b'$$ LANGUAGE plpgsql;', 1)[0]
    require(len(body) == 729 and body == extracted and b'\r' not in body
            and body.decode('utf8').encode('utf8') == body
            and hashlib.sha256(body).hexdigest() == BODY_SHA256, 'BODY_BYTES')
    require(provenance['source_sha256'] == SOURCE_SHA256
            and provenance['source_git_blob_sha1'] == SOURCE_BLOB
            and provenance['extraction']['utf8_sha256'] == BODY_SHA256
            and provenance['extraction']['byte_offset_zero_based'] == source.index(body)
            and provenance['extraction']['byte_length'] == len(body)
            and provenance['license']['sha256'] == LICENSE_SHA256
            and provenance['license']['git_blob_sha1'] == LICENSE_BLOB, 'MANIFEST_BYTES')
    return {'body': body, 'source_sha256': SOURCE_SHA256, 'body_sha256': BODY_SHA256,
            'source_url': 'https://github.com/supabase/postgres/blob/' + COMMIT + '/' + PATH,
            'scope': 'PUBLIC_SOURCE_ONLY_NOT_OPERATIONAL_ADMISSION'}
