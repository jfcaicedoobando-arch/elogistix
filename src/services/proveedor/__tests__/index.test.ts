import { describe, it, expect, vi } from 'vitest';
import { fetchProveedoresPaginados, fetchProveedor } from '../index';

const { mockSupabase } = vi.hoisted(() => {
  const chain = {
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockReturnThis(),
    then: vi.fn().mockImplementation(function(this: any, resolve: any) {
      resolve({ data: this._data, count: 10, error: this._error });
    }),
    _data: null as any,
    _error: null as any,
  };
  return { mockSupabase: chain };
});

vi.mock('@/integrations/supabase/client', () => ({
  supabase: mockSupabase,
}));

describe('proveedor/index', () => {
  it('fetchProveedores realiza consulta con conteo', async () => {
    (mockSupabase as any)._data = [];
    const result = await fetchProveedoresPaginados({ pagina: 0, limite: 10 });
    expect(mockSupabase.from).toHaveBeenCalledWith('proveedores');
    expect(result.total).toBe(10);
  });

  it('fetchProveedorDetail obtiene un solo proveedor', async () => {
    mockSupabase.single.mockResolvedValue({ data: { id: '1', nombre: 'P1' }, error: null });
    const result = await fetchProveedor('1');
    expect(mockSupabase.eq).toHaveBeenCalledWith('id', '1');
    expect(result.nombre).toBe('P1');
  });
});
