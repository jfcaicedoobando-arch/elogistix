/**
 * Tipos del dominio Tesorería. Separados de `resumen.ts` para respetar
 * el baseline de <200 líneas por archivo (auditoría arquitectónica).
 */

export interface ResumenCuenta {
  id: string;
  alias: string;
  banco: string;
  moneda: string;
  saldo: number;
}

export interface FlujoMes {
  por_cobrar_mxn: number;
  por_cobrar_usd: number;
  /** P1-7 — porción EUR del flujo por cobrar (antes se perdía dentro de `_mxn`). */
  por_cobrar_eur: number;
  por_pagar_mxn: number;
  por_pagar_usd: number;
  /** P1-7 — porción EUR del flujo por pagar. */
  por_pagar_eur: number;
  flujo_neto_mxn: number;
  flujo_neto_usd: number;
  flujo_neto_eur: number;
  /**
   * v13.300.49 — Totales convertidos a MXN usando el tipo de cambio del
   * agregador (todas las monedas presentes). Los KPIs DSO/DPO deben consumir
   * estos campos, NO los `_mxn` puros (que descartan la porción extranjera).
   */
  por_cobrar_total_mxn: number;
  por_pagar_total_mxn: number;
  /** UIA-03/P1-7: `true` cuando hay saldos en divisa extranjera excluidos del
   *  total por falta de TC confiable para esa moneda. */
  flujo_incompleto: boolean;
}

/** P1-7 — canon único de tasas de cambio a MXN que consume el dominio Tesorería. */
export interface TasasCambio {
  usdMxn?: number | null;
  eurMxn?: number | null;
}

export interface TopItem {
  nombre: string;
  saldo: number;
  moneda: string;
  dias?: number;
}

export interface ResumenTesoreria {
  cuentas: ResumenCuenta[];
  flujo: FlujoMes;
  top_deudores: TopItem[];
  top_acreedores: TopItem[];
  /** v13.300.49 — Saldo bancario total convertido a MXN (MXN + USD*TC).
   *  Q-06: sólo suma monedas con TC confiable; ver `saldo_bancos_incompleto`. */
  saldo_bancos_mxn: number;
  /** Q-06: `true` si alguna cuenta en divisa extranjera no pudo convertirse
   *  (sin TC vigente) y quedó fuera de `saldo_bancos_mxn`. */
  saldo_bancos_incompleto: boolean;
  /** Q-06: saldo nominal (sin convertir) agrupado por moneda, para mostrar
   *  el desglose cuando no hay TC disponible. */
  saldos_por_moneda: Record<string, number>;
  /** Q-06: TC USD→MXN vigente usado para convertir (si lo hubo). */
  tipo_cambio_usd?: number | null;
  /** P1-7: TC EUR→MXN vigente usado para convertir (si lo hubo). */
  tipo_cambio_eur?: number | null;
  /** Q-06: fecha (YYYY-MM-DD) del TC DOF aplicado. */
  tipo_cambio_fecha?: string | null;
  /** v13.300.49 — Cartera vencida completa (sin truncar a Top-5). */
  cartera_vencida_total_mxn: number;
  cartera_vencida_count: number;
  cxp_vencidas_count: number;
  cxp_vencidas_total_mxn: number;
}

export interface CobranzaRow {
  id: string;
  numero: string;
  cliente_nombre: string;
  moneda: string;
  saldo: number;
  fecha_vencimiento: string | null;
  estatus_cobranza?: string;
  dias_vencido?: number;
  tipo_cambio?: number;
}

export interface CxpRow {
  id: string;
  folio_proveedor: string;
  proveedor_nombre: string;
  moneda: string;
  saldo: number;
  fecha_vencimiento: string | null;
  /**
   * v13.315.7 (QW1) — Fecha programada de pago. Cuando existe, el flujo
   * proyectado la usa en lugar de `fecha_vencimiento` para colocar la salida
   * en la semana correcta (tesorería programa pagos anticipados/diferidos).
   */
  fecha_programada_pago?: string | null;
  estatus?: string;
  dias_vencido?: number;
  tipo_cambio_usd?: number;
}

export interface LiquidacionRow {
  id: string;
  vendedora_id: string;
  periodo: string;
  total_mxn: number;
  fecha_pago: string | null;
  created_at: string;
}
