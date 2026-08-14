
describe("accionesCotizacionPermitidas — cliente de casa (v13.624.0)", () => {
  it("permite aceptar desde Borrador cuando el cliente no requiere autorización", () => {
    const a = accionesCotizacionPermitidas("Borrador", 100, "admin", {}, false);
    expect(a.aceptar).toBe(true);
    expect(a.rechazar).toBe(true);
  });

  it("mantiene el bloqueo en Borrador cuando el cliente sí requiere autorización", () => {
    const a = accionesCotizacionPermitidas("Borrador", 100, "admin", {}, true);
    expect(a.aceptar).toBe(false);
  });

  it("no permite aceptar cotizaciones en $0 aunque sea cliente de casa", () => {
    const a = accionesCotizacionPermitidas("Solicitada", 0, "admin", {}, false);
    expect(a.aceptar).toBe(false);
  });
});
