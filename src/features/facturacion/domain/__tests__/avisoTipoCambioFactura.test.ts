/**
 * B12 — el borrador en moneda extranjera nace SIN tipo de cambio (antes nacía
 * con 1, un valor falso que ocultaba la advertencia). La tarjeta de timbrado
 * debe avisar cuando falta y también cuando el valor capturado es implausible,
 * porque la base lo rechaza al timbrar.
 */
import { describe, it, expect } from "vitest";
import { avisoTipoCambioFactura } from "../datosFiscalesForm";

describe("avisoTipoCambioFactura", () => {
  it("MXN nunca advierte", () => {
    expect(avisoTipoCambioFactura("MXN", null)).toBeNull();
    expect(avisoTipoCambioFactura("MXN", 1)).toBeNull();
  });

  it("USD sin tipo de cambio pide capturarlo", () => {
    expect(avisoTipoCambioFactura("USD", null)).toMatch(/Falta capturar el tipo de cambio/);
    expect(avisoTipoCambioFactura("USD", 0)).toMatch(/Falta capturar el tipo de cambio/);
  });

  it("USD con TC=1 (el valor falso del bug) sigue advirtiendo por fuera de banda", () => {
    expect(avisoTipoCambioFactura("USD", 1)).toMatch(/parece incorrecto/);
    expect(avisoTipoCambioFactura("USD", 1)).toMatch(/antes de timbrar/);
  });

  it("USD con TC plausible no advierte", () => {
    expect(avisoTipoCambioFactura("USD", 18.42)).toBeNull();
  });

  it("EUR fuera de banda por exceso también advierte", () => {
    expect(avisoTipoCambioFactura("EUR", 180)).toMatch(/parece incorrecto/);
  });
});
