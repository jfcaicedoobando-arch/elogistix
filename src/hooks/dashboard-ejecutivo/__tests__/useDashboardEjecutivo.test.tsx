import { vi, describe, it, expect } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { createWrapper } from '@/test/utils/queryWrapper';

const { mockFetch, mockCobranza, mockCxp } = vi.hoisted(() => ({
  mockFetch: vi.fn(),
  mockCobranza: vi.fn(() => ({ data: [], isLoading: false, error: null })),
  mockCxp: vi.fn(() => ({ data: [], isLoading: false, error: null })),
}));

vi.mock('@/services/dashboard-ejecutivo', () => ({
  fetchDashboardEjecutivo: mockFetch,
}));

vi.mock('@/contexts/OrganizationContext', () => ({
  useOrganization: () => ({ organizationId: 'org-1' }),
}));

vi.mock('@/hooks/facturacion', () => ({ useCobranza: mockCobranza }));
vi.mock('@/hooks/cxp', () => ({ useFacturasCxP: mockCxp }));

import { useDashboardEjecutivo } from '../useDashboardEjecutivo';

describe('useDashboardEjecutivo Hook', () => {
  it('fetches data for given period', async () => {
    mockFetch.mockResolvedValueOnce({ snapshots: [] });
    const { result } = renderHook(() => useDashboardEjecutivo('mes'), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockFetch).toHaveBeenCalledWith(
      expect.objectContaining({ organizationId: 'org-1', periodo: 'mes' }),
    );
  });

  it('is disabled if no period provided', () => {
    mockFetch.mockClear();
    renderHook(() => useDashboardEjecutivo(''), { wrapper: createWrapper() });
    expect(mockFetch).not.toHaveBeenCalled();
  });
});
