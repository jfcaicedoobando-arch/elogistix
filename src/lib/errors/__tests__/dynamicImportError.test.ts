import { describe, it, expect } from "vitest";
import { isDynamicImportError, isDynamicImportErrorMessage } from "@/lib/errors/dynamicImportError";

describe("isDynamicImportErrorMessage", () => {
  it("detecta firmas conocidas (case-insensitive)", () => {
    expect(isDynamicImportErrorMessage("Failed to fetch dynamically imported module")).toBe(true);
    expect(isDynamicImportErrorMessage("Loading chunk 42 failed")).toBe(true);
    expect(isDynamicImportErrorMessage("ChunkLoadError")).toBe(true);
    expect(isDynamicImportErrorMessage("Importing a module script failed")).toBe(true);
  });

  it("ignora mensajes no relacionados", () => {
    expect(isDynamicImportErrorMessage("Network request failed")).toBe(false);
    expect(isDynamicImportErrorMessage("")).toBe(false);
    expect(isDynamicImportErrorMessage(null)).toBe(false);
    expect(isDynamicImportErrorMessage(undefined)).toBe(false);
  });
});

describe("isDynamicImportError", () => {
  it("acepta Error, string y objeto con .message", () => {
    expect(isDynamicImportError(new Error("Failed to fetch dynamically imported module x"))).toBe(true);
    expect(isDynamicImportError("loading chunk fallo")).toBe(true);
    expect(isDynamicImportError({ message: "ChunkLoadError" })).toBe(true);
  });

  it("rechaza null/undefined/otros tipos", () => {
    expect(isDynamicImportError(null)).toBe(false);
    expect(isDynamicImportError(undefined)).toBe(false);
    expect(isDynamicImportError(42)).toBe(false);
    expect(isDynamicImportError({ foo: "bar" })).toBe(false);
  });
});
