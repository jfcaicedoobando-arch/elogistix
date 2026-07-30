import { vi, describe, it, expect, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { createWrapper } from '@/test/utils/queryWrapper';

const { mockFetch, mockUpdate, mockDelete } = vi.hoisted(() => ({
  mockFetch: vi.fn(),
  mockUpdate: vi.fn(),
  mockDelete: vi.fn(),
}));

vi.mock('@/features/admin/services/usuario', () => ({
  fetchUsuariosOrganizacion: mockFetch,
  updateUserRole: mockUpdate,
  deleteUserViaEdgeFunction: mockDelete,
}));

import { useUsuarios, useUpdateUserRole, useDeleteUser } from '../useUsuarios';

describe('useUsuario Hooks', () => {
  beforeEach(() => {
    mockFetch.mockReset();
    mockUpdate.mockReset();
    mockDelete.mockReset();
  });


  it('useUsuarios fetches list', async () => {
    mockFetch.mockResolvedValueOnce([{ id: 'u1', email: 'test@test.com' }]);
    const { result } = renderHook(() => useUsuarios(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toHaveLength(1);
  });

  it('useUpdateUserRole calls service', async () => {
    mockUpdate.mockResolvedValueOnce({ success: true });
    const { result } = renderHook(() => useUpdateUserRole(), { wrapper: createWrapper() });
    await result.current.mutateAsync({ userId: 'u1', newRole: 'admin' });
    // U-02: el update se acota a la organización del caller (null = super_admin).
    expect(mockUpdate).toHaveBeenCalledWith('u1', 'admin', undefined);
  });

  it('useDeleteUser calls service', async () => {
    mockDelete.mockResolvedValueOnce({ success: true });
    const { result } = renderHook(() => useDeleteUser(), { wrapper: createWrapper() });
    await result.current.mutateAsync('u1');
    expect(mockDelete).toHaveBeenCalledWith('u1');
  });
});
