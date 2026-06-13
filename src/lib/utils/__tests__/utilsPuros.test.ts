import { describe, it, expect } from "vitest";
import { omitUndefined } from "../omitUndefined";
import { cn } from "../cn";
import { uniqueSorted } from "../uniqueSorted";

describe("lib/utils — omitUndefined", () => {
  it("omitUndefined: elimina llaves undefined", () => {
    const r = omitUndefined({ a: 1, b: undefined, c: "x" });
    expect(r).toEqual({ a: 1, c: "x" });
  });

  it("omitUndefined: preserva null y 0 y cadenas vacías", () => {
    const r = omitUndefined({ a: null, b: 0, c: "" });
    expect(r).toEqual({ a: null, b: 0, c: "" });
  });

  it("omitUndefined: objeto vacío devuelve objeto vacío", () => {
    expect(omitUndefined({})).toEqual({});
  });
});

describe("lib/utils — cn", () => {
  it("cn: combina clases", () => {
    expect(cn("a", "b")).toBe("a b");
  });

  it("cn: tailwind-merge resuelve conflictos (px-2 vs px-4)", () => {
    expect(cn("px-2", "px-4")).toBe("px-4");
  });

  it("cn: ignora falsy values", () => {
    expect(cn("a", "", null, undefined, "c")).toBe("a c");
  });
});

describe("lib/utils — uniqueSorted", () => {
  it("uniqueSorted: deduplica y ordena alfabéticamente", () => {
    const r = uniqueSorted([{ n: "b" }, { n: "a" }, { n: "b" }], (x) => x.n);
    expect(r).toEqual(["a", "b"]);
  });

  it("uniqueSorted: filtra null/undefined/empty", () => {
    const r = uniqueSorted(
      [{ n: "a" }, { n: null }, { n: undefined }, { n: "" }],
      (x) => x.n as string | null | undefined,
    );
    expect(r).toEqual(["a"]);
  });

  it("uniqueSorted: case-insensitive (es-MX)", () => {
    const r = uniqueSorted([{ n: "Banana" }, { n: "apple" }], (x) => x.n);
    expect(r).toEqual(["apple", "Banana"]);
  });

  it("uniqueSorted: arreglo vacío → []", () => {
    expect(uniqueSorted([], (x) => x as string)).toEqual([]);
  });

  it("uniqueSorted: trata acentos como base (a≈á en sensitivity base)", () => {
    const r = uniqueSorted([{ n: "ánimo" }, { n: "barco" }], (x) => x.n);
    expect(r[0]).toBe("ánimo");
  });
});
