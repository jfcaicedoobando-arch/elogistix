import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  safeLocalStorage,
  safeSessionStorage,
  STORAGE_KEYS,
  loginLoggedKey,
  hasChunkReloadBeenAttempted,
  markChunkReloadAttempted,
  clearChunkReloadFlag,
  getStoredAppVersion,
  setStoredAppVersion,
  getStorageRef,
} from "@/lib/browserStorage";

describe("browserStorage wrapper", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  it("safeLocalStorage round-trip", () => {
    safeLocalStorage.setItem("k", "v");
    expect(safeLocalStorage.getItem("k")).toBe("v");
    safeLocalStorage.removeItem("k");
    expect(safeLocalStorage.getItem("k")).toBeNull();
  });

  it("safeSessionStorage round-trip", () => {
    safeSessionStorage.setItem("k", "v");
    expect(safeSessionStorage.getItem("k")).toBe("v");
    safeSessionStorage.removeItem("k");
    expect(safeSessionStorage.getItem("k")).toBeNull();
  });

  it("setItem no propaga errores (QuotaExceeded) y reporta vía console.warn", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const spy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("Quota", "QuotaExceededError");
    });
    expect(() => safeLocalStorage.setItem("x", "y")).not.toThrow();
    expect(warn).toHaveBeenCalledTimes(1);
    spy.mockRestore();
    warn.mockRestore();
  });

  it("loginLoggedKey usa el prefijo definido", () => {
    expect(loginLoggedKey("abc")).toBe(`${STORAGE_KEYS.loginLoggedPrefix}abc`);
  });

  it("chunk reload helpers (set→has→clear)", () => {
    expect(hasChunkReloadBeenAttempted()).toBe(false);
    markChunkReloadAttempted();
    expect(hasChunkReloadBeenAttempted()).toBe(true);
    clearChunkReloadFlag();
    expect(hasChunkReloadBeenAttempted()).toBe(false);
  });

  it("app version helpers guardan la versión actual", () => {
    expect(getStoredAppVersion()).toBeNull();
    setStoredAppVersion("12.0.0-rc.5");
    expect(getStoredAppVersion()).toBe("12.0.0-rc.5");
  });

  it("getStorageRef devuelve la instancia nativa", () => {
    expect(getStorageRef("local")).toBe(window.localStorage);
    expect(getStorageRef("session")).toBe(window.sessionStorage);
  });
});

describe("browserStorage en SSR (sin window)", () => {
  let originalWindow: typeof globalThis.window | undefined;

  beforeEach(() => {
    originalWindow = globalThis.window;
    // @ts-expect-error simulamos entorno SSR
    delete globalThis.window;
  });

  afterEach(() => {
    globalThis.window = originalWindow!;
  });

  it("getItem devuelve null y setItem es no-op", async () => {
    // Re-import dinámico para asegurar que el wrapper detecte el SSR al evaluar rawStorage.
    const mod = await import("@/lib/browserStorage");
    expect(mod.safeLocalStorage.getItem("x")).toBeNull();
    expect(() => mod.safeLocalStorage.setItem("x", "y")).not.toThrow();
    expect(mod.getStorageRef("local")).toBeUndefined();
  });
});
