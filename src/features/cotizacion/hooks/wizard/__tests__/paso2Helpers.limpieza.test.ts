/**
 * Bug 6 — al borrar todos los costos de una moneda, sus conceptos de venta
 * deben limpiarse (antes quedaban huérfanos y el paso 3 bloqueaba por
 * "monedas mezcladas").
 */
import { describe, it, expect, vi } from "vitest";
import { sincronizarConceptosPaso2 } from "@/features/cotizacion/hooks/wizard/paso2Helpers";
import type { FilaCostoLocal } from "@/features/cotizacion/types";

function fila(moneda: "USD" | "MXN", precio: number): FilaCostoLocal {
  return {
    concepto: `Flete ${moneda}`, moneda, proveedor: "ACME", cantidad: 1,
    costo_unitario: 100, precio_venta: precio, notas: "",
  } as FilaCostoLocal;
}

describe("sincronizarConceptosPaso2", () => {
  it("limpia los conceptos de la moneda sin costos", () => {
    const setConceptosUSD = vi.fn();
    const setConceptosMXN = vi.fn();
    sincronizarConceptosPaso2({
      costosInternos: [fila("MXN", 4000)],
      tasaIva: 0.16,
      lastCostosHash: { current: null },
      costosPreLlenados: true,
      setConceptosUSD,
      setConceptosMXN,
      setCostosPreLlenados: vi.fn(),
    });
    expect(setConceptosUSD).toHaveBeenCalledWith([]);
    expect(setConceptosMXN).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ moneda: "MXN" })]),
    );
  });
});
