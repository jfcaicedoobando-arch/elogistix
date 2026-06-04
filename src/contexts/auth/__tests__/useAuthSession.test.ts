import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

const mockUnsubscribe = vi.fn();
const mockSubscribe = vi.fn(() => ({ unsubscribe: mockUnsubscribe }));
const mockGetSession = vi.fn();

vi.mock("@/services/auth", () => ({
  subscribeToAuthChanges: mockSubscribe,
  getCurrentSession: mockGetSession,
}));

import { useAuthSession } from "../useAuthSession";

beforeEach(() => {
  vi.clearAllMocks();
  mockGetSession.mockResolvedValue(null);
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
    mockSubscribe.mockImplementation((cb: Function) => {
      cb("SIGNED_IN", fakeSession);
      return { unsubscribe: mockUnsubscribe };
    });
    const { result } = renderHook(() => useAuthSession());
    expect(result.current.user?.id).toBe("u1");
    expect(result.current.lastEvent).toBe("SIGNED_IN");
  });
});
