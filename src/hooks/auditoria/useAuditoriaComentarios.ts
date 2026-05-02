/**
 * Hilo de comentarios de un hallazgo (revisión). Hidratado bajo demanda
 * cuando se abre el dialog del hallazgo, no entra al cache global.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import {
  fetchComentariosByRevision,
  insertComentario,
} from "@/services/auditoria";
import type { AuditoriaComentario } from "@/types/auditoria";

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
      console.error("[useAgregarComentarioAuditoria] error:", err);
      toast.error("No se pudo agregar el comentario", {
        description: err.message,
      });
    },
  });
}
