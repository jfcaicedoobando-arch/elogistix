import { describe, it, expect, vi } from 'vitest';
import { fetchNavieras, fetchPuertos } from '../index';

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

describe('catalogos/index', () => {
  it('fetchNavieras obtiene lista ordenada', async () => {
    (mockSupabase as any)._data = [{ name: 'MSC' }];
    const result = await fetchNavieras();
    expect(mockSupabase.from).toHaveBeenCalledWith('navieras');
    expect(mockSupabase.order).toHaveBeenCalledWith('name');
    expect(result[0].name).toBe('MSC');
  });

  it('fetchPuertos obtiene lista ordenada', async () => {
    (mockSupabase as any)._data = [{ name: 'Manzanillo' }];
    await fetchPuertos();
    expect(mockSupabase.from).toHaveBeenCalledWith('puertos');
  });
});
