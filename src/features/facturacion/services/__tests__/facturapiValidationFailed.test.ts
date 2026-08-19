/**
 * JAVASCRIPT-REACT-5D — `validation_failed` (pre-flight de las edge functions
 * de timbrado) es un dato a corregir por el usuario, no un bug: debe quedar
 * como `expected` (fuera de Sentry) y con un mensaje legible en es-MX.
 */
import { describe, it, expect } from "vitest";
import { toReadableError } from "../facturapiError";
import type { FacturapiError } from "../facturapiError";
import { isExpectedFacturapiValidation } from "@/lib/ui/appFeedback";

describe("validation_failed del timbrado", () => {
  const body = {
    error: "validation_failed",
    issues: [
      {
        field: "documento.imp_saldo_ant",
        message:
          "El pago (1000.00) es mayor al saldo pendiente de la factura (500.00). Ajusta el monto del pago o revisa si ya se aplicó otro pago a esta factura.",
      },
    ],
  };

  it("marca el error como esperado y no lo reporta a Sentry", () => {
    const err = toReadableError(null, body, "No se pudo timbrar el REP.") as FacturapiError;
    expect(err.expected).toBe(true);
    expect(isExpectedFacturapiValidation(err)).toBe(true);
  });

  it("no muestra el código interno 'validation_failed' al usuario", () => {
    const err = toReadableError(null, body, "No se pudo timbrar el REP.");
    expect(err.message).not.toContain("validation_failed");
    expect(err.message).toContain("Revisa estos datos antes de timbrar");
    expect(err.message).toContain("saldo pendiente de la factura");
  });
});
