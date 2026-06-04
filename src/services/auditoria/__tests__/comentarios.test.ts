import { describe, it, expect, vi } from 'vitest';
import { fetchComentariosAuditoria, createComentarioAuditoria, deleteComentarioAuditoria } from '../comentarios';

const { mockSupabase } = vi.hoisted(() => {
  const chain = {
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    single: vi.fn().mockReturnThis(),
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

describe('auditoria/comentarios', () => {
  it('fetchComentariosAuditoria obtiene comentarios', async () => {
    const mockData = [{ id: '1' }];
    (mockSupabase as any)._data = mockData;
    const result = await fetchComentariosAuditoria('emb1');
    expect(mockSupabase.from).toHaveBeenCalledWith('auditoria_comentarios');
    expect(mockSupabase.eq).toHaveBeenCalledWith('embarque_id', 'emb1');
    expect(result).toEqual(mockData);
  });

  it('createComentarioAuditoria inserta comentario', async () => {
    const input = { embarque_id: '1', texto: 'test', autor: 'user', autor_email: 'u@e' };
    mockSupabase.single.mockResolvedValue({ data: input, error: null });
    await createComentarioAuditoria(input);
    expect(mockSupabase.insert).toHaveBeenCalled();
  });

  it('deleteComentarioAuditoria elimina comentario', async () => {
    (mockSupabase as any)._error = null;
    await deleteComentarioAuditoria('1');
    expect(mockSupabase.delete).toHaveBeenCalled();
  });
});
