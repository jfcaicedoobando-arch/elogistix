/**
 * Tests de `useAnticiposDisponiblesPorEmbarque`: filtra por embarque y suma
 * el disponible por moneda para el aviso de cruce en la captura CxP.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { createWrapper } from "@/test/utils/queryWrapper";

const EMB_A = "11111111-1111-4111-8111-111111111111";
const EMB_B = "22222222-2222-4222-8222-222222222222";

const fetchAnticiposDisponibles = vi.fn<(...args: unknown[]) => Promise<unknown[]>>(
  async () => [],
);
vi.mock("@/features/anticipos-proveedor/services/anticiposProveedorService", () => ({
  fetchAnticiposDisponibles: (...a: unknown[]) => fetchAnticiposDisponibles(...(a as [])),
}));

const { useAnticiposDisponiblesPorEmbarque } = await import(
  "@/features/anticipos-proveedor/hooks/useAnticiposDisponiblesPorEmbarque"
);

function anticipo(overrides: Record<string, unknown> = {}) {
  return {
    id: "a1",
    monto: 1000,
    saldo_disponible: 400,
    moneda: "USD",
    estado: "aplicado_parcial",
    proveedor_id: "p1",
    embarque_id: EMB_A,
    fecha_anticipo: "2026-08-01",
    ...overrides,
  };
}

describe("useAnticiposDisponiblesPorEmbarque", () => {
  beforeEach(() => fetchAnticiposDisponibles.mockClear());

  it("devuelve sólo los anticipos del embarque indicado", async () => {
    fetchAnticiposDisponibles.mockResolvedValueOnce([
      anticipo({ id: "a1" }),
      anticipo({ id: "a2", embarque_id: EMB_B }),
      anticipo({ id: "a3", embarque_id: null }),
    ]);
    const { result } = renderHook(() => useAnticiposDisponiblesPorEmbarque("p1", EMB_A), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.anticipos).toHaveLength(1));
    expect(result.current.anticipos[0].id).toBe("a1");
    expect(result.current.porMoneda).toEqual([{ moneda: "USD", disponible: 400 }]);
  });

  it("sin embarque no devuelve nada (el aviso no aplica)", async () => {
    fetchAnticiposDisponibles.mockResolvedValueOnce([anticipo()]);
    const { result } = renderHook(() => useAnticiposDisponiblesPorEmbarque("p1", null), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.anticipos).toHaveLength(0);
    expect(result.current.porMoneda).toHaveLength(0);
  });

  it("suma el disponible por moneda cuando hay varios anticipos", async () => {
    fetchAnticiposDisponibles.mockResolvedValueOnce([
      anticipo({ id: "a1", saldo_disponible: 400 }),
      anticipo({ id: "a2", saldo_disponible: 600 }),
      anticipo({ id: "a3", moneda: "MXN", saldo_disponible: 1500 }),
    ]);
    const { result } = renderHook(() => useAnticiposDisponiblesPorEmbarque("p1", EMB_A), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.anticipos).toHaveLength(3));
    expect(result.current.porMoneda).toEqual([
      { moneda: "USD", disponible: 1000 },
      { moneda: "MXN", disponible: 1500 },
    ]);
  });
});
