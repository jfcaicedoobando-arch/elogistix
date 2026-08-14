/**
 * 13.301.59 — Sentry audit (JAVASCRIPT-REACT-2T).
 *
 * Valida que `FacturapiError` marca como `expected: true` los mensajes de
 * validación SAT/FacturApi que el usuario debe corregir en su catálogo
 * (no son bugs de código) y que el helper `isExpectedFacturapiValidation`
 * los reconoce para excluirlos del reporte a Sentry.
 */
import { describe, it, expect } from "vitest";
import { FacturapiError, parseFunctionError } from "../facturapi";
import { toReadableError } from "../facturapiError";
import { isExpectedFacturapiValidation } from "@/lib/ui/appFeedback";

describe("FacturapiError.expected — validaciones SAT esperadas", () => {
  const EXPECTED_MESSAGES = [
    "El campo Nombre del receptor, debe pertenecer al nombre asociado al RFC registrado en el campo Rfc del Receptor.",
    "El RFC del receptor no está registrado ante el SAT.",
    "El régimen fiscal no es válido para el tipo de persona del RFC.",
    "El código postal no coincide con el domicilio fiscal del RFC.",
    "El uso de CFDI no es válido para el régimen fiscal del receptor.",
    "La factura tiene una solicitud de cancelación pendiente.",
  ];

  const UNEXPECTED_MESSAGES = [
    "Edge Function returned a non-2xx status code",
    "Internal server error",
    "network timeout",
    "No se pudo timbrar la factura.",
    'related_documents[0].uuid" is not allowed',
  ];

  it.each(EXPECTED_MESSAGES)("marca como expected: %s", (msg) => {
    // Simula el flujo: parseFunctionError devuelve body con el mensaje del SAT,
    // toReadableError construye el FacturapiError con la clasificación.
    const err = buildFromEdgeBody({ message: msg });
    expect(err.expected).toBe(true);
    expect(isExpectedFacturapiValidation(err)).toBe(true);
  });

  it.each(UNEXPECTED_MESSAGES)("NO marca como expected: %s", (msg) => {
    const err = buildFromEdgeBody({ message: msg });
    expect(err.expected).toBe(false);
    expect(isExpectedFacturapiValidation(err)).toBe(false);
  });

  it("Error normal no es tratado como validación esperada", () => {
    expect(isExpectedFacturapiValidation(new Error("boom"))).toBe(false);
    expect(isExpectedFacturapiValidation(null)).toBe(false);
    expect(isExpectedFacturapiValidation(undefined)).toBe(false);
  });

  it("parseFunctionError extrae el body JSON del Response embebido", async () => {
    const body = { message: "custom", error: "err", transient: true };
    const response = new Response(JSON.stringify(body), {
      headers: { "content-type": "application/json" },
    });
    const parsed = await parseFunctionError({ context: response });
    expect(parsed).toMatchObject(body);
  });
});

/**
 * Usa la implementación real (`toReadableError`) para que la whitelist no se
 * duplique en el test: si el módulo cambia, la prueba lo detecta.
 */
function buildFromEdgeBody(body: { message?: string; error?: string; transient?: boolean }): FacturapiError {
  return toReadableError(null, body, "fallback") as FacturapiError;
}
