/**
 * Tipos y constantes de reconciliación de costos por renglón — sin Supabase.
 */

export interface FacturaVinculada {
  proveedor_factura_id: string;
  /** Folio interno de Libre Carga (FP-XXXXXX); es el que se busca en el sistema. */
  folio_interno: string | null;
  folio_proveedor: string;
  fecha_emision: string | null;
  fecha_vencimiento: string | null;
  /** Estado de proveedor_facturas, no una medición de pagos; el costo usa estado_liquidacion. */
  estatus_pago: string | null;
  descripcion: string | null;
  /** Monto YA convertido a la moneda del concepto de costo. 0 si `excluida`. */
  monto: number;
  /** Subtotal neto de la partida en moneda de factura, antes de convertir. */
  monto_original?: number;
  /** Moneda de la factura del proveedor. */
  moneda?: string | null;
  /** true = no comparable (moneda distinta sin tipo de cambio); no suma. */
  excluida?: boolean;
  motivo_exclusion?: string | null;
}

/** `no_comparable`: hay facturas ligadas sin TC para convertir; el ajuste no es definitivo. */
export type EstatusRenglon = "sin_match" | "parcial" | "conciliado" | "excedente" | "no_comparable" | "ajuste";

/** Tolerancia relativa para clasificar Conciliado (±1%). */
export const TOLERANCIA_CONCILIACION = 0.01;

export interface FilaReconciliacion {
  concepto_costo_id: string;
  embarque_id?: string;
  concepto: string;
  proveedor_nombre: string;
  moneda: string;
  cotizado: number;
  real_facturado: number;
  diferencia: number;
  /** Positivo = nos pasamos del costo cotizado; negativo = ahorro. En %. */
  desviacion_pct: number;
  estado_liquidacion: string;
  estatus_renglon: EstatusRenglon;
  facturas: FacturaVinculada[];
  /** MNY-NEW-03: vínculos no comparables por moneda/TC faltante. */
  vinculos_excluidos?: number;
  /** Delta firmado del presupuesto; su puente es trazabilidad, no facturación adicional. */
  ajuste_presupuestario?: boolean;
}

export interface ResumenReconciliacion {
  total_cotizado: number;
  total_real: number;
  /** Sólo filas comparables; `null` si no hay ninguna comparable (N/D). */
  diferencia_total: number | null;
  desviacion_pct_total: number | null;
  /** Filas `no_comparable` (facturas ligadas sin tipo de cambio). */
  pendientes_tc: number;
  /** Líneas todavía sin ninguna factura proveedor vinculada. */
  conceptos_sin_factura: number;
}

export interface ResumenPorEstatus {
  sin_match: number;
  parcial: number;
  conciliado: number;
  excedente: number;
  no_comparable: number;
  ajuste?: number;
}

export interface ResumenPorMoneda {
  moneda: string;
  /** Presupuesto total de la moneda (incluye pendientes de TC). */
  cotizado: number;
  /** Real facturado comparable; parcial si `pendientes_tc > 0`. */
  real: number;
  /** Variación sólo de filas comparables; `null` = N/D. */
  diferencia: number | null;
  desviacion_pct: number | null;
  pendientes_tc: number;
  /** Renglones sin factura: fuera de la variación (numerador y base). */
  sin_factura: number;
  /** Ajustes sin base comparable de la misma factura/embarque/moneda. */
  ajustes_no_comparables?: number;
}

export interface PFCRow {
  monto: number | string;
  /** Monto unitario × cantidad; NULL, cero u omitida conservan el legado de una unidad. */
  cantidad?: number | string | null;
  concepto_costo_id: string | null;
  descripcion?: string | null;
  proveedor_facturas: {
    id: string;
    folio_interno?: string | null;
    folio_proveedor: string;
    fecha_emision?: string | null;
    fecha_vencimiento?: string | null;
    estado?: string | null;
    estado_aprobacion?: string | null;
    moneda?: string | null;
    tipo_cambio_usd?: number | string | null;
    deleted_at: string | null;
  } | null;
}

export interface CCRow {
  id: string;
  embarque_id?: string;
  origen?: string | null;
  concepto: string;
  proveedor_nombre: string;
  moneda: string;
  monto: number | string;
  estado_liquidacion: string;
}
