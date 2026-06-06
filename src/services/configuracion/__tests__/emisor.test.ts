import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchEmisorEmpresa, invalidarEmisorCache } from '../emisor';

const { mockSupabase } = vi.hoisted(() => ({
  mockSupabase: {
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    then: vi.fn().mockImplementation(function(this: { _data: unknown; _error: unknown }, resolve: (r: unknown) => void) {
      resolve({ data: this._data, error: this._error });
    }),
    _data: null as unknown,
    _error: null as unknown,
  },
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: mockSupabase,
}));

describe('configuracion/emisor', () => {
  beforeEach(() => {
    // Cache TTL en memoria contamina entre tests; invalidar siempre.
    invalidarEmisorCache();
  });

  it('fetchEmisorInfo obtiene datos de la tabla configuracion', async () => {
    // El servicio mapea por clave: usa "nombre" como razonSocial fallback.
    (mockSupabase as unknown as { _data: unknown })._data = [
      { clave: 'nombre', valor: 'Test Org' },
    ];
    const result = await fetchEmisorEmpresa();
    expect(mockSupabase.from).toHaveBeenCalledWith('configuracion');
    expect(result.razonSocial).toBe('Test Org');
  });

  it('fetchEmisorInfo usa fallback si no hay datos', async () => {
    (mockSupabase as unknown as { _data: unknown })._data = [];
    const result = await fetchEmisorEmpresa();
    expect(result.razonSocial).toBe('Empresa');
  });
});

