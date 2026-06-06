import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchNotificaciones, marcarLeida, marcarTodasLeidas } from '../index';

/**
 * Mock encadenado de Supabase. El mismo `chain` se devuelve desde `from(...)`
 * y desde cada operador (`select`, `update`, `eq`, `order`, `is`), y es
 * thenable, por lo que `await chain.update(...).eq(...)` resuelve a la
 * respuesta configurada vía `setNextResponse`. `range(...)` resuelve también
 * como terminal para `fetchNotificaciones`.
 */
const { mockSupabase, setNextResponse } = vi.hoisted(() => {
  let nextResponse: { data: unknown; error: unknown } = { data: null, error: null };
  const chain: Record<string, unknown> = {};
  const passthrough = vi.fn(() => chain);
  chain.from = vi.fn(() => chain);
  chain.select = passthrough;
  chain.update = passthrough;
  chain.eq = vi.fn(() => chain);
  chain.is = vi.fn(() => chain);
  chain.order = passthrough;
  chain.range = vi.fn(() => Promise.resolve(nextResponse));
  chain.then = (onFulfilled: (r: typeof nextResponse) => unknown) =>
    Promise.resolve(nextResponse).then(onFulfilled);

  return {
    mockSupabase: chain,
    setNextResponse: (r: { data?: unknown; error?: unknown }) => {
      nextResponse = { data: r.data ?? null, error: r.error ?? null };
    },
  };
});

vi.mock('@/integrations/supabase/client', () => ({
  supabase: mockSupabase,
}));

describe('notificaciones/index', () => {
  beforeEach(() => {
    (mockSupabase.from as ReturnType<typeof vi.fn>).mockClear();
    (mockSupabase.eq as ReturnType<typeof vi.fn>).mockClear();
    (mockSupabase.is as ReturnType<typeof vi.fn>).mockClear();
    (mockSupabase.update as ReturnType<typeof vi.fn>).mockClear();
  });

  it('fetchNotificaciones obtiene notificaciones del usuario', async () => {
    const mockData = [{ id: '1' }];
    setNextResponse({ data: mockData, error: null });
    const result = await fetchNotificaciones('user1');
    expect(mockSupabase.from).toHaveBeenCalledWith('notificaciones_internas');
    expect(mockSupabase.eq).toHaveBeenCalledWith('usuario_id', 'user1');
    expect(result).toEqual(mockData);
  });

  it('marcarLeida actualiza el estado leido', async () => {
    setNextResponse({ error: null });
    await marcarLeida('notif1');
    expect(mockSupabase.update).toHaveBeenCalledWith({ leida: true, leida_at: expect.any(String) });
    expect(mockSupabase.eq).toHaveBeenCalledWith('id', 'notif1');
  });

  it('marcarTodasLeidas actualiza todas las no leidas', async () => {
    setNextResponse({ error: null });
    await marcarTodasLeidas('user1');
    expect(mockSupabase.eq).toHaveBeenCalledWith('usuario_id', 'user1');
    expect(mockSupabase.eq).toHaveBeenCalledWith('leida', false);
  });
});
