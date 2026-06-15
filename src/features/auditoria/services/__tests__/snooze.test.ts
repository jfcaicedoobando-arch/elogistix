import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createSupabaseChainMock } from '@/test/utils/_supabaseChainMock';

const { mockSupabase } = vi.hoisted(() => ({ mockSupabase: { current: null as any } }));

vi.mock('@/integrations/supabase/client', () => ({
  get supabase() {
    return mockSupabase.current;
  },
}));

import { snoozeRevision, clearSnoozeRevision } from '../snooze';

describe('auditoria/snooze', () => {
  beforeEach(() => vi.clearAllMocks());

  it('snoozeRevision hace upsert con onConflict correcto', async () => {
    const input = {
      organization_id: 'org-1',
      embarque_id: '1', regla: 'sin_tracking', detalle_hash: 'h',
      detalle: 'd', snoozed_until: '2099-12-31', snooze_motivo: 'cliente espera',
    } as any;
    const created = { id: 'r1', ...input };
    mockSupabase.current = createSupabaseChainMock(created);
    const result = await snoozeRevision(input);
    expect(mockSupabase.current.from).toHaveBeenCalledWith('auditoria_revisiones');
    const [payload, opts] = mockSupabase.current.upsert.mock.calls[0];
    expect(payload).toMatchObject({
      organization_id: 'org-1',
      embarque_id: '1', regla: 'sin_tracking', detalle_hash: 'h', detalle: 'd',
      snoozed_until: '2099-12-31', snooze_motivo: 'cliente espera',
    });
    expect(payload.updated_at).toEqual(expect.any(String));
    expect(opts).toEqual({ onConflict: 'organization_id,embarque_id,regla,detalle_hash' });
    expect(result).toEqual(created);
  });

  it('snoozeRevision rechaza si falta organization_id', async () => {
    mockSupabase.current = createSupabaseChainMock({});
    await expect(
      snoozeRevision({
        organization_id: '', embarque_id: '1', regla: 'sin_tracking', detalle_hash: 'h',
        detalle: 'd', snoozed_until: '2099-01-01', snooze_motivo: 'x',
      } as any),
    ).rejects.toThrow(/organization_id/);
  });

  it('snoozeRevision propaga errores', async () => {
    mockSupabase.current = createSupabaseChainMock(null, { message: 'rls' });
    await expect(
      snoozeRevision({
        organization_id: 'org-1',
        embarque_id: '1', regla: 'sin_tracking', detalle_hash: 'h',
        detalle: 'd', snoozed_until: '2099-01-01', snooze_motivo: 'x',
      } as any),
    ).rejects.toMatchObject({ message: 'rls' });
  });

  it('clearSnoozeRevision limpia snoozed_until y snooze_motivo por id', async () => {
    mockSupabase.current = createSupabaseChainMock(null);
    await clearSnoozeRevision('r1');
    expect(mockSupabase.current.update).toHaveBeenCalledWith({
      snoozed_until: null,
      snooze_motivo: null,
    });
    expect(mockSupabase.current.eq).toHaveBeenCalledWith('id', 'r1');
  });

  it('clearSnoozeRevision propaga errores', async () => {
    mockSupabase.current = createSupabaseChainMock(null, { message: 'fail' });
    await expect(clearSnoozeRevision('r1')).rejects.toMatchObject({ message: 'fail' });
  });
});
