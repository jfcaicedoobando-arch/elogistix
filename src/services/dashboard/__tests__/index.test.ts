import { describe, it, expect, vi } from 'vitest';
import { fetchDashboardSummary, fetchDashboardDetails } from '../index';

const { mockSupabase } = vi.hoisted(() => ({
  mockSupabase: {
    rpc: vi.fn(),
  },
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: mockSupabase,
}));

describe('dashboard/index', () => {
  it('fetchDashboardSummary llama al RPC correcto', async () => {
    mockSupabase.rpc.mockResolvedValue({ data: { kpis: {} }, error: null });
    const result = await fetchDashboardSummary();
    expect(mockSupabase.rpc).toHaveBeenCalledWith('dashboard_summary');
    expect(result).toEqual({ kpis: {} });
  });

  it('fetchDashboardDetails llama al RPC correcto', async () => {
    mockSupabase.rpc.mockResolvedValue({ data: { items: [] }, error: null });
    const result = await fetchDashboardDetails();
    expect(mockSupabase.rpc).toHaveBeenCalledWith('dashboard_details');
    expect(result).toEqual({ items: [] });
  });
});
