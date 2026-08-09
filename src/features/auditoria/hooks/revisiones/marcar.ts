import { useMutation, useQueryClient } from "@tanstack/react-query";
import { notifySuccess } from "@/lib/ui/appFeedback";
import { useAuth } from "@/lib/contexts/AuthContext";
import { upsertAuditoriaRevision } from "@/features/auditoria/services";
import { insertBitacora } from "@/features/auditoria/services/bitacora";
import type { HallazgoAuditoria } from "@/features/auditoria/types";
import { logger } from "@/lib/observability/logger";
import { hallazgoHash, AUDITORIA_REVISIONES_KEY } from "./hash";
import { resolveAuthUser } from "./query";
import { queryKeys } from "@/lib/query";

import { notifyError } from "@/lib/ui/appFeedback";
import { useOrgActiva } from "@/hooks/shared/useOrgActiva";
export function useMarcarRevisado() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { organizationId } = useOrgActiva();

  return useMutation({
    mutationFn: async (params: {
      hallazgo: HallazgoAuditoria;
      accionTomada: string;
    }) => {
      const { hallazgo, accionTomada } = params;
      const detalleHash = hallazgoHash(hallazgo);
      const u = await resolveAuthUser(user);
      if (!organizationId) throw new Error("Organización no resuelta");

      const data = await upsertAuditoriaRevision({
        organization_id: organizationId,
        embarque_id: hallazgo.embarque_id,
        regla: hallazgo.regla,
        detalle_hash: detalleHash,
        detalle: hallazgo.detalle,
        accion_tomada: accionTomada,
        revisado_por: u.id,
        revisado_por_email: u.email ?? "",
      });

      try {
        await insertBitacora({
          usuarioId: u.id,
          usuarioEmail: u.email ?? "",
          accion: "marcar_hallazgo_revisado",
          modulo: "auditoria",
          entidadId: hallazgo.embarque_id,
          entidadNombre: `Hallazgo ${hallazgo.regla} — Embarque ${hallazgo.expediente}`,
          detalles: {
            regla: hallazgo.regla,
            severidad: hallazgo.severidad,
            detalle: hallazgo.detalle,
            accion_tomada: accionTomada,
            expediente: hallazgo.expediente,
            cliente_nombre: hallazgo.cliente_nombre,
          },
        });
      } catch (e) {
        logger.warn("No se pudo registrar en bitácora:", e);
      }
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: AUDITORIA_REVISIONES_KEY });
      queryClient.invalidateQueries({ queryKey: queryKeys.auditoria.embarques });
      notifySuccess(undefined, { title: "Hallazgo marcado como revisado" });
    },
    onError: (err: unknown) => {
      logger.error("[useMarcarRevisado] error:", err);
      const e = err as { code?: string; message?: string };
      const isPermiso =
        e?.code === "42501" || /row-level security/i.test(e?.message ?? "");
      notifyError(undefined, { title: isPermiso
          ? "No tienes permisos para marcar revisado"
          : "Error al marcar revisado", description: isPermiso
            ? "Tu rol en esta organización no permite esta acción. Contacta a un administrador."
            : e?.message ?? "Error desconocido", method: "FEATURES_AUDITORIA_HOOKS_REVISIONES_MARCAR_1" });
    },
  });
}
