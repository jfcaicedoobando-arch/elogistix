import { describe, it, expect } from "vitest";
import { accionesCotizacionPermitidas } from "../cotizacion.acciones";

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

/**
 * v13.823.277 — espejo de las reglas reales: `aceptar_cotizacion_version`,
 * `puede_escribir_cotizaciones` y `crear_embarque_borrador_core`.
 */
describe("accionesCotizacionPermitidas — alineación con las RPC", () => {
  const casos = [
    { rol: "contador", aceptar: false, rechazar: false, crearEmbarque: false },
    { rol: "gerente_comercial", aceptar: true, rechazar: true, crearEmbarque: false },
    { rol: "vendedor", aceptar: true, rechazar: true, crearEmbarque: false },
    { rol: "ejecutivo_pricing", aceptar: false, rechazar: true, crearEmbarque: false },
    { rol: "coordinador_logistico", aceptar: false, rechazar: true, crearEmbarque: false },
    { rol: "gerente_operaciones", aceptar: true, rechazar: true, crearEmbarque: false },
    { rol: "operador", aceptar: true, rechazar: true, crearEmbarque: true },
    { rol: "admin", aceptar: true, rechazar: true, crearEmbarque: true },
  ] as const;

  for (const caso of casos) {
    it(`${caso.rol}: aceptar=${caso.aceptar}, rechazar=${caso.rechazar}, crearEmbarque=${caso.crearEmbarque}`, () => {
      const a = accionesCotizacionPermitidas("Enviada", 1000, caso.rol, {
        creadaPor: "otro",
        usuarioActual: "yo",
      });
      expect(a.aceptar).toBe(caso.aceptar);
      expect(a.rechazar).toBe(caso.rechazar);
      expect(a.crearEmbarque).toBe(caso.crearEmbarque);
    });
  }

  it("conserva SoD: quien creó la cotización no puede aceptarla (rol no exento)", () => {
    const a = accionesCotizacionPermitidas("Enviada", 1000, "vendedor", {
      creadaPor: "yo",
      usuarioActual: "yo",
    });
    expect(a.aceptar).toBe(false);
    expect(a.rechazar).toBe(true);
  });
});
