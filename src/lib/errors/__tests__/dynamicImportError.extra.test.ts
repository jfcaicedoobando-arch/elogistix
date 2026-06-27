import { describe, it, expect, vi, beforeEach } from "vitest";


vi.mock("@/lib/browserStorage", () => ({
  hasChunkReloadBeenAttempted: vi.fn(() => false),
  markChunkReloadAttempted: vi.fn(),
}));

import {
  isDynamicImportErrorMessage,
  isDynamicImportError,
  tryReloadForChunkError,
} from "@/lib/errors/dynamicImportError";
import { hasChunkReloadBeenAttempted, markChunkReloadAttempted } from "@/lib/browserStorage";

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
  let reloadSpy: () => void;

  beforeEach(() => {
    vi.mocked(hasChunkReloadBeenAttempted).mockReturnValue(false);
    vi.mocked(markChunkReloadAttempted).mockReset();
    // No mutamos `window.location.reload`: en jsdom `Location.reload` no es
    // configurable y redefinirlo falla antes de escribir el reporte blob.
    reloadSpy = vi.fn();
  });

  it("devuelve true y marca el intento cuando no se ha intentado antes", () => {
    const result = tryReloadForChunkError(reloadSpy);
    expect(result).toBe(true);
    expect(markChunkReloadAttempted).toHaveBeenCalledOnce();
    expect(reloadSpy).toHaveBeenCalledOnce();
  });

  it("devuelve false y NO marca si ya se intentó", () => {
    vi.mocked(hasChunkReloadBeenAttempted).mockReturnValue(true);
    const result = tryReloadForChunkError(reloadSpy);
    expect(result).toBe(false);
    expect(markChunkReloadAttempted).not.toHaveBeenCalled();
    expect(reloadSpy).not.toHaveBeenCalled();
  });
});
