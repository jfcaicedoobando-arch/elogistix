import { describe, it, expect } from "vitest";
import { z } from "zod";
import { extractErrorDetails, deriveErrorCode } from "@/components/shared/utils/errorDetailsExtract";
import { ERROR_CODES } from "@/lib/domain/errorCatalog";

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

  it("ZodError directo → validationErrors con path/message/code", () => {
    const schema = z.object({
      conceptos_venta: z.array(z.unknown()).min(1, "Conceptos: se requiere al menos uno."),
    });
    const result = schema.safeParse({ conceptos_venta: [] });
    expect(result.success).toBe(false);
    if (result.success) return;
    const out = extractErrorDetails(result.error);
    expect(out.name).toBe("ZodError");
    expect(out.validationErrors).toBeDefined();
    expect(out.validationErrors?.[0]).toMatchObject({
      path: ["conceptos_venta"],
      message: "Conceptos: se requiere al menos uno.",
      code: "too_small",
    });
  });

  it("Error con ZodError en cause → extrae validationErrors", () => {
    const schema = z.object({ x: z.string() });
    const result = schema.safeParse({ x: 1 });
    if (result.success) throw new Error("debió fallar");
    const wrapped = new Error("Cotización — x: requerido.");
    (wrapped as Error & { cause?: unknown }).cause = result.error;
    const out = extractErrorDetails(wrapped);
    expect(out.validationErrors?.length).toBeGreaterThan(0);
    expect(out.validationErrors?.[0].path).toEqual(["x"]);
  });
});

describe("deriveErrorCode", () => {
  it("ZodError → VALIDATION_FAILED", () => {
    const err = z.string().safeParse(123);
    if (err.success) throw new Error("debió fallar");
    expect(deriveErrorCode(err.error)).toBe(ERROR_CODES.VALIDATION_FAILED);
  });

  it("RLS 42501 → FORBIDDEN", () => {
    expect(deriveErrorCode({ code: "42501", status: 403, message: "x" })).toBe(ERROR_CODES.FORBIDDEN);
  });

  it("unique violation 23505 → CONFLICT", () => {
    expect(deriveErrorCode({ code: "23505", message: "dup" })).toBe(ERROR_CODES.CONFLICT);
  });

  it("HTTP 500 → SERVER_ERROR", () => {
    expect(deriveErrorCode({ status: 500, message: "boom" })).toBe(ERROR_CODES.SERVER_ERROR);
  });

  it("null/undefined → UNKNOWN", () => {
    expect(deriveErrorCode(null)).toBe(ERROR_CODES.UNKNOWN);
    expect(deriveErrorCode(undefined)).toBe(ERROR_CODES.UNKNOWN);
  });
});
