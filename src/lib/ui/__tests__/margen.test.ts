import { describe, it, expect } from "vitest";
import {
  claseTonoMargen,
  tonoMargen,
  UMBRAL_MARGEN,
  UMBRAL_MARGEN_COTIZACION,
  UMBRAL_MARGEN_OPERATIVO,
} from "@/lib/ui/margen";

describe("tonoMargen (Ola 5 · 5.6)", () => {
  it("usa la escala por defecto 20/10", () => {
    expect(tonoMargen(25)).toBe("success");
    expect(tonoMargen(UMBRAL_MARGEN.GOOD)).toBe("success");
    expect(tonoMargen(12)).toBe("warning");
    expect(tonoMargen(5)).toBe("destructive");
  });

  it("es neutro sin dato o sin venta asociada", () => {
    expect(tonoMargen(null)).toBe("neutral");
    expect(tonoMargen(Number.NaN)).toBe("neutral");
    expect(tonoMargen(0, { venta: 0 })).toBe("neutral");
    expect(tonoMargen(0, { venta: 100 })).toBe("destructive");
  });

  it("respeta las escalas de cotización y operativa", () => {
    expect(tonoMargen(16, { umbrales: UMBRAL_MARGEN_COTIZACION })).toBe("success");
    expect(tonoMargen(16, { umbrales: UMBRAL_MARGEN })).toBe("warning");
    expect(tonoMargen(11, { umbrales: UMBRAL_MARGEN_OPERATIVO })).toBe("success");
    expect(tonoMargen(-1, { umbrales: UMBRAL_MARGEN_OPERATIVO })).toBe("destructive");
  });

  it("mapea a clases semánticas", () => {
    expect(claseTonoMargen(30)).toBe("text-success");
    expect(claseTonoMargen(11)).toBe("text-warning");
    expect(claseTonoMargen(-4)).toBe("text-destructive");
    expect(claseTonoMargen(null)).toBe("text-muted-foreground");
  });
});
