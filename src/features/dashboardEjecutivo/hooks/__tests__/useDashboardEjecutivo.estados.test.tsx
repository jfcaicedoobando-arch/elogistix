/**
 * Estados compuestos del Dashboard Ejecutivo.
 *
 * El snapshot depende de CxC/CxP. En React Query v5 una query deshabilitada
 * queda `pending` sin error ni carga: si una dependencia fallaba, la pantalla
 * quedaba en blanco para siempre. Estas pruebas fijan el contrato:
 * exactamente una rama loading/error/data.
 */
import { vi, describe, it, expect, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { createWrapper } from "@/test/utils/queryWrapper";

const { mockFetch, mockCobranza, mockCxp, refetchCobranza, refetchCxp } = vi.hoisted(() => ({
  mockFetch: vi.fn(),
  mockCobranza: vi.fn(),
  mockCxp: vi.fn(),
  refetchCobranza: vi.fn(),
  refetchCxp: vi.fn(),
}));

vi.mock("@/features/dashboardEjecutivo/services", () => ({ fetchDashboardEjecutivo: mockFetch }));
vi.mock("@/lib/contexts/OrganizationContext", () => ({
  useOrganization: () => ({ organizationId: "org-1" }),
}));
vi.mock("@/features/facturacion/hooks", () => ({ useCobranza: mockCobranza }));
vi.mock("@/features/cxp/hooks", () => ({ useFacturasCxP: mockCxp }));

import { useDashboardEjecutivo } from "../useDashboardEjecutivo";

function dep(over: Record<string, unknown> = {}) {
  return { data: [], isLoading: false, isFetching: false, error: null, refetch: vi.fn(), ...over };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockCobranza.mockReturnValue(dep({ refetch: refetchCobranza }));
  mockCxp.mockReturnValue(dep({ refetch: refetchCxp }));
});

describe("useDashboardEjecutivo — máquina de estados", () => {
  it("CxC pending: isLoading true, sin error", () => {
    mockCobranza.mockReturnValue(dep({ data: undefined, isLoading: true }));
    const { result } = renderHook(() => useDashboardEjecutivo("2026-09"), { wrapper: createWrapper() });
    expect(result.current.isLoading).toBe(true);
    expect(result.current.error).toBeNull();
    expect(result.current.data).toBeUndefined();
  });

  it("CxP pending: isLoading true", () => {
    mockCxp.mockReturnValue(dep({ data: undefined, isLoading: true }));
    const { result } = renderHook(() => useDashboardEjecutivo("2026-09"), { wrapper: createWrapper() });
    expect(result.current.isLoading).toBe(true);
  });

  it("CxC error: propaga error y NO queda en loading (evita pantalla en blanco)", () => {
    const boom = new Error("CxC caída");
    mockCobranza.mockReturnValue(dep({ data: undefined, error: boom, refetch: refetchCobranza }));
    const { result } = renderHook(() => useDashboardEjecutivo("2026-09"), { wrapper: createWrapper() });
    expect(result.current.error).toBe(boom);
    expect(result.current.isError).toBe(true);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.data).toBeUndefined();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("CxP error: propaga error de forma independiente", () => {
    const boom = new Error("CxP caída");
    mockCxp.mockReturnValue(dep({ data: undefined, error: boom, refetch: refetchCxp }));
    const { result } = renderHook(() => useDashboardEjecutivo("2026-09"), { wrapper: createWrapper() });
    expect(result.current.error).toBe(boom);
    expect(result.current.isLoading).toBe(false);
  });

  it("retry reintenta la dependencia fallida además del snapshot", () => {
    mockCxp.mockReturnValue(dep({ data: undefined, error: new Error("x"), refetch: refetchCxp }));
    const { result } = renderHook(() => useDashboardEjecutivo("2026-09"), { wrapper: createWrapper() });
    void result.current.refetch();
    expect(refetchCxp).toHaveBeenCalledTimes(1);
    expect(refetchCobranza).not.toHaveBeenCalled();
  });

  it("dependencias resueltas: habilita el snapshot y entrega data", async () => {
    mockFetch.mockResolvedValueOnce({ periodo: "2026-09" });
    const { result } = renderHook(() => useDashboardEjecutivo("2026-09"), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual({ periodo: "2026-09" });
    expect(result.current.error).toBeNull();
  });
});
