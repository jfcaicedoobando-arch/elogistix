import { describe, it, expect, vi } from 'vitest';
import { fetchBitacora } from '../index';

const { mockSupabase } = vi.hoisted(() => {
  const chain = {
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    range: vi.fn().mockReturnThis(),
    then: vi.fn().mockImplementation(function(this: any, resolve: any) {
      resolve({ data: this._data, count: 10, error: this._error });
    }),
    _data: [],
    _error: null,
  };
  return { mockSupabase: chain };
});

vi.mock('@/integrations/supabase/client', () => ({
  supabase: mockSupabase,
}));

describe('bitacora/index', () => {
  it('fetchBitacora realiza consulta paginada', async () => {
    const result = await fetchBitacora({ pagina: 1, limite: 10 });
    expect(mockSupabase.from).toHaveBeenCalledWith('bitacora_actividad');
    expect(mockSupabase.range).toHaveBeenCalledWith(10, 19);
    expect(result.total).toBe(10);
  });

  it('fetchBitacora maneja filtros de modulo', async () => {
    (mockSupabase as any).eq = vi.fn().mockReturnThis();
    await fetchBitacora({ modulo: 'crm' });
    expect((mockSupabase as any).eq).toHaveBeenCalledWith('modulo', 'crm');
  });
});
