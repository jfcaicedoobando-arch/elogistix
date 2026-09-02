import { describe, it, expect } from "vitest";
import { atajoBusquedaGlobal, esMac } from "@/lib/ui/atajoTeclado";

describe("atajoBusquedaGlobal", () => {
  it("muestra Ctrl+K en Windows", () => {
    expect(atajoBusquedaGlobal({ platform: "Win32", userAgent: "Mozilla/5.0 (Windows NT 10.0)" })).toBe("Ctrl+K");
  });

  it("muestra ⌘K en macOS", () => {
    expect(atajoBusquedaGlobal({ platform: "MacIntel", userAgent: "Mozilla/5.0 (Macintosh)" })).toBe("⌘K");
  });

  it("detecta iPad/iPhone como Mac", () => {
    expect(esMac({ platform: "iPhone", userAgent: "iPhone" })).toBe(true);
  });

  it("es defensivo sin navigator", () => {
    expect(atajoBusquedaGlobal({})).toBe("Ctrl+K");
  });
});
