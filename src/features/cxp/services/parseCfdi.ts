import * as Sentry from "@sentry/react";
import { supabase } from "@/integrations/supabase/client";
import { reportCaughtError } from "@/lib/observability/reportCaughtError";
import { AUTH_ERROR_MESSAGES } from "@/constants/authMessages";
import { invokeParseCfdiOnce, type InvokeAttemptFail } from "./parseCfdi.invoke";
import {
  CfdiUploadError,
  type CfdiParsedResponse,
  type CfdiUploadErrorContext,
  type CfdiUploadPhase,
} from "./parseCfdi.types";

// Re-exports para mantener la API pública estable (consumidores existentes
// importan `parseCfdiXml`, `CfdiUploadError` y los tipos desde este módulo).
export { CfdiUploadError };
export type {
  CfdiConceptoParsed,
  CfdiParsedResponse,
  
  
} from "./parseCfdi.types";

const MAX_ATTEMPTS = 3;
const BACKOFF_MS = [1000, 3000];
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

const PHASE_TITLE: Record<CfdiUploadPhase, (status: number | null) => string> = {
  preflight: () => "El navegador bloqueó la conexión",
  request: () => "No se pudo contactar parse-cfdi-xml",
  response: (s) => `parse-cfdi-xml respondió HTTP ${s ?? "?"}`,
};

function buildErrorContext(
  file: File,
  t0: number,
  attemptCount: number,
  last: InvokeAttemptFail | null,
): CfdiUploadErrorContext {
  return {
    attemptCount,
    latencyMs: Math.round(performance.now() - t0),
    online: typeof navigator !== "undefined" ? navigator.onLine : true,
    xmlSize: file.size,
    xmlName: file.name,
    lastStatus: last?.status ?? null,
    phase: last?.phase ?? "request",
    errorName: last?.errorName ?? "UnknownError",
  };
}

function buildErrorMessage(ctx: CfdiUploadErrorContext, innerMsg: string): string {
  const secs = (ctx.latencyMs / 1000).toFixed(1);
  const onlineLabel = ctx.online ? "online" : "offline";
  const head = PHASE_TITLE[ctx.phase](ctx.lastStatus);
  const summary = `${head} (${ctx.attemptCount} intento${ctx.attemptCount === 1 ? "" : "s"} · ${secs}s · ${onlineLabel})`;
  return innerMsg ? `${summary}: ${innerMsg}` : summary;
}

export async function parseCfdiXml(
  file: File,
  categorias: { id: string; nombre: string }[],
  organizationId: string,
): Promise<CfdiParsedResponse> {
  Sentry.addBreadcrumb({
    category: "cfdi",
    message: "parse_cfdi_xml.start",
    level: "info",
    data: { xml_size: file.size, xml_name: file.name, categorias_count: categorias.length },
  });

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
        const result = await invokeParseCfdiOnce(file, categorias, organizationId);
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

      const ctx = buildErrorContext(file, t0, attemptCount, last);
      const error = new CfdiUploadError(
        buildErrorMessage(ctx, last?.message ?? ""),
        ctx,
        last?.cause ?? null,
      );
      Sentry.addBreadcrumb({
        category: "cfdi",
        message: "parse_cfdi_xml.exhausted",
        level: "error",
        data: { attempt_count: attemptCount, phase: ctx.phase, errorName: ctx.errorName },
      });
      reportCaughtError(error, {
        feature: "cfdi_upload",
        op: "parse_cfdi_xml",
        phase: ctx.phase,
      }, { xml_size: file.size, latency_ms: ctx.latencyMs, ...ctx });
      throw error;
    },
  );
}
