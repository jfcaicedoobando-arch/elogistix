import { describe, it, expect } from "vitest";
import { indexarPorEmbarque, buildFilasProyeccion } from "@/features/facturacion/services/proyeccion/buildFilas";
import type { EmbarqueProyeccionRow } from "@/features/facturacion/services/proyeccion/fetchSources";

describe("indexarPorEmbarque", () => {
  it("agrupa por embarque_id usando la columna indicada", () => {
    const map = indexarPorEmbarque(
      [
        { embarque_id: "e1", total: 100, moneda: "USD" },
        { embarque_id: "e1", total: 50, moneda: "MXN" },
        { embarque_id: "e2", total: 200, moneda: "USD" },
      ],
      "total",
    );
    expect(map.get("e1")).toHaveLength(2);
    expect(map.get("e2")?.[0].monto).toBe(200);
  });

  it("usa MXN cuando moneda es null y 0 cuando monto falta", () => {
    const map = indexarPorEmbarque([{ embarque_id: "e1", monto: null, moneda: null }], "monto");
    expect(map.get("e1")?.[0]).toEqual({ monto: 0, moneda: "MXN" });
  });
});

function emb(over: Partial<EmbarqueProyeccionRow> = {}): EmbarqueProyeccionRow {
  return {
    id: "e1", expediente: "EXP-1", cliente_nombre: "ACME", operador: "u",
    eta: "2026-06-01", contenedor: "ABC123",
    tipo_cambio_usd: 17, tipo_cambio_eur: 18,
    tiene_proforma: false,
    ...over,
  } as EmbarqueProyeccionRow;
}

describe("buildFilasProyeccion", () => {
  it("genera fila con conversiones a MXN y USD", () => {
    const ventas = indexarPorEmbarque(
      [{ embarque_id: "e1", total: 100, moneda: "USD" }],
      "total",
    );
    const costos = indexarPorEmbarque(
      [{ embarque_id: "e1", total: 850, moneda: "MXN" }],
      "total",
    );
    const filas = buildFilasProyeccion([emb()], ventas, costos, new Set());
    expect(filas).toHaveLength(1);
    expect(filas[0].venta_mxn).toBe(1700); // 100 USD * 17
    expect(filas[0].venta_usd).toBe(100);
    expect(filas[0].costo_mxn).toBe(850);
    expect(filas[0].costo_usd).toBe(50); // 850 / 17
    expect(filas[0].tiene_factura_pdf).toBe(false);
  });

  it("marca tiene_factura_pdf=true cuando expediente está en el set", () => {
    const filas = buildFilasProyeccion(
      [emb({ expediente: "EXP-9" })],
      new Map(), new Map(),
      new Set(["EXP-9"]),
    );
    expect(filas[0].tiene_factura_pdf).toBe(true);
  });

  // Ola 5 · M5: sin TC no se asume 1:1; la fila se marca `sin_tc` y el TC queda
  // en 0 para que la conversión a MXN no invente cifras.
  it("marca sin_tc y TC=0 cuando el embarque no trae tipo de cambio", () => {
    const filas = buildFilasProyeccion(
      [emb({ tipo_cambio_usd: null, tipo_cambio_eur: null })],
      new Map(), new Map(), new Set(),
    );
    expect(filas[0].tipo_cambio_usd).toBe(0);
    expect(filas[0].tipo_cambio_eur).toBe(0);
    expect(filas[0].sin_tc).toBe(true);
  });

  it("expediente '' cuando viene null", () => {
    const filas = buildFilasProyeccion(
      [emb({ expediente: null })],
      new Map(), new Map(), new Set(),
    );
    expect(filas[0].expediente).toBe("");
    expect(filas[0].tiene_factura_pdf).toBe(false);
  });
});
