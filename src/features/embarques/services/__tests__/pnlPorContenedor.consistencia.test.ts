/**
 * Fase 3 · punto 8 — Consistencia del P&L: el encabezado (totales del embarque)
 * debe cuadrar al centavo contra la suma del desglose por contenedor, incluso
 * cuando los conceptos generales no se dividen exacto entre N contenedores.
 */
import { describe, it, expect } from "vitest";
import { calcularPnlPorContenedor } from "../pnlPorContenedor";
import type { EmbarqueContenedor } from "@/features/embarques/types/contenedor";
import type { ConceptoVentaRow, ConceptoCostoRow } from "@/features/embarques/types/embarque";

function contenedor(id: string, orden: number): EmbarqueContenedor {
  // SAFE-CAST: fixture mínimo para el cálculo puro del P&L.
  return { id, orden, numero_contenedor: `C${orden}`, tipo_contenedor: "40HC" } as unknown as EmbarqueContenedor;
}
function venta(total: number, contenedorId: string | null = null): ConceptoVentaRow {
  return { total, moneda: "USD", contenedor_id: contenedorId } as unknown as ConceptoVentaRow;
}
function costo(monto: number, contenedorId: string | null = null): ConceptoCostoRow {
  return { monto, moneda: "USD", contenedor_id: contenedorId } as unknown as ConceptoCostoRow;
}

describe("P&L por contenedor — encabezado vs desglose", () => {
  it("la fila Total coincide con la suma de los contenedores (generales indivisibles)", () => {
    const filas = calcularPnlPorContenedor({
      expediente: "ELIMP00297",
      contenedores: [contenedor("a", 1), contenedor("b", 2), contenedor("c", 3)],
      conceptosVenta: [venta(1000, "a"), venta(100)],
      conceptosCosto: [costo(500, "b"), costo(100)],
    }).USD;

    const hijos = filas.filter((f) => f.contenedorId !== null);
    const total = filas.find((f) => f.esTotal)!;

    const sumaVenta = hijos.reduce((acc, f) => acc + f.ventaTotal, 0);
    const sumaCosto = hijos.reduce((acc, f) => acc + f.costoTotal, 0);

    expect(Number(sumaVenta.toFixed(2))).toBe(total.ventaTotal);
    expect(Number(sumaCosto.toFixed(2))).toBe(total.costoTotal);
    // El total del embarque es la suma bruta de conceptos, sin fuga de residuos.
    expect(total.ventaTotal).toBe(1100);
    expect(total.costoTotal).toBe(600);
    expect(total.utilidad).toBe(500);
  });

  it("el prorrateo reparte por número de contenedores, no por otro divisor", () => {
    const filas = calcularPnlPorContenedor({
      expediente: "ELIMP00297",
      contenedores: [contenedor("a", 1), contenedor("b", 2)],
      conceptosVenta: [],
      conceptosCosto: [costo(300)],
    }).USD;

    const hijos = filas.filter((f) => f.contenedorId !== null);
    expect(hijos.map((f) => f.costoProrrateado)).toEqual([150, 150]);
  });
});
