import { describe, it, expect, vi } from 'vitest';
import { buscarGlobal } from '../index';

const { mockSupabase } = vi.hoisted(() => ({
  mockSupabase: {
    rpc: vi.fn(),
  },
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: mockSupabase,
}));

describe('search/index', () => {
  it('buscarGlobal llama al RPC busqueda_global', async () => {
    mockSupabase.rpc.mockResolvedValue({ data: [{ id: '1', label: 'test' }], error: null });
    const result = await buscarGlobal('query');
    expect(mockSupabase.rpc).toHaveBeenCalledWith('busqueda_global', { termino: 'query', limite: 5 });
    expect(result).toEqual([{ id: '1', label: 'test' }]);
  });

  it('buscarGlobal retorna vacio si no hay termino', async () => {
    const result = await buscarGlobal('  ');
    expect(result).toEqual([]);
    expect(mockSupabase.rpc).not.toHaveBeenCalled();
  });
});
