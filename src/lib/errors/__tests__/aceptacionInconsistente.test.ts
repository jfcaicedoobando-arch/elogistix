/** COT-P-2026-0008: aceptar con oportunidad cerrada es regla de negocio, no falla. */
import { describe, it, expect } from "vitest";
import { translateLcCode } from "../index";
import { isExpectedBusinessError } from "@/lib/query/queryErrorReporting";

const CODE = "LC_COTIZACION_ACEPTACION_INCONSISTENTE";

describe(CODE, () => {
  it("indica reabrir la oportunidad y no dice que ya está aceptada ni manda a soporte", () => {
    const msg = translateLcCode(CODE) ?? "";
    expect(msg).toMatch(/Reabre la oportunidad/);
    expect(msg).not.toMatch(/ya está aceptada/);
    expect(msg).not.toMatch(/soporte/i);
  });

  it("no se reporta a Sentry", () => {
    expect(isExpectedBusinessError({ code: "P0001", message: `${CODE}: el prospecto…` })).toBe(true);
  });
});
