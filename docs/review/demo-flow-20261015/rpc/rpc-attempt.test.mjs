import test from 'node:test';
import assert from 'node:assert/strict';
import {createRpcAttempt,createPrivateRpcAdapter} from './rpc-attempt.ts';
let serial=0;
function setup(options={}){
 const n=++serial,contextId=`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
 const reference={contextId,skipMs:600000};
 const checkpoint={context_id:contextId,run_id:'10000000-0000-4000-8000-000000000001',lineage_id:'20000000-0000-4000-8000-000000000001',checkpoint_id:'30000000-0000-4000-8000-000000000001',checked_at:'2026-10-15T18:00:00Z',status:'materialized',materialization:'executed'};
 const calls=[];
 const backend={scope:`test-${n}`,async post(name,args){calls.push({name,args});if(options.hook)await options.hook(name,args);if(options.error)throw options.error;return options.reply??{status:200,error:null,data:name==='prepare_execute_checkpoint'?(options.writeData??checkpoint):(options.reconcileData??{classification:'complete',context_id:contextId,checkpoint})};}};
 return{options,reference,checkpoint,calls,backend,attempt:()=>createRpcAttempt(backend,reference)};
}
test('one RPC contains prepare+execute+checkpoint; only fixed server context fields',async()=>{const s=setup(),a=s.attempt();const r=await a.execute();assert.equal(r.outcome,'committed');assert.equal(r.recovered,false);assert.deepEqual(r.checkpoint,s.checkpoint);assert.deepEqual(s.calls,[{name:'prepare_execute_checkpoint',args:{p_context_id:s.reference.contextId,p_skip_ms:600000}}]);await assert.rejects(a.execute(),/RECONCILE_ONLY/);await assert.rejects(s.attempt().execute(),/RECONCILE_ONLY/);});
test('recent uses acknowledged verified replay without second RPC',async()=>{const s=setup();s.options.writeData={...s.checkpoint,status:'recent',materialization:'replayed'};assert.equal((await s.attempt().execute()).outcome,'recent');assert.equal(s.calls.length,1);});
test('ACK lost after server commit: unresolved then historical receipt recovers without repeat',async()=>{const e=Error('response lost');const s=setup({error:e}),a=s.attempt();const r=await a.execute();assert.equal(r.outcome,'unresolved');assert.equal(r.reason,'transport');assert.equal(r.cause,e);await assert.rejects(a.execute(),/RECONCILE_ONLY/);delete s.options.error;const recovered=await a.reconcile();assert.equal(recovered.outcome,'committed');assert.equal(recovered.recovered,true);assert.deepEqual(s.calls.map(c=>c.name),['prepare_execute_checkpoint','reconcile_context']);});
test('timeout before known admission still prevents resend or fresh attempt retry',async()=>{const s=setup({error:Error('timeout')}),a=s.attempt();await a.execute();await assert.rejects(a.execute(),/RECONCILE_ONLY/);await assert.rejects(s.attempt().execute(),/RECONCILE_ONLY/);assert.equal(s.calls.length,1);});
for(const status of [0,201,204,301,400,401,403,409,429,500,503])test(`HTTP ${status} does not imply ready or permit retry`,async()=>{const s=setup({reply:{status,error:null,data:{ready:true}}}),a=s.attempt();assert.equal((await a.execute()).outcome,'unresolved');await assert.rejects(a.execute(),/RECONCILE_ONLY/);assert.equal(s.calls.length,1);});
test('HTTP 200 with error is unresolved',async()=>{const s=setup({reply:{status:200,error:{code:'P0001'},data:{ready:true}}});assert.equal((await s.attempt().execute()).reason,'rpc_rejected');});
for(const writeData of [true,[],{}, {ready:true,authority:true}, {status:'materialized'},'committed'])test(`payload cannot manufacture capability ${JSON.stringify(writeData)}`,async()=>{const s=setup({writeData});assert.equal((await s.attempt().execute()).reason,'invalid_reply');});
test('untrusted top-level outcome cannot bypass reply validation',async()=>{const s=setup({reply:{status:200,error:null,data:{},outcome:'committed',checkpoint:{ready:true}}});assert.equal((await s.attempt().execute()).outcome,'unresolved');});
test('different context response fails closed',async()=>{const s=setup();s.options.writeData={...s.checkpoint,context_id:'90000000-0000-4000-8000-000000000001'};assert.equal((await s.attempt().execute()).reason,'invalid_reply');});
test('recent executed inconsistency fails closed',async()=>{const s=setup();s.options.writeData={...s.checkpoint,status:'recent'};assert.equal((await s.attempt().execute()).reason,'invalid_reply');});
for(const classification of ['absent','inconsistent','unresolved'])test(`recovery ${classification} never permits a new write`,async()=>{const s=setup();s.options.reconcileData={classification,context_id:s.reference.contextId,terminal:true};const a=s.attempt();const r=await a.reconcile();assert.equal(r.outcome,'unresolved');assert.equal(r.reason,classification);await assert.rejects(a.execute(),/RECONCILE_ONLY/);assert.deepEqual(s.calls.map(c=>c.name),['reconcile_context']);});
test('fresh recovery with historical exact receipt returns committed without writer',async()=>{const s=setup();assert.equal((await s.attempt().reconcile()).outcome,'committed');assert.deepEqual(s.calls.map(c=>c.name),['reconcile_context']);});
test('complete classification without checkpoint is not ready',async()=>{const s=setup();s.options.reconcileData={classification:'complete',context_id:s.reference.contextId};assert.equal((await s.attempt().reconcile()).reason,'invalid_reply');});
test('recovery checkpoint of wrong context is rejected',async()=>{const s=setup();s.options.reconcileData={classification:'complete',context_id:s.reference.contextId,checkpoint:{...s.checkpoint,context_id:'other'}};assert.equal((await s.attempt().reconcile()).reason,'invalid_reply');});
test('recovery transport failure remains unresolved and may only be recovered again',async()=>{const s=setup({error:Error('network')}),a=s.attempt();assert.equal((await a.reconcile()).reason,'transport');await assert.rejects(a.execute(),/RECONCILE_ONLY/);delete s.options.error;assert.equal((await a.reconcile()).outcome,'committed');assert.ok(s.calls.every(c=>c.name==='reconcile_context'));});
test('pending call blocks duplicate execution/recovery including another wrapper',async()=>{let enter,resume;const entered=new Promise(r=>enter=r),wait=new Promise(r=>resume=r);const s=setup({hook:async()=>{enter();await wait;}}),a=s.attempt();const result=a.execute();await entered;await assert.rejects(a.execute(),/RECONCILE_ONLY/);await assert.rejects(a.reconcile(),/STILL_PENDING/);await assert.rejects(s.attempt().reconcile(),/STILL_PENDING/);resume();assert.equal((await result).outcome,'committed');assert.equal(s.calls.length,1);});
test('input is copied and frozen; caller cannot redirect pending reference',async()=>{const s=setup(),a=s.attempt();s.reference.contextId='malicious';s.reference.skipMs=1;assert.throws(()=>a.reference.contextId='other');await a.execute();assert.equal(s.calls[0].args.p_skip_ms,600000);assert.notEqual(s.calls[0].args.p_context_id,'malicious');});
test('invalid input rejected before backend call',()=>{const s=setup();for(const patch of [{contextId:'bad'},{skipMs:-1},{skipMs:NaN},{skipMs:1.2}])assert.throws(()=>createRpcAttempt(s.backend,{...s.reference,...patch}),/REFERENCE_INVALID/);assert.equal(s.calls.length,0);});

test('existing server client adapter forces POST and permits only bounded function arguments',async()=>{const calls=[];const client={async rpc(...args){calls.push(args);return{status:200,data:{},error:null};}};const backend=createPrivateRpcAdapter(client,'adapter-test');await backend.post('reconcile_context',{p_context_id:'x'});assert.deepEqual(calls,[['reconcile_context',{p_context_id:'x'},{get:false,head:false}]]);await assert.rejects(backend.post('untrusted_function',{p_context_id:'x'}),/NOT_ALLOWED/);await assert.rejects(backend.post('prepare_execute_checkpoint',{p_context_id:'x',p_skip_ms:0,actor:'admin'}),/ARGUMENTS_NOT_ALLOWED/);assert.equal(calls.length,1);});
test('adapter rejection does not retry underlying client',async()=>{let count=0;const backend=createPrivateRpcAdapter({async rpc(){count++;throw Error('ACK lost');}},'adapter-error');await assert.rejects(backend.post('reconcile_context',{p_context_id:'x'}),/ACK lost/);assert.equal(count,1);});

for (const [field,value] of [['status',['recent']],['status',['materialized']],['materialization',['executed']],['materialization',['replayed']]]) test(`reject coerced enum ${field} ${JSON.stringify(value)}`,async()=>{const s=setup();s.options.writeData={...s.checkpoint,[field]:value};assert.equal((await s.attempt().execute()).reason,'invalid_reply');});
for (const classification of [['absent'],['unresolved'],['inconsistent']]) test(`reject coerced classification ${classification}`,async()=>{const s=setup();s.options.reconcileData={context_id:s.reference.contextId,classification};assert.equal((await s.attempt().reconcile()).reason,'invalid_reply');});

// These are protocol-double tests, not proof of PostgreSQL/HTTP commits.
for(const value of [null,undefined,0,true,[],{},['00000000-0000-4000-8000-000000000001'],new String('00000000-0000-4000-8000-000000000001'),{toString:()=> '00000000-0000-4000-8000-000000000001'}]) {
 test(`reject non-string context before transport ${String(value)}`,()=>{
  const s=setup();assert.throws(()=>createRpcAttempt(s.backend,{...s.reference,contextId:value}),/REFERENCE_INVALID/);assert.equal(s.calls.length,0);
 });
}
for(const scope of [null,undefined,0,true,[],{},['scope'],new String('scope')]) {
 test(`reject non-string scope in both boundaries ${String(scope)}`,()=>{
  const s=setup();assert.throws(()=>createRpcAttempt({...s.backend,scope},s.reference),/REFERENCE_INVALID/);
  assert.throws(()=>createPrivateRpcAdapter({rpc:async()=>{}},scope),/CLIENT_REQUIRED/);assert.equal(s.calls.length,0);
 });
}
const badTimestamps=['1','2026','2026-10-15','2026-10-15 18:00:00Z','2026-10-15T18:00:00','2026-10-15T18:00Z',
 '2026-02-29T00:00:00Z','1900-02-29T00:00:00Z','2026-04-31T00:00:00Z','2026-00-01T00:00:00Z',
 '2026-13-01T00:00:00Z','2026-01-00T00:00:00Z','0000-01-01T00:00:00Z','2026-01-32T00:00:00Z',
 '2026-01-01T24:00:00Z','2026-01-01T00:60:00Z','2026-01-01T00:00:60Z','2026-01-01T00:00:00+16:00',
 '2026-01-01T00:00:00+00:60','2026-01-01T00:00:00+00:00:60','2026-01-01T00:00:00+0100',
 '2026-01-01T00:00:00.Z','2026-01-01T00:00:00.1234567Z','2026-01-01T00:00:00Z\n',
 'infinity','2026-1-1T00:00:00Z',null,1,['2026-01-01T00:00:00Z']];
for(const checked_at of badTimestamps) test(`reject timestamp ${JSON.stringify(checked_at)} in execute and recovery`,async()=>{
 for(const mode of ['execute','reconcile']) {
  const s=setup();const checkpoint={...s.checkpoint,checked_at};
  s.options.writeData=checkpoint;s.options.reconcileData={classification:'complete',context_id:s.reference.contextId,checkpoint};
  const result=await s.attempt()[mode]();assert.equal(result.outcome,'unresolved');assert.equal(result.reason,'invalid_reply');
 }
});
for(const checked_at of ['2026-10-15T18:00:00Z','2026-10-15T18:00:00.1+00:00','2026-10-15T18:00:00.123456-06:00',
 '2024-02-29T23:59:59.999999+05:30','2000-02-29T00:00:00Z','0001-01-01T00:00:00+00:00',
 '9999-12-31T23:59:59.000001-15:59:59','2026-01-01T00:00:00+05:30:15']) test(`accept exact timestamp ${checked_at}`,async()=>{
 for(const mode of ['execute','reconcile']) {
  const s=setup();const checkpoint={...s.checkpoint,checked_at};
  s.options.writeData=checkpoint;s.options.reconcileData={classification:'complete',context_id:s.reference.contextId,checkpoint};
  const result=await s.attempt()[mode]();assert.equal(result.outcome,'committed');assert.equal(result.checkpoint.checked_at,checked_at);
 }
});
