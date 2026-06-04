import { describe, it, expect, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { createWrapper } from "@/test/utils/queryWrapper";

vi.mock("@/hooks/shared", async () => {
  const actual = await vi.importActual<typeof import("@/hooks/shared")>("@/hooks/shared");
  return {
    ...actual,
    useOrgFilter: () => ({ organizationId: "org-1" }),
    toast: vi.fn(),
  };
});

vi.mock("@/services/proforma", () => ({
  fetchProformasEmbarque: vi.fn().mockResolvedValue([]),
  fetchProformasAprobadas: vi.fn().mockResolvedValue([]),
  fetchProformasPendientes: vi.fn().mockResolvedValue([]),
  crearProforma: vi.fn().mockResolvedValue({ id: "prof-1", numero: "P-1", embarque_id: "e-1" }),
  aprobarProformas: vi.fn().mockResolvedValue(undefined),
  consolidarProformas: vi.fn().mockResolvedValue({ id: "prof-2", numero: "P-2", embarque_id: "e-1" }),
  eliminarProforma: vi.fn().mockResolvedValue(undefined),
  marcarProformaFacturada: vi.fn().mockResolvedValue(undefined),
}));

import { useProformas, useCrearProforma } from "../useProformas";

const wrapper = createWrapper();

describe("useProformas", () => {
  it("useProformas retorna el query", () => {
    const { result } = renderHook(() => useProformas(), { wrapper });
    expect(result.current).toBeDefined();
    expect(typeof result.current.refetch).toBe("function");
  });

  it("useCrearProforma retorna la mutación", () => {
    const { result } = renderHook(() => useCrearProforma(), { wrapper });
    expect(result.current.mutate).toBeDefined();
  });
});
