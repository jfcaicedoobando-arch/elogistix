// Serial installer/mutation proofs. No production database or parallel guard pool.
const {Client}=require('pg');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto'),cp=require('node:child_process');
const {root,guard,locate,readState,writeState,identifier,literal}=require('./control.cjs');
guard(); const state=readState(); assert.equal(state.installer,locate());
const cfg={ssl:false}, clients=[]; let tests=[];
const E=path.join(root,'.selector148-logs'); fs.mkdirSync(E,{recursive:true});
const installer=fs.readFileSync(path.join(root,state.installer),'utf8');
require('./installer.cjs').verifyInstaller(installer);
// Variants are derived only from the SHA-verified registered disabled body.
const {sig,variants}=require('./variants.cjs');
const {installEnabled,enableSql,disabledFunctionSql}=variants(installer);
let admin;
async function clone(label,template=state.parent) {
  assert(/^[a-z0-9_]+$/.test(label)); assert(state.databases.includes(template));
  const db=state.parent.replace(/_parent$/,'_'+label); assert(db.length<=63);
  const owner=(await admin.query("SELECT shobj_description(oid,'pg_database') marker,pg_get_userbyid(datdba) owner FROM pg_database WHERE datname=$1",[template])).rows[0];
  assert.deepEqual(owner,{marker:state.marker,owner:'postgres'});
  await admin.query('CREATE DATABASE '+identifier(db)+' TEMPLATE '+identifier(template));
  await admin.query('COMMENT ON DATABASE '+identifier(db)+' IS '+literal(state.marker));
  state.databases.push(db);writeState(state);return db;
}
const U=n=>'00000000-0000-4000-9000-'+String(n).padStart(12,'0'),A=U(1),B=U(2),UA=U(11),UB=U(12);
const read=p=>fs.readFileSync(path.join(__dirname,p),'utf8'),hash=s=>crypto.createHash('sha256').update(typeof s==='string'?s:JSON.stringify(s)).digest('hex');
const snapshots={};
const save=(n,o)=>{const raw=JSON.stringify(o,null,2)+'\n';if(n.startsWith('snapshot-')){const bytes=require('node:zlib').gzipSync(raw,{level:1});fs.writeFileSync(path.join(E,n+'.json.gz'),bytes);snapshots[n]={raw_sha256:hash(raw),gzip_sha256:crypto.createHash('sha256').update(bytes).digest('hex'),raw_bytes:Buffer.byteLength(raw),gzip_bytes:bytes.length};fs.writeFileSync(path.join(E,'snapshot-manifest.json'),JSON.stringify(snapshots,null,2)+'\n')}else fs.writeFileSync(path.join(E,n+'.json'),raw)};
const pass=(n,detail)=>{tests.push({name:n,status:'PASS',detail});console.log('PASS '+n);save('proof-progress',tests)};
const fks=[['pfc_pf_same_org_fk','proveedor_facturas_conceptos','proveedor_factura_id','proveedor_facturas','c'],['pfc_cc_same_org_fk','proveedor_facturas_conceptos','concepto_costo_id','conceptos_costo','n'],['cc_shipment_same_org_fk','conceptos_costo','embarque_id','embarques','c'],['pf_shipment_same_org_fk','proveedor_facturas','embarque_id','embarques','n'],['insurance_pf_same_org_fk','seguros_embarque','proveedor_factura_id','proveedor_facturas','r'],['insurance_shipment_same_org_fk','seguros_embarque','embarque_id','embarques','c']];
async function c(db) {
  assert(state.databases.includes(db), 'Only a captured/created owned database may be tested');
  const q=new Client({...cfg,database:db}); await q.connect(); clients.push(q);
  await q.query("SET statement_timeout='120s'; SET lock_timeout='5s'"); return q;
}
async function close(q) { await q.end(); clients.splice(clients.indexOf(q),1); }
async function user(q,u=UA){await q.query("SELECT set_config('request.jwt.claims',$1,false)",[JSON.stringify({sub:u,role:'authenticated'})]);await q.query('SET ROLE authenticated');}
async function postgres(q){await q.query('RESET ROLE');await q.query("SELECT set_config('request.jwt.claims','',false)")}
async function ship(q,n,org=A){const id=U(n);await q.query("INSERT INTO embarques(id,organization_id,cliente_id,expediente,modo,tipo,tipo_cambio_usd,tipo_cambio_eur) VALUES($1,$2,$3,$4,'Marítimo','Importación',20,22)",[id,org,org===A?U(21):U(22),'DEMO-2026-'+n]);return id;}
async function pf(q,n,e=null,org=A){const id=U(n);await q.query("INSERT INTO proveedor_facturas(id,organization_id,proveedor_id,categoria_presupuesto_id,embarque_id,folio_proveedor,moneda,subtotal,iva,total,tipo_cambio_usd,estado) VALUES($1,$2,$3,$4,$5,$6,'MXN',100,0,100,20,'Vigente')",[id,org,org===A?U(31):U(32),org===A?U(41):U(42),e,'LOCAL-INTEGRITY-'+n]);return id;}
async function cc(q,n,e,org=A){const id=U(n);await q.query("INSERT INTO conceptos_costo(id,organization_id,embarque_id,concepto,monto,moneda) VALUES($1,$2,$3,'Synthetic full graph allocation',1000000,'MXN')",[id,org,e]);return id;}
async function pfc(q,n,p,cost=null,org=A,m=100){await q.query("INSERT INTO proveedor_facturas_conceptos(id,organization_id,proveedor_factura_id,concepto_costo_id,descripcion,cantidad,monto) VALUES($1,$2,$3,$4,'Synthetic allocation',1,$5)",[U(n),org,p,cost,m]);return U(n);}
async function insurance(q,n,e,p=null,org=A,deleted=null){await q.query("INSERT INTO seguros_embarque(id,organization_id,embarque_id,proveedor_factura_id,aseguradora,numero_poliza,prima,moneda,vigencia_desde,vigencia_hasta,deleted_at) VALUES($1,$2,$3,$4,'Synthetic insurer',$5,50,'MXN',CURRENT_DATE,CURRENT_DATE+365,$6)",[U(n),org,e,p,'LOCAL-INTEGRITY-'+n,deleted]);return U(n);}
async function seed(q){await q.query("INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES($1,'integrity-a@example.invalid','{\"skip_auto_org\":\"true\"}'),($2,'integrity-b@example.invalid','{\"skip_auto_org\":\"true\"}')",[UA,UB]);await q.query("INSERT INTO organizations(id,nombre) VALUES($1,'Full local integrity A'),($2,'Full local integrity B')",[A,B]);await q.query("INSERT INTO organization_members(organization_id,user_id,role) VALUES($1,$3,'admin_org'),($2,$4,'admin_org');",[A,B,UA,UB]);await q.query("INSERT INTO user_roles(user_id,role) VALUES($1,'admin_org'),($2,'admin_org') ON CONFLICT(user_id) DO UPDATE SET role=EXCLUDED.role",[UA,UB]);
for(const [o,cl,pr,cat] of [[A,21,31,41],[B,22,32,42]]){await q.query("INSERT INTO clientes(id,organization_id,nombre,email) VALUES($1,$2,'Synthetic client',$3)",[U(cl),o,cl+'@example.invalid']);await q.query("INSERT INTO proveedores(id,organization_id,nombre,categoria,tipo) VALUES($1,$2,'Synthetic supplier','Logistico','Naviera')",[U(pr),o]);await q.query("INSERT INTO presupuesto_categorias(id,organization_id,nombre) VALUES($1,$2,'Synthetic category')",[U(cat),o]);}
await ship(q,101);await ship(q,102,B);await ship(q,103);await pf(q,201,U(101));await pf(q,202,U(102),B);await pf(q,203);await cc(q,301,U(101));await cc(q,302,U(102),B);await pfc(q,401,U(201),U(301));await pfc(q,402,U(203));await insurance(q,501,U(101),U(201));await insurance(q,502,U(101));await insurance(q,503,U(101),U(201),A,'2026-01-01');}

// Complete raw snapshots are compared only inside the same replay lineage.
async function snap(q,tag){const out={};for(const k of ['catalog','procs','relations','columns','structure','roles','effective','triggers','data']){if(k==='data')await q.query('DROP FUNCTION IF EXISTS pg_temp.snapshot_data()');let r=await q.query(read('fixtures/'+k+'.sql'));if(Array.isArray(r))r=r.at(-1);out[k]=JSON.parse(r.rows[0].jsonb_pretty)}save('snapshot-'+tag,out);return out}
const signature='seguro_facturas_elegibles(uuid,numeric,text,uuid,integer,date,uuid)';
function preserved(a,b){for(const k of ['columns','roles','data'])assert.deepEqual(b[k],a[k],k+' changed');for(const k of ['catalog','effective'])assert.deepEqual(b[k].filter(x=>x.signature!==signature),a[k].filter(x=>x.signature!==signature),k+' changed');assert.deepEqual(b.procs.filter(x=>x.proname!=='seguro_facturas_elegibles'),a.procs.filter(x=>x.proname!=='seguro_facturas_elegibles'),'existing raw pg_proc changed');
assert.deepEqual(b.relations.policies,a.relations.policies);assert.deepEqual(b.relations.default_acl,a.relations.default_acl);assert.deepEqual(b.relations.relations.filter(x=>x.name!=='conceptos_costo_id_org_uniq'),a.relations.relations.filter(x=>x.name!=='conceptos_costo_id_org_uniq'));
assert.deepEqual(b.triggers.filter(x=>!fks.some(f=>f[0]===x.constraint_name)),a.triggers.filter(x=>!fks.some(f=>f[0]===x.constraint_name)));
for(const k of ['constraints','indexes'])assert.deepEqual(b.structure[k].filter(x=>!fks.some(f=>f[0]===x.name)&&x.name!=='conceptos_costo_id_org_uniq'),a.structure[k].filter(x=>!fks.some(f=>f[0]===x.name)&&x.name!=='conceptos_costo_id_org_uniq'));
}
function enableContract(s,enabled){const rows=s.catalog.filter(x=>x.signature===signature);assert.equal(rows.length,1);const r=rows[0];assert.equal(r.owner,'postgres');assert.equal(r.security_definer,true);assert.equal(r.volatility,'s');assert.deepEqual(r.config,['search_path=pg_catalog, public']);assert.equal(r.authenticated_execute,enabled);assert.equal(r.anon_execute,false);assert.equal(r.service_role_execute,false);assert.match(r.source,new RegExp('_selector148_enabled CONSTANT boolean := '+enabled+';'));const edges=s.structure.constraints.filter(x=>fks.some(f=>f[0]===x.name));assert.equal(edges.length,6);assert(edges.every(x=>x.convalidated&&!x.condeferrable&&!x.condeferred));}
async function ready(q){return (await q.query('SELECT '+read('fixtures/integrity-ready.sql')+' AS ready')).rows[0].ready===true}

const expectations=require('./expectations.json');
const extractNotices=log=>[...log.matchAll(/NOTICE:\s+(?:[A-Z0-9]{5}:\s+)?(PASS(?::| SELECTOR148:).*)/g)].map(m=>m[1]);
function sqlFile(db,label,file,profile,zone='UTC',variables={}) {
  assert(state.databases.includes(db));
  const args=['-X','-q','-v','ON_ERROR_STOP=1','-v','VERBOSITY=verbose'];
  for(const [key,value] of Object.entries(variables))args.push('-v',key+'='+value);
  args.push('-f',path.join(__dirname,file));
  const p=cp.spawnSync('psql',args,{cwd:root,encoding:'utf8',env:{...process.env,PGDATABASE:db,PGSSLMODE:'disable',PGOPTIONS:'-c statement_timeout=120000 -c lock_timeout=5000 -c timezone='+zone},maxBuffer:1e7});
  const log=(p.stdout??'')+(p.stderr??'');fs.writeFileSync(path.join(E,label+'.log'),log);
  save(label+'.process',{exit:p.status,signal:p.signal??null,error:p.error?.message??null});
  assert.equal(p.status,0,label+': '+log.slice(-4000));assert.equal(p.signal,null);assert.equal(p.error,undefined);
  assert(!/\b(?:ERROR|FATAL|PANIC):/.test(log));
  if(profile)assert.deepEqual(extractNotices(log),expectations[profile]);
  return log;
}
async function failedInstall(q,tag,expected){const before=await snap(q,tag+'-before');let err;try{await q.query(installEnabled)}catch(e){err=e;await q.query('ROLLBACK')}assert.equal(err?.code,'23503',tag+': '+err?.message);assert.equal(err.constraint,expected);assert.deepEqual(await snap(q,tag+'-after'),before);assert.equal(await ready(q),false);assert.equal((await q.query("SELECT count(*)::int n FROM pg_constraint WHERE conname=ANY($1)",[fks.map(x=>x[0])])).rows[0].n,0);pass(tag+': full atomic install/validation/enablement rollback with all historical bytes unchanged',{code:err.code,constraint:err.constraint});}
(async()=>{
// Inspect the existing manifest guard's result; never discover/run it twice.
const restoreLog=fs.readFileSync(path.join(process.env.SELECTOR148_GUARD_LOG_DIR || '/tmp/guards-logs','insurance_trash_restore.log'),'utf8');
assert(!/\b(?:ERROR|FATAL|PANIC):/.test(restoreLog));
assert.equal((restoreLog.match(/NOTICE:\s+PASS:/g)||[]).length,64,'restore successor must finish all 64 assertions');
for(const label of ['gate is off before rejected wrong-tenant tombstone insert','wrong-tenant tombstone INSERT is rejected by the exact composite FK [23503/insurance_pf_same_org_fk]','rejected wrong-tenant tombstone insert preserves every existing policy row','rejected wrong-tenant tombstone insert leaves restore gate off'])assert(restoreLog.includes(label));
pass('manifest restore successor completed 60 retained paths and four exact cross-tenant rejection/preservation assertions');
admin=new Client({...cfg,database:'template1'});await admin.connect();clients.push(admin);
const identity=(await admin.query("SELECT current_setting('server_version_num') version,current_setting('max_locks_per_transaction') max_locks")).rows[0];
assert(Number(identity.version)>=170000&&Number(identity.version)<180000);assert.equal(identity.max_locks,'64');save('server-identity',identity);
const control=await clone('control');let q=await c(control);await seed(q);const original=await snap(q,'control');assert.equal(await ready(q),false);
await q.query(disabledFunctionSql);let prior=await snap(q,'premature-enable-before');let error;
try{await q.query(enableSql)}catch(e){error=e;await q.query('ROLLBACK')}
assert.equal(error?.message,'LC_SELECTOR148_INTEGRITY_NOT_READY');assert.deepEqual(await snap(q,'premature-enable-after'),prior);
await q.query('DROP FUNCTION '+sig);assert.deepEqual(await snap(q,'control-restored'),original);await close(q);
pass('premature activation rejected atomically on pre-installer schema');
const forward=await clone('forward',control);q=await c(forward);const base=await snap(q,'forward-base');
await q.query(installer);const disabled=await snap(q,'forward-disabled');preserved(base,disabled);enableContract(disabled,false);assert.equal(await ready(q),true);
sqlFile(forward,'disabled-before','tests/disabled-gate.sql');
await q.query(enableSql);const enabled=await snap(q,'forward-enabled');preserved(base,enabled);enableContract(enabled,true);
assert.equal(enabled.triggers.length-base.triggers.length,24);assert.equal(enabled.structure.indexes.length-base.structure.indexes.length,1);assert.equal(enabled.structure.constraints.length-base.structure.constraints.length,7);
await q.query(enableSql);assert.deepEqual(await snap(q,'enabled-idempotent'),enabled);
let collision;try{await q.query(installEnabled)}catch(e){collision=e;await q.query('ROLLBACK')}
assert.equal(collision?.code,'42P07');assert.deepEqual(await snap(q,'collision-preserved'),enabled);await close(q);
pass('disabled atomic installer preserves existing schema/data; exact enablement is idempotent and additive collision fails closed');
const freshDb=await clone('fresh',control);q=await c(freshDb);const fresh=await snap(q,'fresh-base');await q.query(installEnabled);const freshEnabled=await snap(q,'fresh-enabled');preserved(fresh,freshEnabled);enableContract(freshEnabled,true);
for(const key of ['catalog','structure','columns','effective','relations'])assert.deepEqual(freshEnabled[key],enabled[key]);await close(q);
pass('atomic enabled test variant and disabled-then-enabled path have equal catalog, ACL and structure');
for(const db of [forward,freshDb]){q=await c(db);const before=await snap(q,db+'-suites-before');
  for(const zone of ['UTC','America/Mexico_City'])for(const [file,profile]of [['exact-triple-parity','parity'],['security-pagination-integrated','integratedSecurity']])
    sqlFile(db,db+'-'+zone.replace('/','-')+'-'+file,'tests/'+file+'.sql',profile,zone);
  assert.deepEqual(await snap(q,db+'-suites-after'),before);await close(q);
}
pass('strict parity/security notices match in UTC and Mexico City; all complete catalog/data snapshots are preserved');
// Per-constraint absence/unvalidated and each of the 24 trigger disable modes.
const gates=await clone('gates',control);q=await c(gates);await q.query(installEnabled);const clean=await snap(q,'gates-clean');await user(q);let baselinePage=(await q.query("SELECT seguro_facturas_elegibles($1,100,'MXN') page",[U(101)])).rows[0].page;await postgres(q);assert(Array.isArray(baselinePage.items));
// Other-tenant numeric/occupancy changes cannot alter the A page with valid graph.
await q.query('BEGIN');await pf(q,850,U(101));await pfc(q,950,U(202),U(302),B,100);
await user(q);const aBefore=(await q.query("SELECT seguro_facturas_elegibles($1,100,'MXN') page",[U(101)])).rows[0].page;
assert(aBefore.items.some(x=>x.id===U(850)));assert.equal((await q.query('SELECT count(*)::int n FROM proveedor_facturas_conceptos WHERE id=$1',[U(950)])).rows[0].n,0);await postgres(q);
await q.query('UPDATE proveedor_facturas_conceptos SET monto=200 WHERE id=$1',[U(950)]);await insurance(q,851,U(102),U(202),B);
await user(q);const aAfter=(await q.query("SELECT seguro_facturas_elegibles($1,100,'MXN') page",[U(101)])).rows[0].page;assert.deepEqual(aAfter,aBefore);await postgres(q);await q.query('ROLLBACK');assert.deepEqual(await snap(q,'other-tenant-differential-restored'),clean);
pass('valid other-tenant assignment amounts and active occupancy cannot change the authorized A page; foreign rows remain unreadable');
const gateProofs=[];
async function mutation(name,sql,params=[]){await q.query('BEGIN');try{await q.query(sql,params);assert.equal(await ready(q),false,name+' readiness must be false');const mutated=await snap(q,'gate-'+name+'-mutated');await q.query('SAVEPOINT enable_probe');let e;try{await q.query(enableSql.replace(/^BEGIN;$/m,'').replace(/^COMMIT;$/m,''))}catch(x){e=x}assert.equal(e?.message,'LC_SELECTOR148_INTEGRITY_NOT_READY',name);await q.query('ROLLBACK TO SAVEPOINT enable_probe');assert.deepEqual(await snap(q,'gate-'+name+'-enable-rejected'),mutated);await user(q);await q.query('SAVEPOINT runtime_probe');let runtime;try{await q.query("SELECT seguro_facturas_elegibles($1,100,'MXN')",[U(101)])}catch(x){runtime=x}assert.equal(runtime?.code,'P0001');assert.equal(runtime.message,'LC_SELECTOR148_NO_DISPONIBLE');await q.query('ROLLBACK TO SAVEPOINT runtime_probe');await postgres(q);gateProofs.push({name,install_error:e.message,runtime_error:runtime.message});}finally{await q.query('ROLLBACK')}assert.deepEqual(await snap(q,'gate-'+name+'-restored'),clean)}
for(const [name,table]of fks){const def=(await q.query('SELECT pg_get_constraintdef(oid) def FROM pg_constraint WHERE conname=$1 AND conrelid=$2::regclass',[name,'public.'+table])).rows[0].def;await mutation(name+'-absent',`ALTER TABLE public.${table} DROP CONSTRAINT ${name}`);await mutation(name+'-unvalidated',`ALTER TABLE public.${table} DROP CONSTRAINT ${name}; ALTER TABLE public.${table} ADD CONSTRAINT ${name} ${def} NOT VALID`);await mutation(name+'-update-cascade',`ALTER TABLE public.${table} DROP CONSTRAINT ${name}; ALTER TABLE public.${table} ADD CONSTRAINT ${name} ${def.replace('ON DELETE','ON UPDATE CASCADE ON DELETE')}`);await mutation(name+'-deferrable',`ALTER TABLE public.${table} ALTER CONSTRAINT ${name} DEFERRABLE INITIALLY IMMEDIATE`);}
const triggers=(await q.query('SELECT t.tgname,c.relname,t.tgconstraint::regclass::text FROM pg_trigger t JOIN pg_constraint con ON con.oid=t.tgconstraint JOIN pg_class c ON c.oid=t.tgrelid WHERE con.conname=ANY($1) ORDER BY con.conname,t.tgname',[fks.map(f=>f[0])])).rows;
assert.equal(triggers.length,24);for(let i=0;i<triggers.length;i++){const t=triggers[i];await mutation('ri-'+i+'-disabled',`ALTER TABLE public.${t.relname} DISABLE TRIGGER "${t.tgname}"`);}
await mutation('replica-session',"SET LOCAL session_replication_role='replica'");
// Wrong ID-only SET NULL columns must not qualify even if the FK is validated.
for(const [name,table,child,parent,action]of fks.filter(f=>f[4]==='n'))await mutation(name+'-full-set-null',`ALTER TABLE public.${table} DROP CONSTRAINT ${name}; ALTER TABLE public.${table} ADD CONSTRAINT ${name} FOREIGN KEY (${child},organization_id) REFERENCES public.${parent}(id,organization_id) ON DELETE SET NULL`);
// Validated FK with swapped key order is semantically strong but not the reviewed exact shape.
await mutation('swapped-key-order',`ALTER TABLE proveedor_facturas_conceptos DROP CONSTRAINT pfc_pf_same_org_fk; ALTER TABLE proveedor_facturas_conceptos ADD CONSTRAINT pfc_pf_same_org_fk FOREIGN KEY (organization_id,proveedor_factura_id) REFERENCES proveedor_facturas(organization_id,id) ON DELETE CASCADE`);
for(const table of ['embarques','proveedor_facturas','conceptos_costo','proveedor_facturas_conceptos','seguros_embarque']){
 await mutation(table+'-primary-key-absent',`ALTER TABLE public.${table} DROP CONSTRAINT ${table}_pkey CASCADE`);
 await mutation(table+'-inheritance-child',`CREATE TABLE public.selector148_inheritance_probe () INHERITS (public.${table})`);
}
await mutation('inheritance-parent',`CREATE TABLE public.selector148_inheritance_parent (); ALTER TABLE public.proveedor_facturas INHERIT public.selector148_inheritance_parent`);
await mutation('active-policy-index-absent','DROP INDEX public.ux_seguros_embarque_factura_activa');
await mutation('active-policy-index-wrong-predicate','DROP INDEX public.ux_seguros_embarque_factura_activa; CREATE UNIQUE INDEX ux_seguros_embarque_factura_activa ON public.seguros_embarque(proveedor_factura_id) WHERE deleted_at IS NOT NULL');
assert.equal(gateProofs.length,65);save('failclosed-mutations',gateProofs);pass('65 exact catalog/RI/session/identity/inheritance/uniqueness mutation cases reject both enablement and runtime, with every mutation rolled back');await close(q);
// Each preexisting anomaly aborts the complete additive installation, not only VALIDATE.
for(let i=0;i<6;i++){const db=await clone('history_'+i,control);q=await c(db);if(i===0){await pf(q,810);await pfc(q,910,U(810),null,A,0);await q.query("UPDATE proveedor_facturas SET organization_id=$1,proveedor_id=$2,categoria_presupuesto_id=$3,folio_interno=folio_interno||'-history',deleted_at=now() WHERE id=$4",[B,U(32),U(42),U(810)])}
if(i===1){await cc(q,811,U(101));await pf(q,812);await pfc(q,911,U(812),U(811),A,-1);await q.query('UPDATE conceptos_costo SET organization_id=$1,embarque_id=$2,deleted_at=now() WHERE id=$3',[B,U(102),U(811)])}
if(i===2){await ship(q,813);await cc(q,814,U(813));await q.query('UPDATE embarques SET organization_id=$1,deleted_at=now() WHERE id=$2',[B,U(813)])}
if(i===3){await ship(q,815);await pf(q,816,U(815));await q.query('UPDATE embarques SET organization_id=$1 WHERE id=$2',[B,U(815)])}
if(i===4)await insurance(q,817,U(101),U(202),A,'2026-01-01');
if(i===5){await insurance(q,818,U(102),null,A,'2026-01-01');await q.query(disabledFunctionSql)}
await failedInstall(q,'history-'+i+'-'+fks[i][0],fks[i][0]);await close(q)}
// The same invariant covers NaN foreign historical assignments; no numeric filter hides them.
q=await c(await clone('history_nan',control));await pf(q,820);await pfc(q,920,U(820),null,A,'NaN');await q.query("UPDATE proveedor_facturas SET organization_id=$1,proveedor_id=$2,categoria_presupuesto_id=$3,folio_interno=folio_interno||'-nan' WHERE id=$4",[B,U(32),U(42),U(820)]);await failedInstall(q,'history-nan','pfc_pf_same_org_fk');await close(q);
// Rollback also after all constraints, function creation and grants have succeeded.
q=await c(await clone('late_abort',control));let before=await snap(q,'late-abort-before');let late;try{await q.query(installEnabled.replace(/^COMMIT;$/m,"DO $lateabort$ BEGIN RAISE EXCEPTION 'synthetic late abort'; END $lateabort$;\nCOMMIT;"))}catch(e){late=e;await q.query('ROLLBACK')}assert.equal(late?.message,'synthetic late abort');assert.deepEqual(await snap(q,'late-abort-after'),before);pass('post-grant synthetic late failure rolls back constraints, unique key, function, ACL and all data');await close(q);
const concurrencyDb=await clone('concurrency',forward);
const child=cp.spawnSync(process.execPath,[path.join(__dirname,'concurrency.cjs'),concurrencyDb],{cwd:root,encoding:'utf8',env:process.env,maxBuffer:1e7});
fs.writeFileSync(path.join(E,'concurrency.log'),(child.stdout??'')+(child.stderr??''));save('concurrency.process',{exit:child.status,signal:child.signal??null,error:child.error?.message??null});
assert.equal(child.status,0);assert.equal(child.signal,null);assert.equal(child.error,undefined);
assert.match(child.stdout,/PASS 6 existing writer races/);assert.match(child.stdout,/1 exact parent-tenant FK rejection and 2 controlled interruptions/);
pass('all six writer races, persistent parent-tenant rejection, cancellation and timeout passed');
const budgetBefore=path.join(E,'budget-before.json'),budgetAfter=path.join(E,'budget-after.json');
const budgetLog=sqlFile(concurrencyDb,'work-budget','tests/work-budget.sql',null,'UTC',{budget_before:budgetBefore,budget_after:budgetAfter});
assert.match(budgetLog,/PASS 10001 committed seed rows in 41 bounded batches/);assert.match(budgetLog,/PASS 10001 candidates fail wholly and generically/);
assert.equal(fs.readFileSync(budgetAfter,'utf8'),fs.readFileSync(budgetBefore,'utf8'));
pass('10001 committed candidates in 41 batches at max_locks=64 reject without partial output or mutations');
// Restore and verify disabled state in all test-activated lineages before teardown.
for(const db of [forward,freshDb,gates,concurrencyDb]){q=await c(db);await q.query(disabledFunctionSql);enableContract(await snap(q,db+'-disabled-final'),false);await close(q);sqlFile(db,db+'-disabled-final','tests/disabled-gate.sql');}
save('result',{status:'PASS',tests,structural_cases:gateProofs.length,remote_or_real_data:false});
})().catch(e=>{console.error(e);save('failure',{message:e.message,code:e.code,stack:e.stack,tests_completed:tests.length});process.exitCode=1;}).finally(async()=>{for(const q of clients){try{await q.query('ROLLBACK');await q.end()}catch{}}});
