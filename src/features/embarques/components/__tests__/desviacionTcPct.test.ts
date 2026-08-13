import { describe, it, expect } from "vitest";
import { desviacionTcPct } from "../../domain/tcDesviacion";

describe("desviacionTcPct", () => {
  it("devuelve null cuando falta el capturado o la referencia", () => {
    expect(desviacionTcPct(0, 17.4758)).toBeNull();
    expect(desviacionTcPct(17.5, 0)).toBeNull();
  });

  it("calcula la desviación del caso ELIMP00300 (17.50 vs DOF 17.4758)", () => {
    const pct = desviacionTcPct(17.5, 17.4758);
    expect(pct).not.toBeNull();
    expect(pct as number).toBeCloseTo(0.1385, 3);
  });

  it("es negativa cuando el capturado queda por debajo del DOF", () => {
    expect(desviacionTcPct(19, 19.9967) as number).toBeLessThan(-4);
  });

  it("es 0 cuando coincide con el DOF", () => {
    expect(desviacionTcPct(17.4758, 17.4758)).toBe(0);
  });
});
