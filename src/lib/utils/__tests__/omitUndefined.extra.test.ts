import { describe, it, expect } from "vitest";
import { omitUndefined } from "@/lib/utils/omitUndefined";

describe("omitUndefined | omitUndefined extra", () => {
  it("01 — retorna objeto vacío para entrada vacía", () => {
    expect(omitUndefined({})).toEqual({});
  });
  it("02 — elimina propiedades con valor undefined", () => {
    expect(omitUndefined({ a: 1, b: undefined })).toEqual({ a: 1 });
  });
  it("03 — conserva null", () => {
    expect(omitUndefined({ a: null, b: undefined })).toEqual({ a: null });
  });
  it("04 — conserva 0", () => {
    expect(omitUndefined({ a: 0, b: undefined })).toEqual({ a: 0 });
  });
  it("05 — conserva false", () => {
    expect(omitUndefined({ a: false, b: undefined })).toEqual({ a: false });
  });
  it("06 — conserva string vacío", () => {
    expect(omitUndefined({ a: "", b: undefined })).toEqual({ a: "" });
  });
  it("07 — no modifica el objeto original", () => {
    const original = { a: 1, b: undefined };
    omitUndefined(original);
    expect(original).toHaveProperty("b");
  });
  it("08 — múltiples undefined", () => {
    expect(omitUndefined({ a: undefined, b: undefined, c: 3 })).toEqual({ c: 3 });
  });
  it("09 — todas las propiedades sin undefined", () => {
    const obj = { a: 1, b: "str", c: true };
    expect(omitUndefined(obj)).toEqual(obj);
  });
  it("10 — preserva referencia de objetos anidados", () => {
    const nested = { x: 1 };
    const result = omitUndefined({ a: nested, b: undefined });
    expect(result.a).toBe(nested);
  });
  it("11 — conserva arrays como valor", () => {
    expect(omitUndefined({ a: [1, 2, 3], b: undefined })).toEqual({ a: [1, 2, 3] });
  });
  it("12 — el tipo de retorno es Partial<T>", () => {
    const result: Partial<{ a: number; b: string }> = omitUndefined({ a: 1, b: undefined });
    expect(result.a).toBe(1);
  });
});
