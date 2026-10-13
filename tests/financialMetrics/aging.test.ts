import { describe,it,expect } from 'vitest';
import { calculateAging } from '../../src/features/dashboardEjecutivo/domain/financialMetrics/aging';
import { code,scope as baseScope,value } from './fixtures';
const scope = { ...baseScope, balanceAsOf: '2026-09-30' };
describe('contractual aging, separate from payment schedule',()=>{
  it('keeps future, old and unknown due balances in complete total',()=>{const r=value(calculateAging(scope,'2026-09-30',[
    {id:'old',amountMinor:10_000,contractualDueDate:'2020-01-01'},
    {id:'future',amountMinor:20_000,contractualDueDate:'2026-12-31'},
    {id:'unknown',amountMinor:30_000,contractualDueDate:null},
  ]));expect(r.totalMinor).toBe(60_000);expect(r.buckets['over-90']).toBe(10_000);expect(r.buckets['not-due']).toBe(20_000);expect(r.unknownDueIds).toEqual(['unknown']);});
  it('rescheduling does not alter aging',()=>{const row={id:'p',amountMinor:69_600,contractualDueDate:'2026-09-01'};expect(calculateAging(scope,'2026-09-30',[row])).toEqual(calculateAging(scope,'2026-09-30',[{...row,scheduledDate:'2026-12-31'}]));});
  it.each([['2026-09-30','not-due'],['2026-09-29','1-30'],['2026-08-31','1-30'],['2026-08-30','31-60'],['2026-08-01','31-60'],['2026-07-31','61-90'],['2026-07-02','61-90'],['2026-07-01','over-90']])('has precise boundary %s', (date,bucket)=>expect(value(calculateAging(scope,'2026-09-30',[{id:'p',amountMinor:100,contractualDueDate:date}])).buckets[bucket as 'not-due']).toBe(100));
  it('rejects duplicate invoices',()=>{const row={id:'p',amountMinor:100,contractualDueDate:null};expect(code(calculateAging(scope,'2026-09-30',[row,row]))).toBe('DUPLICATE_DOCUMENT');});
  it('does not reclassify current balances as a historical snapshot',()=>expect(code(calculateAging({...scope,balanceAsOf:'2026-10-13'},'2026-09-30',[]))).toBe('BALANCE_CUTOFF_MISMATCH'));
  it('does not publish incomplete totals',()=>expect(code(calculateAging({...scope,complete:false},'2026-09-30',[]))).toBe('INCOMPLETE_DATA'));
  it('does not lose unknown due amount',()=>expect(value(calculateAging(scope,'2026-09-30',[{id:'p',amountMinor:100,contractualDueDate:null}])).buckets['unknown-due-date']).toBe(100));
  it('rejects amount overflow',()=>expect(code(calculateAging(scope,'2026-09-30',[{id:'a',amountMinor:Number.MAX_SAFE_INTEGER,contractualDueDate:null},{id:'b',amountMinor:1,contractualDueDate:null}]))).toBe('AMOUNT_OVERFLOW'));
});
