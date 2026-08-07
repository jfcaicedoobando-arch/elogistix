import { supabase } from "@/integrations/supabase/client";
import type { AuditoriaComentario } from "@/features/auditoria/types";
import { registrarActividad } from "@/services/bitacora/registrar";

export async function fetchComentariosByRevision(
  revisionId: string,
): Promise<AuditoriaComentario[]> {
  const { data, error } = await supabase
    .from("auditoria_comentarios")
    .select("*")
    .eq("revision_id", revisionId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as AuditoriaComentario[];
}

export async function insertComentario(input: {
  revision_id: string;
  autor_id: string;
  autor_email: string;
  contenido: string;
}): Promise<AuditoriaComentario> {
  const { data, error } = await supabase
    .from("auditoria_comentarios")
    .insert(input)
    .select()
    .single();
  if (error) throw error;
  await registrarActividad({
    modulo: "auditoria",
    accion: "Comentó revisión de hallazgo",
    entidadId: input.revision_id,
    detalles: { autor_email: input.autor_email },
  });
  return data as AuditoriaComentario;
}
