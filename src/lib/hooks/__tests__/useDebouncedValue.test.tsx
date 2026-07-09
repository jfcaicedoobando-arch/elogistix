import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useDebouncedValue } from "@/lib/hooks/useDebouncedValue";

describe("useDebouncedValue", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("retorna el valor inicial inmediatamente", () => {
    const { result } = renderHook(() => useDebouncedValue("a", 300));
    expect(result.current).toBe("a");
  });

  it("retarda actualizaciones según delay", () => {
    const { result, rerender } = renderHook(({ v }) => useDebouncedValue(v, 300), {
      initialProps: { v: "a" },
    });
    rerender({ v: "b" });
    expect(result.current).toBe("a");
    act(() => { vi.advanceTimersByTime(299); });
    expect(result.current).toBe("a");
    act(() => { vi.advanceTimersByTime(1); });
    expect(result.current).toBe("b");
  });

  it("cancela timer pendiente al cambiar valor de nuevo", () => {
    const { result, rerender } = renderHook(({ v }) => useDebouncedValue(v, 300), {
      initialProps: { v: "a" },
    });
    rerender({ v: "b" });
    act(() => { vi.advanceTimersByTime(200); });
    rerender({ v: "c" });
    act(() => { vi.advanceTimersByTime(200); });
    expect(result.current).toBe("a");
    act(() => { vi.advanceTimersByTime(100); });
    expect(result.current).toBe("c");
  });

  it("usa 300 ms como delay por defecto", () => {
    const { result, rerender } = renderHook(({ v }) => useDebouncedValue(v), {
      initialProps: { v: 0 },
    });
    rerender({ v: 1 });
    act(() => { vi.advanceTimersByTime(299); });
    expect(result.current).toBe(0);
    act(() => { vi.advanceTimersByTime(1); });
    expect(result.current).toBe(1);
  });
});
