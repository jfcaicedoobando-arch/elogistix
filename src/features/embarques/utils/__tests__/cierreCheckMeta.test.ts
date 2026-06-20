import { describe, it, expect } from "vitest";
import { getCierreCheckMeta } from "../cierreCheckMeta";

describe("cierreCheckMeta", () => {
  it("devuelve metadata para reglas conocidas con ruta al tab del embarque", () => {
    const m = getCierreCheckMeta("cxp_sin_pendientes");
    expect(m.label).toMatch(/pagar/i);
    expect(m.responsable).toBe("Tesorero");
    expect(m.ruta?.("abc-123")).toBe("/embarques/abc-123?tab=facturacion");
  });

  it("documentos lleva al tab documentos", () => {
    const m = getCierreCheckMeta("documentos_completos");
    expect(m.ruta?.("id1")).toBe("/embarques/id1?tab=documentos");
    expect(m.responsable).toBe("Coordinador logístico");
  });

  it("costos con factura lleva al tab costos", () => {
    const m = getCierreCheckMeta("costo_conceptos_con_factura");
    expect(m.ruta?.("id1")).toBe("/embarques/id1?tab=costos");
  });

  it("formato CxC humaniza monto y facturas", () => {
    const m = getCierreCheckMeta("cxc_sin_pendientes");
    const txt = m.formatDetalle({ facturas_pendientes: 2, monto_pendiente: 14500 });
    expect(txt).toMatch(/2 factura/);
    expect(txt).toMatch(/14,500/);
  });

  it("formato docs lista nombres faltantes", () => {
    const m = getCierreCheckMeta("documentos_completos");
    const txt = m.formatDetalle({ faltantes: ["BL", "Factura"] });
    expect(txt).toMatch(/BL/);
    expect(txt).toMatch(/Factura/);
  });

  it("regla desconocida usa fallback sin ruta", () => {
    const m = getCierreCheckMeta("regla_inexistente_xyz");
    expect(m.ruta).toBeNull();
    expect(m.label).toBe("regla_inexistente_xyz");
  });
});
