import { describe, it, expect } from "vitest";
import {
  calcularSubtotales,
  ordenarFilasPorAjuste,
  estatusBadgeClass,
  estatusLabel,
  pagoBadgeClass,
  estadoPagoConcepto,
  fmtFecha,
} from "../grupoCostosProveedorHelpers";
import type { FilaReconciliacion, FacturaVinculada } from "@/features/embarques/services/reconciliacionCostos.helpers";

function fila(overrides: Partial<FilaReconciliacion>): FilaReconciliacion {
  return {
    concepto_costo_id: "c1",
    concepto: "Flete",
    proveedor_nombre: "Prov",
    moneda: "MXN",
    cotizado: 100,
    real_facturado: 100,
    diferencia: 0,
    desviacion_pct: 0,
    estado_liquidacion: "pendiente",
    estatus_renglon: "sin_match",
    facturas: [],
    ...overrides,
  };
}

function factura(overrides: Partial<FacturaVinculada>): FacturaVinculada {
  return {
    proveedor_factura_id: "f1",
    folio_interno: "FP-000001",
    folio_proveedor: "F-1",
    fecha_emision: null,
    fecha_vencimiento: null,
    estatus_pago: null,
    descripcion: null,
    monto: 10,
    ...overrides,
  };
}

describe("calcularSubtotales", () => {
  it("devuelve arreglo vacío sin filas", () => {
    expect(calcularSubtotales([])).toEqual([]);
  });

  it("agrupa por moneda sumando cotizado y facturado", () => {
    const filas = [
      fila({ moneda: "MXN", cotizado: 100, real_facturado: 90, facturas: [factura({})] }),
      fila({ moneda: "MXN", cotizado: 50, real_facturado: 0, facturas: [] }),
      fila({ moneda: "USD", cotizado: 20, real_facturado: 20, facturas: [factura({})] }),
    ];
    const res = calcularSubtotales(filas);
    const mxn = res.find((r) => r.moneda === "MXN")!;
    expect(mxn.cotizado).toBe(150);
    expect(mxn.facturado).toBe(90);
    expect(mxn.cotizadoFacturable).toBe(100);
    expect(mxn.sinFactura).toBe(1);
    const usd = res.find((r) => r.moneda === "USD")!;
    expect(usd.sinFactura).toBe(0);
    expect(usd.cotizadoFacturable).toBe(20);
  });
});

describe("ordenarFilasPorAjuste", () => {
  it("ordena: con ajuste primero, luego sin factura, luego conciliados", () => {
    const conAjuste = fila({ concepto: "conAjuste", facturas: [factura({})], diferencia: 5 });
    const sinFactura = fila({ concepto: "sinFactura", facturas: [], diferencia: 0 });
    const conciliado = fila({ concepto: "conciliado", facturas: [factura({})], diferencia: 0.001 });
    const res = ordenarFilasPorAjuste([conciliado, sinFactura, conAjuste]);
    expect(res.map((f) => f.concepto)).toEqual(["conAjuste", "sinFactura", "conciliado"]);
  });

  it("dentro del mismo bucket ordena por |diferencia| descendente", () => {
    const a = fila({ concepto: "a", facturas: [factura({})], diferencia: 2 });
    const b = fila({ concepto: "b", facturas: [factura({})], diferencia: -10 });
    const res = ordenarFilasPorAjuste([a, b]);
    expect(res.map((f) => f.concepto)).toEqual(["b", "a"]);
  });

  it("no muta el arreglo original de costos del proveedor", () => {
    const original = [fila({ concepto: "x" }), fila({ concepto: "y" })];
    const copy = [...original];
    ordenarFilasPorAjuste(original);
    expect(original).toEqual(copy);
  });
});

describe("estatusBadgeClass", () => {
  it.each([
    ["conciliado", "success"],
    ["parcial", "warning"],
    ["excedente", "destructive"],
    ["sin_match", "muted"],
  ] as const)("mapea %s a clase con %s", (estatus, expectedFragment) => {
    expect(estatusBadgeClass(estatus)).toContain(expectedFragment);
  });

  it("usa la clase por default para valores desconocidos", () => {
    // @ts-expect-error probando valor fuera de unión
    expect(estatusBadgeClass("otro")).toContain("muted");
  });
});

describe("estatusLabel", () => {
  it.each([
    ["conciliado", "Conciliado"],
    ["parcial", "Parcial"],
    ["excedente", "Excedente"],
    ["sin_match", "Sin factura"],
  ] as const)("mapea %s a etiqueta %s", (estatus, label) => {
    expect(estatusLabel(estatus)).toBe(label);
  });

  it("usa 'Sin factura' por default para valores desconocidos", () => {
    // @ts-expect-error probando valor fuera de unión
    expect(estatusLabel("raro")).toBe("Sin factura");
  });
});

describe("pagoBadgeClass", () => {
  it("mapea la liquidación pagada", () => {
    expect(pagoBadgeClass("Pagado")).toContain("success");
  });
  it("mapea la liquidación pendiente", () => {
    expect(pagoBadgeClass("Pendiente")).toContain("warning");
  });
  it("devuelve default para null", () => {
    expect(pagoBadgeClass(null)).toContain("muted");
  });
  it("devuelve default para valor desconocido", () => {
    expect(pagoBadgeClass("cancelada")).toContain("muted");
  });
});

describe("estadoPagoConcepto", () => {
  it("no muestra pago cuando el costo no tiene factura vinculada", () => {
    expect(estadoPagoConcepto(fila({ estado_liquidacion: "Pendiente" }))).toBeNull();
  });

  it("muestra Pendiente aunque el documento ligado diga Vigente", () => {
    expect(estadoPagoConcepto(fila({
      estado_liquidacion: "Pendiente",
      facturas: [factura({ estatus_pago: "Vigente" })],
    }))).toBe("Pendiente");
  });

  it("respeta la liquidación del costo con varias facturas de distinto estado", () => {
    expect(estadoPagoConcepto(fila({
      estado_liquidacion: "Pendiente",
      facturas: [factura({ estatus_pago: "Pagada" }), factura({ proveedor_factura_id: "f2", estatus_pago: "Vigente" })],
    }))).toBe("Pendiente");
  });

  it("muestra Pagado al liquidarse el costo, independiente de la etiqueta del documento", () => {
    expect(estadoPagoConcepto(fila({
      estado_liquidacion: "Pagado",
      facturas: [factura({ estatus_pago: "Vigente" })],
    }))).toBe("Pagado");
  });

  it("no adivina un estado de liquidación desconocido", () => {
    expect(estadoPagoConcepto(fila({
      estado_liquidacion: "Desconocido",
      facturas: [factura({})],
    }))).toBeNull();
  });
});

describe("fmtFecha", () => {
  it("devuelve 's/f' para null", () => {
    expect(fmtFecha(null)).toBe("s/f");
  });

  it("formatea fecha ISO válida", () => {
    expect(fmtFecha("2024-03-15")).toMatch(/^1[45]\/03\/2024$/);
  });

  it("devuelve el string original si falla el parseo", () => {
    // format lanza con fechas inválidas de tipo Invalid Date
    expect(fmtFecha("no-es-fecha")).toBe("no-es-fecha");
  });
});
