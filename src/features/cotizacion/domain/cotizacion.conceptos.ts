/**
 * Regla de dominio: pre-llenado de conceptos de venta a partir de costos
 * internos del wizard de cotización. Extraído de `cotizacion.ts` (Power-of-10).
 */
import { CONCEPTOS_CON_IVA_USD } from "@/constants/cotizacionConstants";
import { calcularTotalConIVA, subtotalLinea } from "@/lib/financial/financialUtils";
import type { FilaCostoLocal } from "@/features/cotizacion/types";

export interface ConceptoVentaPrellenado {
  descripcion: string;
  unidad_medida: string;
  cantidad: number;
  precio_unitario: number;
  moneda: "USD" | "MXN";
  aplica_iva: boolean;
  total: number;
  /** Clave SAT heredada del catálogo maestro cuando el paso 2 usó el combobox. */
  clave_sat?: string;
  /** Tasa IVA específica del producto (0.16, 0, exento). Prevalece sobre `tasaIva`. */
  tasa_iva_aplicada?: number;
  /**
   * Comentarios capturados en la fila de costos. Se propagan al concepto de
   * venta para que aparezcan como subrenglón en el PDF de la cotización.
   */
  notas?: string;
}

/**
 * A partir de las filas de costos internos del wizard, construye los conceptos de venta
 * pre-llenados, separados por moneda.
 *
 * Reglas de IVA (13.291 → 13.292):
 *   - Si la fila trae `tasa_iva_aplicada` (viene del catálogo maestro `catalogo_claves_sat`),
 *     esa tasa manda: `aplica_iva = tasa > 0`, total con IVA usando la tasa del producto.
 *   - Si NO trae metadata del catálogo (fila legacy), se cae al comportamiento previo:
 *     lista blanca `CONCEPTOS_CON_IVA_USD` para USD, IVA general para MXN.
 */
export function buildConceptosFromCostos(
  costosInternos: FilaCostoLocal[],
  tasaIva: number,
): { usd: ConceptoVentaPrellenado[]; mxn: ConceptoVentaPrellenado[] } {
  const usd = costosInternos
    .filter(c => c.moneda === "USD" && c.concepto.trim())
    .map(c => {
      const tasaProducto = c.tasa_iva_aplicada;
      const desdeCatalogo = tasaProducto !== undefined;
      const tieneIva = desdeCatalogo
        ? tasaProducto! > 0
        : (CONCEPTOS_CON_IVA_USD as readonly string[]).includes(c.concepto);
      const tasaAplicar = desdeCatalogo ? (tasaProducto as number) : tasaIva;
      // BL-12: canon `subtotalLinea` (redondeo currency.js), no float crudo.
      const subtotal = subtotalLinea(c.cantidad, c.precio_venta);
      return {
        descripcion: c.concepto,
        unidad_medida: c.unidad_medida,
        cantidad: c.cantidad,
        precio_unitario: c.precio_venta,
        moneda: "USD" as const,
        aplica_iva: tieneIva,
        total: tieneIva ? calcularTotalConIVA(subtotal, tasaAplicar) : subtotal,
        clave_sat: c.clave_sat,
        notas: c.notas,
        // P2-4 (R5): persistimos la tasa EFECTIVA, no la del catálogo. Antes quedaba
        // `undefined` en filas manuales y el IVA se guardaba como 0 aguas abajo.
        tasa_iva_aplicada: tieneIva ? tasaAplicar : 0,
      };
    });

  const mxn = costosInternos
    .filter(c => c.moneda === "MXN" && c.concepto.trim())
    .map(c => {
      const tasaProducto = c.tasa_iva_aplicada;
      const desdeCatalogo = tasaProducto !== undefined;
      // En MXN el default histórico es IVA general; sólo se apaga si el catálogo lo marca exento/tasa 0.
      const tieneIva = desdeCatalogo ? tasaProducto! > 0 : true;
      const tasaAplicar = desdeCatalogo ? (tasaProducto as number) : tasaIva;
      // BL-12: canon `subtotalLinea` (redondeo currency.js), no float crudo.
      const subtotal = subtotalLinea(c.cantidad, c.precio_venta);
      return {
        descripcion: c.concepto,
        unidad_medida: c.unidad_medida,
        cantidad: c.cantidad,
        precio_unitario: c.precio_venta,
        moneda: "MXN" as const,
        aplica_iva: tieneIva,
        total: tieneIva ? calcularTotalConIVA(subtotal, tasaAplicar) : subtotal,
        clave_sat: c.clave_sat,
        notas: c.notas,
        // P2-4 (R5): persistimos la tasa EFECTIVA, no la del catálogo. Antes quedaba
        // `undefined` en filas manuales y el IVA se guardaba como 0 aguas abajo.
        tasa_iva_aplicada: tieneIva ? tasaAplicar : 0,
      };
    });

  return { usd, mxn };
}
