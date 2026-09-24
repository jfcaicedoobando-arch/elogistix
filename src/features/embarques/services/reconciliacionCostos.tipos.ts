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
  estatus_pago: string | null;
  descripcion: string | null;
  /** Monto YA convertido a la moneda del concepto de costo. 0 si `excluida`. */
  monto: number;
  /** MNY-NEW-03: monto tal como viene en la factura del proveedor. */
  monto_original?: number;
  /** Moneda de la factura del proveedor. */
  moneda?: string | null;
  /** true = no comparable (moneda distinta sin tipo de cambio); no suma. */
  excluida?: boolean;
  motivo_exclusion?: string | null;
}

/** `no_comparable`: hay facturas ligadas sin TC para convertir; el ajuste no es definitivo. */
export type EstatusRenglon = "sin_match" | "parcial" | "conciliado" | "excedente" | "no_comparable";

/** Tolerancia relativa para clasificar Conciliado (±1%). */
export const TOLERANCIA_CONCILIACION = 0.01;

export interface FilaReconciliacion {
  concepto_costo_id: string;
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
}

export interface PFCRow {
  monto: number | string;
  concepto_costo_id: string | null;
  descripcion?: string | null;
  proveedor_facturas: {
    id: string;
    folio_interno?: string | null;
    folio_proveedor: string;
    fecha_emision?: string | null;
    fecha_vencimiento?: string | null;
    estado?: string | null;
    moneda?: string | null;
    tipo_cambio_usd?: number | string | null;
    deleted_at: string | null;
  } | null;
}

export interface CCRow {
  id: string;
  concepto: string;
  proveedor_nombre: string;
  moneda: string;
  monto: number | string;
  estado_liquidacion: string;
}
