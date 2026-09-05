/**
 * Regresión de zona horaria: el valor del DateTimePickerMx representa hora
 * CDMX. Antes los diálogos usaban `new Date(valor).toISOString()`, que lo
 * interpreta con la zona del navegador y desplazaba la hora persistida.
 */
import { describe, it, expect, afterAll } from "vitest";
import { mxLocalToUtcIso } from "@/lib/date/mx";
import { actividadDefaultFechaMx } from "@/features/crm/domain/actividadDefaultFecha";

const TZ_ORIGINAL = process.env.TZ;

function conTz<T>(tz: string, fn: () => T): T {
  process.env.TZ = tz;
  try {
    return fn();
  } finally {
    process.env.TZ = TZ_ORIGINAL;
  }
}

afterAll(() => {
  process.env.TZ = TZ_ORIGINAL;
});

describe("mxLocalToUtcIso", () => {
  it("convierte hora CDMX a UTC (horario estándar, -06:00)", () => {
    expect(mxLocalToUtcIso("2026-01-15T09:00")).toBe("2026-01-15T15:00:00.000Z");
  });

  it("es idéntico en zonas distintas a CDMX", () => {
    const esperado = "2026-01-15T15:00:00.000Z";
    for (const tz of ["UTC", "Asia/Tokyo", "America/Los_Angeles", "Europe/Madrid"]) {
      expect(conTz(tz, () => mxLocalToUtcIso("2026-01-15T09:00"))).toBe(esperado);
    }
  });

  it("difiere de la interpretación local del navegador (bug corregido)", () => {
    const local = conTz("Asia/Tokyo", () => new Date("2026-01-15T09:00").toISOString());
    expect(local).not.toBe("2026-01-15T15:00:00.000Z");
  });

  it("acepta segundos y conserva vacíos/inválidos como null", () => {
    expect(mxLocalToUtcIso("2026-01-15T09:00:30")).toBe("2026-01-15T15:00:30.000Z");
    expect(mxLocalToUtcIso("")).toBeNull();
    expect(mxLocalToUtcIso(null)).toBeNull();
    expect(mxLocalToUtcIso(undefined)).toBeNull();
    expect(mxLocalToUtcIso("no-es-fecha")).toBeNull();
  });

  it("mantiene la regla de día hábil del default de actividad en otra TZ", () => {
    // Viernes 2026-01-16 18:00 CDMX → siguiente día hábil (lunes 19) 9:00 CDMX.
    const base = new Date("2026-01-17T00:00:00.000Z");
    const local = actividadDefaultFechaMx(base);
    expect(local).toBe("2026-01-19T09:00");
    expect(conTz("Asia/Tokyo", () => mxLocalToUtcIso(local))).toBe("2026-01-19T15:00:00.000Z");
  });
});
