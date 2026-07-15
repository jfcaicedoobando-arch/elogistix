/**
 * Tests para el cálculo puro de forecast (Batch F).
 */
import { describe, it, expect } from "vitest";
import { computeForecast } from "../forecast";

const mk = (periodo: string, ingresos: number, costos = 0) => ({
  periodo,
  ingresos,
  costos,
  utilidad: ingresos - costos,
});

describe("computeForecast (dashboardEjecutivo)", () => {
  it("no proyecta si la historia tiene menos de 3 puntos", () => {
    const r = computeForecast([mk("2026-01", 100), mk("2026-02", 200)]);
    expect(r.length).toBe(2);
    expect(r.every((p) => !p.esProyeccion)).toBe(true);
  });

  it("proyecta N meses con promedio móvil de los últimos 3", () => {
    const hist = [
      mk("2026-01", 100),
      mk("2026-02", 200),
      mk("2026-03", 300),
      mk("2026-04", 400),
      mk("2026-05", 500),
      mk("2026-06", 600),
    ];
    const r = computeForecast(hist, 2);
    expect(r.length).toBe(8);
    const proy = r.filter((p) => p.esProyeccion);
    expect(proy.length).toBe(2);
    // Promedio últimos 3 = (400+500+600)/3 = 500
    expect(proy[0].proyeccion).toBe(500);
    expect(proy[0].periodo).toBe("2026-07");
    expect(proy[1].periodo).toBe("2026-08");
    // Banda ±15%
    expect(proy[0].banda_min).toBeCloseTo(425);
    expect(proy[0].banda_max).toBeCloseTo(575);
  });

  it("maneja rollover de año en el mes proyectado (dic → ene)", () => {
    const r = computeForecast(
      [mk("2026-10", 100), mk("2026-11", 100), mk("2026-12", 100)],
      2,
    );
    const proy = r.filter((p) => p.esProyeccion);
    expect(proy[0].periodo).toBe("2027-01");
    expect(proy[1].periodo).toBe("2027-02");
  });

  it("mesesAdelante=0 devuelve sólo puntos reales", () => {
    const r = computeForecast(
      [mk("2026-01", 100), mk("2026-02", 200), mk("2026-03", 300)],
      0,
    );
    expect(r.every((p) => !p.esProyeccion)).toBe(true);
  });

  it("los puntos reales tienen proyeccion/banda en null (no interfieren en la gráfica)", () => {
    const r = computeForecast(
      [mk("2026-01", 100), mk("2026-02", 200), mk("2026-03", 300)],
      1,
    );
    const real = r.filter((p) => !p.esProyeccion);
    expect(real.every((p) => p.proyeccion === null && p.banda_min === null)).toBe(true);
  });
});
