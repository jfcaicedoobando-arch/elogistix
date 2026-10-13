import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createWrapper } from '@/test/utils/queryWrapper';
const state = vi.hoisted(() => ({ organizationId: 'mock-a' as string | null, fuente: 'facturas',
  dependencyError: null as Error | null, fetch: vi.fn(), bank: vi.fn() }));
vi.mock('@/lib/contexts/OrganizationContext', () => ({ useOrganization: () => ({ organizationId: state.organizationId }) }));
vi.mock('@/features/profit/hooks/useFuenteEerr', () => ({ useFuenteEerr: () => ({ fuente: state.fuente }) }));
vi.mock('@/features/facturacion/hooks', () => ({ useCobranza: () => ({ data: [{ moneda: 'MXN' }], isLoading: false,
  isFetching: false, error: state.dependencyError, refetch: vi.fn() }) }));
vi.mock('@/features/cxp/hooks', () => ({ useFacturasCxP: () => ({ data: [], isLoading: false, isFetching: false, error: null, refetch: vi.fn() }) }));
vi.mock('@/features/dashboardEjecutivo/services', () => ({ fetchDashboardEjecutivo: state.fetch }));
vi.mock('@/features/tesoreria/services', () => ({ fetchSaldosCuentas: state.bank }));
vi.mock('@/hooks/shared/useDiaNegocio', () => ({ useDiaNegocio: () => '2026-10-13' }));
import { useDashboardEjecutivo } from '../useDashboardEjecutivo';
const bankRows = [{ id: 'mock-bank', alias: 'mock', banco: 'mock', moneda: 'USD', saldo: 100 }];
beforeEach(() => { vi.clearAllMocks(); state.organizationId = 'mock-a'; state.fuente = 'facturas'; state.dependencyError = null;
  state.bank.mockResolvedValue(bankRows); state.fetch.mockRejectedValue(new Error('EERR unavailable')); });

describe('independent review · analysis availability is independent of EERR', () => {
  it('keeps N/D with periods and causes when EERR fails', async () => {
    const { result } = renderHook(() => useDashboardEjecutivo('2026-09'), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.data).toBeUndefined();
    expect(result.current.financialAnalysis).toMatchObject({ organizationId: 'mock-a', numericEligible: false, certification: 'not-evaluated' });
    expect(result.current.financialAnalysis?.currencies.map(row => row.currency)).toEqual(['MXN', 'USD']);
    expect(result.current.financialAnalysis?.comparisonPeriods).toHaveLength(3);
    expect(result.current.financialAnalysisError).toBeNull();
  });
  it('does not wait for a pending EERR and reuses the bank read in the snapshot', async () => {
    state.fetch.mockImplementation(() => new Promise(() => {}));
    const { result } = renderHook(() => useDashboardEjecutivo('2026-09'), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.financialAnalysis?.numericEligible).toBe(false));
    expect(result.current.isLoading).toBe(true);
    expect(state.fetch).toHaveBeenCalledWith(expect.objectContaining({ cuentas: bankRows }));
    expect(state.bank).toHaveBeenCalledTimes(1);
  });
  it('source changes do not refetch banks, alter diagnostics or restore legacy values', async () => {
    const { result, rerender } = renderHook(() => useDashboardEjecutivo('2026-09'), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isError).toBe(true));
    const before = result.current.financialAnalysis;
    state.fuente = 'embarques'; rerender();
    await waitFor(() => expect(state.fetch).toHaveBeenCalledTimes(2));
    expect(result.current.financialAnalysis).toEqual(before);
    expect(state.bank).toHaveBeenCalledTimes(1);
  });
  it('bank errors are source errors, never a zero balance or retained analysis', async () => {
    state.bank.mockRejectedValue(new Error('bank unavailable'));
    const { result } = renderHook(() => useDashboardEjecutivo('2026-09'), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.financialAnalysisError?.message).toBe('bank unavailable'));
    expect(result.current.financialAnalysis).toBeUndefined();
    expect(state.fetch).not.toHaveBeenCalled();
  });
  it('a late bank response cannot move prior-tenant currencies into the new analysis', async () => {
    const pending = new Map<string, (rows: typeof bankRows) => void>();
    state.bank.mockImplementation((org: string) => new Promise(resolve => pending.set(org, resolve)));
    const { result, rerender } = renderHook(() => useDashboardEjecutivo('2026-09'), { wrapper: createWrapper() });
    await waitFor(() => expect(pending.has('mock-a')).toBe(true));
    state.organizationId = 'mock-b'; rerender();
    await waitFor(() => expect(pending.has('mock-b')).toBe(true));
    await act(async () => pending.get('mock-a')!(bankRows));
    expect(result.current.financialAnalysis).toBeUndefined();
    await act(async () => pending.get('mock-b')!([{ ...bankRows[0], moneda: 'EUR' }]));
    await waitFor(() => expect(result.current.financialAnalysis?.organizationId).toBe('mock-b'));
    expect(result.current.financialAnalysis?.currencies.map(row => row.currency)).toEqual(['EUR', 'MXN']);
  });
  it('retries a failed bank source without running a snapshot with missing accounts', async () => {
    state.bank.mockRejectedValueOnce(new Error('bank unavailable')).mockResolvedValue(bankRows);
    const { result } = renderHook(() => useDashboardEjecutivo('2026-09'), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.financialAnalysisError).not.toBeNull());
    expect(state.fetch).not.toHaveBeenCalled();
    await act(async () => { await result.current.refetch(); });
    await waitFor(() => expect(result.current.financialAnalysis?.numericEligible).toBe(false));
    expect(state.bank).toHaveBeenCalledTimes(2);
    expect(state.fetch).toHaveBeenCalledTimes(1);
    expect(state.fetch).toHaveBeenCalledWith(expect.objectContaining({ cuentas: bankRows }));
  });

});
