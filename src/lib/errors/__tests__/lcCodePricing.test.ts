import { describe, expect, it } from "vitest";
import { translateLcCode } from "../lcCodes";

const pricingCodes = [
  "LC_COT_PRICING_ORIGEN_CONFIRMADO", "LC_COT_PRICING_ORIGEN_INVALIDO", "LC_COT_PRICING_SOLO_RPC",
  "LC_PRICING_ACL_DRIFT", "LC_PRICING_CLIENTE_INCOMPATIBLE", "LC_PRICING_COTIZACION_NO_EDITABLE",
  "LC_PRICING_INCOTERM_CATALOG_DRIFT", "LC_PRICING_INCOTERM_CATALOG_POSTCHECK",
  "LC_PRICING_OPORTUNIDAD_NO_ELEGIBLE", "LC_PRICING_ORIGEN_INCOMPATIBLE", "LC_PRICING_ORIGEN_INCOMPLETO",
  "LC_PRICING_ORIGEN_NO_AUTORIZADO", "LC_PRICING_REQUIERE_CLIENTE", "LC_PRICING_SOLICITUD_NO_RESPONDIDA", "LC_PRICING_SCHEMA_DRIFT",
  "LC_COT_VINCULO_CONFIRMADO", "LC_CRM_MONEDA_INCOMPATIBLE", "LC_SIN_SESION", "LC_TARIFA_NO_VIGENTE",
];

describe("mensajes del vínculo Pricing y catálogo de Incoterms", () => {
  it.each(pricingCodes)("traduce %s sin exponer el diagnóstico técnico", (code) => {
    const message = translateLcCode(`${code}: internal catalog details`);
    expect(message).toBeTruthy();
    expect(message).not.toContain("LC_");
    expect(message).not.toContain("internal catalog details");
  });
  it.each(["LC_PRICING_SCHEMA_DRIFT", "LC_PRICING_ACL_DRIFT", "LC_PRICING_INCOTERM_CATALOG_DRIFT", "LC_PRICING_INCOTERM_CATALOG_POSTCHECK"])("%s exige revisión técnica", (code) => {
    expect(translateLcCode(code)).toMatch(/revisión técnica/i);
    expect(translateLcCode(code)).toMatch(/soporte/i);
  });
});
