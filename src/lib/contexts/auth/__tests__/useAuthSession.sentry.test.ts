/**
 * Plan A (audit Sentry): garantiza que el `catch` de
 * `getCurrentSession()` en `useAuthSession` reporta a Sentry con los tags
 * `feature: 'auth'`, `phase: 'getCurrentSession'`. Sin este test, un refactor
 * que reemplace el lazy import podría dejar el fallo de auth silencioso.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";

const sentryMock = vi.hoisted(() => ({ captureException: vi.fn() }));
vi.mock("@sentry/react", () => sentryMock);

const { mockSubscribe, mockGetSession } = vi.hoisted(() => ({
  mockSubscribe: vi.fn(() => ({ unsubscribe: vi.fn() })),
  mockGetSession: vi.fn(),
}));

vi.mock("@/features/auth/services", () => ({
  subscribeToAuthChanges: mockSubscribe,
  getCurrentSession: mockGetSession,
}));

import { useAuthSession } from "../useAuthSession";

beforeEach(() => {
  sentryMock.captureException.mockClear();
  mockGetSession.mockReset();
  mockSubscribe.mockImplementation(() => ({ unsubscribe: vi.fn() }));
});

afterEach(() => vi.clearAllMocks());

async function flushImport() {
  for (let i = 0; i < 6; i++) await Promise.resolve();
  await new Promise((r) => setTimeout(r, 0));
}

describe("useAuthSession — captureException", () => {
  it("reporta a Sentry cuando getCurrentSession rechaza", async () => {
    const boom = new Error("session-down");
    mockGetSession.mockRejectedValue(boom);
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const { result } = renderHook(() => useAuthSession());
    await waitFor(() => expect(result.current.loading).toBe(false));
    await flushImport();

    expect(sentryMock.captureException).toHaveBeenCalledWith(
      boom,
      expect.objectContaining({
        tags: { feature: "auth", phase: "getCurrentSession" },
      }),
    );
    errSpy.mockRestore();
  });

  it("NO reporta cuando getCurrentSession resuelve correctamente", async () => {
    mockGetSession.mockResolvedValue(null);
    const { result } = renderHook(() => useAuthSession());
    await waitFor(() => expect(result.current.loading).toBe(false));
    await flushImport();
    expect(sentryMock.captureException).not.toHaveBeenCalled();
  });
});
