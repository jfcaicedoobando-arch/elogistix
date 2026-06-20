import { renderHook } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { useAdminOrgConfig } from "../useAdminOrgConfig";

vi.mock("@/features/configuracion/hooks/useConfiguracionOrg", () => ({
  useConfiguracionByOrg: vi.fn(() => ({
    data: [{ categoria: "general", clave: "test", valor: "val" }],
    isLoading: false,
  })),
}));

vi.mock("@/features/configuracion/domain/configuracion", () => ({
  agruparConfigPorCategoria: vi.fn(() => ({ general: [{ clave: "test", valor: "val" }] })),
}));

describe("useAdminOrgConfig", () => {
  it("groups configuration items by category", () => {
    const { result } = renderHook(() => useAdminOrgConfig("org-1"));
    
    expect(result.current.configItems).toHaveLength(1);
    expect(result.current.grouped).toHaveProperty("general");
  });

  it("handles loading state", () => {
    const { result } = renderHook(() => useAdminOrgConfig("org-1"));
    expect(result.current.loadingConfig).toBe(false);
  });
});
