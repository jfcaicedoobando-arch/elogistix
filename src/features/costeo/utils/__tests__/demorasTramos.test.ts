import { describe, it, expect } from "vitest";
import {
  tramosSeSolapan,
  encontrarSolapeTramos,
  vigenciasSeSolapan,
} from "../demorasTramos";

describe("tramosSeSolapan (B-096)", () => {
  it("detecta intersección simple", () => {
    expect(tramosSeSolapan({ desde_dia: 1, hasta_dia: 5 }, { desde_dia: 4, hasta_dia: 9 })).toBe(true);
  });

  it("tramos contiguos no se consideran solapados", () => {
    expect(tramosSeSolapan({ desde_dia: 1, hasta_dia: 5 }, { desde_dia: 6, hasta_dia: 10 })).toBe(false);
  });

  it("un tramo abierto (hasta null) solapa con todo lo posterior", () => {
    expect(tramosSeSolapan({ desde_dia: 6, hasta_dia: null }, { desde_dia: 30, hasta_dia: 40 })).toBe(true);
  });

  it("un tramo abierto no solapa con lo anterior a su inicio", () => {
    expect(tramosSeSolapan({ desde_dia: 20, hasta_dia: null }, { desde_dia: 1, hasta_dia: 19 })).toBe(false);
  });
});

describe("encontrarSolapeTramos (B-096)", () => {
  it("devuelve null para un tabulador escalonado válido", () => {
    expect(
      encontrarSolapeTramos([
        { desde_dia: 1, hasta_dia: 5 },
        { desde_dia: 6, hasta_dia: 10 },
        { desde_dia: 11, hasta_dia: null },
      ]),
    ).toBeNull();
  });

  it("reporta el primer par solapado con posiciones 1-based", () => {
    expect(
      encontrarSolapeTramos([
        { desde_dia: 1, hasta_dia: 5 },
        { desde_dia: 6, hasta_dia: 10 },
        { desde_dia: 9, hasta_dia: 20 },
      ]),
    ).toEqual({ i: 2, j: 3 });
  });

  it("marca un rango invertido antes de buscar solapes", () => {
    expect(encontrarSolapeTramos([{ desde_dia: 10, hasta_dia: 3 }])).toEqual({
      i: 1,
      j: 1,
      invertido: true,
    });
  });

  it("dos tramos abiertos siempre solapan", () => {
    expect(
      encontrarSolapeTramos([
        { desde_dia: 6, hasta_dia: null },
        { desde_dia: 15, hasta_dia: null },
      ]),
    ).toEqual({ i: 1, j: 2 });
  });

  it("lista vacía o de un solo tramo es válida", () => {
    expect(encontrarSolapeTramos([])).toBeNull();
    expect(encontrarSolapeTramos([{ desde_dia: 1, hasta_dia: null }])).toBeNull();
  });
});

describe("vigenciasSeSolapan (B-096)", () => {
  it("detecta traslape de vigencias cerradas", () => {
    expect(vigenciasSeSolapan("2026-01-01", "2026-06-30", "2026-06-30", "2026-12-31")).toBe(true);
  });

  it("vigencias consecutivas no traslapan", () => {
    expect(vigenciasSeSolapan("2026-01-01", "2026-06-29", "2026-06-30", "2026-12-31")).toBe(false);
  });

  it("una vigencia abierta traslapa con cualquier posterior", () => {
    expect(vigenciasSeSolapan("2026-01-01", null, "2030-01-01", "2030-12-31")).toBe(true);
  });
});
