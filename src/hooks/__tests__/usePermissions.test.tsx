import { describe, it, expect, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { usePermissions } from "@/hooks/shared";

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: vi.fn(),
}));

import { useAuth } from "@/contexts/AuthContext";
const mockUseAuth = vi.mocked(useAuth);

describe("usePermissions", () => {
  it("admin → canEdit true, isAdmin true", () => {
    mockUseAuth.mockReturnValue({ role: "admin", effectiveRole: "admin" } as Partial<ReturnType<typeof useAuth>> as ReturnType<typeof useAuth>);
    const { result } = renderHook(() => usePermissions());
    expect(result.current.canEdit).toBe(true);
    expect(result.current.isAdmin).toBe(true);
  });

  it("operador → canEdit true, isAdmin false", () => {
    mockUseAuth.mockReturnValue({ role: "operador", effectiveRole: "operador" } as Partial<ReturnType<typeof useAuth>> as ReturnType<typeof useAuth>);
    const { result } = renderHook(() => usePermissions());
    expect(result.current.canEdit).toBe(true);
    expect(result.current.isAdmin).toBe(false);
  });

  it("viewer → canEdit false, isAdmin false", () => {
    mockUseAuth.mockReturnValue({ role: "viewer", effectiveRole: "viewer" } as Partial<ReturnType<typeof useAuth>> as ReturnType<typeof useAuth>);
    const { result } = renderHook(() => usePermissions());
    expect(result.current.canEdit).toBe(false);
    expect(result.current.isAdmin).toBe(false);
  });

  it("gerente_operaciones → canCotizarSinDesglose true", () => {
    mockUseAuth.mockReturnValue({ role: "gerente_operaciones", effectiveRole: "gerente_operaciones" } as Partial<ReturnType<typeof useAuth>> as ReturnType<typeof useAuth>);
    const { result } = renderHook(() => usePermissions());
    expect(result.current.canCotizarSinDesglose).toBe(true);
  });

  it("vendedor → canCotizarSinDesglose false", () => {
    mockUseAuth.mockReturnValue({ role: "vendedor", effectiveRole: "vendedor" } as Partial<ReturnType<typeof useAuth>> as ReturnType<typeof useAuth>);
    const { result } = renderHook(() => usePermissions());
    expect(result.current.canCotizarSinDesglose).toBe(false);
  });
});
