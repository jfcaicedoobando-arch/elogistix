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
import { mapNavieraToJsonCargo, type JsonCargoShippingLine } from "@/lib/jsoncargo/navieras";
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

interface ComputeFechasInput {
  readOnly: boolean | undefined;
  summary: ReturnType<typeof extractSummary> | null | undefined;
  trackingStatus: string | undefined;
  fechasDismissed: boolean;
  eta: string | null;
  etd: string | null;
  ata: string | null;
}

function computeFechasPropuestas(input: ComputeFechasInput) {
  const { readOnly, summary, trackingStatus, fechasDismissed, eta, etd, ata } = input;
  if (readOnly || !summary || trackingStatus !== "ok" || fechasDismissed) return null;
  const etaPropuesta = jsoncargoDateToYmd(summary.eta_final_destination);
  const etdPropuesta = jsoncargoDateToYmd(summary.etd_origin_effective ?? summary.atd_origin);
  const ataPropuesta = jsoncargoDateToYmd(summary.ata_effective);
  const etaDifiere = !!etaPropuesta && etaPropuesta !== eta;
  const etdDifiere = !!etdPropuesta && etdPropuesta !== etd;
  const ataDifiere = !!ataPropuesta && ataPropuesta !== ata;
  if (!etaDifiere && !etdDifiere && !ataDifiere) return null;
  return { etaPropuesta, etdPropuesta, ataPropuesta, etaDifiere, etdDifiere, ataDifiere };
}

type ToastFn = ReturnType<typeof useToast>["toast"];
type SyncResult = { throttled?: boolean; message?: string; ok?: boolean; eventos_creados?: number; error?: string };

function handleSyncResult(res: SyncResult, toast: ToastFn): void {
  if (res.throttled) {
    toast({ title: "Sincronización reciente", description: res.message ?? "Espera unos minutos." });
    return;
  }
  if (res.ok) {
    notifySuccess(toast, {
      title: "Tracking actualizado",
      description: res.eventos_creados
        ? `${res.eventos_creados} evento(s) nuevo(s).`
        : "Sin cambios desde la última sincronización.",
    });
    return;
  }
  notifyError(toast, { title: "No se pudo sincronizar", description: res.error ?? "Error desconocido" });
}

function handleSyncError(err: unknown, toast: ToastFn, naviera: string | null): void {
  if (err instanceof PrefixMismatchError) {
    notifyError(toast, {
      title: "Prefix no coincide con la naviera",
      description: `El prefix ${err.prefix} no corresponde a ${naviera ?? "—"}. Verifica la naviera.`,
    });
    return;
  }
  notifyError(toast, { title: "Error de tracking", description: err instanceof Error ? err.message : "Error" });
}

interface FechasArgs { etaPropuesta: string | null; etdPropuesta: string | null; ataPropuesta: string | null; etaDifiere: boolean; etdDifiere: boolean; ataDifiere: boolean; }
function buildApplyFechasArgs(embarqueId: string, f: FechasArgs) {
  return {
    embarqueId,
    eta: f.etaDifiere ? f.etaPropuesta! : undefined,
    etd: f.etdDifiere ? f.etdPropuesta! : undefined,
    ata: f.ataDifiere ? f.ataPropuesta! : undefined,
  };
}

interface DerivePrefixInput {
  contenedor: string | null;
  sl: JsonCargoShippingLine | null;
  tracking: { status?: string; failed_reason?: string | null } | null | undefined;
  syncError: unknown;
}

function derivePrefixState({ contenedor, sl, tracking, syncError }: DerivePrefixInput) {
  const noSoportada = !sl;
  const sinContenedor = !contenedor;
  const prefixCheck = validatePrefixMatchesNaviera(contenedor, sl);
  const prefixMismatch = !sinContenedor && !noSoportada && !prefixCheck.valid;
  const backendPrefixError =
    tracking?.status === "failed" && /prefix not found/i.test(tracking.failed_reason ?? "");
  const mutationPrefixError =
    syncError instanceof PrefixMismatchError ? syncError : null;
  return {
    noSoportada,
    sinContenedor,
    prefixMismatch,
    suggestions: mutationPrefixError?.suggestions ?? prefixCheck.suggestions,
    detectedPrefix: mutationPrefixError?.prefix ?? prefixCheck.prefix,
    showPrefixWarning: prefixMismatch || mutationPrefixError != null || backendPrefixError,
  };
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
  const summary = tracking?.raw_payload ? extractSummary(tracking.raw_payload) : null;
  const prefixState = derivePrefixState({ contenedor, sl, tracking, syncError: sync.error });
  const { noSoportada, sinContenedor, prefixMismatch, suggestions, detectedPrefix, showPrefixWarning } = prefixState;

  // Sugerencia de fechas (sólo cuando hay summary y no estamos en readOnly).
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
