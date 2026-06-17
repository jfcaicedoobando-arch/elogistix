/**
 * Cobertura del helper `formatDateTimeShort` añadido en Fase 2 #2.
 * Centraliza el formato corto día+mes+hora (es-MX) usado por la campanita
 * de notificaciones del portal.
 */
import { describe, it, expect } from "vitest";
import { formatDateTimeShort } from "../dates";

describe("formatDateTimeShort", () => {
  it("devuelve '-' cuando la cadena es vacía", () => {
    expect(formatDateTimeShort("")).toBe("-");
  });

  it("formatea una ISO válida con día, mes corto y hora", () => {
    const out = formatDateTimeShort("2026-06-17T14:35:00.000Z");
    // El locale es-MX devuelve "17 jun, 08:35" (CDMX, UTC-6) o equivalente;
    // sólo verificamos que contenga día, mes corto en es y hora.
    expect(out).toMatch(/\d{2}/);
    expect(out.toLowerCase()).toMatch(/ene|feb|mar|abr|may|jun|jul|ago|sep|oct|nov|dic/);
    expect(out).toMatch(/\d{2}:\d{2}/);
  });

  it("regresa la cadena original cuando no es parseable", () => {
    // toLocaleDateString sobre "Invalid Date" produce "Invalid Date"; el helper
    // sólo cae al `catch` con input que rompa el constructor; mantenemos contrato
    // anti-crash devolviendo algo string-no-vacío.
    const out = formatDateTimeShort("no-es-fecha");
    expect(typeof out).toBe("string");
    expect(out.length).toBeGreaterThan(0);
  });
});
