/**
 * v13.347.0 — Reglas del checklist de cierre ligadas al buzón de facturas
 * de proveedor (facturas que sube operación en la pestaña Costos).
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
    ).toBe("2 proveedor(es) sin archivo recibido ni factura vigente vinculada: COSCO, DHL");
    expect(fmtEntrantesEvidencia({ proveedores_sin_evidencia: 1 }))
      .toBe("1 proveedor(es) sin archivo recibido ni factura vigente vinculada");
    expect(fmtEntrantesEvidencia({ proveedores_sin_evidencia: 0 })).toBeNull();
  });
});

describe("v13.381.1 · buzón vacío", () => {
  it("explica el buzón vacío cuando hay costos sin factura", () => {
    expect(
      fmtEntrantesPendientes({ pendientes: 0, buzon_vacio: true, costos_sin_factura: 2 }),
    ).toBe(
      "El buzón está vacío: aún no se ha capturado ninguna factura de proveedor · 2 costo(s) siguen sin factura",
    );
  });

  it("no dice nada cuando el buzón está vacío pero todos los costos ya tienen factura", () => {
    expect(fmtEntrantesPendientes({ pendientes: 0, buzon_vacio: false })).toBeNull();
  });
});

describe("auditoría 140 · archivo recibido o captura directa", () => {
  it("explica la alternativa sin certificar adjuntos y mantiene la responsabilidad y ruta", () => {
    const meta = getCierreCheckMeta("facturas_entrantes_evidencia");
    expect(meta.label).toBe("Paso 1 · Cada proveedor tiene archivo recibido o factura vigente registrada");
    expect(meta.descripcion).toContain("un archivo en el buzón o una factura vigente capturada y vinculada a sus costos");
    expect(meta.descripcion).toContain("no confirma que haya un PDF o XML adjunto");
    expect(meta.descripcion).toContain("Los costos sin proveedor ni factura vinculada quedan pendientes");
    expect(meta).toMatchObject({ responsable: "Operador", fase: "costos", orden: 1, ctaLabel: "Ir a Costos" });
    expect(meta.ruta!("emb-1")).toContain("focus=facturas-entrantes");
  });
  it("mantiene el resultado OK sin inventar una exigencia de adjuntos", () => {
    expect(fmtEntrantesEvidencia({ proveedores_sin_evidencia: 0, proveedores: [] })).toBeNull();
  });
  it("el detalle pendiente conserva los nombres y el límite de muestra sin exigir adjuntar factura", () => {
    expect(fmtEntrantesEvidencia({ proveedores_sin_evidencia: 4, proveedores: ["A", "B", "C", "D"] }))
      .toBe("4 proveedor(es) sin archivo recibido ni factura vigente vinculada: A, B, C…");
  });
});
