const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),zlib=require('node:zlib');
function createEvidenceWriter(directory,profile) {
  const snapshots={};
  return function save(name,value) {
    const raw=profile.sync('evidence.stringify',()=>JSON.stringify(value,null,2)+'\n');
    if(name.startsWith('snapshot-')) {
      const bytes=profile.sync('evidence.gzip',()=>zlib.gzipSync(raw,{level:1}),Buffer.byteLength(raw));
      profile.sync('evidence.snapshot.write',()=>fs.writeFileSync(path.join(directory,name+'.json.gz'),bytes),bytes.length);
      snapshots[name]={
        raw_sha256:profile.sync('evidence.raw.hash',()=>crypto.createHash('sha256').update(raw).digest('hex')),
        gzip_sha256:profile.sync('evidence.gzip.hash',()=>crypto.createHash('sha256').update(bytes).digest('hex')),
        raw_bytes:Buffer.byteLength(raw),gzip_bytes:bytes.length};
      profile.sync('evidence.manifest.write',()=>fs.writeFileSync(path.join(directory,'snapshot-manifest.json'),JSON.stringify(snapshots,null,2)+'\n'));
    } else profile.sync('evidence.json.write',()=>fs.writeFileSync(path.join(directory,name+'.json'),raw),Buffer.byteLength(raw));
  };
}
module.exports={createEvidenceWriter};
