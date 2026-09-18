import { describe, it, expect } from "vitest";
import { buildConceptosFromCostos } from "@/features/cotizacion/domain/cotizacion.conceptos";
import { calcularTotalesProforma } from "@/features/proformas/domain";
import type { FilaCostoLocal } from "@/features/cotizacion/types";

const fila = (over: Partial<FilaCostoLocal>): FilaCostoLocal =>
  ({
    concepto: "Maniobras",
    unidad_medida: "E48",
    cantidad: 1,
    costo_unitario: 0,
    precio_venta: 1000,
    moneda: "MXN",
    proveedor: "",
    notas: "",
    ...over,
  }) as FilaCostoLocal;

describe("Cotización → conceptos con IVA no objeto (SAT 01)", () => {
  it("conserva el tratamiento fiscal y no suma IVA", () => {
    const { mxn } = buildConceptosFromCostos(
      [fila({ tipo_iva: "no_objeto", tasa_iva_aplicada: 0 })],
      0.16,
    );
    expect(mxn[0].tipo_iva).toBe("no_objeto");
    expect(mxn[0].aplica_iva).toBe(false);
    expect(mxn[0].total).toBe(1000);
  });

  it("no lo confunde con exento ni deja que la tasa legacy lo grave", () => {
    // Fila con tasa legacy stale de 16%: el tipo explícito manda.
    const { usd } = buildConceptosFromCostos(
      [fila({ moneda: "USD", tipo_iva: "no_objeto", tasa_iva_aplicada: 0.16 })],
      0.16,
    );
    expect(usd[0].tipo_iva).toBe("no_objeto");
    expect(usd[0].total).toBe(1000);
    expect(usd[0].tasa_iva_aplicada).toBe(0);
  });

  it("no altera gravado 16 ni exento", () => {
    const { mxn } = buildConceptosFromCostos(
      [
        fila({ tasa_iva_aplicada: 0.16 }),
        fila({ concepto: "Flete", tasa_iva_aplicada: 0, tipo_iva: "exento" }),
      ],
      0.16,
    );
    expect(mxn[0].total).toBe(1160);
    expect(mxn[1].total).toBe(1000);
    expect(mxn[1].tipo_iva).toBe("exento");
  });
});

describe("Proforma con conceptos no objeto", () => {
  it("no calcula IVA aunque exista override de usuario", () => {
    const totales = calcularTotalesProforma(
      [
        { id: "a", cantidad: 1, precio_unitario: 1000, moneda: "USD", aplica_iva: true, tasa_iva_aplicada: 0.16, tipo_iva: "no_objeto" },
        { id: "b", cantidad: 1, precio_unitario: 500, moneda: "USD", aplica_iva: true, tasa_iva_aplicada: 0.16 },
      ],
      0.16,
      { a: true },
    );
    expect(totales.subtotal_usd).toBe(1500);
    expect(totales.iva_usd).toBe(80);
    expect(totales.total_usd).toBe(1580);
  });
});
