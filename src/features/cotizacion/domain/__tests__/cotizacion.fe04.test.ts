/**
 * FE-04 — Las fechas-calendario se calculan en hora local, no en UTC.
 * Antes, entre 18:00 y 23:59 (UTC−6) `toISOString()` adelantaba el día.
 */
import { describe, it, expect } from "vitest";
import { calcularFechaVigencia } from "../cotizacion.conversion";

describe("calcularFechaVigencia (FE-04)", () => {
  it("suma los días sobre el día LOCAL aunque sea de noche", () => {
    // 23:30 hora local: en UTC ya es el día siguiente.
    const desde = new Date(2026, 7, 10, 23, 30);
    expect(calcularFechaVigencia(desde, 15)).toBe("2026-08-25");
  });

  it("usa el default de 15 días cuando no se especifica vigencia", () => {
    const desde = new Date(2026, 0, 1, 20, 0);
    expect(calcularFechaVigencia(desde, null)).toBe("2026-01-16");
  });

  it("respeta vigencias cortas y cruces de mes", () => {
    const desde = new Date(2026, 7, 30, 19, 15);
    expect(calcularFechaVigencia(desde, 3)).toBe("2026-09-02");
  });
});
