/**
 * P1 · Auditoría IVA — Reglas de "No objeto de impuesto" (SAT ObjetoImp 01)
 * en el cliente: sin retenciones y sin PPD. Espejo de las del servidor.
 */
import { describe, it, expect } from "vitest";
import {
  MSG_NO_OBJETO_PPD,
  MSG_NO_OBJETO_RETENCIONES,
  esLineaNoObjeto,
  hayLineaNoObjeto,
  ppdIncompatibleNoObjeto,
  retencionesIncompatiblesNoObjeto,
  tieneRetenciones,
} from "@/lib/financial/noObjetoFiscal";

describe("noObjetoFiscal", () => {
  it("sólo el tratamiento explícito es no objeto (nunca se infiere)", () => {
    expect(esLineaNoObjeto({ tipo_iva: "no_objeto" })).toBe(true);
    expect(esLineaNoObjeto({ tipo_iva: "exento" })).toBe(false);
    expect(esLineaNoObjeto({ tipo_iva: "tasa_0" })).toBe(false);
    expect(esLineaNoObjeto({})).toBe(false);
  });

  it("detecta retenciones capturadas de ISR o de IVA", () => {
    expect(tieneRetenciones({ tasa_ret_isr: 0.1 })).toBe(true);
    expect(tieneRetenciones({ tasa_ret_iva: 0.04 })).toBe(true);
    expect(tieneRetenciones({ tasa_ret_isr: 0, tasa_ret_iva: 0 })).toBe(false);
  });

  it("no objeto + retención es una combinación prohibida", () => {
    expect(retencionesIncompatiblesNoObjeto({ tipo_iva: "no_objeto", tasa_ret_isr: 0.1 })).toBe(true);
    expect(retencionesIncompatiblesNoObjeto({ tipo_iva: "no_objeto", tasa_ret_iva: 0.04 })).toBe(true);
    expect(retencionesIncompatiblesNoObjeto({ tipo_iva: "no_objeto" })).toBe(false);
    expect(retencionesIncompatiblesNoObjeto({ tipo_iva: "gravado_16", tasa_ret_isr: 0.1 })).toBe(false);
  });

  it("un solo renglón no objeto inhabilita el PPD de la factura", () => {
    const lineas = [{ tipo_iva: "gravado_16" }, { tipo_iva: "no_objeto" }];
    expect(hayLineaNoObjeto(lineas)).toBe(true);
    expect(ppdIncompatibleNoObjeto("PPD", lineas)).toBe(true);
    expect(ppdIncompatibleNoObjeto("PUE", lineas)).toBe(false);
    expect(ppdIncompatibleNoObjeto("PPD", [{ tipo_iva: "exento" }])).toBe(false);
    expect(ppdIncompatibleNoObjeto("PPD", null)).toBe(false);
  });

  it("los mensajes explican qué hacer y no sugieren falsear el tratamiento", () => {
    expect(MSG_NO_OBJETO_RETENCIONES).toMatch(/retenciones/i);
    expect(MSG_NO_OBJETO_PPD).toMatch(/PUE/);
    expect(MSG_NO_OBJETO_PPD).toMatch(/nunca cambiarlo a Exento/i);
    // Debe quedar claro que es una limitación de la integración, no del SAT.
    expect(MSG_NO_OBJETO_PPD).toMatch(/limitaci[oó]n actual de nuestra integraci[oó]n/i);
    expect(MSG_NO_OBJETO_PPD).toMatch(/no es una prohibici[oó]n del SAT/i);
  });
});
