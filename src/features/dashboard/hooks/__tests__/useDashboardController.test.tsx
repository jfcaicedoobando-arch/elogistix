/**
 * v13.303.13 · Regresión: en scope "mios", el chip EIR debe contar los embarques
 * EIR asignados al operador. Antes del fix, el conteo se recalculaba sólo desde
 * las listas de `activos` (que excluyen EIR) y siempre daba 0.
 */
import { describe, it, expect, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { createWrapper } from "@/test/utils/queryWrapper";

vi.mock("@/lib/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { email: "valeria@example.com" } }),
}));

vi.mock("@/hooks/shared", () => ({
  usePermissions: () => ({
    isOperador: true,
    canViewFinancials: false,
    role: "coordinador_logistico",
  }),
}));

const { mockUseData } = vi.hoisted(() => ({ mockUseData: vi.fn() }));
vi.mock("@/features/dashboard/hooks", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/features/dashboard/hooks")>();
  return { ...actual, useDashboardData: mockUseData };
});

import { useDashboardController } from "../useDashboardController";

const baseData = {
  isLoading: false,
  activos: [],
  conteoPorEstado: {
    "Cotización": 0, Confirmado: 0, "En Tránsito": 0, "En Proceso": 0,
    "En Aduana": 0, Llegada: 0, Arribo: 0, Entregado: 0, EIR: 0,
  },
  totalActivos: 0,
  alertasDemora: [],
  proximosArribos: [],
  profitArribosEsteMes: [],
  embarquesMesSiguiente: [],
  embarquesEir: [
    { id: "e1", operador: "valeria@example.com", estadoReal: "EIR" as const },
    { id: "e2", operador: "VALERIA@example.com", estadoReal: "EIR" as const },
    { id: "e2", operador: "valeria@example.com", estadoReal: "EIR" as const }, // dup
    { id: "e3", operador: "otro@example.com", estadoReal: "EIR" as const },
  ],
  arribosEsteMes: { total: 0, yaLlegaron: 0, enCamino: 0 },
  resumenMesSiguiente: { totalEmbarques: 0, facturados: 0 },
  cargasPorCliente: [],
  cargasActivasTotal: 0,
};

describe("useDashboardController · EIR en scope mios", () => {
  it("cuenta los EIR del operador (case-insensitive, dedupe por id)", () => {
    mockUseData.mockReturnValue(baseData);
    const { result } = renderHook(() => useDashboardController(), { wrapper: createWrapper() });
    expect(result.current.scope).toBe("mios");
    expect(result.current.scoped.conteoPorEstado.EIR).toBe(2);
    expect(result.current.scoped.totalActivos).toBe(0);
  });

  it("no altera el conteo cuando se cambia a scope todos (viene del RPC summary)", () => {
    mockUseData.mockReturnValue({
      ...baseData,
      conteoPorEstado: { ...baseData.conteoPorEstado, EIR: 20 },
    });
    const { result } = renderHook(() => useDashboardController(), { wrapper: createWrapper() });
    act(() => result.current.setScope("todos"));
    expect(result.current.scoped.conteoPorEstado.EIR).toBe(20);
  });
});
