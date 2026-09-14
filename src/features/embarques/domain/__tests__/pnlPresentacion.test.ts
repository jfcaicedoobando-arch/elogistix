import { describe, expect, it } from "vitest";
import {
  monedasExtranjerasActivas,
  tieneContenedorOperativo,
} from "../pnlPresentacion";

describe("presentación de P&L", () => {
  it("sólo ofrece desglose cuando existe un contenedor operativo", () => {
    expect(tieneContenedorOperativo([])).toBe(false);
    expect(tieneContenedorOperativo([{ numero_contenedor: "  " }])).toBe(false);
    expect(tieneContenedorOperativo([{ numero_contenedor: "MSCU1234567" }])).toBe(true);
    expect(tieneContenedorOperativo([
      { numero_contenedor: "MSCU1234567", deleted_at: "2026-09-14" },
    ])).toBe(false);
  });

  it("detecta sólo monedas extranjeras de conceptos activos", () => {
    expect(monedasExtranjerasActivas([{ moneda: "MXN" }], [{ moneda: "mxn" }])).toEqual([]);
    expect(monedasExtranjerasActivas(
      [{ moneda: "USD" }, { moneda: "EUR", deleted_at: "2026-09-14" }],
      [{ moneda: "eur" }, { moneda: "MXN" }],
    )).toEqual(["EUR", "USD"]);
  });
});