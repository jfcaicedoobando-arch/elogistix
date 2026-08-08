/**
 * Dominio puro del detalle de un pago (Tesorería).
 *
 * Un pago puede ser un cobro de cliente, un pago a proveedor (individual o en
 * lote) o un anticipo. Aquí viven los tipos y los cálculos sin red ni React:
 * a qué facturas se aplicó, cuánto se aplicó y cuánto queda pendiente.
 */

export type TipoPagoDetalle = "cobro" | "pago" | "anticipo" | "lote";

export interface PagoDetalleEncabezado {
  id: string;
  tipo: TipoPagoDetalle;
  fecha: string;
  contraparte: string | null;
  contraparte_id: string | null;
  moneda: string;
  monto: number;
  tipo_cambio: number;
  monto_mxn: number;
  metodo_pago: string | null;
  referencia: string | null;
  cuenta_bancaria_id: string | null;
  cuenta_alias: string | null;
  cuenta_banco: string | null;
  notas: string | null;
  embarque_id: string | null;
  diferencia_cambiaria_mxn: number;
  estado_rep: string | null;
  folio_rep: string | null;
  es_ajuste: boolean;
  lote_id: string | null;
  estado: string | null;
  saldo_disponible: number | null;
  created_by: string | null;
  created_at: string | null;
}

export interface MovimientoConciliado {
  id: string;
  fecha: string;
  concepto: string | null;
  referencia: string | null;
  cargo: number;
  abono: number;
  saldo: number | null;
  estado_conciliacion: string | null;
  cuenta_bancaria_id: string | null;
  cuenta_alias: string | null;
  cuenta_banco: string | null;
  conciliado_por: string | null;
  conciliado_at: string | null;
}

export interface AplicacionPago {
  documento_id: string;
  documento_tipo: "cliente" | "proveedor";
  folio: string | null;
  folio_proveedor: string | null;
  embarque_id: string | null;
  moneda: string;
  monto_aplicado: number;
  total: number;
  pagado: number;
  fecha_aplicacion: string | null;
  pago_id: string | null;
}

export interface PagoDetalle {
  tipo: TipoPagoDetalle;
  pago: PagoDetalleEncabezado;
  movimiento: MovimientoConciliado | null;
  aplicaciones: AplicacionPago[];
}

/** Referencia mínima para pedir el detalle: tipo + id del pago. */
export interface RefPago {
  tipo: TipoPagoDetalle;
  id: string;
}

export const TIPO_PAGO_DETALLE_LABELS: Record<TipoPagoDetalle, string> = {
  cobro: "Cobro de cliente",
  pago: "Pago a proveedor",
  lote: "Pago en lote a proveedor",
  anticipo: "Anticipo a proveedor",
};

/** Columnas de `bbva_movimientos` que amarran el movimiento con un pago. */
export interface VinculosMovimiento {
  pago_factura_id?: string | null;
  pago_proveedor_id?: string | null;
  pago_proveedor_lote_id?: string | null;
  anticipo_proveedor_id?: string | null;
}

/**
 * Resuelve qué pago está detrás de un movimiento bancario conciliado.
 * El lote gana sobre el pago individual: si el movimiento apunta a un lote,
 * el detalle debe mostrar todas las facturas del lote.
 */
export function refPagoDeMovimiento(mov: VinculosMovimiento | null | undefined): RefPago | null {
  if (!mov) return null;
  if (mov.pago_proveedor_lote_id) return { tipo: "lote", id: mov.pago_proveedor_lote_id };
  if (mov.pago_factura_id) return { tipo: "cobro", id: mov.pago_factura_id };
  if (mov.pago_proveedor_id) return { tipo: "pago", id: mov.pago_proveedor_id };
  if (mov.anticipo_proveedor_id) return { tipo: "anticipo", id: mov.anticipo_proveedor_id };
  return null;
}

/** Saldo pendiente de la factura a la que se aplicó el pago (nunca negativo). */
export function saldoAplicacion(aplicacion: AplicacionPago): number {
  const saldo = aplicacion.total - aplicacion.pagado;
  return saldo > 0 ? saldo : 0;
}

/** Suma de lo aplicado a facturas (en la moneda de cada factura). */
export function totalAplicado(aplicaciones: AplicacionPago[]): number {
  return aplicaciones.reduce((acc, a) => acc + a.monto_aplicado, 0);
}

/** Ruta al detalle del documento al que se aplicó el pago. */
export function rutaAplicacion(aplicacion: AplicacionPago): string {
  return aplicacion.documento_tipo === "cliente"
    ? `/facturacion/${aplicacion.documento_id}`
    : `/compras/facturas/${aplicacion.documento_id}`;
}

/** Resumen corto de las aplicaciones, para chips y columnas de tabla. */
export function resumenAplicaciones(aplicaciones: AplicacionPago[]): string {
  if (aplicaciones.length === 0) return "Sin aplicar";
  if (aplicaciones.length === 1) return aplicaciones[0].folio ?? "1 factura";
  return `${aplicaciones.length} facturas`;
}
