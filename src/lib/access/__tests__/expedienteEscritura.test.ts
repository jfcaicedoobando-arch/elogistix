import { describe, expect, it } from "vitest";

import { EXPEDIENTE_ESCRITURA, hasRole } from "@/lib/access/permissionMatrix";

/**
 * R4BD-04 — la lista debe seguir siendo espejo exacto de las policies RLS
 * (migración 20260824050000). Si alguien la amplía sin tocar la BD, la UI
 * mostraría botones que fallan con error de permisos.
 */
describe("EXPEDIENTE_ESCRITURA", () => {
  it("contiene exactamente la matriz de las policies de BD", () => {
    expect([...EXPEDIENTE_ESCRITURA].sort()).toEqual(
      ["admin", "admin_org", "contador", "operador", "super_admin"].sort(),
    );
  });

  it("excluye roles de sólo consulta y de operación no autorizados en BD", () => {
    for (const rol of ["customer_service", "gerente_visor", "vendedor", "tesorero"] as const) {
      expect(hasRole(EXPEDIENTE_ESCRITURA, rol)).toBe(false);
    }
  });

  it("permite a los roles de la matriz", () => {
    for (const rol of ["admin_org", "operador", "contador"] as const) {
      expect(hasRole(EXPEDIENTE_ESCRITURA, rol)).toBe(true);
    }
  });
});
