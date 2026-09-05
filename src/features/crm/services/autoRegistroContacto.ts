/**
 * OLA 7 · O7.4 — Auto-registro de actividad al contactar desde una plantilla.
 *
 * Al abrir mailto:/wa.me el vendedor ya hizo el contacto, pero antes sólo se
 * escribía bitácora: la actividad no llegaba a `crm_actividades` y las métricas
 * (y el leaderboard) subestimaban el trabajo real. Aquí se deja la actividad con
 * resultado pendiente de marcar y un recordatorio de seguimiento.
 */
import { crearActividad, type CrmEntidadTipo } from "@/features/crm/services/actividades";
import { logger } from "@/lib/observability/logger";
import { mxAddDaysIso } from "@/lib/date/mx";

/** Días de gracia para dar seguimiento al contacto recién hecho. */
export const DIAS_SEGUIMIENTO_CONTACTO = 2;

export interface AutoRegistroContactoInput {
  canal: "email" | "whatsapp";
  entidadTipo: CrmEntidadTipo;
  entidadId: string;
  /** Nombre de la plantilla usada, para el asunto de la actividad. */
  plantilla: string;
  destino: string;
}

/**
 * Fecha de seguimiento sugerida (hoy + DIAS_SEGUIMIENTO_CONTACTO).
 * La suma es de días de calendario CDMX (`mxAddDaysIso`), no del reloj del
 * navegador: conserva la hora local MX del contacto y no se corre un día.
 */
export function fechaSeguimientoContacto(desde: Date = new Date()): string {
  return mxAddDaysIso(desde.toISOString(), DIAS_SEGUIMIENTO_CONTACTO, desde);
}

/**
 * Registra la actividad de contacto. Best-effort: nunca debe impedir que el
 * vendedor mande el mensaje, así que los errores sólo se loguean.
 */
export async function registrarContactoAutomatico(
  input: AutoRegistroContactoInput,
  user: { id?: string; email?: string } | null,
): Promise<void> {
  try {
    await crearActividad(
      {
        tipo: input.canal === "email" ? "email" : "llamada",
        asunto:
          input.canal === "email"
            ? `Email enviado: ${input.plantilla}`
            : `WhatsApp enviado: ${input.plantilla}`,
        descripcion: `Contacto automático a ${input.destino}. Marca el resultado cuando tengas respuesta.`,
        entidad_tipo: input.entidadTipo,
        entidad_id: input.entidadId,
        fecha_programada: fechaSeguimientoContacto(),
      },
      user,
    );
  } catch (e) {
    logger.warn("[crm] auto-registro de contacto falló:", e);
  }
}
