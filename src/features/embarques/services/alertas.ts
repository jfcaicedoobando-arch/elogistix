/**
 * Servicio: lista de IDs de embarques detrás del badge de alertas del sidebar.
 *
 * Devuelve un mapa por tipo de alerta (demora, garantía atorada, cierre admin
 * pendiente) para que la página `/embarques` pueda filtrar y mostrar el
 * desglose de las 21 alertas activas.
 */
import { supabase } from "@/integrations/supabase/client";

export type AlertaEmbarqueTipo = "demora" | "garantia" | "admin_pendiente";

export interface EmbarquesAlertasIds {
  demora: Set<string>;
  garantia: Set<string>;
  admin_pendiente: Set<string>;
}

export interface EmbarquesAlertasResumen extends EmbarquesAlertasIds {
  total: number;
}

const TIPOS: readonly AlertaEmbarqueTipo[] = ["demora", "garantia", "admin_pendiente"] as const;

function emptyResumen(): EmbarquesAlertasResumen {
  return { demora: new Set(), garantia: new Set(), admin_pendiente: new Set(), total: 0 };
}

export async function fetchEmbarquesAlertasResumen(): Promise<EmbarquesAlertasResumen> {
  // SAFE-CAST: RPC nueva aún no presente en types.ts generados.
  const { data, error } = await supabase.rpc("embarques_alertas_ids" as never);
  if (error) throw new Error(error.message);

  const rows = (data ?? []) as Array<{ embarque_id: string; tipo: string }>;
  const acc = emptyResumen();
  for (const r of rows) {
    if (!r?.embarque_id) continue;
    const tipo = r.tipo as AlertaEmbarqueTipo;
    if (!TIPOS.includes(tipo)) continue;
    acc[tipo].add(r.embarque_id);
  }
  acc.total = acc.demora.size + acc.garantia.size + acc.admin_pendiente.size;
  return acc;
}
