import { supabase } from "@/integrations/supabase/client";
import type { AuditoriaComentario } from "@/features/auditoria/types";
import { registrarActividad } from "@/services/bitacora/registrar";
import { assertNotTruncated } from "@/lib/supabase/assertNotTruncated";
import { CAP_LISTA } from "@/constants/queryCaps";

export async function fetchComentariosByRevision(
  revisionId: string,
): Promise<AuditoriaComentario[]> {
  const { data, error } = await supabase
    .from("auditoria_comentarios")
    .select("*")
    .eq("revision_id", revisionId)
    .order("created_at", { ascending: true })
    // EC-05: límite defensivo sobre comentarios de una revisión.
    .limit(CAP_LISTA);
  if (error) throw error;
  assertNotTruncated(data, 500, "auditoria.comentarios");
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
