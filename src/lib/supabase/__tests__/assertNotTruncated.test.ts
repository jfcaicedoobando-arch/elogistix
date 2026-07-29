import { describe, it, expect } from "vitest";
import { assertNotTruncated, ResultadoTruncadoError } from "../assertNotTruncated";

describe("assertNotTruncated (FIX C3)", () => {
  it("devuelve las filas cuando el resultado es parcial", () => {
    expect(assertNotTruncated([1, 2, 3], 10, "test")).toEqual([1, 2, 3]);
  });

  it("normaliza null/undefined a arreglo vacío", () => {
    expect(assertNotTruncated(null, 10, "test")).toEqual([]);
    expect(assertNotTruncated(undefined, 10, "test")).toEqual([]);
  });

  it("lanza cuando el resultado llega exactamente al cap", () => {
    expect(() => assertNotTruncated([1, 2], 2, "modulo.consulta")).toThrow(ResultadoTruncadoError);
  });

  it("expone código y contexto para la UI", () => {
    try {
      assertNotTruncated([1], 1, "facturacion.fetchCobranza");
      expect.unreachable();
    } catch (e) {
      const err = e as ResultadoTruncadoError;
      expect(err.code).toBe("LC_RESULTADO_TRUNCADO");
      expect(err.contexto).toBe("facturacion.fetchCobranza");
      expect(err.limite).toBe(1);
      expect(err.message).toContain("facturacion.fetchCobranza");
    }
  });

  it("no lanza cuando el límite es 0 (sin cap declarado)", () => {
    expect(assertNotTruncated([], 0, "test")).toEqual([]);
  });
});
