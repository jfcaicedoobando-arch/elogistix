import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createSupabaseMock } from '@/services/__tests__/_supabaseChainMock';

const { mockRef } = vi.hoisted(() => ({ mockRef: { current: null as ReturnType<typeof createSupabaseMock> | null } }));

vi.mock('@/integrations/supabase/client', () => ({
  get supabase() { return mockRef.current!.supabase; },
}));

import { fetchDashboardSummary, fetchDashboardDetails } from '../index';

describe('dashboard/index', () => {
  beforeEach(() => {
    mockRef.current = createSupabaseMock();
  });

  it('fetchDashboardSummary llama al RPC correcto', async () => {
    mockRef.current!.setRpcResult('dashboard_summary', { data: { kpis: {} }, error: null });
    const result = await fetchDashboardSummary();
    expect(mockRef.current!.rpcCalls[0]?.fn).toBe('dashboard_summary');
    expect(result).toEqual({ kpis: {} });
  });

  it('fetchDashboardDetails llama al RPC correcto', async () => {
    mockRef.current!.setRpcResult('dashboard_details', { data: { items: [] }, error: null });
    const result = await fetchDashboardDetails();
    expect(mockRef.current!.rpcCalls[0]?.fn).toBe('dashboard_details');
    expect(result).toEqual({ items: [] });
  });
});
