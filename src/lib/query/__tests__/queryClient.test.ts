/**
 * Fase 3 — queryClient consolidado en src/lib/query/.
 * Verifica defaults seguros y whitelist de catálogos persistibles.
 */
import { afterEach, describe, it, expect, vi } from "vitest";
import {
  PERSISTED_CATALOG_MAX_AGE,
  queryClient,
  shouldDehydrateCatalogQuery,
  queryPersister,
} from "../queryClient";

afterEach(() => {
  queryClient.clear();
  vi.useRealTimers();
});

describe("queryClient (lib/query)", () => {
  it("aplica defaults conservadores (no refetch focus/reconnect, retry=2)", () => {
    const opts = queryClient.getDefaultOptions().queries!;
    expect(opts.staleTime).toBe(60_000);
    expect(opts.gcTime).toBe(5 * 60_000);
    expect(opts.refetchOnWindowFocus).toBe(false);
    expect(opts.refetchOnReconnect).toBe(false);
    expect(opts.retry).toBe(2);
  });

  it("retiene sólo el prefijo persistido durante 24 h, sin cambiar su frescura", () => {
    expect(PERSISTED_CATALOG_MAX_AGE).toBe(24 * 60 * 60_000);
    for (const queryKey of [["exchange-rates"], ["exchange-rates", "2026-10-15"], ["exchange-rates", "dof-fecha", "2026-10-15"]]) {
      const options = queryClient.defaultQueryOptions({ queryKey });
      expect(options.gcTime).toBe(PERSISTED_CATALOG_MAX_AGE);
      expect(options.staleTime).toBe(60_000);
    }
    for (const queryKey of [["embarques"], ["clientes", "org"], ["configuracion"], ["tasa_iva"]]) {
      expect(queryClient.defaultQueryOptions({ queryKey }).gcTime).toBe(5 * 60_000);
    }
  });

  it("conserva tasas inactivas tras 5 min y las recolecta a las 24 h", () => {
    vi.useFakeTimers();
    queryClient.setQueryData(["exchange-rates"], { usdMxn: 20 });
    queryClient.setQueryData(["embarques"], { private: "operational fixture" });

    vi.advanceTimersByTime(5 * 60_000 + 1);
    expect(queryClient.getQueryData(["exchange-rates"])).toEqual({ usdMxn: 20 });
    expect(queryClient.getQueryData(["embarques"])).toBeUndefined();

    vi.advanceTimersByTime(PERSISTED_CATALOG_MAX_AGE - 5 * 60_000);
    expect(queryClient.getQueryData(["exchange-rates"])).toBeUndefined();
  });

  it("queryPersister está instanciado y es serializable", () => {
    expect(queryPersister).toBeDefined();
    expect(typeof queryPersister.persistClient).toBe("function");
    expect(typeof queryPersister.restoreClient).toBe("function");
  });
});

describe("shouldDehydrateCatalogQuery", () => {
  // Sólo `exchange-rates` es persistible; useTasaIVA devuelve una constante.
  // Los catálogos administrables (puertos/navieras/tipos_contenedor/configuracion)
  // se removieron porque quedaban congelados en localStorage tras editarlos.
  const catalogos = ["exchange-rates"];
  const removidos = ["tasa_iva", "puertos", "navieras", "tipos_contenedor", "configuracion"];

  it.each(catalogos)("hidrata '%s' cuando status=success", (key) => {
    expect(shouldDehydrateCatalogQuery([key, "x"], "success")).toBe(true);
  });

  it.each(removidos)("NO hidrata '%s' (fuera del contrato persistible)", (key) => {
    expect(shouldDehydrateCatalogQuery([key, "x"], "success")).toBe(false);
  });

  it("NO hidrata catálogos cuando status != success", () => {
    expect(shouldDehydrateCatalogQuery(["exchange-rates"], "error")).toBe(false);
    expect(shouldDehydrateCatalogQuery(["exchange-rates"], "pending")).toBe(false);
  });

  it("NO hidrata queries fuera de la whitelist", () => {
    expect(shouldDehydrateCatalogQuery(["embarques"], "success")).toBe(false);
    expect(shouldDehydrateCatalogQuery(["clientes", 1], "success")).toBe(false);
  });

  it("tolera queryKey vacío / inválido sin lanzar", () => {
    expect(shouldDehydrateCatalogQuery([], "success")).toBe(false);
    expect(shouldDehydrateCatalogQuery(undefined, "success")).toBe(false);
    expect(shouldDehydrateCatalogQuery("exchange-rates", "success")).toBe(false);
    expect(shouldDehydrateCatalogQuery({ 0: "exchange-rates" }, "success")).toBe(false);
  });
});
