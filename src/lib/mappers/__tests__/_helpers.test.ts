import { describe, it, expect } from "vitest";
import { str, num, numStr, bool, nullable, emptyToNull } from "../_helpers";

describe("mappers/_helpers", () => {
  it("str convierte a string y aplica default en null/undefined", () => {
    expect(str(null)).toBe("");
    expect(str(undefined, "x")).toBe("x");
    expect(str(123)).toBe("123");
  });

  it("num devuelve default para null/undefined/'' y rechaza NaN/Infinity", () => {
    expect(num(null)).toBe(0);
    expect(num("", 5)).toBe(5);
    expect(num("abc", 7)).toBe(7);
    expect(num("3.14")).toBeCloseTo(3.14);
    expect(num(Infinity, 9)).toBe(9);
  });

  it("numStr respeta default sólo en null/undefined (no en '')", () => {
    expect(numStr(null)).toBe("");
    expect(numStr(0)).toBe("0");
    expect(numStr("", "x")).toBe("");
  });

  it("bool aplica default y convierte truthy/falsy", () => {
    expect(bool(undefined, true)).toBe(true);
    expect(bool(0)).toBe(false);
    expect(bool("x")).toBe(true);
  });

  it("nullable normaliza undefined → null", () => {
    expect(nullable(undefined)).toBeNull();
    expect(nullable(null)).toBeNull();
    expect(nullable("x")).toBe("x");
  });

  it("emptyToNull mapea '' a null", () => {
    expect(emptyToNull("")).toBeNull();
    expect(emptyToNull(null)).toBeNull();
    expect(emptyToNull("ok")).toBe("ok");
  });
});
