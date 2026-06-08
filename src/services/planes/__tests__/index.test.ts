import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchPlanes } from '../index';

const { mockSupabase } = vi.hoisted(() => ({
  mockSupabase: {
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    then: vi.fn().mockImplementation(function(this: any, resolve: any) {
      resolve({ data: this._data, error: this._error });
    }),
    _data: null as any,
    _error: null as any,
  },
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: mockSupabase,
}));

describe('planes/index', () => {
  beforeEach(() => {
    (mockSupabase as any)._data = null;
    (mockSupabase as any)._error = null;
    (mockSupabase.from as any).mockClear();
  });

  it('fetchPlanes obtiene lista de planes', async () => {
    (mockSupabase as any)._data = [{ id: '1', nombre: 'Pro' }];
    const result = await fetchPlanes();
    expect(mockSupabase.from).toHaveBeenCalledWith('planes');
    expect(result[0].nombre).toBe('Pro');
  });

  it('fetchPlanes retorna array vacio si no hay datos', async () => {
    (mockSupabase as any)._data = null;
    const result = await fetchPlanes();
    expect(result).toEqual([]);
  });
});
