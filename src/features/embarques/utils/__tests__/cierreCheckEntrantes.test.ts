/**
 * v13.347.0 — Reglas del checklist de cierre ligadas al buzón de facturas
 * de proveedor (invoices que sube operación en la pestaña Costos).
 */
import { describe, it, expect } from "vitest";
import { getCierreCheckMeta } from "../cierreCheckMeta";
import { fmtEntrantesEvidencia, fmtEntrantesPendientes } from "../cierreCheckFormatters";

describe("checklist de cierre · facturas entrantes", () => {
  it("facturas pendientes apuntan a Costos con focus del buzón", () => {
    const meta = getCierreCheckMeta("facturas_entrantes_capturadas");
    expect(meta.responsable).toBe("Auxiliar contable");
    const url = meta.ruta!("emb-1");
    expect(url).toContain("tab=costos");
    expect(url).toContain("focus=facturas-entrantes");
  });

  it("evidencia por proveedor apunta a Costos y responsabiliza al operador", () => {
    const meta = getCierreCheckMeta("facturas_entrantes_evidencia");
    expect(meta.responsable).toBe("Operador");
    expect(meta.ruta!("emb-1")).toContain("focus=facturas-entrantes");
  });

  it("formatea pendientes con antigüedad", () => {
    expect(fmtEntrantesPendientes({ pendientes: 2, dias_max: 5 }))
      .toBe("2 factura(s) del buzón sin capturar · el más antiguo lleva 5 día(s)");
    expect(fmtEntrantesPendientes({ pendientes: 1, dias_max: 0 }))
      .toBe("1 factura(s) del buzón sin capturar");
    expect(fmtEntrantesPendientes({ pendientes: 0 })).toBeNull();
  });

  it("formatea proveedores sin evidencia con muestra de nombres", () => {
    expect(
      fmtEntrantesEvidencia({ proveedores_sin_evidencia: 2, proveedores: ["COSCO", "DHL"] }),
    ).toBe("2 proveedor(es) sin factura adjunta: COSCO, DHL");
    expect(fmtEntrantesEvidencia({ proveedores_sin_evidencia: 1 }))
      .toBe("1 proveedor(es) sin factura adjunta");
    expect(fmtEntrantesEvidencia({ proveedores_sin_evidencia: 0 })).toBeNull();
  });
});
