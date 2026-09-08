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
import { ensureFreshSession } from "@/lib/auth/ensureFreshSession";
import type { CfdiParsedResponse } from "./parseCfdi.types";
import {
  MAX_ATTEMPTS,
  BACKOFF_MS,
  type Attempt,
  mapHttpError,
  buildFailure,
} from "./parsePdfInvoice.errors";

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

async function invokeWithRetry(
  file: File,
  categorias: { id: string; nombre: string }[],
  organizationId: string,
): Promise<{ data: CfdiParsedResponse; latencyMs: number; attempts: number }> {
  const t0 = performance.now();
  let last: Attempt | null = null;
  let tokenAnterior: string | undefined;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    // R192-01: el primer envío usa la credencial vigente que ya tiene la app.
    // Forzar una renovación aquí hacía fallar el envío de usuarios con sesión
    // válida (rotación concurrente, 429 o lentitud del servidor de sesiones).
    // Sólo un 401 exige renovar. Una falla de red, 429 o 5xx conserva la
    // credencial vigente para no provocar una rotación adicional innecesaria.
    const forzar = attempt > 1 && last?.status === 401;
    const token = await ensureFreshSession(forzar, forzar ? tokenAnterior : undefined);
    if (!token) {
      throw new Error(
        forzar
          ? AUTH_ERROR_MESSAGES.sessionRefreshFailed
          : AUTH_ERROR_MESSAGES.sessionRequired("procesar la factura PDF"),
      );
    }
    tokenAnterior = token;
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
