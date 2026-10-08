import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { Session } from "@supabase/supabase-js";
const session = vi.hoisted(() => ({ subscribe: vi.fn(), getCurrent: vi.fn() }));
vi.mock("@/features/auth/services", () => ({ subscribeToAuthChanges: session.subscribe, getCurrentSession: session.getCurrent }));
import { useAuthSession } from "../useAuthSession";
import { getAuthSnapshot, setAuthSnapshot } from "@/lib/auth/authSnapshot";
let trigger: (event: string, session: Session | null) => void;
let hydrate: (session: Session | null) => void;
beforeEach(() => {
  setAuthSnapshot({ userId: "old", email: null, organizationId: "org", organizationName: null, role: "operador", effectiveRole: "operador" });
  session.subscribe.mockImplementation((callback) => { trigger = callback; return { unsubscribe: vi.fn() }; });
  session.getCurrent.mockReturnValue(new Promise<Session | null>((resolve) => { hydrate = resolve; }));
});
afterEach(cleanup);
it("does not let a late session hydration revive the identity invalidated by logout", async () => {
  const { result } = renderHook(useAuthSession);
  await act(async () => { trigger("SIGNED_OUT", null); });
  await act(async () => { hydrate({ user: { id: "old" } } as Session); });
  expect(result.current.user).toBeNull(); expect(getAuthSnapshot().userId).toBeNull();
  expect(getAuthSnapshot().effectiveRole).toBeNull();
});
it("fallback hydration invalidates the old scope before publishing another user", async () => {
  const { result } = renderHook(useAuthSession);
  await act(async () => { hydrate({ user: { id: "new" } } as Session); });
  expect(result.current.user?.id).toBe("new");
  expect(getAuthSnapshot()).toMatchObject({ userId: "new", effectiveRole: null, organizationId: null });
});

it("StrictMode replay cannot let first hydration undo a second subscription logout", async () => {
  const callbacks: typeof trigger[] = [];
  session.subscribe.mockImplementation((callback) => { callbacks.push(callback); trigger = callback; return { unsubscribe: vi.fn() }; });
  const { result } = renderHook(useAuthSession, { reactStrictMode: true });
  expect(callbacks).toHaveLength(2);
  await act(async () => { callbacks[1]("SIGNED_OUT", null); });
  await act(async () => {
    callbacks[0]("SIGNED_IN", { user: { id: "old" } } as Session);
    hydrate({ user: { id: "old" } } as Session);
  });
  expect(result.current.user).toBeNull(); expect(getAuthSnapshot().userId).toBeNull();
});
it("StrictMode retains fallback hydration if neither subscription receives an event", async () => {
  const { result } = renderHook(useAuthSession, { reactStrictMode: true });
  await act(async () => { hydrate({ user: { id: "fallback" } } as Session); });
  expect(result.current.user?.id).toBe("fallback");
});
