import { describe, it, expect } from "vitest";
import { puedeDarAltaCatalogo } from "../permisosCatalogo";

describe("alta de puertos, navieras y tipos de contenedor", () => {
  it("permite a gerente de operaciones y administradores", () => {
    for (const r of ["gerente_operaciones", "admin", "admin_org", "super_admin"]) expect(puedeDarAltaCatalogo(r)).toBe(true);
  });
  it("niega a otros roles", () => {
    for (const r of ["operador", "ejecutivo_pricing", "viewer", "vendedor", null]) expect(puedeDarAltaCatalogo(r)).toBe(false);
  });
});
