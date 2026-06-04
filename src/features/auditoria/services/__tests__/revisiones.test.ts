import { describe, it, expect, vi } from 'vitest';
import { fetchAuditoriaRevisiones, upsertAuditoriaRevision, asignarResponsableHallazgo, deleteAuditoriaRevision } from '../revisiones';

const { mockSupabase } = vi.hoisted(() => {
  const chain = {
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    upsert: vi.fn().mockReturnThis(),
    single: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
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

describe('auditoria/revisiones', () => {
  it('fetchAuditoriaRevisiones obtiene revisiones ordenadas', async () => {
    const mockData = [{ id: '1' }];
    (mockSupabase as any)._data = mockData;
    const result = await fetchAuditoriaRevisiones();
    expect(mockSupabase.from).toHaveBeenCalledWith('auditoria_revisiones');
    expect(mockSupabase.order).toHaveBeenCalledWith('created_at', { ascending: false });
    expect(result).toEqual(mockData);
  });

  it('upsertAuditoriaRevision crea o actualiza revisión', async () => {
    const input = { embarque_id: '1', regla: 'regla1', detalle_hash: 'hash', detalle: 'det', accion_tomada: 'acc', revisado_por: 'user', revisado_por_email: 'email' };
    const mockData = { id: '1', ...input };
    mockSupabase.single.mockResolvedValue({ data: mockData, error: null });
    const result = await upsertAuditoriaRevision(input as any);
    expect(mockSupabase.upsert).toHaveBeenCalled();
    expect(result).toEqual(mockData);
  });

  it('asignarResponsableHallazgo asigna responsable', async () => {
    const input = { embarque_id: '1', regla: 'regla1', detalle_hash: 'hash', detalle: 'det', responsable_id: 'res', responsable_email: 'res@email', asignado_por: 'user', asignado_por_email: 'u@e', fecha_limite: null };
    mockSupabase.single.mockResolvedValue({ data: input, error: null });
    await asignarResponsableHallazgo(input as any);
    expect(mockSupabase.upsert).toHaveBeenCalled();
  });

  it('deleteAuditoriaRevision elimina revisión', async () => {
    (mockSupabase as any)._error = null;
    await deleteAuditoriaRevision('1');
    expect(mockSupabase.delete).toHaveBeenCalled();
    expect(mockSupabase.eq).toHaveBeenCalledWith('id', '1');
  });
});
