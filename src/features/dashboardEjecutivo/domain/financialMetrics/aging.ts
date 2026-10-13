import { epochDay } from './calendar';
import { isMoney, ready, unavailable, validScope, sumMoney, type Result, type Scope } from './contract';
export type AgingBucket = 'not-due' | '1-30' | '31-60' | '61-90' | 'over-90' | 'unknown-due-date';
export interface AgingRow {
  id: string; amountMinor: number; contractualDueDate: string | null;
  scheduledDate?: string | null; // Deliberately not consumed by aging.
}
export interface AgingScope extends Scope { balanceAsOf: string }
export interface AgingValue {
  totalMinor: number; buckets: Record<AgingBucket, number>;
  unknownDueIds: string[]; classifiedBy: 'contractual-due-date';
}
function classifyDueDate(date: string | null, cut: number): Result<AgingBucket> {
  if (date === null) return ready('unknown-due-date');
  const due = epochDay(date);
  if (due === null) return unavailable('INVALID_DATE', 'Vencimiento contractual inválido.');
  const age = cut - due;
  return ready(age <= 0 ? 'not-due' : age <= 30 ? '1-30' : age <= 60 ? '31-60' : age <= 90 ? '61-90' : 'over-90');
}
export function calculateAging(scope: AgingScope, asOf: string, rows: readonly AgingRow[]): Result<AgingValue> {
  const cut = epochDay(asOf);
  if (cut === null) return unavailable('INVALID_DATE', 'Corte inválido.');
  if (scope.balanceAsOf !== asOf) return unavailable('BALANCE_CUTOFF_MISMATCH', 'El saldo y el aging deben corresponder al mismo corte.');
  if (!validScope(scope)) return unavailable('INCOMPLETE_DATA', 'Cartera incompleta; no se publica un total parcial.');
  const ids = new Set<string>();
  const buckets: AgingValue['buckets'] = { 'not-due': 0, '1-30': 0, '31-60': 0, '61-90': 0, 'over-90': 0, 'unknown-due-date': 0 };
  const unknownDueIds: string[] = [];
  for (const row of rows) {
    if (!row.id.trim() || ids.has(row.id)) return unavailable('DUPLICATE_DOCUMENT', 'Identidad ausente o repetida en cartera.');
    ids.add(row.id);
    if (!isMoney(row.amountMinor) || row.amountMinor < 0) return unavailable('INVALID_AMOUNT', 'Separar saldos a favor; no compensarlos entre documentos.');
    const classification = classifyDueDate(row.contractualDueDate, cut);
    if (classification.status === 'unavailable') return classification;
    const bucket = classification.value;
    if (bucket === 'unknown-due-date' && row.amountMinor > 0) unknownDueIds.push(row.id);
    buckets[bucket] += row.amountMinor;
  }
  const total = sumMoney(Object.values(buckets));
  if (total === null) return unavailable('AMOUNT_OVERFLOW', 'Total fuera del rango exacto.');
  return ready({ totalMinor: total, buckets, unknownDueIds, classifiedBy: 'contractual-due-date' });
}
