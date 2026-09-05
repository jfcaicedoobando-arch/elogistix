/**
 * Regresión de zona horaria del CRM (Mi día / dashboard): las comparaciones de
 * "hoy" y "vencida" deben usar el calendario de negocio America/Mexico_City,
 * no el reloj del navegador. Antes un usuario en UTC veía otro día en
 * "Mis actividades de hoy", "Cerrando esta semana" y las próximas actividades.
 */
import { describe, it, expect, afterAll, vi } from "vitest";
import { diaMx, diffDiasMx, limitesDiaMx } from "@/lib/date/mx";
import { esHoy, esVencida } from "@/features/crm/domain/proximasActividades";
import { formatProx } from "@/features/crm/domain/proximaActividadLabel";

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

/** 2026-06-16 03:00 UTC = 2026-06-15 21:00 CDMX (día de negocio: 15). */
const NOCHE_MX = new Date("2026-06-16T03:00:00Z");
/** 2026-06-15 05:00 UTC = 2026-06-14 23:00 CDMX (día de negocio: 14). */
const MADRUGADA_UTC = new Date("2026-06-15T05:00:00Z");

describe("diaMx", () => {
  it("usa el día CDMX aunque en UTC ya sea el siguiente", () => {
    expect(diaMx(NOCHE_MX)).toBe("2026-06-15");
    expect(diaMx(MADRUGADA_UTC)).toBe("2026-06-14");
  });

  it("respeta los date-only tal cual (ya son días de negocio)", () => {
    expect(diaMx("2026-06-15")).toBe("2026-06-15");
    expect(diaMx(null)).toBeNull();
    expect(diaMx("no-fecha")).toBeNull();
  });
});

describe("limitesDiaMx", () => {
  it("acota el día CDMX en instantes UTC (21:00 CDMX del día 15)", () => {
    const { inicio, fin } = limitesDiaMx(NOCHE_MX);
    expect(inicio).toBe("2026-06-15T06:00:00.000Z");
    expect(fin).toBe("2026-06-16T05:59:59.000Z");
  });

  it("es idéntico con el navegador en UTC o en CDMX", () => {
    const enUtc = conTz("UTC", () => limitesDiaMx(NOCHE_MX));
    const enMx = conTz("America/Mexico_City", () => limitesDiaMx(NOCHE_MX));
    expect(enUtc).toEqual(enMx);
  });
});

describe("diffDiasMx", () => {
  it("cuenta días de calendario CDMX cerca de medianoche", () => {
    expect(diffDiasMx(NOCHE_MX, "2026-06-15")).toBe(0);
    expect(diffDiasMx(NOCHE_MX, "2026-06-16")).toBe(1);
    expect(diffDiasMx(NOCHE_MX, "2026-06-14")).toBe(-1);
    expect(diffDiasMx(NOCHE_MX, null)).toBeNull();
  });
});

describe("esHoy / esVencida con calendario MX", () => {
  it("21:00 CDMX sigue siendo el mismo día de negocio", () => {
    for (const tz of ["UTC", "America/Mexico_City"]) {
      conTz(tz, () => {
        expect(esHoy("2026-06-15T16:00:00Z", NOCHE_MX)).toBe(true);
        expect(esVencida("2026-06-15T16:00:00Z", NOCHE_MX)).toBe(false);
        expect(esVencida("2026-06-14T16:00:00Z", NOCHE_MX)).toBe(true);
      });
    }
  });

  it("23:00 CDMX del día anterior no adelanta el día", () => {
    expect(esHoy("2026-06-14", MADRUGADA_UTC)).toBe(true);
    expect(esHoy("2026-06-15", MADRUGADA_UTC)).toBe(false);
    expect(esVencida("2026-06-13", MADRUGADA_UTC)).toBe(true);
  });
});

describe("formatProx", () => {
  it("devuelve el asunto cuando no hay fecha programada", () => {
    expect(
      formatProx({ id: "1", asunto: "Llamar", tipo: "llamada" as const, fecha_programada: null, entidad_id: "op", entidad_tipo: "oportunidad" }),
    ).toBe("Llamar");
  });

  it("etiqueta Hoy/Mañana/Vencida según el calendario MX cerca de medianoche", () => {
    const act = (fecha: string) => ({
      id: "1",
      asunto: "Llamar",
      tipo: "llamada" as const,
      fecha_programada: fecha,
      entidad_id: "op",
      entidad_tipo: "oportunidad" as const,
    });
    vi.useFakeTimers();
    try {
      // 21:00 CDMX del 15 (en UTC ya es el 16).
      vi.setSystemTime(NOCHE_MX);
      expect(formatProx(act("2026-06-15T16:00:00Z"))).toBe("Hoy · Llamar");
      expect(formatProx(act("2026-06-16"))).toBe("Mañana · Llamar");
      expect(formatProx(act("2026-06-14"))).toBe("Vencida · Llamar");
    } finally {
      vi.useRealTimers();
    }
  });
});
