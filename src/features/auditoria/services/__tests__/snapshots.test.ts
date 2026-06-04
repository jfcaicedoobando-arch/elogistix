import { describe, it, expect, vi } from 'vitest';
import { fetchAuditoriaSnapshots, capturarSnapshotAuditoria } from '../snapshots';

const { mockSupabase } = vi.hoisted(() => {
  const chain = {
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    rpc: vi.fn(),
    then: vi.fn().mockImplementation(function(this: any, resolve: any) {
      resolve({ data: this._data, error: this._error });
    }),
    _data: null as any,
    _error: null as any,
  };
  return { mockSupabase: chain };
});

vi.mock('@/integrations/supabase/client', () => ({
  supabase: mockSupabase,
}));

describe('auditoria/snapshots', () => {
  it('fetchAuditoriaSnapshots obtiene snapshots con rango de fecha', async () => {
    const mockData = [{ fecha: '2023-01-01' }];
    (mockSupabase as any)._data = mockData;
    const result = await fetchAuditoriaSnapshots(30);
    expect(mockSupabase.from).toHaveBeenCalledWith('auditoria_snapshots');
    expect(mockSupabase.gte).toHaveBeenCalled();
    expect(result).toEqual(mockData);
  });

  it('capturarSnapshotAuditoria llama al RPC', async () => {
    mockSupabase.rpc.mockResolvedValue({ error: null });
    await capturarSnapshotAuditoria();
    expect(mockSupabase.rpc).toHaveBeenCalledWith('auditoria_capturar_snapshot');
  });
});
