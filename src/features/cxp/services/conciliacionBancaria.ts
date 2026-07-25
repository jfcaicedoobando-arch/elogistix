/**
 * Servicio: sugerir movimientos bancarios candidatos para un pago a proveedor.
 * Empareja por monto (±$1) y fecha (±5 días) con movimientos Pendientes en
 * la cuenta bancaria del pago (si viene informada) o cualquier cuenta de la org.
 *
 * v13.190.0 · Ola 2 · Item 3 — Conciliación bancaria en detalle de factura.
 */
import { supabase } from "@/integrations/supabase/client";
import {
  TOLERANCIA_MONTO_MXN,
  TOLERANCIA_DIAS,
  rangoFechasIso,
  deltaDiasIso,
} from "@/features/tesoreria/domain/tolerancia";

export interface MovimientoCandidato {
  id: string;
  fecha: string;
  concepto: string | null;
  referencia: string | null;
  cargo: number;
  cuenta_bancaria_id: string;
  delta_dias: number;
  delta_monto: number;
}

export async function sugerirMovsParaPagoProveedor(pago: {
  id: string;
  fecha_pago: string;
  monto: number;
  cuenta_bancaria_id: string | null;
}): Promise<MovimientoCandidato[]> {
  if (pago.monto <= 0) return [];
  const { desde, hasta } = rangoFechasIso(pago.fecha_pago, TOLERANCIA_DIAS);
  const min = pago.monto - TOLERANCIA_MONTO_MXN;
  const max = pago.monto + TOLERANCIA_MONTO_MXN;

  let q = supabase
    .from("bbva_movimientos")
    .select("id, fecha, concepto, referencia, cargo, cuenta_bancaria_id")
    .eq("estado_conciliacion", "Pendiente")
    .gte("fecha", desde)
    .lte("fecha", hasta)
    .gte("cargo", min)
    .lte("cargo", max)
    .order("fecha", { ascending: false })
    .limit(20);
  if (pago.cuenta_bancaria_id) q = q.eq("cuenta_bancaria_id", pago.cuenta_bancaria_id);

  const { data, error } = await q;
  if (error) throw error;

  return (data ?? [])
    .map((m) => ({
      id: m.id,
      fecha: m.fecha,
      concepto: m.concepto,
      referencia: m.referencia,
      cargo: Number(m.cargo),
      cuenta_bancaria_id: m.cuenta_bancaria_id,
      delta_dias: deltaDiasIso(m.fecha, pago.fecha_pago),
      delta_monto: Math.abs(Number(m.cargo) - pago.monto),
    }))
    .sort((a, b) => (a.delta_monto - b.delta_monto) || (a.delta_dias - b.delta_dias));
}
