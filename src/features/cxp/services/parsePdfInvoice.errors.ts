/**
 * Clasificación y mensajería de errores del cliente `parse-invoice-pdf`.
 * Extraído de `parsePdfInvoice.ts` (Power-of-10 #4). Sin cambios de conducta.
 */
import { reportCaughtError } from "@/lib/observability/reportCaughtError";
import {
  FunctionsHttpError,
  FunctionsFetchError,
} from "@supabase/supabase-js";
import { CfdiUploadError, type CfdiParsedResponse, type CfdiUploadPhase } from "./parseCfdi.types";

export const MAX_ATTEMPTS = 2;
export const BACKOFF_MS = 1500;

export interface Attempt {
  ok: boolean;
  data?: CfdiParsedResponse;
  phase: CfdiUploadPhase;
  status: number | null;
  message: string;
  cause: unknown;
  retryable: boolean;
}

export async function mapHttpError(err: FunctionsHttpError): Promise<{ status: number | null; message: string }> {
  const ctx = err.context as Response | undefined;
  const status = ctx?.status ?? null;
  let message = "No se pudo leer la factura PDF. Intenta de nuevo o usa Captura manual.";
  try {
    const body = await ctx?.clone().json();
    if (body?.error) message = body.error;
  } catch { /* body no-JSON */ }
  return { status, message };
}

/**
 * Un `FunctionsFetchError` / "Failed to fetch" significa que la petición nunca
 * salió del dispositivo: es red local, no caída del servicio (Sentry -5T).
 */
function esFallaDeRed(last: Attempt | null, online: boolean): boolean {
  const sinRespuesta = last?.phase === "request" && last?.status === null;
  if (!sinRespuesta) return false;
  if (last?.cause instanceof FunctionsFetchError) return true;
  if (!online) return true;
  return /failed to fetch|network|load failed/i.test(last?.message ?? "");
}

function mensajeAmigable(last: Attempt | null, fallaDeRed: boolean, serviceUnavailable: boolean): string {
  if (fallaDeRed) {
    return "No pudimos contactar al servidor desde este dispositivo. Revisa tu conexión (Wi-Fi o datos) e intenta de nuevo, o usa la pestaña Captura manual.";
  }
  if (serviceUnavailable) {
    return "El servicio de captura por IA no está disponible en este momento. Puedes usar la pestaña Captura manual o intentar de nuevo en unos segundos.";
  }
  // Un 401 tras reintentar con sesión refrescada sólo puede ser sesión vencida:
  // mostrar "Token inválido" no le dice nada al usuario.
  if (last?.status === 401) {
    return "Tu sesión expiró. Vuelve a iniciar sesión y sube el PDF de nuevo.";
  }
  if (last?.status === 200) return "No se pudieron extraer los datos de este PDF. Revisa que sea legible o usa Captura manual.";
  return "No se pudo leer la factura PDF. Intenta de nuevo o usa Captura manual.";
}

export function buildFailure(file: File, last: Attempt | null, latencyMs: number): CfdiUploadError {
  const online = typeof navigator !== "undefined" ? navigator.onLine : true;
  const serviceUnavailable = last?.phase === "request" && last?.status === null;
  const fallaDeRed = esFallaDeRed(last, online);
  const friendlyMessage = mensajeAmigable(last, fallaDeRed, serviceUnavailable);

  const err = new CfdiUploadError(
    friendlyMessage,
    {
      attemptCount: MAX_ATTEMPTS,
      latencyMs,
      online,
      xmlSize: file.size,
      xmlName: file.name,
      lastStatus: last?.status ?? null,
      phase: last?.phase ?? "request",
      errorName: "PdfIaUploadError",
      technicalMessage: last?.message,
    },
    last?.cause ?? null,
  );
  reportCaughtError(err, {
    feature: "pdf_ia_upload",
    op: "parse_invoice_pdf",
    phase: err.context.phase,
    functionName: "parse-invoice-pdf",
    error_kind: fallaDeRed ? "network" : undefined,
  }, { pdf_size: file.size, latency_ms: latencyMs, service_unavailable: serviceUnavailable, network_failure: fallaDeRed, ...err.context });

  return err;
}
