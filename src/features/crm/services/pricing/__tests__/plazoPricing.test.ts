import { describe, expect, it } from "vitest";
import { esGerenteOps, puedeAmpliarPlazo } from "../plazoPricing";

const base = { estado: "enviada", complejidad: "alta", enviada_at: "2026-11-05T10:00:00Z" };

describe("puedeAmpliarPlazo", () => {
  it("permite dentro de las primeras 8 h", () => {
    expect(puedeAmpliarPlazo(base, new Date("2026-11-05T17:59:00Z"))).toBe(true);
  });
  it("rechaza después de 8 h", () => {
    expect(puedeAmpliarPlazo(base, new Date("2026-11-05T18:01:00Z"))).toBe(false);
  });
  it("sólo aplica a solicitudes especiales", () => {
    expect(puedeAmpliarPlazo({ ...base, complejidad: "media" }, new Date("2026-11-05T11:00:00Z"))).toBe(false);
  });
});

describe("esGerenteOps", () => {
  it("gerente de operaciones sí, vendedor no", () => {
    expect(esGerenteOps("gerente_operaciones")).toBe(true);
    expect(esGerenteOps("vendedor")).toBe(false);
  });
});
