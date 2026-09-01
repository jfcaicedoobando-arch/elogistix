/**
 * Cliente para invocar la edge function `parse-invoice-pdf`, que extrae los
 * campos de una factura PDF de proveedor internacional usando IA (Gemini).
 *
 * Devuelve el mismo shape `CfdiParsedResponse` que `parse-cfdi-xml`, así el
 * frontend reutiliza `handleCfdiParsed` para prellenar el formulario.
 */
import * as Sentry from "@sentry/react";
import { reportCaughtError } from "@/lib/observability/reportCaughtError";
import {
  FunctionsHttpError,
  FunctionsRelayError,
  FunctionsFetchError,
} from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { AUTH_ERROR_MESSAGES } from "@/constants/authMessages";
import { ensureFreshSession } from "@/lib/auth/ensureFreshSession";
import { CfdiUploadError, type CfdiParsedResponse, type CfdiUploadPhase } from "./parseCfdi.types";

const MAX_ATTEMPTS = 2;
const BACKOFF_MS = 1500;

async function mapHttpError(err: FunctionsHttpError): Promise<{ status: number | null; message: string }> {
  const ctx = err.context as Response | undefined;
  const status = ctx?.status ?? null;
  let message = `parse-invoice-pdf respondió HTTP ${status ?? "?"}`;
  try {
    const body = await ctx?.clone().json();
    if (body?.error) message = body.error;
  } catch { /* body no-JSON */ }
  return { status, message };
}

interface Attempt {
  ok: boolean;
  data?: CfdiParsedResponse;
  phase: CfdiUploadPhase;
  status: number | null;
  message: string;
  cause: unknown;
  retryable: boolean;
}

async function invokeOnce(
  file: File,
  categorias: { id: string; nombre: string }[],
  token: string,
  organizationId: string,
): Promise<Attempt> {
  const fd = new FormData();
  fd.append("file", file);
  fd.append("categorias", JSON.stringify(categorias));
  try {
    const { data, error } = await supabase.functions.invoke<CfdiParsedResponse>(
      "parse-invoice-pdf",
      {
        body: fd,
        headers: {
          Authorization: `Bearer ${token}`,
          "x-organization-id": organizationId,
        },
      },
    );
    if (error) {
      if (error instanceof FunctionsHttpError) {
        const m = await mapHttpError(error);
        // 401: el token pudo expirar mientras se subía el PDF; se reintenta con
        // sesión refrescada antes de rendirse.
        const retryable = m.status !== null && [401, 408, 429, 500, 502, 503, 504].includes(m.status);
        return { ok: false, phase: "response", status: m.status, message: m.message, cause: error, retryable };
      }
      if (error instanceof FunctionsRelayError) {
        return { ok: false, phase: "preflight", status: null, message: error.message || "Gateway bloqueó la llamada", cause: error, retryable: true };
      }
      if (error instanceof FunctionsFetchError) {
        return { ok: false, phase: "request", status: null, message: error.message || "No se pudo contactar al servidor", cause: error, retryable: true };
      }
      return { ok: false, phase: "request", status: null, message: (error as Error)?.message ?? "Error desconocido", cause: error, retryable: false };
    }
    if (!data) {
      return { ok: false, phase: "response", status: 200, message: "El servidor devolvió respuesta vacía", cause: null, retryable: false };
    }
    return { ok: true, data, phase: "response", status: 200, message: "", cause: null, retryable: false };
  } catch (err) {
    return { ok: false, phase: "request", status: null, message: (err as Error)?.message ?? "Error inesperado", cause: err, retryable: true };
  }
}

function buildFailure(file: File, last: Attempt | null, latencyMs: number): CfdiUploadError {
  const online = typeof navigator !== "undefined" ? navigator.onLine : true;
  const serviceUnavailable = last?.phase === "request" && last?.status === null;
  // 13.823.16 (Sentry -5T) · distinguir la red del dispositivo (móvil/tablet)
  // de una falla real del servicio: `FunctionsFetchError` / "Failed to fetch"
  // significa que la petición nunca llegó al servidor.
  const fallaDeRed =
    serviceUnavailable &&
    (last?.cause instanceof FunctionsFetchError ||
      /failed to fetch|network|load failed/i.test(last?.message ?? "") ||
      !online);
  const friendlyMessage = fallaDeRed
    ? "No pudimos contactar al servidor desde este dispositivo. Revisa tu conexión (Wi-Fi o datos) e intenta de nuevo, o usa el tab de \"Captura manual\"."
    : serviceUnavailable
    ? "El servicio de captura por IA no está disponible en este momento. Puedes usar el tab de \"Captura manual\" o intentar de nuevo en unos segundos."
    : (last?.message ?? "No se pudo procesar el PDF con IA");

  const err = new CfdiUploadError(
    friendlyMessage,
    {
      attemptCount: MAX_ATTEMPTS,
      latencyMs,
      online: typeof navigator !== "undefined" ? navigator.onLine : true,
      xmlSize: file.size,
      xmlName: file.name,
      lastStatus: last?.status ?? null,
      phase: last?.phase ?? "request",
      errorName: "PdfIaUploadError",
    },
    last?.cause ?? null,
  );
  reportCaughtError(err, {
    feature: "pdf_ia_upload",
    op: "parse_invoice_pdf",
    phase: err.context.phase,
    functionName: "parse-invoice-pdf",
  }, { pdf_size: file.size, latency_ms: latencyMs, service_unavailable: serviceUnavailable, ...err.context });
  return err;
}

async function invokeWithRetry(
  file: File,
  categorias: { id: string; nombre: string }[],
  organizationId: string,
): Promise<{ data: CfdiParsedResponse; latencyMs: number; attempts: number }> {
  const t0 = performance.now();
  let last: Attempt | null = null;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const token = await ensureFreshSession(attempt > 1);
    if (!token) throw new Error(AUTH_ERROR_MESSAGES.csfSessionRequired);
    const r = await invokeOnce(file, categorias, token, organizationId);
    if (r.ok && r.data) {
      return { data: r.data, latencyMs: Math.round(performance.now() - t0), attempts: attempt };
    }
    last = r;
    if (!r.retryable || attempt === MAX_ATTEMPTS) break;
    await new Promise<void>((res) => setTimeout(res, BACKOFF_MS));
  }
  throw buildFailure(file, last, Math.round(performance.now() - t0));
}


export async function parsePdfInvoice(
  file: File,
  categorias: { id: string; nombre: string }[],
  organizationId: string,
): Promise<CfdiParsedResponse> {
  Sentry.addBreadcrumb({
    category: "pdf_ia",
    message: "parse_invoice_pdf.start",
    level: "info",
    data: { pdf_size: file.size, pdf_name: file.name, categorias_count: categorias.length },
  });

  const { data, latencyMs, attempts } = await invokeWithRetry(file, categorias, organizationId);
  Sentry.addBreadcrumb({
    category: "pdf_ia",
    message: "parse_invoice_pdf.ok",
    level: "info",
    data: { latency_ms: latencyMs, attempts },
  });
  return data;
}
