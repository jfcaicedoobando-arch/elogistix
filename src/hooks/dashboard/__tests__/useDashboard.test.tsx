import { vi, describe, it, expect } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { createWrapper } from '@/test/utils/queryWrapper';

const { mockFetchSummary, mockFetchDetails } = vi.hoisted(() => ({
  mockFetchSummary: vi.fn(),
  mockFetchDetails: vi.fn(),
}));

vi.mock('@/services/dashboard', () => ({
  fetchDashboardSummary: mockFetchSummary,
  fetchDashboardDetails: mockFetchDetails,
}));

import { useDashboardData } from '../useDashboardData';

describe('useDashboard Hooks', () => {
  it('useDashboardData fetches and combines data', async () => {
    mockFetchSummary.mockResolvedValueOnce({ totalActivos: 5, conteoPorEstado: {} });
    mockFetchDetails.mockResolvedValueOnce({ alertasDemora: [], proximosArribos: [] });
    
    const { result } = renderHook(() => useDashboardData(), { wrapper: createWrapper() });
    
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.totalActivos).toBe(5);
    expect(Array.isArray(result.current.alertasDemora)).toBe(true);
  });

  it('useDashboardData handles partial data', async () => {
    mockFetchSummary.mockResolvedValueOnce(null);
    mockFetchDetails.mockResolvedValueOnce({});
    
    const { result } = renderHook(() => useDashboardData(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.totalActivos).toBe(0);
  });

  it('useDashboardData re-calculates when details arrive', async () => {
    mockFetchSummary.mockResolvedValueOnce({ totalActivos: 10 });
    mockFetchDetails.mockResolvedValueOnce({ alertasDemora: [{ id: '1' }] });
    
    const { result } = renderHook(() => useDashboardData(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.alertasDemora.length).toBe(1));
  });
});
