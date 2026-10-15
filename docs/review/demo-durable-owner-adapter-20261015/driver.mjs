/** Review-only dedicated protocol driver. No connector, credentials or production wiring. */
export const EMPTY_CONFIG = Object.freeze({deployment:'', database:'', sessionUser:'', durabilityEvidence:'', driverEvidence:''});
const fail = code => { throw Error(code); };
/** Wire contract:
 * metadata() -> {socketEpoch, backendPid, backendStart, database, sessionUser,
 * ready:'I'|'T'|'E'|'closed', exclusive:true, noReconnect:true, noReplay:true}.
 * query(text, parameters) resolves ONLY after matching CommandComplete + ReadyForQuery;
 * command is the decoded verb (INSERT from INSERT 0 n); rowCount is protocol-derived; rows decoded faithfully.
 * One physical authenticated socket, no multiplexing, reconnect, retry or pipelining.
 * close() destroys it, never returns it to a pool. A wire factory is TRUSTED CODE.
 * Postgres.js reserve() alone does not implement this contract.
 */
export function dedicatedDriver(wire, config=EMPTY_CONFIG) {
 config=Object.freeze({...config});
 for (const k of Object.keys(EMPTY_CONFIG)) if(typeof config[k]!=='string'||!config[k].trim()) fail('HOLD_CONFIGURATION');
 let poisoned=false, busy=false, closed=false;
 const initial=Object.freeze({...wire.metadata()});
 const identityKeys=['socketEpoch','backendPid','backendStart','database','sessionUser'];
 function check(ready) {
  if(closed||poisoned) fail('HOLD_PHYSICAL_CONNECTION');
  const m=wire.metadata();
  if(m.exclusive!==true||m.noReconnect!==true||m.noReplay!==true ||
   identityKeys.some(k=>!initial[k] || initial[k]!==m[k]) ||
   m.database!==config.database||m.sessionUser!==config.sessionUser||m.ready!==ready) fail('HOLD_PHYSICAL_CONNECTION');
 }
 check('I');
 return Object.freeze({
  async query(text, params, before, after, command) {
   if(busy) {poisoned=true;fail('HOLD_CONCURRENT_QUERY');}
   busy=true;
   try {
    check(before);
    const result=await wire.query(text,params);
    check(after);
    if(result.command!==command||!Array.isArray(result.rows)||!Number.isSafeInteger(result.rowCount))fail('HOLD_PROTOCOL_ACK');
    return result;
   } catch(e) {poisoned=true;throw e;} finally {busy=false;}
  },
  async close(){closed=true;poisoned=true;await wire.close();}
 });
}
