import { vi, describe, it, expect } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { createWrapper } from '@/test/utils/queryWrapper';

const { mockFetchFlujo } = vi.hoisted(() => ({
  mockFetchFlujo: vi.fn(),
}));

vi.mock('@/services/tesoreria', () => ({
  fetchFlujoProyectado: mockFetchFlujo,
}));

import { useFlujoProyectado } from '../useFlujoProyectado';

describe('useTesoreria Hooks', () => {
  it('useFlujoProyectado fetches projection data', async () => {
    mockFetchFlujo.mockResolvedValueOnce([{ fecha: '2023-01-01', balance: 1000 }]);
    const { result } = renderHook(() => useFlujoProyectado(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toHaveLength(1);
  });

  it('useFlujoProyectado handles loading state', async () => {
    mockFetchFlujo.mockReturnValue(new Promise(() => {})); // pending
    const { result } = renderHook(() => useFlujoProyectado(), { wrapper: createWrapper() });
    expect(result.current.isLoading).toBe(true);
  });
});
