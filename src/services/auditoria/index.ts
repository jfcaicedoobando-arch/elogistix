/**
 * Servicio de auditoría operativa: encapsula los RPC/queries de Supabase.
 * Los hooks (`useAuditoria`, `useAuditoriaRevisiones`) solo orquestan cache.
 */
import { supabase } from "@/integrations/supabase/client";
import type {
  AuditoriaRevision,
  HallazgoAuditoria,
  ReporteAuditoria,
} from "@/types/auditoria";

export async function fetchReporteAuditoria(): Promise<ReporteAuditoria> {
  const { data, error } = await supabase.rpc("auditoria_embarques_org");
  if (error) throw error;
  return data as unknown as ReporteAuditoria;
}

export async function fetchAuditoriaRevisiones(): Promise<AuditoriaRevision[]> {
  const { data, error } = await supabase
    .from("auditoria_revisiones")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as AuditoriaRevision[];
}

export interface UpsertRevisionInput {
  embarque_id: string;
  regla: HallazgoAuditoria["regla"];
  detalle_hash: string;
  detalle: string;
  accion_tomada: string;
  revisado_por: string;
  revisado_por_email: string;
}

export async function upsertAuditoriaRevision(
  input: UpsertRevisionInput,
): Promise<AuditoriaRevision> {
  const { data, error } = await supabase
    .from("auditoria_revisiones")
    .upsert(
      {
        ...input,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "organization_id,embarque_id,regla,detalle_hash" },
    )
    .select()
    .single();
  if (error) throw error;
  return data as AuditoriaRevision;
}

export async function deleteAuditoriaRevision(id: string): Promise<void> {
  const { error } = await supabase
    .from("auditoria_revisiones")
    .delete()
    .eq("id", id);
  if (error) throw error;
}
