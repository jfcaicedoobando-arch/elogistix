import { describe, expect, it } from "vitest";

import { COST_VIEWERS, FINANCE_VIEWERS, hasRole } from "@/lib/access/permissionMatrix";

/** QA B-07 — los roles comerciales no deben ver costo/utilidad/margen. */
describe("COST_VIEWERS (QA B-07)", () => {
  it("excluye vendedor y ejecutivo_pricing", () => {
    expect(hasRole(COST_VIEWERS, "vendedor")).toBe(false);
    expect(hasRole(COST_VIEWERS, "ejecutivo_pricing")).toBe(false);
  });

  it("mantiene finanzas, dirección y administradores", () => {
    for (const rol of ["super_admin", "admin_org", "admin", "contador", "tesorero", "gerente_operaciones"] as const) {
      expect(hasRole(COST_VIEWERS, rol)).toBe(true);
    }
  });

  it("es un subconjunto de FINANCE_VIEWERS", () => {
    for (const rol of COST_VIEWERS) {
      expect(FINANCE_VIEWERS).toContain(rol);
    }
    expect(COST_VIEWERS.length).toBeLessThan(FINANCE_VIEWERS.length);
  });
});
