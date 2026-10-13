import { describe, expect, it } from 'vitest';
import { calculateApprovedEfficiency, calculateApprovedRunway, type ApprovedRunwayInput } from '../approvedCalculations';
import { FINANCIAL_CRITERIA_APPROVAL as policy } from '../approvedCriteria';
import { cash, cashScope, code, efficiency, value } from './fixtures';

function credit() {
  const input = efficiency();
  for (const scope of [input.balances.scope, input.activity.scope]) Object.assign(scope, {
    populationPolicyId: policy.population, taxAllocationPolicyId: policy.tax, fxPolicyId: policy.currency,
  });
  return input;
}
function operating(): ApprovedRunwayInput {
  return {scope: {...cashScope, fxPolicyId: policy.currency, cashClassificationPolicyId: policy.consumption,
    availabilityPolicyId: policy.availability}, cash: {...cash}, selectedMonth: '2026-09',
    businessToday: '2026-10-13', accountingClosedThrough: '2026-09-30',
    observedPeriod: {start:'2026-07-01',end:'2026-09-30'}, events: [
      {cashEventKey:'mock-out', organizationId:'fictional-org', currency:'MXN', settledDate:'2026-07-15',
        direction:'out',amountMinor:60000,classification:'own-operating',classificationEvidenceId:'mock-only'},
      {cashEventKey:'mock-in', organizationId:'fictional-org', currency:'MXN', settledDate:'2026-09-15',
        direction:'in',amountMinor:10000,classification:'own-operating',classificationEvidenceId:'mock-only'},
    ]};
}

describe('approved criteria · pure calculations, artificial data only', () => {
  it.each(['DSO','DPO'] as const)('preserves %s net basis, actual month days and positive denominator', metric => {
    const input=credit(); input.metric=metric;
    if(metric==='DPO'){input.balances.side='payables';input.activity.kind='credit-purchases-services';}
    expect(value(calculateApprovedEfficiency(input))).toMatchObject({days:15,calendarDays:30,averageBalanceMinor:50000});
    input.activity.netCreditActivityMinor=0;
    expect(code(calculateApprovedEfficiency(input))).toBe('NONPOSITIVE_ACTIVITY');
    input.activity.netCreditActivityMinor=-100;
    expect(code(calculateApprovedEfficiency(input))).toBe('NONPOSITIVE_ACTIVITY');
  });
  it('certified zero balance differs from missing history',()=>{
    const input=credit(); input.balances.series={method:'opening-closing',openingMinor:0,closingMinor:0};
    expect(value(calculateApprovedEfficiency(input)).days).toBe(0);
    input.balances.series={method:'daily-eod',points:[]};
    expect(code(calculateApprovedEfficiency(input))).toBe('HISTORY_GAP');
  });
  it('rejects mixed currency or period, never converts with an exchange rate',()=>{
    const input=credit();input.activity.scope.currency='USD';
    expect(code(calculateApprovedEfficiency(input))).toBe('BASIS_MISMATCH');
    input.activity.scope.currency='MXN'; input.activity.period={start:'2026-08-01',end:'2026-08-31'};
    expect(code(calculateApprovedEfficiency(input))).toBe('PERIOD_MISMATCH');
  });
  it.each(['populationPolicyId','taxAllocationPolicyId','fxPolicyId'] as const)('requires documented basis: %s',key=>{
    const input=credit();input.activity.scope[key]='PPD-or-days-or-proration-or-current-FX';
    expect(code(calculateApprovedEfficiency(input))).toBe('APPROVED_BASIS_REQUIRED');
  });
  it('computes on a per-currency basis without combining MXN and USD',()=>{
    const mxn=credit(), usd=credit();
    usd.balances.scope.currency=usd.activity.scope.currency='USD'; usd.activity.netCreditActivityMinor=200000;
    expect(value(calculateApprovedEfficiency(mxn)).days).toBe(15);
    expect(value(calculateApprovedEfficiency(usd)).days).toBe(7.5);
  });
  it('uses 92 observed calendar days and net operating consumption',()=>{
    const result=value(calculateApprovedRunway(operating()));
    expect(result).toMatchObject({observationDays:92,netConsumptionMinor:50000,runwayDays:184});
  });
  it.each(['investment','financing','third-party','internal-transfer'] as const)('excludes documented %s, retains actual operating fee',classification=>{
    const input=operating();input.events=[...input.events,{...input.events[0],cashEventKey:'mock-excluded',amountMinor:900000,classification},
      {...input.events[0],cashEventKey:'mock-fee',amountMinor:100}];
    const result=value(calculateApprovedRunway(input));
    expect(result.netConsumptionMinor).toBe(50100);expect(result.excludedEventKeys).toEqual(['mock-excluded']);
  });
  it.each([null,'2026-08-31'])('does not accept missing/incomplete accounting close %s',accountingClosedThrough=>{
    expect(code(calculateApprovedRunway({...operating(),accountingClosedThrough}))).toBe('UNVERIFIED_CLOSE');
  });
  it.each([{start:'2026-09-01',end:'2026-09-30'},{start:'2026-07-02',end:'2026-09-30'},{start:'2026-07-01',end:'2026-09-29'}])('rejects a short/partial interval despite approved policy ID',observedPeriod=>{
    expect(code(calculateApprovedRunway({...operating(),observedPeriod}))).toBe('THREE_CLOSED_MONTHS_REQUIRED');
  });
  it('rejects an open selected month',()=>{
    expect(code(calculateApprovedRunway({...operating(),selectedMonth:'2026-10'}))).toBe('OPEN_CALENDAR_MONTH');
  });
  it.each(['2026-10-01','2026-10-13'])('uses explicitly reconciled cash at %s without extending observed consumption',asOf=>{
    const input=operating();
    input.cash={...input.cash,asOf,reconciledThrough:asOf,availableMinor:150000};
    expect(value(calculateApprovedRunway(input))).toMatchObject({
      availableMinor:150000,observationDays:92,netConsumptionMinor:50000,runwayDays:276,
      period:{start:'2026-07-01',end:'2026-09-30'},
    });
  });
  it.each(['2026-09-29','2026-10-14','2026-09-31','2026-10-01T00:00:00Z',''])('rejects an earlier, future or invalid cash cut %s',asOf=>{
    const input=operating();input.cash={...input.cash,asOf,reconciledThrough:asOf};
    expect(code(calculateApprovedRunway(input))).toBe('CASH_CUT_MISMATCH');
  });
  it.each(['2026-09-30','2026-10-12','2026-10-14'])('rejects reconciliation through %s that differs from the explicit cash cut',reconciledThrough=>{
    const input=operating();input.cash={...input.cash,asOf:'2026-10-13',reconciledThrough};
    expect(code(calculateApprovedRunway(input))).toBe('UNRECONCILED_CASH');
  });
  it.each(['currency','organizationId'] as const)('rejects movement %s scope mismatch',key=>{
    const input=operating();input.events=[{...input.events[0],[key]:'other'}];
    expect(code(calculateApprovedRunway(input))).toBe('CASH_SCOPE_MISMATCH');
  });
  it('rejects absent classification, availability review, reconciliation or coverage',()=>{
    const input=operating();input.events=[{...input.events[0],classification:null}];
    expect(code(calculateApprovedRunway(input))).toBe('UNCLASSIFIED_CASH_EVENT');
    const noRestriction=operating();noRestriction.cash.availabilityEvidenceId='';
    expect(code(calculateApprovedRunway(noRestriction))).toBe('UNRECONCILED_CASH');
    const noReconciliation=operating();noReconciliation.cash.reconciliationEvidenceId='';
    expect(code(calculateApprovedRunway(noReconciliation))).toBe('UNRECONCILED_CASH');
    const partial=operating();partial.scope.complete=false;
    expect(code(calculateApprovedRunway(partial))).toBe('INCOMPLETE_DATA');
  });
  it('separates no net consumption from unavailable or no cash',()=>{
    const input=operating();input.events=[input.events[1]];
    expect(value(calculateApprovedRunway(input))).toMatchObject({state:'no-net-burn',runwayDays:null});
    input.cash.availableMinor=0;
    expect(value(calculateApprovedRunway(input))).toMatchObject({state:'no-cash',runwayDays:0});
  });
});
