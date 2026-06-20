import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";

/**
 * Cubre TOKEN_REFRESHED (deduplicación), SIGNED_OUT y USER_UPDATED.
 * Complementa useAuthSession.test.ts (carga inicial/SIGNED_IN/hidratación).
 */
const { mockUnsubscribe, mockSubscribe, mockGetSession } = vi.hoisted(() => {
  const unsub = vi.fn();
  return {
    mockUnsubscribe: unsub,
    mockSubscribe: vi.fn(() => ({ unsubscribe: unsub })),
    mockGetSession: vi.fn(),
  };
});

vi.mock("@/features/auth/services", () => ({
  subscribeToAuthChanges: mockSubscribe,
  getCurrentSession: mockGetSession,
}));

import { useAuthSession } from "../useAuthSession";

type AuthCb = (evento: string, sesion: unknown) => void;

function captureCallback(): { trigger: AuthCb } {
  let captured: AuthCb = () => {};
  (mockSubscribe as unknown as { mockImplementation: (fn: unknown) => void })
    .mockImplementation((cb: AuthCb) => {
      captured = cb;
      return { unsubscribe: mockUnsubscribe };
    });
  return { trigger: (e, s) => captured(e, s) };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetSession.mockResolvedValue(null);
});

describe("useAuthSession — refresh y transiciones", () => {
  it("TOKEN_REFRESHED con mismo access_token NO sobreescribe la sesión previa", async () => {
    const sub = captureCallback();
    const sesion = { user: { id: "u1" }, access_token: "tok-A" };
    const { result } = renderHook(() => useAuthSession());

    await act(async () => { sub.trigger("SIGNED_IN", sesion); });
    const refPrev = result.current.session;
    expect(refPrev?.access_token).toBe("tok-A");

    await act(async () => {
      sub.trigger("TOKEN_REFRESHED", { user: { id: "u1" }, access_token: "tok-A" });
    });
    // Misma referencia → React no re-renderiza, lastEvent sigue siendo SIGNED_IN.
    expect(result.current.session).toBe(refPrev);
    expect(result.current.lastEvent).toBe("SIGNED_IN");
  });

  it("TOKEN_REFRESHED con nuevo access_token reemplaza la sesión", async () => {
    const sub = captureCallback();
    const { result } = renderHook(() => useAuthSession());
    await act(async () => {
      sub.trigger("SIGNED_IN", { user: { id: "u1" }, access_token: "tok-A" });
    });
    await act(async () => {
      sub.trigger("TOKEN_REFRESHED", { user: { id: "u1" }, access_token: "tok-B" });
    });
    expect(result.current.session?.access_token).toBe("tok-B");
    // lastEvent NO cambia con TOKEN_REFRESHED.
    expect(result.current.lastEvent).toBe("SIGNED_IN");
  });

  it("SIGNED_OUT limpia user/session y marca lastEvent", async () => {
    const sub = captureCallback();
    const { result } = renderHook(() => useAuthSession());
    await act(async () => {
      sub.trigger("SIGNED_IN", { user: { id: "u1" }, access_token: "tok-A" });
    });
    await act(async () => { sub.trigger("SIGNED_OUT", null); });
    expect(result.current.user).toBeNull();
    expect(result.current.session).toBeNull();
    expect(result.current.lastEvent).toBe("SIGNED_OUT");
  });

  it("USER_UPDATED actualiza usuario y marca lastEvent", async () => {
    const sub = captureCallback();
    const { result } = renderHook(() => useAuthSession());
    await act(async () => {
      sub.trigger("USER_UPDATED", { user: { id: "u1", email: "nuevo@x.com" }, access_token: "tok-A" });
    });
    await waitFor(() => expect(result.current.user?.id).toBe("u1"));
    expect(result.current.lastEvent).toBe("USER_UPDATED");
  });
});
