/**
 * NOT_ADMITTED: SQL17/18 reader integration proposal, not a configured provider.
 * The dedicated authenticated SQL session and protected reader are the trust
 * boundary. The unchanged PR358 mapper checks consistency only; it cannot turn
 * a caller's invented JSON, a hash, or this declaration into authority.
 */
import {mapDeclaredVerifiedSnapshots} from '../../../scripts/ci/demo-authority-bridge-review/contract.mjs';

export const READ_AUTHORITY_SQL = 'SELECT demo_flow_writer.read_authority($1::uuid) AS authority';
const uuid = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/;
const fail = code => { throw Error(code); };

/** Only the trusted issuer-entry may supply this already-open transaction driver.
 * The reader must hold its policy, chain and restore-fence locks until TX end.
 * No transaction, connection factory, fallback resolver, cache, or retry here.
 */
export function createAuthorityProvider(driver, deployment) {
  if (!driver || typeof driver.query !== 'function' || typeof deployment !== 'string'
      || !deployment.trim()) fail('HOLD_AUTHORITY_PROVIDER_UNBOUND');
  return async function resolve(contextId) {
    if (arguments.length !== 1 || typeof contextId !== 'string' || !uuid.test(contextId)) {
      fail('HOLD_AUTHORITY_REFERENCE');
    }
    const result = await driver.query(READ_AUTHORITY_SQL, [contextId], 'T', 'T', 'SELECT');
    if (!result || !Array.isArray(result.rows) || result.rowCount !== 1 || result.rows.length !== 1) {
      fail('HOLD_AUTHORITY_RESULT');
    }
    const row = result.rows[0];
    if (!row || Reflect.ownKeys(row).length !== 1 || !Object.hasOwn(row, 'authority')) {
      fail('HOLD_AUTHORITY_RESULT');
    }
    const descriptor = Object.getOwnPropertyDescriptor(row, 'authority');
    if (!descriptor || !Object.hasOwn(descriptor, 'value') || !descriptor.enumerable) {
      fail('HOLD_AUTHORITY_RESULT');
    }
    // No Date construction, truncation or rounding. SQL18 must reject any
    // non-representable protected timestamp before emitting canonical .sssZ.
    // The mapper rejects every other representation, including sub-ms strings.
    const mapped = mapDeclaredVerifiedSnapshots(descriptor.value);
    if (mapped.binding.deployment !== deployment || mapped.contextId !== contextId) {
      fail('HOLD_AUTHORITY_SCOPE');
    }
    return mapped;
  };
}
