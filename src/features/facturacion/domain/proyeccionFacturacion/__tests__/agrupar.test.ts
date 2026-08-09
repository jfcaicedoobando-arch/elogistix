/**
 * Tests puros de `agruparPorExpediente`. Verifica:
 *  - Múltiples filas mismo expediente → consolidan totales y contenedores únicos.
 *  - ETA mínima representativa del grupo (cortes fiscales fin de año).
 *  - Estado "Facturado" sólo si TODAS las filas tienen proforma + factura_pdf.
 *  - Margen % usa ventaMxn como denominador, 0 si venta=0.
 *  - Orden ascendente por ETA, nulls al final.
 *
 * Phase 3.1 — Auditoría 13.14.1.
 */
import { describe, it, expect } from "vitest";
import { agruparPorExpediente } from "../agrupar";
import type { FilaProyeccion } from "../types";

const base: FilaProyeccion = {
  embarque_id: "e1",
  sin_tc: false,
  expediente: "EXP-100",
  cliente_nombre: "ACME",
  operador: "JDOE",
  eta: "2026-06-10",
  contenedor: "MSCU1",
  tipo_cambio_usd: 18.5,
  tipo_cambio_eur: 20,
  tiene_proforma: true,
  tiene_factura_pdf: true,
  venta_mxn: 10000,
  venta_usd: 540,
  costo_mxn: 7000,
  costo_usd: 380,
};

describe("agruparPorExpediente [agrupar.ts unit]", () => {
  it("consolida 2 filas mismo expediente sumando montos y dedupe contenedores", () => {
    const out = agruparPorExpediente([
      base,
      { ...base, embarque_id: "e2", contenedor: "MSCU2", venta_mxn: 5000, costo_mxn: 2000 },
      { ...base, embarque_id: "e3", contenedor: "MSCU1", venta_mxn: 0, costo_mxn: 0 }, // duplicado
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].ventaMxn).toBe(15000);
    expect(out[0].costoMxn).toBe(9000);
    expect(out[0].profitMxn).toBe(6000);
    expect(out[0].contenedores.sort()).toEqual(["MSCU1", "MSCU2"]);
    expect(out[0].embarqueIds).toEqual(["e1", "e2", "e3"]);
  });

  it("estado Pendiente si al menos una fila no tiene proforma+factura_pdf", () => {
    const out = agruparPorExpediente([
      base,
      { ...base, embarque_id: "e2", tiene_factura_pdf: false },
    ]);
    expect(out[0].estado).toBe("Pendiente");
  });

  it("estado Facturado cuando todas las filas tienen proforma+factura_pdf", () => {
    const out = agruparPorExpediente([base, { ...base, embarque_id: "e2" }]);
    expect(out[0].estado).toBe("Facturado");
  });

  it("ETA representativa = mínima del grupo (corte fiscal)", () => {
    const out = agruparPorExpediente([
      { ...base, eta: "2026-12-31" },
      { ...base, embarque_id: "e2", eta: "2026-12-15" },
      { ...base, embarque_id: "e3", eta: null },
    ]);
    expect(out[0].eta).toBe("2026-12-15");
  });

  it("margenPct=0 cuando ventaMxn=0 (no divide por cero)", () => {
    const out = agruparPorExpediente([{ ...base, venta_mxn: 0, costo_mxn: 100 }]);
    expect(out[0].margenPct).toBe(0);
  });

  it("ordena por ETA asc, nulls al final, desempata por expediente", () => {
    const out = agruparPorExpediente([
      { ...base, embarque_id: "a", expediente: "EXP-Z", eta: null },
      { ...base, embarque_id: "b", expediente: "EXP-A", eta: "2026-06-15" },
      { ...base, embarque_id: "c", expediente: "EXP-B", eta: "2026-06-01" },
    ]);
    expect(out.map((g) => g.expediente)).toEqual(["EXP-B", "EXP-A", "EXP-Z"]);
  });

  it("expediente vacío produce key sintética por embarque_id", () => {
    const out = agruparPorExpediente([
      { ...base, embarque_id: "x1", expediente: "" },
      { ...base, embarque_id: "x2", expediente: "" },
    ]);
    expect(out).toHaveLength(2);
    expect(out[0].expediente).toBe("—");
  });
});

// Ola 5 · M5 — el flag `sinTc` se propaga al expediente completo.
describe("agruparPorExpediente — sin TC", () => {
  it("marca el grupo cuando al menos un embarque no tiene TC", () => {
    const [g] = agruparPorExpediente([
      { ...base, embarque_id: "e1", contenedor: "C1" },
      { ...base, embarque_id: "e2", contenedor: "C2", sin_tc: true },
    ]);
    expect(g.sinTc).toBe(true);
  });

  it("no marca el grupo si todos los embarques tienen TC", () => {
    const [g] = agruparPorExpediente([{ ...base }]);
    expect(g.sinTc).toBe(false);
  });
});
