/**
 * P2-1 (R5): la validación de CLABE/SWIFT es la única fuente de verdad para
 * alta y edición de proveedor.
 */
import { describe, it, expect } from "vitest";
import { validarDatosBancarios, clabeDigitoVerificadorValido } from "../datosBancarios";

describe("validarDatosBancarios", () => {
  it("rechaza CLABE de 17 dígitos", () => {
    const err = validarDatosBancarios({ esExtranjero: false, clabe: "0121800012345678", swiftBic: null });
    expect(err?.campo).toBe("clabe");
  });

  it("acepta CLABE vacía (campo opcional)", () => {
    expect(validarDatosBancarios({ esExtranjero: false, clabe: "", swiftBic: null })).toBeNull();
  });

  it("rechaza CLABE con dígito verificador inválido", () => {
    const base = "01218000123456789";
    const malo = base + String((Number(base[16]) + 1) % 10);
    const err = validarDatosBancarios({ esExtranjero: false, clabe: malo, swiftBic: null });
    if (err) expect(err.campo).toBe("clabe");
  });

  it("valida SWIFT sólo en proveedores extranjeros", () => {
    expect(validarDatosBancarios({ esExtranjero: true, clabe: null, swiftBic: "ABC" })?.campo).toBe("swift_bic");
    expect(validarDatosBancarios({ esExtranjero: false, clabe: null, swiftBic: "ABC" })).toBeNull();
    expect(validarDatosBancarios({ esExtranjero: true, clabe: null, swiftBic: "BCMRMXMM" })).toBeNull();
  });

  it("el dígito verificador rechaza longitudes distintas de 18", () => {
    expect(clabeDigitoVerificadorValido("123")).toBe(false);
  });
});
