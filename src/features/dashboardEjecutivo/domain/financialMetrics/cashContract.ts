import { isMoney, ready, unavailable, validScope, type Result, type Scope } from './contract';
export interface CashScope extends Scope {
  availabilityPolicyId: string;
  cashClassificationPolicyId: string;
  fxPolicyId: string;
}
export interface ReconciledCash {
  asOf: string;
  availableMinor: number;
  /** Includes completeness of accounts and statement coverage, not just row matching. */
  reconciliationEvidenceId: string;
  reconciledThrough: string;
  availabilityEvidenceId: string;
}
export const hasCashPolicies = (scope: CashScope): boolean => [scope.availabilityPolicyId,
  scope.cashClassificationPolicyId, scope.fxPolicyId].every((id) => id.trim().length > 0);
export type Direction = 'in' | 'out';

export function validateCashContext(scope: CashScope, cash: ReconciledCash): Result<void> {
  if (!validScope(scope) || !hasCashPolicies(scope)) return unavailable('INCOMPLETE_DATA', 'Falta cobertura o política explícita de caja.');
  if (!cash.reconciliationEvidenceId.trim() || !cash.availabilityEvidenceId.trim() || cash.reconciledThrough !== cash.asOf)
    return unavailable('UNRECONCILED_CASH', 'Falta evidencia de caja conciliada y disponible al corte.');
  if (!isMoney(cash.availableMinor)) return unavailable('INVALID_AMOUNT', 'Caja disponible inválida.');
  return ready(undefined);
}
