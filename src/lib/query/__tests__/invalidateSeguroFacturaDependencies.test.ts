import { QueryObserver } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
import { queryKeys } from "@/lib/query";
import { crearCacheSeguroFactura } from "@/test/helpers/seguroFacturaCache";
import { invalidateSeguroFacturaDependencies } from "../invalidateSeguroFacturaDependencies";

let cache = crearCacheSeguroFactura();
afterEach(() => { cache.client.clear(); cache = crearCacheSeguroFactura(); });

describe("invalidateSeguroFacturaDependencies", () => {
  it("invalida P&L, pólizas y selector de todos los embarques cacheados, sin tocar otras familias", async () => {
    const before = cache.client.getQueryCache().getAll().map((q) => [q.queryHash, q.state.data]);
    await invalidateSeguroFacturaDependencies(cache.client);
    for (const key of cache.afectadas) expect(cache.client.getQueryState(key)?.isInvalidated).toBe(true);
    for (const key of cache.ajenas) expect(cache.client.getQueryState(key)?.isInvalidated).toBe(false);
    expect(cache.client.getQueryCache().getAll().map((q) => [q.queryHash, q.state.data])).toEqual(before);
  });

  it("el prefijo plural no refresca estas lecturas singulares", async () => {
    await cache.client.invalidateQueries({ queryKey: queryKeys.embarques.all });
    for (const key of cache.afectadas) expect(cache.client.getQueryState(key)?.isInvalidated).toBe(false);
    await invalidateSeguroFacturaDependencies(cache.client);
    for (const key of cache.afectadas) expect(cache.client.getQueryState(key)?.isInvalidated).toBe(true);
  });

  it("refetchea una lectura activa aunque conserve staleTime infinito", async () => {
    const key = queryKeys.embarques.segurosFacturasElegibles("embarque-a");
    const queryFn = vi.fn().mockResolvedValue([{ id: "factura-nueva" }]);
    const observer = new QueryObserver(cache.client, { queryKey: key, queryFn, staleTime: Infinity });
    const stop = observer.subscribe(() => {});
    try {
      expect(queryFn).not.toHaveBeenCalled();
      await invalidateSeguroFacturaDependencies(cache.client);
      expect(queryFn).toHaveBeenCalledTimes(1);
      expect(cache.client.getQueryData(key)).toEqual([{ id: "factura-nueva" }]);
    } finally { stop(); }
  });

  it("un error de refetch conserva el dato y permite reintentar sin cambiar importes ni vínculo", async () => {
    const key = queryKeys.embarques.pnlFinanciero("embarque-a");
    const previo = cache.client.getQueryData(key);
    const queryFn = vi.fn().mockRejectedValueOnce(new Error("Lectura temporalmente indisponible"))
      .mockResolvedValueOnce({ version: "actual" });
    const observer = new QueryObserver(cache.client, { queryKey: key, queryFn, staleTime: Infinity, retry: false });
    const stop = observer.subscribe(() => {});
    try {
      await expect(invalidateSeguroFacturaDependencies(cache.client)).resolves.toBeUndefined();
      expect(cache.client.getQueryData(key)).toEqual(previo);
      expect(cache.client.getQueryState(key)?.status).toBe("error");
      await invalidateSeguroFacturaDependencies(cache.client);
      expect(cache.client.getQueryData(key)).toEqual({ version: "actual" });
      expect(queryFn).toHaveBeenCalledTimes(2);
    } finally { stop(); }
  });

  it("no crea consultas cuando no hay datos cacheados", async () => {
    cache.client.clear();
    await invalidateSeguroFacturaDependencies(cache.client);
    expect(cache.client.getQueryCache().getAll()).toEqual([]);
  });
});
