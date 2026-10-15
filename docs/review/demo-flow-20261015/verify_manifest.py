"""Verify reproducible payload hashes without invoking Git or writing files."""
from pathlib import Path,PurePosixPath
import hashlib,json
R=Path(__file__).resolve().parent
manifest=json.loads((R/'manifest.json').read_text());seen=set()
for item in manifest['files']:
 rel=PurePosixPath(item['local_path'])
 if rel.is_absolute() or '..' in rel.parts:raise SystemExit('Unsafe manifest path')
 if str(rel) in seen:raise SystemExit('Duplicate manifest path')
 seen.add(str(rel));p=R/str(rel)
 if p.is_symlink():raise SystemExit('Symlinks are not permitted')
 data=p.read_bytes()
 if hashlib.sha256(data).hexdigest()!=item['SHA256']:raise SystemExit('SHA256 mismatch: '+str(rel))
 if hashlib.sha1(b'blob '+str(len(data)).encode()+b'\0'+data).hexdigest()!=item['gitblobhash']:raise SystemExit('Git blob mismatch: '+str(rel))
 if item['repository_path']!=manifest['repository_prefix']+'/'+str(rel):raise SystemExit('Repository path mismatch')
actual={str(p.relative_to(R)) for p in R.rglob('*') if p.is_file() and p!=R/'manifest.json'}
if seen!=actual:raise SystemExit('Missing/unlisted payload files: '+str(seen^actual))
print(f'{len(seen)} payload files verified; manifest self-hash intentionally excluded')
