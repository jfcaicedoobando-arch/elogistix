/**
 * Servicio CRM — Plantillas de mensajes (email / WhatsApp).
 */
import { supabase } from "@/integrations/supabase/client";

export type PlantillaCanal = "email" | "whatsapp";

export interface PlantillaMensajeRow {
  id: string;
  organization_id: string;
  nombre: string;
  canal: PlantillaCanal;
  asunto: string;
  cuerpo: string;
  activa: boolean;
  created_at: string;
  updated_at: string;
}

export interface PlantillaInput {
  nombre: string;
  canal: PlantillaCanal;
  asunto?: string;
  cuerpo: string;
  activa?: boolean;
}

const COLS = "id, organization_id, nombre, canal, asunto, cuerpo, activa, created_at, updated_at";

export async function fetchPlantillasMensaje(
  canal?: PlantillaCanal,
  soloActivas = true,
): Promise<PlantillaMensajeRow[]> {
  let q = supabase.from("crm_plantillas_mensaje").select(COLS).order("nombre");
  if (canal) q = q.eq("canal", canal);
  if (soloActivas) q = q.eq("activa", true);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as PlantillaMensajeRow[];
}

export async function crearPlantilla(input: PlantillaInput): Promise<void> {
  const { error } = await supabase.from("crm_plantillas_mensaje").insert({
    nombre: input.nombre,
    canal: input.canal,
    asunto: input.asunto ?? "",
    cuerpo: input.cuerpo,
    activa: input.activa ?? true,
  });
  if (error) throw error;
}

export async function actualizarPlantilla(input: {
  id: string;
  patch: Partial<PlantillaInput>;
}): Promise<void> {
  const { error } = await supabase
    .from("crm_plantillas_mensaje")
    .update(input.patch)
    .eq("id", input.id);
  if (error) throw error;
}

export async function eliminarPlantilla(id: string): Promise<void> {
  const { error } = await supabase
    .from("crm_plantillas_mensaje")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}
