/** Fixed SQL only. Table permissions/issuer provisioning remain unbound prerequisites. */
const claim = stage => `INSERT INTO demo_owner_review.claims
 (deployment,obligation_id,context_id,stage,binding)
 SELECT o.deployment,o.obligation_id,o.context_id,'${stage}',o.binding
 FROM demo_owner_review.issuer_obligations o
 WHERE o.deployment=$1 AND o.context_id=$2::uuid
 ${stage==='ingress'?`AND EXISTS (SELECT 1 FROM demo_owner_review.claims d
 WHERE d.deployment=o.deployment AND d.obligation_id=o.obligation_id
 AND d.context_id=o.context_id AND d.stage='dispatch' AND d.binding=o.binding)`:''}
 ON CONFLICT DO NOTHING
 RETURNING obligation_id,context_id,binding`;
export const SQL=Object.freeze({
 begin:'BEGIN', durable:"SET LOCAL synchronous_commit = 'on'",
 dispatch:claim('dispatch'), ingress:claim('ingress'), commit:'COMMIT',
 // STAGING ONLY: schema has a deliberately absent business entrypoint.
 // Must be replaced by reviewed direct SQL producer/guard integration, never by HTTP.
 business:'SELECT demo_owner_review.unbound_business_entrypoint($1::uuid,$2::bigint) AS result'
});
export async function consume(driver, stage, deployment, contextId) {
 if(!['dispatch','ingress'].includes(stage))throw Error('HOLD_STAGE');
 await driver.query(SQL.begin,[],'I','T','BEGIN');
 await driver.query(SQL.durable,[],'T','T','SET');
 const r=await driver.query(SQL[stage],[deployment,contextId],'T','T','INSERT');
 if(r.rowCount!==r.rows.length||r.rows.length>1)throw Error('HOLD_CLAIM_SHAPE');
 // Even a new RETURNING row gives no right until this invocation sees commit ACK.
 await driver.query(SQL.commit,[],'T','I','COMMIT');
 return r.rows.length===1 ? r.rows[0] : null;
}
