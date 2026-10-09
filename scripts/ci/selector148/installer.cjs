// A single audit comment is the only permitted registration difference.
// Dual full-file hashes prohibit generic normalization or executable drift.
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const contract=require('./contract.json');
const hash=sql=>crypto.createHash('sha256').update(sql).digest('hex');
function verifyInstaller(sql,{allowReviewedSource=false}={}) {
  if(allowReviewedSource && hash(sql)===contract.installer_sha256) return sql;
  assert.equal(hash(sql),contract.registered_installer_sha256,'Registered disabled installer differs from the pinned envelope');
  const marker=contract.registration_marker;
  assert.equal(marker,'-- audit:allow-no-grants -- Disabled selector; all application roles remain revoked.\n');
  assert.equal(sql.split(marker).length,2,'Expected one exact registration marker');
  assert(sql.includes(marker+'CREATE OR REPLACE FUNCTION public.seguro_facturas_elegibles('),'Marker must immediately precede this RPC header');
  const reviewed=sql.replace(marker,'');
  assert.equal(hash(reviewed),contract.installer_sha256,'Executable source differs from the reviewed disabled installer');
  return reviewed;
}
module.exports={verifyInstaller};
