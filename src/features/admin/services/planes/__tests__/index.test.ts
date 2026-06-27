import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mock } = vi.hoisted(() => ({ mock: { current: null as unknown as ReturnType<typeof import('@/services/__tests__/_supabaseChainMock').createSupabaseMock> } }));

vi.mock('@/integrations/supabase/client', () => ({
  get supabase() { return mock.current.supabase; },
}));

import { createSupabaseMock } from '@/services/__tests__/_supabaseChainMock';
import { fetchPlanes } from '../index';

describe('planes/index', () => {
  beforeEach(() => {
    mock.current = createSupabaseMock();
  });

  it('fetchPlanes obtiene lista de planes', async () => {
    mock.current.setTableResult('planes', {
      data: [{ id: '1', nombre: 'Pro' }],
      error: null,
    });
    const result = await fetchPlanes();
    expect(mock.current.tableCalls[0].table).toBe('planes');
    expect(result[0].nombre).toBe('Pro');
  });

  it('fetchPlanes retorna array vacio si no hay datos', async () => {
    mock.current.setTableResult('planes', { data: null, error: null });
    const result = await fetchPlanes();
    expect(result).toEqual([]);
  });
});
