/**
 * P2-IVA — el tratamiento fiscal declarado por el proveedor se lee, no se
 * adivina, y no altera importes.
 */
import { describe, it, expect } from "vitest";
import {
  AVISO_CFDI_SOLO_IMPORTES,
  detalleTratamientoLinea,
  etiquetaTratamientoLinea,
} from "@/features/cxp/utils/tratamientoLineaCfdi";

const linea = (extra: Record<string, unknown>) => ({
  descripcion: "Flete", cantidad: 1, importe: 1000, iva: 160, ieps: 0, ...extra,
} as never);

describe("etiquetaTratamientoLinea", () => {
  it("muestra la tasa gravada de la línea", () => {
    expect(etiquetaTratamientoLinea(linea({
      objeto_imp: "02",
      traslados: [{ impuesto: "002", base: 1000, tipo_factor: "Tasa", tasa_o_cuota: 0.16, importe: 160 }],
    }))).toBe("16%");
  });

  it("distingue tasa 0%, exento y no objeto", () => {
    expect(etiquetaTratamientoLinea(linea({
      objeto_imp: "02",
      traslados: [{ impuesto: "002", base: 1000, tipo_factor: "Tasa", tasa_o_cuota: 0, importe: 0 }],
    }))).toBe("0%");
    expect(etiquetaTratamientoLinea(linea({
      objeto_imp: "02",
      traslados: [{ impuesto: "002", base: 1000, tipo_factor: "Exento", tasa_o_cuota: null, importe: 0 }],
    }))).toBe("Exento");
    expect(etiquetaTratamientoLinea(linea({ objeto_imp: "01", traslados: [] }))).toBe("No objeto (01)");
  });

  it("no infiere nada cuando el XML no declara el tratamiento", () => {
    expect(etiquetaTratamientoLinea(linea({}))).toBe("No declarado");
    expect(detalleTratamientoLinea(linea({}))).toContain("no declarado");
  });

  it("el detalle conserva base, factor, tasa e importe", () => {
    const d = detalleTratamientoLinea(linea({
      objeto_imp: "02",
      traslados: [{ impuesto: "002", base: 1000, tipo_factor: "Tasa", tasa_o_cuota: 0.16, importe: 160 }],
    }));
    expect(d).toContain("base 1000");
    expect(d).toContain("factor Tasa");
    expect(d).toContain("tasa/cuota 0.16");
    expect(d).toContain("importe 160");
  });

  it("el aviso explica la limitación de persistencia", () => {
    expect(AVISO_CFDI_SOLO_IMPORTES).toContain("sólo se guarda el importe");
    expect(AVISO_CFDI_SOLO_IMPORTES).toContain("XML original queda archivado");
  });
});
