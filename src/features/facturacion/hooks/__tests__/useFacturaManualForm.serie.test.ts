/**
 * Tests unitarios para `serieForMoneda`.
 * Verifica que la serie oficial se resuelva correctamente por moneda.
 * v13.315.4
 */
import { describe, it, expect } from "vitest";
import { serieForMoneda } from "@/features/facturacion/hooks/useFacturaManualForm";

describe("serieForMoneda", () => {
  it("MXN → 'A'", () => {
    expect(serieForMoneda("MXN")).toBe("A");
  });
  it("USD → 'SF43718'", () => {
    expect(serieForMoneda("USD")).toBe("SF43718");
  });
  it("EUR → 'SF46410'", () => {
    expect(serieForMoneda("EUR")).toBe("SF46410");
  });
});
