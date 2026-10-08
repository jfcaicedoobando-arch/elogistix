/** Contratos de las bandejas compartidos por lectura y agregación pura. */
export interface CxpPorCapturarRow {
  embarque_id: string;
  expediente: string | null;
  estado_embarque?: string | null;
  cotizacion_folio?: string | null;
  cliente_nombre: string | null;
  presupuestado_mxn: number;
  presupuestado_usd: number;
  /** Base fiscal capturada atribuida, sin IVA, NC ni pagos; moneda documental. */
  facturado_mxn: number;
  facturado_usd: number;
  facturas_capturadas: number;
  ultima_factura_fecha: string | null;
  dias_desde_ultima_factura: number | null;
}

export interface CxpPorPagarRow {
  factura_id: string;
  proveedor_id: string | null;
  proveedor_nombre: string | null;
  proveedor_origen: string | null;
  folio_proveedor: string | null;
  embarque_id: string | null;
  expediente: string | null;
  fecha_emision: string | null;
  fecha_vencimiento: string | null;
  dias_para_vencer: number | null;
  moneda: string;
  total: number;
  pagado: number;
  saldo: number;
  estado_captura: string;
  tipo_cambio_usd: number | null;
  fecha_programada_pago: string | null;
}


export interface CarteraPendienteRow {
  factura_id: string;
  numero: string | null;
  cliente_id: string | null;
  cliente_nombre: string | null;
  embarque_id: string | null;
  expediente: string | null;
  fecha_emision: string | null;
  fecha_vencimiento: string | null;
  dias_vencido: number;
  moneda: string;
  total: number;
  pagado: number;
  saldo: number;
  ultimo_contacto: string | null;
  estado: string;
  metodo_pago?: string | null;
  uuid_fiscal?: string | null;
  /** v13.592.0: trámite de cancelación ante el SAT (none|pending|verifying|…). */
  cancellation_status?: string | null;
}
