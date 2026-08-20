/**
 * OLA B · B.1 — Cola de recálculo de comisiones.
 *
 * `calcular_comision_pago` deja la comisión en 0 cuando no puede valuar lo
 * cobrado o la utilidad del embarque. Antes eso sólo quedaba en una nota de
 * texto y nadie lo recalculaba. Ahora la BD registra el fallo en
 * `comisiones_recalculo_pendiente` y aquí se lee y se reintenta.
 */
import { supabase } from "@/integrations/supabase/client";

export interface ComisionPendiente {
  id: string;
  pago_factura_id: string;
  etapa: string;
  motivo: string;
  intentos: number;
  created_at: string;
}

export interface ResultadoReproceso {
  procesadas: number;
  resueltas: number;
}

/** Pendientes abiertos (sin resolver) de la organización activa. */
export async function fetchComisionesPendientes(): Promise<ComisionPendiente[]> {
  const { data, error } = await supabase
    .from("comisiones_recalculo_pendiente")
    .select("id, pago_factura_id, etapa, motivo, intentos, created_at")
    .is("resuelto_at", null)
    .order("created_at", { ascending: true })
    .limit(200);
  if (error) throw error;
  return (data ?? []) as ComisionPendiente[];
}

/** Reintenta el cálculo de toda la cola; nunca toca comisiones liquidadas. */
export async function reprocesarComisionesPendientes(): Promise<ResultadoReproceso> {
  const { data, error } = await supabase.rpc("reprocesar_comisiones_pendientes", {});
  if (error) throw error;
  // La RPC devuelve una sola fila (procesadas, resueltas).
  const fila = Array.isArray(data) ? data[0] : data;
  return {
    procesadas: Number(fila?.procesadas ?? 0),
    resueltas: Number(fila?.resueltas ?? 0),
  };
}
