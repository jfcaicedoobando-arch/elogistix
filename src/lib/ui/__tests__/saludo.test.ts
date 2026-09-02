import { describe, it, expect } from "vitest";
import { saludoMx } from "@/lib/ui/saludo";
import { horaMx } from "@/lib/date/mx";

/**
 * v13.823.23 — El saludo debe depender de la hora de negocio (CDMX) y NO de la
 * zona del runner: 18:05 CDMX = 00:05 UTC del día siguiente.
 */
describe("saludoMx", () => {
  it("usa la hora de CDMX, no la del runner", () => {
    // 2026-09-02T00:05:00Z === 2026-09-01 18:05 CDMX
    const instante = new Date("2026-09-02T00:05:00Z");
    expect(horaMx(instante)).toBe(18);
    expect(saludoMx(instante)).toBe("Buenas tardes");
  });

  it("cubre las tres bandas del día", () => {
    expect(saludoMx(new Date("2026-09-01T15:00:00Z"))).toBe("Buenos días"); // 09:00 CDMX
    expect(saludoMx(new Date("2026-09-01T20:00:00Z"))).toBe("Buenas tardes"); // 14:00 CDMX
    expect(saludoMx(new Date("2026-09-02T04:00:00Z"))).toBe("Buenas noches"); // 22:00 CDMX
  });

  it("medianoche CDMX no se desborda a hora 24", () => {
    expect(horaMx(new Date("2026-09-02T06:10:00Z"))).toBe(0); // 00:10 CDMX
    expect(saludoMx(new Date("2026-09-02T06:10:00Z"))).toBe("Buenos días");
  });
});
