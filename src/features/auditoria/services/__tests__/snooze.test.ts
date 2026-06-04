import { describe, it, expect, vi } from 'vitest';
import { snoozeRevision, clearSnoozeRevision } from '../snooze';

const { mockSupabase } = vi.hoisted(() => {
  const chain = {
    from: vi.fn().mockReturnThis(),
    upsert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    single: vi.fn().mockReturnThis(),
  };
  return { mockSupabase: chain };
});

vi.mock('@/integrations/supabase/client', () => ({
  supabase: mockSupabase,
}));

describe('auditoria/snooze', () => {
  it('snoozeRevision aplica snooze correctamente', async () => {
    const input = { embarque_id: '1', regla: 'regla1', detalle_hash: 'h', detalle: 'd', snoozed_until: '2023-12-31', snooze_motivo: 'test' };
    mockSupabase.single.mockResolvedValue({ data: input, error: null });
    const result = await snoozeRevision(input as any);
    expect(mockSupabase.upsert).toHaveBeenCalled();
    expect(result).toEqual(input);
  });

  it('clearSnoozeRevision limpia snooze', async () => {
    mockSupabase.eq.mockResolvedValue({ error: null });
    await clearSnoozeRevision('1');
    expect(mockSupabase.update).toHaveBeenCalledWith({ snoozed_until: null, snooze_motivo: null });
    expect(mockSupabase.eq).toHaveBeenCalledWith('id', '1');
  });
});
