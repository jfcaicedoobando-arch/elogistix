import { describe, it, expect } from "vitest";
import { buildEstadoResultados } from "../estadoResultados";
import type { EmbarqueER, ConceptoVentaER, ConceptoCostoER } from "../estadoResultados";

const emb: EmbarqueER = { id: "e1", modo: "Marítimo", tipo_cambio_usd: 17, tipo_cambio_eur: 18 };

describe("buildEstadoResultados – happy path", () => {
  it("calculates ingresos, costos and utilidad correctly", () => {
    const ventas: ConceptoVentaER[] = [
      { embarque_id: "e1", descripcion: "Flete", total: 1000, moneda: "MXN" },
    ];
    const costos: ConceptoCostoER[] = [
      { embarque_id: "e1", concepto: "Agente", monto: 400, moneda: "MXN" },
    ];
    const er = buildEstadoResultados([emb], ventas, costos);
    expect(er.totalIngresos.total).toBe(1000);
    expect(er.totalCostos.total).toBe(400);
    expect(er.utilidad.total).toBe(600);
  });

  it("converts USD to MXN using tipo_cambio_usd", () => {
    const ventas: ConceptoVentaER[] = [
      { embarque_id: "e1", descripcion: "Flete USD", total: 100, moneda: "USD" },
    ];
    const er = buildEstadoResultados([emb], ventas, []);
    expect(er.totalIngresos.total).toBe(100 * 17);
  });
});

describe("buildEstadoResultados – empty inputs", () => {
  it("returns zeros when no data", () => {
    const er = buildEstadoResultados([], [], []);
    expect(er.totalIngresos.total).toBe(0);
    expect(er.totalCostos.total).toBe(0);
    expect(er.utilidad.total).toBe(0);
    expect(er.ingresos).toEqual([]);
    expect(er.costos).toEqual([]);
  });
});

describe("buildEstadoResultados – edge cases", () => {
  it("skips ventas for unknown embarque_id", () => {
    const ventas: ConceptoVentaER[] = [
      { embarque_id: "unknown", descripcion: "X", total: 500, moneda: "MXN" },
    ];
    const er = buildEstadoResultados([emb], ventas, []);
    expect(er.totalIngresos.total).toBe(0);
  });

  it("assigns unknown modo to 'Otros' column (no longer silently dropped)", () => {
    const badEmb: EmbarqueER = { id: "e2", modo: "Submarino", tipo_cambio_usd: 17, tipo_cambio_eur: 18 };
    const ventas: ConceptoVentaER[] = [
      { embarque_id: "e2", descripcion: "Flete", total: 500, moneda: "MXN" },
    ];
    const er = buildEstadoResultados([badEmb], ventas, []);
    expect(er.totalIngresos.total).toBe(500);
    expect(er.totalIngresos.porModo["Otros"]).toBe(500);
  });

  it("buckets amounts into the correct modo column", () => {
    const aereoEmb: EmbarqueER = { id: "e3", modo: "Aéreo", tipo_cambio_usd: 17, tipo_cambio_eur: 18 };
    const ventas: ConceptoVentaER[] = [
      { embarque_id: "e1", descripcion: "Flete", total: 200, moneda: "MXN" },
      { embarque_id: "e3", descripcion: "Flete", total: 100, moneda: "MXN" },
    ];
    const er = buildEstadoResultados([emb, aereoEmb], ventas, []);
    const flete = er.ingresos.find((r) => r.concepto === "Flete")!;
    expect(flete.porModo["Marítimo"]).toBe(200);
    expect(flete.porModo["Aéreo"]).toBe(100);
  });
});

describe("buildEstadoResultados – conversión EUR", () => {
  it("convierte EUR a MXN usando tipo_cambio_eur del embarque", () => {
    const eurEmb: EmbarqueER = { id: "e-eur", modo: "Marítimo", tipo_cambio_usd: 17, tipo_cambio_eur: 19.5 };
    const ventas: ConceptoVentaER[] = [
      { embarque_id: "e-eur", descripcion: "Flete EUR", total: 200, moneda: "EUR" },
    ];
    const costos: ConceptoCostoER[] = [
      { embarque_id: "e-eur", concepto: "Agente EUR", monto: 50, moneda: "EUR" },
    ];
    const er = buildEstadoResultados([eurEmb], ventas, costos);
    expect(er.totalIngresos.total).toBe(200 * 19.5);
    expect(er.totalCostos.total).toBe(50 * 19.5);
    expect(er.utilidad.total).toBe((200 - 50) * 19.5);
  });

  it("FIX C6: excluye el monto cuando tipo_cambio_eur es null (nunca lo suma como MXN)", () => {
    const eurEmb: EmbarqueER = { id: "e-eur2", modo: "Marítimo", tipo_cambio_usd: 17, tipo_cambio_eur: null };
    const ventas: ConceptoVentaER[] = [
      { embarque_id: "e-eur2", descripcion: "Flete EUR", total: 100, moneda: "EUR" },
    ];
    const er = buildEstadoResultados([eurEmb], ventas, []);
    expect(er.totalIngresos.total).toBe(0);
  });
});
