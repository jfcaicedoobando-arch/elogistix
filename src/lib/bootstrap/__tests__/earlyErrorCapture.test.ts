import { describe, expect, it, vi } from "vitest";
const { capture } = vi.hoisted(() => ({ capture: vi.fn(() => Promise.resolve(undefined)) }));
vi.mock("@/lib/observability/captureExceptionOnce", () => ({ captureExceptionOnce: capture }));
import { registerEarlyErrorCapture } from "../earlyErrorCapture";

describe("startup error capture", () => {
  it("captures errors before SDK readiness, bounds them and removes both listeners", () => {
    const handlers = new Map<string, EventListener>();
    const target = {
      addEventListener: vi.fn((name: string, handler: EventListener) => handlers.set(name, handler)),
      removeEventListener: vi.fn((name: string, handler: EventListener) => {
        expect(handlers.get(name)).toBe(handler);
        handlers.delete(name);
      }),
    };
    const cleanup = registerEarlyErrorCapture(target as unknown as Window);
    const error = new Error("mock provider error");
    handlers.get("error")!({ error } as unknown as Event);
    handlers.get("unhandledrejection")!({ reason: error } as unknown as Event);
    expect(capture).toHaveBeenNthCalledWith(1, error, { tags: { source: "bootstrap-window" } });
    expect(capture).toHaveBeenNthCalledWith(2, error, { tags: { source: "bootstrap-window" } });
    for (let i = 0; i < 30; i++) handlers.get("error")!({ error } as unknown as Event);
    expect(capture).toHaveBeenCalledTimes(20);
    cleanup();
    expect(handlers.size).toBe(0);
    expect(target.removeEventListener).toHaveBeenCalledTimes(2);
  });
});
