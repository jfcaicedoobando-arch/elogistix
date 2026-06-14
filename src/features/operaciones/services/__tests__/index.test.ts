import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createSupabaseMock } from '@/services/__tests__/_supabaseChainMock';

const { mockRef } = vi.hoisted(() => ({ mockRef: { current: null as ReturnType<typeof createSupabaseMock> | null } }));

vi.mock('@/integrations/supabase/client', () => ({
  get supabase() { return mockRef.current!.supabase; },
}));

import { fetchOperacionesStats } from '../index';

describe('operaciones/index', () => {
  beforeEach(() => {
    mockRef.current = createSupabaseMock();
  });

  it('fetchOperacionesStats llama al RPC operaciones_stats', async () => {
    mockRef.current!.setRpcResult('operaciones_stats', { data: { global: {} }, error: null });
    const result = await fetchOperacionesStats();
    expect(mockRef.current!.rpcCalls[0]?.fn).toBe('operaciones_stats');
    expect(result).toEqual({ global: {} });
  });

  it('fetchOperacionesStats lanza error si falla', async () => {
    mockRef.current!.setRpcResult('operaciones_stats', { data: null, error: new Error('Network Error') });
    await expect(fetchOperacionesStats()).rejects.toThrow('Network Error');
  });
});
