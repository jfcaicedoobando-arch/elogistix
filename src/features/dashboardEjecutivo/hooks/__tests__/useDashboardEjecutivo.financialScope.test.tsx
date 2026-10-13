import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createWrapper } from '@/test/utils/queryWrapper';
import { buildFinancialAnalysis } from '../../services/financialAnalysis';
import { dashboardEjecutivo } from '../../queryKeys';
const state=vi.hoisted(()=>({organizationId:'mock-a' as string|null,fuente:'facturas',dependencyError:null as Error|null,fetch:vi.fn()}));
vi.mock('@/lib/contexts/OrganizationContext',()=>({useOrganization:()=>({organizationId:state.organizationId})}));
vi.mock('@/features/profit/hooks/useFuenteEerr',()=>({useFuenteEerr:()=>({fuente:state.fuente})}));
vi.mock('@/features/facturacion/hooks',()=>({useCobranza:()=>({data:[],isLoading:false,isFetching:false,error:state.dependencyError,refetch:vi.fn()})}));
vi.mock('@/features/cxp/hooks',()=>({useFacturasCxP:()=>({data:[],isLoading:false,isFetching:false,error:null,refetch:vi.fn()})}));
vi.mock('@/features/dashboardEjecutivo/services',()=>({fetchDashboardEjecutivo:state.fetch}));
import { useDashboardEjecutivo } from '../useDashboardEjecutivo';
function response(organizationId:string,periodo='2026-09') {
 return {periodo,financialAnalysis:buildFinancialAnalysis({organizationId,selectedMonth:periodo,
  currentBalanceReference:'2026-10-13',currencyRows:[{moneda:'USD'}]})};
}
beforeEach(()=>{vi.clearAllMocks();state.organizationId='mock-a';state.fuente='facturas';state.dependencyError=null;});
describe('financial analysis · tenant/cache/error boundary',()=>{
 it('does not expose a late response from the prior organization',async()=>{
  const pending=new Map<string,(value:ReturnType<typeof response>)=>void>();
  state.fetch.mockImplementation(({organizationId}:{organizationId:string})=>new Promise(resolve=>pending.set(organizationId,resolve)));
  const {result,rerender}=renderHook(()=>useDashboardEjecutivo('2026-09'),{wrapper:createWrapper()});
  await waitFor(()=>expect(pending.has('mock-a')).toBe(true));
  state.organizationId='mock-b';rerender();await waitFor(()=>expect(pending.has('mock-b')).toBe(true));
  await act(async()=>pending.get('mock-a')!(response('mock-a')));
  expect(result.current.data).toBeUndefined();
  await act(async()=>pending.get('mock-b')!(response('mock-b')));
  await waitFor(()=>expect(result.current.data?.financialAnalysis?.organizationId).toBe('mock-b'));
 });
 it('rejects a response whose analysis belongs to another scope',async()=>{
  state.fetch.mockResolvedValue(response('wrong-org'));
  const {result}=renderHook(()=>useDashboardEjecutivo('2026-09'),{wrapper:createWrapper()});
  await waitFor(()=>expect(result.current.isError).toBe(true));
  expect(result.current.data).toBeUndefined();expect(result.current.error?.message).toContain('organización y periodo actuales');
 });
 it('does not call readers without organization',()=>{
  state.organizationId=null;
  const {result}=renderHook(()=>useDashboardEjecutivo('2026-09'),{wrapper:createWrapper()});
  expect(state.fetch).not.toHaveBeenCalled();expect(result.current.data).toBeUndefined();
 });
 it('read failure is an error, not an empty/certified zero metric',async()=>{
  state.fetch.mockRejectedValue(new Error('synthetic read failure'));
  const {result}=renderHook(()=>useDashboardEjecutivo('2026-09'),{wrapper:createWrapper()});
  await waitFor(()=>expect(result.current.isError).toBe(true));
  expect(result.current.error?.message).toBe('synthetic read failure');expect(result.current.data).toBeUndefined();
 });
 it('dependency refetch failure hides previously available analysis',async()=>{
  state.fetch.mockResolvedValue(response('mock-a'));
  const {result,rerender}=renderHook(()=>useDashboardEjecutivo('2026-09'),{wrapper:createWrapper()});
  await waitFor(()=>expect(result.current.isSuccess).toBe(true));
  state.dependencyError=new Error('synthetic CxC failure');rerender();
  expect(result.current.data).toBeUndefined();expect(result.current.error?.message).toBe('synthetic CxC failure');
 });
 it('cache separates organization and period, and a source change preserves analysis',async()=>{
  expect(dashboardEjecutivo.snapshot('mock-a','2026-09','facturas')).not.toEqual(dashboardEjecutivo.snapshot('mock-b','2026-09','facturas'));
  expect(dashboardEjecutivo.snapshot('mock-a','2026-09','facturas')).not.toEqual(dashboardEjecutivo.snapshot('mock-a','2026-08','facturas'));
  state.fetch.mockImplementation(({organizationId,periodo}:{organizationId:string,periodo:string})=>Promise.resolve(response(organizationId,periodo)));
  const {result,rerender}=renderHook(()=>useDashboardEjecutivo('2026-09'),{wrapper:createWrapper()});
  await waitFor(()=>expect(result.current.isSuccess).toBe(true));const before=result.current.data?.financialAnalysis;
  state.fuente='embarques';rerender();await waitFor(()=>expect(result.current.isSuccess).toBe(true));
  expect(result.current.data?.financialAnalysis).toEqual(before);expect(state.fetch).toHaveBeenCalledTimes(2);
 });
});

vi.mock('@/features/tesoreria/services', () => ({fetchSaldosCuentas: vi.fn(async () => [])}));
vi.mock('@/hooks/shared/useDiaNegocio', () => ({useDiaNegocio: () => '2026-10-13'}));
