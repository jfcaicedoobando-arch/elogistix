/**
 * Mutation para silenciar un hallazgo hasta una fecha objetivo, con motivo
 * obligatorio. El hallazgo sigue siendo "pendiente" en BD pero queda oculto
 * de la tabla por defecto hasta `snoozed_until`.
 */
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAuth } from "@/lib/contexts/AuthContext";
import {
  clearSnoozeRevision,
  snoozeRevision,
} from "@/features/auditoria/services";
import { insertBitacora } from "@/features/auditoria/services/bitacora";
import { hallazgoHash } from "@/features/auditoria/hooks/useAuditoriaRevisiones";
import type { HallazgoAuditoria } from "@/features/auditoria/types";
import { logger } from "@/lib/observability/logger";
import { queryKeys } from "@/lib/query";

import { notifyError } from "@/components/shared/utils/appFeedback";
export function useSnoozeHallazgo() {
  const queryClient = useQueryClient();
  const { user, organizationId } = useAuth();

  return useMutation({
    mutationFn: async (params: {
      hallazgo: HallazgoAuditoria;
      snoozedUntil: string; // YYYY-MM-DD
      motivo: string;
    }) => {
      if (!user) throw new Error("Sesión no válida");
      if (!organizationId) throw new Error("Organización no resuelta");
      const { hallazgo, snoozedUntil, motivo } = params;
      const detalleHash = hallazgoHash(hallazgo);
      const data = await snoozeRevision({
        organization_id: organizationId,
        embarque_id: hallazgo.embarque_id,
        regla: hallazgo.regla,
        detalle_hash: detalleHash,
        detalle: hallazgo.detalle,
        snoozed_until: snoozedUntil,
        snooze_motivo: motivo,
      });

      try {
        await insertBitacora({
          usuarioId: user.id,
          usuarioEmail: user.email ?? "",
          accion: "snooze_hallazgo",
          modulo: "auditoria",
          entidadId: hallazgo.embarque_id,
          entidadNombre: `Hallazgo ${hallazgo.regla} — Embarque ${hallazgo.expediente}`,
          detalles: {
            regla: hallazgo.regla,
            severidad: hallazgo.severidad,
            snoozed_until: snoozedUntil,
            motivo,
          },
        });
      } catch (e) {
        logger.warn("No se pudo registrar en bitácora:", e);
      }
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.auditoria.revisiones });
      queryClient.invalidateQueries({ queryKey: queryKeys.auditoria.embarques });
      toast.success("Hallazgo silenciado");
    },
    onError: (err: Error) => {
      logger.error("[useSnoozeHallazgo] error:", err);
      notifyError(toast, { title: "No se pudo silenciar el hallazgo", description: err.message, error: err, method: "FEATURES_AUDITORIA_HOOKS_USESNOOZEHALLAZGO_1" });
    },
  });
}

export function useQuitarSnooze() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: clearSnoozeRevision,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.auditoria.revisiones });
      queryClient.invalidateQueries({ queryKey: queryKeys.auditoria.embarques });
      toast.success("Snooze removido");
    },
    onError: (err: Error) => {
      notifyError(toast, { title: "Error al quitar snooze", description: err.message, error: err, method: "FEATURES_AUDITORIA_HOOKS_USESNOOZEHALLAZGO_2" });
    },
  });
}
