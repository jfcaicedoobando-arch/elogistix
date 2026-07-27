import { useMutation, useQueryClient } from "@tanstack/react-query";
import { notifySuccess } from "@/lib/ui/appFeedback";
import { useAuth } from "@/lib/contexts/AuthContext";
import { deleteAuditoriaRevision } from "@/features/auditoria/services";
import { insertBitacora } from "@/features/auditoria/services/bitacora";
import { logger } from "@/lib/observability/logger";
import { AUDITORIA_REVISIONES_KEY } from "./hash";
import { resolveAuthUser } from "./query";
import { queryKeys } from "@/lib/query";

import { notifyError } from "@/lib/ui/appFeedback";
export function useDesmarcarRevisado() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (revisionId: string) => {
      await deleteAuditoriaRevision(revisionId);

      try {
        const u = await resolveAuthUser(user).catch(() => null);
        if (u) {
          await insertBitacora({
            usuarioId: u.id,
            usuarioEmail: u.email ?? "",
            accion: "desmarcar_hallazgo_revisado",
            modulo: "auditoria",
            entidadId: null,
            entidadNombre: `Revisión ${revisionId}`,
            detalles: { revision_id: revisionId },
          });
        }
      } catch (e) {
        logger.warn("No se pudo registrar en bitácora:", e);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: AUDITORIA_REVISIONES_KEY });
      queryClient.invalidateQueries({ queryKey: queryKeys.auditoria.embarques });
      notifySuccess(undefined, { title: "Marca de revisión eliminada" });
    },
    onError: (err: Error) => {
      logger.error("[useDesmarcarRevisado] error:", err);
      notifyError(undefined, { title: "Error al eliminar marca", description: err.message, error: err, method: "FEATURES_AUDITORIA_HOOKS_REVISIONES_DESMARCAR_1" });
    },
  });
}
