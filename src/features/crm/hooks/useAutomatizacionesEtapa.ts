/**
 * Automatizaciones al mover una oportunidad de etapa.
 * I/O y orquestación en `services/crm/automatizacionesEtapa`.
 */
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/contexts/AuthContext";
import { logger } from "@/lib/observability/logger";
import { queryKeys } from "@/lib/query";
import { moverEtapaOportunidad } from "@/features/crm/services/oportunidades";
import { runAutomatizaciones } from "@/features/crm/services/automatizacionesEtapa";
import { notifyError } from "@/lib/ui/appFeedback";

export function useMoverEtapaConAutomatizacion() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (params: {
      id: string; etapa_id: string; probabilidad?: number;
      fecha_cierre_real?: string | null; valor_real?: number | null;
      motivo_perdida_id?: string | null; // Ola 4 · N49
    }) => {
      await moverEtapaOportunidad(params);
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
    onError: (error: Error) => {
      notifyError(undefined, { title: `Error al mover etapa: ${error.message}`, error, method: "MOVE_ETAPA_OPORTUNIDAD" });
    },
  });
}
