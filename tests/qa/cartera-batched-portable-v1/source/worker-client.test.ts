import assert from 'node:assert/strict';
import { runWorker } from './worker-client';
class FakeWorker {
  onmessage:any=null; onerror:any=null; onmessageerror:any=null; terminated=0;
  constructor(public post:(w:FakeWorker)=>void=()=>{}){}
  postMessage(){this.post(this);}
  terminate(){this.terminated++;}
}
let passed=0;
async function test(name:string, fn:()=>Promise<void>){await fn();passed++;console.log('PASS',name);}
await test('success terminates once and clears handlers',async()=>{const w=new FakeWorker(w=>queueMicrotask(()=>w.onmessage({data:{id:1,ok:true,bytes:new Uint8Array([37,80,68,70])}})));const events:string[]=[];await runWorker(w as any,{},new AbortController().signal,[],e=>events.push(e));assert.equal(w.terminated,1);assert.equal(w.onmessage,null);assert.deepEqual(events,['started','terminated']);});
await test('pre-abort terminates without posting',async()=>{const c=new AbortController();c.abort();const w=new FakeWorker(()=>assert.fail('posted'));await assert.rejects(runWorker(w as any,{},c.signal),{name:'AbortError'});assert.equal(w.terminated,1);});
await test('inflight abort terminates once',async()=>{const c=new AbortController();const w=new FakeWorker(()=>queueMicrotask(()=>c.abort()));await assert.rejects(runWorker(w as any,{},c.signal),{name:'AbortError'});assert.equal(w.terminated,1);});
await test('structured clone failure terminates',async()=>{const w=new FakeWorker(()=>{throw new DOMException('clone failed','DataCloneError')});await assert.rejects(runWorker(w as any,{},new AbortController().signal),{name:'DataCloneError'});assert.equal(w.terminated,1);});
for(const kind of ['error','messageerror','bad-id','bad-bytes','render-error'])await test(kind+' terminates',async()=>{const w=new FakeWorker(w=>queueMicrotask(()=>{if(kind==='error')w.onerror({message:'load failed'});else if(kind==='messageerror')w.onmessageerror({});else w.onmessage({data:kind==='bad-id'?{id:2,ok:true,bytes:new Uint8Array()}:kind==='bad-bytes'?{id:1,ok:true,bytes:[]}:{id:1,ok:false,error:'render failed'}});}));await assert.rejects(runWorker(w as any,{},new AbortController().signal));assert.equal(w.terminated,1);});
await test('throwing observer cannot leak or hang',async()=>{const w=new FakeWorker(w=>queueMicrotask(()=>w.onmessage({data:{id:1,ok:true,bytes:new Uint8Array([37])}})));await runWorker(w as any,{},new AbortController().signal,[],()=>{throw new Error('observer')});assert.equal(w.terminated,1);});
console.log(JSON.stringify({passed,browserRuntime:false}));
