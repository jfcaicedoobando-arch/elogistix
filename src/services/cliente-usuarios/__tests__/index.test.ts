import { describe, it, expect, vi } from 'vitest';
import { fetchClientUsers } from '../index';

const { mockSupabase } = vi.hoisted(() => ({
  mockSupabase: {
    functions: {
      invoke: vi.fn().mockResolvedValue({ data: [], error: null }),
    },
  },
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: mockSupabase,
}));

describe('cliente-usuarios/index', () => {
  it('fetchClientUsers invoca la edge function correctamente', async () => {
    await fetchClientUsers('cli1');
    expect(mockSupabase.functions.invoke).toHaveBeenCalledWith('user-management', {
      body: { action: 'list-clients', cliente_id: 'cli1' }
    });
  });

  it('fetchClientUsers lanza error si la funcion retorna error', async () => {
    mockSupabase.functions.invoke.mockResolvedValueOnce({ data: null, error: new Error('Inv Error') });
    await expect(fetchClientUsers('cli1')).rejects.toThrow('Inv Error');
  });
});
