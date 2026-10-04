/** @vitest-environment jsdom */
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useDiaNegocio } from "../useDiaNegocio";

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date", "setTimeout", "clearTimeout"] });
  vi.setSystemTime(new Date("2026-10-04T05:59:59Z"));
});
afterEach(() => vi.useRealTimers());

describe("día de negocio reactivo", () => {
  it("comparte un timer y cambia exactamente a medianoche CDMX", () => {
    const a = renderHook(() => useDiaNegocio());
    const b = renderHook(() => useDiaNegocio());
    expect(a.result.current).toBe("2026-10-03");
    expect(b.result.current).toBe("2026-10-03");
    expect(vi.getTimerCount()).toBe(1);
    act(() => vi.advanceTimersByTime(1000));
    expect(a.result.current).toBe("2026-10-04");
    expect(b.result.current).toBe("2026-10-04");
    expect(vi.getTimerCount()).toBe(1);
    a.unmount();
    b.unmount();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("resincroniza al recuperar foco tras una pestaña suspendida", () => {
    const { result, unmount } = renderHook(() => useDiaNegocio());
    vi.setSystemTime(new Date("2026-10-05T06:01:00Z"));
    act(() => window.dispatchEvent(new Event("focus")));
    expect(result.current).toBe("2026-10-05");
    unmount();
  });
});
