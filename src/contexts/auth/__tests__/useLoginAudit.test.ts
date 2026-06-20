import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";

const { mockInsert, mockSession } = vi.hoisted(() => ({
  mockInsert: vi.fn(),
  mockSession: {
    getItem: vi.fn<(k: string) => string | null>(() => null),
    setItem: vi.fn(),
    removeItem: vi.fn(),
  },
}));

vi.mock("@/features/auth/services", () => ({ insertLoginAudit: mockInsert }));
vi.mock("@/lib/browserStorage", () => ({
  safeSessionStorage: mockSession,
  loginLoggedKey: (id: string) => `lc:login-logged:${id}`,
}));

import { useLoginAudit } from "../useLoginAudit";
import type { User } from "@supabase/supabase-js";

const FAKE_USER = { id: "u1", email: "test@test.com" } as User;

import { afterEach } from "vitest";

beforeEach(() => {
  vi.clearAllMocks();
  mockSession.getItem.mockReset();
  mockSession.getItem.mockReturnValue(null);
  vi.useFakeTimers();
});
afterEach(() => { vi.useRealTimers(); });

describe("useLoginAudit", () => {
  it("registra login al recibir evento SIGNED_IN", () => {
    mockSession.getItem.mockReturnValue(null);
    renderHook(() => useLoginAudit(FAKE_USER, "SIGNED_IN"));
    vi.advanceTimersByTime(200);
    expect(mockInsert).toHaveBeenCalledWith("u1", "test@test.com");
  });

  it("no registra login si ya existe entrada en sessionStorage", () => {
    mockSession.getItem.mockReturnValue("1");
    renderHook(() => useLoginAudit(FAKE_USER, "SIGNED_IN"));
    vi.advanceTimersByTime(200);
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it("clearLoginAudit elimina la clave de sessionStorage", () => {
    const { result } = renderHook(() => useLoginAudit(null, null));
    result.current.clearLoginAudit("u1");
    expect(mockSession.removeItem).toHaveBeenCalledWith("lc:login-logged:u1");
  });
});
