import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchNavieras, fetchPuertos } from '../index';

const { mockSupabase } = vi.hoisted(() => {
  const chain: any = {};
  chain.from = vi.fn(() => chain);
  chain.select = vi.fn(() => chain);
  chain.order = vi.fn(() => chain);
  chain.limit = vi.fn(() => chain);
  chain.eq = vi.fn(() => chain);
  chain.then = vi.fn(function (this: any, resolve: any) {
    resolve({ data: chain._data, error: chain._error });
  });
  chain._data = null;
  chain._error = null;
  return { mockSupabase: chain };
});

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
