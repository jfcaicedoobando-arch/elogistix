/**
 * v13.823.114 — Posponer actividades suma días en calendario CDMX y conserva
 * la hora local mexicana, sin depender del huso del navegador.
 */
import { describe, it, expect } from "vitest";
import { mxAddDaysIso, utcIsoToMxLocal } from "@/lib/date/mx";

describe("posponer actividad · zona horaria", () => {
  it("conserva la hora CDMX al sumar días (navegador UTC o CDMX dan el mismo ISO)", () => {
    // 2026-09-04 09:00 CDMX = 15:00Z (CST, -6).
    const iso = "2026-09-04T15:00:00.000Z";
    const r = mxAddDaysIso(iso, 3);
    expect(utcIsoToMxLocal(new Date(r))).toBe("2026-09-07T09:00:00");
    expect(r).toBe("2026-09-07T15:00:00.000Z");
  });

  it("no se corre de día cuando la hora CDMX está cerca de la medianoche", () => {
    // 2026-09-04 23:30 CDMX = 2026-09-05 05:30Z.
    const iso = "2026-09-05T05:30:00.000Z";
    const r = mxAddDaysIso(iso, 1);
    expect(utcIsoToMxLocal(new Date(r))).toBe("2026-09-05T23:30:00");
  });

  it("usa la fecha base cuando la actividad no tiene fecha programada", () => {
    const base = new Date("2026-09-04T15:00:00.000Z");
    const r = mxAddDaysIso(null, 1, base);
    expect(utcIsoToMxLocal(new Date(r))).toBe("2026-09-05T09:00:00");
  });

  it("acepta días negativos (adelantar)", () => {
    const r = mxAddDaysIso("2026-09-04T15:00:00.000Z", -1);
    expect(utcIsoToMxLocal(new Date(r))).toBe("2026-09-03T09:00:00");
  });
});
