import { describe, it, expect, vi } from 'vitest';
import { fetchComentariosByRevision, insertComentario } from '../comentarios';

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
    const result = await fetchComentariosByRevision('emb1');
    expect(mockSupabase.from).toHaveBeenCalledWith('auditoria_comentarios');
    expect(mockSupabase.eq).toHaveBeenCalledWith('revision_id', 'emb1');
    expect(result).toEqual(mockData);
  });

  it('insertComentario inserta comentario', async () => {
    const input = { revision_id: '1', autor_id: 'user', autor_email: 'u@e', contenido: 'test' };
    mockSupabase.single.mockResolvedValue({ data: input, error: null });
    await insertComentario(input);
    expect(mockSupabase.insert).toHaveBeenCalled();
  });


});
