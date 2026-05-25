/**
 * Helpers puros del controller `useTrackingLiveCard`.
 * Extraídos para mantener el hook ≤200 LOC (Power of 10).
 */
import type { JsonCargoShippingLine } from "@/lib/jsoncargo/navieras";
import { validatePrefixMatchesNaviera } from "@/lib/jsoncargo/containerPrefixes";
import { PrefixMismatchError, type JsonCargoSummary } from "@/lib/jsoncargo/summary";
import { notifyError, notifySuccess, type AnyToastFn } from "@/lib/ui/appFeedback";

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

export interface ComputeFechasInput {
  readOnly: boolean | undefined;
  summary: JsonCargoSummary | null | undefined;
  trackingStatus: string | undefined;
  fechasDismissed: boolean;
  eta: string | null;
  etd: string | null;
  ata: string | null;
}

export interface FechasPropuestas {
  etaPropuesta: string | null;
  etdPropuesta: string | null;
  ataPropuesta: string | null;
  etaDifiere: boolean;
  etdDifiere: boolean;
  ataDifiere: boolean;
}

export function computeFechasPropuestas(input: ComputeFechasInput): FechasPropuestas | null {
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

type ToastFn = AnyToastFn;
export type SyncResult = {
  throttled?: boolean;
  message?: string;
  ok?: boolean;
  eventos_creados?: number;
  error?: string;
};

export function handleSyncResult(res: SyncResult, toast: ToastFn): void {
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

export function handleSyncError(err: unknown, toast: ToastFn, naviera: string | null): void {
  if (err instanceof PrefixMismatchError) {
    notifyError(toast, {
      title: "Prefix no coincide con la naviera",
      description: `El prefix ${err.prefix} no corresponde a ${naviera ?? "—"}. Verifica la naviera.`,
    });
    return;
  }
  notifyError(toast, { title: "Error de tracking", description: err instanceof Error ? err.message : "Error" });
}

export function buildApplyFechasArgs(embarqueId: string, f: FechasPropuestas) {
  return {
    embarqueId,
    eta: f.etaDifiere ? f.etaPropuesta! : undefined,
    etd: f.etdDifiere ? f.etdPropuesta! : undefined,
    ata: f.ataDifiere ? f.ataPropuesta! : undefined,
  };
}

export interface DerivePrefixInput {
  contenedor: string | null;
  sl: JsonCargoShippingLine | null;
  tracking: { status?: string; failed_reason?: string | null } | null | undefined;
  syncError: unknown;
}

export function derivePrefixState({ contenedor, sl, tracking, syncError }: DerivePrefixInput) {
  const noSoportada = !sl;
  const sinContenedor = !contenedor;
  const prefixCheck = validatePrefixMatchesNaviera(contenedor, sl);
  const prefixMismatch = !sinContenedor && !noSoportada && !prefixCheck.valid;
  const backendPrefixError =
    tracking?.status === "failed" && /prefix not found/i.test(tracking.failed_reason ?? "");
  const mutationPrefixError = syncError instanceof PrefixMismatchError ? syncError : null;
  return {
    noSoportada,
    sinContenedor,
    prefixMismatch,
    suggestions: mutationPrefixError?.suggestions ?? prefixCheck.suggestions,
    detectedPrefix: mutationPrefixError?.prefix ?? prefixCheck.prefix,
    showPrefixWarning: prefixMismatch || mutationPrefixError != null || backendPrefixError,
  };
}
