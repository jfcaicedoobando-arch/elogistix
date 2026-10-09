// Exact authorized activation artifact. This module never opens a connection.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const {root,contract}=require('./control.cjs');
const activationContract=require('./activation-contract.json');
const {variants}=require('./variants.cjs');
const hash=s=>crypto.createHash('sha256').update(s).digest('hex');
function body(sql){return sql.split('AS $selector148$')[1].split('$selector148$;')[0]}
function verifyActivation(installer) {
  require('./installer.cjs').verifyInstaller(installer);
  const sql=fs.readFileSync(path.join(root,activationContract.migration),'utf8');
  assert.equal(hash(sql),activationContract.migration_sha256,'Activation artifact differs from its reviewed contract');
  const before=sql.match(/DO \$selector148_before\$[\s\S]*?END \$selector148_before\$;\n/g)||[];
  const after=sql.match(/DO \$selector148_after\$[\s\S]*?END \$selector148_after\$;\n/g)||[];
  assert.equal(before.length,1);assert.equal(after.length,1);
  for(const guard of [...before,...after]) {
    assert(guard.includes("RAISE EXCEPTION 'LC_SELECTOR148_FUNCTION_CONTRACT_DRIFT'"));
    assert(guard.includes("p.proowner = 'postgres'::regrole"));
    assert(guard.includes('pg_catalog.aclexplode'));
    assert(guard.includes(activationContract.enabled_source_sha256));
  }
  assert(before[0].includes(activationContract.disabled_source_sha256));
  assert(!after[0].includes(activationContract.disabled_source_sha256));
  const derived=variants(installer).enableSql;
  const expected=derived.slice(derived.indexOf('BEGIN;')).replace(contract.registration_marker,'');
  const recovered=sql.slice(sql.indexOf('BEGIN;')).replace(before[0],'').replace(after[0],'');
  assert.equal(recovered,expected,'Only exact source/metadata/ACL guards may supplement the existing enable-only variant');
  assert(!sql.includes('ADD CONSTRAINT'));assert(!sql.includes('VALIDATE CONSTRAINT'));
  assert.equal(hash(body(installer)),activationContract.disabled_source_sha256);
  assert.equal(hash(body(sql)),activationContract.enabled_source_sha256);
  assert.equal(body(sql).replace('_selector148_enabled CONSTANT boolean := true;','_selector148_enabled CONSTANT boolean := false;'),body(installer));
  for(const [file,key] of [[activationContract.enabled_guard,'enabled_guard_sha256'],[activationContract.admission_query,'admission_query_sha256']])assert.equal(hash(fs.readFileSync(path.join(root,file))),activationContract[key],file);
  const canonical=fs.readFileSync(path.join(root,'supabase/schema/seguros/seguro_facturas_elegibles.sql'),'utf8');
  assert.equal(body(canonical),body(sql));
  assert(canonical.includes('GRANT EXECUTE ON FUNCTION '+activationContract.signature+' TO authenticated;'));
  const baseline=fs.readFileSync(path.join(root,'supabase/schema/baseline.sql'),'utf8');
  const baselineBody=baseline.split('CREATE FUNCTION public.seguro_facturas_elegibles(')[1].split('    AS $$')[1].split('$$;')[0];
  // schema-snapshot.sh removes every blank line, including inside bodies.
  assert.equal(baselineBody,'\n'+body(sql).split('\n').filter(line=>line.trim()).join('\n')+'\n');
  const ui=fs.readFileSync(path.join(root,'src/features/embarques/domain/seguroFacturaSelector.ts'),'utf8');
  assert(ui.includes('export const SEGURO_FACTURA_SELECTOR_ENABLED = true;'));
  const test=fs.readFileSync(path.join(root,'src/features/embarques/services/__tests__/seguros.selector.test.ts'),'utf8');
  assert(!test.includes('vi.mock("../../domain/seguroFacturaSelector"'));
  assert(test.includes('expect(SEGURO_FACTURA_SELECTOR_ENABLED).toBe(true)'));
  return sql;
}
module.exports={verifyActivation,activationContract};
