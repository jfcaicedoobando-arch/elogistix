import { vi, describe, it, expect } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { createWrapper } from '@/test/utils/queryWrapper';

const { mockFetch } = vi.hoisted(() => ({
  mockFetch: vi.fn(),
}));

vi.mock('@/services/dashboard-ejecutivo', () => ({
  fetchDashboardEjecutivo: mockFetch,
}));

vi.mock('@/contexts/OrganizationContext', () => ({
  useOrganization: () => ({ organizationId: 'org-1' }),
}));

import { useDashboardEjecutivo } from '../useDashboardEjecutivo';

describe('useDashboardEjecutivo Hook', () => {
  it('fetches data for given period', async () => {
    mockFetch.mockResolvedValueOnce({ snapshots: [] });
    const { result } = renderHook(() => useDashboardEjecutivo('mes'), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  it('is disabled if no period provided', () => {
    mockFetch.mockClear();
    renderHook(() => useDashboardEjecutivo(''), { wrapper: createWrapper() });
    expect(mockFetch).not.toHaveBeenCalled();
  });
});
