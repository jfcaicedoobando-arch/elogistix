/**
 * Tipos de dominio para tablas de costos internos P&L (Cotización).
 * Capa neutra: sin imports de components/hooks. Importable desde services/lib/hooks/components.
 *
 * El módulo `src/components/cotizacion/costosPLTypes.ts` re-exporta estos tipos
 * y conserva el helper `calcTotalsPL` (que sí depende de `lib/profitUtils`).
 */

export interface FilaCostoLocal {
  concepto: string;
  moneda: "USD" | "MXN";
  proveedor: string;
  cantidad: number;
  costo_unitario: number;
  precio_venta: number;
  unidad_medida: string;
  aplica_iva?: boolean;
  notas?: string;
  /**
   * Clave SAT del producto/servicio (viene de `catalogo_claves_sat`) al elegir
   * un ítem del catálogo maestro en el paso 2. Se propaga al paso 3 para evitar
   * re-búsqueda por nombre. `undefined` = fila legacy escrita a mano.
   */
  clave_sat?: string;
  /**
   * Tasa IVA a aplicar en el concepto de venta cuando la fila viene del
   * catálogo (0.16 / 0 / exento). Prevalece sobre la heurística por nombre.
   */
  tasa_iva_aplicada?: number;
  /**
   * B-073: linkage a la tarifa/recargo de costeo que originó la fila en la
   * auto-carga desde tarifa. Se persiste en `cotizacion_costos` para que
   * `revalidar_tarifa_cotizacion` pueda comparar el precio vigente contra
   * el snapshot de la cotización (revalidación de precio, no sólo vigencia).
   */
  costeo_tarifa_id?: string | null;
  costeo_tarifa_recargo_id?: string | null;
}


export interface FilaCostoDetalle {
  concepto: string;
  moneda: "USD" | "MXN";
  proveedor: string;
  cantidad: number;
  costo_unitario: number;
  venta: number;
  aplica_iva?: boolean;
  notas?: string;
}
