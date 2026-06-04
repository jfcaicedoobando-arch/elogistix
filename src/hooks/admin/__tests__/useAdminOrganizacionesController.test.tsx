import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { useAdminOrganizacionesController } from "../useAdminOrganizacionesController";
import { createWrapper } from "@/test/utils/queryWrapper";

vi.mock("@/hooks/admin/useAdminData", () => ({
  useAdminOrganizations: vi.fn(() => ({
    data: [
      { id: "1", nombre: "Org Alpha", rfc: "RFC1", plan: "Premium", activo: true },
      { id: "2", nombre: "Org Beta", rfc: "RFC2", plan: "Basic", activo: false },
    ],
    isLoading: false,
  })),
  useCreateOrganization: vi.fn(() => ({
    mutate: vi.fn((data, callbacks) => callbacks.onSuccess()),
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

describe("useAdminOrganizacionesController", () => {
  it("filters organizations by search term", () => {
    const { result } = renderHook(() => useAdminOrganizacionesController(), { wrapper: createWrapper() });
    
    act(() => {
      result.current.setters.setSearch("Alpha");
    });
    
    expect(result.current.data.filtered).toHaveLength(1);
    expect(result.current.data.filtered[0].nombre).toBe("Org Alpha");
  });

  it("filters organizations by plan", () => {
    const { result } = renderHook(() => useAdminOrganizacionesController(), { wrapper: createWrapper() });
    
    act(() => {
      result.current.setters.setPlanFilter("Basic");
    });
    
    expect(result.current.data.filtered).toHaveLength(1);
    expect(result.current.data.filtered[0].plan).toBe("Basic");
  });

  it("handles organization creation", () => {
    const { result } = renderHook(() => useAdminOrganizacionesController(), { wrapper: createWrapper() });
    
    act(() => {
      result.current.setters.setNombre("New Org");
      result.current.setters.setRfc("NEW_RFC");
    });
    
    act(() => {
      result.current.createOrg.mutate();
    });
    
    expect(result.current.state.nombre).toBe("");
    expect(result.current.state.dialogOpen).toBe(false);
  });
});
