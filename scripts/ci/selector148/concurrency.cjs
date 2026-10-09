// Serial concurrency proof against an explicitly owned disposable CI database.
const { Client } = require('pg');
const { readFileSync } = require('node:fs');
const { randomUUID } = require('node:crypto');
const assert = require('node:assert/strict');
const {root,guard,readState}=require('./control.cjs');
const path=require('node:path');
guard();const state=readState();const database=process.argv[2];assert(state.databases.includes(database));
const config={database,ssl:false};
const clients=[];
async function connect(name){const c=new Client({...config,application_name:name});await c.connect();clients.push(c);return c;}
async function selected(c,user,ship,pf,prima=100,moneda='MXN'){await begin(c,user);const r=await c.query('SELECT public.seguro_facturas_elegibles($1,$2,$3) AS page',[ship,prima,moneda]);assert.ok(r.rows[0].page.items.some(i=>i.id===pf),'eligible before concurrent change');await c.query('COMMIT');console.log('PASS selector supplies only a snapshot, no reservation');}
async function begin(c,user){await c.query('BEGIN');await c.query("SELECT set_config('request.jwt.claims',$1,true)",[JSON.stringify({sub:user,role:'authenticated'})]);await c.query('SET LOCAL ROLE authenticated');await c.query("SET LOCAL statement_timeout='8s'");}
const insert=(c,pf,e,org,premium=100,currency='MXN',deleted=false)=>c.query(`INSERT INTO public.seguros_embarque(organization_id,embarque_id,aseguradora,numero_poliza,prima,moneda,vigencia_desde,vigencia_hasta,proveedor_factura_id,deleted_at) VALUES($1,$2,'Synthetic concurrency',$3,$4,$5,CURRENT_DATE,CURRENT_DATE+365,$6,$7) RETURNING id`,[org,e,randomUUID(),premium,currency,pf,deleted?new Date():null]);
function pending(p){return p.then(value=>({value}),error=>({error}));}
async function blocked(observer,c){const end=Date.now()+5000;while(Date.now()<end){const r=await observer.query("SELECT wait_event_type FROM pg_stat_activity WHERE pid=$1",[c.processID]);if(r.rows[0]?.wait_event_type==='Lock')return;await new Promise(r=>setTimeout(r,20));}throw new Error('Expected lock wait was not observed');}
function reject(r,code,label){assert.equal(r.error?.code,code,label+': '+r.error?.message);console.log('PASS '+label+' '+code);}
(async()=>{
 const observer=await connect('148-observer');const a=await connect('148-writer-a');const b=await connect('148-writer-b');
 const ownership=(await observer.query("SELECT shobj_description(oid,'pg_database') marker,pg_get_userbyid(datdba) owner FROM pg_database WHERE datname=current_database()")).rows[0];
 assert.deepEqual(ownership,{marker:state.marker,owner:'postgres'});
 await observer.query(readFileSync(path.join(root,'supabase/tests/rls/_helpers.sql'),'utf8'));
 await observer.query('BEGIN');const f=(await observer.query("SELECT * FROM pg_temp.seed_org_pair('CONCURRENT148','admin_org')")).rows[0];
 const provider=randomUUID(),category=randomUUID(),client=randomUUID(),shipment=randomUUID(),concept=randomUUID();const invoices=Array.from({length:7},()=>randomUUID());
 await observer.query("INSERT INTO proveedores(id,organization_id,nombre,categoria,tipo) VALUES($1,$2,'Synthetic concurrent insurer','Logistico','Naviera')",[provider,f.org_a]);
 await observer.query("INSERT INTO presupuesto_categorias(id,organization_id,nombre) VALUES($1,$2,'Synthetic coverage')",[category,f.org_a]);
 await observer.query("INSERT INTO clientes(id,organization_id,nombre,email) VALUES($1,$2,'Synthetic coverage client','concurrent148@test.local')",[client,f.org_a]);
 await observer.query("INSERT INTO embarques(id,organization_id,cliente_id,expediente,modo,tipo,tipo_cambio_usd,tipo_cambio_eur) VALUES($1,$2,$3,'DEMO-2026-148990','Marítimo','Importación',20,22)",[shipment,f.org_a,client]);
 await observer.query("INSERT INTO conceptos_costo(id,organization_id,embarque_id,proveedor_id,concepto,monto,moneda) VALUES($1,$2,$3,$4,'Concurrent allocation',1000000,'MXN')",[concept,f.org_a,shipment,provider]);
 for(const pf of invoices){await observer.query("INSERT INTO proveedor_facturas(id,organization_id,proveedor_id,categoria_presupuesto_id,embarque_id,folio_proveedor,moneda,subtotal,total,estado) VALUES($1,$2,$3,$4,$5,$1::uuid::text,'MXN',100,100,'Vigente')",[pf,f.org_a,provider,category,shipment]);await observer.query("INSERT INTO proveedor_facturas_conceptos(organization_id,proveedor_factura_id,concepto_costo_id,descripcion,cantidad,monto) VALUES($1,$2,$3,'Concurrent allocation',1,100)",[f.org_a,pf,concept]);}
 await observer.query('COMMIT');
 await selected(b,f.admin_a,shipment,invoices[0]);
 // Header writer wins first: the validator must re-read AFTER waiting.
 await begin(a,f.admin_a);await a.query('UPDATE proveedor_facturas SET subtotal=60,total=60 WHERE id=$1',[invoices[0]]);
 await begin(b,f.admin_a);let work=pending(insert(b,invoices[0],shipment,f.org_a));await blocked(observer,b);await a.query('COMMIT');let outcome=await work;reject(outcome,'23514','header edit commits before policy and insufficient new base is rejected');assert.match(outcome.error.message,/LC_SEGURO_COBERTURA_INCOMPLETA/);await b.query('ROLLBACK');
 await selected(b,f.admin_a,shipment,invoices[1]);
 // Policy wins first: the established PFC parent lock refuses conflicting edit.
 await begin(a,f.admin_a);await insert(a,invoices[1],shipment,f.org_a);
 await begin(b,f.admin_a);outcome=await pending(b.query('UPDATE proveedor_facturas_conceptos SET monto=60 WHERE proveedor_factura_id=$1',[invoices[1]]));reject(outcome,'40001','PFC writer does not overwrite a parent held by validating policy');await b.query('ROLLBACK');await a.query('COMMIT');
 await selected(b,f.admin_a,shipment,invoices[2]);
 // An independent cost-concept edit must not be evaluated from an old snapshot.
 await begin(a,f.admin_a);await a.query("UPDATE conceptos_costo SET concepto='Edited concurrent allocation' WHERE id=$1",[concept]);
 await begin(b,f.admin_a);outcome=await pending(insert(b,invoices[2],shipment,f.org_a));reject(outcome,'40001','independent concept writer yields explicit dependency conflict');await b.query('ROLLBACK');await a.query('ROLLBACK');
 await selected(b,f.admin_a,shipment,invoices[3],5,'USD');
 // FX changes either serialize or return an explicit conflict; never stale success.
 await begin(a,f.admin_a);await a.query('UPDATE embarques SET tipo_cambio_usd=1 WHERE id=$1',[shipment]);
 await begin(b,f.admin_a);work=pending(insert(b,invoices[3],shipment,f.org_a,5,'USD'));
 await new Promise(r=>setTimeout(r,100));await a.query('COMMIT');outcome=await work;assert.ok(['23514','40001'].includes(outcome.error?.code),'concurrent FX change must fail closed');console.log('PASS concurrent frozen FX edit rejects stale premium valuation '+outcome.error.code);await b.query('ROLLBACK');await observer.query('UPDATE embarques SET tipo_cambio_usd=20 WHERE id=$1',[shipment]);
 await selected(b,f.admin_a,shipment,invoices[4]);
 // Existing active uniqueness serializes two new policies on one invoice.
 await begin(a,f.admin_a);await insert(a,invoices[4],shipment,f.org_a);
 await begin(b,f.admin_a);work=pending(insert(b,invoices[4],shipment,f.org_a));await blocked(observer,b);await a.query('COMMIT');outcome=await work;reject(outcome,'23505','concurrent new policies preserve one active link per invoice');await b.query('ROLLBACK');
 // Restore race uses the existing restore gate, not the broken generic RPC.
 await begin(a,f.admin_a);let x=(await insert(a,invoices[5],shipment,f.org_a,100,'MXN',true)).rows[0].id;let y=(await insert(a,invoices[5],shipment,f.org_a,100,'MXN',true)).rows[0].id;await a.query('COMMIT');
 await begin(a,f.admin_a);await a.query("SELECT set_config('app.papelera_restore','on',true)");await a.query('UPDATE seguros_embarque SET deleted_at=NULL WHERE id=$1',[x]);
 await begin(b,f.admin_a);await b.query("SELECT set_config('app.papelera_restore','on',true)");work=pending(b.query('UPDATE seguros_embarque SET deleted_at=NULL WHERE id=$1',[y]));await blocked(observer,b);await a.query('COMMIT');outcome=await work;reject(outcome,'23505','concurrent restores preserve active uniqueness');await b.query('ROLLBACK');
 // A post-preflight parent-tenant edit shows why a clean snapshot is not
 // durable protection. No trigger/constraint is disabled, and only synthetic
 // rows in the owned disposable database are changed.
 const otherShip=randomUUID(),otherConcept=randomUUID(),crossInvoice=randomUUID(),foreignClient=randomUUID();
 await observer.query("INSERT INTO clientes(id,organization_id,nombre,email) VALUES($1,$2,'Synthetic foreign client','selector-concurrency-b@test.local')",[foreignClient,f.org_b]);
 await observer.query("INSERT INTO embarques(id,organization_id,cliente_id,expediente,modo,tipo,tipo_cambio_usd,tipo_cambio_eur) VALUES($1,$2,$3,'DEMO-2026-148991','Marítimo','Importación',20,22)",[otherShip,f.org_a,client]);
 await observer.query("INSERT INTO conceptos_costo(id,organization_id,embarque_id,proveedor_id,concepto,monto,moneda) VALUES($1,$2,$3,$4,'Synthetic hidden denominator',0,'MXN')",[otherConcept,f.org_a,otherShip,provider]);
 await observer.query("INSERT INTO proveedor_facturas(id,organization_id,proveedor_id,categoria_presupuesto_id,embarque_id,folio_proveedor,moneda,subtotal,total,estado) VALUES($1,$2,$3,$4,$5,$1::uuid::text,'MXN',200,200,'Vigente')",[crossInvoice,f.org_a,provider,category,shipment]);
 await observer.query("INSERT INTO proveedor_facturas_conceptos(organization_id,proveedor_factura_id,concepto_costo_id,descripcion,cantidad,monto) VALUES($1,$2,$3,'Synthetic hidden input',1,100)",[f.org_a,crossInvoice,otherConcept]);
 await selected(b,f.admin_a,shipment,invoices[6]);
 await a.query('BEGIN');
 outcome=await pending(a.query('UPDATE embarques SET organization_id=$1,cliente_id=$3 WHERE id=$2',[f.org_b,otherShip,foreignClient]));
 reject(outcome,'23503','persistent composite FK blocks parent-tenant change before commit');
 assert.equal(outcome.error.constraint,'cc_shipment_same_org_fk');await a.query('ROLLBACK');
 await selected(b,f.admin_a,shipment,invoices[6]);
 // Deterministic interruption inside the function: PF lock is first needed
 // after access/context checks, inside its containment SELECT. Observe the lock
 // wait before cancellation; no timing guess or PL/pgSQL hook is introduced.
 await a.query('BEGIN');await a.query('LOCK TABLE public.proveedor_facturas IN ACCESS EXCLUSIVE MODE');
 await begin(b,f.admin_a);
 work=pending(b.query('SELECT public.seguro_facturas_elegibles($1,100,\'MXN\')',[shipment]));
 await blocked(observer,b);await observer.query('SELECT pg_cancel_backend($1)',[b.processID]);
 outcome=await work;reject(outcome,'P0001','actual in-function cancellation has generic error');
 assert.equal(outcome.error.message,'LC_SELECTOR148_NO_DISPONIBLE');await b.query('ROLLBACK');await a.query('ROLLBACK');
 await a.query('BEGIN');await a.query('LOCK TABLE public.proveedor_facturas IN ACCESS EXCLUSIVE MODE');
 await begin(b,f.admin_a);await b.query("SET LOCAL statement_timeout='250ms'");
 work=pending(b.query('SELECT public.seguro_facturas_elegibles($1,100,\'MXN\')',[shipment]));
 await blocked(observer,b);outcome=await work;
 reject(outcome,'P0001','actual statement timeout has generic error');
 assert.equal(outcome.error.message,'LC_SELECTOR148_NO_DISPONIBLE');await b.query('ROLLBACK');await a.query('ROLLBACK');
 console.log('PASS 6 existing writer races after selection, 1 exact parent-tenant FK rejection and 2 controlled interruptions; CI proof is not destination approval');
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(async()=>{for(const c of clients){try{await c.query('ROLLBACK');await c.end();}catch{}}});
