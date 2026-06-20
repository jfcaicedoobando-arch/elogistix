/**
 * Plan A (audit Sentry): valida el `catch` de `fetchUserContext` en
 * `useAuthProfile` — reporta a Sentry con tags `feature: 'auth'`,
 * `phase: 'fetchUserContext'` y `extra.uid`.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";

const sentryMock = vi.hoisted(() => ({ captureException: vi.fn() }));
vi.mock("@sentry/react", () => sentryMock);

const { mockFetchUserContext } = vi.hoisted(() => ({ mockFetchUserContext: vi.fn() }));
vi.mock("@/features/auth/services", () => ({ fetchUserContext: mockFetchUserContext }));

import { useAuthProfile } from "../useAuthProfile";

beforeEach(() => {
  sentryMock.captureException.mockClear();
  mockFetchUserContext.mockReset();
});
afterEach(() => vi.clearAllMocks());

async function flushImport() {
  for (let i = 0; i < 6; i++) await Promise.resolve();
  await new Promise((r) => setTimeout(r, 20));
}

describe("useAuthProfile — captureException", () => {
  it("reporta a Sentry cuando fetchUserContext rechaza, con tag phase y uid", async () => {
    const boom = new Error("profile-fetch-down");
    mockFetchUserContext.mockRejectedValue(boom);
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    renderHook(() => useAuthProfile("u-XYZ"));
    await flushImport();

    await waitFor(() =>
      expect(sentryMock.captureException).toHaveBeenCalledWith(
        boom,
        expect.objectContaining({
          tags: { feature: "auth", phase: "fetchUserContext" },
          extra: { uid: "u-XYZ" },
        }),
      ),
    );
    errSpy.mockRestore();
  });

  it("NO reporta cuando fetchUserContext resuelve", async () => {
    mockFetchUserContext.mockResolvedValue({
      role: "user",
      orgRole: "user",
      organizationId: "o-1",
      organization: null,
    });
    renderHook(() => useAuthProfile("u-OK"));
    await flushImport();
    expect(sentryMock.captureException).not.toHaveBeenCalled();
  });
});
