import { describe, it, expect } from "vitest";
import { leerFlagAutorizacion, esClienteDeCasa } from "../autorizacionCliente";

describe("autorizacionCliente", () => {
  it("asume que se requiere autorización cuando el dato falta", () => {
    expect(leerFlagAutorizacion(null, "requiere_autorizacion_cotizacion")).toBe(true);
    expect(leerFlagAutorizacion({}, "requiere_autorizacion_proforma")).toBe(true);
    expect(
      leerFlagAutorizacion({ requiere_autorizacion_proforma: null }, "requiere_autorizacion_proforma"),
    ).toBe(true);
  });

  it("respeta el valor booleano guardado", () => {
    expect(
      leerFlagAutorizacion({ requiere_autorizacion_cotizacion: false }, "requiere_autorizacion_cotizacion"),
    ).toBe(false);
  });

  it("es cliente de casa sólo si ambos flags están apagados", () => {
    expect(
      esClienteDeCasa({
        requiere_autorizacion_cotizacion: false,
        requiere_autorizacion_proforma: false,
      }),
    ).toBe(true);
    expect(
      esClienteDeCasa({
        requiere_autorizacion_cotizacion: false,
        requiere_autorizacion_proforma: true,
      }),
    ).toBe(false);
  });
});
