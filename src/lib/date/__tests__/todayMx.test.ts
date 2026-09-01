/**
 * Ola v13.823.7 · P2: `today.ts` prometía México pero formateaba en la zona
 * del navegador/runner. Ahora delega en `hoyMx` y la suma de días es date-only.
 */
import { describe, it, expect } from "vitest";
import { todayLocalISO, todayLocalISOPlus } from "@/lib/date/today";

describe("todayLocalISO usa el día de negocio de México", () => {
  it("23:30 CDMX del 31/08 sigue siendo 31/08 (no 01/09 UTC)", () => {
    expect(todayLocalISO(new Date("2026-08-31T23:30:00-06:00"))).toBe("2026-08-31");
  });

  it("00:30 CDMX del 01/09 ya es 01/09", () => {
    expect(todayLocalISO(new Date("2026-09-01T00:30:00-06:00"))).toBe("2026-09-01");
  });

  it("el mismo instante da el mismo día sin importar la TZ del runner", () => {
    // 2026-09-01T05:00:00Z = 23:00 del 31/08 en CDMX y 22:00 en Los Ángeles.
    const instante = new Date("2026-09-01T05:00:00Z");
    expect(todayLocalISO(instante)).toBe("2026-08-31");
  });
});

describe("todayLocalISOPlus suma días date-only", () => {
  it("cruza el fin de mes desde el día de negocio de México", () => {
    const instante = new Date("2026-08-31T23:30:00-06:00");
    expect(todayLocalISOPlus(0, instante)).toBe("2026-08-31");
    expect(todayLocalISOPlus(1, instante)).toBe("2026-09-01");
    expect(todayLocalISOPlus(-1, instante)).toBe("2026-08-30");
  });

  it("suma 30 días cruzando el cambio de horario sin corrimiento", () => {
    // Del 20/10 al 19/11: México terminó el horario de verano en 2022, pero la
    // aritmética date-only no depende de eso.
    expect(todayLocalISOPlus(30, new Date("2026-10-20T18:00:00Z"))).toBe("2026-11-19");
  });

  it("acepta el default sin argumentos", () => {
    expect(todayLocalISOPlus(0)).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
