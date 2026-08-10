import { describe, it, expect, beforeEach, vi } from "vitest";

const mock = await vi.hoisted(async () => {
  const { createSupabaseMock } = await import("@/services/__tests__/_supabaseChainMock");
  const base = createSupabaseMock();
  const invoke = vi.fn();
  const getSession = vi.fn();
  return {
    ...base,
    invoke,
    getSession,
    supabase: {
      ...base.supabase,
      auth: { getSession },
      functions: { invoke },
    },
  };
});
vi.mock("@/integrations/supabase/client", () => ({ supabase: mock.supabase }));

import {
  fetchUsuariosOrganizacion,
  updateUserRole,
  deleteUserViaEdgeFunction,
  createUserViaEdgeFunction,
  deleteUserViaEdgeFunctionAuth,
  UNRESOLVED_EMAIL,
} from "@/features/admin/services/usuario";

beforeEach(() => {
  mock.tableCalls.length = 0;
  mock.rpcCalls.length = 0;
  mock.resetResults();
  mock.invoke.mockReset();
  mock.getSession.mockReset();
  mock.getSession.mockResolvedValue({ data: { session: { access_token: "tok" } } });
});

describe("services/usuario", () => {
  it("fetchUsuariosOrganizacion combina members + emails", async () => {
    mock.setTableResult("organization_members", {
      data: [{ user_id: "u1", role: "admin", created_at: "2026-01-01" }],
      error: null,
    });
    mock.invoke.mockResolvedValue({
      data: [{ id: "u1", email: "a@b.com", created_at: "2026-02-01" }],
      error: null,
    });
    const r = await fetchUsuariosOrganizacion("org-1");
    expect(r[0].email).toBe("a@b.com");
    expect(r[0].role).toBe("admin");
  });

  it("fetchUsuariosOrganizacion usa UNRESOLVED_EMAIL si edge falla", async () => {
    mock.setTableResult("organization_members", {
      data: [{ user_id: "u1", role: "admin", created_at: "2026-01-01" }],
      error: null,
    });
    mock.invoke.mockResolvedValue({ data: null, error: { message: "fail" } });
    const r = await fetchUsuariosOrganizacion("org-1");
    expect(r[0].email).toBe(UNRESOLVED_EMAIL);
  });

  it("fetchUsuariosOrganizacion propaga error de members", async () => {
    mock.setTableResult("organization_members", { data: null, error: { message: "boom" } });
    await expect(fetchUsuariosOrganizacion("org-1")).rejects.toThrow();
  });

  it("updateUserRole hace update", async () => {
    mock.setTableResult("organization_members", { data: null, error: null });
    await expect(updateUserRole("u1", "admin")).resolves.toBeUndefined();
  });

  it("updateUserRole propaga error", async () => {
    mock.setTableResult("organization_members", { data: null, error: { message: "fail" } });
    await expect(updateUserRole("u1", "admin")).rejects.toThrow();
  });

  it("deleteUserViaEdgeFunction lanza si edge devuelve error", async () => {
    mock.invoke.mockResolvedValue({ data: null, error: { message: "no" } });
    await expect(deleteUserViaEdgeFunction("u1")).rejects.toThrow();
  });

  it("deleteUserViaEdgeFunction devuelve data ok", async () => {
    mock.invoke.mockResolvedValue({ data: { ok: true }, error: null });
    const r = await deleteUserViaEdgeFunction("u1");
    expect(r).toEqual({ ok: true });
  });

  it("createUserViaEdgeFunction crea usuario sin orgId", async () => {
    mock.invoke.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
    const r = await createUserViaEdgeFunction({
      email: "a@b.com",
      password: "xx",
      role: "admin",
    });
    expect(r.user?.id).toBe("u1");
  });

  it("createUserViaEdgeFunction manda organization_id a la edge function (Q-05)", async () => {
    mock.invoke.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
    mock.setTableResult("organization_members", {
      data: { user_id: "u1", role: "tesorero" },
      error: null,
    });
    await createUserViaEdgeFunction({
      email: "Nuevo@B.com",
      password: "xx",
      role: "tesorero",
      orgId: "org1",
    });
    const body = mock.invoke.mock.calls.find((c) => c[1]?.body?.action === "create")?.[1].body;
    expect(body.organization_id).toBe("org1");
    expect(body.role).toBe("tesorero");
    expect(body.email).toBe("nuevo@b.com");
  });

  it("createUserViaEdgeFunction falla si la membresía no quedó creada (Q-05)", async () => {
    mock.invoke.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
    mock.setTableResult("organization_members", { data: null, error: null });
    await expect(
      createUserViaEdgeFunction({ email: "a@b.com", password: "xx", role: "viewer", orgId: "o1" }),
    ).rejects.toThrow(/no quedó asignado/);
  });


  it("createUserViaEdgeFunction lanza si body trae error", async () => {
    mock.invoke.mockResolvedValue({ data: { error: "bad" }, error: null });
    await expect(
      createUserViaEdgeFunction({ email: "a", password: "x", role: "admin" }),
    ).rejects.toThrow();
  });

  it("deleteUserViaEdgeFunctionAuth lanza con error body", async () => {
    mock.invoke.mockResolvedValue({ data: { error: "bad" }, error: null });
    await expect(deleteUserViaEdgeFunctionAuth("u1")).rejects.toThrow();
  });

  it("deleteUserViaEdgeFunctionAuth ok", async () => {
    mock.invoke.mockResolvedValue({ data: { ok: true }, error: null });
    const r = await deleteUserViaEdgeFunctionAuth("u1");
    expect(r).toEqual({ ok: true });
  });
});
