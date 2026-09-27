import { describe, expect, it } from "vitest";
import { fechaDiaNegocio, formatFechaHora } from "../index";

describe("instantes en la zona de negocio", () => {
  it("comparte el día y la hora del feed sin depender de la zona del navegador", () => {
    const iso = "2026-09-27T02:50:30Z";
    expect(fechaDiaNegocio(iso)).toBe("2026-09-26");
    expect(formatFechaHora(iso, { hour: "2-digit", minute: "2-digit", hour12: false })).toBe("20:50");
  });
  it("respeta las reglas históricas de la zona, no un desplazamiento fijo", () => {
    expect(fechaDiaNegocio("2021-07-01T05:00:00Z")).toBe("2021-07-01");
  });
  it("respeta el offset declarado en el instante", () => {
    expect(fechaDiaNegocio("2026-09-26T23:30:00-07:00")).toBe("2026-09-27");
  });
  it("conserva fechas de calendario y maneja fechas inválidas", () => {
    expect(fechaDiaNegocio("2026-09-26")).toBe("2026-09-26");
    expect(fechaDiaNegocio("inválida")).toBeNull();
    expect(fechaDiaNegocio("")).toBeNull();
  });
});
