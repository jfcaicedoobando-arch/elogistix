import { describe,it,expect } from 'vitest';
import { sumMoney } from '@/features/dashboardEjecutivo/domain/financialMetrics/contract';
import { closedThreeMonths, dateFromDay, epochDay } from '@/features/dashboardEjecutivo/domain/financialMetrics/calendar';
import { calculateEfficiency } from '@/features/dashboardEjecutivo/domain/financialMetrics/efficiency';
import { calculateForecast13Weeks } from '@/features/dashboardEjecutivo/domain/financialMetrics/forecast';
import { cash,cashScope,code,efficiency,value } from './fixtures';
function forecast() { return {scope:cashScope,opening:{...cash,availableMinor:100},start:'2026-10-01',events:[
  {cashEventKey:'out',obligationKey:'ap',expectedDate:'2026-10-01',dateEvidence:'payment-schedule' as const,sourceId:'plan-out',direction:'out' as const,amountMinor:200},
  {cashEventKey:'in',obligationKey:'ar',expectedDate:'2026-10-07',dateEvidence:'promise' as const,sourceId:'promise-in',direction:'in' as const,amountMinor:300},
],obligations:[{obligationKey:'ap',direction:'out' as const,remainingCashMinor:200},{obligationKey:'ar',direction:'in' as const,remainingCashMinor:300}],settledCashEventKeys:[]}; }
describe('independent review regressions',()=>{
  it('reports a daily deficit even when weekly close recovered',()=>{const r=value(calculateForecast13Weeks(forecast()));expect(r.firstNegativeDailyClose).toBe('2026-10-01');expect(r.firstNegativeClosingWeekStart).toBeNull();expect(r.finalCashMinor).toBe(200);});
  it('is invariant to expected event order',()=>{const i=forecast();const a=value(calculateForecast13Weeks(i));const b=value(calculateForecast13Weeks({...i,events:[...i.events].reverse()}));expect(b.weeks).toEqual(a.weeks);expect(b.firstNegativeDailyClose).toBe(a.firstNegativeDailyClose);});
  it('flags negative opening even if all projected daily closes recover',()=>{const i=forecast();i.opening.availableMinor=-100;i.events[1].expectedDate='2026-10-01';const r=value(calculateForecast13Weeks(i));expect(r.openingCashIsNegative).toBe(true);expect(r.firstNegativeDailyClose).toBeNull();expect(r.finalCashMinor).toBe(0);});
  it('does not infer intraday ordering for same-day flows',()=>{const i=forecast();i.events[1].expectedDate='2026-10-01';expect(value(calculateForecast13Weeks(i)).firstNegativeDailyClose).toBeNull();});
  it('sums safe final net independently of intermediate order',()=>{const m=Number.MAX_SAFE_INTEGER;expect(sumMoney([m,1,-m])).toBe(1);expect(sumMoney([m,-m,1])).toBe(1);expect(sumMoney([-m,-1,m])).toBe(-1);});
  it('rejects final total outside exact range',()=>expect(sumMoney([Number.MAX_SAFE_INTEGER,1])).toBeNull());
  it('rejects year zero',()=>expect(code(closedThreeMonths({selectedMonth:'0000-01',businessToday:'2026-10-13',accountingClosedThrough:'2026-09-30'}))).toBe('INVALID_PERIOD'));
  it('rejects three-month underflow before year one',()=>expect(code(closedThreeMonths({selectedMonth:'0001-02',businessToday:'2026-10-13',accountingClosedThrough:'2026-09-30'}))).toBe('DATE_OUT_OF_RANGE'));
  it('accepts earliest complete three months',()=>expect(value(closedThreeMonths({selectedMonth:'0001-03',businessToday:'2026-10-13',accountingClosedThrough:'2026-09-30'}))[0]).toEqual({start:'0001-01-01',end:'0001-01-31'}));
  it('rejects 13-week horizon beyond year 9999',()=>{const i=forecast();i.opening.asOf='9999-12-30';i.start='9999-12-31';expect(code(calculateForecast13Weeks(i))).toBe('DATE_OUT_OF_RANGE');});
  it.each([['2026-02-01','2026-02-28',28],['2024-02-01','2024-02-29',29],['2026-10-01','2026-10-31',31]] as const)('uses daily history for full month %s',(start,end,count)=>{const i=efficiency();i.period={start,end};i.balances.period=i.period;i.activity.period=i.period;i.businessToday='2027-01-01';i.accountingClosedThrough='2026-12-31';i.balances.series={method:'daily-eod',points:Array.from({length:count},(_,n)=>({date:dateFromDay(epochDay(start)!+n),amountMinor:100_000})).reverse()};expect(value(calculateEfficiency(i)).days).toBe(count);});
  it('rejects duplicate obligation identity',()=>{const i=forecast();i.obligations.push({...i.obligations[0]});expect(code(calculateForecast13Weeks(i))).toBe('INVALID_OBLIGATION');});
  it('rejects mismatched event/obligation direction',()=>{const i=forecast();i.events[0].direction='in';expect(code(calculateForecast13Weeks(i))).toBe('UNMATCHED_OBLIGATION');});
  it.each([0,-1,NaN,Infinity,1.5])('rejects invalid expected amount %s',amount=>{const i=forecast();i.events[0].amountMinor=amount;expect(code(calculateForecast13Weeks(i))).toBe('INVALID_AMOUNT');});
});
