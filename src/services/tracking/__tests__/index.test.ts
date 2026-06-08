import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createTrackingLink, fetchTrackingPublico } from '../index';

const { mockSupabase } = vi.hoisted(() => ({
  mockSupabase: {
    from: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    single: vi.fn().mockReturnThis(),
  },
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: mockSupabase,
}));

describe('tracking/index', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('createTrackingLink inserta un nuevo link', async () => {
    const mockData = { id: '1', embarque_id: 'emb1' };
    mockSupabase.single.mockResolvedValue({ data: mockData, error: null });
    const result = await createTrackingLink({ embarqueId: 'emb1' });
    expect(mockSupabase.from).toHaveBeenCalledWith('tracking_links');
    expect(result).toEqual(mockData);
  });

  it('fetchTrackingPublico llama a fetch con el token', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ embarque: {} }),
    });
    const result = await fetchTrackingPublico('token123');
    expect(global.fetch).toHaveBeenCalled();
    expect(result).toEqual({ embarque: {} });
  });


  it('fetchTrackingPublico lanza error si el fetch retorna !ok', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ error: 'Token inválido' }),
    });
    await expect(fetchTrackingPublico('bad-token')).rejects.toThrow('Token inválido');
  });

  it('createTrackingLink propaga error de insert', async () => {
    mockSupabase.single.mockResolvedValue({ data: null, error: new Error('insert fail') });
    await expect(createTrackingLink({ embarqueId: 'emb1' })).rejects.toThrow('insert fail');
  });
});
