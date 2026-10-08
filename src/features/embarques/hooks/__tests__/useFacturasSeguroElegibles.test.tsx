import { act, renderHook, waitFor } from "@testing-library/react";
import { useQueryClient } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { queryKeys } from "@/lib/query";
import { createWrapper } from "@/test/utils/queryWrapper";

const { mockFetch } = vi.hoisted(() => ({ mockFetch: vi.fn() }));

vi.mock("@/features/embarques/services/seguros", () => ({
  fetchFacturasSeguroElegibles: mockFetch,
}));

import { useFacturasSeguroElegibles } from "../useFacturasSeguroElegibles";

const facturas = [{
  id: "factura-1", folio_interno: "FP-1", proveedor_nombre: "Aseguradora",
  subtotal: 100, moneda: "MXN",
}];

beforeEach(() => { mockFetch.mockReset(); });

describe("useFacturasSeguroElegibles", () => {
  it("conserva el servicio, la clave del embarque y los 30 segundos de caché", async () => {
    mockFetch.mockResolvedValue(facturas);
    const { result } = renderHook(() => ({
      query: useFacturasSeguroElegibles("embarque-1"),
      client: useQueryClient(),
    }), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.query.isSuccess).toBe(true));
    expect(mockFetch).toHaveBeenCalledExactlyOnceWith("embarque-1");
    expect(result.current.query.data).toEqual(facturas);
    const key = queryKeys.embarques.segurosFacturasElegibles("embarque-1");
    expect(result.current.client.getQueryData(key)).toEqual(facturas);
    expect(result.current.client.getQueryCache().find({ queryKey: key })).toMatchObject({
      options: { staleTime: 30_000 },
    });
  });

  it("expone la carga pendiente sin convertirla en una lista exitosa vacía", async () => {
    let resolve!: (value: typeof facturas) => void;
    mockFetch.mockReturnValue(new Promise<typeof facturas>((res) => { resolve = res; }));
    const { result } = renderHook(() => useFacturasSeguroElegibles("embarque-1"), {
      wrapper: createWrapper(),
    });
    expect(result.current.isLoading).toBe(true);
    expect(result.current.isSuccess).toBe(false);
    expect(result.current.data).toBeUndefined();
    await act(async () => { resolve([]); });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([]);
  });

  it("propaga el error y permite recuperar la consulta con refetch", async () => {
    const error = new Error("No se pudo consultar");
    mockFetch.mockRejectedValueOnce(error).mockResolvedValueOnce(facturas);
    const { result } = renderHook(() => useFacturasSeguroElegibles("embarque-1"), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBe(error);
    expect(result.current.data).toBeUndefined();

    await act(async () => { await result.current.refetch(); });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(facturas);
  });

  it("separa la caché al cambiar de embarque y no conserva las facturas anteriores", async () => {
    mockFetch.mockResolvedValueOnce(facturas).mockResolvedValueOnce([]);
    const { result, rerender } = renderHook(({ id }) => useFacturasSeguroElegibles(id), {
      initialProps: { id: "embarque-1" }, wrapper: createWrapper(),
    });
    await waitFor(() => expect(result.current.data).toEqual(facturas));
    rerender({ id: "embarque-2" });
    expect(result.current.data).toBeUndefined();
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([]);
    expect(mockFetch.mock.calls).toEqual([["embarque-1"], ["embarque-2"]]);
  });
});
