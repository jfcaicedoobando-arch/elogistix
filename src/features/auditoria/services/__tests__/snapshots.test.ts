import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createSupabaseChainMock } from '@/test/utils/_supabaseChainMock';

const { mockSupabase } = vi.hoisted(() => ({ mockSupabase: { current: null as any } }));

vi.mock('@/integrations/supabase/client', () => ({
  get supabase() {
    return mockSupabase.current;
  },
}));

import { fetchAuditoriaSnapshots, capturarSnapshotAuditoria } from '../snapshots';

function withRpc(data: any[] = [], error: any = null, rpcImpl?: any) {
  const chain = createSupabaseChainMock(data, error);
  chain.rpc = rpcImpl ?? vi.fn().mockResolvedValue({ error: null });
  return chain;
}

describe('auditoria/snapshots', () => {
  beforeEach(() => vi.clearAllMocks());

  it('fetchAuditoriaSnapshots filtra por rango de días y cap en 2000', async () => {
    const rows = [{ fecha: '2023-01-01' }];
    mockSupabase.current = withRpc(rows);
    const result = await fetchAuditoriaSnapshots(30);
    expect(mockSupabase.current.from).toHaveBeenCalledWith('auditoria_snapshots');
    expect(mockSupabase.current.gte).toHaveBeenCalledWith('fecha', expect.any(String));
    // Validar formato YYYY-MM-DD del parámetro fecha
    const [, fechaArg] = mockSupabase.current.gte.mock.calls[0];
    expect(fechaArg).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(mockSupabase.current.order).toHaveBeenCalledWith('fecha', { ascending: true });
    expect(mockSupabase.current.limit).toHaveBeenCalledWith(2000);
    expect(result).toEqual(rows);
  });

  it('fetchAuditoriaSnapshots lanza ante error de Supabase', async () => {
    mockSupabase.current = withRpc(null as any, { message: 'rls' });
    await expect(fetchAuditoriaSnapshots(7)).rejects.toMatchObject({ message: 'rls' });
  });

  it('capturarSnapshotAuditoria invoca el RPC con p_organization_id', async () => {
    mockSupabase.current = withRpc();
    await capturarSnapshotAuditoria('org-1');
    expect(mockSupabase.current.rpc).toHaveBeenCalledWith('auditoria_capturar_snapshot', {
      p_organization_id: 'org-1',
    });
  });

  it('capturarSnapshotAuditoria propaga errores del RPC', async () => {
    mockSupabase.current = withRpc([], null, vi.fn().mockResolvedValue({ error: { message: 'fail' } }));
    await expect(capturarSnapshotAuditoria('org-1')).rejects.toMatchObject({ message: 'fail' });
  });

  it('capturarSnapshotAuditoria rechaza si no hay organizationId', async () => {
    mockSupabase.current = withRpc();
    await expect(capturarSnapshotAuditoria('')).rejects.toThrow(/organizationId/);
  });
});
