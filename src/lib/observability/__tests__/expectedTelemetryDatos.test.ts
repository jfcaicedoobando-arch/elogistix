import { describe, expect, it } from "vitest";
import { isExpectedTelemetryError } from "../expectedTelemetryError";

describe("guards de datos no se reportan (Sentry 7Q/77)", () => {
  it("LC_CREDITO_TC_INVALIDO es esperado", () => {
    expect(isExpectedTelemetryError(new Error("LC_CREDITO_TC_INVALIDO: corrige el tipo de cambio"))).toBe(true);
  });
  it("saldo del complemento distinto al PAC es esperado", () => {
    expect(isExpectedTelemetryError({ name: "FacturapiError", message: "El saldo ... no coinciden con el resumen del proveedor de timbrado." })).toBe(true);
  });
  it("un error genérico sigue reportándose", () => {
    expect(isExpectedTelemetryError(new Error("function max(uuid) does not exist"))).toBe(false);
  });
});
