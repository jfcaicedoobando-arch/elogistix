/**
 * Servicio CRM — Plantillas de mensajes (email / WhatsApp).
 */
import { supabase } from "@/integrations/supabase/client";
import { run, unwrapOr } from "@/lib/supabase/response";
import { registrarActividad } from "@/services/bitacora/registrar";

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
  let q = supabase.from("crm_plantillas_mensaje").select(COLS).is("deleted_at", null).order("nombre");
  if (canal) q = q.eq("canal", canal);
  if (soloActivas) q = q.eq("activa", true);
  const data = await unwrapOr(q, []);
  // SAFE-CAST: COLS lista explícita mapea 1:1 a PlantillaMensajeRow.
  return data as unknown as PlantillaMensajeRow[];
}

export async function crearPlantilla(input: PlantillaInput): Promise<void> {
  await run(
    supabase.from("crm_plantillas_mensaje").insert({
      nombre: input.nombre,
      canal: input.canal,
      asunto: input.asunto ?? "",
      cuerpo: input.cuerpo,
      activa: input.activa ?? true,
    }),
  );
  await registrarActividad({ modulo: "crm", accion: "Creó plantilla de mensaje", entidadNombre: input.nombre });
}

export async function actualizarPlantilla(input: {
  id: string;
  patch: Partial<PlantillaInput>;
}): Promise<void> {
  const { data, error } = await supabase
    .from("crm_plantillas_mensaje")
    .update(input.patch)
    .eq("id", input.id)
    .select("id")
    .maybeSingle();
  if (error) throw error;
  if (!data) {
    throw new Error(
      "No se pudo actualizar la plantilla: no tienes permiso o la plantilla ya no existe.",
    );
  }
  await registrarActividad({
    modulo: "crm",
    accion: "Editó plantilla de mensaje",
    entidadId: input.id,
    detalles: { campos: Object.keys(input.patch) },
  });
}

export async function eliminarPlantilla(id: string): Promise<void> {
  const { data, error } = await supabase
    .from("crm_plantillas_mensaje")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)
    .select("id")
    .maybeSingle();
  if (error) throw error;
  if (!data) {
    throw new Error(
      "No se pudo eliminar la plantilla: no tienes permiso o la plantilla ya no existe.",
    );
  }
  await registrarActividad({ modulo: "crm", accion: "Eliminó plantilla de mensaje", entidadId: id });
}
