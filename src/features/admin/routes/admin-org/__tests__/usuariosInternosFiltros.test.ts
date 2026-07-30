import { describe, it, expect } from "vitest";
import {
  TODOS,
  filtrarUsuarios,
  hayFiltrosActivos,
} from "@/features/admin/routes/admin-org/usuariosInternosFiltros";
import type { UserRow } from "@/features/admin/services/usuario";

function fila(over: Partial<UserRow>): UserRow {
  return {
    user_id: "u1",
    email: "a@x.com",
    role: "customer_service",
    created_at: "2026-01-01",
    estado: "activo",
    organization_id: "org-1",
    organizacion_nombre: "Org 1",
    ...over,
  };
}

const base: UserRow[] = [
  fila({ user_id: "u1", email: "zeta@x.com", role: "admin_org" }),
  fila({ user_id: "u2", email: "alfa@x.com", role: "customer_service", estado: "pendiente" }),
  fila({ user_id: "u3", email: "beta@x.com", role: "operador" }),
];

describe("usuariosInternosFiltros", () => {
  it("ordena por jerarquía de rol y luego por correo", () => {
    const r = filtrarUsuarios(base, { busqueda: "", rol: TODOS, estado: TODOS });
    expect(r[0].role).toBe("admin_org");
    expect(r.map((u) => u.user_id)).toHaveLength(3);
  });

  it("filtra por búsqueda de correo (case-insensitive)", () => {
    const r = filtrarUsuarios(base, { busqueda: "ALFA", rol: TODOS, estado: TODOS });
    expect(r.map((u) => u.user_id)).toEqual(["u2"]);
  });

  it("filtra por rol exacto", () => {
    const r = filtrarUsuarios(base, { busqueda: "", rol: "operador", estado: TODOS });
    expect(r.map((u) => u.user_id)).toEqual(["u3"]);
  });

  it("filtra por estado de invitación pendiente", () => {
    const r = filtrarUsuarios(base, { busqueda: "", rol: TODOS, estado: "pendiente" });
    expect(r.map((u) => u.user_id)).toEqual(["u2"]);
  });

  it("filtra por rol legado", () => {
    const r = filtrarUsuarios(base, { busqueda: "", rol: TODOS, estado: "legacy" });
    expect(r.map((u) => u.user_id)).toEqual(["u3"]);
  });

  it("hayFiltrosActivos detecta cualquier filtro", () => {
    expect(hayFiltrosActivos({ busqueda: "", rol: TODOS, estado: TODOS })).toBe(false);
    expect(hayFiltrosActivos({ busqueda: " a ", rol: TODOS, estado: TODOS })).toBe(true);
    expect(hayFiltrosActivos({ busqueda: "", rol: "admin_org", estado: TODOS })).toBe(true);
    expect(hayFiltrosActivos({ busqueda: "", rol: TODOS, estado: "pendiente" })).toBe(true);
  });
});
