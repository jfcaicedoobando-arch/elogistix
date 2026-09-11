/**
 * Orden global del listado de facturas de proveedor.
 *
 * Regresión: antes el orden se aplicaba sobre la página ya cortada, así que
 * "ordenar por folio" sólo acomodaba las 100 filas visibles.
 */
import { describe, it, expect } from "vitest";
import {
  CXP_SORT_KEY_DEFAULT,
  CXP_ORDEN,
  ordenarFacturasCxP,
} from "../proveedorFacturas.orden";
import type { FacturaCxP } from "../proveedorFacturas.types";

function f(p: Partial<FacturaCxP>): FacturaCxP {
  return {
    id: p.folio_interno ?? Math.random().toString(36).slice(2),
    folio_interno: null,
    folio_proveedor: null,
    proveedor_nombre: "",
    fecha_emision: null,
    fecha_vencimiento: null,
    moneda: "MXN",
    total: 0,
    pagado: 0,
    saldo: 0,
    estatus: "Vigente",
    ...p,
  } as FacturaCxP;
}

describe("ordenarFacturasCxP", () => {
  it("ordena por folio interno en todo el conjunto, no sólo la página", () => {
    const rows = [
      f({ folio_interno: "FP-000100" }),
      f({ folio_interno: "FP-000002" }),
      f({ folio_interno: "FP-000050" }),
    ];
    expect(
      ordenarFacturasCxP(rows, "folio_interno", "asc").map((r) => r.folio_interno),
    ).toEqual(["FP-000002", "FP-000050", "FP-000100"]);
    expect(
      ordenarFacturasCxP(rows, "folio_interno", "desc").map((r) => r.folio_interno),
    ).toEqual(["FP-000100", "FP-000050", "FP-000002"]);
  });

  it("deja los vacíos al final en asc y en desc", () => {
    const rows = [
      f({ folio_interno: null }),
      f({ folio_interno: "FP-000010" }),
      f({ folio_interno: "FP-000009" }),
    ];
    const asc = ordenarFacturasCxP(rows, "folio_interno", "asc");
    const desc = ordenarFacturasCxP(rows, "folio_interno", "desc");
    expect(asc[asc.length - 1].folio_interno).toBeNull();
    expect(desc[desc.length - 1].folio_interno).toBeNull();
  });

  it("compara números por valor, no como texto", () => {
    const rows = [f({ total: 9 }), f({ total: 100 }), f({ total: 20 })];
    expect(ordenarFacturasCxP(rows, "total", "asc").map((r) => r.total)).toEqual([
      9, 20, 100,
    ]);
  });

  it("compara fechas por valor y manda inválidas al final", () => {
    const rows = [
      f({ fecha_vencimiento: "2026-03-01" }),
      f({ fecha_vencimiento: null }),
      f({ fecha_vencimiento: "2025-12-31" }),
    ];
    expect(
      ordenarFacturasCxP(rows, "vencimiento", "asc").map((r) => r.fecha_vencimiento),
    ).toEqual(["2025-12-31", "2026-03-01", null]);
  });

  it("usa collation es-MX (acentos y mayúsculas no alteran el orden)", () => {
    const rows = [
      f({ proveedor_nombre: "Zeta" }),
      f({ proveedor_nombre: "álamo" }),
      f({ proveedor_nombre: "Beta" }),
    ];
    expect(
      ordenarFacturasCxP(rows, "proveedor", "asc").map((r) => r.proveedor_nombre),
    ).toEqual(["álamo", "Beta", "Zeta"]);
  });

  it("devuelve una copia sin ordenar cuando la columna no es ordenable", () => {
    const rows = [f({ folio_interno: "B" }), f({ folio_interno: "A" })];
    const out = ordenarFacturasCxP(rows, "columna_inexistente", "asc");
    expect(out.map((r) => r.folio_interno)).toEqual(["B", "A"]);
    expect(out).not.toBe(rows);
  });

  it("expone el default y las columnas soportadas", () => {
    expect(CXP_SORT_KEY_DEFAULT).toBe("folio_interno");
    expect(Object.keys(CXP_ORDEN)).toContain("saldo");
  });
});
