import { describe, it, expect } from "vitest";
import {
  costosSinConcepto,
  filaCostoInvalida,
  indicesCostosSinConcepto,
  requiereSincronizarVenta,
  tieneImportes,
} from "../cotizacionVentaSync";
import { buildConceptosFromCostos } from "../cotizacion.conceptos";
import type { FilaCostoLocal } from "@/features/cotizacion/types";

const fila = (over: Partial<FilaCostoLocal> = {}): FilaCostoLocal => ({
  concepto: "Flete marítimo",
  moneda: "MXN",
  proveedor: "",
  cantidad: 1,
  costo_unitario: 78000,
  precio_venta: 82000,
  unidad_medida: "",
  ...over,
});

describe("tieneImportes", () => {
  it("detecta costo o venta > 0", () => {
    expect(tieneImportes(fila())).toBe(true);
    expect(tieneImportes(fila({ costo_unitario: 0, precio_venta: 0 }))).toBe(false);
  });
});

describe("costosSinConcepto (B-081)", () => {
  it("marca renglones con importes y concepto vacío", () => {
    const filas = [fila(), fila({ concepto: "" }), fila({ concepto: "   " })];
    expect(costosSinConcepto(filas)).toHaveLength(2);
    expect(indicesCostosSinConcepto(filas)).toEqual([1, 2]);
  });

  it("ignora renglones vacíos sin importes", () => {
    expect(costosSinConcepto([fila({ concepto: "", costo_unitario: 0, precio_venta: 0 })])).toHaveLength(0);
  });

  it("filaCostoInvalida coincide con la regla", () => {
    expect(filaCostoInvalida(fila({ concepto: "" }))).toBe(true);
    expect(filaCostoInvalida(fila())).toBe(false);
  });
});

describe("requiereSincronizarVenta", () => {
  it("es true cuando hay venta en costos y la venta guardada es 0", () => {
    expect(requiereSincronizarVenta([{ concepto: "Flete", costo_unitario: 78000, precio_venta: 82000 }], 0)).toBe(true);
  });
  it("es false cuando la venta guardada ya tiene importes", () => {
    expect(requiereSincronizarVenta([{ concepto: "Flete", costo_unitario: 78000, precio_venta: 82000 }], 82000)).toBe(false);
  });
  it("es false cuando los costos no tienen venta", () => {
    expect(requiereSincronizarVenta([{ concepto: "Flete", costo_unitario: 78000, precio_venta: 0 }], 0)).toBe(false);
  });
});

describe("sincronización desde costos (caso COT-2026-0167)", () => {
  it("genera importes correctos en MXN y USD cuando el concepto está capturado", () => {
    const { usd, mxn } = buildConceptosFromCostos(
      [
        fila({ concepto: "Flete terrestre", moneda: "MXN", costo_unitario: 78000, precio_venta: 82000 }),
        fila({ concepto: "Handling", moneda: "USD", costo_unitario: 377.79, precio_venta: 1169.35 }),
      ],
      0.16,
    );
    expect(mxn[0].precio_unitario).toBe(82000);
    expect(usd[0].precio_unitario).toBe(1169.35);
  });

  it("descarta el renglón sin concepto (raíz del PDF en $0.00)", () => {
    const { mxn } = buildConceptosFromCostos([fila({ concepto: "" })], 0.16);
    expect(mxn).toHaveLength(0);
  });
});
