/**
 * P1 · Auditoría IVA — detección de renglones "Por confirmar" que el cálculo
 * está gravando en silencio con la tasa global.
 */
import { describe, it, expect } from "vitest";
import {
  esLineaIvaPorConfirmar,
  hayLineasIvaPorConfirmar,
} from "@/lib/financial/lineasPorConfirmarIva";

const TASA = 0.16;

describe("esLineaIvaPorConfirmar", () => {
  it("detecta la fila legacy sin clasificar que sí recibe IVA", () => {
    expect(esLineaIvaPorConfirmar({ aplica_iva: true }, TASA)).toBe(true);
    expect(esLineaIvaPorConfirmar({ aplica_iva: true, tasa_iva_aplicada: null }, TASA)).toBe(true);
  });

  it("no marca filas con tratamiento explícito", () => {
    expect(esLineaIvaPorConfirmar({ tipo_iva: "gravado_16" }, TASA)).toBe(false);
    expect(esLineaIvaPorConfirmar({ tipo_iva: "gravado_8" }, TASA)).toBe(false);
    expect(esLineaIvaPorConfirmar({ tipo_iva: "exento" }, TASA)).toBe(false);
    expect(esLineaIvaPorConfirmar({ tipo_iva: "tasa_0" }, TASA)).toBe(false);
    expect(esLineaIvaPorConfirmar({ tipo_iva: "no_objeto" }, TASA)).toBe(false);
  });

  it("no marca filas legacy sin IVA: no se infiere que sean exentas ni gravadas", () => {
    expect(esLineaIvaPorConfirmar({ aplica_iva: false }, TASA)).toBe(false);
    expect(esLineaIvaPorConfirmar({ aplica_iva: true, tasa_iva_aplicada: 0 }, TASA)).toBe(false);
  });

  it("tampoco marca una fila legacy con tasa explícita gravada", () => {
    expect(esLineaIvaPorConfirmar({ aplica_iva: true, tasa_iva_aplicada: 0.16 }, TASA)).toBe(false);
  });
});

describe("hayLineasIvaPorConfirmar", () => {
  it("basta una fila sin clasificar", () => {
    expect(
      hayLineasIvaPorConfirmar([{ tipo_iva: "gravado_16" }, { aplica_iva: true }], TASA),
    ).toBe(true);
  });

  it("todo clasificado ⇒ falso; lista vacía o nula ⇒ falso", () => {
    expect(hayLineasIvaPorConfirmar([{ tipo_iva: "exento" }], TASA)).toBe(false);
    expect(hayLineasIvaPorConfirmar([], TASA)).toBe(false);
    expect(hayLineasIvaPorConfirmar(null, TASA)).toBe(false);
  });
});
