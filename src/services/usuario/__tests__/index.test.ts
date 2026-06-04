import { describe, it, expect, vi } from 'vitest';
import { fetchOrgUsers } from '../index';

const { mockSupabase } = vi.hoisted(() => ({
  mockSupabase: {
    rpc: vi.fn(),
  },
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: mockSupabase,
}));

describe('usuario/index', () => {
  it('fetchOrgUsers llama al RPC get_org_users', async () => {
    mockSupabase.rpc.mockResolvedValue({ data: [], error: null });
    await fetchOrgUsers();
    expect(mockSupabase.rpc).toHaveBeenCalledWith('get_org_users');
  });

  it('fetchOrgUsers lanza error si falla', async () => {
    mockSupabase.rpc.mockResolvedValue({ data: null, error: new Error('Fail') });
    await expect(fetchOrgUsers()).rejects.toThrow('Fail');
  });
});
