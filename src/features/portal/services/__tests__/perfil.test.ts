import { describe, it, expect, beforeEach, vi } from "vitest";

const mock = await vi.hoisted(async () => {
  const { createSupabaseMock } = await import("@/services/__tests__/_supabaseChainMock");
  const base = createSupabaseMock();
  const getUser = vi.fn();
  const updateUser = vi.fn();
  return {
    ...base,
    getUser,
    updateUser,
    supabase: { ...base.supabase, auth: { getUser, updateUser } },
  };
});
vi.mock("@/integrations/supabase/client", () => ({ supabase: mock.supabase }));

import {
  fetchPortalPerfil,
  actualizarContactoPortal,
  cambiarPasswordPortal,
} from "@/features/portal/services/perfil";

beforeEach(() => {
  mock.tableCalls.length = 0;
  mock.rpcCalls.length = 0;
  mock.getUser.mockReset();
  mock.updateUser.mockReset();
});

describe("services/portal/perfil", () => {
  it("fetchPortalPerfil lanza si no hay usuario", async () => {
    mock.getUser.mockResolvedValue({ data: { user: null } });
    await expect(fetchPortalPerfil()).rejects.toBeTruthy();
  });

  it("fetchPortalPerfil devuelve email + cliente", async () => {
    mock.getUser.mockResolvedValue({ data: { user: { id: "u1", email: "a@b.com" } } });
    mock.setTableResult("client_users", {
      data: { clientes: { id: "c1", nombre: "ACME", rfc: "RFC", direccion: "", ciudad: "", estado: "", cp: "", contacto: "", email: "", telefono: "" } },
      error: null,
    });
    const r = await fetchPortalPerfil();
    expect(r.email).toBe("a@b.com");
    expect(r.cliente?.nombre).toBe("ACME");
  });

  it("fetchPortalPerfil con cliente null", async () => {
    mock.getUser.mockResolvedValue({ data: { user: { id: "u1", email: "a@b.com" } } });
    mock.setTableResult("client_users", { data: null, error: null });
    const r = await fetchPortalPerfil();
    expect(r.cliente).toBeNull();
  });

  it("fetchPortalPerfil propaga error de Supabase", async () => {
    mock.getUser.mockResolvedValue({ data: { user: { id: "u1", email: "a@b.com" } } });
    mock.setTableResult("client_users", { data: null, error: { message: "x" } });
    await expect(fetchPortalPerfil()).rejects.toBeTruthy();
  });

  it("fetchPortalPerfil usa '' si email null", async () => {
    mock.getUser.mockResolvedValue({ data: { user: { id: "u1", email: null } } });
    mock.setTableResult("client_users", { data: null, error: null });
    const r = await fetchPortalPerfil();
    expect(r.email).toBe("");
  });

  it("actualizarContactoPortal invoca RPC portal_update_contacto", async () => {
    mock.setRpcResult("portal_update_contacto", { data: null, error: null });
    await actualizarContactoPortal({ nombre: "X", telefono: "555" });
    const args = mock.rpcCalls[0].args as Record<string, unknown>;
    expect(args._nombre).toBe("X");
    expect(args._telefono).toBe("555");
  });

  it("actualizarContactoPortal propaga error", async () => {
    mock.setRpcResult("portal_update_contacto", { data: null, error: { message: "x" } });
    await expect(actualizarContactoPortal({ nombre: "", telefono: "" })).rejects.toBeTruthy();
  });

  it("cambiarPasswordPortal llama auth.updateUser", async () => {
    mock.updateUser.mockResolvedValue({ error: null });
    await cambiarPasswordPortal("newpass");
    expect(mock.updateUser).toHaveBeenCalledWith({ password: "newpass" });
  });

  it("cambiarPasswordPortal propaga error", async () => {
    mock.updateUser.mockResolvedValue({ error: { message: "x" } });
    await expect(cambiarPasswordPortal("p")).rejects.toBeTruthy();
  });
});
