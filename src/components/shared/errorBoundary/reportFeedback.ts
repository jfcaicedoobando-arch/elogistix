/**
 * Helpers puros para `ErrorBoundary`. Extraídos para respetar Power of 10
 * (≤ 200 líneas por archivo) y para poder testear el copy/feedback sin montar
 * la clase completa.
 */
import { logger } from "@/lib/observability/logger";
import { notifyError, notifySuccess } from "@/lib/ui/appFeedback";
import { APP_VERSION } from "@/constants/appVersion";

export interface ErrorBoundarySnapshot {
  error: Error | null;
  eventId: string | null;
  componentStack: string | null;
  timestamp: string | null;
}

export function buildDetailsText(snap: ErrorBoundarySnapshot): string {
  const { error, eventId, componentStack, timestamp } = snap;
  const route =
    typeof window !== "undefined"
      ? window.location.pathname + window.location.search
      : "";
  return [
    `Versión: ${APP_VERSION}`,
    `Timestamp: ${timestamp ?? ""}`,
    `Ruta: ${route}`,
    `Event ID: ${eventId ?? "(sin ID)"}`,
    `Nombre: ${error?.name ?? ""}`,
    `Mensaje: ${error?.message ?? ""}`,
    "",
    "Stack:",
    error?.stack ?? "(sin stack)",
    "",
    "Component stack:",
    componentStack ?? "(sin component stack)",
  ].join("\n");
}

/** Garantiza un eventId (captura un mensaje si no existe). */
export function ensureEventId(
  snap: ErrorBoundarySnapshot,
  Sentry: typeof import("@sentry/react"),
): string | null {
  if (snap.eventId) return snap.eventId;
  try {
    const id = Sentry.captureMessage(
      `Manual crash report – ${snap.error?.message ?? "sin error"}`,
      "error",
    );
    return id ?? null;
  } catch {
    return null;
  }
}

export async function openReportFeedback(
  snap: ErrorBoundarySnapshot,
  onEventId: (id: string) => void,
): Promise<void> {
  const Sentry = await import("@sentry/react");
  const eventId = ensureEventId(snap, Sentry) ?? undefined;
  if (eventId && eventId !== snap.eventId) onEventId(eventId);

  try {
    const feedback = Sentry.getFeedback?.();
    if (feedback) {
      if (eventId) {
        Sentry.getCurrentScope().setTag("crash_event_id", eventId);
      }
      const form = await feedback.createForm();
      form.appendToDom();
      form.open();
      return;
    }
  } catch (err) {
    logger.warn("ErrorBoundary.feedback.widgetFailed", { err: String(err) });
  }

  try {
    if (eventId && typeof Sentry.showReportDialog === "function") {
      Sentry.showReportDialog({ eventId });
      return;
    }
  } catch (err) {
    logger.warn("ErrorBoundary.feedback.dialogFailed", { err: String(err) });
  }

  if (eventId) {
    notifyError(undefined, {
      title: "No se pudo abrir el formulario de reporte",
      description: `Comparte este ID con soporte: ${eventId}`,
      method: "ErrorBoundary.openReportFeedback",
    });
  } else {
    notifyError(undefined, {
      title: "No se pudo enviar el reporte a Sentry",
      method: "ErrorBoundary.openReportFeedback",
    });
  }
}

export async function copyDetails(snap: ErrorBoundarySnapshot): Promise<void> {
  try {
    await navigator.clipboard.writeText(buildDetailsText(snap));
    // 13.310.0 (audit PR-B): migrado de `toast.success` directo a wrapper.
    notifySuccess(undefined, { title: "Detalles copiados al portapapeles" });
  } catch (err) {
    notifyError(undefined, {
      title: "No se pudo copiar al portapapeles",
      error: err,
      method: "ErrorBoundary.copyDetails",
    });
  }
}
