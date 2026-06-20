import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";

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

beforeEach(() => {
  vi.clearAllMocks();
  mockGetSession.mockResolvedValue(null);
  // Restaurar impl por defecto del subscribe (sin disparar eventos).
  mockSubscribe.mockImplementation(() => ({ unsubscribe: mockUnsubscribe }));
});

describe("useAuthSession", () => {
  it("inicia con loading=true y user/session=null", () => {
    const { result } = renderHook(() => useAuthSession());
    expect(result.current.user).toBeNull();
    expect(result.current.session).toBeNull();
  });

  it("se suscribe a cambios de auth y llama unsubscribe al desmontar", () => {
    const { unmount } = renderHook(() => useAuthSession());
    expect(mockSubscribe).toHaveBeenCalledOnce();
    unmount();
    expect(mockUnsubscribe).toHaveBeenCalledOnce();
  });

  it("actualiza user y session ante evento SIGNED_IN", async () => {
    const fakeUser = { id: "u1", email: "a@b.com" };
    const fakeSession = { user: fakeUser, access_token: "tok" };
    (mockSubscribe as unknown as { mockImplementation: (fn: unknown) => void }).mockImplementation((cb: (e: string, s: unknown) => void) => {
      cb("SIGNED_IN", fakeSession);
      return { unsubscribe: mockUnsubscribe };
    });
    const { result } = renderHook(() => useAuthSession());
    expect(result.current.user?.id).toBe("u1");
    expect(result.current.lastEvent).toBe("SIGNED_IN");
  });

  it("hidrata desde getCurrentSession cuando no hay evento INITIAL_SESSION", async () => {
    const fakeUser = { id: "u-hyd", email: "h@x.com" };
    const fakeSession = { user: fakeUser, access_token: "tok" };
    mockGetSession.mockResolvedValueOnce(fakeSession);
    const { result } = renderHook(() => useAuthSession());
    await waitFor(() => expect(result.current.user?.id).toBe("u-hyd"));
    expect(result.current.session?.access_token).toBe("tok");
  });

  it("ante error en getCurrentSession no rompe y mantiene user=null", async () => {
    mockGetSession.mockRejectedValueOnce(new Error("network"));
    const { result } = renderHook(() => useAuthSession());
    await waitFor(() => expect(mockGetSession).toHaveBeenCalled());
    expect(result.current.user).toBeNull();
    expect(result.current.session).toBeNull();
  });
});

