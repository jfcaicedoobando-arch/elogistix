import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
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

  afterEach(() => {
    // Restaura fetch global parcheado en el test "llama a fetch con FormData"
    // (auditoría 13.137.28 - CRÍTICA: asignación directa a global.fetch filtraba
    // entre archivos del shard bajo singleFork).
    vi.unstubAllGlobals();
  });

  it('parseCsf lanza error si no hay sesion', async () => {
    mockSupabase.auth.getSession.mockResolvedValueOnce({ data: { session: null } });
    const file = new File([''], 'csf.pdf');
    await expect(parseCsf(file)).rejects.toThrow(AUTH_ERROR_MESSAGES.csfSessionRequired);
  });

  it('parseCsf llama a fetch con FormData', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ rfc: 'RFC123' }),
    });
    vi.stubGlobal('fetch', fetchMock);
    const file = new File([''], 'csf.pdf');
    const result = await parseCsf(file);
    expect(fetchMock).toHaveBeenCalled();
    expect(result.rfc).toBe('RFC123');
  });
});
