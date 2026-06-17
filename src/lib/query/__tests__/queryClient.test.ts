/**
 * Fase 3 — queryClient consolidado en src/lib/query/.
 * Verifica defaults seguros y whitelist de catálogos persistibles.
 */
import { describe, it, expect } from "vitest";
import { queryClient, shouldDehydrateCatalogQuery, queryPersister } from "../queryClient";

describe("queryClient (lib/query)", () => {
  it("aplica defaults conservadores (no refetch focus/reconnect, retry=1)", () => {
    const opts = queryClient.getDefaultOptions().queries!;
    expect(opts.staleTime).toBe(60_000);
    expect(opts.refetchOnWindowFocus).toBe(false);
    expect(opts.refetchOnReconnect).toBe(false);
    expect(opts.retry).toBe(1);
  });

  it("queryPersister está instanciado y es serializable", () => {
    expect(queryPersister).toBeDefined();
    expect(typeof queryPersister.persistClient).toBe("function");
    expect(typeof queryPersister.restoreClient).toBe("function");
  });
});

describe("shouldDehydrateCatalogQuery", () => {
  const catalogos = [
    "puertos", "navieras", "tipos_contenedor", "tasa_iva",
    "exchange-rates", "configuracion",
  ];

  it.each(catalogos)("hidrata '%s' cuando status=success", (key) => {
    expect(shouldDehydrateCatalogQuery([key, "x"], "success")).toBe(true);
  });

  it("NO hidrata catálogos cuando status != success", () => {
    expect(shouldDehydrateCatalogQuery(["puertos"], "error")).toBe(false);
    expect(shouldDehydrateCatalogQuery(["puertos"], "pending")).toBe(false);
  });

  it("NO hidrata queries fuera de la whitelist", () => {
    expect(shouldDehydrateCatalogQuery(["embarques"], "success")).toBe(false);
    expect(shouldDehydrateCatalogQuery(["clientes", 1], "success")).toBe(false);
  });

  it("tolera queryKey vacío / inválido sin lanzar", () => {
    expect(shouldDehydrateCatalogQuery([], "success")).toBe(false);
    expect(shouldDehydrateCatalogQuery(undefined, "success")).toBe(false);
  });
});
