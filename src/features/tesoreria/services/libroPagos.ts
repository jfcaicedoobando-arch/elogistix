/**
 * Servicio del libro maestro de pagos.
 * Lee la RPC `libro_pagos`, que une cobros de clientes, pagos a proveedores y
 * anticipos vigentes del periodo, ya acotados a la organización del usuario.
 */
import { supabase } from "@/integrations/supabase/client";
import type { LibroPagos, PagoLibro, TipoPago } from "@/features/tesoreria/domain/libroPagos";

export type { LibroPagos, PagoLibro } from "@/features/tesoreria/domain/libroPagos";

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function str(v: unknown): string | null {
  return typeof v === "string" && v !== "" ? v : null;
}

function tipo(v: unknown): TipoPago {
  return v === "cobro" || v === "pago" || v === "anticipo" ? v : "pago";
}

function mapPago(row: Record<string, unknown>): PagoLibro {
  return {
    id: String(row.id),
    tipo: tipo(row.tipo),
    fecha: String(row.fecha ?? ""),
    contraparte: str(row.contraparte),
    contraparte_id: str(row.contraparte_id),
    documento_id: str(row.documento_id),
    documento_folio: str(row.documento_folio),
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
    es_anticipo_aplicado: row.es_anticipo_aplicado === true,
    lote_id: str(row.lote_id),
    conciliado: row.conciliado === true,
    movimiento_id: str(row.movimiento_id),
    created_at: str(row.created_at),
  };
}

export async function fetchLibroPagos(desde: string, hasta: string): Promise<LibroPagos> {
  const { data, error } = await supabase.rpc("libro_pagos", {
    p_desde: desde,
    p_hasta: hasta,
  });
  if (error) throw error;
  // SAFE-CAST: jsonb con el shape declarado en la migración `libro_pagos`.
  const raw = (data ?? {}) as unknown as Record<string, unknown>;
  const filas = Array.isArray(raw.pagos) ? raw.pagos : [];
  return {
    desde: String(raw.desde ?? desde),
    hasta: String(raw.hasta ?? hasta),
    pagos: filas.map((f) => mapPago(f as Record<string, unknown>)),
  };
}
