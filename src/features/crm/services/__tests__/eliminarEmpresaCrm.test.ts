import { describe, expect, it } from "vitest";
import { puedeEliminarEmpresa } from "../eliminarEmpresaCrm";

describe("puedeEliminarEmpresa", () => {
  it("bloquea una empresa ligada a un cliente", () => {
    expect(puedeEliminarEmpresa({ estado_crm: "Prospecto", cliente_id: "c-1" })).toBe(false);
  });
  it("bloquea una empresa con estado Cliente", () => {
    expect(puedeEliminarEmpresa({ estado_crm: "Cliente", cliente_id: null })).toBe(false);
  });
  it("permite eliminar un lead o prospecto sin cliente", () => {
    expect(puedeEliminarEmpresa({ estado_crm: "Lead", cliente_id: null })).toBe(true);
    expect(puedeEliminarEmpresa({ estado_crm: "Prospecto", cliente_id: null })).toBe(true);
  });
});
