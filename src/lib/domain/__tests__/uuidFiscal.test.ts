import { describe, it, expect } from "vitest";
import { normalizarUuidFiscal, mismoUuidFiscal } from "@/lib/domain/uuidFiscal";

describe("normalizarUuidFiscal", () => {
  it("pasa a mayúsculas y quita espacios", () => {
    expect(normalizarUuidFiscal("  f2d6dad2-0000-cee0f  ")).toBe("F2D6DAD2-0000-CEE0F");
  });

  it("devuelve null para vacíos y no-cadenas", () => {
    expect(normalizarUuidFiscal("")).toBeNull();
    expect(normalizarUuidFiscal("   ")).toBeNull();
    expect(normalizarUuidFiscal(null)).toBeNull();
    expect(normalizarUuidFiscal(undefined)).toBeNull();
  });
});

describe("mismoUuidFiscal", () => {
  it("compara ignorando caja y espacios", () => {
    expect(mismoUuidFiscal("abc-123", " ABC-123 ")).toBe(true);
  });

  it("dos vacíos no son el mismo CFDI", () => {
    expect(mismoUuidFiscal(null, null)).toBe(false);
    expect(mismoUuidFiscal("", "  ")).toBe(false);
  });

  it("distingue UUID diferentes", () => {
    expect(mismoUuidFiscal("abc-123", "abc-124")).toBe(false);
  });
});
