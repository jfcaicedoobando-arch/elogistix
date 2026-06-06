import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockSupabase } = vi.hoisted(() => {
  // Chain completo con todos los operadores que usa fetchBitacora.
  // `then` se invoca cuando se hace `await query`; resolvemos con datos/count.
  const chain: Record<string, unknown> = {
    _data: [] as unknown[],
    _error: null as unknown,
    _count: 10 as number,
  };
  const methods = ['from', 'select', 'order', 'range', 'neq', 'eq', 'gte', 'lte', 'in', 'insert'] as const;
  for (const m of methods) {
    chain[m] = vi.fn().mockReturnValue(chain);
  }
  chain.then = vi.fn().mockImplementation(function (this: typeof chain, resolve: (v: unknown) => void) {
    resolve({ data: chain._data, count: chain._count, error: chain._error });
  });
  return { mockSupabase: chain };
});

vi.mock('@/integrations/supabase/client', () => ({
  supabase: mockSupabase,
}));

import { fetchBitacora } from '../index';

beforeEach(() => {
  // Resetea historial pero conserva las implementaciones del chain.
  for (const key of Object.keys(mockSupabase)) {
    const v = (mockSupabase as Record<string, unknown>)[key];
    if (typeof v === 'function' && 'mockClear' in (v as object)) {
      (v as { mockClear: () => void }).mockClear();
    }
  }
});

describe('bitacora/index', () => {
  it('fetchBitacora realiza consulta paginada', async () => {
    const result = await fetchBitacora({ pagina: 1, limite: 10 });
    expect((mockSupabase.from as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith('bitacora_actividad');
    expect((mockSupabase.range as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith(10, 19);
    expect(result.total).toBe(10);
  });

  it('fetchBitacora maneja filtros de modulo', async () => {
    await fetchBitacora({ modulo: 'crm' });
    expect((mockSupabase.eq as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith('modulo', 'crm');
  });
});
