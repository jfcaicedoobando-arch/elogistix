// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const capture = vi.hoisted(() => vi.fn(() => Promise.resolve("event")));
vi.mock("@/lib/observability/captureExceptionOnce", () => ({ captureExceptionOnce: capture }));
vi.mock("@/services/observability", () => ({ logClientError: vi.fn() }));
vi.mock("@/lib/query/queryClient", () => ({ queryClient: { clear: vi.fn() } }));
vi.mock("@/components/shared/errorBoundary/ErrorBoundaryFallback", () => ({ ErrorBoundaryFallback: () => null }));
vi.mock("@/components/shared/errorBoundary/reportFeedback", () => ({ copyDetails: vi.fn(), openReportFeedback: vi.fn() }));

const KEY = "chunk-error-auto-reload";
const chunk = () => new Error("Failed to fetch dynamically imported module: /assets/old.js");
const load = () => import("../dynamicImportError");

beforeEach(() => {
  vi.resetModules();
  vi.useFakeTimers();
  vi.setSystemTime(10_000);
  sessionStorage.clear();
  document.body.innerHTML = '<div id="root"><input value="unsaved"></div>';
  capture.mockClear();
});
afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); vi.restoreAllMocks(); });

// Handler coordination, not an actual browser navigation or beforeunload dialog.
describe("chunk recovery across independent handlers", () => {
  it("coalesces multiple chunks and all handlers into one pending reload", async () => {
    const { tryReloadForChunkError } = await load();
    const { registerChunkRecoveryListeners } = await import("@/lib/bootstrap/startupTasks");
    const { reactErrorHandlers } = await import("@/lib/bootstrap/reactErrorHandlers");
    const { ErrorBoundary } = await import("@/components/shared/ErrorBoundary");
    const handlers = new Map<string, (event: unknown) => void>();
    registerChunkRecoveryListeners({ target: { addEventListener: ((type: string, fn: (e: unknown) => void) => handlers.set(type, fn)) as Window["addEventListener"] } });
    const reload = vi.fn();
    const error = chunk();
    expect(tryReloadForChunkError(reload)).toBe(true);
    handlers.get("vite:preloadError")!({ payload: error });
    const preventDefault = vi.fn();
    handlers.get("unhandledrejection")!({ reason: error, preventDefault });
    handlers.get("error")!({ error: chunk(), preventDefault });
    reactErrorHandlers.onCaughtError(error, {});
    reactErrorHandlers.onRecoverableError(chunk(), {});
    new ErrorBoundary({ children: null }).componentDidCatch(error, {});
    expect(JSON.parse(sessionStorage.getItem(KEY)!)).toEqual({ count: 1, first: 10_000 });
    expect(vi.getTimerCount()).toBe(1);
    expect(preventDefault).toHaveBeenCalledTimes(2);
    expect(capture).not.toHaveBeenCalled();
    expect(error).toHaveProperty("expected", true);
    vi.advanceTimersByTime(1000);
    expect(reload).toHaveBeenCalledOnce();
    expect(error).not.toHaveProperty("expected");
    expect(document.getElementById("chunk-reload-overlay")).toBeNull();
  });

  it("preserves the two-attempt budget between documents, then reopens after two minutes", async () => {
    for (let attempt = 1; attempt <= 3; attempt++) {
      vi.resetModules(); // New document: JS state resets, session storage survives.
      const { tryReloadForChunkError } = await load();
      const reload = vi.fn();
      expect(tryReloadForChunkError(reload)).toBe(attempt <= 2);
      vi.runAllTimers();
      expect(reload).toHaveBeenCalledTimes(attempt <= 2 ? 1 : 0);
    }
    expect(JSON.parse(sessionStorage.getItem(KEY)!).count).toBe(2);
    expect(document.querySelector("#root input")?.getAttribute("value")).toBe("unsaved");
    expect(document.getElementById("chunk-recovery-notice")!.textContent).toContain("Recargar");
    vi.setSystemTime(130_000);
    vi.resetModules();
    expect((await load()).tryReloadForChunkError(vi.fn())).toBe(true);
    expect(JSON.parse(sessionStorage.getItem(KEY)!)).toEqual({ count: 1, first: 130_000 });
  });

  it.each(["getItem", "setItem"] as const)("fails closed when storage %s throws", async (method) => {
    vi.spyOn(Storage.prototype, method).mockImplementation(() => { throw new Error("storage blocked"); });
    const { tryReloadForChunkError } = await load();
    const reload = vi.fn();
    expect(tryReloadForChunkError(reload)).toBe(false);
    vi.runAllTimers();
    expect(reload).not.toHaveBeenCalled();
    expect(document.getElementById("chunk-reload-overlay")).toBeNull();
  });

  it("removes overlay before reload and keeps native beforeunload guards installed", async () => {
    const { tryReloadForChunkError } = await load();
    const guard = vi.fn((event: Event) => event.preventDefault());
    window.addEventListener("beforeunload", guard);
    const reload = vi.fn(() => {
      expect(document.getElementById("chunk-reload-overlay")).toBeNull();
      const event = new Event("beforeunload", { cancelable: true });
      window.dispatchEvent(event);
      expect(event.defaultPrevented).toBe(true);
      expect(document.querySelector("input")?.value).toBe("unsaved");
    });
    try {
      expect(tryReloadForChunkError(reload)).toBe(true);
      vi.runAllTimers();
      expect(guard).toHaveBeenCalledOnce();
      expect(tryReloadForChunkError(reload)).toBe(true);
      vi.runAllTimers();
      expect(reload).toHaveBeenCalledTimes(2);
    } finally { window.removeEventListener("beforeunload", guard); }
  });

  it("does not hide genuine errors while recovery is pending or after budget exhaustion", async () => {
    const { tryReloadForChunkError } = await load();
    const { reactErrorHandlers } = await import("@/lib/bootstrap/reactErrorHandlers");
    tryReloadForChunkError(vi.fn());
    const error = chunk();
    reactErrorHandlers.onCaughtError(error, {});
    const genuine = new Error("real render failure");
    reactErrorHandlers.onCaughtError(genuine, {});
    expect(capture).toHaveBeenCalledWith(genuine, expect.anything());
    vi.runAllTimers();
    sessionStorage.setItem(KEY, JSON.stringify({ count: 2, first: 10_000 }));
    reactErrorHandlers.onCaughtError(error, {});
    expect(error).not.toHaveProperty("expected");
    expect(capture).toHaveBeenCalledWith(error, expect.anything());
  });

  it.each(["own", "cause"])("preserves explicit unexpected intent (%s)", async (mode) => {
    const { reactErrorHandlers } = await import("@/lib/bootstrap/reactErrorHandlers");
    const error = mode === "own" ? Object.assign(chunk(), { expected: false })
      : new Error("ChunkLoadError", { cause: { expected: false } });
    reactErrorHandlers.onCaughtError(error, {});
    expect(capture).toHaveBeenCalledWith(error, expect.anything());
    expect(sessionStorage.getItem(KEY)).toBeNull();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("fails closed if the write is ignored", async () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {});
    expect((await load()).tryReloadForChunkError(vi.fn())).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
  });

  it.each(["not json", '{"count":-1,"first":10000}', '{"count":2,"first":10000}'])("does not overwrite invalid or exhausted history: %s", async (history) => {
    sessionStorage.setItem(KEY, history);
    expect((await load()).tryReloadForChunkError(vi.fn())).toBe(false);
    expect(sessionStorage.getItem(KEY)).toBe(history);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("restores an existing flag and handles frozen errors without throwing", async () => {
    const { tryReloadForChunkError } = await load();
    const error = Object.assign(chunk(), { expected: true });
    const frozen = Object.freeze(chunk());
    expect(tryReloadForChunkError(vi.fn(), { error })).toBe(true);
    expect(tryReloadForChunkError(vi.fn(), { error: frozen })).toBe(true);
    vi.runAllTimers();
    expect(error.expected).toBe(true);
    expect(frozen).not.toHaveProperty("expected");
  });

  it("cleans up if the overlay fails or the reload callback throws", async () => {
    const { tryReloadForChunkError } = await load();
    const error = chunk();
    expect(tryReloadForChunkError(vi.fn(), { error, showOverlay: () => { throw new Error("DOM failure"); } })).toBe(false);
    expect(error).not.toHaveProperty("expected");
    expect(vi.getTimerCount()).toBe(0);
    expect(tryReloadForChunkError(() => { throw new Error("reload failure"); }, { error })).toBe(true);
    expect(() => vi.runAllTimers()).toThrow("reload failure");
    expect(error).not.toHaveProperty("expected");
    expect(document.getElementById("chunk-reload-overlay")).toBeNull();
  });

});
