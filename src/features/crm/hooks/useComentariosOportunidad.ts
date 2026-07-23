/**
 * Comentarios de oportunidad CRM (Sprint D).
 * Lectura paginada simple + alta. La notificación al vendedor se dispara por
 * trigger en BD (`crm_notify_comentario_oportunidad`).
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/contexts/AuthContext";
import { queryKeys } from "@/lib/query";
import {
  fetchComentariosOportunidad,
  crearComentarioOportunidad,
  type ComentarioRow,
} from "@/features/crm/services";
import { notifyError } from "@/lib/ui/appFeedback";

export type { ComentarioRow };

export function useComentariosOportunidad(oportunidadId: string | undefined, limit = 50) {
  return useQuery<ComentarioRow[]>({
    queryKey: queryKeys.crm.comentarios.byOportunidad(oportunidadId ?? "", limit),
    enabled: !!oportunidadId,
    queryFn: () => fetchComentariosOportunidad(oportunidadId!, limit),
  });
}

export function useCrearComentarioOportunidad() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async ({ oportunidadId, texto }: { oportunidadId: string; texto: string }) => {
      if (!user?.id) throw new Error("Sesión no encontrada");
      await crearComentarioOportunidad({
        oportunidadId,
        texto,
        autorId: user.id,
        autorEmail: user.email ?? "",
      });
    },
    onSuccess: (_v, vars) => {
      qc.invalidateQueries({
        queryKey: queryKeys.crm.comentarios.byOportunidadAll(vars.oportunidadId),
      });
    },
    onError: (error: Error) => {
      notifyError(undefined, { title: `Error al agregar comentario: ${error.message}`, error, method: "CREATE_COMENTARIO_OP" });
    },
  });
}
