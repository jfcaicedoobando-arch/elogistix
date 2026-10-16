import test from 'node:test';
import assert from 'node:assert/strict';
import {createOwner} from './owner.mjs';
import {SQL} from './store.mjs';
import {dedicatedDriver} from './driver.mjs';
const ctx='00000000-0000-4000-8000-000000000001';
const oid='00000000-0000-4000-8000-000000000002';
const config={deployment:'fixture',database:'fixture',sessionUser:'fixture',durabilityEvidence:'fixture-only',driverEvidence:'fixture-only'};
function harness(fault={}) {
 const history=new Set();
 const row={context_id:ctx,obligation_id:oid,binding:{skipMs:0}};
 const stats={calls:[],business:0,closes:0,wires:0};
 const openWire=async()=>{
  stats.wires++;
  let tx=false,pending=false,commits=0;
  const m={socketEpoch:'socket'+stats.wires,backendPid:'1',backendStart:'fixture',database:'fixture',sessionUser:'fixture',ready:'I',exclusive:true,noReconnect:true,noReplay:true};
  return {metadata:()=>({...m}),close:async()=>{stats.closes++;pending=false; m.ready='closed';if(fault.close)throw Error('close');},
   query:async(text,params)=>{
    stats.calls.push(text);
    if(fault.fail===text)throw Error('query fault');
    if(text===SQL.begin){tx=true;m.ready='T';return {command:'BEGIN',rows:[],rowCount:0};}
    if(text===SQL.durable)return {command:'SET',rows:[],rowCount:0};
    if(text===SQL.ingress){
     assert.equal(tx,true); assert.deepEqual(params,[config.deployment,ctx]);
     pending=!history.has(oid)&&!fault.noDispatch;
     return {command:'INSERT',rows:pending?[structuredClone(row)]:[],rowCount:pending?1:0};
    }
    if(text===SQL.commit){
     commits++;if(pending)history.add(oid);pending=false;tx=false;m.ready='I';
     if(fault.epoch&&commits===1)m.socketEpoch='replacement';
     if(fault.lostAck===commits)throw Error('ACK lost');
     return {command:fault.badCommit?'ROLLBACK':'COMMIT',rows:[],rowCount:0};
    }
    if(text===SQL.business){
     stats.business++;assert.equal(tx,true);assert.equal(history.has(oid),true);
     if(fault.business) {m.ready='E';throw Error('rollback');}
     return {command:'SELECT',rows:[{result:{fixture:true}}],rowCount:1};
    }
    throw Error('unexpected SQL');
   }
  };
 };
 const owner=createOwner({config,openWire,authenticate:async()=>!fault.auth,businessGuard:async()=>!fault.guard});
 return {owner,stats,history,openWire};
}
test('empty config does not open transport',async()=>{let opens=0;assert.equal((await createOwner({openWire:()=>{opens++;}}).execute({contextId:ctx})).outcome,'quarantine');assert.equal(opens,0);});
test('happy flow: durable claim COMMIT then one business transaction',async()=>{const h=harness();assert.equal((await h.owner.execute({contextId:ctx})).outcome,'business_commit_acknowledged');assert.deepEqual(h.stats.calls,[SQL.begin,SQL.durable,SQL.ingress,SQL.commit,SQL.begin,SQL.business,SQL.commit]);assert.equal(h.stats.business,1);});
test('reconstructed owner same durable row cannot regain execution',async()=>{const h=harness();await h.owner.execute({contextId:ctx});const second=createOwner({config,openWire:h.openWire,authenticate:async()=>true,businessGuard:async()=>true});assert.equal((await second.execute({contextId:ctx})).outcome,'sealed');assert.equal(h.stats.business,1);});
test('client cannot supply workId, namespace, skip or changed context with workId',async()=>{for(const extra of [{workId:'new'},{deployment:'new'},{skipMs:0},{admissionSha256:'x'}]){const h=harness();assert.equal((await h.owner.execute({contextId:ctx,...extra})).outcome,'quarantine');assert.equal(h.stats.wires,0);}});
test('unknown claim ACK seals forever and starts no business',async()=>{const h=harness({lostAck:1});assert.equal((await h.owner.execute({contextId:ctx})).outcome,'quarantine');assert.equal(h.history.size,1);assert.equal(h.stats.business,0);await h.owner.execute({contextId:ctx});assert.equal(h.stats.business,0);});
test('business rollback cannot unconsume claim',async()=>{const h=harness({business:true});await h.owner.execute({contextId:ctx});assert.equal(h.history.size,1);assert.equal((await h.owner.execute({contextId:ctx})).outcome,'sealed');assert.equal(h.stats.business,1);});
test('unknown business COMMIT ACK cannot invoke again',async()=>{const h=harness({lostAck:2});assert.equal((await h.owner.execute({contextId:ctx})).outcome,'quarantine');await h.owner.execute({contextId:ctx});assert.equal(h.stats.business,1);});
test('physical connection change after claim prevents business',async()=>{const h=harness({epoch:true});assert.equal((await h.owner.execute({contextId:ctx})).outcome,'quarantine');assert.equal(h.stats.business,0);});
test('ROLLBACK command tag never counts as commit acknowledgment',async()=>{const h=harness({badCommit:true});await h.owner.execute({contextId:ctx});assert.equal(h.stats.business,0);});
test('missing dispatch row fails sealed without business',async()=>{const h=harness({noDispatch:true});assert.equal((await h.owner.execute({contextId:ctx})).outcome,'sealed');assert.equal(h.stats.business,0);});
test('authentication prevents socket acquisition',async()=>{const h=harness({auth:true});await h.owner.execute({contextId:ctx});assert.equal(h.stats.wires,0);});
test('revocation after claim burns obligation without business',async()=>{const h=harness({guard:true});await h.owner.execute({contextId:ctx});assert.equal(h.history.size,1);assert.equal(h.stats.business,0);});
test('cleanup uncertainty reported even on duplicate sealed path',async()=>{const h=harness({close:true});await h.owner.execute({contextId:ctx});assert.deepEqual(await h.owner.execute({contextId:ctx}),{outcome:'quarantine',cleanup:'unconfirmed'});});
test('claim insert failure never reaches business',async()=>{const h=harness({fail:SQL.ingress});await h.owner.execute({contextId:ctx});assert.equal(h.stats.business,0);assert.equal(h.history.size,0);assert.equal(h.stats.closes,1);});
test('driver rejects unproven exclusive and noReplay metadata',async()=>{for(const key of ['exclusive','noReplay','noReconnect']){const h=harness();const w=await h.openWire(),original=w.metadata;w.metadata=()=>({...original(),[key]:false});assert.throws(()=>dedicatedDriver(w,config),/HOLD_PHYSICAL/);}});
test('driver rejects concurrent use and poisons in-flight result',async()=>{const h=harness();const w=await h.openWire();let resolve;w.query=()=>new Promise(r=>resolve=r);const d=dedicatedDriver(w,config);const first=d.query('x',[],'I','I','SELECT');await assert.rejects(d.query('y',[],'I','I','SELECT'),/CONCURRENT/);resolve({command:'SELECT',rows:[],rowCount:0});await assert.rejects(first,/PHYSICAL/);await d.close();});
import {createIssuer} from './issuer.mjs';
test('issuer same obligation survives changes to both context and retry/snapshot binding',async()=>{
 const base={tenant:'t',manifestIdentity:'logical-family',schedulerJob:'job',authorizedOccurrence:'approved-occurrence',contextId:ctx,binding:{skipMs:0}};
 let authoritative=base;
 const issuer=createIssuer(async()=>authoritative,'fixture');
 const a=await issuer.derive('opaque-authenticated-ticket');
 authoritative={...base,contextId:oid,binding:{skipMs:12,retryId:'new',snapshot:'new'}};
 const b=await issuer.derive('another-ticket');assert.equal(a.obligationId,b.obligationId);assert.equal(a.canonical,b.canonical);
 authoritative={...base,authorizedOccurrence:'separately-authorized-new-occurrence'};
 assert.notEqual((await issuer.derive('third-ticket')).obligationId,a.obligationId);
});
test('issuer without authenticated resolver fails closed',async()=>{await assert.rejects(createIssuer().derive({workId:'arbitrary'}),/HOLD_ISSUER/);});
test('inherited context does not bypass strict request keys',async()=>{const h=harness();await h.owner.execute(Object.assign(Object.create({contextId:ctx}),{workId:'x'}));assert.equal(h.stats.wires,0);});
test('pre-query metadata mismatch permanently poisons driver even if metadata recovers',async()=>{
 const h=harness(),w=await h.openWire(),original=w.metadata;
 let mismatch=false;
 w.metadata=()=>({...original(),...(mismatch?{socketEpoch:'replacement'}:{})});
 const d=dedicatedDriver(w,config);mismatch=true;
 await assert.rejects(d.query(SQL.begin,[],'I','T','BEGIN'),/PHYSICAL/);
 mismatch=false;
 await assert.rejects(d.query(SQL.begin,[],'I','T','BEGIN'),/PHYSICAL/);
 assert.equal(h.stats.calls.length,0);await d.close();
});
test('pre-query metadata exception permanently poisons driver even if metadata recovers',async()=>{
 const h=harness(),w=await h.openWire(),original=w.metadata;
 let broken=false,reads=0;
 w.metadata=()=>{reads++;if(broken)throw Error('metadata unavailable');return original();};
 const d=dedicatedDriver(w,config);broken=true;
 await assert.rejects(d.query(SQL.begin,[],'I','T','BEGIN'),/metadata unavailable/);
 const before=reads;broken=false;
 await assert.rejects(d.query(SQL.begin,[],'I','T','BEGIN'),/PHYSICAL/);
 assert.equal(reads,before);assert.equal(h.stats.calls.length,0);await d.close();
});
test('pre-query wrong ReadyForQuery state remains terminal after state recovers',async()=>{
 const h=harness(),w=await h.openWire(),original=w.metadata;
 let wrong=false;
 w.metadata=()=>({...original(),...(wrong?{ready:'T'}:{})});
 const d=dedicatedDriver(w,config);wrong=true;
 await assert.rejects(d.query(SQL.begin,[],'I','T','BEGIN'),/PHYSICAL/);
 wrong=false;await assert.rejects(d.query(SQL.begin,[],'I','T','BEGIN'),/PHYSICAL/);
 assert.equal(h.stats.calls.length,0);await d.close();
});
test('context getter is read once and same validated identity reaches SQL',async()=>{
 const h=harness();let reads=0;
 const request={get contextId(){reads++;return reads===1?ctx:oid;}};
 assert.equal((await h.owner.execute(request)).outcome,'business_commit_acknowledged');
 assert.equal(reads,1);assert.equal(h.stats.business,1);
});
test('context objects cannot coerce into UUID during validation',async()=>{
 const h=harness();let coerces=0;
 assert.equal((await h.owner.execute({contextId:{toString(){coerces++;return ctx;}}})).outcome,'quarantine');
 assert.equal(coerces,0);assert.equal(h.stats.wires,0);
});
test('hidden and symbol request overrides are rejected',async()=>{
 for(const key of ['workId',Symbol('workId')]){
  const h=harness(),request={contextId:ctx};Object.defineProperty(request,key,{value:'arbitrary',enumerable:false});
  await h.owner.execute(request);assert.equal(h.stats.wires,0);
 }
});
