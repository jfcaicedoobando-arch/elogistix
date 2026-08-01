import { describe, it, expect } from "vitest";
import {
  calcularSubtotales,
  ordenarFilasPorAjuste,
  estatusBadgeClass,
  estatusLabel,
  pagoBadgeClass,
  peorEstadoPago,
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

  it("no muta el arreglo original", () => {
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
  it("mapea pagada", () => {
    expect(pagoBadgeClass("pagada")).toContain("success");
  });
  it("mapea vencida", () => {
    expect(pagoBadgeClass("vencida")).toContain("destructive");
  });
  it("mapea vigente", () => {
    expect(pagoBadgeClass("VIGENTE")).toContain("warning");
  });
  it("devuelve default para null", () => {
    expect(pagoBadgeClass(null)).toContain("muted");
  });
  it("devuelve default para valor desconocido", () => {
    expect(pagoBadgeClass("cancelada")).toContain("muted");
  });
});

describe("peorEstadoPago", () => {
  it("devuelve null sin facturas", () => {
    expect(peorEstadoPago([])).toBeNull();
  });

  it("devuelve el peor estado con capitalización", () => {
    const facturas = [
      factura({ estatus_pago: "pagada" }),
      factura({ estatus_pago: "vencida" }),
      factura({ estatus_pago: "vigente" }),
    ];
    expect(peorEstadoPago(facturas)).toBe("Vencida");
  });

  it("maneja estatus_pago null: la cadena vacía es falsy y devuelve null", () => {
    const facturas = [factura({ estatus_pago: null })];
    const res = peorEstadoPago(facturas);
    expect(res).toBeNull();
  });

  it("con una sola factura vigente devuelve Vigente", () => {
    expect(peorEstadoPago([factura({ estatus_pago: "vigente" })])).toBe("Vigente");
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
