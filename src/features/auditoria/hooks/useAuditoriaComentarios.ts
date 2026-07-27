/**
 * Hilo de comentarios de un hallazgo (revisión). Hidratado bajo demanda
 * cuando se abre el dialog del hallazgo, no entra al cache global.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/contexts/AuthContext";
import {
  fetchComentariosByRevision,
  insertComentario,
} from "@/features/auditoria/services";
import type { AuditoriaComentario } from "@/features/auditoria/types";
import { logger } from "@/lib/observability/logger";

import { notifyError } from "@/lib/ui/appFeedback";
const baseKey = (revisionId: string) =>
  ["auditoria", "comentarios", revisionId] as const;

export function useAuditoriaComentarios(revisionId: string | null | undefined) {
  return useQuery({
    queryKey: baseKey(revisionId ?? "_none_"),
    queryFn: (): Promise<AuditoriaComentario[]> =>
      fetchComentariosByRevision(revisionId as string),
    enabled: !!revisionId,
    staleTime: 30_000,
  });
}

export function useAgregarComentarioAuditoria() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (params: { revisionId: string; contenido: string }) => {
      if (!user) throw new Error("Sesión no válida");
      return insertComentario({
        revision_id: params.revisionId,
        autor_id: user.id,
        autor_email: user.email ?? "",
        contenido: params.contenido,
      });
    },
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: baseKey(vars.revisionId) });
    },
    onError: (err: Error) => {
      logger.error("[useAgregarComentarioAuditoria] error:", err);
      notifyError(undefined, { title: "No se pudo agregar el comentario", description: err.message, error: err, method: "FEATURES_AUDITORIA_HOOKS_USEAUDITORIACOMENTARIOS_1" });
    },
  });
}
