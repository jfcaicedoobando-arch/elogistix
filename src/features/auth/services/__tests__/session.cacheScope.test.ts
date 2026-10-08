import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthChangeEvent, Session } from "@supabase/supabase-js";
const auth = vi.hoisted(() => ({ onAuthStateChange: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { auth } }));
vi.mock("@/services/bitacora/registrar", () => ({ registrarActividad: vi.fn() }));
import { subscribeToAuthChanges } from "../session";
import { getAuthSnapshot, setAuthSnapshot, syncAuthSessionUser } from "@/lib/auth/authSnapshot";
import { getSessionCacheGeneration, registerSessionCache } from "@/lib/auth/sessionCacheRegistry";
import { captureAuthOperationScope } from "@/lib/auth/authOperationScope";
function sameUserSession(id: string, marker = "one"): Session {
  return { user: { id: "u1" }, access_token: `mock.${btoa(JSON.stringify({ session_id: id, marker }))}.mock` } as Session;
}
let listener: (event: AuthChangeEvent, session: Session | null) => void;
beforeEach(() => {
  syncAuthSessionUser(null);
  setAuthSnapshot({ userId: "u1", email: null, organizationId: "o1", organizationName: null, role: "operador", effectiveRole: "operador" });
  auth.onAuthStateChange.mockImplementation((cb) => { listener = cb; return { data: { subscription: { unsubscribe: vi.fn() } } }; });
});
describe("synchronous auth listener cache boundary", () => {
  it("resets data and unresolved identity before the React callback on replacement", () => {
    const reset = vi.fn(); const unregister = registerSessionCache(reset); const scope = captureAuthOperationScope();
    try {
      subscribeToAuthChanges(() => {
        expect(reset).toHaveBeenCalled(); expect(scope.isCurrent()).toBe(false);
        expect(getAuthSnapshot()).toMatchObject({ userId: "u2", effectiveRole: null, organizationId: null });
      });
      listener("SIGNED_IN", { user: { id: "u2" } } as Session);
    } finally { unregister(); }
  });
  it("ignores a callback queued by an unsubscribed listener", () => {
    const callback = vi.fn(); const subscription = subscribeToAuthChanges(callback);
    const scope = captureAuthOperationScope(); subscription.unsubscribe();
    listener("SIGNED_OUT", null);
    expect(callback).not.toHaveBeenCalled(); expect(scope.isCurrent()).toBe(true);
  });
  it("starts another generation for same-user SIGNED_IN even without observed logout", () => {
    subscribeToAuthChanges(() => {});
    listener("INITIAL_SESSION", sameUserSession("first"));
    const scope = captureAuthOperationScope();
    listener("SIGNED_IN", sameUserSession("second"));
    expect(scope.isCurrent()).toBe(false);
  });
  it("preserves invoice continuation on tab-focus SIGNED_IN and rotating tokens in the same session", () => {
    subscribeToAuthChanges(() => {});
    listener("INITIAL_SESSION", sameUserSession("same"));
    const scope = captureAuthOperationScope(); const generation = getSessionCacheGeneration();
    listener("SIGNED_IN", sameUserSession("same"));
    listener("TOKEN_REFRESHED", sameUserSession("same", "rotated"));
    listener("SIGNED_IN", sameUserSession("same", "rotated"));
    expect(scope.isCurrent()).toBe(true); expect(getSessionCacheGeneration()).toBe(generation);
  });
  it("does not revoke a confirmation on an indistinguishable legacy SIGNED_IN", () => {
    subscribeToAuthChanges(() => {}); const scope = captureAuthOperationScope();
    listener("SIGNED_IN", { user: { id: "u1" } } as Session);
    expect(scope.isCurrent()).toBe(true);
  });
  it("revokes same-user work across logout/login but preserves an ordinary token refresh", () => {
    subscribeToAuthChanges(() => {});
    const generation = getSessionCacheGeneration();
    listener("TOKEN_REFRESHED", { user: { id: "u1" } } as Session);
    expect(getSessionCacheGeneration()).toBe(generation);
    const scope = captureAuthOperationScope();
    listener("SIGNED_OUT", null); listener("SIGNED_IN", { user: { id: "u1" } } as Session);
    expect(scope.isCurrent()).toBe(false);
    expect(getAuthSnapshot().effectiveRole).toBeNull();
  });
});
