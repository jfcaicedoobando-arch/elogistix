/**
 * Regresión: filtros de Sentry para avisos esperados.
 * - JAVASCRIPT-REACT-5Y / 5S: reglas de negocio (transición cotización,
 *   conflicto de concurrencia) ya se muestran al usuario → no se reportan.
 * - JAVASCRIPT-REACT-5V / 1D: CfdiUploadError en fase de red del dispositivo
 *   → no se reporta; fase `response` (gateway respondió error) sí.
 */
import { describe, expect, it } from "vitest";
import {
  isExpectedBusinessRule,
  isTransientCfdiUploadNetwork,
  shouldReportToSentry,
} from "../appFeedback.sentry";
import { CfdiUploadError } from "@/features/cxp/services";

function cfdiError(phase: "preflight" | "request" | "response"): CfdiUploadError {
  return new CfdiUploadError(
    "No pudimos contactar al servidor desde este dispositivo.",
    {
      attemptCount: 3,
      latencyMs: 4700,
      online: true,
      xmlSize: 1024,
      xmlName: "factura.xml",
      lastStatus: null,
      phase,
      errorName: "FunctionsFetchError",
    },
    null,
  );
}

describe("shouldReportToSentry — reglas de negocio esperadas", () => {
  it("filtra LC_COT_TRANSICION_INVALIDA (5Y)", () => {
    const err = new Error(
      "LC_COT_TRANSICION_INVALIDA: no se puede pasar de Aceptada a Borrador",
    );
    expect(isExpectedBusinessRule(err)).toBe(true);
    expect(shouldReportToSentry(err)).toBe(false);
  });

  it("filtra LC_CONFLICTO_CONCURRENCIA (5S)", () => {
    const err = new Error(
      "LC_CONFLICTO_CONCURRENCIA: Otro usuario modificó este registro",
    );
    expect(shouldReportToSentry(err)).toBe(false);
  });

  it("no filtra otros códigos LC ni errores genéricos", () => {
    expect(
      shouldReportToSentry(new Error("LC_CONCEPTO_DUPLICADO: ya existe")),
    ).toBe(true);
    expect(shouldReportToSentry(new Error("boom"))).toBe(true);
  });
});

describe("shouldReportToSentry — CfdiUploadError de red", () => {
  it("filtra fase request (red del dispositivo)", () => {
    expect(isTransientCfdiUploadNetwork(cfdiError("request"))).toBe(true);
    expect(shouldReportToSentry(cfdiError("request"))).toBe(false);
  });

  it("filtra fase preflight (CORS/origen)", () => {
    expect(shouldReportToSentry(cfdiError("preflight"))).toBe(false);
  });

  it("mantiene reportable la fase response (gateway respondió error)", () => {
    expect(shouldReportToSentry(cfdiError("response"))).toBe(true);
  });
});
