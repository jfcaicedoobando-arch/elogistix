#!/usr/bin/env python3
"""Nonexecuting integrity checks; PASS here never certifies PostgreSQL."""
import hashlib
import json
from pathlib import Path
import sys
sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT))
import run_ci

def main():
    frozen = run_ci.verify_inputs()
    source_map = json.loads(frozen['source-map.json'])
    repo = ROOT.parents[2]
    for row in source_map['files']:
        path = repo / row['path']
        if path.is_symlink() or repo not in path.resolve().parents:
            raise ValueError('Unsafe source path')
        body = path.read_bytes()
        git_hash = hashlib.sha1(b'blob '+str(len(body)).encode()+b'\0'+body).hexdigest()
        if (len(body) != row['bytes'] or hashlib.sha256(body).hexdigest() != row['sha256']
                or git_hash != row['blob_sha']):
            raise ValueError('Pinned published source drift: '+row['path'])
        text = body.decode('utf-8')
        for adaptation in row['adaptations']:
            if text.count(adaptation['old']) != 1:
                raise ValueError('Nonexact declared adaptation')
            text = text.replace(adaptation['old'], adaptation['new'])
        packaged = frozen[row['destination']]
        if text.encode('utf-8') != packaged or hashlib.sha256(packaged).hexdigest() != row['packaged_sha256']:
            raise ValueError('Undeclared upstream change: '+row['destination'])
    report = json.loads(frozen['dependency_report.json'])
    if report['source']['integrity'] != 'PASS' or report['root_triggers'] != 85:
        raise ValueError('Canonical source inventory not verified')
    gate = json.loads(frozen['catalog-status.json'])
    if gate['complete'] is not False or gate['canonical_closure_complete'] is not False or gate['fixtures_complete'] is not False:
        raise ValueError('This preparation must remain blocked until reviewed closure and runtime exist')
    print(json.dumps({'offline':'PASS','published_source_files':len(source_map['files']),
        'canonical_source_integrity':'PASS','financial_engine':'NOT_RUN',
        'canonical_closure':'BLOCKED','real_transport':'NOT_RUN','demo':'DISABLED'}))

if __name__ == '__main__':
    main()
