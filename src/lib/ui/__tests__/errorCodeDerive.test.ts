import { describe, it, expect } from "vitest";
import { deriveErrorCode } from "../errorCodeDerive";
import { ERROR_CODES } from "@/lib/domain/errorCatalog";

describe("deriveErrorCode (mapeo de códigos)", () => {
  it("null/undefined -> UNKNOWN", () => {
    expect(deriveErrorCode(null)).toBe(ERROR_CODES.UNKNOWN);
    expect(deriveErrorCode(undefined)).toBe(ERROR_CODES.UNKNOWN);
  });

  it("ZodError -> VALIDATION_FAILED", () => {
    const err = { name: "ZodError", issues: [{ message: "x" }] };
    expect(deriveErrorCode(err)).toBe(ERROR_CODES.VALIDATION_FAILED);
  });

  it("ZodError anidado en cause -> VALIDATION_FAILED", () => {
    const err = { cause: { name: "ZodError", errors: [{ message: "x" }] } };
    expect(deriveErrorCode(err)).toBe(ERROR_CODES.VALIDATION_FAILED);
  });

  it("código postgrest 42501 -> FORBIDDEN", () => {
    expect(deriveErrorCode({ code: "42501" })).toBe(ERROR_CODES.FORBIDDEN);
  });

  it("status 403 con código postgres -> FORBIDDEN", () => {
    expect(deriveErrorCode({ code: "PGRST001", status: 403 })).toBe(ERROR_CODES.FORBIDDEN);
  });

  it("status 401 con código postgres -> UNAUTHORIZED", () => {
    expect(deriveErrorCode({ code: "PGRST001", status: 401 })).toBe(ERROR_CODES.UNAUTHORIZED);
  });

  it("código 23505 -> CONFLICT", () => {
    expect(deriveErrorCode({ code: "23505" })).toBe(ERROR_CODES.CONFLICT);
  });

  it("código postgres desconocido -> DB_ERROR", () => {
    expect(deriveErrorCode({ code: "99999" })).toBe(ERROR_CODES.DB_ERROR);
  });

  it("código PGRST sin status ni match especial -> DB_ERROR", () => {
    expect(deriveErrorCode({ code: "PGRST116" })).toBe(ERROR_CODES.DB_ERROR);
  });

  it("status 401 sin code -> UNAUTHORIZED", () => {
    expect(deriveErrorCode({ status: 401 })).toBe(ERROR_CODES.UNAUTHORIZED);
  });

  it("status 403 sin code -> FORBIDDEN", () => {
    expect(deriveErrorCode({ status: 403 })).toBe(ERROR_CODES.FORBIDDEN);
  });

  it("status 404 -> NOT_FOUND", () => {
    expect(deriveErrorCode({ status: 404 })).toBe(ERROR_CODES.NOT_FOUND);
  });

  it("status 409 -> CONFLICT", () => {
    expect(deriveErrorCode({ status: 409 })).toBe(ERROR_CODES.CONFLICT);
  });

  it("status >= 500 -> SERVER_ERROR", () => {
    expect(deriveErrorCode({ status: 500 })).toBe(ERROR_CODES.SERVER_ERROR);
    expect(deriveErrorCode({ status: 503 })).toBe(ERROR_CODES.SERVER_ERROR);
  });

  it("status >= 400 y < 500 sin match específico -> CLIENT_ERROR", () => {
    expect(deriveErrorCode({ status: 418 })).toBe(ERROR_CODES.CLIENT_ERROR);
  });

  it("status < 400 sin match -> cae a UNKNOWN (fromHttpStatus null)", () => {
    expect(deriveErrorCode({ status: 200 })).toBe(ERROR_CODES.UNKNOWN);
  });

  it("TypeError nativo de red -> NETWORK_ERROR", () => {
    expect(deriveErrorCode(new TypeError("Failed to fetch"))).toBe(ERROR_CODES.NETWORK_ERROR);
  });

  it("TypeError nativo sin mensaje de red -> UNKNOWN", () => {
    expect(deriveErrorCode(new TypeError("algo distinto"))).toBe(ERROR_CODES.UNKNOWN);
  });

  it("objeto plano simulando TypeError de red -> NETWORK_ERROR", () => {
    expect(deriveErrorCode({ name: "TypeError", message: "network request failed" })).toBe(ERROR_CODES.NETWORK_ERROR);
  });

  it("objeto plano TypeError sin mensaje de red -> UNKNOWN", () => {
    expect(deriveErrorCode({ name: "TypeError", message: "otra cosa" })).toBe(ERROR_CODES.UNKNOWN);
  });

  it("cause con TypeError de red -> NETWORK_ERROR", () => {
    expect(deriveErrorCode({ cause: new TypeError("fetch failed") })).toBe(ERROR_CODES.NETWORK_ERROR);
  });

  it("string simple -> UNKNOWN", () => {
    expect(deriveErrorCode("error simple")).toBe(ERROR_CODES.UNKNOWN);
  });

  it("Error genérico sin status/code/network -> UNKNOWN", () => {
    expect(deriveErrorCode(new Error("boom"))).toBe(ERROR_CODES.UNKNOWN);
  });

  it("code no-string se ignora en el regex de postgrest", () => {
    expect(deriveErrorCode({ code: 500 })).toBe(ERROR_CODES.UNKNOWN);
  });
});
