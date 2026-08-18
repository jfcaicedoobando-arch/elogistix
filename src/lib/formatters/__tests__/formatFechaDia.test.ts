/**
 * Ola C · UI-04 — contrato del formateador canónico de fecha "sólo día".
 */
import { describe, it, expect } from "vitest";
import { formatFechaDia } from "../dates";

describe("formatFechaDia", () => {
  it("formatea un ISO date-only sin correr el día por zona horaria", () => {
    expect(formatFechaDia("2026-08-17")).toBe("17/08/2026");
  });

  it("formatea un ISO con hora", () => {
    expect(formatFechaDia("2026-08-17T23:30:00Z")).toBe("17/08/2026");
  });

  it("acepta un objeto Date (date pickers)", () => {
    expect(formatFechaDia(new Date("2026-01-05T18:00:00Z"))).toBe("05/01/2026");
  });

  it("usa el fallback por defecto cuando la fecha es nula", () => {
    expect(formatFechaDia(null)).toBe("—");
    expect(formatFechaDia(undefined)).toBe("—");
    expect(formatFechaDia("")).toBe("—");
  });

  it("respeta un fallback personalizado", () => {
    expect(formatFechaDia(null, "s/f")).toBe("s/f");
    expect(formatFechaDia("no-es-fecha", "no-es-fecha")).toBe("no-es-fecha");
  });

  it("devuelve el fallback con fechas no parseables (Date inválido incluido)", () => {
    expect(formatFechaDia("no-es-fecha")).toBe("—");
    expect(formatFechaDia(new Date("x"))).toBe("—");
  });
});
