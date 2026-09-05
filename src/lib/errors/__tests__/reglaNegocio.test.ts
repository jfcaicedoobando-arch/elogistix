/**
 * Sentry JAVASCRIPT-REACT-60/-61/-62: las validaciones de negocio (guardas del
 * cliente y códigos LC_* de la base) no deben crear issues.
 */
import { describe, it, expect } from "vitest";
import { ReglaNegocioError } from "../reglaNegocio";
import { isExpectedBusinessError } from "@/lib/query/queryErrorReporting";

describe("ReglaNegocioError", () => {
  it("se marca como esperada y conserva el mensaje visible", () => {
    const err = new ReglaNegocioError("No puedes aprobar una tarifa con vigencia vencida");
    expect(err.name).toBe("ReglaNegocioError");
    expect(err.expected).toBe(true);
    expect(isExpectedBusinessError(err)).toBe(true);
  });

  it("los códigos LC_* son esperados con cualquier ERRCODE (22023, no sólo P0001)", () => {
    expect(
      isExpectedBusinessError({ code: "22023", message: "LC_CRM_MONEDA_INCOMPATIBLE: …" }),
    ).toBe(true);
  });

  it("un error técnico real sigue reportándose", () => {
    expect(
      isExpectedBusinessError({ code: "42501", message: "permission denied for function foo" }),
    ).toBe(false);
  });
});
