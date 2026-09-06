/**
 * A1/A7 (v13.823.153) — Regresión conectada a la inicialización REAL del
 * formulario: `useConceptosVentaCotizacion` siembra una fila vacía USD y otra
 * MXN, así que el criterio de "borrador sin importes" no puede depender de la
 * longitud de los arreglos. Se comprueba con el mapper del paso 1.
 *
 * Pendiente de ejecución en GitHub Actions.
 */
import { describe, it, expect, vi } from "vitest";
import { renderHook } from "@testing-library/react";

vi.mock("@/features/catalogos/hooks/useTasaIVA", () => ({ useTasaIVA: () => 0.16 }));

import { useConceptosVentaCotizacion } from "../useConceptosVentaCotizacion";
import { esBorradorSinImportes } from "@/features/cotizacion/domain/cotizacionSinImportes";
import { monedaPaso1 } from "@/features/cotizacion/domain/mappers/cotizacion";
import type { CotizacionFormValues } from "@/features/cotizacion/domain/schemas/cotizacionSchema";

const values = { monedaCrm: "MXN" } as unknown as CotizacionFormValues;

describe("borrador vacío + moneda del CRM (paso 1)", () => {
  it("las filas sembradas por el formulario NO cuentan como importes", () => {
    const { result } = renderHook(() => useConceptosVentaCotizacion());
    const { conceptosUSD, conceptosMXN } = result.current;
    expect(conceptosUSD).toHaveLength(1);
    expect(conceptosMXN).toHaveLength(1);

    const sinImportes = esBorradorSinImportes(conceptosUSD, conceptosMXN, []);
    expect(sinImportes).toBe(true);
    expect(monedaPaso1(values, sinImportes)).toBe("MXN");
  });

  it("un concepto con descripción o importe protege la moneda", () => {
    const conVenta = [
      { descripcion: "Flete", cantidad: 1, precio_unitario: 1000, total: 1160 },
    ];
    expect(esBorradorSinImportes(conVenta, [], [])).toBe(false);
    expect(monedaPaso1(values, false)).toBeUndefined();
  });

  it("conceptos compensados a total cero siguen contando como contenido", () => {
    const compensados = [
      { descripcion: "Cargo", cantidad: 1, precio_unitario: 500, total: 500 },
      { descripcion: "Descuento", cantidad: 1, precio_unitario: -500, total: -500 },
    ];
    expect(esBorradorSinImportes(compensados, [], [])).toBe(false);
  });

  it("un costo interno con precio de venta también protege la moneda", () => {
    const { result } = renderHook(() => useConceptosVentaCotizacion());
    const { conceptosUSD, conceptosMXN } = result.current;
    expect(
      esBorradorSinImportes(conceptosUSD, conceptosMXN, [{ precio_venta: 1200 }]),
    ).toBe(false);
  });

  it("reintentar el vínculo tras el fallo mantiene el criterio (idempotente)", () => {
    const { result } = renderHook(() => useConceptosVentaCotizacion());
    const { conceptosUSD, conceptosMXN } = result.current;
    const primero = esBorradorSinImportes(conceptosUSD, conceptosMXN, []);
    const segundo = esBorradorSinImportes(conceptosUSD, conceptosMXN, []);
    expect(primero).toBe(true);
    expect(segundo).toBe(true);
  });
});
