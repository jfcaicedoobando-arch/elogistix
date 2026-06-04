import { describe, it, expect, vi } from 'vitest';
import { fetchNotificaciones, markAsRead, markAllAsRead } from '../index';

const { mockSupabase } = vi.hoisted(() => {
  const chain = {
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    range: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
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

describe('notificaciones/index', () => {
  it('fetchNotificaciones obtiene notificaciones del usuario', async () => {
    const mockData = [{ id: '1' }];
    (mockSupabase as any)._data = mockData;
    const result = await fetchNotificaciones('user1');
    expect(mockSupabase.from).toHaveBeenCalledWith('notificaciones_internas');
    expect(mockSupabase.eq).toHaveBeenCalledWith('usuario_id', 'user1');
    expect(result).toEqual(mockData);
  });

  it('markAsRead actualiza el estado leido', async () => {
    (mockSupabase as any)._error = null;
    await markAsRead('notif1');
    expect(mockSupabase.update).toHaveBeenCalledWith({ read: true, read_at: expect.any(String) });
    expect(mockSupabase.eq).toHaveBeenCalledWith('id', 'notif1');
  });

  it('markAllAsRead actualiza todas las no leidas', async () => {
    (mockSupabase as any)._error = null;
    await markAllAsRead('user1');
    expect(mockSupabase.is).toHaveBeenCalledWith('read_at', null);
    expect(mockSupabase.eq).toHaveBeenCalledWith('usuario_id', 'user1');
  });
});
