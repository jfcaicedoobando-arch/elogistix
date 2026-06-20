import { describe, it, expect, beforeEach, vi } from "vitest";

const { mock, onAuthStateChange, getSession, signOut } = await vi.hoisted(async () => {
  const { createSupabaseMock } = await import("@/services/__tests__/_supabaseChainMock");
  const { vi: v } = await import("vitest");
  return {
    mock: createSupabaseMock(),
    onAuthStateChange: v.fn(() => ({ data: { subscription: { unsubscribe: v.fn() } } })),
    getSession: v.fn(),
    signOut: v.fn(),
  };
});
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    ...mock.supabase,
    auth: { onAuthStateChange, getSession, signOut },
  },
}));

import {
  subscribeToAuthChanges,
  getCurrentSession,
  signOutCurrentSession,
  fetchUserContext,
} from "@/features/auth/services/session";

beforeEach(() => {
  mock.rpcCalls.length = 0;
  onAuthStateChange.mockClear();
  getSession.mockReset();
  signOut.mockReset();
});

describe("services/auth/session", () => {
  it("subscribeToAuthChanges devuelve subscription", () => {
    const sub = subscribeToAuthChanges(() => {});
    expect(sub).toBeTruthy();
    expect(onAuthStateChange).toHaveBeenCalled();
  });

  it("getCurrentSession devuelve session", async () => {
    getSession.mockResolvedValue({ data: { session: { user: { id: "u1" } } } });
    const s = await getCurrentSession();
    expect(s).toMatchObject({ user: { id: "u1" } });
  });

  it("getCurrentSession devuelve null cuando no hay session", async () => {
    getSession.mockResolvedValue({ data: { session: null } });
    expect(await getCurrentSession()).toBeNull();
  });

  it("signOutCurrentSession llama supabase.auth.signOut", async () => {
    signOut.mockResolvedValue({ error: null });
    await signOutCurrentSession();
    expect(signOut).toHaveBeenCalled();
  });

  it("fetchUserContext devuelve null cuando RPC error", async () => {
    mock.setRpcResult("get_user_context", { data: null, error: { message: "x" } });
    expect(await fetchUserContext()).toBeNull();
  });

  it("fetchUserContext normaliza payload completo", async () => {
    mock.setRpcResult("get_user_context", {
      data: {
        role: "admin",
        orgRole: "admin_org",
        organizationId: "o1",
        organization: { id: "o1", nombre: "X", rfc: null, logo_url: null, plan: null, activo: true },
      },
      error: null,
    });
    const r = await fetchUserContext();
    expect(r).toMatchObject({ role: "admin", orgRole: "admin_org", organizationId: "o1" });
    expect(r?.organization?.nombre).toBe("X");
  });

  it("fetchUserContext acepta data null y devuelve nulls", async () => {
    mock.setRpcResult("get_user_context", { data: null, error: null });
    const r = await fetchUserContext();
    expect(r).toEqual({ role: null, orgRole: null, organizationId: null, organization: null });
  });

  it("fetchUserContext usa RPC get_user_context", async () => {
    mock.setRpcResult("get_user_context", { data: {}, error: null });
    await fetchUserContext();
    expect(mock.rpcCalls[0].fn).toBe("get_user_context");
  });
});
