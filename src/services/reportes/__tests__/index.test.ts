import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createSupabaseMock } from '@/services/__tests__/_supabaseChainMock';

const { mockRef } = vi.hoisted(() => ({ mockRef: { current: null as ReturnType<typeof createSupabaseMock> | null } }));

vi.mock('@/integrations/supabase/client', () => ({
  get supabase() { return mockRef.current!.supabase; },
}));

import { fetchSidebarAlertCounts, fetchReportesResumen } from '../index';

describe('reportes/index', () => {
  beforeEach(() => {
    mockRef.current = createSupabaseMock();
  });

  it('fetchSidebarAlertCounts mapea datos correctamente', async () => {
    mockRef.current!.setRpcResult('sidebar_alert_counts', {
      data: [{ embarques_demora: 5, facturas_vencidas: 2 }],
      error: null,
    });
    const result = await fetchSidebarAlertCounts();
    expect(result).toEqual({ embarquesDemora: 5, facturasVencidas: 2 });
  });

  it('fetchReportesResumen llama al RPC reportes_resumen', async () => {
    mockRef.current!.setRpcResult('reportes_resumen', {
      data: { clientes: [], kpis: { totalClientes: 0, revenue: 0, profit: 0, margenProm: 0 } },
      error: null,
    });
    const result = await fetchReportesResumen({});
    expect(mockRef.current!.rpcCalls[0]?.fn).toBe('reportes_resumen');
    expect(result).toEqual({ clientes: [], kpis: { totalClientes: 0, revenue: 0, profit: 0, margenProm: 0 } });
  });

  it('fetchSidebarAlertCounts propaga error de RPC', async () => {
    mockRef.current!.setRpcResult('sidebar_alert_counts', { data: null, error: new Error('RPC fail') });
    await expect(fetchSidebarAlertCounts()).rejects.toThrow('RPC fail');
  });

  it('fetchReportesResumen propaga error de RPC', async () => {
    mockRef.current!.setRpcResult('reportes_resumen', { data: null, error: new Error('RPC fail') });
    await expect(fetchReportesResumen({})).rejects.toThrow('RPC fail');
  });
});
