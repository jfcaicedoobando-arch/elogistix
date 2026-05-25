/**
 * Automatizaciones al mover una oportunidad de etapa.
 * Ver `automatizacionesEtapaActions.ts` para las acciones individuales.
 */
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { logger } from "@/lib/observability/logger";
import { queryKeys } from "@/lib/query";
import {
  fetchEtapa,
  fetchOportunidad,
  notifyVendedorMovido,
  crearTareaGanada,
  cancelarActividadesPerdida,
  crearTareaSeguimiento,
  type AutomationCtx,
} from "./automatizacionesEtapaActions";

async function runAutomatizaciones(etapaId: string, opId: string, userId: string | null, userEmail: string): Promise<void> {
  const [etapa, op] = await Promise.all([fetchEtapa(etapaId), fetchOportunidad(opId)]);
  if (!etapa || !op) return;
  const ctx: AutomationCtx = {
    etapa,
    op,
    responsableId: op.vendedor_id ?? userId,
    responsableEmail: op.vendedor_email || userEmail,
    userId,
  };
  await notifyVendedorMovido(ctx);
  await crearTareaGanada(ctx);
  await cancelarActividadesPerdida(ctx);
  await crearTareaSeguimiento(ctx);
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

      try {
        await runAutomatizaciones(params.etapa_id, params.id, user?.id ?? null, user?.email ?? "");
      } catch (e) {
        logger.warn("[useMoverEtapaConAutomatizacion] automatizaciones fallaron:", e);
      }
      return { id: params.id };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.crm.oportunidades.all });
      qc.invalidateQueries({ queryKey: queryKeys.crm.actividades.all });
      qc.invalidateQueries({ queryKey: queryKeys.crm.notificaciones.all });
      qc.invalidateQueries({ queryKey: queryKeys.crm.dashboardAll });
    },
  });
}
