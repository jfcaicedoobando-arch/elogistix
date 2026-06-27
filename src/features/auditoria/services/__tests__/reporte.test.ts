import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchReporteAuditoria } from '../reporte';

const { mockSupabase } = vi.hoisted(() => ({
  mockSupabase: {
    rpc: vi.fn(),
  },
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: mockSupabase,
}));

describe('auditoria/reporte', () => {
  beforeEach(() => {
    mockSupabase.rpc.mockReset();
  });


  it('fetchReporteAuditoria llama al RPC correcto', async () => {
    mockSupabase.rpc.mockResolvedValue({ data: { items: [] }, error: null });
    const result = await fetchReporteAuditoria();
    expect(mockSupabase.rpc).toHaveBeenCalledWith('auditoria_embarques_org');
    expect(result).toEqual({ items: [] });
  });

  it('fetchReporteAuditoria lanza error si falla', async () => {
    mockSupabase.rpc.mockResolvedValue({ data: null, error: new Error('RPC Error') });
    await expect(fetchReporteAuditoria()).rejects.toThrow('RPC Error');
  });
});
