import { describe, it, expect } from "vitest";
import {
  formatDateTimeShort,
  formatFechaEs,
  formatFechaHora,
  formatFechaLarga,
} from "@/lib/formatters/dates";

/**
 * Ronda 7 · R7-FE-02 — la fecha/hora mostrada debe corresponder a la zona de
 * negocio (America/Mexico_City) y no a la zona del navegador del usuario.
 *
 * `2026-07-31T02:30:00Z` es 31 de julio en UTC pero 30 de julio 20:30 en CDMX.
 */
const ISO_CRUCE_DIA = "2026-07-31T02:30:00Z";

describe("formatters/dates · zona horaria de negocio", () => {
  it("01 · formatFechaHora usa CDMX y no UTC en el cruce de día", () => {
    expect(formatFechaHora(ISO_CRUCE_DIA)).toContain("30/07/2026");
  });

  it("02 · formatDateTimeShort usa el día CDMX", () => {
    expect(formatDateTimeShort(ISO_CRUCE_DIA)).toMatch(/^30 /);
  });

  it("03 · formatFechaLarga usa el día CDMX", () => {
    expect(formatFechaLarga(ISO_CRUCE_DIA)).toContain("30 de julio de 2026");
  });

  it("04 · formatFechaEs con fecha sólo-día no se corre de día", () => {
    expect(formatFechaEs("2026-07-31")).toBe("31/07/2026");
  });

  it("05 · formatFechaEs con ISO+hora respeta CDMX", () => {
    expect(formatFechaEs(ISO_CRUCE_DIA)).toBe("30/07/2026");
  });

  it("06 · se puede sobrescribir la zona horaria", () => {
    expect(formatFechaEs(ISO_CRUCE_DIA, { timeZone: "UTC" })).toBe("31/07/2026");
  });

  it("07 · valores vacíos devuelven guión", () => {
    expect(formatFechaHora(null)).toBe("-");
    expect(formatFechaEs(undefined)).toBe("-");
    expect(formatFechaLarga("")).toBe("-");
    expect(formatDateTimeShort("")).toBe("-");
  });
});
