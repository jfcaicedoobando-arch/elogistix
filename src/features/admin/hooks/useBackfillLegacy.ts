/**
 * Wrapper hook para el botón "Ejecutar backfill legacy" en /admin/auditoria.
 * Encapsula la mutación + toasts para que la Card no llame `useMutation` inline.
 */
import { useMutation } from "@tanstack/react-query";
import { notifyError, notifySuccess } from "@/lib/ui/appFeedback";
import {
  runAuditoriaBackfillLegacy,
  type BackfillLegacyResult,
} from "@/features/admin/services/backfillLegacy";

export interface UseBackfillLegacyOptions {
  onSuccess?: (data: BackfillLegacyResult) => void;
}

export function useBackfillLegacy(options: UseBackfillLegacyOptions = {}) {
  return useMutation({
    mutationFn: runAuditoriaBackfillLegacy,
    onSuccess: (data) => {
      notifySuccess(undefined, {
        title: `Backfill ejecutado: ${data.totales.conceptos_actualizados} conceptos, ${data.totales.embarques_afectados} embarques, ${data.totales.proformas_actualizadas} proformas.`,
      });
      options.onSuccess?.(data);
    },
    onError: (err) => {
      notifyError(undefined, { title: err instanceof Error ? err.message : "Error al ejecutar backfill", error: err, method: "FEATURES_ADMIN_HOOKS_USEBACKFILLLEGACY_1" });
    },
  });
}
