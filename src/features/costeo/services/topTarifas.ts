/**
 * Servicio: consulta Top 3 de tarifas vigentes vía RPC `get_top_tarifas`.
 */
import { supabase } from "@/integrations/supabase/client";
import type { TopTarifaRow, CosteoTarifaRecargo } from "@/features/costeo/types";
import { todayLocalISO } from "@/lib/date/today";

export interface TopTarifasParams {
  puertoOrigenId: string;
  puertoDestinoId: string;
  tipoContenedorId: string;
  fecha?: string; // YYYY-MM-DD
  organizationId?: string;
}

export async function fetchTopTarifas(p: TopTarifasParams): Promise<TopTarifaRow[]> {
  // Cinturón + tirantes: si llega "" desde arriba, tratarlo como no proveída
  // para no mandar un date inválido al RPC (Postgres 22007).
  const fecha = p.fecha && p.fecha.length > 0 ? p.fecha : todayLocalISO();
  const { data, error } = await supabase.rpc("get_top_tarifas", {
    p_puerto_origen_id: p.puertoOrigenId,
    p_puerto_destino_id: p.puertoDestinoId,
    p_tipo_contenedor_id: p.tipoContenedorId,
    p_fecha: fecha,
    p_organization_id: p.organizationId ?? undefined,
  });
  if (error) throw error;
  return (data ?? []) as TopTarifaRow[];
}

/** Recargos detallados de una tarifa específica (para mostrar desglose en el card). */
export async function fetchRecargosDeTarifa(tarifaId: string): Promise<CosteoTarifaRecargo[]> {
  const { data, error } = await supabase
    .from("costeo_tarifa_recargos")
    .select("*")
    .eq("tarifa_id", tarifaId)
    .order("concepto");
  if (error) throw error;
  return (data ?? []) as CosteoTarifaRecargo[];
}
