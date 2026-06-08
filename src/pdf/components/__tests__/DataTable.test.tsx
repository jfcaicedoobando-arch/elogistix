/**
 * Verifica el contrato de tipografía defensiva en tablas PDF (12.61.9):
 * - Columnas numéricas blindadas con flexGrow:0 / flexShrink:0 (ancho inviolable).
 * - Celda de descripción con minWidth:0 + flexGrow:1 (wrap real en flex).
 * - Celdas base (`td`) con overflow:hidden y flexShrink:1.
 */
import { describe, it, expect } from "vitest";
import { styles } from "@/pdf/theme/styles";

describe("PDF table — tipografía defensiva", () => {
  it("cellNum / cellNumWide / cellQty tienen ancho fijo e inviolable", () => {
    for (const key of ["cellNum", "cellNumWide", "cellQty"] as const) {
      const s = styles[key] as Record<string, unknown>;
      expect(s.flexGrow).toBe(0);
      expect(s.flexShrink).toBe(0);
      expect(typeof s.width).toBe("number");
    }
  });

  it("cellDesc permite wrap real en flex (minWidth:0 + flexGrow:1)", () => {
    const s = styles.cellDesc as Record<string, unknown>;
    expect(s.flexGrow).toBe(1);
    expect(s.flexShrink).toBe(1);
    expect(s.flexBasis).toBe(0);
    expect(s.minWidth).toBe(0);
  });

  it("td (celda base) contiene desbordamientos sin afectar vecinas", () => {
    const s = styles.td as Record<string, unknown>;
    expect(s.overflow).toBe("hidden");
    expect(s.flexShrink).toBe(1);
  });

  it("tableRow y tableRowZebra alinean stretch para soportar multi-línea", () => {
    expect((styles.tableRow as Record<string, unknown>).alignItems).toBe("stretch");
    expect((styles.tableRowZebra as Record<string, unknown>).alignItems).toBe("stretch");
  });
});
