import { beforeEach, describe, expect, it, vi } from "vitest";
import { createClient } from "@supabase/supabase-js";

const auth = vi.hoisted(() => ({ signOut: vi.fn(), getSession: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { auth } }));
import { signOutCurrentSession, SIGN_OUT_FAILURE } from "../signOut";

beforeEach(() => {
  auth.signOut.mockReset().mockResolvedValue({ error: null });
  auth.getSession.mockReset().mockResolvedValue({ data: { session: null }, error: null });
});

describe("signOutCurrentSession", () => {
  it("intenta global y comprueba ausencia de sesión", async () => {
    await expect(signOutCurrentSession()).resolves.toEqual({ globalRequestSucceeded: true });
    expect(auth.signOut.mock.calls).toEqual([[{ scope: "global" }]]);
    expect(auth.getSession).toHaveBeenCalledOnce();
  });
  it.each(["returned", "thrown"])("fallback local ante fallo %s", async (mode) => {
    if (mode === "returned") auth.signOut.mockResolvedValue({ error: new Error("private") });
    else auth.signOut.mockRejectedValue(new Error("private"));
    await expect(signOutCurrentSession()).resolves.toEqual({ globalRequestSucceeded: false });
    expect(auth.signOut.mock.calls).toEqual([[{ scope: "global" }], [{ scope: "local" }]]);
  });
  it("no acepta éxito aparente cuando la sesión persiste", async () => {
    auth.getSession.mockResolvedValue({ data: { session: { access_token: "private-token" } }, error: null });
    await expect(signOutCurrentSession()).rejects.toThrow(SIGN_OUT_FAILURE);
  });
  it.each(["session", "error", "throw"])("rechaza sin detalles privados si verificación falla: %s", async (mode) => {
    auth.signOut.mockResolvedValue({ error: new Error("private-token") });
    if (mode === "session") auth.getSession.mockResolvedValue({ data: { session: { access_token: "private-token" } }, error: null });
    if (mode === "error") auth.getSession.mockResolvedValue({ data: { session: null }, error: new Error("private-token") });
    if (mode === "throw") auth.getSession.mockRejectedValue(new Error("private-token"));
    await expect(signOutCurrentSession()).rejects.toThrow(SIGN_OUT_FAILURE);
  });
});

describe("SDK real con transporte aislado", () => {
  it.each(["offline", "503", "401", "403"])("elimina storage y no recupera sesión tras recargar: %s", async (failure) => {
    const key = `logout-sdk-${failure}`;
    const memory = new Map<string, string>();
    memory.set(key, JSON.stringify({
      access_token: "test-access", refresh_token: "test-refresh", token_type: "bearer",
      expires_at: Math.floor(Date.now() / 1000) + 3600, expires_in: 3600,
      user: { id: "test-user", aud: "authenticated", app_metadata: {}, user_metadata: {}, created_at: "2026-01-01T00:00:00Z" },
    }));
    const storage = {
      getItem: (key: string) => memory.get(key) ?? null,
      setItem: (key: string, value: string) => { memory.set(key, value); },
      removeItem: (key: string) => { memory.delete(key); },
    };
    const fetcher = vi.fn(async () => {
      if (failure === "offline") throw new TypeError("offline");
      return new Response(JSON.stringify({ message: "unavailable" }), { status: Number(failure) });
    });
    const options = { auth: { storageKey: key, storage, persistSession: true, autoRefreshToken: false, detectSessionInUrl: false }, global: { fetch: fetcher } };
    const client = createClient("https://logout-test.invalid", "test-key", options);
    await client.auth.initialize();
    const signedOut = vi.fn();
    const { data: { subscription } } = client.auth.onAuthStateChange((event) => { if (event === "SIGNED_OUT") signedOut(); });
    // Demuestra el cambio de SDK que motivó la regresión.
    const ignoredStatus = failure === "401" || failure === "403";
    if (!ignoredStatus) {
      expect((await client.auth.signOut({ scope: "global" })).error).toBeTruthy();
      expect(memory.has(key)).toBe(true);
    }
    auth.signOut.mockImplementation((options) => client.auth.signOut(options));
    auth.getSession.mockImplementation(() => client.auth.getSession());
    await expect(signOutCurrentSession()).resolves.toEqual({ globalRequestSucceeded: ignoredStatus });
    expect(memory.has(key)).toBe(false);
    expect(signedOut).toHaveBeenCalledOnce();
    subscription.unsubscribe();
    const reloaded = createClient("https://logout-test.invalid", "test-key", options);
    expect((await reloaded.auth.getSession()).data.session).toBeNull();
    expect(fetcher).toHaveBeenCalled();
    await client.auth.stopAutoRefresh();
    await reloaded.auth.stopAutoRefresh();
  });
});
