import { describe, it, expect, vi } from 'vitest';
import { listActiveOrganizations } from '../index';

const { mockSupabase } = vi.hoisted(() => ({
  mockSupabase: {
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
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

describe('organization/index', () => {
  it('listActiveOrganizations filtra por activos', async () => {
    (mockSupabase as any)._data = [{ id: '1', nombre: 'Org1' }];
    const result = await listActiveOrganizations();
    expect(mockSupabase.from).toHaveBeenCalledWith('organizations');
    expect(mockSupabase.eq).toHaveBeenCalledWith('activo', true);
    expect(result).toHaveLength(1);
  });

  it('listActiveOrganizations lanza error si falla', async () => {
    (mockSupabase as any)._error = new Error('DB Error');
    await expect(listActiveOrganizations()).rejects.toThrow('DB Error');
  });
});
