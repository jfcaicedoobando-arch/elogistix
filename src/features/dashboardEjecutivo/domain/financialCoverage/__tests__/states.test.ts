import { describe, expect, it } from 'vitest';
import { METRICS, type CoverageDiagnostic, type QueryId } from '../contract';
import { diagnoseFinancialCoverage as diagnose } from '../diagnostics';
import { creditRow, noteRow, replace, scheduleRow } from './fixtures';

// Exact source enums; observing a state never authorizes an operation or metric.
const arStates = ['Borrador', 'Por timbrar', 'Emitida', 'Pagada', 'Vencida', 'Cancelada', 'Parcialmente pagada', 'Sustituida'];
const apStates = ['Borrador', 'Vigente', 'Pagada', 'Cancelada'];
const approvals = ['pendiente', 'aprobada', 'rechazada'];
const noteStates = ['Borrador', 'Aprobada', 'Aplicada', 'Cancelada'];
const apCreditRow = () => ({ ...creditRow(), side: 'ap', ppd: null, pue: null });
const sources = [
  { queryId: '06-tax-credit-readiness', row: creditRow },
  { queryId: '06-tax-credit-readiness', row: apCreditRow },
  { queryId: '15-nc-scope-fx', row: noteRow },
  { queryId: '17-ap-current-balance', row: scheduleRow },
] as const;
function unavailable(result: CoverageDiagnostic): void {
  expect(result).toMatchObject({ status: 'unavailable', numericEligible: false, certification: 'not-evaluated' });
  for (const metric of METRICS) {
    expect(result.metrics[metric].status).toBe('unavailable');
    expect(result.metrics[metric].causeCodes).toContain('METRIC_EVIDENCE_NOT_CERTIFIED');
  }
}
function observed(queryId: QueryId, rows: readonly Record<string, unknown>[]): CoverageDiagnostic {
  const result = diagnose(replace(queryId, rows));
  expect(result.sources.find(item => item.queryId === queryId)).toMatchObject({ status: 'observed', rowCount: rows.length });
  expect(result.observations.filter(item => item.queryId === queryId).map(item => item.labels.state)).toEqual(rows.map(row => row.state));
  unavailable(result);
  return result;
}

describe('source-specific diagnostic state contracts', () => {
  it.each(arStates)('observes canonical AR state %s without activating metrics', (state) => {
    observed('06-tax-credit-readiness', [{ ...creditRow(), state }]);
  });
  it.each(apStates.flatMap(state => approvals.map(approval => `${state}/${approval}`)))(
    'observes canonical AP credit group %s without activating metrics', (state) => {
      const result = observed('06-tax-credit-readiness', [{ ...apCreditRow(), state }]);
      const row = result.observations.find(item => item.queryId === '06-tax-credit-readiness');
      expect(row?.counts).not.toHaveProperty('ppd');
      expect(row?.counts).not.toHaveProperty('pue');
    });
  it.each(noteStates)('observes canonical supplier NC state %s without activating metrics', (state) => {
    const result = observed('15-nc-scope-fx', [{ ...noteRow(), state }]);
    expect(result.causes.some(cause => cause.code === 'NET_CREDIT_NOTE_BASE_MISSING' && cause.basis === 'observed-gap'))
      .toBe(state === 'Aplicada');
  });
  it.each(apStates.flatMap(state => approvals.map(approval => ({ state, approval }))))(
    'observes separate AP balance state and approval %j', (change) => {
      const result = observed('17-ap-current-balance', [{ ...scheduleRow(), ...change }]);
      expect(result.observations.find(item => item.queryId === '17-ap-current-balance')?.labels.approval).toBe(change.approval);
    });
  it('preserves a mixed AR/AP batch containing every canonical state group', () => {
    observed('06-tax-credit-readiness', [
      ...arStates.map(state => ({ ...creditRow(), state })),
      ...apStates.flatMap(state => approvals.map(approval => ({ ...apCreditRow(), state: `${state}/${approval}` }))),
    ]);
  });
  it.each([null, undefined, '', 'Unknown', 'emitida', 'Emitida ', 'Aprobada/aprobada', 'Vigente/Aprobada', 1, {}])(
    'rejects unrecognized or malformed state %j for each source', (state) => {
      for (const { queryId, row } of sources) {
        const result = diagnose(replace(queryId, [{ ...row(), state }]));
        expect(result.sources.find(item => item.queryId === queryId)?.status).toBe('invalid');
        expect(result.observations.some(item => item.queryId === queryId)).toBe(false);
        unavailable(result);
      }
    });
  it.each([
    ['ar', 'Vigente'], ['ar', 'Aplicada'], ['ar', 'Timbrada'], ['ar', 'Aprobada'], ['ar', 'Vigente/aprobada'],
    ['ap', 'Emitida'], ['ap', 'Por timbrar'], ['ap', 'Sustituida'], ['ap', 'Pagada'], ['ap', 'Aprobada'], ['ap', 'Emitida/aprobada'],
  ])('rejects credit state %s / %s from a different source contract', (side, state) => {
    const result = diagnose(replace('06-tax-credit-readiness', [{ ...creditRow(), side, state }]));
    expect(result.sources.find(item => item.queryId === '06-tax-credit-readiness')?.status).toBe('invalid');
  });
  it.each(['Emitida', 'Por timbrar', 'Sustituida', 'Pagada', 'Timbrada', 'Vigente/aprobada', 'Pendiente'])(
    'rejects foreign state %s for supplier NC', (state) => {
      expect(diagnose(replace('15-nc-scope-fx', [{ ...noteRow(), state }])).sources
        .find(item => item.queryId === '15-nc-scope-fx')?.status).toBe('invalid');
    });
  it.each(['Emitida', 'Por timbrar', 'Sustituida', 'Aplicada', 'Aprobada', 'Parcialmente pagada', 'Vigente/aprobada', 'Pendiente'])(
    'rejects foreign or composite state %s for AP balance', (state) => {
      expect(diagnose(replace('17-ap-current-balance', [{ ...scheduleRow(), state }])).sources
        .find(item => item.queryId === '17-ap-current-balance')?.status).toBe('invalid');
    });
  it('still rejects a whole source batch containing one unknown state while preserving other sources', () => {
    const result = diagnose(replace('06-tax-credit-readiness', [creditRow(), { ...creditRow(), state: 'Unknown' }]));
    expect(result.sources.find(item => item.queryId === '06-tax-credit-readiness')?.status).toBe('invalid');
    expect(result.observations.some(item => item.queryId === '06-tax-credit-readiness')).toBe(false);
    expect(result.sources.find(item => item.queryId === '15-nc-scope-fx')?.status).toBe('observed');
    unavailable(result);
  });
});
