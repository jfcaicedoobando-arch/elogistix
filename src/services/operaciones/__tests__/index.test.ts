import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchOperacionesStats } from '../index';

const { mockSupabase } = vi.hoisted(() => ({
  mockSupabase: {
    rpc: vi.fn(),
  },
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: mockSupabase,
}));

describe('operaciones/index', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetchOperacionesStats llama al RPC operaciones_stats', async () => {
    mockSupabase.rpc.mockResolvedValue({ data: { global: {} }, error: null });
    const result = await fetchOperacionesStats();
    expect(mockSupabase.rpc).toHaveBeenCalledWith('operaciones_stats');
    expect(result).toEqual({ global: {} });
  });

  it('fetchOperacionesStats lanza error si falla', async () => {
    mockSupabase.rpc.mockResolvedValue({ data: null, error: new Error('Network Error') });
    await expect(fetchOperacionesStats()).rejects.toThrow('Network Error');
  });
});
