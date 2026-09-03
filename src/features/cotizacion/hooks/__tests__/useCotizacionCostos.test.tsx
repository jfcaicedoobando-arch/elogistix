import { describe, it, expect, vi, afterEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { createWrapper } from "@/test/utils/queryWrapper";

afterEach(() => {
  vi.clearAllMocks();
});


const fetchCotizacionCostos = vi.hoisted(() => vi.fn());
const upsertCotizacionCostos = vi.hoisted(() => vi.fn());

vi.mock("@/features/cotizacion/services", () => ({
  fetchCotizacionCostos,
  upsertCotizacionCostos,
}));

vi.mock("@/lib/idempotency", () => ({
  newRequestId: () => "req-123",
}));

vi.mock("@/lib/query", () => ({
  queryKeys: {
    cotizaciones: {
      costos: (id: string) => ["cotizaciones", "costos", id],
      all: ["cotizaciones"],
    },
  },
}));

import { useCotizacionCostos, useUpsertCotizacionCostos } from "../useCotizacionCostos";

describe("useCotizacionCostos", () => {
  it("happy path: devuelve datos cuando cotizacionId está definido", async () => {
    const costos = [{ id: "c1", concepto: "Flete", monto: 100 }];
    fetchCotizacionCostos.mockResolvedValueOnce(costos);
    const { result } = renderHook(() => useCotizacionCostos("cot-1"), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(costos);
    expect(fetchCotizacionCostos).toHaveBeenCalledWith("cot-1");
  });

  it("disabled cuando cotizacionId=undefined", () => {
    const { result } = renderHook(() => useCotizacionCostos(undefined), { wrapper: createWrapper() });
    expect(result.current.fetchStatus).toBe("idle");
  });
});

describe("useUpsertCotizacionCostos", () => {
  it("propaga el sello esperado a la RPC (bloqueo optimista del paso 2)", async () => {
    upsertCotizacionCostos.mockResolvedValueOnce({ costos: [], updatedAt: "2026-09-03T10:00:00Z" });
    const { result } = renderHook(() => useUpsertCotizacionCostos(), { wrapper: createWrapper() });
    result.current.mutate({ cotizacionId: "cot-1", costos: [], expectedUpdatedAt: "2026-09-03T09:00:00Z" });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(upsertCotizacionCostos).toHaveBeenCalledWith("cot-1", [], "req-123", "2026-09-03T09:00:00Z");
  });

  it("llama a upsertCotizacionCostos y resuelve", async () => {
    upsertCotizacionCostos.mockResolvedValueOnce([]);
    const { result } = renderHook(() => useUpsertCotizacionCostos(), { wrapper: createWrapper() });
    result.current.mutate({ cotizacionId: "cot-1", costos: [] });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(upsertCotizacionCostos).toHaveBeenCalledWith("cot-1", [], "req-123", undefined);
  });
});
