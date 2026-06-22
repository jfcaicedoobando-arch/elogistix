import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fetchWithRetry } from "../fetchWithRetry";

const okRes = (body: unknown = {}) =>
  ({ ok: true, status: 200, json: async () => body }) as unknown as Response;
const errRes = (status: number) =>
  ({ ok: false, status, json: async () => ({}) }) as unknown as Response;

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

async function runWithTimers<T>(p: Promise<T>): Promise<T> {
  // Adjuntamos un handler temprano para evitar "unhandled rejection" mientras
  // avanzan los timers virtuales antes de que el caller haga await.
  p.catch(() => {});
  await vi.runAllTimersAsync();
  return p;
}

describe("fetchWithRetry", () => {
  it("devuelve respuesta exitosa al primer intento sin reintentar", async () => {
    const fetchSpy = vi.fn().mockResolvedValue(okRes({ ok: 1 }));
    vi.stubGlobal("fetch", fetchSpy);
    const onRetry = vi.fn();
    const res = await runWithTimers(
      fetchWithRetry("https://x/y", { method: "GET" }, { onRetry }),
    );
    expect(res.ok).toBe(true);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(onRetry).not.toHaveBeenCalled();
  });

  it("reintenta en TypeError Failed to fetch y termina ok", async () => {
    const failure = Object.assign(new TypeError("Failed to fetch"), { name: "TypeError" });
    const fetchSpy = vi
      .fn()
      .mockRejectedValueOnce(failure)
      .mockResolvedValueOnce(okRes({ ok: 1 }));
    vi.stubGlobal("fetch", fetchSpy);
    const onRetry = vi.fn();
    const res = await runWithTimers(
      fetchWithRetry("https://x/y", { method: "POST" }, { onRetry, backoffMs: [10] }),
    );
    expect(res.ok).toBe(true);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("reintenta en 503 hasta 3 intentos y devuelve el último 503", async () => {
    const fetchSpy = vi.fn().mockResolvedValue(errRes(503));
    vi.stubGlobal("fetch", fetchSpy);
    const res = await runWithTimers(
      fetchWithRetry("https://x/y", { method: "GET" }, { backoffMs: [5, 5] }),
    );
    expect(res.status).toBe(503);
    expect(fetchSpy).toHaveBeenCalledTimes(3);
  });

  it("NO reintenta en 400", async () => {
    const fetchSpy = vi.fn().mockResolvedValue(errRes(400));
    vi.stubGlobal("fetch", fetchSpy);
    const res = await runWithTimers(fetchWithRetry("https://x/y", { method: "GET" }));
    expect(res.status).toBe(400);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("propaga el error si todos los intentos fallan con TypeError", async () => {
    const failure = new TypeError("Failed to fetch");
    const fetchSpy = vi
      .fn()
      .mockRejectedValueOnce(failure)
      .mockRejectedValueOnce(failure)
      .mockRejectedValueOnce(failure);
    vi.stubGlobal("fetch", fetchSpy);
    await expect(
      runWithTimers(
        fetchWithRetry("https://x/y", { method: "GET" }, { backoffMs: [5, 5] }),
      ),
    ).rejects.toThrow(/failed to fetch/i);
    expect(fetchSpy).toHaveBeenCalledTimes(3);
  });

  it("usa buildInit en cada intento (FormData fresca)", async () => {
    const failure = new TypeError("Failed to fetch");
    const fetchSpy = vi
      .fn()
      .mockRejectedValueOnce(failure)
      .mockResolvedValueOnce(okRes());
    vi.stubGlobal("fetch", fetchSpy);
    const builder = vi.fn(() => ({ method: "POST", body: new FormData() } as RequestInit));
    await runWithTimers(
      fetchWithRetry("https://x/y", builder, { backoffMs: [5] }),
    );
    expect(builder).toHaveBeenCalledTimes(2);
  });
});
