/**
 * R201-COT-05 / R201-COT-08 — Hidratación de conceptos desde la cotización en
 * el asistente de embarques:
 *  - el costo replicado es el TOTAL del renglón (cantidad × unitario), no el
 *    costo unitario;
 *  - el tratamiento fiscal capturado en la cotización viaja tal cual (sin
 *    inferirlo por moneda).
 */
import { describe, it, expect } from "vitest";
import {
  mapConceptosCostoFromCotizacion,
  mapConceptosVentaFromCotizacion,
} from "@/features/embarques/domain/embarqueWizard";
import type { CotizacionRow } from "@/features/cotizacion/types";

describe("R201-COT-05 — costo replicado = total del renglón", () => {
  it("usa costo_total cuando la BD lo entrega", () => {
    const [fila] = mapConceptosCostoFromCotizacion(
      [{ proveedor: "Naviera X", concepto: "Flete", costo_unitario: 1200, cantidad: 3, costo_total: 3600, moneda: "USD" }],
      [{ id: "p1", nombre: "Naviera X" }],
    );
    expect(fila.monto).toBe(3600);
    expect(fila.proveedorId).toBe("p1");
  });

  it("cae a cantidad × unitario si falta el total generado", () => {
    const [fila] = mapConceptosCostoFromCotizacion(
      [{ proveedor: null, concepto: "Handling", costo_unitario: "150.5", cantidad: "2", costo_total: null, moneda: "MXN" }],
      [],
    );
    expect(fila.monto).toBe(301);
  });

  it("respeta un total de cero explícito", () => {
    const [fila] = mapConceptosCostoFromCotizacion(
      [{ proveedor: null, concepto: "Cortesía", costo_unitario: 500, cantidad: 1, costo_total: 0, moneda: "USD" }],
      [],
    );
    expect(fila.monto).toBe(0);
  });

  it("sin cantidad trata el renglón como uno", () => {
    const [fila] = mapConceptosCostoFromCotizacion(
      [{ proveedor: null, concepto: "Doc fee", costo_unitario: 75, moneda: "USD" }],
      [],
    );
    expect(fila.monto).toBe(75);
  });
});

describe("R201-COT-08 — el IVA de la cotización viaja al embarque", () => {
  const cot = (conceptos: unknown) => ({ conceptos_venta: conceptos } as unknown as CotizacionRow);

  it("conserva aplica_iva=false y tasa 0", () => {
    const [fila] = mapConceptosVentaFromCotizacion(
      cot([{ descripcion: "Flete", cantidad: 1, precio_unitario: 1000, moneda: "MXN", aplica_iva: false, tasa_iva_aplicada: 0 }]),
    );
    expect(fila.aplicaIva).toBe(false);
    expect(fila.tasaIva).toBe(0);
  });

  it("conserva la tasa de frontera 8%", () => {
    const [fila] = mapConceptosVentaFromCotizacion(
      cot([{ descripcion: "Maniobra", cantidad: 2, precio_unitario: 500, moneda: "MXN", aplica_iva: true, tasa_iva_aplicada: 0.08 }]),
    );
    expect(fila.aplicaIva).toBe(true);
    expect(fila.tasaIva).toBe(0.08);
  });

  it("deja null cuando la cotización no lo definió (no infiere por moneda)", () => {
    const [fila] = mapConceptosVentaFromCotizacion(
      cot([{ descripcion: "Flete", cantidad: 1, precio_unitario: 100, moneda: "USD" }]),
    );
    expect(fila.aplicaIva).toBeNull();
    expect(fila.tasaIva).toBeNull();
  });
});
