import { describe, it, expect } from "vitest";
import { z, ZodError } from "zod";
import { fromDb, toDbJson } from "../cast";

describe("fromDb", () => {
  it("returns data as T when no schema is provided", () => {
    const result = fromDb<{ id: string }>({ id: "abc" });
    expect(result.id).toBe("abc");
  });

  it("validates and returns parsed data when a schema is provided", () => {
    const schema = z.object({ id: z.string().uuid() });
    const uuid = "11111111-1111-1111-1111-111111111111";
    const result = fromDb({ id: uuid }, schema);
    expect(result.id).toBe(uuid);
  });

  it("throws ZodError on malformed payload when schema is provided", () => {
    const schema = z.object({ id: z.string().uuid() });
    expect(() => fromDb({ id: "not-a-uuid" }, schema)).toThrow(ZodError);
  });

  it("throws ZodError when expected field is missing", () => {
    const schema = z.object({ id: z.string() });
    expect(() => fromDb({}, schema)).toThrow(ZodError);
  });

  it("validates arrays", () => {
    const schema = z.array(z.object({ id: z.string(), expediente: z.string() }));
    const result = fromDb([{ id: "1", expediente: "EXP-1" }], schema);
    expect(result).toHaveLength(1);
    expect(result[0].expediente).toBe("EXP-1");
  });
});

describe("toDbJson", () => {
  it("returns value typed as Json", () => {
    const value = { conceptos: [{ tipo: "flete", monto: 100 }] };
    expect(toDbJson(value)).toEqual(value);
  });
});
