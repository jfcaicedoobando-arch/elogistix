/** Candidate contract only. No production caller or database adapter exists. */
export interface Cause { code: string; detail: string; sourceIds?: readonly string[] }
export type Result<T> = { status: 'ready'; value: T } | { status: 'unavailable'; causes: readonly Cause[] };
export const unavailable = <T>(code: string, detail: string): Result<T> => ({ status: 'unavailable', causes: [{ code, detail }] });
export const ready = <T>(value: T): Result<T> => ({ status: 'ready', value });
export interface Scope {
  organizationId: string;
  currency: string;
  /** Snapshot/reader certifies a complete population, never a UI page. */
  evidenceId: string;
  complete: boolean;
}
export interface ComparableScope extends Scope {
  basis: 'net-commercial';
  populationPolicyId: string;
  taxAllocationPolicyId: string;
  fxPolicyId: string;
  recognitionPolicyId: string;
}
/** Monetary inputs are finite, exact integer minor units in one explicit currency. */
export const isMoney = (value: number): boolean => Number.isSafeInteger(value);
export const validScope = (scope: Scope): boolean => scope.complete &&
  [scope.organizationId, scope.currency, scope.evidenceId].every((s) => s.trim().length > 0);
export const validComparableScope = (scope: ComparableScope): boolean => validScope(scope) &&
  scope.basis === 'net-commercial' && [scope.populationPolicyId, scope.taxAllocationPolicyId,
    scope.fxPolicyId, scope.recognitionPolicyId].every((s) => s.trim().length > 0);
export function sameBasis(a: ComparableScope, b: ComparableScope): boolean {
  return a.organizationId === b.organizationId && a.currency === b.currency &&
    a.basis === b.basis && a.populationPolicyId === b.populationPolicyId &&
    a.taxAllocationPolicyId === b.taxAllocationPolicyId && a.fxPolicyId === b.fxPolicyId &&
    a.recognitionPolicyId === b.recognitionPolicyId && a.evidenceId === b.evidenceId;
}
export function sumMoney(values: readonly number[]): number | null {
  let result = 0n;
  for (const value of values) {
    if (!isMoney(value)) return null;
    result += BigInt(value);
  }
  const limit = BigInt(Number.MAX_SAFE_INTEGER);
  return result > limit || result < -limit ? null : Number(result);
}
