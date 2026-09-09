import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";


vi.mock("@/lib/browserStorage", () => ({
  getChunkReloadHistory: vi.fn(() => null),
  saveChunkReloadHistory: vi.fn(),
}));

import {
  isDynamicImportErrorMessage,
  isDynamicImportError,
  tryReloadForChunkError,
} from "@/lib/errors/dynamicImportError";
import { getChunkReloadHistory, saveChunkReloadHistory } from "@/lib/browserStorage";

describe("dynamicImportError · isDynamicImportErrorMessage · entradas falsy", () => {
  it("devuelve false para undefined", () => {
    expect(isDynamicImportErrorMessage(undefined)).toBe(false);
  });

  it("devuelve false para null", () => {
    expect(isDynamicImportErrorMessage(null)).toBe(false);
  });

  it("devuelve false para cadena vacía", () => {
    expect(isDynamicImportErrorMessage("")).toBe(false);
  });
});

describe("dynamicImportError · isDynamicImportErrorMessage · firmas conocidas", () => {
  it("detecta 'failed to fetch dynamically imported module'", () => {
    expect(isDynamicImportErrorMessage("Failed to fetch dynamically imported module")).toBe(true);
  });

  it("detecta 'importing a module script failed'", () => {
    expect(isDynamicImportErrorMessage("Importing a module script failed")).toBe(true);
  });

  it("detecta 'loading chunk'", () => {
    expect(isDynamicImportErrorMessage("Error loading chunk 42")).toBe(true);
  });

  it("detecta 'chunkloaderror'", () => {
    expect(isDynamicImportErrorMessage("ChunkLoadError: ...")).toBe(true);
  });

  it("detecta `reading 'default'`", () => {
    expect(isDynamicImportErrorMessage("Cannot read properties of undefined (reading 'default')")).toBe(true);
  });

  it("detecta `reading \"default\"`", () => {
    expect(isDynamicImportErrorMessage('Cannot read properties of undefined (reading "default")')).toBe(true);
  });

  it("devuelve false para un mensaje arbitrario sin firma", () => {
    expect(isDynamicImportErrorMessage("Network error 500")).toBe(false);
  });
});

describe("dynamicImportError · isDynamicImportError", () => {
  it("devuelve false para null", () => {
    expect(isDynamicImportError(null)).toBe(false);
  });

  it("devuelve false para un Error genérico", () => {
    expect(isDynamicImportError(new Error("generic error"))).toBe(false);
  });

  it("devuelve true para un Error con firma de chunk", () => {
    expect(isDynamicImportError(new Error("Failed to fetch dynamically imported module"))).toBe(true);
  });

  it("devuelve true para un string con firma", () => {
    expect(isDynamicImportError("loading chunk 7 failed")).toBe(true);
  });

  it("devuelve false para un string sin firma", () => {
    expect(isDynamicImportError("random string error")).toBe(false);
  });

  it("devuelve true para objeto plano con message de chunk", () => {
    expect(isDynamicImportError({ message: "ChunkLoadError: loading chunk 1 failed" })).toBe(true);
  });

  it("devuelve false para objeto plano con message genérico", () => {
    expect(isDynamicImportError({ message: "Something went wrong" })).toBe(false);
  });

  it("devuelve false para número primitivo", () => {
    expect(isDynamicImportError(42)).toBe(false);
  });
});

describe("dynamicImportError · tryReloadForChunkError", () => {
  let reloadSpy: ReturnType<typeof vi.fn>;
  let overlaySpy: ReturnType<typeof vi.fn>;
  let fallbackSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.mocked(getChunkReloadHistory).mockReturnValue(null);
    vi.mocked(saveChunkReloadHistory).mockReset();
    // No mutamos `window.location.reload`: en jsdom `Location.reload` no es
    // configurable y redefinirlo falla antes de escribir el reporte blob.
    reloadSpy = vi.fn();
    overlaySpy = vi.fn();
    fallbackSpy = vi.fn();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const opts = () => ({ showOverlay: overlaySpy, showFallback: fallbackSpy });

  it("primer fallo: muestra overlay y programa el reload tras el delay", () => {
    const result = tryReloadForChunkError(reloadSpy, { ...opts(), delayMs: 1000, now: () => 1_000 });
    expect(result).toBe(true);
    expect(overlaySpy).toHaveBeenCalledOnce();
    expect(saveChunkReloadHistory).toHaveBeenCalledWith({ count: 1, first: 1_000 });
    expect(reloadSpy).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1_000);
    expect(reloadSpy).toHaveBeenCalledOnce();
  });

  it("segundo fallo dentro de la ventana: vuelve a recargar", () => {
    vi.mocked(getChunkReloadHistory).mockReturnValue({ count: 1, first: 1_000 });
    const result = tryReloadForChunkError(reloadSpy, { ...opts(), now: () => 60_000 });
    expect(result).toBe(true);
    expect(saveChunkReloadHistory).toHaveBeenCalledWith({ count: 2, first: 1_000 });
    vi.runAllTimers();
    expect(reloadSpy).toHaveBeenCalledOnce();
  });

  it("tercer fallo dentro de la ventana: NO recarga, muestra fallback manual", () => {
    vi.mocked(getChunkReloadHistory).mockReturnValue({ count: 2, first: 1_000 });
    const result = tryReloadForChunkError(reloadSpy, { ...opts(), now: () => 90_000 });
    expect(result).toBe(false);
    expect(fallbackSpy).toHaveBeenCalledOnce();
    expect(overlaySpy).not.toHaveBeenCalled();
    vi.runAllTimers();
    expect(reloadSpy).not.toHaveBeenCalled();
  });

  it("fallo fuera de la ventana (más de 2 min): reinicia el contador y recarga", () => {
    vi.mocked(getChunkReloadHistory).mockReturnValue({ count: 2, first: 1_000 });
    const result = tryReloadForChunkError(reloadSpy, { ...opts(), now: () => 500_000 });
    expect(result).toBe(true);
    expect(saveChunkReloadHistory).toHaveBeenCalledWith({ count: 1, first: 500_000 });
    vi.runAllTimers();
    expect(reloadSpy).toHaveBeenCalledOnce();
  });
});
