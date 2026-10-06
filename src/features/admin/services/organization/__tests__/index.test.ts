import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createSupabaseChainMock } from '@/services/__tests__/_supabaseChainMock';

const { mockSupabase } = vi.hoisted(() => ({ mockSupabase: { current: null as any } }));

vi.mock('@/integrations/supabase/client', () => ({
  get supabase() {
    return mockSupabase.current;
  },
}));

import { listActiveOrganizations } from '../index';

const validRow = {
  id: '1', nombre: 'Org1', rfc: null, logo_url: null, plan: null, activo: true,
};

describe('organization/index', () => {
  beforeEach(() => vi.clearAllMocks());

  it('listActiveOrganizations filtra por activos y ordena por nombre con cap=500', async () => {
    mockSupabase.current = createSupabaseChainMock([validRow]);
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

  it('preserva valores nullable y columnas adicionales sin inventar defaults', async () => {
    const row = { ...validRow, activo: null, created_at: null, moneda_preferida: 'MXN' };
    mockSupabase.current = createSupabaseChainMock([row]);
    await expect(listActiveOrganizations()).resolves.toEqual([row]);
  });

  it.each([
    {}, null, 42,
    { ...validRow, id: null }, { ...validRow, id: 42 },
    { ...validRow, nombre: null }, { ...validRow, nombre: 42 },
    { ...validRow, rfc: 42 }, { ...validRow, plan: false },
    { ...validRow, activo: 'true' }, { ...validRow, logo_url: 42 },
  ])('rechaza una fila malformada sin coerción: %j', async (row) => {
    mockSupabase.current = createSupabaseChainMock([row]);
    await expect(listActiveOrganizations()).rejects.toThrow();
  });
});
