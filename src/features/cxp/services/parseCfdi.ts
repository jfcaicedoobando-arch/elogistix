import * as Sentry from "@sentry/react";
import {
  FunctionsHttpError,
  FunctionsRelayError,
  FunctionsFetchError,
} from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { AUTH_ERROR_MESSAGES } from "@/constants/authMessages";

export interface CfdiConceptoParsed {
  descripcion: string;
  importe: number;
}

export interface CfdiParsedResponse {
  cfdi: {
    uuid: string;
    serie: string;
    folio: string;
    fecha: string;
    moneda: string;
    tipo_cambio: number;
    subtotal: number;
    total: number;
    iva_trasladado: number;
    retenciones: number;
    emisor: { rfc: string; nombre: string; regimen: string };
    receptor: { rfc: string; nombre: string };
    conceptos: CfdiConceptoParsed[];
  };
  ai: { categoria_id: string | null; notas: string };
}

/**
 * 13.114.11: ampliamos el contexto del error con `phase` y `errorName` para
 * que el toast (y el reporte copiable) pueda decir si la falla fue
 *  - `preflight`  → CORS u origen no permitido (no llegó al gateway)
 *  - `request`   → red caída / DNS / TypeError "Failed to fetch"
 *  - `response`  → gateway respondió pero con status no-OK
 */
export type CfdiUploadPhase = "preflight" | "request" | "response";

export interface CfdiUploadErrorContext {
  attemptCount: number;
  latencyMs: number;
  online: boolean;
  xmlSize: number;
  xmlName: string;
  lastStatus: number | null;
  phase: CfdiUploadPhase;
  errorName: string;
}

export class CfdiUploadError extends Error {
  readonly context: CfdiUploadErrorContext;
  constructor(message: string, context: CfdiUploadErrorContext, cause: unknown) {
    super(message);
    this.name = "CfdiUploadError";
    this.context = context;
    (this as Error & { cause?: unknown }).cause = cause;
  }
}

const MAX_ATTEMPTS = 3;
const BACKOFF_MS = [1000, 3000];
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

interface InvokeAttemptOk {
  ok: true;
  data: CfdiParsedResponse;
}
interface InvokeAttemptFail {
  ok: false;
  retryable: boolean;
  phase: CfdiUploadPhase;
  errorName: string;
  status: number | null;
  message: string;
  cause: unknown;
}
type InvokeAttempt = InvokeAttemptOk | InvokeAttemptFail;

async function invokeOnce(
  file: File,
  categorias: { id: string; nombre: string }[],
): Promise<InvokeAttempt> {
  // FormData fresco por intento: el body se consume al enviar.
  const formData = new FormData();
  formData.append("file", file);
  formData.append("categorias", JSON.stringify(categorias));

  try {
    const { data, error } = await supabase.functions.invoke<CfdiParsedResponse>(
      "parse-cfdi-xml",
      { body: formData },
    );
    if (error) {
      // FunctionsHttpError → respuesta HTTP no-OK (rara vez retryable)
      if (error instanceof FunctionsHttpError) {
        const ctx = error.context as Response | undefined;
        const status = ctx?.status ?? null;
        let serverMsg = `parse-cfdi-xml respondió HTTP ${status ?? "?"}`;
        try {
          const body = await ctx?.clone().json();
          if (body?.error) serverMsg = body.error;
        } catch {
          /* body no-JSON: usar mensaje genérico */
        }
        const retryable = status !== null && [408, 429, 500, 502, 503, 504].includes(status);
        return {
          ok: false,
          retryable,
          phase: "response",
          errorName: "FunctionsHttpError",
          status,
          message: serverMsg,
          cause: error,
        };
      }
      // FunctionsRelayError → CORS / preflight bloqueado por el gateway
      if (error instanceof FunctionsRelayError) {
        return {
          ok: false,
          retryable: true,
          phase: "preflight",
          errorName: "FunctionsRelayError",
          status: null,
          message: error.message || "Gateway bloqueó la llamada",
          cause: error,
        };
      }
      // FunctionsFetchError → red caída / DNS / TypeError "Failed to fetch"
      if (error instanceof FunctionsFetchError) {
        return {
          ok: false,
          retryable: true,
          phase: "request",
          errorName: "FunctionsFetchError",
          status: null,
          message: error.message || "No se pudo contactar el servidor",
          cause: error,
        };
      }
      // Error desconocido
      const name = (error as Error)?.name ?? "UnknownError";
      const msg = (error as Error)?.message ?? "Error desconocido al invocar la función";
      return {
        ok: false,
        retryable: true,
        phase: "request",
        errorName: name,
        status: null,
        message: msg,
        cause: error,
      };
    }
    if (!data) {
      return {
        ok: false,
        retryable: false,
        phase: "response",
        errorName: "EmptyResponse",
        status: 200,
        message: "El servidor devolvió respuesta vacía",
        cause: null,
      };
    }
    return { ok: true, data };
  } catch (err) {
    // El SDK normalmente envuelve los errores en `error`. Por defensa,
    // capturamos cualquier throw inesperado.
    const name = err instanceof Error ? err.name : "UnknownError";
    const msg = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      retryable: true,
      phase: "request",
      errorName: name,
      status: null,
      message: msg,
      cause: err,
    };
  }
}

export async function parseCfdiXml(
  file: File,
  categorias: { id: string; nombre: string }[],
): Promise<CfdiParsedResponse> {
  Sentry.addBreadcrumb({
    category: "cfdi",
    message: "parse_cfdi_xml.start",
    level: "info",
    data: { xml_size: file.size, xml_name: file.name, categorias_count: categorias.length },
  });

  // Validación de sesión temprana — mismo comportamiento que antes.
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) {
    throw new Error(AUTH_ERROR_MESSAGES.csfSessionRequired);
  }

  return Sentry.startSpan(
    { name: "parse-cfdi-xml", op: "http.client" },
    async () => {
      const t0 = performance.now();
      let attemptCount = 0;
      let last: InvokeAttemptFail | null = null;

      for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
        attemptCount = attempt;
        const result = await invokeOnce(file, categorias);
        if (result.ok) {
          Sentry.addBreadcrumb({
            category: "cfdi",
            message: "parse_cfdi_xml.ok",
            level: "info",
            data: { latency_ms: Math.round(performance.now() - t0), attempts: attempt },
          });
          return result.data;
        }
        last = result;
        if (!result.retryable || attempt === MAX_ATTEMPTS) break;
        Sentry.addBreadcrumb({
          category: "cfdi",
          message: "parse_cfdi_xml.retry",
          level: "warning",
          data: { attempt, phase: result.phase, errorName: result.errorName },
        });
        await sleep(BACKOFF_MS[attempt - 1] ?? 1000);
      }

      // Falló — construir CfdiUploadError con todo el contexto
      const ctx: CfdiUploadErrorContext = {
        attemptCount,
        latencyMs: Math.round(performance.now() - t0),
        online: typeof navigator !== "undefined" ? navigator.onLine : true,
        xmlSize: file.size,
        xmlName: file.name,
        lastStatus: last?.status ?? null,
        phase: last?.phase ?? "request",
        errorName: last?.errorName ?? "UnknownError",
      };
      const secs = (ctx.latencyMs / 1000).toFixed(1);
      const onlineLabel = ctx.online ? "online" : "offline";
      const phaseLabel: Record<CfdiUploadPhase, string> = {
        preflight: "El navegador bloqueó la conexión",
        request: "No se pudo contactar parse-cfdi-xml",
        response: `parse-cfdi-xml respondió HTTP ${ctx.lastStatus ?? "?"}`,
      };
      const summary = `${phaseLabel[ctx.phase]} (${ctx.attemptCount} intento${ctx.attemptCount === 1 ? "" : "s"} · ${secs}s · ${onlineLabel})`;
      const inner = last?.message ?? "";
      const finalMsg = inner ? `${summary}: ${inner}` : summary;

      const error = new CfdiUploadError(finalMsg, ctx, last?.cause ?? null);
      Sentry.addBreadcrumb({
        category: "cfdi",
        message: "parse_cfdi_xml.exhausted",
        level: "error",
        data: { attempt_count: attemptCount, phase: ctx.phase, errorName: ctx.errorName },
      });
      Sentry.captureException(error, {
        tags: { feature: "cfdi_upload", phase: ctx.phase },
        contexts: { cfdi: { xml_size: file.size, latency_ms: ctx.latencyMs, ...ctx } },
      });
      throw error;
    },
  );
}
