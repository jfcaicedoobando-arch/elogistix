import { describe, it, expect, vi, beforeEach } from 'vitest';
import { parseCsf } from '../index';
import { AUTH_ERROR_MESSAGES } from '@/constants/authMessages';

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
  beforeEach(() => {
    mockSupabase.auth.getSession.mockClear();
    mockSupabase.auth.getSession.mockResolvedValue({ data: { session: { access_token: 'tk' } } });
  });

  it('parseCsf lanza error si no hay sesion', async () => {
    mockSupabase.auth.getSession.mockResolvedValueOnce({ data: { session: null } });
    const file = new File([''], 'csf.pdf');
    await expect(parseCsf(file)).rejects.toThrow(AUTH_ERROR_MESSAGES.csfSessionRequired);
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
