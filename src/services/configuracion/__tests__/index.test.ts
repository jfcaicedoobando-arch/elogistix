import { describe, it, expect, vi } from 'vitest';
import { fetchConfiguracionByOrg } from '../index';

const { mockSupabase } = vi.hoisted(() => {
  const chain = {
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    upsert: vi.fn().mockReturnThis(),
    single: vi.fn().mockReturnThis(),
    then: vi.fn().mockImplementation(function(this: any, resolve: any) {
      resolve({ data: this._data, error: this._error });
    }),
    _data: null as any,
    _error: null as any,
  };
  return { mockSupabase: chain };
});

vi.mock('@/integrations/supabase/client', () => ({
  supabase: mockSupabase,
}));

describe('configuracion/index', () => {
  it('fetchConfiguracionByOrg filtra por organizacion', async () => {
    (mockSupabase as any)._data = [];
    await fetchConfiguracionByOrg('org1');
    expect(mockSupabase.from).toHaveBeenCalledWith('configuracion');
    expect(mockSupabase.eq).toHaveBeenCalledWith('organization_id', 'org1');
  });
});

