/**
 * A1/A7 (v13.823.151): el paso 1 fijaba siempre USD, así que vincular una
 * oportunidad en MXN fallaba con "monedas distintas".
 */
import { describe, it, expect } from "vitest";
import { monedaPaso1 } from "../cotizacion";
import { COTIZACION_FORM_DEFAULTS } from "@/features/cotizacion/types/formDefaults";

const values = (monedaCrm: "USD" | "MXN" | "") => ({ ...COTIZACION_FORM_DEFAULTS, monedaCrm });

describe("monedaPaso1", () => {
  it("adopta la moneda del CRM en un borrador sin importes", () => {
    expect(monedaPaso1(values("MXN"), true)).toBe("MXN");
  });

  it("cae en USD cuando no hay vínculo CRM con moneda", () => {
    expect(monedaPaso1(values(""), true)).toBe("USD");
  });

  it("no propone moneda cuando ya hay importes capturados", () => {
    expect(monedaPaso1(values("MXN"), false)).toBeUndefined();
  });
});
