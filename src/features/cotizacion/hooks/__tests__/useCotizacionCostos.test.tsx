import { describe, it, expect, vi, afterEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createWrapper } from "@/test/utils/queryWrapper";
import { queryKeys } from "@/lib/query";

afterEach(() => {
  vi.clearAllMocks();
});


const fetchCotizacionCostos = vi.hoisted(() => vi.fn());
const upsertCotizacionCostos = vi.hoisted(() => vi.fn());

vi.mock("@/features/cotizacion/services", () => ({
  fetchCotizacionCostos,
  // El hook de fotografía lo importa el barrel; sólo se usa en la prueba que
  // realmente lee el snapshot desde la BD.
  fetchCotizacionCostosSnapshot: vi.fn(),
  upsertCotizacionCostos,
}));

vi.mock("@/lib/idempotency", () => ({
  newRequestId: () => "req-123",
}));

// v13.823.169: sin fixture de claves. Se usan las claves reales de `@/lib/query`
// (antes el mock parcial no definía `costosSnapshot` y `onSuccess` tronaba).

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

const resultadoUpsert = (selloEscritura: string, snapshot: { costos: unknown[]; updatedAt: string }) => ({
  updatedAt: selloEscritura,
  snapshot,
});

describe("useUpsertCotizacionCostos", () => {
  it("propaga el sello esperado a la RPC (bloqueo optimista del paso 2)", async () => {
    upsertCotizacionCostos.mockResolvedValueOnce(
      resultadoUpsert("2026-09-03T10:00:00Z", { costos: [], updatedAt: "2026-09-03T10:00:00Z" }),
    );
    const { result } = renderHook(() => useUpsertCotizacionCostos(), { wrapper: createWrapper() });
    result.current.mutate({ cotizacionId: "cot-1", costos: [], expectedUpdatedAt: "2026-09-03T09:00:00Z" });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(upsertCotizacionCostos).toHaveBeenCalledWith("cot-1", [], "req-123", "2026-09-03T09:00:00Z");
  });

  it("llama a upsertCotizacionCostos y resuelve", async () => {
    upsertCotizacionCostos.mockResolvedValueOnce(
      resultadoUpsert("2026-09-03T10:00:00Z", { costos: [], updatedAt: "2026-09-03T10:00:00Z" }),
    );
    const { result } = renderHook(() => useUpsertCotizacionCostos(), { wrapper: createWrapper() });
    result.current.mutate({ cotizacionId: "cot-1", costos: [] });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(upsertCotizacionCostos).toHaveBeenCalledWith("cot-1", [], "req-123", undefined);
  });

  // v13.823.169: la caché del detalle recibe SÓLO la fotografía coherente
  // (filas + su propio sello). El sello de la escritura propia (S1) viaja en
  // `updatedAt` y no se empareja con las filas de S2.
  it("la caché de snapshot recibe filas y sello de la misma fotografía", async () => {
    const S1 = "2026-09-03T10:00:00Z";
    const S2 = "2026-09-03T10:05:00Z";
    const filasS2 = [{ id: "c1", concepto: "Flete" }];
    upsertCotizacionCostos.mockResolvedValueOnce(
      resultadoUpsert(S1, { costos: filasS2, updatedAt: S2 }),
    );
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { result } = renderHook(() => useUpsertCotizacionCostos(), {
      wrapper: ({ children }) => (
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
      ),
    });
    const res = await result.current.mutateAsync({
      cotizacionId: "cot-1", costos: [], expectedUpdatedAt: "2026-09-03T09:00:00Z",
    });
    // Sello de escritura propio, separado de la fotografía posterior.
    expect(res.updatedAt).toBe(S1);
    expect(client.getQueryData(queryKeys.cotizaciones.costosSnapshot("cot-1"))).toEqual({
      costos: filasS2,
      updatedAt: S2,
    });
  });

  // v13.823.164: el hook ya NO notifica; el aviso lo emite el call site (antes
  // salían dos toasts por el mismo fallo).
  it("propaga el error sin emitir aviso propio", async () => {
    upsertCotizacionCostos.mockRejectedValueOnce(new Error("LC_CONFLICTO_CONCURRENCIA"));
    const { result } = renderHook(() => useUpsertCotizacionCostos(), { wrapper: createWrapper() });
    await expect(
      result.current.mutateAsync({ cotizacionId: "cot-1", costos: [], expectedUpdatedAt: "x" }),
    ).rejects.toThrow("LC_CONFLICTO_CONCURRENCIA");
  });
});
