import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createSupabaseMock } from '@/services/__tests__/_supabaseChainMock';

const { mockRef } = vi.hoisted(() => ({ mockRef: { current: null as ReturnType<typeof createSupabaseMock> | null } }));

vi.mock('@/integrations/supabase/client', () => ({
  get supabase() { return mockRef.current!.supabase; },
}));

import { fetchSidebarAlertCounts, fetchReportesResumen, fetchOperadoresDistintos } from '../index';

describe('reportes/index', () => {
  beforeEach(() => {
    mockRef.current = createSupabaseMock();
  });

  it('fetchSidebarAlertCounts mapea datos correctamente', async () => {
    mockRef.current!.setRpcResult('sidebar_alert_counts', {
      data: [{ embarques_demora: 5, facturas_vencidas: 2, garantias_atoradas: 1 }],
      error: null,
    });
    const result = await fetchSidebarAlertCounts();
    expect(result).toEqual({ embarquesDemora: 5, facturasVencidas: 2, garantiasAtoradas: 1 });
  });

  it('fetchSidebarAlertCounts usa valores por defecto cuando data es vacío', async () => {
    mockRef.current!.setRpcResult('sidebar_alert_counts', { data: [], error: null });
    const result = await fetchSidebarAlertCounts();
    expect(result).toEqual({ embarquesDemora: 0, facturasVencidas: 0, garantiasAtoradas: 0 });
  });

  it('fetchReportesResumen llama al RPC reportes_resumen', async () => {
    mockRef.current!.setRpcResult('reportes_resumen', {
      data: { clientes: [], kpis: { totalClientes: 0, revenue: 0, profit: 0, margenProm: 0 } },
      error: null,
    });
    const result = await fetchReportesResumen({});
    expect(mockRef.current!.rpcCalls[0]?.fn).toBe('reportes_resumen');
    expect(result).toEqual({ clientes: [], kpis: { totalClientes: 0, revenue: 0, profit: 0, margenProm: 0, embarquesSinTc: 0 } });
  });

  it('fetchReportesResumen convierte strings numéricos a number', async () => {
    mockRef.current!.setRpcResult('reportes_resumen', {
      data: {
        clientes: [{
          cliente_id: 'c1', cliente_nombre: 'ACME',
          total_embarques: '3', venta_usd: '100.50', costo_usd: '40.25',
          profit_usd: '60.25', margen: '0.6',
        }],
        kpis: { totalClientes: '1', revenue: '100.50', profit: '60.25', margenProm: '0.6' },
      },
      error: null,
    });
    const result = await fetchReportesResumen({ fechaDesde: '2026-01-01' });
    expect(result.clientes[0].venta_usd).toBe(100.5);
    expect(typeof result.clientes[0].margen).toBe('number');
    expect(result.kpis.totalClientes).toBe(1);
    expect(result.kpis.revenue).toBe(100.5);
  });

  it('fetchSidebarAlertCounts propaga error de RPC', async () => {
    mockRef.current!.setRpcResult('sidebar_alert_counts', { data: null, error: new Error('RPC fail') });
    await expect(fetchSidebarAlertCounts()).rejects.toThrow('RPC fail');
  });

  it('fetchReportesResumen propaga error de RPC', async () => {
    mockRef.current!.setRpcResult('reportes_resumen', { data: null, error: new Error('RPC fail') });
    await expect(fetchReportesResumen({})).rejects.toThrow('RPC fail');
  });

  it('fetchOperadoresDistintos mapea filas a array de strings', async () => {
    mockRef.current!.setRpcResult('operadores_distintos', {
      data: [{ operador: 'Juan' }, { operador: 'Ana' }],
      error: null,
    });
    const result = await fetchOperadoresDistintos();
    expect(result).toEqual(['Juan', 'Ana']);
  });

  it('fetchOperadoresDistintos devuelve [] si data es null', async () => {
    mockRef.current!.setRpcResult('operadores_distintos', { data: null, error: null });
    const result = await fetchOperadoresDistintos();
    expect(result).toEqual([]);
  });

  it('fetchOperadoresDistintos propaga error de RPC', async () => {
    mockRef.current!.setRpcResult('operadores_distintos', { data: null, error: new Error('RPC fail') });
    await expect(fetchOperadoresDistintos()).rejects.toThrow('RPC fail');
  });
});
