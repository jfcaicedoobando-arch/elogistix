/**
 * Queries de expedientes activos por cliente (agrupación por folio expediente).
 */
import { supabase } from "@/integrations/supabase/client";

export interface ExpedienteCliente {
  expediente: string;
  bl_master: string | null;
  cliente_nombre: string;
  total_embarques: number;
}

export async function fetchExpedientesCliente(clienteId: string): Promise<ExpedienteCliente[]> {
  const { data, error } = await supabase
    .from("embarques")
    .select("expediente, bl_master, cliente_nombre")
    .eq("cliente_id", clienteId)
    .neq("estado", "Cerrado")
    .order("created_at", { ascending: false });
  if (error) throw error;
  const map = new Map<string, ExpedienteCliente>();
  for (const row of data ?? []) {
    const existing = map.get(row.expediente);
    if (existing) {
      existing.total_embarques++;
    } else {
      map.set(row.expediente, {
        expediente: row.expediente,
        bl_master: row.bl_master,
        cliente_nombre: row.cliente_nombre,
        total_embarques: 1,
      });
    }
  }
  return Array.from(map.values());
}
