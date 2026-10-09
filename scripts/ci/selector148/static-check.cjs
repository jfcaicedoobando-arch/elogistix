// Static packaging/coverage checks only. This never connects to PostgreSQL.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {root,contract,locate}=require('./control.cjs');
const {variants}=require('./variants.cjs');
for(const [file,hash] of Object.entries(contract.frozen_files))assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(root,file))).digest('hex'),hash,file);
const manifest=fs.readFileSync(path.join(root,'supabase/tests/_guards_manifest.txt'),'utf8').split('\n').filter(x=>x.trim()&&!x.startsWith('#'));
assert.equal(manifest.length,new Set(manifest).size,'Duplicate manifest paths');
assert(!manifest.some(x=>/(^|\/)test_rls_.*\.sql$/.test(x)),'RLS pattern suites must not also appear in manifest');
assert.equal(manifest.filter(x=>x==='supabase/tests/selector148_disabled_gate.sql').length,1);
assert.equal(manifest.filter(x=>x==='supabase/tests/insurance_trash_restore.sql').length,1);
assert(!manifest.some(x=>x.includes('scripts/ci/selector148/')),'Serial/committed/DDL tests must not enter parallel manifest');
for(const file of ['run.cjs','concurrency.cjs','control.cjs']) {
 const source=fs.readFileSync(path.join(__dirname,file),'utf8');
 assert(!source.includes('/workspace/'),'Absolute local path remains in '+file);
 assert(!source.includes('55591'),'Local port remains in '+file);
}
const runner=fs.readFileSync(path.join(__dirname,'run.cjs'),'utf8');
assert(runner.includes('assert.equal(gateProofs.length,65)'));
assert(runner.includes('history_nan'));assert(runner.includes('synthetic late abort'));
const budget=fs.readFileSync(path.join(__dirname,'tests/work-budget.sql'),'utf8');
assert(budget.includes('first_row:=first_row+250;'));
assert(budget.includes('first_row <= 10001'));
assert(budget.includes("max_locks_per_transaction')::integer <> 64"));
const acl=fs.readFileSync(path.join(root,'supabase/tests/rls/_ci_post_migrate.sql'),'utf8');
assert(acl.indexOf('\\ir _ci_selector148_capture_acl.sql')<acl.indexOf('GRANT EXECUTE ON ALL FUNCTIONS'));
assert(acl.indexOf('\\ir _ci_selector148_restore_acl.sql')>acl.indexOf('GRANT EXECUTE ON ALL FUNCTIONS'));
const sourceOnly=process.argv.includes('--source-only');
let installerPath;
if(sourceOnly) {
 const arg=process.argv.find(x=>x.startsWith('--installer='));
 assert(arg,'Source-only check requires the reviewed installer path');installerPath=arg.slice('--installer='.length);
} else installerPath=path.join(root,locate());
const installer=fs.readFileSync(installerPath,'utf8');
const {verifyInstaller}=require('./installer.cjs');
const reviewed=verifyInstaller(installer,{allowReviewedSource:sourceOnly});
const registered=reviewed.replace('CREATE OR REPLACE FUNCTION public.seguro_facturas_elegibles(',contract.registration_marker+'CREATE OR REPLACE FUNCTION public.seguro_facturas_elegibles(');
assert.equal(verifyInstaller(registered),reviewed);
assert.throws(()=>verifyInstaller(reviewed),{code:'ERR_ASSERTION'});
assert.throws(()=>verifyInstaller(registered.replace('CONSTANT boolean := false;','CONSTANT boolean := true;')),{code:'ERR_ASSERTION'});
assert.throws(()=>verifyInstaller(registered+'\n'),{code:'ERR_ASSERTION'});
const {installEnabled,enableSql,disabledFunctionSql}=variants(installer);
assert.equal((installEnabled.match(/VALIDATE CONSTRAINT/g)||[]).length,6);
assert(!enableSql.includes('ADD CONSTRAINT'));
assert(enableSql.includes('DO $integrity148$'));
assert(disabledFunctionSql.includes('_selector148_enabled CONSTANT boolean := false;'));
assert(!disabledFunctionSql.includes('GRANT EXECUTE'));
assert.deepEqual(contract.business_roles,['admin','admin_org','super_admin','coordinador_logistico','gerente_operaciones']);
assert(installer.includes("ARRAY['admin','admin_org','super_admin',\n        'coordinador_logistico','gerente_operaciones']::public.app_role[]"));
console.log('PASS selector148 static contract, frozen inputs, exact variants, discovery and portable paths'+(sourceOnly?' (registration not checked)':''));
