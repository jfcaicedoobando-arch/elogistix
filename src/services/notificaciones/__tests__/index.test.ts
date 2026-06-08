import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createSupabaseChainMock } from '@/test/utils/_supabaseChainMock';

const { mockSupabase } = vi.hoisted(() => ({ mockSupabase: { current: null as any } }));

vi.mock('@/integrations/supabase/client', () => ({
  get supabase() {
    return mockSupabase.current;
  },
}));

import { fetchNotificaciones, marcarLeida, marcarTodasLeidas } from '../index';

describe('notificaciones/index', () => {
  beforeEach(() => vi.clearAllMocks());

  it('fetchNotificaciones obtiene las 50 notificaciones recientes del usuario', async () => {
    const rows = [{ id: '1', usuario_id: 'user1', leida: false }];
    mockSupabase.current = createSupabaseChainMock(rows);
    const result = await fetchNotificaciones('user1');
    expect(mockSupabase.current.from).toHaveBeenCalledWith('notificaciones_internas');
    expect(mockSupabase.current.eq).toHaveBeenCalledWith('usuario_id', 'user1');
    expect(mockSupabase.current.order).toHaveBeenCalledWith('created_at', { ascending: false });
    expect(mockSupabase.current.range).toHaveBeenCalledWith(0, 49);
    expect(result).toEqual(rows);
  });

  it('fetchNotificaciones lanza ante error', async () => {
    mockSupabase.current = createSupabaseChainMock(null, { message: 'fail' });
    await expect(fetchNotificaciones('user1')).rejects.toMatchObject({ message: 'fail' });
  });

  it('marcarLeida actualiza leida=true con timestamp ISO', async () => {
    mockSupabase.current = createSupabaseChainMock(null);
    await marcarLeida('notif1');
    expect(mockSupabase.current.update).toHaveBeenCalledTimes(1);
    const payload = mockSupabase.current.update.mock.calls[0][0];
    expect(payload.leida).toBe(true);
    expect(payload.leida_at).toEqual(expect.any(String));
    expect(new Date(payload.leida_at).toString()).not.toBe('Invalid Date');
    expect(mockSupabase.current.eq).toHaveBeenCalledWith('id', 'notif1');
  });

  it('marcarTodasLeidas filtra por usuario y por leida=false', async () => {
    mockSupabase.current = createSupabaseChainMock(null);
    await marcarTodasLeidas('user1');
    expect(mockSupabase.current.eq).toHaveBeenCalledWith('usuario_id', 'user1');
    expect(mockSupabase.current.eq).toHaveBeenCalledWith('leida', false);
  });

  it('marcarTodasLeidas propaga errores', async () => {
    mockSupabase.current = createSupabaseChainMock(null, { message: 'rls' });
    await expect(marcarTodasLeidas('user1')).rejects.toMatchObject({ message: 'rls' });
  });
});
