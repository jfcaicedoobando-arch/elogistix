"""Pure transformations, with no database or process side effects."""
import hashlib,json,re
from pathlib import Path
ROOT=Path(__file__).resolve().parent

def verify_inputs(root=ROOT):
    manifest=json.loads((root/'input-manifest.json').read_text())
    for name,wanted in manifest['files'].items():
        p=root/name
        if not p.is_file() or p.is_symlink() or not p.resolve().is_relative_to(root.resolve()): raise ValueError('unsafe input '+name)
        if hashlib.sha256(p.read_bytes()).hexdigest()!=wanted: raise ValueError('input hash mismatch '+name)
    return manifest

def fixture_sql(root=ROOT):
    source=(root/'inputs/fixture.sql').read_text()
    source=re.sub(r'^CREATE ROLE (anon|authenticated|service_role) NOLOGIN;\n','',source,flags=re.M)
    def expand(m):
        p=root/'inputs'/m.group(1)
        if p.is_symlink() or not p.resolve().is_relative_to((root/'inputs/sources').resolve()): raise ValueError('unsafe fixture include')
        return p.read_text()
    source=re.sub(r'^\\ir (sources/[a-zA-Z0-9_.]+)$',expand,source,flags=re.M)
    if '\\ir ' in source or '\\i ' in source: raise ValueError('unexpanded fixture include')
    return source
