/**
 * P1-3 — El toast de timbrado no debe reventar cuando el PAC no regresa UUID.
 */
import { describe, it, expect } from "vitest";
import { tituloTimbrado, uuidCorto } from "@/features/facturacion/utils/uuidCorto";

describe("uuidCorto", () => {
  it("acorta el UUID a 8 caracteres", () => {
    expect(uuidCorto("a1b2c3d4-e5f6-7890-1234-567890abcdef")).toBe("a1b2c3d4…");
  });

  it("devuelve null para undefined, null y cadena vacía", () => {
    expect(uuidCorto(undefined)).toBeNull();
    expect(uuidCorto(null)).toBeNull();
    expect(uuidCorto("")).toBeNull();
    expect(uuidCorto("   ")).toBeNull();
  });
});

describe("tituloTimbrado", () => {
  it("incluye el UUID cuando existe", () => {
    expect(tituloTimbrado("REP timbrado", "a1b2c3d4-e5f6")).toBe("REP timbrado · UUID a1b2c3d4…");
  });

  it("omite el sufijo cuando el PAC no regresó UUID", () => {
    expect(tituloTimbrado("REP timbrado", undefined)).toBe("REP timbrado");
  });
});
