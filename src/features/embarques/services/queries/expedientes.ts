/**
 * Queries de expedientes activos por cliente (agrupación por folio expediente).
 */
import { supabase } from "@/integrations/supabase/client";
import { assertNotTruncated } from "@/lib/supabase/assertNotTruncated";

export interface ExpedienteCliente {
  expediente: string;
  bl_master: string | null;
  cliente_nombre: string;
  total_embarques: number;
}

export async function fetchExpedientesCliente(
  clienteId: string,
  opts: { incluirCerrados?: boolean } = {},
): Promise<ExpedienteCliente[]> {
  let query = supabase
    .from("embarques")
    .select("expediente, bl_master, cliente_nombre")
    .eq("cliente_id", clienteId)
    .order("created_at", { ascending: false });
  if (!opts.incluirCerrados) {
    query = query.neq("estado", "Cerrado");
  }
  // EC-05: límite defensivo sobre embarques del cliente antes de agrupar.
  const LIMITE = 1000;
  const { data, error } = await query.limit(LIMITE);
  if (error) throw error;
  assertNotTruncated(data, LIMITE, "embarques.expedientesCliente");
  const map = new Map<string, ExpedienteCliente>();
  for (const row of data ?? []) {
    if (!row.expediente) continue;
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
