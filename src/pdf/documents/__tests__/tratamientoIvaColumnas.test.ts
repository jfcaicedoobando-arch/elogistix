import { describe, expect, it } from "vitest";
import { columnasMXN as columnasProforma } from "../proformaConceptosColumns";
import { columnasMXN, columnasUSD } from "../cotizacionColumnas";

const filas = [
  ["gravado_16", "16%"], ["gravado_8", "8%"], ["tasa_0", "0%"],
  ["exento", "Exento"], ["no_objeto", "No objeto"], [null, "Por confirmar"],
] as const;

function etiqueta(columnas: ReturnType<typeof columnasMXN>, tipo_iva: string | null): string {
  const columna = columnas.find((item) => item.key === "tratamiento");
  return String(columna?.render?.({ tipo_iva, aplica_iva: false } as never));
}

describe("tratamiento fiscal por renglón en PDF", () => {
  it.each(filas)("proforma distingue %s como %s", (tipo, esperado) => {
    expect(etiqueta(columnasProforma(0.16, false) as never, tipo)).toBe(esperado);
  });

  it.each(filas)("cotización MXN distingue %s como %s", (tipo, esperado) => {
    expect(etiqueta(columnasMXN(0.16, false), tipo)).toBe(esperado);
  });

  it.each(filas)("cotización USD distingue %s como %s", (tipo, esperado) => {
    expect(etiqueta(columnasUSD(0.16, false), tipo)).toBe(esperado);
  });
});