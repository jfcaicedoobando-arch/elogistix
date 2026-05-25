/**
 * Automatizaciones al mover una oportunidad de etapa.
 * - Etapa "ganada" → crea tarea "Generar cotización en firme".
 * - Etapa "perdida" → cancela actividades pendientes de esa oportunidad.
 * - Etapa con `crea_tarea_seguimiento` → crea tarea de seguimiento a N días.
 * - Notifica al vendedor si la mueve alguien más.
 *
 * Todas las acciones son best-effort: si fallan sólo se loguean para no romper
 * el movimiento principal.
 */
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { crearNotificacionSilencioso } from "@/hooks/crm/useCrmNotificaciones";

function isoDaysFromNow(d: number): string {
  const t = new Date();
  t.setDate(t.getDate() + d);
  return t.toISOString();
}

interface EtapaInfo {
  id: string;
  nombre: string;
  tipo: "abierta" | "ganada" | "perdida";
  probabilidad_default: number;
  crea_tarea_seguimiento: boolean;
  dias_seguimiento: number;
}

interface OportunidadMin {
  id: string;
  nombre: string;
  vendedor_id: string | null;
  vendedor_email: string;
  cliente_nombre: string;
}

async function fetchEtapa(id: string): Promise<EtapaInfo | null> {
  const { data, error } = await supabase
    .from("crm_etapas_pipeline")
    .select("id, nombre, tipo, probabilidad_default, crea_tarea_seguimiento, dias_seguimiento")
    .eq("id", id)
    .maybeSingle();
  if (error || !data) return null;
  return data as EtapaInfo;
}

async function fetchOportunidad(id: string): Promise<OportunidadMin | null> {
  const { data, error } = await supabase
    .from("crm_oportunidades")
    .select("id, nombre, vendedor_id, vendedor_email, cliente_nombre")
    .eq("id", id)
    .maybeSingle();
  if (error || !data) return null;
  return data as OportunidadMin;
}

export function useMoverEtapaConAutomatizacion() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (params: { id: string; etapa_id: string; probabilidad?: number }) => {
      const patch: Record<string, unknown> = { etapa_id: params.etapa_id };
      if (typeof params.probabilidad === "number") patch.probabilidad = params.probabilidad;
      const { error } = await supabase.from("crm_oportunidades").update(patch).eq("id", params.id);
      if (error) throw error;

      // Best-effort: cargar contexto y disparar automatizaciones
      try {
        const [etapa, op] = await Promise.all([fetchEtapa(params.etapa_id), fetchOportunidad(params.id)]);
        if (!etapa || !op) return { id: params.id };
        const responsableId = op.vendedor_id ?? user?.id ?? null;
        const responsableEmail = op.vendedor_email || user?.email || "";

        // 1) Notificar al vendedor si la movió alguien más
        if (op.vendedor_id && op.vendedor_id !== user?.id) {
          await crearNotificacionSilencioso({
            user_id: op.vendedor_id,
            tipo: "oportunidad_etapa",
            titulo: `Oportunidad movida a "${etapa.nombre}"`,
            mensaje: `${op.nombre}${op.cliente_nombre ? ` · ${op.cliente_nombre}` : ""}`,
            link: `/crm/oportunidades/${op.id}`,
          });
        }

        // 2) Ganada → crear tarea de cotización en firme
        if (etapa.tipo === "ganada" && responsableId) {
          await supabase.from("crm_actividades").insert({
            tipo: "tarea",
            asunto: "Generar cotización en firme",
            descripcion: `Oportunidad ganada: ${op.nombre}`,
            entidad_tipo: "oportunidad",
            entidad_id: op.id,
            fecha_programada: isoDaysFromNow(1),
            responsable_id: responsableId,
            responsable_email: responsableEmail,
            created_by: user?.id ?? null,
          });
        }

        // 3) Perdida → cancelar actividades pendientes
        if (etapa.tipo === "perdida") {
          await supabase
            .from("crm_actividades")
            .update({
              fecha_completada: new Date().toISOString(),
              resultado: "cancelada (oportunidad perdida)",
            })
            .eq("entidad_tipo", "oportunidad")
            .eq("entidad_id", op.id)
            .is("fecha_completada", null);
        }

        // 4) Etapa con tarea de seguimiento configurada
        if (etapa.tipo === "abierta" && etapa.crea_tarea_seguimiento && responsableId) {
          await supabase.from("crm_actividades").insert({
            tipo: "tarea",
            asunto: `Seguimiento: ${etapa.nombre}`,
            descripcion: `Seguimiento programado tras pasar a "${etapa.nombre}".`,
            entidad_tipo: "oportunidad",
            entidad_id: op.id,
            fecha_programada: isoDaysFromNow(Math.max(1, etapa.dias_seguimiento)),
            responsable_id: responsableId,
            responsable_email: responsableEmail,
            created_by: user?.id ?? null,
          });
        }
      } catch (e) {
        console.warn("[useMoverEtapaConAutomatizacion] automatizaciones fallaron:", e);
      }
      return { id: params.id };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["crm", "oportunidades"] });
      qc.invalidateQueries({ queryKey: ["crm", "actividades"] });
      qc.invalidateQueries({ queryKey: ["crm", "notificaciones"] });
      qc.invalidateQueries({ queryKey: ["crm", "dashboard"] });
    },
  });
}
