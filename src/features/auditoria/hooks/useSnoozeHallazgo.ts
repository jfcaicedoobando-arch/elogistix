/**
 * Mutation para silenciar un hallazgo hasta una fecha objetivo, con motivo
 * obligatorio. El hallazgo sigue siendo "pendiente" en BD pero queda oculto
 * de la tabla por defecto hasta `snoozed_until`.
 *
 * v13.312.20 — Ola 1 · item 3: migrado a `useMutationWithFeedback` para
 * estandarizar invalidación + toast success/error (elimina toasts duplicados).
 */
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
import { useMutationWithFeedback } from "@/hooks/shared";
import { todayLocalISO } from "@/lib/date/today";
import { useOrgActiva } from "@/hooks/shared/useOrgActiva";

export function useSnoozeHallazgo() {
  const { user } = useAuth();
  const { organizationId } = useOrgActiva();

  return useMutationWithFeedback({
    mutationFn: async (params: {
      hallazgo: HallazgoAuditoria;
      snoozedUntil: string; // YYYY-MM-DD
      motivo: string;
    }) => {
      if (!user) throw new Error("Sesión no válida");
      if (!organizationId) throw new Error("Organización no resuelta");
      const { hallazgo, snoozedUntil, motivo } = params;

      // Validación cliente (espejo del trigger BD `validar_snooze_auditoria`):
      // fechas pasadas se rechazan y snooze > 30 días exige motivo >= 20 chars.
      const hoyIso = todayLocalISO();
      if (snoozedUntil < hoyIso) {
        throw new Error("No se puede silenciar un hallazgo en el pasado");
      }
      const dias = Math.round(
        (Date.parse(`${snoozedUntil}T00:00:00Z`) - Date.parse(`${hoyIso}T00:00:00Z`)) / 86_400_000,
      );
      const motivoLen = (motivo ?? "").trim().length;
      if (dias > 30 && motivoLen < 20) {
        throw new Error(
          "Silenciar más de 30 días requiere un motivo justificado de al menos 20 caracteres",
        );
      }

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
    invalidate: [queryKeys.auditoria.revisiones, queryKeys.auditoria.embarques],
    successTitle: "Hallazgo silenciado",
    errorTitle: "No se pudo silenciar el hallazgo",
    errorMethod: "FEATURES_AUDITORIA_HOOKS_USESNOOZEHALLAZGO_1",
  });
}

export function useQuitarSnooze() {
  return useMutationWithFeedback({
    mutationFn: clearSnoozeRevision,
    invalidate: [queryKeys.auditoria.revisiones, queryKeys.auditoria.embarques],
    successTitle: "Snooze removido",
    errorTitle: "Error al quitar snooze",
    errorMethod: "FEATURES_AUDITORIA_HOOKS_USESNOOZEHALLAZGO_2",
  });
}
