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
        estado_revision: "revisado",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "organization_id,embarque_id,regla,detalle_hash" },
    )
    .select()
    .single();
  if (error) throw error;
  return data as AuditoriaRevision;
}

export interface AsignarResponsableInput {
  embarque_id: string;
  regla: HallazgoAuditoria["regla"];
  detalle_hash: string;
  detalle: string;
  responsable_id: string | null;
  responsable_email: string;
  asignado_por: string;
  asignado_por_email: string;
  fecha_limite: string | null;
  /** Marca el hallazgo como "en_progreso" cuando el responsable lo toma. */
  estado_revision?: "pendiente" | "en_progreso";
}

/**
 * Asigna (o reasigna) un responsable a un hallazgo. Si la revisión no existe
 * la crea con estado=pendiente; si ya existe sólo actualiza la asignación.
 */
export async function asignarResponsableHallazgo(
  input: AsignarResponsableInput,
): Promise<AuditoriaRevision> {
  const payload = {
    embarque_id: input.embarque_id,
    regla: input.regla,
    detalle_hash: input.detalle_hash,
    detalle: input.detalle,
    responsable_id: input.responsable_id,
    responsable_email: input.responsable_email,
    asignado_por: input.asignado_por,
    asignado_por_email: input.asignado_por_email,
    asignado_at: new Date().toISOString(),
    fecha_limite: input.fecha_limite,
    estado_revision: input.estado_revision ?? "pendiente",
  };
  const { data, error } = await supabase
    .from("auditoria_revisiones")
    .upsert(payload, {
      onConflict: "organization_id,embarque_id,regla,detalle_hash",
    })
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
