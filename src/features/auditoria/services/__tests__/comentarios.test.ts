import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createSupabaseChainMock } from '@/test/utils/_supabaseChainMock';

const { mockSupabase } = vi.hoisted(() => ({ mockSupabase: { current: null as unknown as ReturnType<typeof createSupabaseChainMock>["supabase"] } }));

vi.mock('@/integrations/supabase/client', () => ({
  get supabase() {
    return mockSupabase.current;
  },
}));

import { fetchComentariosByRevision, insertComentario } from '../comentarios';

describe('auditoria/comentarios', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetchComentariosByRevision obtiene comentarios ordenados', async () => {
    const rows = [{ id: '1', revision_id: 'rev1', contenido: 'hola' }];
    mockSupabase.current = createSupabaseChainMock(rows);
    const result = await fetchComentariosByRevision('rev1');
    expect(mockSupabase.current.from).toHaveBeenCalledWith('auditoria_comentarios');
    expect(mockSupabase.current.eq).toHaveBeenCalledWith('revision_id', 'rev1');
    expect(mockSupabase.current.order).toHaveBeenCalledWith('created_at', { ascending: true });
    expect(result).toEqual(rows);
  });

  it('fetchComentariosByRevision lanza si Supabase devuelve error', async () => {
    mockSupabase.current = createSupabaseChainMock(null, { message: 'rls' });
    await expect(fetchComentariosByRevision('rev1')).rejects.toMatchObject({ message: 'rls' });
  });

  it('insertComentario inserta y devuelve la fila creada', async () => {
    const input = { revision_id: '1', autor_id: 'u', autor_email: 'u@e', contenido: 'test' };
    const created = { id: 'c1', ...input };
    mockSupabase.current = createSupabaseChainMock(created);
    const result = await insertComentario(input);
    expect(mockSupabase.current.from).toHaveBeenCalledWith('auditoria_comentarios');
    expect(mockSupabase.current.insert).toHaveBeenCalledWith(input);
    expect(result).toEqual(created);
  });

  it('insertComentario propaga errores de la BD', async () => {
    mockSupabase.current = createSupabaseChainMock(null, { message: 'duplicate' });
    await expect(
      insertComentario({ revision_id: '1', autor_id: 'u', autor_email: 'e', contenido: 'x' }),
    ).rejects.toMatchObject({ message: 'duplicate' });
  });
});
