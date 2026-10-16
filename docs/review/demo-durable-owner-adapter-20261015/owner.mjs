import {dedicatedDriver,EMPTY_CONFIG} from './driver.mjs';
import {consume,SQL} from './store.mjs';
const uuid=/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/;
/** Authenticated internal ingress receives only a context reference. The DB issuer derives
 * stable obligation and full binding. No workId/admission/scope/skip override is accepted.
 * Factory/authenticate/businessGuard are unconfigured TRUSTED integration boundaries;
 * a success boolean is not an authentication implementation or runtime certification.
 */
export function createOwner({config=EMPTY_CONFIG,openWire,authenticate,businessGuard}={}) {
 config=Object.freeze({...config});
 return Object.freeze({async execute(request) {
  let d, result={outcome:'quarantine'};
  try {
   if(Object.keys(EMPTY_CONFIG).some(k=>typeof config[k]!=='string'||!config[k].trim())||!openWire||!authenticate||!businessGuard)throw Error('HOLD_CONFIGURATION');
   if(!request||typeof request!=='object'||Reflect.ownKeys(request).length!==1||!Object.hasOwn(request,'contextId'))throw Error('HOLD_REQUEST');
   const contextId=request.contextId; // read once; validate and use this primitive snapshot only
   if(typeof contextId!=='string'||!uuid.test(contextId))throw Error('HOLD_REQUEST');
   if(await authenticate(contextId)!==true)throw Error('HOLD_AUTHENTICATION');
   const wire=await openWire();
   try {d=dedicatedDriver(wire,config);}catch(e){await wire.close();throw e;}
   const claim=await consume(d,'ingress',config.deployment,contextId);
   if(!claim) { result={outcome:'sealed'}; } else {
   if(claim.context_id!==contextId||!uuid.test(claim.obligation_id)||
     !claim.binding||!Number.isSafeInteger(claim.binding.skipMs)||claim.binding.skipMs<0)throw Error('HOLD_BINDING');
   // Must validate issuer identity, tenant, binding format and current policy before business.
   // SQL business entrypoint must ALSO enforce authoritative current guards in businessTX.
   if(await businessGuard(Object.freeze(structuredClone(claim)))!==true)throw Error('HOLD_BUSINESS_GUARDS');
   await d.query(SQL.begin,[],'I','T','BEGIN');
   const r=await d.query(SQL.business,[contextId,claim.binding.skipMs],'T','T','SELECT');
   if(r.rows.length!==1||r.rowCount!==1)throw Error('HOLD_BUSINESS_RESULT');
   await d.query(SQL.commit,[],'T','I','COMMIT');
   // Raw financial result is NOT certified checkpoint evidence; consumer must validate it.
   result={outcome:'business_commit_acknowledged',rawResult:r.rows[0].result};
   }
  }catch {result={outcome:'quarantine'};}
  finally {if(d)try{await d.close();}catch{result={outcome:'quarantine',cleanup:'unconfirmed'};}}
  return result;
 }});
}
