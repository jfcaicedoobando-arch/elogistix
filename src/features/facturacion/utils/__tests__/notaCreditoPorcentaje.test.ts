import { describe, expect, it } from "vitest";
import type { ConceptoNotaCredito } from "@/features/facturacion/services/notasCredito";
import { aplicarPorcentaje, conceptosSeleccionados } from "../notaCreditoSugerencias";
import { calcularTotalesNC } from "../notaCreditoTotales";

const concepto: ConceptoNotaCredito = {
  descripcion: "Servicio",
  cantidad: 100,
  precio_unitario: 1,
  clave_sat: "84111506",
  clave_unidad: "E48",
  unidad: "Servicio",
  tipo_iva: "tasa_0",
  tasa_iva: 0,
};

const tratamientos = [
  { tipo_iva: "tasa_0", tasa_iva: 0, iva: 0, total: 50.5 },
  { tipo_iva: "exento", tasa_iva: 0, iva: 0, total: 50.5 },
  { tipo_iva: "no_objeto", tasa_iva: 0, iva: 0, total: 50.5 },
  { tipo_iva: "gravado_8", tasa_iva: 0.08, iva: 4.04, total: 54.54 },
  { tipo_iva: "gravado_16", tasa_iva: 0.16, iva: 8.08, total: 58.58 },
] as const;

describe("Auditoría 107 · precisión del porcentaje de nota de crédito", () => {
  it.each([
    { cantidad: 1, porcentaje: 0, precio: 0, subtotal: 0 },
    { cantidad: 1, porcentaje: 50.5, precio: 0.505, subtotal: 0.51 },
    { cantidad: 1, porcentaje: 100, precio: 1, subtotal: 1 },
    { cantidad: 100, porcentaje: 0, precio: 0, subtotal: 0 },
    { cantidad: 100, porcentaje: 50.5, precio: 0.505, subtotal: 50.5 },
    { cantidad: 100, porcentaje: 100, precio: 1, subtotal: 100 },
    { cantidad: 0.125, porcentaje: 0, precio: 0, subtotal: 0 },
    { cantidad: 0.125, porcentaje: 50.5, precio: 0.505, subtotal: 0.06 },
    { cantidad: 0.125, porcentaje: 100, precio: 1, subtotal: 0.13 },
  ])("cantidad $cantidad al $porcentaje% conserva el unitario y redondea el subtotal", ({ cantidad, porcentaje, precio, subtotal }) => {
    const original = { ...concepto, cantidad };
    const [resultado] = aplicarPorcentaje([original], porcentaje);
    expect(resultado).toEqual({ ...original, precio_unitario: precio });
    expect(resultado).not.toBe(original);
    expect(original.precio_unitario).toBe(1);
    expect(calcularTotalesNC([resultado])).toEqual({ subtotal, iva: 0, retIsr: 0, retIva: 0, total: subtotal });
  });

  it.each(tratamientos)("conserva $tipo_iva al aplicar 50.5%", ({ tipo_iva, tasa_iva, iva, total }) => {
    const original = { ...concepto, tipo_iva, tasa_iva };
    const [resultado] = aplicarPorcentaje([original], 50.5);
    expect(resultado).toEqual({ ...original, precio_unitario: 0.505 });
    expect(calcularTotalesNC([resultado])).toEqual({ subtotal: 50.5, iva, retIsr: 0, retIva: 0, total });
  });

  it("conserva las retenciones y calcula cada impuesto sobre el subtotal de la línea", () => {
    const original: ConceptoNotaCredito = {
      ...concepto, tipo_iva: "gravado_16", tasa_iva: 0.16, tasa_ret_isr: 0.1, tasa_ret_iva: 0.04,
    };
    const [resultado] = aplicarPorcentaje([original], 50.5);
    expect(resultado).toEqual({ ...original, precio_unitario: 0.505 });
    expect(calcularTotalesNC([resultado])).toEqual({
      subtotal: 50.5, iva: 8.08, retIsr: 5.05, retIva: 2.02, total: 51.51,
    });
  });

  it.each([
    { precio: 0.1, cantidad: 0.5, porcentaje: 70, unitario: 0.07, subtotal: 0.04 },
    { precio: 1, cantidad: 100, porcentaje: 50.494, unitario: 0.50494, subtotal: 50.49 },
    { precio: 1, cantidad: 100, porcentaje: 50.495, unitario: 0.50495, subtotal: 50.5 },
    { precio: 1, cantidad: 100, porcentaje: 50.496, unitario: 0.50496, subtotal: 50.5 },
    { precio: 0.1234567, cantidad: 1_000_000, porcentaje: 50.5, unitario: 0.0623456335, subtotal: 62345.63 },
    { precio: 0.1234567, cantidad: 1_000_000, porcentaje: 100, unitario: 0.1234567, subtotal: 123456.7 },
  ])("redondea sólo la línea: $cantidad × $precio al $porcentaje%", ({ precio, cantidad, porcentaje, unitario, subtotal }) => {
    const [resultado] = aplicarPorcentaje([{ ...concepto, cantidad, precio_unitario: precio }], porcentaje);
    expect(resultado.precio_unitario).toBe(unitario);
    expect(calcularTotalesNC([resultado]).subtotal).toBe(subtotal);
  });

  it("sólo escala la selección y no modifica sus conceptos originales", () => {
    const omitido = { ...concepto, descripcion: "Omitido", precio_unitario: 500 };
    const original = { ...concepto };
    const elegidos = conceptosSeleccionados([omitido, original], [1]);
    expect(aplicarPorcentaje(elegidos, 50.5)).toEqual([{ ...original, precio_unitario: 0.505 }]);
    expect(elegidos).toEqual([original]);
    expect(omitido.precio_unitario).toBe(500);
    expect(original.precio_unitario).toBe(1);
  });

  it.each([Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, -1])("porcentaje inválido %s conserva la normalización a cero", (porcentaje) => {
    expect(aplicarPorcentaje([concepto], porcentaje)[0].precio_unitario).toBe(0);
  });

  it("acota el porcentaje a 100 sin perder decimales del precio original", () => {
    const original = { ...concepto, precio_unitario: 0.1234567 };
    expect(aplicarPorcentaje([original], 101)).toEqual([original]);
  });

  it.each([Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])("precio no finito %s conserva la normalización a cero", (precio) => {
    expect(aplicarPorcentaje([{ ...concepto, precio_unitario: precio }], 50.5)[0].precio_unitario).toBe(0);
  });
});
