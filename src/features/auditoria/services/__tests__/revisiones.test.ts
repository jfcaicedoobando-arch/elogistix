import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createSupabaseChainMock } from '@/test/utils/_supabaseChainMock';

const { mockSupabase } = vi.hoisted(() => ({ mockSupabase: { current: null as any } }));

vi.mock('@/integrations/supabase/client', () => ({
  get supabase() {
    return mockSupabase.current;
  },
}));

import {
  fetchAuditoriaRevisiones,
  upsertAuditoriaRevision,
  asignarResponsableHallazgo,
  deleteAuditoriaRevision,
} from '../revisiones';

describe('auditoria/revisiones', () => {
  beforeEach(() => vi.clearAllMocks());

  it('fetchAuditoriaRevisiones lista ordenado por created_at desc', async () => {
    const rows = [{ id: '1' }];
    mockSupabase.current = createSupabaseChainMock(rows);
    const result = await fetchAuditoriaRevisiones();
    expect(mockSupabase.current.from).toHaveBeenCalledWith('auditoria_revisiones');
    expect(mockSupabase.current.order).toHaveBeenCalledWith('created_at', { ascending: false });
    expect(result).toEqual(rows);
  });

  it('fetchAuditoriaRevisiones lanza ante error de Supabase', async () => {
    mockSupabase.current = createSupabaseChainMock(null, { message: 'boom' });
    await expect(fetchAuditoriaRevisiones()).rejects.toMatchObject({ message: 'boom' });
  });

  it('upsertAuditoriaRevision usa onConflict correcto y marca estado=revisado', async () => {
    const input = {
      organization_id: 'org-1',
      embarque_id: 'e1', regla: 'sin_tracking', detalle_hash: 'h',
      detalle: 'd', accion_tomada: 'a', revisado_por: 'u', revisado_por_email: 'u@e',
    } as any;
    const created = { id: '1', ...input };
    mockSupabase.current = createSupabaseChainMock(created);
    const result = await upsertAuditoriaRevision(input);
    expect(mockSupabase.current.upsert).toHaveBeenCalledTimes(1);
    const [payload, opts] = mockSupabase.current.upsert.mock.calls[0];
    expect(payload).toMatchObject({ ...input, estado_revision: 'revisado' });
    expect(payload.organization_id).toBe('org-1');
    expect(payload.updated_at).toEqual(expect.any(String));
    expect(opts).toEqual({ onConflict: 'organization_id,embarque_id,regla,detalle_hash' });
    expect(result).toEqual(created);
  });

  it('upsertAuditoriaRevision rechaza si falta organization_id', async () => {
    mockSupabase.current = createSupabaseChainMock({});
    await expect(
      upsertAuditoriaRevision({
        organization_id: '', embarque_id: 'e1', regla: 'sin_tracking', detalle_hash: 'h',
        detalle: 'd', accion_tomada: 'a', revisado_por: 'u', revisado_por_email: 'u@e',
      } as any),
    ).rejects.toThrow(/organization_id/);
  });

  // Ola 4 · N29: asignarResponsableHallazgo dejó de usar upsert (select-then-branch)
  // para que un hallazgo revisado nunca se reabra por reasignación.

  it('asignarResponsableHallazgo inserta con estado_revision default=pendiente cuando no existe revisión', async () => {
    const input = {
      organization_id: 'org-1',
      embarque_id: 'e1', regla: 'sin_tracking', detalle_hash: 'h', detalle: 'd',
      responsable_id: 'r1', responsable_email: 'r@e', asignado_por: 'u',
      asignado_por_email: 'u@e', fecha_limite: null,
    } as any;
    // data [] → maybeSingle null → rama INSERT.
    mockSupabase.current = createSupabaseChainMock([]);
    await asignarResponsableHallazgo(input);
    expect(mockSupabase.current.insert).toHaveBeenCalledTimes(1);
    expect(mockSupabase.current.upsert).not.toHaveBeenCalled();
    const [payload] = mockSupabase.current.insert.mock.calls[0];
    expect(payload.estado_revision).toBe('pendiente');
    expect(payload.responsable_id).toBe('r1');
    expect(payload.organization_id).toBe('org-1');
    expect(payload.asignado_at).toEqual(expect.any(String));
  });

  it('asignarResponsableHallazgo actualiza respetando estado_revision explícito si no está revisado', async () => {
    const input = {
      organization_id: 'org-1',
      embarque_id: 'e1', regla: 'sin_tracking', detalle_hash: 'h', detalle: 'd',
      responsable_id: 'r1', responsable_email: 'r@e', asignado_por: 'u',
      asignado_por_email: 'u@e', fecha_limite: null,
      estado_revision: 'en_progreso' as const,
    } as any;
    mockSupabase.current = createSupabaseChainMock({ id: '1', estado_revision: 'pendiente' });
    await asignarResponsableHallazgo(input);
    expect(mockSupabase.current.update).toHaveBeenCalledTimes(1);
    expect(mockSupabase.current.update.mock.calls[0][0].estado_revision).toBe('en_progreso');
  });

  it('asignarResponsableHallazgo NO reabre una revisión revisada (Ola 4 · N29)', async () => {
    const input = {
      organization_id: 'org-1',
      embarque_id: 'e1', regla: 'sin_tracking', detalle_hash: 'h', detalle: 'd',
      responsable_id: 'r2', responsable_email: 'nuevo@e', asignado_por: 'u',
      asignado_por_email: 'u@e', fecha_limite: null,
    } as any;
    mockSupabase.current = createSupabaseChainMock({ id: '1', estado_revision: 'revisado' });
    await asignarResponsableHallazgo(input);
    expect(mockSupabase.current.update).toHaveBeenCalledTimes(1);
    const [patch] = mockSupabase.current.update.mock.calls[0];
    expect(patch).not.toHaveProperty('estado_revision');
    expect(patch.responsable_id).toBe('r2');
  });

  it('deleteAuditoriaRevision borra por id', async () => {
    mockSupabase.current = createSupabaseChainMock(null);
    await deleteAuditoriaRevision('1');
    expect(mockSupabase.current.delete).toHaveBeenCalled();
    expect(mockSupabase.current.eq).toHaveBeenCalledWith('id', '1');
  });

  it('deleteAuditoriaRevision lanza ante error', async () => {
    mockSupabase.current = createSupabaseChainMock(null, { message: 'fk' });
    await expect(deleteAuditoriaRevision('1')).rejects.toMatchObject({ message: 'fk' });
  });
});
