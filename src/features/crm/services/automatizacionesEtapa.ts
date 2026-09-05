/**
 * Servicio CRM — Automatizaciones al mover una oportunidad de etapa.
 * Capa de I/O extraída de `hooks/crm/automatizacionesEtapaActions.ts`.
 */
import { supabase } from "@/integrations/supabase/client";
import { registrarActividad } from "@/services/bitacora/registrar";
import { getErrorMessage } from "@/lib/errors";
import { crearNotificacionSilencioso } from "./notificaciones";
import { mxAddDaysIso } from "@/lib/date/mx";

/**
 * Fecha programada de las tareas automáticas: misma hora, `d` días después en
 * el calendario CDMX. Antes usaba `new Date().setDate()` + `toISOString()`,
 * que suma 24 h del reloj del navegador y corría el día cerca de medianoche.
 */
function isoDaysFromNow(d: number): string {
  return mxAddDaysIso(null, d);
}

export interface EtapaInfo {
  id: string;
  nombre: string;
  tipo: "abierta" | "ganada" | "perdida";
  probabilidad_default: number;
  crea_tarea_seguimiento: boolean;
  dias_seguimiento: number;
}

export interface OportunidadMin {
  id: string;
  nombre: string;
  vendedor_id: string | null;
  vendedor_email: string;
  cliente_nombre: string;
}

export interface AutomationCtx {
  etapa: EtapaInfo;
  op: OportunidadMin;
  responsableId: string | null;
  responsableEmail: string;
  userId: string | null;
}

export async function fetchEtapa(id: string): Promise<EtapaInfo | null> {
  const { data, error } = await supabase
    .from("crm_etapas_pipeline")
    .select("id, nombre, tipo, probabilidad_default, crea_tarea_seguimiento, dias_seguimiento")
    .eq("id", id)
    .maybeSingle();
  if (error || !data) return null;
  return data as EtapaInfo;
}

export async function fetchOportunidad(id: string): Promise<OportunidadMin | null> {
  const { data, error } = await supabase
    .from("crm_oportunidades")
    .select("id, nombre, vendedor_id, vendedor_email, cliente_nombre")
    .eq("id", id)
    .maybeSingle();
  if (error || !data) return null;
  return data as OportunidadMin;
}

export async function notifyVendedorMovido(ctx: AutomationCtx): Promise<void> {
  if (!ctx.op.vendedor_id || ctx.op.vendedor_id === ctx.userId) return;
  await crearNotificacionSilencioso({
    user_id: ctx.op.vendedor_id,
    tipo: "oportunidad_etapa",
    titulo: `Oportunidad movida a "${ctx.etapa.nombre}"`,
    mensaje: `${ctx.op.nombre}${ctx.op.cliente_nombre ? ` · ${ctx.op.cliente_nombre}` : ""}`,
    link: `/crm/oportunidades/${ctx.op.id}`,
  });
}

/**
 * Tanda 2 · hallazgo 2: inserta la tarea automática siendo idempotente
 * (si ya existe una tarea abierta con el mismo asunto para la oportunidad no
 * se duplica al reintentar) y propagando el error del INSERT en vez de
 * tragárselo como éxito silencioso.
 */
async function insertarTareaAutomatica(
  ctx: AutomationCtx,
  tarea: { asunto: string; descripcion: string; fechaProgramada: string; accionBitacora: string },
): Promise<void> {
  const yaExiste = await supabase
    .from("crm_actividades")
    .select("id")
    .eq("entidad_tipo", "oportunidad")
    .eq("entidad_id", ctx.op.id)
    .eq("asunto", tarea.asunto)
    .is("fecha_completada", null)
    .is("deleted_at", null)
    .limit(1)
    .maybeSingle();
  if (yaExiste.error) throw yaExiste.error;
  if (yaExiste.data) return;

  const { error } = await supabase.from("crm_actividades").insert({
    tipo: "tarea",
    asunto: tarea.asunto,
    descripcion: tarea.descripcion,
    entidad_tipo: "oportunidad",
    entidad_id: ctx.op.id,
    fecha_programada: tarea.fechaProgramada,
    responsable_id: ctx.responsableId,
    responsable_email: ctx.responsableEmail,
    created_by: ctx.userId,
  });
  if (error) throw error;

  await registrarActividad({
    modulo: "crm",
    accion: tarea.accionBitacora,
    entidadId: ctx.op.id,
    entidadNombre: ctx.op.nombre,
  });
}

export async function crearTareaGanada(ctx: AutomationCtx): Promise<void> {
  if (ctx.etapa.tipo !== "ganada" || !ctx.responsableId) return;
  await insertarTareaAutomatica(ctx, {
    asunto: "Generar cotización en firme",
    descripcion: `Oportunidad ganada: ${ctx.op.nombre}`,
    fechaProgramada: isoDaysFromNow(1),
    accionBitacora: "crear_tarea_cotizacion_en_firme",
  });
}

export async function cancelarActividadesPerdida(ctx: AutomationCtx): Promise<void> {
  if (ctx.etapa.tipo !== "perdida") return;
  // v13.823.51 — un solo UPDATE: la variante de dos pasos podía cerrar la mitad
  // de la lista si el segundo fallaba. `resultado` no se toca nunca (la
  // oportunidad perdida ya explica la causa) y el error se propaga.
  const { error } = await supabase
    .from("crm_actividades")
    .update({ fecha_completada: new Date().toISOString() })
    .eq("entidad_tipo", "oportunidad")
    .eq("entidad_id", ctx.op.id)
    .is("fecha_completada", null)
    .is("deleted_at", null);
  if (error) throw error;
  await registrarActividad({
    modulo: "crm",
    accion: "cancelar_actividades_oportunidad_perdida",
    entidadId: ctx.op.id,
    entidadNombre: ctx.op.nombre,
  });
}


export async function crearTareaSeguimiento(ctx: AutomationCtx): Promise<void> {
  if (ctx.etapa.tipo !== "abierta" || !ctx.etapa.crea_tarea_seguimiento || !ctx.responsableId) return;
  await insertarTareaAutomatica(ctx, {
    asunto: `Seguimiento: ${ctx.etapa.nombre}`,
    descripcion: `Seguimiento programado tras pasar a "${ctx.etapa.nombre}".`,
    fechaProgramada: isoDaysFromNow(Math.max(1, ctx.etapa.dias_seguimiento)),
    accionBitacora: "crear_tarea_seguimiento_etapa",
  });
}

export async function runAutomatizaciones(
  etapaId: string,
  opId: string,
  userId: string | null,
  userEmail: string,
): Promise<void> {
  const [etapa, op] = await Promise.all([fetchEtapa(etapaId), fetchOportunidad(opId)]);
  if (!etapa || !op) return;
  const ctx: AutomationCtx = {
    etapa,
    op,
    responsableId: op.vendedor_id ?? userId,
    responsableEmail: op.vendedor_email || userEmail,
    userId,
  };
  // Tanda 2 · hallazgo 2: cada automatización corre aunque otra falle, y los
  // fallos se agregan en un solo error accionable (la etapa NO se revierte).
  const fallos: string[] = [];
  const pasos: ReadonlyArray<[string, () => Promise<void>]> = [
    ["notificar al vendedor", () => notifyVendedorMovido(ctx)],
    ["crear la tarea de cotización en firme", () => crearTareaGanada(ctx)],
    ["cerrar las actividades de la oportunidad perdida", () => cancelarActividadesPerdida(ctx)],
    ["crear la tarea de seguimiento", () => crearTareaSeguimiento(ctx)],
  ];
  for (const [nombre, paso] of pasos) {
    try {
      await paso();
    } catch (e) {
      fallos.push(`${nombre}: ${getErrorMessage(e)}`);
    }
  }
  if (fallos.length > 0) {
    throw new Error(`No se pudo ${fallos.join(" · No se pudo ")}. Puedes reintentar sin duplicar tareas.`);
  }
}
