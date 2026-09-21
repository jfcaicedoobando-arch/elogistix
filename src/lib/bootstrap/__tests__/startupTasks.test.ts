import { describe, it, expect, vi } from "vitest";
import { registerChunkRecoveryListeners, syncAppVersion } from "../startupTasks";

function depsVersion(stored: string | null) {
  return {
    version: "9.9.9",
    getStoredVersion: () => stored,
    setStoredVersion: vi.fn(),
    clearMemoryCache: vi.fn(),
    clearPersistedCache: vi.fn(),
  };
}

describe("syncAppVersion", () => {
  it("no limpia ni reescribe cuando la versión guardada es la misma", () => {
    const deps = depsVersion("9.9.9");
    expect(syncAppVersion(deps)).toBe(false);
    expect(deps.clearMemoryCache).not.toHaveBeenCalled();
    expect(deps.clearPersistedCache).not.toHaveBeenCalled();
    expect(deps.setStoredVersion).not.toHaveBeenCalled();
  });

  it("limpia memoria y persistencia y guarda la versión nueva", () => {
    const deps = depsVersion("1.0.0");
    expect(syncAppVersion(deps)).toBe(true);
    expect(deps.clearMemoryCache).toHaveBeenCalledTimes(1);
    expect(deps.clearPersistedCache).toHaveBeenCalledTimes(1);
    expect(deps.setStoredVersion).toHaveBeenCalledWith("9.9.9");
  });

  it("limpia también en la primera visita (sin versión guardada)", () => {
    const deps = depsVersion(null);
    expect(syncAppVersion(deps)).toBe(true);
    expect(deps.setStoredVersion).toHaveBeenCalledWith("9.9.9");
  });
});

/** Registro de listeners en un target falso, sin tocar `window`. */
function registrar(isChunkError: (e: unknown) => boolean) {
  const handlers = new Map<string, (event: unknown) => void>();
  const recover = vi.fn();
  registerChunkRecoveryListeners({
    target: {
      addEventListener: ((tipo: string, h: (event: unknown) => void) => {
        handlers.set(tipo, h);
      }) as unknown as Window["addEventListener"],
    },
    isChunkError,
    recover,
  });
  return { handlers, recover };
}

describe("registerChunkRecoveryListeners", () => {
  it("registra exactamente los tres eventos de recuperación", () => {
    const { handlers } = registrar(() => true);
    expect([...handlers.keys()]).toEqual([
      "vite:preloadError",
      "unhandledrejection",
      "error",
    ]);
  });

  it("vite:preloadError siempre previene el default y recupera", () => {
    const { handlers, recover } = registrar(() => false);
    const preventDefault = vi.fn();
    handlers.get("vite:preloadError")!({ preventDefault });
    expect(preventDefault).toHaveBeenCalledTimes(1);
    expect(recover).toHaveBeenCalledTimes(1);
  });

  it("unhandledrejection sólo actúa si el motivo es error de chunk", () => {
    const chunk = registrar((e) => e === "chunk");
    const preventDefault = vi.fn();
    chunk.handlers.get("unhandledrejection")!({ reason: "otro", preventDefault });
    expect(preventDefault).not.toHaveBeenCalled();
    expect(chunk.recover).not.toHaveBeenCalled();

    chunk.handlers.get("unhandledrejection")!({ reason: "chunk", preventDefault });
    expect(preventDefault).toHaveBeenCalledTimes(1);
    expect(chunk.recover).toHaveBeenCalledTimes(1);
  });

  it("error usa event.error y cae a event.message cuando no hay error", () => {
    const vistos: unknown[] = [];
    const { handlers, recover } = registrar((e) => {
      vistos.push(e);
      return e === "boom";
    });
    const preventDefault = vi.fn();
    handlers.get("error")!({ error: undefined, message: "boom", preventDefault });
    expect(vistos).toEqual(["boom"]);
    expect(preventDefault).toHaveBeenCalledTimes(1);
    expect(recover).toHaveBeenCalledTimes(1);

    handlers.get("error")!({ error: new Error("x"), message: "boom", preventDefault });
    expect(recover).toHaveBeenCalledTimes(1);
  });
});
