import {createHash} from 'node:crypto';
/** NOT a client API. resolver must read authenticated immutable issuer/scheduler evidence.
 * Neither ticket nor request may contain workId, occurrence overrides or binding overrides.
 * No resolver is supplied; unbound issuer fails closed. Hash is consistency, not authority.
 */
export const ISSUE_SQL=`INSERT INTO demo_owner_review.issuer_obligations
 (deployment,obligation_id,canonical_version,tenant_id,manifest_identity,scheduler_job_identity,
 authorized_occurrence,context_id,binding) VALUES ($1,$2::uuid,1,$3,$4,$5,$6,$7::uuid,$8::jsonb)
 ON CONFLICT DO NOTHING RETURNING obligation_id`;
const uuid=/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/;
export function createIssuer(resolver, deployment='') {
 return Object.freeze({async derive(ticket) {
  if(typeof resolver!=='function'||!deployment)throw Error('HOLD_ISSUER_UNBOUND');
  // Resolver alone maps ticket to authoritative issuance. Caller cannot set derived fields.
  const a=structuredClone(await resolver(ticket));
  const fields=['tenant','manifestIdentity','schedulerJob','authorizedOccurrence'];
  if(!a||fields.some(k=>typeof a[k]!=='string'||!a[k])||!uuid.test(a.contextId)||
    !a.binding||typeof a.binding!=='object'||Array.isArray(a.binding))throw Error('HOLD_ISSUER_EVIDENCE');
  const canonical=JSON.stringify([1,deployment,...fields.map(k=>a[k])]);
  const digest=createHash('sha256').update(canonical,'utf8').digest('hex');
  // UUID-shaped 128-bit stable key; full natural key stored and uniquely constrained too.
  const id=`${digest.slice(0,8)}-${digest.slice(8,12)}-${digest.slice(12,16)}-${digest.slice(16,20)}-${digest.slice(20,32)}`;
  return Object.freeze({obligationId:id,canonical,parameters:Object.freeze([
   deployment,id,...fields.map(k=>a[k]),a.contextId,JSON.stringify(a.binding)])});
 }});
}
