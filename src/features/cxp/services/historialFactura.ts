/**
 * Historial unificado de una factura de proveedor (captura, aprobación,
 * pagos, notas de crédito, eliminación) con emails resueltos en BD vía
 * `public.historial_proveedor_factura(p_id uuid)`.
 */
import { supabase } from "@/integrations/supabase/client";

export type TipoEventoHistorial =
  | "creada"
  | "aprobada"
  | "rechazada"
  | "pago"
  | "nota_credito"
  | "eliminada"
  | string;

export interface EventoHistorialFactura {
  ts: string;
  tipo: TipoEventoHistorial;
  descripcion: string;
  actor_email: string;
  monto: number | null;
  moneda: string | null;
  detalles: Record<string, unknown>;
}

export async function fetchHistorialFactura(
  facturaId: string,
): Promise<EventoHistorialFactura[]> {
  const { data, error } = await supabase.rpc("historial_proveedor_factura", {
    p_id: facturaId,
  });
  if (error) throw error;
  // SAFE-CAST: la RPC retorna TABLE() y Supabase lo tipa como Json[].
  return (data ?? []) as unknown as EventoHistorialFactura[];
}
