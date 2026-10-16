/**
 * Segregación de funciones (SoD) en el cliente: espejo de la regla de la RPC
 * `aprobar_factura_proveedor` (quien captura no aprueba, salvo administradores y contador).
 */
import { describe, it, expect } from "vitest";
import { Constants } from "@/integrations/supabase/types";
import type { AppRole } from "@/types/appRole";
import { PAGAR_PROVEEDOR, hasRole } from "@/hooks/shared/permissionMatrix";
import {
  motivoBloqueoAprobacion,
  puedeAprobarEstaFactura,
} from "@/features/cxp/permissions";

const USER = "u-karol";

describe("motivoBloqueoAprobacion", () => {
  it("permite al contador aprobar la factura que capturó", () => {
    expect(
      motivoBloqueoAprobacion({ role: "contador", userId: USER, createdBy: USER }),
    ).toBeNull();
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
    expect(puedeAprobarEstaFactura({ role: "auxiliar_contable", userId: USER, createdBy: USER })).toBe(false);
  });

  it("es true cuando no hay motivo de bloqueo", () => {
    expect(puedeAprobarEstaFactura({ role: "contador", userId: USER, createdBy: "x" })).toBe(true);
  });
});

describe("approval scope remains supplier-invoice-only", () => {
  it.each(Constants.public.Enums.app_role)("preserves the role gate for own and other invoices: %s", (role) => {
    const allowed = ["admin", "admin_org", "super_admin", "contador"].includes(role);
    for (const createdBy of [USER, "another-user", null]) {
      expect(puedeAprobarEstaFactura({ role, userId: USER, createdBy })).toBe(allowed);
    }
  });
  it.each([null, undefined, "Contador", "unknown"])("does not grant approval to absent or invalid role %s", (role) => {
    expect(puedeAprobarEstaFactura({ role: role as AppRole, userId: USER, createdBy: USER })).toBe(false);
  });
  it("leaves payment capability matrix unchanged", () => {
    expect(PAGAR_PROVEEDOR).toEqual(["super_admin", "admin_org", "admin", "tesorero"]);
    expect(hasRole(PAGAR_PROVEEDOR, "contador")).toBe(false);
  });
});
