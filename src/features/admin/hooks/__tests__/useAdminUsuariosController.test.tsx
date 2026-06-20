import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { useAdminUsuariosController } from "../useAdminUsuariosController";
import { createWrapper } from "@/test/utils/queryWrapper";

vi.mock("@/features/admin/hooks/useAdminData", () => ({
  useAdminGlobalUsers: vi.fn(() => ({
    data: [
      { user_id: "1", email: "user1@test.com", org_nombre: "Org A", role: "admin" },
      { user_id: "2", email: "user2@test.com", org_nombre: "Org B", role: "user" },
    ],
    isLoading: false,
    refetch: vi.fn(),
  })),
}));

vi.mock("@/features/admin/hooks/usuario", () => ({
  useDeleteUserAuth: vi.fn(() => ({
    mutate: vi.fn((_id: any, callbacks: any) => callbacks.onSuccess()),
    isPending: false,
  })),
}));

vi.mock("@/hooks/shared", () => ({
  useToast: vi.fn(() => ({ toast: vi.fn() })),
}));

vi.mock("@/components/shared/utils/appFeedback", () => ({
  notifySuccess: vi.fn(),
  notifyError: vi.fn(),
}));

describe("useAdminUsuariosController", () => {
  it("filters users by search term", () => {
    const { result } = renderHook(() => useAdminUsuariosController(), { wrapper: createWrapper() });
    
    act(() => {
      result.current.setters.setSearch("user1");
    });
    
    expect(result.current.data.filtered).toHaveLength(1);
    expect(result.current.data.filtered[0].email).toBe("user1@test.com");
  });

  it("filters users by organization", () => {
    const { result } = renderHook(() => useAdminUsuariosController(), { wrapper: createWrapper() });
    
    act(() => {
      result.current.setters.setOrgFilter("Org B");
    });
    
    expect(result.current.data.filtered).toHaveLength(1);
    expect(result.current.data.filtered[0].org_nombre).toBe("Org B");
  });

  it("handles user deletion successfully", () => {
    const { result } = renderHook(() => useAdminUsuariosController(), { wrapper: createWrapper() });
    
    act(() => {
      result.current.setters.setDeleteTarget({ user_id: "1", email: "user1@test.com", org_nombre: "Org A", role: "admin" });
    });
    
    act(() => {
      result.current.actions.handleDelete();
    });
    
    expect(result.current.state.deleteTarget).toBeNull();
  });
});
