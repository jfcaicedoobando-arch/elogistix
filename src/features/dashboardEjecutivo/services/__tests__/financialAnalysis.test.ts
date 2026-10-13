import { describe, expect, it } from 'vitest';
import { calcularFlujoProyectado, type CxpRow } from '@/features/tesoreria/domain';
import { buildFinancialAnalysis } from '../financialAnalysis';
const base={organizationId:'mock-org',selectedMonth:'2026-09',currentBalanceReference:'2026-10-13',
  currencyRows:[{moneda:'MXN'},{moneda:'USD'},{moneda:'EUR'},{moneda:'USD'}]};
describe('financial analysis · current readers never certify metrics',()=>{
 it('shows observed currencies and three actual calendar months without amounts or conversion',()=>{
  const result=buildFinancialAnalysis(base);
  expect(result.currencies.map(row=>row.currency)).toEqual(['EUR','MXN','USD']);
  expect(result.comparisonPeriods).toEqual([{start:'2026-07-01',end:'2026-07-31'},
   {start:'2026-08-01',end:'2026-08-31'},{start:'2026-09-01',end:'2026-09-30'}]);
  expect(result.policyApprovedAt).toBe('2026-10-13T12:32:00Z');
  expect(result.numericEligible).toBe(false);
  for(const row of result.currencies) for(const metric of Object.values(row.metrics)) expect(metric.status).toBe('unavailable');
 });
 it.each([{currencyRows:[]},{currencyRows:[{moneda:null}]},{currencyRows:[{moneda:'invalid'}]}])('empty/unknown currency is not zero MXN',({currencyRows})=>{
  const result=buildFinancialAnalysis({...base,currencyRows});
  expect(result.currencies.map(row=>row.currency)).toEqual([null]);expect(result.numericEligible).toBe(false);
 });
 it('does not discard an unknown-currency row when valid rows exist',()=>{
  expect(buildFinancialAnalysis({...base,currencyRows:[{moneda:'MXN'},{}]}).currencies.map(row=>row.currency)).toEqual([null,'MXN']);
 });
 it('ignores invented IDs, approvals and complete:true',()=>{
  const result=buildFinancialAnalysis({...base,complete:true,evidenceId:'fabricated',cash:{availableMinor:100000},certification:'certified'} as Parameters<typeof buildFinancialAnalysis>[0]);
  expect(result.numericEligible).toBe(false);expect(result.certification).toBe('not-evaluated');
  expect(JSON.stringify(result)).not.toMatch(/fabricated|availableMinor|approval-unverified/);
 });
 it('reprogramming is not a payment and leaves DPO unchanged',()=>{
  const before=buildFinancialAnalysis({...base,currencyRows:[{moneda:'MXN',fecha_programada_pago:'2026-10-14',saldo:100} as {moneda:string}]});
  const after=buildFinancialAnalysis({...base,currencyRows:[{moneda:'MXN',fecha_programada_pago:'2027-01-01',saldo:100} as {moneda:string}]});
  expect(after).toEqual(before);
 });
 it('reprogramming changes the forecast week but not DPO data or causes',()=>{
  const row:CxpRow={id:'mock-payable',folio_proveedor:'mock',proveedor_nombre:'mock',moneda:'MXN',saldo:100,
   fecha_vencimiento:'2026-10-14',fecha_programada_pago:'2026-10-14'};
  const moved={...row,fecha_programada_pago:'2026-10-28'};
  const forecast=(cxp:CxpRow[])=>calcularFlujoProyectado({cuentas:[],cobranza:[],cxp,liquidaciones:[],dias:28,hoy:new Date(2026,9,13)});
  const before=forecast([row]),after=forecast([moved]);
  expect(before.semanas.find(week=>week.salidas_mxn===100)?.semana_iso).not.toEqual(after.semanas.find(week=>week.salidas_mxn===100)?.semana_iso);
  expect(before.total_salidas_mxn).toBe(after.total_salidas_mxn);
  expect(buildFinancialAnalysis({...base,currencyRows:[row]})).toEqual(buildFinancialAnalysis({...base,currencyRows:[moved]}));
 });
 it('EERR source, current rates and accounting profit cannot change new metrics or causes',()=>{
  const outputs=['facturas','embarques'].map(fuente=>buildFinancialAnalysis({...base,fuente,tipoCambioUsd:999,utilidad:999999} as Parameters<typeof buildFinancialAnalysis>[0]));
  expect(outputs[0]).toEqual(outputs[1]);
 });
 it('scopes reports by organization/period/reference without retaining prior scope',()=>{
  const next=buildFinancialAnalysis({...base,organizationId:'other-org',selectedMonth:'2026-08',currentBalanceReference:'2026-10-14',currencyRows:[{moneda:'USD'}]});
  expect(next).toMatchObject({organizationId:'other-org',selectedMonth:'2026-08',currentBalanceReference:'2026-10-14'});
  expect(next.currencies.map(row=>row.currency)).toEqual(['USD']);expect(JSON.stringify(next)).not.toContain('mock-org');
 });
 it('describes missing data, not missing policy approval or permission',()=>{
  const text=JSON.stringify(buildFinancialAnalysis(base));
  expect(text).not.toMatch(/pendientes de aprobación|Falta política aprobada|aprobación verificable|permiso denegado/);
  expect(text).toContain('HISTORY_INCOMPLETE');expect(text).toContain('CASH_NOT_RECONCILED');
 });
});
