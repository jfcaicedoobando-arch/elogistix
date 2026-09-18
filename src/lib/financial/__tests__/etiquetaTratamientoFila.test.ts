/**
 * P2-IVA — La columna IVA de proformas muestra el tratamiento real y
 * "Por confirmar" cuando los datos heredados no alcanzan.
 */
import { describe, it, expect } from "vitest";
import {
  etiquetaTratamientoFila,
  ETIQUETA_TRATAMIENTO_POR_CONFIRMAR,
} from "@/lib/financial/etiquetaTratamientoFila";

describe("etiquetaTratamientoFila", () => {
  it("muestra el tratamiento registrado", () => {
    expect(etiquetaTratamientoFila({ tipo_iva: "gravado_16" })).toMatch(/16/);
    expect(etiquetaTratamientoFila({ tipo_iva: "gravado_8" })).toMatch(/8/);
    expect(etiquetaTratamientoFila({ tipo_iva: "tasa_0" })).toMatch(/0/);
    expect(etiquetaTratamientoFila({ tipo_iva: "exento" })).toMatch(/xento/);
    expect(etiquetaTratamientoFila({ tipo_iva: "no_objeto" })).toMatch(/objeto/i);
  });

  it("no deduce exento ni tasa 0 de tener el IVA apagado", () => {
    expect(etiquetaTratamientoFila({ aplica_iva: false })).toBe(
      ETIQUETA_TRATAMIENTO_POR_CONFIRMAR,
    );
    expect(etiquetaTratamientoFila({ aplica_iva: false, tasa_iva_aplicada: 0.16 })).toBe(
      ETIQUETA_TRATAMIENTO_POR_CONFIRMAR,
    );
    expect(etiquetaTratamientoFila({ tasa_iva_aplicada: 0 })).toBe(
      ETIQUETA_TRATAMIENTO_POR_CONFIRMAR,
    );
    expect(etiquetaTratamientoFila({})).toBe(ETIQUETA_TRATAMIENTO_POR_CONFIRMAR);
  });

  it("lee una fila heredada con tasa gravada explícita", () => {
    expect(etiquetaTratamientoFila({ tasa_iva_aplicada: 0.08 })).toMatch(/8/);
    expect(etiquetaTratamientoFila({ tasa_iva_aplicada: 0.16 })).toMatch(/16/);
    expect(etiquetaTratamientoFila({ tasa_iva_aplicada: 0.11 })).toBe("11.00%");
  });
});
