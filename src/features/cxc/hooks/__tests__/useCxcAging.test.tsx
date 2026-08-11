/**
 * Tests de `useCxcAging`: filtrado por moneda activa, totales por moneda,
 * organización activa en la queryKey/servicio y estado de error.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

const fetchCxcAging = vi.fn<(...args: unknown[]) => Promise<unknown>>(async () => []);
vi.mock("@/features/cxc/services/cxcAging", async () => {
  const actual = await vi.importActual<typeof import("@/features/cxc/services/cxcAging")>(
    "@/features/cxc/services/cxcAging",
  );
  return {
    ...actual,
    fetchCxcAging: (...a: unknown[]) => fetchCxcAging(...(a as [])),
  };
});

let orgActiva: string | null = "org-a";
vi.mock("@/hooks/shared/useOrgFilter", () => ({
  useOrgFilter: () => ({ organizationId: orgActiva }),
}));

const { useCxcAging } = await import("@/features/cxc/hooks/useCxcAging");

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

function fila(overrides: Record<string, unknown> = {}) {
  return {
    cliente_id: "c1",
    cliente_nombre: "Cliente",
    moneda: "MXN",
    saldo_total: 100,
    vigente: 100,
    d_1_30: 0,
    d_31_60: 0,
    d_61_90: 0,
    mas_90: 0,
    num_facturas: 1,
    ...overrides,
  };
}

describe("useCxcAging", () => {
  beforeEach(() => {
    fetchCxcAging.mockClear();
    orgActiva = "org-a";
  });

  it("pasa la fecha y la organización activa al servicio", async () => {
    fetchCxcAging.mockResolvedValueOnce([]);
    renderHook(() => useCxcAging("2026-08-09"), { wrapper });
    await waitFor(() => expect(fetchCxcAging).toHaveBeenCalled());
    expect(fetchCxcAging).toHaveBeenCalledWith("2026-08-09", "org-a");
  });

  it("por defecto filtra por MXN y calcula sus totales", async () => {
    fetchCxcAging.mockResolvedValueOnce([
      fila({ cliente_id: "c1", moneda: "MXN", saldo_total: 100, vigente: 100 }),
      fila({ cliente_id: "c2", moneda: "USD", saldo_total: 50, vigente: 50 }),
    ]);
    const { result } = renderHook(() => useCxcAging("2026-08-09"), { wrapper });
    await waitFor(() => expect(result.current.data).toHaveLength(2));

    expect(result.current.monedaActiva).toBe("MXN");
    expect(result.current.rowsFiltradas).toHaveLength(1);
    expect(result.current.rowsFiltradas[0].cliente_id).toBe("c1");
    expect(result.current.totales.total).toBe(100);
    expect(result.current.monedas.sort()).toEqual(["MXN", "USD"]);
    expect(result.current.totalesPorMoneda.USD.total).toBe(50);
  });

  it("cuando no hay filas en MXN, cae a la primera moneda disponible", async () => {
    fetchCxcAging.mockResolvedValueOnce([fila({ moneda: "EUR", saldo_total: 30, vigente: 30 })]);
    const { result } = renderHook(() => useCxcAging("2026-08-09"), { wrapper });
    await waitFor(() => expect(result.current.data).toHaveLength(1));
    expect(result.current.monedaActiva).toBe("EUR");
    expect(result.current.rowsFiltradas).toHaveLength(1);
  });

  it("permite cambiar la moneda activa manualmente", async () => {
    fetchCxcAging.mockResolvedValueOnce([
      fila({ cliente_id: "c1", moneda: "MXN" }),
      fila({ cliente_id: "c2", moneda: "USD", saldo_total: 999, vigente: 999 }),
    ]);
    const { result } = renderHook(() => useCxcAging("2026-08-09"), { wrapper });
    await waitFor(() => expect(result.current.data).toHaveLength(2));

    act(() => result.current.setMoneda("USD"));

    await waitFor(() => expect(result.current.monedaActiva).toBe("USD"));
    expect(result.current.rowsFiltradas[0].cliente_id).toBe("c2");
    expect(result.current.totales.total).toBe(999);
  });

  it("expone isError y error cuando el servicio rechaza (ej. error de Supabase)", async () => {
    const boom = new Error("rpc caída");
    fetchCxcAging.mockRejectedValueOnce(boom);
    const { result } = renderHook(() => useCxcAging("2026-08-09"), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBe(boom);
    expect(result.current.data).toBeUndefined();
    expect(result.current.rowsFiltradas).toEqual([]);
  });
});
