/**
 * EC-07 · `formatFechaSegura` nunca debe lanzar: una fecha inválida tumbaba
 * el render completo de la tabla/panel con `RangeError: Invalid time value`.
 */
import { describe, it, expect } from "vitest";
import { formatFechaSegura } from "@/lib/formatters";

describe("formatFechaSegura", () => {
  it("formatea una fecha ISO válida con el patrón indicado", () => {
    expect(formatFechaSegura("2026-08-18T14:35:00Z", "dd/MM/yyyy")).toBe("18/08/2026");
  });

  it("acepta objetos Date", () => {
    // Mediodía UTC: mismo día calendario en cualquier zona de trabajo.
    expect(formatFechaSegura(new Date("2026-01-02T12:00:00Z"), "dd/MM/yyyy")).toBe("02/01/2026");
  });

  it("devuelve el fallback con valores nulos o vacíos", () => {
    expect(formatFechaSegura(null)).toBe("—");
    expect(formatFechaSegura(undefined)).toBe("—");
    expect(formatFechaSegura("")).toBe("—");
  });

  it("devuelve el fallback con fechas inválidas en vez de lanzar", () => {
    expect(() => formatFechaSegura("no-es-fecha")).not.toThrow();
    expect(formatFechaSegura("no-es-fecha")).toBe("—");
    expect(formatFechaSegura(new Date("x"))).toBe("—");
    expect(formatFechaSegura("0000-00-00T00:00:00Z", "dd/MM/yyyy HH:mm")).toBe("—");
  });

  it("respeta un fallback personalizado en formatFechaSegura", () => {
    expect(formatFechaSegura(null, "dd/MM/yyyy", "s/f")).toBe("s/f");
  });

  it("soporta patrones con hora y segundos", () => {
    expect(formatFechaSegura("2026-08-18T14:35:09Z", "yyyy-MM-dd HH:mm:ss")).toMatch(
      /^2026-08-18 \d{2}:35:09$/,
    );
  });
});
