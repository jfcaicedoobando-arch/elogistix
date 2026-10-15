/** Staging only. No live backend is installed; no credential, GRANT or route activation. */
export interface PrivateRpcReply { status: number; data: unknown; error: unknown | null }
/** Existing server-only backend boundary. Must POST once, without transparent retries,
 * redirects, Prefer: tx=rollback, count-only/head modes, or transaction multiplexing.
 * Successful reply means PostgREST completed the database transaction before replying.
 * Never construct this adapter from a browser response, payload capability or user headers.
 * SQL still independently authenticates the protected context and transport principal. */
export interface PrivateRpcBackend {
 readonly scope: string;
 post(functionName: 'prepare_execute_checkpoint' | 'reconcile_context',
      args: Readonly<Record<string, string | number>>): Promise<PrivateRpcReply>;
}
export interface RpcReference { contextId: string; skipMs: number }
export interface RpcCheckpoint {
 context_id: string; run_id: string; lineage_id: string; checkpoint_id: string; checked_at: string;
 status: 'materialized'|'recent'; materialization: 'executed'|'replayed';
}
export type RpcOutcome =
 | { outcome: 'committed'|'recent'; checkpoint: Readonly<RpcCheckpoint>; recovered: boolean }
 | { outcome: 'unresolved'; reason: 'transport'|'rpc_rejected'|'invalid_reply'|'absent'|'inconsistent'|'unresolved'; cause?: unknown };
const UUID=/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
/** Strict finite PostgreSQL JSON timestamptz subset: AD years 0001..9999,
 * T separator, seconds, optional 1..6 microsecond digits, Z or numeric offset.
 * Validate the local calendar before offset conversion; Date.parse normalizes
 * impossible dates and accepts non-timestamp strings such as "1".
 * Numeric offsets may include seconds (historical PostgreSQL time zones).
 * Infinity, BC/expanded years, leap seconds and 24:00 are outside this contract. */
function timestamp(value:unknown):value is string {
 if(typeof value!=='string') return false;
 const m=/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,6})?(?:Z|([+-])(\d{2}):(\d{2})(?::(\d{2}))?)$/.exec(value);
 if(!m) return false;
 const year=Number(m[1]),month=Number(m[2]),day=Number(m[3]);
 const leap=year%4===0 && (year%100!==0 || year%400===0);
 const days=[31,leap?29:28,31,30,31,30,31,31,30,31,30,31];
 return year>=1 && month>=1 && month<=12 && day>=1 && day<=days[month-1] &&
  Number(m[4])<=23 && Number(m[5])<=59 && Number(m[6])<=59 &&
  (!m[7] || (Number(m[8])<=15 && Number(m[9])<=59 && Number(m[10]??0)<=59));
}
// Supplemental same-process guard only; durable context admission is a SQL prerequisite.
const attempted = new Set<string>();
const pending = new Set<string>();
function bad(code:string):never { throw new Error(code); }
function object(data:unknown):Record<string,unknown> {
 if(!data || typeof data!=='object' || Array.isArray(data)) bad('DEMO_RPC_OBJECT_REQUIRED');
 return data as Record<string,unknown>;
}
function checkpoint(data:unknown,contextId:string): Readonly<RpcCheckpoint> {
 const r=object(data);
 if(r.context_id!==contextId || typeof r.run_id!=='string' || !UUID.test(r.run_id) ||
    typeof r.lineage_id!=='string' || !UUID.test(r.lineage_id) ||
    typeof r.checkpoint_id!=='string' || !UUID.test(r.checkpoint_id) ||
    !timestamp(r.checked_at) ||
    (typeof r.status!=='string' || !['materialized','recent'].includes(r.status)) ||
    (typeof r.materialization!=='string' || !['executed','replayed'].includes(r.materialization)) ||
    (r.status==='recent' && r.materialization!=='replayed')) bad('DEMO_RPC_CHECKPOINT_INVALID');
 return Object.freeze({context_id:r.context_id as string,run_id:r.run_id,lineage_id:r.lineage_id,
 checkpoint_id:r.checkpoint_id,checked_at:r.checked_at,status:r.status as RpcCheckpoint['status'],
 materialization:r.materialization as RpcCheckpoint['materialization']});
}
function response(reply:PrivateRpcReply):boolean { return reply?.status===200 && reply.error===null; }
/** Reference must come from the verified server-side preparer, not HTTP request fields.
 * This factory validates structure only; its JS object is NOT a capability or authority. */
export function createRpcAttempt(backend:PrivateRpcBackend,input:RpcReference) {
 if(typeof backend.scope!=='string' || !backend.scope || typeof input.contextId!=='string' || !UUID.test(input.contextId) || !Number.isSafeInteger(input.skipMs) || input.skipMs<0)
  bad('DEMO_RPC_REFERENCE_INVALID');
 const reference=Object.freeze({...input});
 const key=JSON.stringify([backend.scope,reference.contextId]);
 let state:'fresh'|'pending'|'terminal'|'unresolved'='fresh';
 async function call(name:'prepare_execute_checkpoint'|'reconcile_context',args:Readonly<Record<string,string|number>>):Promise<{kind:'reply';reply:PrivateRpcReply}|{kind:'failure';result:RpcOutcome}> {
  try {
   const reply=await backend.post(name,Object.freeze({...args}));
   if(!response(reply)) return {kind:'failure',result:{outcome:'unresolved',reason:'rpc_rejected',cause:reply?.error}};
   return {kind:'reply',reply};
  } catch(cause) { return {kind:'failure',result:{outcome:'unresolved',reason:'transport',cause}}; }
 }
 function success(c:Readonly<RpcCheckpoint>,recovered:boolean):RpcOutcome {
  state='terminal';return{outcome:c.status==='recent'?'recent':'committed',checkpoint:c,recovered};
 }
 return Object.freeze({
  reference,
  async execute():Promise<RpcOutcome> {
   if(state!=='fresh' || attempted.has(key)) bad('DEMO_RPC_RECONCILE_ONLY');
   state='pending';attempted.add(key);pending.add(key);
   const reply=await call('prepare_execute_checkpoint',{p_context_id:reference.contextId,p_skip_ms:reference.skipMs});
   state='unresolved';pending.delete(key);
   if(reply.kind==='failure') return reply.result;
   try { return success(checkpoint(reply.reply.data,reference.contextId),false); }
   catch(cause){return{outcome:'unresolved',reason:'invalid_reply',cause};}
  },
  async reconcile():Promise<RpcOutcome> {
   if(state==='pending' || pending.has(key)) bad('DEMO_RPC_STILL_PENDING');
   // A new object may recover after restart, but can never switch from recovery to writing.
   state='pending';attempted.add(key);pending.add(key);
   const reply=await call('reconcile_context',{p_context_id:reference.contextId});
   state='unresolved';pending.delete(key);
   if(reply.kind==='failure') return reply.result;
   try {
    const r=object(reply.reply.data);
    if(r.context_id!==reference.contextId) bad('DEMO_RPC_CONTEXT_MISMATCH');
    if(r.classification==='complete') return success(checkpoint(r.checkpoint,reference.contextId),true);
    if(typeof r.classification==='string' && ['absent','inconsistent','unresolved'].includes(r.classification))
     return {outcome:'unresolved',reason:r.classification as 'absent'|'inconsistent'|'unresolved'};
    bad('DEMO_RPC_RECONCILIATION_INVALID');
   }catch(cause){return{outcome:'unresolved',reason:'invalid_reply',cause};}
  },
 });
}

/** Minimal shape of an already authorized server client, configured for the reviewed schema.
 * Client construction, credentials, PostgREST schema exposure and grants are deliberately absent.
 * Caller must audit client middleware for retries/redirects/Prefer rollback before binding it. */
export interface ExistingServerRpcClient {
 rpc(functionName:string,args:Readonly<Record<string,string|number>>,options:{get:false;head:false}):PromiseLike<PrivateRpcReply>;
}
export function createPrivateRpcAdapter(client:ExistingServerRpcClient,scope:string):PrivateRpcBackend {
 if(typeof scope!=='string' || !scope || !client || typeof client.rpc!=='function') bad('DEMO_PRIVATE_RPC_CLIENT_REQUIRED');
 return Object.freeze({scope,async post(name:'prepare_execute_checkpoint'|'reconcile_context',args:Readonly<Record<string,string|number>>) {
  if(name!=='prepare_execute_checkpoint' && name!=='reconcile_context') bad('DEMO_RPC_NOT_ALLOWED');
  const allowed=name==='prepare_execute_checkpoint'?['p_context_id','p_skip_ms']:['p_context_id'];
  if(Object.keys(args).length!==allowed.length || Object.keys(args).some(k=>!allowed.includes(k))) bad('DEMO_RPC_ARGUMENTS_NOT_ALLOWED');
  // Single awaited invocation. SQL independently enforces read-only semantics of reconcile_context.
  const reply=await client.rpc(name,args,{get:false,head:false});
  return {status:reply.status,data:reply.data,error:reply.error};
 }});
}
