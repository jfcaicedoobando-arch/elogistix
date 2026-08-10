/**
 * Segregación de funciones (SoD) en el cliente: espejo de la regla de la RPC
 * `aprobar_factura_proveedor` (quien captura no aprueba, salvo administradores).
 */
import { describe, it, expect } from "vitest";
import {
  motivoBloqueoAprobacion,
  puedeAprobarEstaFactura,
  SOD_MOTIVO_CAPTURA_PROPIA,
} from "@/features/cxp/permissions";

const USER = "u-karol";

describe("motivoBloqueoAprobacion", () => {
  it("bloquea al contador que capturó la factura", () => {
    expect(
      motivoBloqueoAprobacion({ role: "contador", userId: USER, createdBy: USER }),
    ).toBe(SOD_MOTIVO_CAPTURA_PROPIA);
  });

  it("permite al contador aprobar facturas capturadas por otra persona", () => {
    expect(
      motivoBloqueoAprobacion({ role: "contador", userId: USER, createdBy: "u-otro" }),
    ).toBeNull();
  });

  it("exime a los roles administradores de la regla SoD", () => {
    for (const role of ["admin", "admin_org", "super_admin"] as const) {
      expect(motivoBloqueoAprobacion({ role, userId: USER, createdBy: USER })).toBeNull();
    }
  });

  it("bloquea a roles sin permiso de aprobación", () => {
    expect(
      motivoBloqueoAprobacion({ role: "tesorero", userId: USER, createdBy: "u-otro" }),
    ).not.toBeNull();
  });

  it("no bloquea cuando no se conoce quién capturó", () => {
    expect(
      motivoBloqueoAprobacion({ role: "contador", userId: USER, createdBy: null }),
    ).toBeNull();
  });
});

describe("puedeAprobarEstaFactura", () => {
  it("es false cuando hay motivo de bloqueo", () => {
    expect(puedeAprobarEstaFactura({ role: "contador", userId: USER, createdBy: USER })).toBe(false);
  });

  it("es true cuando no hay motivo de bloqueo", () => {
    expect(puedeAprobarEstaFactura({ role: "contador", userId: USER, createdBy: "x" })).toBe(true);
  });
});
