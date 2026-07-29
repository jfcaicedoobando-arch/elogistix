import { describe, it, expect, vi, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { usePdfExport } from "../usePdfExport";

vi.mock("@/lib/ui/appFeedback", () => ({
  notifySuccess: vi.fn(),
  notifyError: vi.fn(),
}));

import { notifySuccess, notifyError } from "@/lib/ui/appFeedback";

describe("usePdfExport", () => {
  afterEach(() => vi.clearAllMocks());

  it("marca isExporting durante la ejecución y notifica éxito al terminar", async () => {
    const { result } = renderHook(() => usePdfExport({ successTitle: "PDF listo" }));
    let resolveFn!: () => void;
    const pending = new Promise<void>((resolve) => { resolveFn = resolve; });

    act(() => {
      void result.current.run(() => pending);
    });
    expect(result.current.isExporting).toBe(true);

    resolveFn();
    await waitFor(() => expect(result.current.isExporting).toBe(false));
    expect(notifySuccess).toHaveBeenCalledWith(undefined, { title: "PDF listo" });
  });

  it("notifica error y limpia isExporting si la generación falla", async () => {
    const { result } = renderHook(() => usePdfExport());
    await act(async () => {
      await result.current.run(() => Promise.reject(new Error("boom")));
    });
    expect(result.current.isExporting).toBe(false);
    expect(notifyError).toHaveBeenCalled();
  });

  it("ignora llamadas concurrentes mientras ya está exportando", async () => {
    const fn = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => usePdfExport());
    let resolveFirst!: () => void;
    const first = new Promise<void>((resolve) => { resolveFirst = resolve; });
    act(() => { void result.current.run(() => first); });
    await act(async () => { await result.current.run(fn); });
    expect(fn).not.toHaveBeenCalled();
    resolveFirst();
    await waitFor(() => expect(result.current.isExporting).toBe(false));
  });
});
