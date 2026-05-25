import { describe, it, expect } from "vitest";
import { extractErrorDetails } from "@/lib/ui/errorDetailsExtract";

describe("extractErrorDetails", () => {
  it("retorna {} para null/undefined", () => {
    expect(extractErrorDetails(null)).toEqual({});
    expect(extractErrorDetails(undefined)).toEqual({});
  });

  it("strings → message", () => {
    expect(extractErrorDetails("boom")).toEqual({ message: "boom" });
  });

  it("Error instance captura message, name y stack", () => {
    const err = new Error("kaboom");
    const out = extractErrorDetails(err);
    expect(out.message).toBe("kaboom");
    expect(out.name).toBe("Error");
    expect(out.stack).toBeTypeOf("string");
  });

  it("Error con propiedades Postgrest (code/status/details/hint)", () => {
    const err = Object.assign(new Error("RLS"), {
      code: "42501", status: 403, details: "denied", hint: "check policy",
    });
    const out = extractErrorDetails(err);
    expect(out.code).toBe("42501");
    expect(out.status).toBe(403);
    expect(out.details).toBe("denied");
    expect(out.hint).toBe("check policy");
  });

  it("objeto plano tipo PostgrestError", () => {
    const out = extractErrorDetails({ message: "fail", code: 23505, status: 409 });
    expect(out.message).toBe("fail");
    expect(out.code).toBe(23505);
    expect(out.status).toBe(409);
  });

  it("objeto sin message hace JSON.stringify como fallback", () => {
    const out = extractErrorDetails({ foo: "bar" });
    expect(out.message).toBe(JSON.stringify({ foo: "bar" }));
  });

  it("primitivo no-string vía String()", () => {
    expect(extractErrorDetails(42)).toEqual({ message: "42" });
  });

  it("descarta valores con tipos incorrectos", () => {
    const out = extractErrorDetails({ message: "ok", code: { x: 1 }, status: "abc", details: 9 });
    expect(out.message).toBe("ok");
    expect(out.code).toBeUndefined();
    expect(out.status).toBeUndefined();
    expect(out.details).toBeUndefined();
  });
});
