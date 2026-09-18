/**
 * Reglas de "No objeto de impuesto" (SAT ObjetoImp 01) en el cliente: sin
 * retenciones, y con PPD permitido (sólo se ADVIERTE por el REP del cobro).
 * Espejo de las del servidor.
 */
import { describe, it, expect } from "vitest";
import {
  AVISO_NO_OBJETO_PPD_REP,
  MSG_NO_OBJETO_RETENCIONES,
  esLineaNoObjeto,
  hayLineaNoObjeto,
  ppdConNoObjetoRequiereAviso,
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

  it("un renglón no objeto en PPD sólo amerita advertencia (no bloqueo)", () => {
    const lineas = [{ tipo_iva: "gravado_16" }, { tipo_iva: "no_objeto" }];
    expect(hayLineaNoObjeto(lineas)).toBe(true);
    expect(ppdConNoObjetoRequiereAviso("PPD", lineas)).toBe(true);
    expect(ppdConNoObjetoRequiereAviso("PUE", lineas)).toBe(false);
    expect(ppdConNoObjetoRequiereAviso("PPD", [{ tipo_iva: "exento" }])).toBe(false);
    expect(ppdConNoObjetoRequiereAviso("PPD", null)).toBe(false);
  });

  it("los mensajes explican qué hacer y no sugieren falsear el tratamiento", () => {
    expect(MSG_NO_OBJETO_RETENCIONES).toMatch(/retenciones/i);
    // El aviso NO debe presentarse como prohibición ni mandar a cambiar a PUE.
    expect(AVISO_NO_OBJETO_PPD_REP).toMatch(/la emisi[oó]n/i);
    expect(AVISO_NO_OBJETO_PPD_REP).toMatch(/ObjetoImpDR/);
    expect(AVISO_NO_OBJETO_PPD_REP).toMatch(/nunca se cambiar[aá] el tratamiento a Exento/i);
    expect(AVISO_NO_OBJETO_PPD_REP).not.toMatch(/no puede emitirse/i);
  });
});
