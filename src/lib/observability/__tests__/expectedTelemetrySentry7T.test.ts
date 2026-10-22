import { describe, expect, it } from "vitest";
import { isExpectedTelemetryError } from "../expectedTelemetryError";

describe("Sentry 7T: candado de costo ligado a CxP", () => {
  it("LC_COSTO_VINCULADO_CXP es regla de negocio esperada", () => {
    expect(isExpectedTelemetryError(new Error("LC_COSTO_VINCULADO_CXP: el costo está vinculado"))).toBe(true);
  });
  it("sigue reportándose si se marca expected:false", () => {
    const e = Object.assign(new Error("LC_COSTO_VINCULADO_CXP"), { expected: false });
    expect(isExpectedTelemetryError(e)).toBe(false);
  });
});
