import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createSupabaseChainMock } from '@/test/utils/_supabaseChainMock';

const { mockSupabase } = vi.hoisted(() => ({ mockSupabase: { current: null as any } }));

vi.mock('@/integrations/supabase/client', () => ({
  get supabase() {
    return mockSupabase.current;
  },
}));

import { listActiveOrganizations } from '../index';

describe('organization/index', () => {
  beforeEach(() => vi.clearAllMocks());

  it('listActiveOrganizations filtra por activos y ordena por nombre con cap=500', async () => {
    mockSupabase.current = createSupabaseChainMock([{ id: '1', nombre: 'Org1' }]);
    const result = await listActiveOrganizations();
    expect(mockSupabase.current.from).toHaveBeenCalledWith('organizations');
    expect(mockSupabase.current.eq).toHaveBeenCalledWith('activo', true);
    expect(mockSupabase.current.order).toHaveBeenCalledWith('nombre');
    expect(mockSupabase.current.limit).toHaveBeenCalledWith(500);
    expect(result).toHaveLength(1);
  });

  it('retorna [] cuando data es null', async () => {
    mockSupabase.current = createSupabaseChainMock(null);
    const result = await listActiveOrganizations();
    expect(result).toEqual([]);
  });

  it('lanza el error tal cual cuando Supabase devuelve error', async () => {
    mockSupabase.current = createSupabaseChainMock(null, new Error('DB Error'));
    await expect(listActiveOrganizations()).rejects.toThrow('DB Error');
  });
});
