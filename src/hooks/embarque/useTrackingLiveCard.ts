/**
 * Controller del componente `TrackingLiveCard`. Encapsula queries/mutations
 * de JSONCargo, estado local de UI y handlers con feedback de toasts.
 * Lógica pura extraída a `lib/jsoncargo/trackingLiveHelpers.ts`.
 */
import { useState } from "react";
import { useToast } from "@/hooks/shared/useToast";
import { notifyError, notifySuccess } from "@/lib/ui/appFeedback";
import { mapNavieraToJsonCargo } from "@/lib/jsoncargo/navieras";
import { extractSummary } from "@/lib/jsoncargo/summary";
import {
  useJsonCargoTracking,
  useSyncJsonCargo,
  useApplyJsonCargoFechas,
} from "@/hooks/embarque/useJsonCargoTracking";
import {
  jsoncargoDateToYmd,
  computeFechasPropuestas,
  handleSyncResult,
  handleSyncError,
  buildApplyFechasArgs,
  derivePrefixState,
} from "@/lib/jsoncargo/trackingLiveHelpers";

// Re-export para compatibilidad
export { jsoncargoDateToYmd };

interface UseTrackingLiveCardInput {
  embarqueId: string;
  naviera: string | null;
  contenedor: string | null;
  etd?: string | null;
  eta?: string | null;
  fechaLlegadaReal?: string | null;
  readOnly?: boolean;
}

export function useTrackingLiveCard({
  embarqueId,
  naviera,
  contenedor,
  etd,
  eta,
  fechaLlegadaReal,
  readOnly,
}: UseTrackingLiveCardInput) {
  const { toast } = useToast();
  const { data: tracking, isLoading } = useJsonCargoTracking(embarqueId);
  const sync = useSyncJsonCargo();
  const applyFechas = useApplyJsonCargoFechas();

  const [bolDialogOpen, setBolDialogOpen] = useState(false);
  const [fechasDismissed, setFechasDismissed] = useState(false);

  const sl = mapNavieraToJsonCargo(naviera);
  const summary = tracking?.raw_payload ? extractSummary(tracking.raw_payload) : null;
  const prefixState = derivePrefixState({ contenedor, sl, tracking, syncError: sync.error });
  const { noSoportada, sinContenedor, prefixMismatch, suggestions, detectedPrefix, showPrefixWarning } = prefixState;

  const fechasPropuestas = computeFechasPropuestas({
    readOnly, summary, trackingStatus: tracking?.status, fechasDismissed,
    eta: eta ?? null, etd: etd ?? null, ata: fechaLlegadaReal ?? null,
  });

  const onSync = async () => {
    try {
      const res = await sync.mutateAsync({ embarqueId, contenedor, naviera });
      handleSyncResult(res, toast);
    } catch (err) {
      handleSyncError(err, toast, naviera);
    }
  };

  const onAplicarFechas = async () => {
    if (!fechasPropuestas) return;
    try {
      await applyFechas.mutateAsync(buildApplyFechasArgs(embarqueId, fechasPropuestas));
      notifySuccess(toast, { title: "Fechas actualizadas en el embarque" });
      setFechasDismissed(true);
    } catch (err) {
      notifyError(toast, {
        title: "No se pudieron actualizar las fechas",
        description: err instanceof Error ? err.message : "Error",
      });
    }
  };

  return {
    tracking, isLoading, summary, sync, applyFechas,
    bolDialogOpen, setBolDialogOpen,
    fechasDismissed, setFechasDismissed,
    noSoportada, sinContenedor, prefixMismatch, showPrefixWarning,
    suggestions, detectedPrefix, fechasPropuestas,
    onSync, onAplicarFechas,
  };
}
