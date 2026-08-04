import { describe, it, expect } from "vitest";
import { withFrozenClock } from "@/test/helpers/withFrozenClock";
import { formatRelativo } from "../relativo";

describe("formatRelativo", () => {
  withFrozenClock("2026-06-15T12:00:00Z");

  it("muestra 'hace un momento' para menos de 1 min", () => {
    expect(formatRelativo(new Date("2026-06-15T11:59:45Z"))).toBe("hace un momento");
  });

  it("muestra minutos", () => {
    expect(formatRelativo(new Date("2026-06-15T11:55:00Z"))).toBe("hace 5 min");
  });

  it("muestra horas del mismo día", () => {
    expect(formatRelativo(new Date("2026-06-15T09:00:00Z"))).toBe("hace 3 h");
  });

  it("muestra 'ayer' para el día calendario anterior", () => {
    expect(formatRelativo(new Date("2026-06-14T13:00:00Z"))).toBe("ayer");
  });

  it("muestra días para menos de una semana", () => {
    expect(formatRelativo(new Date("2026-06-11T12:00:00Z"))).toBe("hace 4 días");
  });

  it("muestra fecha corta para más de una semana", () => {
    expect(formatRelativo(new Date("2026-05-01T12:00:00Z"))).toBe("01/05/2026");
  });

  it("devuelve '-' si la fecha es inválida", () => {
    expect(formatRelativo("no-es-fecha")).toBe("-");
  });
});
