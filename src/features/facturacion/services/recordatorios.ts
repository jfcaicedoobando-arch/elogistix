/**
 * Servicio de recordatorios de cobranza (CxC).
 * Permite registrar manualmente los recordatorios que el área de cobranza
 * envía a los clientes y consultar el último por factura.
 */
import { supabase } from "@/integrations/supabase/client";

export type CanalRecordatorio = "correo" | "telefono" | "whatsapp" | "visita" | "otro";

export interface RecordatorioFila {
  id: string;
  factura_id: string;
  organization_id: string;
  enviado_por: string;
  canal: CanalRecordatorio;
  nota: string | null;
  created_at: string;
}

export interface UltimoRecordatorio {
  factura_id: string;
  fecha: string;
  canal: CanalRecordatorio;
}

export async function enviarRecordatorio(args: {
  factura_id: string;
  organization_id: string;
  canal?: CanalRecordatorio;
  nota?: string;
}): Promise<RecordatorioFila> {
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr) throw authErr;
  if (!user) throw new Error("No hay sesión activa");

  const { data, error } = await supabase
    .from("factura_recordatorios")
    .insert({
      factura_id: args.factura_id,
      organization_id: args.organization_id,
      enviado_por: user.id,
      canal: args.canal ?? "correo",
      nota: args.nota ?? null,
    })
    .select()
    .single();
  if (error) throw error;
  return data as RecordatorioFila;
}

export async function fetchUltimosRecordatorios(
  facturaIds: string[],
): Promise<Map<string, UltimoRecordatorio>> {
  if (facturaIds.length === 0) return new Map();
  const { data, error } = await supabase
    .from("factura_recordatorios")
    .select("factura_id, canal, created_at")
    .in("factura_id", facturaIds)
    .order("created_at", { ascending: false });
  if (error) throw error;

  const map = new Map<string, UltimoRecordatorio>();
  for (const row of (data ?? []) as Array<{ factura_id: string; canal: string; created_at: string }>) {
    if (map.has(row.factura_id)) continue;
    map.set(row.factura_id, {
      factura_id: row.factura_id,
      fecha: row.created_at,
      canal: row.canal as CanalRecordatorio,
    });
  }
  return map;
}
