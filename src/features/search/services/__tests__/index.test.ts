import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createSupabaseMock } from '@/services/__tests__/_supabaseChainMock';

const { mockRef } = vi.hoisted(() => ({ mockRef: { current: null as ReturnType<typeof createSupabaseMock> | null } }));

vi.mock('@/integrations/supabase/client', () => ({
  get supabase() { return mockRef.current!.supabase; },
}));

import { buscarGlobal } from '../index';

describe('search/index', () => {
  beforeEach(() => {
    mockRef.current = createSupabaseMock();
  });

  it('buscarGlobal llama al RPC busqueda_global', async () => {
    mockRef.current!.setRpcResult('busqueda_global', { data: [{ id: '1', label: 'test' }], error: null });
    const result = await buscarGlobal('query');
    expect(mockRef.current!.rpcCalls[0]).toEqual({ fn: 'busqueda_global', args: { termino: 'query', limite: 5 } });
    expect(result).toEqual([{ id: '1', label: 'test' }]);
  });

  it('buscarGlobal retorna vacio si no hay termino', async () => {
    const result = await buscarGlobal('  ');
    expect(result).toEqual([]);
    expect(mockRef.current!.rpcCalls.length).toBe(0);
  });

  it('buscarGlobal devuelve [] en error de RPC y loggea', async () => {
    mockRef.current!.setRpcResult('busqueda_global', { data: null, error: new Error('RPC fail') });
    const result = await buscarGlobal('query');
    expect(result).toEqual([]);
  });
});
