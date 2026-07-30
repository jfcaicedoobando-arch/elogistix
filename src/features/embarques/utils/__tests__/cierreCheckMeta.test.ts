import { describe, it, expect } from "vitest";
import { getCierreCheckMeta } from "../cierreCheckMeta";

describe("cierreCheckMeta", () => {
  it("CxP devuelve ruta con focus=cxp al tab costos", () => {
    const m = getCierreCheckMeta("cxp_pagada");
    expect(m.responsable).toBe("Tesorero");
    const url = m.ruta!("abc");
    expect(url).toContain("tab=costos");
    expect(url).toContain("focus=cxp");
  });

  it("CxC devuelve ruta con focus=cxc al tab facturacion", () => {
    const m = getCierreCheckMeta("cxc_cobrada");
    const url = m.ruta!("id1");
    expect(url).toContain("tab=facturacion");
    expect(url).toContain("focus=cxc");
  });

  it("documentos lleva con focus=faltantes", () => {
    const m = getCierreCheckMeta("docs_completos");
    expect(m.ruta!("id1")).toContain("focus=faltantes");
  });

  it("contenedores incluye ids del detalle como csv", () => {
    const m = getCierreCheckMeta("contenedores_datos_completos");
    const url = m.ruta!("id1", { contenedores_incompletos: 2, ids: ["c1", "c2"] });
    expect(url).toContain("tab=resumen");
    expect(url).toContain("focus=contenedores");
    expect(url).toContain("ids=c1%2Cc2");
  });

  it("formato CxC humaniza saldo y facturas", () => {
    const m = getCierreCheckMeta("cxc_cobrada");
    const txt = m.formatDetalle({ total: 20000, pagado: 5500, facturas_pendientes: 2 });
    expect(txt).toMatch(/2 factura/);
    expect(txt).toMatch(/14,500/);
  });

  it("formato docs lista nombres faltantes cuando viene array", () => {
    const m = getCierreCheckMeta("documentos_completos");
    const txt = m.formatDetalle({ faltantes: ["BL", "Factura"] });
    expect(txt).toMatch(/BL/);
    expect(txt).toMatch(/Factura/);
  });

  it("formato docs maneja conteo cuando viene número", () => {
    const m = getCierreCheckMeta("docs_completos");
    const txt = m.formatDetalle({ faltantes: 3 });
    expect(txt).toMatch(/3 documento/);
  });

  it("toda regla conocida declara fase y orden", () => {
    const reglas = [
      "cxc_cobrada", "cxp_pagada", "documentos_completos", "docs_completos",
      "facturas_entrantes_capturadas", "facturas_entrantes_evidencia",
      "pnl_margen_minimo", "comision_calculada", "contenedores_datos_completos",
      "contenedores_fechas_completas", "venta_conceptos_facturados",
      "costo_conceptos_con_factura", "rep_pendientes", "rep_timbrados",
      "comisiones_definitivas", "margen_minimo",
    ];
    for (const r of reglas) {
      const m = getCierreCheckMeta(r);
      expect(m.fase, r).not.toBe("otros");
      expect(m.orden, r).toBeGreaterThan(0);
    }
  });

  it("regla desconocida usa fallback sin ruta", () => {
    const m = getCierreCheckMeta("regla_inexistente_xyz");
    expect(m.ruta).toBeNull();
    expect(m.label).toBe("regla_inexistente_xyz");
  });
});
