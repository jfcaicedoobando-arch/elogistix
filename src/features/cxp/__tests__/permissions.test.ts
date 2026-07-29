/**
 * Q-04 — Tests de segregación de funciones (SOD) para CxP.
 * Un caso por rol para captura y para aprobación de facturas de proveedor.
 */
import { describe, it, expect } from "vitest";
import type { AppRole } from "@/types/appRole";
import { puedeAprobarFacturaProveedor, puedeCapturarFacturaProveedor } from "@/features/cxp/permissions";

const ROLES: AppRole[] = [
  "admin",
  "admin_org",
  "super_admin",
  "contador",
  "auxiliar_contable",
  "tesorero",
  "vendedor",
];

const CAPTURA_ESPERADA: Record<AppRole, boolean> = {
  admin: true,
  admin_org: true,
  super_admin: true,
  contador: true,
  auxiliar_contable: true,
  tesorero: false,
  vendedor: false,
} as Record<AppRole, boolean>;

const APROBAR_ESPERADO: Record<AppRole, boolean> = {
  admin: true,
  admin_org: true,
  super_admin: true,
  contador: true,
  auxiliar_contable: false,
  tesorero: false,
  vendedor: false,
} as Record<AppRole, boolean>;

describe("puedeCapturarFacturaProveedor", () => {
  it.each(ROLES)("rol %s", (rol) => {
    expect(puedeCapturarFacturaProveedor(rol)).toBe(CAPTURA_ESPERADA[rol]);
  });

  it("rol null no puede capturar", () => {
    expect(puedeCapturarFacturaProveedor(null)).toBe(false);
  });
});

describe("puedeAprobarFacturaProveedor", () => {
  it.each(ROLES)("rol %s", (rol) => {
    expect(puedeAprobarFacturaProveedor(rol)).toBe(APROBAR_ESPERADO[rol]);
  });

  it("rol null no puede aprobar", () => {
    expect(puedeAprobarFacturaProveedor(null)).toBe(false);
  });
});
