import { describe, it, expect, vi, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { newRequestId, useStableRequestId } from "@/lib/idempotency";

afterEach(() => vi.restoreAllMocks());

describe("newRequestId", () => {
  it("usa crypto.randomUUID si está disponible", () => {
    const spy = vi.spyOn(crypto, "randomUUID").mockReturnValue("00000000-0000-4000-8000-000000000000" as `${string}-${string}-${string}-${string}-${string}`);
    expect(newRequestId()).toBe("00000000-0000-4000-8000-000000000000");
    expect(spy).toHaveBeenCalled();
  });

  it("genera UUID v4 válido por formato", () => {
    const id = newRequestId();
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  });

  it("genera ids distintos en llamadas consecutivas", () => {
    const a = newRequestId();
    const b = newRequestId();
    expect(a).not.toBe(b);
  });
});

describe("useStableRequestId", () => {
  it("get() devuelve el mismo id en reintentos", () => {
    const { result } = renderHook(() => useStableRequestId());
    const a = result.current.get();
    const b = result.current.get();
    expect(a).toBe(b);
  });

  it("reset() fuerza un id nuevo en el próximo get()", () => {
    const { result } = renderHook(() => useStableRequestId());
    const a = result.current.get();
    act(() => result.current.reset());
    const b = result.current.get();
    expect(a).not.toBe(b);
  });
});
