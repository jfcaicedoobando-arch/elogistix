import { describe, it, expect, vi } from 'vitest';
import { parseCsf } from '../index';

const { mockSupabase } = vi.hoisted(() => ({
  mockSupabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: { access_token: 'tk' } } }),
    },
  },
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: mockSupabase,
}));

describe('csf/index', () => {
  it('parseCsf lanza error si no hay sesion', async () => {
    mockSupabase.auth.getSession.mockResolvedValueOnce({ data: { session: null } });
    const file = new File([''], 'csf.pdf');
    await expect(parseCsf(file)).rejects.toThrow('Debes iniciar sesión para procesar la Constancia de Situación Fiscal');
  });

  it('parseCsf llama a fetch con FormData', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ rfc: 'RFC123' }),
    });
    const file = new File([''], 'csf.pdf');
    const result = await parseCsf(file);
    expect(global.fetch).toHaveBeenCalled();
    expect(result.rfc).toBe('RFC123');
  });
});
