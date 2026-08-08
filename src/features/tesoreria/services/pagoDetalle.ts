/**
 * Servicio del detalle de un pago.
 * Lee la RPC `pago_detalle`, que devuelve el encabezado del pago, el
 * movimiento bancario conciliado y las facturas a las que se aplicó.
 */
import { supabase } from "@/integrations/supabase/client";
import type {
  AplicacionPago,
  MovimientoConciliado,
  PagoDetalle,
  PagoDetalleEncabezado,
  RefPago,
  TipoPagoDetalle,
} from "@/features/tesoreria/domain/pagoDetalle";

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function str(v: unknown): string | null {
  return typeof v === "string" && v !== "" ? v : null;
}

function tipo(v: unknown): TipoPagoDetalle {
  return v === "cobro" || v === "pago" || v === "anticipo" || v === "lote" ? v : "pago";
}

function mapPago(row: Record<string, unknown>): PagoDetalleEncabezado {
  return {
    id: String(row.id ?? ""),
    tipo: tipo(row.tipo),
    fecha: String(row.fecha ?? ""),
    contraparte: str(row.contraparte),
    contraparte_id: str(row.contraparte_id),
    moneda: String(row.moneda ?? "MXN"),
    monto: num(row.monto),
    tipo_cambio: num(row.tipo_cambio) || 1,
    monto_mxn: num(row.monto_mxn),
    metodo_pago: str(row.metodo_pago),
    referencia: str(row.referencia),
    cuenta_bancaria_id: str(row.cuenta_bancaria_id),
    cuenta_alias: str(row.cuenta_alias),
    cuenta_banco: str(row.cuenta_banco),
    notas: str(row.notas),
    embarque_id: str(row.embarque_id),
    diferencia_cambiaria_mxn: num(row.diferencia_cambiaria_mxn),
    estado_rep: str(row.estado_rep),
    folio_rep: str(row.folio_rep),
    es_ajuste: row.es_ajuste === true,
    lote_id: str(row.lote_id),
    estado: str(row.estado),
    saldo_disponible: row.saldo_disponible == null ? null : num(row.saldo_disponible),
    created_by: str(row.created_by),
    created_at: str(row.created_at),
  };
}

function mapMovimiento(row: Record<string, unknown>): MovimientoConciliado {
  return {
    id: String(row.id ?? ""),
    fecha: String(row.fecha ?? ""),
    concepto: str(row.concepto),
    referencia: str(row.referencia),
    cargo: num(row.cargo),
    abono: num(row.abono),
    saldo: row.saldo == null ? null : num(row.saldo),
    estado_conciliacion: str(row.estado_conciliacion),
    cuenta_bancaria_id: str(row.cuenta_bancaria_id),
    cuenta_alias: str(row.cuenta_alias),
    cuenta_banco: str(row.cuenta_banco),
    conciliado_por: str(row.conciliado_por),
    conciliado_at: str(row.conciliado_at),
  };
}

function mapAplicacion(row: Record<string, unknown>): AplicacionPago {
  return {
    documento_id: String(row.documento_id ?? ""),
    documento_tipo: row.documento_tipo === "cliente" ? "cliente" : "proveedor",
    folio: str(row.folio),
    folio_proveedor: str(row.folio_proveedor),
    embarque_id: str(row.embarque_id),
    moneda: String(row.moneda ?? "MXN"),
    monto_aplicado: num(row.monto_aplicado),
    total: num(row.total),
    pagado: num(row.pagado),
    fecha_aplicacion: str(row.fecha_aplicacion),
    pago_id: str(row.pago_id),
  };
}

export async function fetchPagoDetalle(ref: RefPago): Promise<PagoDetalle> {
  const { data, error } = await supabase.rpc("pago_detalle", {
    p_tipo: ref.tipo,
    p_id: ref.id,
  });
  if (error) throw error;
  // SAFE-CAST: jsonb con el shape declarado en la migración `pago_detalle`.
  const raw = (data ?? {}) as unknown as Record<string, unknown>;
  const pagoRaw = (raw.pago ?? {}) as Record<string, unknown>;
  const movRaw = raw.movimiento as Record<string, unknown> | null | undefined;
  const aplicaciones = Array.isArray(raw.aplicaciones) ? raw.aplicaciones : [];
  return {
    tipo: tipo(raw.tipo),
    pago: mapPago(pagoRaw),
    movimiento: movRaw ? mapMovimiento(movRaw) : null,
    aplicaciones: aplicaciones.map((a) => mapAplicacion(a as Record<string, unknown>)),
  };
}
