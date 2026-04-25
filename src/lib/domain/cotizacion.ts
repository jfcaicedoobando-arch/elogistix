/**
 * Reglas de dominio puras para Cotizaciones.
 * Sin dependencias de Supabase, React Query ni UI.
 */
import { CONCEPTOS_CON_IVA_USD } from "@/constants/cotizacionConstants";
import { calcularTotalConIVA } from "@/lib/financialUtils";
import type { FilaCostoLocal } from "@/types/cotizacionPLTypes";

export interface ConceptoVentaPrellenado {
  descripcion: string;
  unidad_medida: string;
  cantidad: number;
  precio_unitario: number;
  moneda: "USD" | "MXN";
  aplica_iva: boolean;
  total: number;
}

/**
 * A partir de las filas de costos internos del wizard, construye los conceptos de venta
 * pre-llenados, separados por moneda. Aplica IVA a los conceptos USD definidos en
 * `CONCEPTOS_CON_IVA_USD` y a todos los MXN.
 */
export function buildConceptosFromCostos(
  costosInternos: FilaCostoLocal[],
  tasaIva: number,
): { usd: ConceptoVentaPrellenado[]; mxn: ConceptoVentaPrellenado[] } {
  const usd = costosInternos
    .filter(c => c.moneda === "USD" && c.concepto.trim())
    .map(c => {
      const tieneIva = (CONCEPTOS_CON_IVA_USD as readonly string[]).includes(c.concepto);
      return {
        descripcion: c.concepto,
        unidad_medida: c.unidad_medida,
        cantidad: c.cantidad,
        precio_unitario: c.precio_venta,
        moneda: "USD" as const,
        aplica_iva: tieneIva,
        total: tieneIva
          ? calcularTotalConIVA(c.cantidad * c.precio_venta, tasaIva)
          : c.cantidad * c.precio_venta,
      };
    });

  const mxn = costosInternos
    .filter(c => c.moneda === "MXN" && c.concepto.trim())
    .map(c => ({
      descripcion: c.concepto,
      unidad_medida: c.unidad_medida,
      cantidad: c.cantidad,
      precio_unitario: c.precio_venta,
      moneda: "MXN" as const,
      aplica_iva: true,
      total: calcularTotalConIVA(c.cantidad * c.precio_venta, tasaIva),
    }));

  return { usd, mxn };
}
