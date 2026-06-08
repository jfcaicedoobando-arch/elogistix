import { describe, it, expect } from "vitest";
import { str, num, numStr, bool, nullable, emptyToNull } from "../_helpers";

describe("mappers/_helpers", () => {
  describe("str", () => {
    it("coerce a string, null/undefined → default", () => {
      expect(str("abc")).toBe("abc");
      expect(str(123)).toBe("123");
      expect(str(null)).toBe("");
      expect(str(undefined)).toBe("");
      expect(str(null, "x")).toBe("x");
    });
  });

  describe("num", () => {
    it("coerce a number, null/undefined/'' → default", () => {
      expect(num(42)).toBe(42);
      expect(num("3.5")).toBe(3.5);
      expect(num(null)).toBe(0);
      expect(num(undefined)).toBe(0);
      expect(num("")).toBe(0);
      expect(num(null, 9)).toBe(9);
    });

    it("rechaza NaN y devuelve default", () => {
      expect(num("NaN")).toBe(0);
      expect(num("not-a-number")).toBe(0);
      expect(num(Number.NaN, 7)).toBe(7);
    });

    it("rechaza ±Infinity y devuelve default", () => {
      expect(num("Infinity")).toBe(0);
      expect(num(Number.POSITIVE_INFINITY)).toBe(0);
      expect(num(Number.NEGATIVE_INFINITY, 5)).toBe(5);
    });
  });

  describe("numStr", () => {
    it("string vacío como default", () => {
      expect(numStr(7)).toBe("7");
      expect(numStr(null)).toBe("");
      expect(numStr(undefined)).toBe("");
    });
  });

  describe("bool", () => {
    it("coerce a boolean con default", () => {
      expect(bool(true)).toBe(true);
      expect(bool(0)).toBe(false);
      expect(bool(null)).toBe(false);
      expect(bool(null, true)).toBe(true);
    });
  });

  describe("nullable", () => {
    it("undefined → null, mantiene null y valores", () => {
      expect(nullable(undefined)).toBe(null);
      expect(nullable(null)).toBe(null);
      expect(nullable("x")).toBe("x");
      expect(nullable(0)).toBe(0);
    });
  });

  describe("emptyToNull", () => {
    it("vacío/null/undefined → null, no vacío pasa", () => {
      expect(emptyToNull("")).toBe(null);
      expect(emptyToNull(null)).toBe(null);
      expect(emptyToNull(undefined)).toBe(null);
      expect(emptyToNull("hola")).toBe("hola");
    });
  });
});
