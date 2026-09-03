/**
 * Mutaciones de `crm_actividades` (crear, completar, posponer, actualizar).
 * Extraído de `actividades.ts` (Power of 10 — límite de líneas por archivo).
 */
import { supabase } from "@/integrations/supabase/client";
import { unwrap } from "@/lib/supabase/response";
import { registrarActividad } from "@/services/bitacora/registrar";
import type { CrmActividadTipo, CrmEntidadTipo } from "./actividades";

export type CrearActividadInput = {
  tipo: CrmActividadTipo;
  asunto: string;
  descripcion?: string;
  entidad_tipo: CrmEntidadTipo;
  entidad_id: string;
  fecha_programada?: string | null;
  duracion_min?: number | null;
  resultado?: string;
  /** Calidad del contacto (hoja 04_Actividades del CRM Hunter). */
  contacto_efectivo?: boolean;
  reunion_calificada?: boolean;
  /**
   * Responsable explícito opcional (ownership): lo usa NuevaOportunidadDialog
   * para asignar la actividad automática al vendedor final del formulario.
   * Si no se proporciona, se conserva el comportamiento histórico: el
   * responsable es el usuario en sesión. `created_by` siempre es la sesión.
   */
  responsable_id?: string | null;
  responsable_email?: string;
};

export async function crearActividad(
  input: CrearActividadInput,
  user: { id?: string; email?: string } | null,
): Promise<{ id: string }> {
  const { responsable_id, responsable_email, ...resto } = input;
  const creada = (await unwrap(
    supabase
      .from("crm_actividades")
      .insert({
        ...resto,
        descripcion: input.descripcion ?? "",
        resultado: input.resultado ?? "",
        responsable_id: responsable_id !== undefined ? responsable_id : (user?.id ?? null),
        responsable_email: responsable_email !== undefined ? responsable_email : (user?.email ?? ""),
        created_by: user?.id ?? null,
      })
      .select("id")
      .single(),
  )) as { id: string };
  await registrarActividad({
    modulo: "crm",
    accion: "Creó actividad",
    entidadId: creada.id,
    entidadNombre: input.asunto,
    detalles: { tipo: input.tipo, entidad_tipo: input.entidad_tipo, entidad_id: input.entidad_id },
  });
  return creada;
}

/**
 * v13.823.49 — un UPDATE filtrado por RLS o sobre una actividad eliminada NO
 * da error: devuelve 0 filas. Antes reportábamos éxito y escribíamos bitácora
 * de un cambio que nunca ocurrió.
 */
async function exigirFilaActividad(
  builder: PromiseLike<{ data: { id: string } | null; error: unknown }>,
): Promise<void> {
  const { data, error } = await builder;
  if (error) throw error;
  if (!data) {
    throw new Error(
      "No se pudo guardar la actividad: no tienes permiso o la actividad ya no existe.",
    );
  }
}

export async function completarActividad(input: { id: string; resultado?: string }): Promise<void> {
  await exigirFilaActividad(
    supabase
      .from("crm_actividades")
      .update({
        fecha_completada: new Date().toISOString(),
        // v13.823.50 — sin `resultado` explícito NO se toca el texto ya
        // capturado por el usuario (antes se sobrescribía con "").
        ...(input.resultado !== undefined ? { resultado: input.resultado } : {}),
      })
      .eq("id", input.id)
      .is("deleted_at", null)
      .select("id")
      .maybeSingle(),
  );
  await registrarActividad({ modulo: "crm", accion: "Completó actividad", entidadId: input.id });
}

export async function posponerActividad(input: {
  id: string;
  dias: number;
  fechaProgramada: string | null;
}): Promise<void> {
  const base = input.fechaProgramada ? new Date(input.fechaProgramada) : new Date();
  base.setDate(base.getDate() + input.dias);
  await exigirFilaActividad(
    supabase
      .from("crm_actividades")
      .update({ fecha_programada: base.toISOString() })
      .eq("id", input.id)
      .is("deleted_at", null)
      .select("id")
      .maybeSingle(),
  );
  await registrarActividad({ modulo: "crm", accion: "Pospuso actividad", entidadId: input.id, detalles: { dias: input.dias } });
}

export async function actualizarActividadNotas(input: { id: string; resultado: string }): Promise<void> {
  await exigirFilaActividad(
    supabase
      .from("crm_actividades")
      .update({ resultado: input.resultado })
      .eq("id", input.id)
      .is("deleted_at", null)
      .select("id")
      .maybeSingle(),
  );
  await registrarActividad({ modulo: "crm", accion: "Actualizó notas de actividad", entidadId: input.id });
}
