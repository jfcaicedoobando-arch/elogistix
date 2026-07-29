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

import { createWrapper } from "@/test/utils/queryWrapper";
import { useAuthProfile } from "../useAuthProfile";

// v13.137.35: spy a `console.error` administrado en beforeEach/afterEach. Antes
// se creaba dentro del test sin try/finally → si `waitFor` fallaba, el spy nunca
// se restauraba y `console.error` quedaba silenciado para todo el resto del shard.
let errSpy: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  sentryMock.captureException.mockClear();
  mockFetchUserContext.mockReset();
  errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  errSpy?.mockRestore();
  vi.clearAllMocks();
});

describe("useAuthProfile — captureException", () => {
  it("reporta a Sentry cuando fetchUserContext rechaza, con tag phase y uid", async () => {
    const boom = new Error("profile-fetch-down");
    mockFetchUserContext.mockRejectedValue(boom);

    const { unmount } = renderHook(() => useAuthProfile("u-XYZ"), { wrapper: createWrapper() });

    await waitFor(() =>
      expect(sentryMock.captureException).toHaveBeenCalledWith(
        boom,
        expect.objectContaining({
          tags: { feature: "auth", phase: "fetchUserContext" },
          extra: { uid: "u-XYZ" },
        }),
      ),
    );
    unmount();
  });

  it("NO reporta cuando fetchUserContext resuelve", async () => {
    // v13.137.24: antes el negativo se aseveraba tras un `setTimeout(20)` real
    // (frágil + falso positivo silencioso). Ahora primero esperamos a que el
    // efecto efectivamente llame al servicio (rama de éxito) y sólo entonces
    // verificamos que Sentry NO se invocó.
    mockFetchUserContext.mockResolvedValue({
      role: "user",
      orgRole: "user",
      organizationId: "o-1",
      organization: null,
    });
    const { unmount } = renderHook(() => useAuthProfile("u-OK"), { wrapper: createWrapper() });
    await waitFor(() => expect(mockFetchUserContext).toHaveBeenCalled());
    // microtask flush para que cualquier `.catch` ya hubiese disparado
    await Promise.resolve();
    await Promise.resolve();
    expect(sentryMock.captureException).not.toHaveBeenCalled();
    unmount();
  });
});
