import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fetchConReintento, OFFLINE_MSG } from "../enviarPorEmail";

describe("fetchConReintento", () => {
  const originalFetch = globalThis.fetch;
  const originalOnLineDesc = Object.getOwnPropertyDescriptor(
    globalThis.navigator,
    "onLine",
  );

  beforeEach(() => {
    vi.useFakeTimers();
    Object.defineProperty(globalThis.navigator, "onLine", {
      configurable: true,
      get: () => true,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    globalThis.fetch = originalFetch;
    if (originalOnLineDesc) {
      Object.defineProperty(globalThis.navigator, "onLine", originalOnLineDesc);
    }
  });

  it("falla rápido cuando navigator.onLine es false (no toca fetch)", async () => {
    Object.defineProperty(globalThis.navigator, "onLine", {
      configurable: true,
      get: () => false,
    });
    const fetchSpy = vi.fn();
    globalThis.fetch = fetchSpy as unknown as typeof fetch;

    await expect(fetchConReintento("https://x.test", { method: "POST" })).rejects.toThrow(
      OFFLINE_MSG,
    );
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("reintenta 5 veces ante TypeError: Failed to fetch y propaga el último error", async () => {
    const fetchSpy = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"));
    globalThis.fetch = fetchSpy as unknown as typeof fetch;

    const promise = fetchConReintento("https://x.test", { method: "POST" });
    // avanza los backoffs (0 + 1s + 2s + 4s + 8s)
    const expectRejection = expect(promise).rejects.toThrow("Failed to fetch");
    await vi.runAllTimersAsync();
    await expectRejection;
    expect(fetchSpy).toHaveBeenCalledTimes(5);
  });

  it("no reintenta ante errores que NO son de red (los propaga inmediato)", async () => {
    const fetchSpy = vi.fn().mockRejectedValue(new Error("boom"));
    globalThis.fetch = fetchSpy as unknown as typeof fetch;

    await expect(fetchConReintento("https://x.test", { method: "POST" })).rejects.toThrow(
      "boom",
    );
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("devuelve la respuesta del primer intento exitoso", async () => {
    const resp = new Response("ok", { status: 200 });
    const fetchSpy = vi.fn().mockResolvedValue(resp);
    globalThis.fetch = fetchSpy as unknown as typeof fetch;

    const result = await fetchConReintento("https://x.test", { method: "POST" });
    expect(result).toBe(resp);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });
});
