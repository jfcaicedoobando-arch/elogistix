import { describe, it, expect, beforeEach, vi } from "vitest";

const { mock, invokeMock } = await vi.hoisted(async () => {
  const { createSupabaseMock } = await import("@/services/__tests__/_supabaseChainMock");
  const { vi: v } = await import("vitest");
  return { mock: createSupabaseMock(), invokeMock: v.fn() };
});
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    ...mock.supabase,
    functions: { invoke: invokeMock },
  },
}));

import {
  fetchAvailableUsers,
  fetchAdminGlobalUsers,
  fetchOrgMembers,
  updateOrgMemberRole,
  removeOrgMember,
} from "@/features/admin/services/members";

beforeEach(() => {
  mock.tableCalls.length = 0;
  invokeMock.mockReset();
});

describe("services/admin/members", () => {
  it("fetchAvailableUsers devuelve array de usuarios", async () => {
    invokeMock.mockResolvedValue({ data: [{ id: "u1", email: "a@b" }], error: null });
    const r = await fetchAvailableUsers();
    expect(r).toEqual([{ id: "u1", email: "a@b" }]);
  });

  it("fetchAvailableUsers devuelve [] cuando data no es array", async () => {
    invokeMock.mockResolvedValue({ data: null, error: null });
    expect(await fetchAvailableUsers()).toEqual([]);
  });

  it("fetchAvailableUsers propaga error", async () => {
    invokeMock.mockResolvedValue({ data: null, error: { message: "x" } });
    await expect(fetchAvailableUsers()).rejects.toThrow();
  });

  it("fetchAdminGlobalUsers mapea email y org", async () => {
    mock.setTableResult("organization_members", {
      data: [{ user_id: "u1", role: "admin", organization_id: "o1" }],
      error: null,
    });
    // Second call (organizations) — chain mock returns the same per-table result; setting separately.
    invokeMock.mockResolvedValue({ data: [{ id: "u1", email: "a@b" }], error: null });
    // For organizations we need a separate set on a different table key:
    mock.setTableResult("organizations", { data: [{ id: "o1", nombre: "Empresa" }], error: null });
    const r = await fetchAdminGlobalUsers();
    expect(r[0]).toMatchObject({ user_id: "u1", email: "a@b", org_nombre: "Empresa", role: "admin" });
  });

  it("fetchAdminGlobalUsers usa user_id como email si edge function falla", async () => {
    mock.setTableResult("organization_members", {
      data: [{ user_id: "u1", role: "admin", organization_id: "o1" }],
      error: null,
    });
    mock.setTableResult("organizations", { data: [{ id: "o1", nombre: "Empresa" }], error: null });
    invokeMock.mockRejectedValue(new Error("boom"));
    const r = await fetchAdminGlobalUsers();
    expect(r[0].email).toBe("u1");
  });

  it("fetchAdminGlobalUsers propaga error de organization_members", async () => {
    mock.setTableResult("organization_members", { data: null, error: { message: "x" } });
    await expect(fetchAdminGlobalUsers()).rejects.toThrow();
  });

  it("fetchOrgMembers devuelve filas con email", async () => {
    mock.setTableResult("organization_members", {
      data: [{ id: "m1", user_id: "u1", role: "admin" }],
      error: null,
    });
    invokeMock.mockResolvedValue({ data: [{ id: "u1", email: "a@b" }], error: null });
    const r = await fetchOrgMembers("o1");
    expect(r[0].email).toBe("a@b");
  });

  it("fetchOrgMembers usa user_id como fallback de email", async () => {
    mock.setTableResult("organization_members", {
      data: [{ id: "m1", user_id: "u1", role: "admin" }],
      error: null,
    });
    invokeMock.mockResolvedValue({ data: [], error: null });
    const r = await fetchOrgMembers("o1");
    expect(r[0].email).toBe("u1");
  });

  it("fetchOrgMembers propaga error", async () => {
    mock.setTableResult("organization_members", { data: null, error: { message: "x" } });
    await expect(fetchOrgMembers("o1")).rejects.toThrow();
  });

  it("updateOrgMemberRole envía role y filtra por id", async () => {
    mock.setTableResult("organization_members", { data: null, error: null });
    await updateOrgMemberRole("m1", "admin_org");
    const p = mock.getMutationPayload("organization_members", "update") as Record<string, unknown>;
    expect(p).toEqual({ role: "admin_org" });
  });

  it("removeOrgMember elimina por id", async () => {
    mock.setTableResult("organization_members", { data: null, error: null });
    await removeOrgMember("m1");
    expect(mock.tableCalls[0].ops).toContain("delete");
  });

  it("addOrgMember inserta payload completo", async () => {
    mock.setTableResult("organization_members", { data: null, error: null });
    await addOrgMember({ organizationId: "o1", userId: "u1", role: "operador" });
    const p = mock.getMutationPayload("organization_members") as Record<string, unknown>;
    expect(p).toEqual({ organization_id: "o1", user_id: "u1", role: "operador" });
  });
});
