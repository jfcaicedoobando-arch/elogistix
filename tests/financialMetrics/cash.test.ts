import { describe,it,expect } from 'vitest';
import { calculateForecast13Weeks, type ExpectedCashEvent } from '../../src/features/dashboardEjecutivo/domain/financialMetrics/forecast';
import { calculateCashRunway, type ActualCashEvent } from '../../src/features/dashboardEjecutivo/domain/financialMetrics/runway';
import { cash,cashScope,code,period,value } from './fixtures';
const event: ExpectedCashEvent = { cashEventKey:'settlement-1',obligationKey:'invoice-1',expectedDate:'2026-10-01',dateEvidence:'promise',sourceId:'promise-1',direction:'in',amountMinor:50_000 };
function forecast() {return {scope:{...cashScope},opening:{...cash},start:'2026-10-01',events:[{...event}],obligations:[{obligationKey:'invoice-1',direction:'in' as const,remainingCashMinor:50_000}],settledCashEventKeys:[] as string[]};}
const actual: ActualCashEvent = {cashEventKey:'bank-1',settledDate:'2026-09-15',direction:'out',amountMinor:60_000,inclusion:'include',classificationEvidenceId:'mock-source-link'};
function runway() {return {scope:{...cashScope},cash:{...cash},period:{...period},observationPolicyId:'mock-closed-month',events:[{...actual},{...actual,cashEventKey:'bank-2',direction:'in' as const,amountMinor:10_000}]};}
describe('13 weeks of expected money from reconciled cutoff',()=>{
  it('has exactly 91 days in 13 complete seven-day windows',()=>{const r=value(calculateForecast13Weeks(forecast()));expect(r.weeks).toHaveLength(13);expect(r.weeks[0]).toMatchObject({start:'2026-10-01',end:'2026-10-07',inMinor:50_000,endCashMinor:150_000});expect(r.weeks[12].end).toBe('2026-12-30');expect(r.finalCashMinor).toBe(150_000);});
  it('includes day 91 but labels day 92 outside horizon',()=>{const i=forecast();i.events[0].amountMinor=25_000;i.events[0].expectedDate='2026-12-30';i.events.push({...i.events[0],cashEventKey:'settlement-2',expectedDate:'2026-12-31'});const r=value(calculateForecast13Weeks(i));expect(r.weeks[12].inMinor).toBe(25_000);expect(r.outsideHorizonKeys).toEqual(['settlement-2']);});
  it('accepts explicit partial installments without counting original document again',()=>{const i=forecast();i.events[0].amountMinor=20_000;i.events.push({...i.events[0],cashEventKey:'installment-2',amountMinor:30_000,expectedDate:'2026-10-08'});const r=value(calculateForecast13Weeks(i));expect(r.weeks[0].inMinor).toBe(20_000);expect(r.weeks[1].inMinor).toBe(30_000);expect(r.finalCashMinor).toBe(150_000);});
  it('rejects duplicate economic event across sources',()=>{const i=forecast();i.events.push({...event,sourceId:'invoice-view'});expect(code(calculateForecast13Weeks(i))).toBe('DUPLICATE_CASH_EVENT');});
  it('rejects an event already represented by a realized settlement',()=>{const i=forecast();i.settledCashEventKeys=['settlement-1'];expect(code(calculateForecast13Weeks(i))).toBe('ALREADY_SETTLED');});
  it('rejects original amount when outstanding residual is lower',()=>{const i=forecast();i.obligations[0].remainingCashMinor=25_000;expect(code(calculateForecast13Weeks(i))).toBe('OVERPLANNED_OBLIGATION');});
  it('does not silently drop an unscheduled remainder',()=>{const i=forecast();i.events[0].amountMinor=25_000;expect(code(calculateForecast13Weeks(i))).toBe('UNSCHEDULED_REMAINDER');});
  it('does not silently omit obligation without any plan',()=>{const i=forecast();i.events=[];expect(code(calculateForecast13Weeks(i))).toBe('UNSCHEDULED_REMAINDER');});
  it('does not move overdue receipts automatically to week 1',()=>{const i=forecast();i.events[0].expectedDate='2026-09-01';expect(code(calculateForecast13Weeks(i))).toBe('STALE_EXPECTED_DATE');});
  it('requires an expected date',()=>{const i=forecast();i.events[0].expectedDate=null;expect(code(calculateForecast13Weeks(i))).toBe('MISSING_EXPECTED_DATE');});
  it('keeps explicit estimates recognizable',()=>{const i=forecast();i.events[0].dateEvidence='explicit-estimate';expect(value(calculateForecast13Weeks(i)).dateAssumptions[0].dateEvidence).toBe('explicit-estimate');});
  it('will not call current book balance reconciled opening cash',()=>{const i=forecast();i.opening.reconciliationEvidenceId='';expect(code(calculateForecast13Weeks(i))).toBe('UNRECONCILED_CASH');});
  it('requires matching reconciled cutoff date',()=>{const i=forecast();i.opening.reconciledThrough='2026-09-29';expect(code(calculateForecast13Weeks(i))).toBe('UNRECONCILED_CASH');});
  it('rejects window overlapping opening balance',()=>{const i=forecast();i.start='2026-09-30';expect(code(calculateForecast13Weeks(i))).toBe('INVALID_CASH_CUTOFF');});
  it('shows a cash deficit without clamping',()=>{const i=forecast();i.events=[];i.obligations=[];i.opening.availableMinor=-10;const r=value(calculateForecast13Weeks(i));expect(r.finalCashMinor).toBe(-10);expect(r.firstNegativeClosingWeekStart).toBe('2026-10-01');});
  it('fails closed on missing currencies/populations',()=>{const i=forecast();i.scope.complete=false;expect(code(calculateForecast13Weeks(i))).toBe('INCOMPLETE_DATA');});
});
describe('cash runway independent of income statement',()=>{
  it('uses actual net burn of 50,000 in 30 observed days',()=>{const r=value(calculateCashRunway(runway()));expect(r.state).toBe('positive-burn');expect(r.netConsumptionMinor).toBe(50_000);expect(r.runwayDays).toBe(60);});
  it('scales by actual period days, not fixed month',()=>{const i=runway();i.period={start:'2026-08-01',end:'2026-08-31'};i.events=i.events.map(e=>({...e,settledDate:'2026-08-15'}));expect(value(calculateCashRunway(i)).runwayDays).toBe(62);});
  it('no burn is a separate state, not infinity or zero days',()=>{const i=runway();i.events[1].amountMinor=70_000;const r=value(calculateCashRunway(i));expect(r.state).toBe('no-net-burn');expect(r.runwayDays).toBeNull();expect(r.netConsumptionMinor).toBe(-10_000);});
  it.each([[-100,'cash-negative'],[0,'no-cash']] as const)('prioritizes cash %s even with no burn', (amount,state)=>{const i=runway();i.cash.availableMinor=amount;i.events[1].amountMinor=70_000;const r=value(calculateCashRunway(i));expect(r.state).toBe(state);expect(r.runwayDays).toBe(0);});
  it('excludes classified transfer principal but keeps transfer fee',()=>{const i=runway();i.events=[{...actual,cashEventKey:'transfer-out',amountMinor:50_000,inclusion:'exclude'}, {...actual,cashEventKey:'transfer-in',direction:'in',amountMinor:50_000,inclusion:'exclude'}, {...actual,cashEventKey:'fee',amountMinor:100}];const r=value(calculateCashRunway(i));expect(r.netConsumptionMinor).toBe(100);expect(r.excludedEventKeys).toEqual(['transfer-out','transfer-in']);});
  it('requires explicit financing inclusion/exclusion policy rather than infer from text',()=>{const i=runway();i.scope.cashClassificationPolicyId='';expect(code(calculateCashRunway(i))).toBe('INCOMPLETE_DATA');});
  it('does not treat an unclassified movement as zero',()=>{const i=runway();i.events[0].classificationEvidenceId='';expect(code(calculateCashRunway(i))).toBe('UNCLASSIFIED_CASH_EVENT');});
  it('does not double count a bank row and payment application',()=>{const i=runway();i.events.push({...i.events[0]});expect(code(calculateCashRunway(i))).toBe('DUPLICATE_CASH_EVENT');});
  it('rejects non-observed future cash events',()=>{const i=runway();i.events[0].settledDate='2026-10-01';expect(code(calculateCashRunway(i))).toBe('EVENT_OUTSIDE_PERIOD');});
  it('rejects cash availability without restriction review',()=>{const i=runway();i.cash.availabilityEvidenceId='';expect(code(calculateCashRunway(i))).toBe('UNRECONCILED_CASH');});
  it('returns N/D rather than a number for partial cash coverage',()=>{const i=runway();i.scope.complete=false;expect(code(calculateCashRunway(i))).toBe('INCOMPLETE_DATA');});
});
