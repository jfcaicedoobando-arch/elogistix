/**
 * C26 (v13.823.381) — Regresión de la lógica pura extraída de TabProformas.
 */
import { describe, it, expect } from "vitest";
import { avisoFusionSeleccion, puedeFusionarSeleccion } from "../avisoFusionProformas";

const ok = { sameCliente: true, sameTipo: true, sameDiasCredito: true };

describe("avisoFusionSeleccion", () => {
  it("no avisa cuando la selección es homogénea", () => {
    expect(avisoFusionSeleccion(ok)).toBeNull();
  });

  it("prioriza el cliente distinto sobre el resto", () => {
    expect(avisoFusionSeleccion({ sameCliente: false, sameTipo: false, sameDiasCredito: false }))
      .toContain("mismo cliente");
  });

  it("avisa al mezclar consolidada con individuales", () => {
    expect(avisoFusionSeleccion({ ...ok, sameTipo: false })).toContain("consolidada");
  });

  it("avisa cuando los plazos de crédito difieren", () => {
    expect(avisoFusionSeleccion({ ...ok, sameDiasCredito: false })).toContain("plazos de crédito");
  });
});

describe("puedeFusionarSeleccion", () => {
  it("exige al menos una proforma seleccionada", () => {
    expect(puedeFusionarSeleccion(0, ok)).toBe(false);
    expect(puedeFusionarSeleccion(2, ok)).toBe(true);
    expect(puedeFusionarSeleccion(2, { ...ok, sameTipo: false })).toBe(false);
  });
});
