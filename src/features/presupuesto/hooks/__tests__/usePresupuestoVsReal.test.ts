import { describe, it, expect, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { createWrapper } from "@/test/utils/queryWrapper";

vi.mock("@/hooks/shared", async () => {
  const actual = await vi.importActual<typeof import("@/hooks/shared")>("@/hooks/shared");
  return { ...actual, useOrgFilter: () => ({ organizationId: "org-test" }) };
});

vi.mock("@/features/presupuesto/services", () => ({
  fetchPresupuestoVsReal: vi.fn(async (periodo: string) => ({
    periodo,
    filas: [],
    total_presupuesto_mxn: 0,
    total_real_mxn: 0,
    variacion_neta_mxn: 0,
    categorias_en_exceso: 0,
    top_exceso: [],
  })),
}));

import { usePresupuestoVsReal } from "../usePresupuestoVsReal";

describe("usePresupuestoVsReal", () => {
  it("se mantiene deshabilitado sin periodo", () => {
    const { result } = renderHook(() => usePresupuestoVsReal(""), { wrapper: createWrapper() });
    expect(result.current.isFetching).toBe(false);
    expect(result.current.data).toBeUndefined();
  });

  it("ejecuta query y devuelve shape esperado con periodo válido", async () => {
    const { result } = renderHook(() => usePresupuestoVsReal("2026-06"), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toMatchObject({
      periodo: "2026-06",
      filas: [],
      total_presupuesto_mxn: 0,
      total_real_mxn: 0,
      variacion_neta_mxn: 0,
    });
  });
});
