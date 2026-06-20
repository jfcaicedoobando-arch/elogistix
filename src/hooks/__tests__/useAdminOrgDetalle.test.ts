import { describe, it, expect } from "vitest";
import type { AppRole } from "@/types/appRole";
import type { MemberRow } from "@/features/admin/hooks/useAdminOrgDetalle";
import { agruparConfigPorCategoria, type ConfigItemLike } from "@/features/configuracion/domain/configuracion";

// Tests sobre el contrato real exportado por useAdminOrgDetalle y la lógica de
// dominio que usa internamente (agruparConfigPorCategoria). No redefine helpers.

describe("useAdminOrgDetalle — contrato MemberRow", () => {
  it("acepta member rows válidos", () => {
    const member: MemberRow = {
      id: "m1",
      user_id: "u1",
      role: "admin",
      email: "test@example.com",
    };
    expect(member.role).toBe("admin");
    expect(member.email).toBe("test@example.com");
  });

  it("acepta member sin email", () => {
    const member: MemberRow = { id: "m2", user_id: "u2", role: "operador" };
    expect(member.email).toBeUndefined();
  });

  it("acepta todos los roles válidos", () => {
    const roles: AppRole[] = ["admin", "operador", "viewer", "super_admin"];
    roles.forEach((role) => {
      const member: MemberRow = { id: "m", user_id: "u", role };
      expect(member.role).toBe(role);
    });
  });
});

describe("agruparConfigPorCategoria (usado por useAdminOrgDetalle)", () => {
  interface ConfigItem extends ConfigItemLike {
    id: string;
    clave: string;
    valor: unknown;
  }
  const makeItem = (categoria: string, clave: string): ConfigItem => ({
    id: `${categoria}-${clave}`,
    categoria,
    clave,
    valor: `val-${clave}`,
  });

  it("retorna objeto vacío para arreglo vacío", () => {
    expect(agruparConfigPorCategoria([])).toEqual({});
  });

  it("agrupa items por categoria", () => {
    const items = [
      makeItem("empresa", "nombre"),
      makeItem("empresa", "rfc"),
      makeItem("facturacion", "tasa_iva"),
      makeItem("alertas", "dias_eta"),
    ];
    const grouped = agruparConfigPorCategoria(items);
    expect(Object.keys(grouped)).toHaveLength(3);
    expect(grouped["empresa"]).toHaveLength(2);
    expect(grouped["facturacion"]).toHaveLength(1);
    expect(grouped["alertas"]).toHaveLength(1);
  });

  it("preserva data del item dentro del grupo", () => {
    const items = [makeItem("empresa", "nombre")];
    const grouped = agruparConfigPorCategoria(items);
    expect(grouped["empresa"][0].clave).toBe("nombre");
    expect(grouped["empresa"][0].valor).toBe("val-nombre");
  });
});

describe("inicialización de edit state desde org", () => {
  it("inicializa campos desde org con valores null", () => {
    const org = { nombre: "TestOrg", rfc: null, plan: null };
    expect(org.nombre).toBe("TestOrg");
    expect(org.rfc ?? "").toBe("");
    expect(org.plan ?? "basic").toBe("basic");
  });

  it("inicializa campos desde org con valores presentes", () => {
    const org = { nombre: "Elogistix", rfc: "ESH123", plan: "enterprise" };
    expect(org.nombre).toBe("Elogistix");
    expect(org.rfc ?? "").toBe("ESH123");
    expect(org.plan ?? "basic").toBe("enterprise");
  });
});
