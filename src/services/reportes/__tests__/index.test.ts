import { describe, it, expect, vi } from 'vitest';
import { fetchSidebarAlertCounts, fetchReportesResumen } from '../index';

const { mockSupabase } = vi.hoisted(() => ({
  mockSupabase: {
    rpc: vi.fn(),
  },
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: mockSupabase,
}));

describe('reportes/index', () => {
  it('fetchSidebarAlertCounts mapea datos correctamente', async () => {
    mockSupabase.rpc.mockResolvedValue({ 
      data: [{ embarques_demora: 5, facturas_vencidas: 2 }], 
      error: null 
    });
    const result = await fetchSidebarAlertCounts();
    expect(result).toEqual({ embarquesDemora: 5, facturasVencidas: 2 });
  });

  it('fetchReportesResumen llama al RPC reportes_resumen', async () => {
    mockSupabase.rpc.mockResolvedValue({ data: { stats: {} }, error: null });
    const result = await fetchReportesResumen();
    expect(mockSupabase.rpc).toHaveBeenCalledWith('reportes_resumen');
    expect(result).toEqual({ stats: {} });
  });
});
