import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mock } = vi.hoisted(() => {
  return { mock: { current: null as any } };
});

vi.mock('@/integrations/supabase/client', () => ({
  get supabase() { return mock.current.supabase; },
}));

import { createSupabaseMock } from '@/services/__tests__/_supabaseChainMock';
import { fetchEmisorEmpresa, invalidarEmisorCache } from '../emisor';

describe('configuracion/emisor', () => {
  beforeEach(() => {
    invalidarEmisorCache();
    mock.current = createSupabaseMock();
  });

  it('fetchEmisorInfo obtiene datos de la tabla configuracion', async () => {
    mock.current.setTableResult('configuracion', {
      data: [{ clave: 'nombre', valor: 'Test Org' }],
      error: null,
    });
    const result = await fetchEmisorEmpresa();
    expect(mock.current.tableCalls[0].table).toBe('configuracion');
    expect(mock.current.tableCalls[0].ops).toContain('eq');
    expect(result.razonSocial).toBe('Test Org');
  });

  it('fetchEmisorInfo usa fallback si no hay datos', async () => {
    mock.current.setTableResult('configuracion', { data: [], error: null });
    const result = await fetchEmisorEmpresa();
    expect(result.razonSocial).toBe('Empresa');
  });
});
