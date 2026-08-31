import { describe, it, expect } from "vitest";
import { ventaBloqueada, costoBloqueado } from "../conceptoBloqueado";

describe("ventaBloqueada", () => {
  it("permite editar los estados que la RPC sí actualiza", () => {
    expect(ventaBloqueada("pendiente")).toBe(false);
    expect(ventaBloqueada("en_proforma")).toBe(false);
    expect(ventaBloqueada(null)).toBe(false);
    expect(ventaBloqueada(undefined)).toBe(false);
  });

  it("bloquea los estados que la RPC descarta en silencio", () => {
    expect(ventaBloqueada("facturado")).toBe(true);
    expect(ventaBloqueada("en_factura")).toBe(true);
  });

  it("es insensible a mayúsculas y espacios", () => {
    expect(ventaBloqueada(" Pendiente ")).toBe(false);
    expect(ventaBloqueada("FACTURADO")).toBe(true);
  });
});

describe("costoBloqueado", () => {
  it("sólo bloquea costos pagados", () => {
    expect(costoBloqueado("Pagado")).toBe(true);
    expect(costoBloqueado("pagado")).toBe(true);
    expect(costoBloqueado("Pendiente")).toBe(false);
    expect(costoBloqueado(null)).toBe(false);
  });
});
