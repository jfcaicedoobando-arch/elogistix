/**
 * Servicio CRM — Comentarios de oportunidad.
 * Lectura paginada simple + alta. La notificación al vendedor la dispara un
 * trigger en BD (`crm_notify_comentario_oportunidad`).
 */
import { supabase } from "@/integrations/supabase/client";
import { registrarActividad } from "@/services/bitacora/registrar";

export interface ComentarioRow {
  id: string;
  oportunidad_id: string;
  autor_id: string;
  autor_email: string;
  texto: string;
  created_at: string;
}

const COLS = "id, oportunidad_id, autor_id, autor_email, texto, created_at";

export async function fetchComentariosOportunidad(
  oportunidadId: string,
  limit = 50,
): Promise<ComentarioRow[]> {
  const { data, error } = await supabase
    .from("crm_comentarios_oportunidad")
    .select(COLS)
    .eq("oportunidad_id", oportunidadId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as ComentarioRow[];
}

export async function crearComentarioOportunidad(input: {
  oportunidadId: string;
  texto: string;
  autorId: string;
  autorEmail: string;
}): Promise<void> {
  const limpio = input.texto.trim();
  if (!limpio) throw new Error("El comentario no puede estar vacío");
  const { error } = await supabase.from("crm_comentarios_oportunidad").insert({
    oportunidad_id: input.oportunidadId,
    autor_id: input.autorId,
    autor_email: input.autorEmail,
    texto: limpio,
  });
  if (error) throw error;
  await registrarActividad({
    modulo: "crm",
    accion: "Comentó oportunidad",
    entidadId: input.oportunidadId,
  });
}
