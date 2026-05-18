/**
 * Controller del componente `TrackingLiveCard`. Encapsula:
 * - Queries/mutations de JSONCargo (tracking en vivo, sync, aplicar fechas).
 * - Estado local de UI (diálogo BL, dismiss de la sugerencia de fechas).
 * - Reglas derivadas (prefix mismatch, naviera no soportada, fechas distintas).
 * - Handlers `onSync` y `onAplicarFechas` con feedback de toasts.
 *
 * El componente queda como render puro consumiendo este hook.
 */
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { notifyError, notifySuccess } from "@/lib/ui/appFeedback";
import { mapNavieraToJsonCargo } from "@/lib/jsoncargo/navieras";
import { validatePrefixMatchesNaviera } from "@/lib/jsoncargo/containerPrefixes";
import {
  useJsonCargoTracking,
  useSyncJsonCargo,
  useApplyJsonCargoFechas,
  extractSummary,
  PrefixMismatchError,
} from "@/hooks/embarque/useJsonCargoTracking";

/** Parse "YYYY-MM-DD HH:MM" o ISO desde JSONCargo y devuelve "YYYY-MM-DD". */
export function jsoncargoDateToYmd(value: string | null | undefined): string | null {
  if (!value) return null;
  const s = value.trim();
  if (!s) return null;
  const iso = s.includes("T") ? s : s.replace(" ", "T") + ":00Z";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

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
  const noSoportada = !sl;
  const sinContenedor = !contenedor;
  const summary = tracking?.raw_payload ? extractSummary(tracking.raw_payload) : null;

  // Validación de prefix vs naviera (local, no consume cuota)
  const prefixCheck = validatePrefixMatchesNaviera(contenedor, sl);
  const prefixMismatch = !sinContenedor && !noSoportada && !prefixCheck.valid;

  // Detecta también si el backend ya guardó un fallo por prefix
  const backendPrefixError =
    tracking?.status === "failed" && /prefix not found/i.test(tracking.failed_reason ?? "");

  // Estado de error tras una mutación del cliente
  const mutationPrefixError =
    sync.error instanceof PrefixMismatchError ? (sync.error as PrefixMismatchError) : null;

  const suggestions = mutationPrefixError?.suggestions ?? prefixCheck.suggestions;
  const detectedPrefix = mutationPrefixError?.prefix ?? prefixCheck.prefix;
  const showPrefixWarning = prefixMismatch || mutationPrefixError != null || backendPrefixError;

  const onSync = async () => {
    try {
      const res = await sync.mutateAsync({ embarqueId, contenedor, naviera });
      if (res.throttled) {
        toast({ title: "Sincronización reciente", description: res.message ?? "Espera unos minutos." });
      } else if (res.ok) {
        notifySuccess(toast, {
          title: "Tracking actualizado",
          description: res.eventos_creados
            ? `${res.eventos_creados} evento(s) nuevo(s).`
            : "Sin cambios desde la última sincronización.",
        });
      } else {
        notifyError(toast, { title: "No se pudo sincronizar", description: res.error ?? "Error desconocido" });
      }
    } catch (err) {
      if (err instanceof PrefixMismatchError) {
        notifyError(toast, {
          title: "Prefix no coincide con la naviera",
          description: `El prefix ${err.prefix} no corresponde a ${naviera ?? "—"}. Verifica la naviera.`,
        });
        return;
      }
      notifyError(toast, { title: "Error de tracking", description: err instanceof Error ? err.message : "Error" });
    }
  };

  // Sugerencia de fechas (sólo cuando hay summary y no estamos en readOnly).
  const fechasPropuestas = computeFechasPropuestas({
    readOnly, summary, trackingStatus: tracking?.status, fechasDismissed,
    eta: eta ?? null, etd: etd ?? null, ata: fechaLlegadaReal ?? null,
  });

  const onAplicarFechas = async () => {
    if (!fechasPropuestas) return;
    const { etaPropuesta, etdPropuesta, ataPropuesta, etaDifiere, etdDifiere, ataDifiere } = fechasPropuestas;
    try {
      await applyFechas.mutateAsync({
        embarqueId,
        eta: etaDifiere ? etaPropuesta! : undefined,
        etd: etdDifiere ? etdPropuesta! : undefined,
        ata: ataDifiere ? ataPropuesta! : undefined,
      });
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
    // Queries / mutations expuestas
    tracking,
    isLoading,
    summary,
    sync,
    applyFechas,
    // UI state
    bolDialogOpen,
    setBolDialogOpen,
    fechasDismissed,
    setFechasDismissed,
    // Derivados
    noSoportada,
    sinContenedor,
    prefixMismatch,
    showPrefixWarning,
    suggestions,
    detectedPrefix,
    fechasPropuestas,
    // Handlers
    onSync,
    onAplicarFechas,
  };
}
