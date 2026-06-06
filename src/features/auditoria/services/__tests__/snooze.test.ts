import { describe, it, expect, vi } from 'vitest';
import { snoozeRevision, clearSnoozeRevision } from '../snooze';

/**
 * Mock encadenado de Supabase que soporta dos flujos:
 *  - upsert().select().single()         → resuelve con { data, error }
 *  - update().eq()                      → thenable que resuelve con { error }
 *
 * Cada método retorna el mismo objeto (chain) y además es thenable, por lo que
 * `await chain.update(...).eq(...)` resuelve a la respuesta configurada.
 */
const { mockSupabase, setNextResponse, getLastUpdatePayload } = vi.hoisted(() => {
  let nextResponse: { data: unknown; error: unknown } = { data: null, error: null };
  let lastUpdatePayload: unknown = null;

  const chain: Record<string, unknown> = {};
  const passthrough = vi.fn(() => chain);
  chain.from = vi.fn(() => chain);
  chain.upsert = vi.fn(() => chain);
  chain.update = vi.fn((payload: unknown) => {
    lastUpdatePayload = payload;
    return chain;
  });
  chain.select = passthrough;
  chain.eq = vi.fn(() => chain);
  chain.single = vi.fn(() => Promise.resolve(nextResponse));
  chain.then = (onFulfilled: (r: typeof nextResponse) => unknown) =>
    Promise.resolve(nextResponse).then(onFulfilled);

  return {
    mockSupabase: chain,
    setNextResponse: (r: { data?: unknown; error: unknown }) => {
      nextResponse = { data: r.data ?? null, error: r.error };
    },
    getLastUpdatePayload: () => lastUpdatePayload,
  };
});

vi.mock('@/integrations/supabase/client', () => ({
  supabase: mockSupabase,
}));

describe('auditoria/snooze', () => {
  it('snoozeRevision aplica snooze correctamente', async () => {
    const input = {
      embarque_id: '1',
      regla: 'regla1',
      detalle_hash: 'h',
      detalle: 'd',
      snoozed_until: '2023-12-31',
      snooze_motivo: 'test',
    };
    setNextResponse({ data: input, error: null });
    const result = await snoozeRevision(input as Parameters<typeof snoozeRevision>[0]);
    expect(mockSupabase.upsert).toHaveBeenCalled();
    expect(result).toEqual(input);
  });

  it('clearSnoozeRevision limpia snooze', async () => {
    setNextResponse({ error: null });
    await clearSnoozeRevision('1');
    expect(mockSupabase.update).toHaveBeenCalled();
    expect(getLastUpdatePayload()).toEqual({ snoozed_until: null, snooze_motivo: null });
    expect(mockSupabase.eq).toHaveBeenCalledWith('id', '1');
  });
});
