import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchEmisorInfo } from '../emisor';

const { mockSupabase } = vi.hoisted(() => ({
  mockSupabase: {
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
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

describe('configuracion/emisor', () => {
  it('fetchEmisorInfo obtiene datos de la tabla configuracion', async () => {
    (mockSupabase as any)._data = [{ clave: 'razonSocial', valor: 'Test Org' }];
    const result = await fetchEmisorInfo();
    expect(mockSupabase.from).toHaveBeenCalledWith('configuracion');
    expect(result.razonSocial).toBe('Test Org');
  });

  it('fetchEmisorInfo usa fallback si no hay datos', async () => {
    (mockSupabase as any)._data = [];
    const result = await fetchEmisorInfo();
    expect(result.razonSocial).toBe('Empresa');
  });
});
