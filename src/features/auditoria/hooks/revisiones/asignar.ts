import { useMutation, useQueryClient } from "@tanstack/react-query";

import { useAuth } from "@/lib/contexts/AuthContext";
import { asignarResponsableHallazgo } from "@/features/auditoria/services";
import { insertBitacora } from "@/features/auditoria/services/bitacora";
import type { HallazgoAuditoria } from "@/features/auditoria/types";
import { logger } from "@/lib/observability/logger";
import { hallazgoHash, AUDITORIA_REVISIONES_KEY } from "./hash";
import { resolveAuthUser } from "./query";
import { queryKeys } from "@/lib/query";

import { notifyError, notifySuccess } from "@/lib/ui/appFeedback";
import { useOrgActiva } from "@/hooks/shared/useOrgActiva";
/**
 * Asigna o reasigna un responsable (operador/encargado) a un hallazgo.
 * Si el responsable es el propio usuario y `tomar=true`, registra
 * la acción como "tomar hallazgo" (estado=en_progreso).
 */
export function useAsignarResponsable() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { organizationId } = useOrgActiva();

  return useMutation({
    mutationFn: async (params: {
      hallazgo: HallazgoAuditoria;
      responsableId: string | null;
      responsableEmail: string;
      fechaLimite: string | null;
      tomar?: boolean;
    }) => {
      const u = await resolveAuthUser(user);
      if (!organizationId) throw new Error("Organización no resuelta");
      const { hallazgo, responsableId, responsableEmail, fechaLimite, tomar } = params;
      const detalleHash = hallazgoHash(hallazgo);

      const data = await asignarResponsableHallazgo({
        organization_id: organizationId,
        embarque_id: hallazgo.embarque_id,
        regla: hallazgo.regla,
        detalle_hash: detalleHash,
        detalle: hallazgo.detalle,
        responsable_id: responsableId,
        responsable_email: responsableEmail,
        asignado_por: u.id,
        asignado_por_email: u.email ?? "",
        fecha_limite: fechaLimite,
        estado_revision: tomar ? "en_progreso" : "pendiente",
      });

      try {
        await insertBitacora({
          usuarioId: u.id,
          usuarioEmail: u.email ?? "",
          accion: tomar ? "tomar_hallazgo" : "asignar_hallazgo",
          modulo: "auditoria",
          entidadId: hallazgo.embarque_id,
          entidadNombre: `Hallazgo ${hallazgo.regla} — Embarque ${hallazgo.expediente}`,
          detalles: {
            regla: hallazgo.regla,
            severidad: hallazgo.severidad,
            responsable_id: responsableId,
            responsable_email: responsableEmail,
            fecha_limite: fechaLimite,
            expediente: hallazgo.expediente,
            cliente_nombre: hallazgo.cliente_nombre,
          },
        });
      } catch (e) {
        logger.warn("No se pudo registrar en bitácora:", e);
      }
      return data;
    },
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: AUDITORIA_REVISIONES_KEY });
      queryClient.invalidateQueries({ queryKey: queryKeys.auditoria.embarques });
      notifySuccess(undefined, {
        title: vars.tomar ? "Hallazgo tomado" : vars.responsableId ? "Responsable asignado" : "Asignación removida",
      });
    },
    onError: (err: unknown) => {
      logger.error("[useAsignarResponsable] error:", err);
      const e = err as { code?: string; message?: string };
      const isPermiso =
        e?.code === "42501" || /row-level security/i.test(e?.message ?? "");
      notifyError(undefined, { title: isPermiso ? "No tienes permisos para asignar" : "Error al asignar responsable", description: e?.message ?? "Error desconocido", method: "FEATURES_AUDITORIA_HOOKS_REVISIONES_ASIGNAR_1" });
    },
  });
}
