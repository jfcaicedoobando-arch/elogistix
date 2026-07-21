/**
 * Cliente para invocar la edge function `parse-invoice-pdf`, que extrae los
 * campos de una factura PDF de proveedor internacional usando IA (Gemini).
 *
 * Devuelve el mismo shape `CfdiParsedResponse` que `parse-cfdi-xml`, así el
 * frontend reutiliza `handleCfdiParsed` para prellenar el formulario.
 */
import * as Sentry from "@sentry/react";
import {
  FunctionsHttpError,
  FunctionsRelayError,
  FunctionsFetchError,
} from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { AUTH_ERROR_MESSAGES } from "@/constants/authMessages";
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

async function invokeOnce(file: File, categorias: { id: string; nombre: string }[]): Promise<Attempt> {
  const fd = new FormData();
  fd.append("file", file);
  fd.append("categorias", JSON.stringify(categorias));
  try {
    const { data, error } = await supabase.functions.invoke<CfdiParsedResponse>(
      "parse-invoice-pdf",
      { body: fd },
    );
    if (error) {
      if (error instanceof FunctionsHttpError) {
        const m = await mapHttpError(error);
        const retryable = m.status !== null && [408, 429, 500, 502, 503, 504].includes(m.status);
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

async function invokeWithRetry(
  file: File,
  categorias: { id: string; nombre: string }[],
): Promise<{ data: CfdiParsedResponse; latencyMs: number; attempts: number }> {
  const t0 = performance.now();
  let last: Attempt | null = null;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const r = await invokeOnce(file, categorias);
    if (r.ok && r.data) {
      return { data: r.data, latencyMs: Math.round(performance.now() - t0), attempts: attempt };
    }
    last = r;
    if (!r.retryable || attempt === MAX_ATTEMPTS) break;
    await new Promise<void>((res) => setTimeout(res, BACKOFF_MS));
  }
  const latencyMs = Math.round(performance.now() - t0);
  const err = new CfdiUploadError(
    last?.message ?? "No se pudo procesar el PDF con IA",
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
  Sentry.captureException(err, {
    tags: { feature: "pdf_ia_upload", phase: err.context.phase },
    contexts: { pdf_ia: { pdf_size: file.size, latency_ms: latencyMs, ...err.context } },
  });
  throw err;
}

export async function parsePdfInvoice(
  file: File,
  categorias: { id: string; nombre: string }[],
): Promise<CfdiParsedResponse> {
  Sentry.addBreadcrumb({
    category: "pdf_ia",
    message: "parse_invoice_pdf.start",
    level: "info",
    data: { pdf_size: file.size, pdf_name: file.name, categorias_count: categorias.length },
  });

  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) {
    throw new Error(AUTH_ERROR_MESSAGES.csfSessionRequired);
  }

  const { data, latencyMs, attempts } = await invokeWithRetry(file, categorias);
  Sentry.addBreadcrumb({
    category: "pdf_ia",
    message: "parse_invoice_pdf.ok",
    level: "info",
    data: { latency_ms: latencyMs, attempts },
  });
  return data;
}
