import { describe, it, expect, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { usePermissions } from "@/hooks/usePermissions";

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: vi.fn(),
}));

import { useAuth } from "@/contexts/AuthContext";
const mockUseAuth = vi.mocked(useAuth);

describe("usePermissions", () => {
  it("admin → canEdit true, isAdmin true", () => {
    mockUseAuth.mockReturnValue({ role: "admin" } as any);
    const { result } = renderHook(() => usePermissions());
    expect(result.current.canEdit).toBe(true);
    expect(result.current.isAdmin).toBe(true);
  });

  it("operador → canEdit true, isAdmin false", () => {
    mockUseAuth.mockReturnValue({ role: "operador" } as any);
    const { result } = renderHook(() => usePermissions());
    expect(result.current.canEdit).toBe(true);
    expect(result.current.isAdmin).toBe(false);
  });

  it("viewer → canEdit false, isAdmin false", () => {
    mockUseAuth.mockReturnValue({ role: "viewer" } as any);
    const { result } = renderHook(() => usePermissions());
    expect(result.current.canEdit).toBe(false);
    expect(result.current.isAdmin).toBe(false);
  });
});
