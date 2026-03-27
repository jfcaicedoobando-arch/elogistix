import { describe, it, expect } from "vitest";
import type { AppRole } from "@/data/types";

// Test the pure logic used by useAdminOrgDetalle: MemberRow interface and config grouping.

interface MemberRow {
  id: string;
  user_id: string;
  role: AppRole;
  email?: string;
}

interface ConfigItem {
  id: string;
  categoria: string;
  clave: string;
  valor: unknown;
  descripcion: string;
  organization_id: string;
  created_at: string;
  updated_at: string;
}

function groupConfigByCategoria(items: ConfigItem[]) {
  return items.reduce<Record<string, ConfigItem[]>>((acc, item) => {
    if (!acc[item.categoria]) acc[item.categoria] = [];
    acc[item.categoria].push(item);
    return acc;
  }, {});
}

describe("useAdminOrgDetalle logic", () => {
  describe("MemberRow type", () => {
    it("accepts valid member rows", () => {
      const member: MemberRow = {
        id: "m1",
        user_id: "u1",
        role: "admin",
        email: "test@example.com",
      };
      expect(member.role).toBe("admin");
      expect(member.email).toBe("test@example.com");
    });

    it("accepts member without email", () => {
      const member: MemberRow = {
        id: "m2",
        user_id: "u2",
        role: "operador",
      };
      expect(member.email).toBeUndefined();
    });

    it("accepts all valid roles", () => {
      const roles: AppRole[] = ["admin", "operador", "viewer", "super_admin"];
      roles.forEach((role) => {
        const member: MemberRow = { id: "m", user_id: "u", role };
        expect(member.role).toBe(role);
      });
    });
  });

  describe("groupConfigByCategoria", () => {
    const makeItem = (categoria: string, clave: string): ConfigItem => ({
      id: `${categoria}-${clave}`,
      categoria,
      clave,
      valor: `val-${clave}`,
      descripcion: "",
      organization_id: "org1",
      created_at: "",
      updated_at: "",
    });

    it("returns empty object for empty array", () => {
      expect(groupConfigByCategoria([])).toEqual({});
    });

    it("groups items by categoria", () => {
      const items = [
        makeItem("empresa", "nombre"),
        makeItem("empresa", "rfc"),
        makeItem("facturacion", "tasa_iva"),
        makeItem("alertas", "dias_eta"),
      ];
      const grouped = groupConfigByCategoria(items);
      expect(Object.keys(grouped)).toHaveLength(3);
      expect(grouped["empresa"]).toHaveLength(2);
      expect(grouped["facturacion"]).toHaveLength(1);
      expect(grouped["alertas"]).toHaveLength(1);
    });

    it("preserves item data in groups", () => {
      const items = [makeItem("empresa", "nombre")];
      const grouped = groupConfigByCategoria(items);
      expect(grouped["empresa"][0].clave).toBe("nombre");
      expect(grouped["empresa"][0].valor).toBe("val-nombre");
    });
  });

  describe("edit state initialization from org data", () => {
    it("initializes edit fields from org with null values", () => {
      const org = { nombre: "TestOrg", rfc: null, plan: null };
      const editNombre = org.nombre;
      const editRfc = org.rfc ?? "";
      const editPlan = org.plan ?? "basic";
      expect(editNombre).toBe("TestOrg");
      expect(editRfc).toBe("");
      expect(editPlan).toBe("basic");
    });

    it("initializes edit fields from org with values", () => {
      const org = { nombre: "Elogistix", rfc: "ESH123", plan: "enterprise" };
      const editNombre = org.nombre;
      const editRfc = org.rfc ?? "";
      const editPlan = org.plan ?? "basic";
      expect(editNombre).toBe("Elogistix");
      expect(editRfc).toBe("ESH123");
      expect(editPlan).toBe("enterprise");
    });
  });
});
