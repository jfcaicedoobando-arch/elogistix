import { describe, it, expect } from "vitest";
import { classifyError } from "../classifyError";

describe("classifyError", () => {
  it("clasifica PostgrestError con code SQLSTATE como db_error y extrae hint/details", () => {
    const r = classifyError({
      code: "42703",
      message: 'column "user_id" does not exist',
      hint: "Perhaps you meant usuario_id",
      details: "in relation bitacora_actividad",
    });
    expect(r.kind).toBe("db_error");
    expect(r.pgCode).toBe("42703");
    expect(r.pgHint).toMatch(/usuario_id/);
    expect(r.pgDetails).toMatch(/bitacora/);
  });

  it("detecta edge functions por name", () => {
    expect(classifyError({ name: "FunctionsHttpError", message: "x" }).kind).toBe("edge_function");
  });

  it("detecta auth por flag y por status", () => {
    expect(classifyError({ __isAuthError: true, message: "x" }).kind).toBe("auth");
    expect(classifyError({ status: 401, message: "x" }).kind).toBe("auth");
  });

  it("detecta validación de Zod", () => {
    expect(classifyError({ name: "ZodError", issues: [] }).kind).toBe("validation");
  });

  it("detecta errores de red", () => {
    expect(classifyError({ name: "AbortError", message: "x" }).kind).toBe("network");
    expect(classifyError({ name: "TypeError", message: "Failed to fetch" }).kind).toBe("network");
  });

  it("retorna unknown para null/undefined/objetos vacíos", () => {
    expect(classifyError(null).kind).toBe("unknown");
    expect(classifyError(undefined).kind).toBe("unknown");
    expect(classifyError({}).kind).toBe("unknown");
  });
});
