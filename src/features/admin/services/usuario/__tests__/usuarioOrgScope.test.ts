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
  quitarDeOrganizacion,
  enviarResetPassword,
  createUserViaEdgeFunction,
} from "@/features/admin/services/usuario";

beforeEach(() => {
  mock.tableCalls.length = 0;
  mock.resetResults();
  mock.invoke.mockReset();
  mock.getSession.mockReset();
  mock.getSession.mockResolvedValue({ data: { session: { access_token: "tok" } } });
});

function eqArgs(table: string): unknown[][] {
  const call = mock.tableCalls.find((c) => c.table === table);
  if (!call) return [];
  return call.ops.map((op, i) => (op === "eq" ? call.opArgs[i] : null)).filter(Boolean) as unknown[][];
}

describe("usuario · alcance por organización (U-01/U-02)", () => {
  it("fetchUsuariosOrganizacion filtra por organization_id cuando se le pasa", async () => {
    mock.setTableResult("organization_members", { data: [], error: null });
    mock.invoke.mockResolvedValue({ data: [], error: null });
    await fetchUsuariosOrganizacion("org-1");
    expect(eqArgs("organization_members")).toContainEqual(["organization_id", "org-1"]);
  });

  it("fetchUsuariosOrganizacion no filtra cuando no hay organización (super_admin)", async () => {
    mock.setTableResult("organization_members", { data: [], error: null });
    mock.invoke.mockResolvedValue({ data: [], error: null });
    await fetchUsuariosOrganizacion(null);
    expect(eqArgs("organization_members")).toHaveLength(0);
  });

  it("expone el nombre de la organización de cada membresía", async () => {
    mock.setTableResult("organization_members", {
      data: [
        {
          user_id: "u1",
          role: "admin_org",
          created_at: "2026-01-01",
          organization_id: "org-1",
          organizations: { nombre: "Elogistix" },
        },
      ],
      error: null,
    });
    mock.invoke.mockResolvedValue({
      data: [{ id: "u1", email: "a@x.com", created_at: "2026-01-01", last_sign_in_at: "2026-02-01" }],
      error: null,
    });
    const rows = await fetchUsuariosOrganizacion("org-1");
    expect(rows[0]).toMatchObject({
      organization_id: "org-1",
      organizacion_nombre: "Elogistix",
      estado: "activo",
    });
  });

  it("updateUserRole acota el update por user_id y organization_id", async () => {
    mock.setTableResult("organization_members", { data: null, error: null });
    await updateUserRole("u1", "contador", "org-1");
    expect(eqArgs("organization_members")).toEqual([
      ["user_id", "u1"],
      ["organization_id", "org-1"],
    ]);
  });
});

describe("usuario · ciclo de vida (U-03/U-04)", () => {
  it("quitarDeOrganizacion borra sólo la membresía de esa organización", async () => {
    mock.setTableResult("organization_members", { data: null, error: null });
    await quitarDeOrganizacion("u1", "org-1");
    const call = mock.tableCalls.find((c) => c.table === "organization_members");
    expect(call?.ops).toContain("delete");
    expect(eqArgs("organization_members")).toEqual([
      ["user_id", "u1"],
      ["organization_id", "org-1"],
    ]);
  });

  it("enviarResetPassword invoca la acción reset-password", async () => {
    mock.invoke.mockResolvedValue({ data: { ok: true }, error: null });
    await enviarResetPassword("u1");
    expect(mock.invoke).toHaveBeenCalledWith(
      "user-management",
      expect.objectContaining({
        body: expect.objectContaining({ action: "reset-password", user_id: "u1" }),
      }),
    );
  });

  it("createUserViaEdgeFunction usa la acción invite cuando no hay contraseña", async () => {
    mock.setTableResult("organization_members", { data: { user_id: "u9", role: "contador" }, error: null });
    mock.invoke.mockResolvedValue({ data: { user: { id: "u9" } }, error: null });
    await createUserViaEdgeFunction({ email: "Nuevo@X.com", role: "contador", orgId: "org-1" });
    const body = mock.invoke.mock.calls.at(-1)?.[1]?.body as { action: string; email: string };
    expect(body.action).toBe("invite");
    expect(body.email).toBe("nuevo@x.com");
  });
});
