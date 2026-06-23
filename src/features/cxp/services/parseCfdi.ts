import * as Sentry from "@sentry/react";
import { supabase } from "@/integrations/supabase/client";
import { AUTH_ERROR_MESSAGES } from "@/constants/authMessages";
import { fetchWithRetry } from "@/lib/net/fetchWithRetry";

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
 * Error envolvente para fallas de subida de CFDI. Preserva el error original
 * en `cause` para que `extractErrorDetails` pueda mostrar el `TypeError`
 * interno (`Failed to fetch`, AbortError, etc.) y agrega un `context`
 * estructurado que el reporter expone tal cual al copiar el reporte.
 *
 * Por qué existe: antes de 13.114.9 los reportes llegaban con
 * `errorDetails: {}` y `errorCode: "UNKNOWN"`, sin manera de saber si fue
 * la red del usuario, el edge function o CORS. Ahora cada error de carga
 * trae intento agotado, latencia total, navegador online/offline y, si la
 * respuesta HTTP fue mala, el último status.
 */
export interface CfdiUploadErrorContext {
  attemptCount: number;
  latencyMs: number;
  online: boolean;
  xmlSize: number;
  xmlName: string;
  lastStatus: number | null;
}

export class CfdiUploadError extends Error {
  readonly context: CfdiUploadErrorContext;
  constructor(message: string, context: CfdiUploadErrorContext, cause: unknown) {
    super(message);
    this.name = "CfdiUploadError";
    this.context = context;
    // `cause` está en ES2022 pero TS strict no lo expone en el ctor.
    (this as Error & { cause?: unknown }).cause = cause;
  }
}

export async function parseCfdiXml(
  file: File,
  categorias: { id: string; nombre: string }[],
): Promise<CfdiParsedResponse> {
  // Instrumentación Sentry (12.77.11): breadcrumbs + span + captureException
  // para detectar cuándo la edge function `parse-cfdi-xml` se cuelga, hace
  // timeout o falla en el AI Gateway. NO se envía contenido del CFDI a Sentry,
  // sólo metadatos (tamaño, latencia, outcome).
  Sentry.addBreadcrumb({
    category: "cfdi",
    message: "parse_cfdi_xml.start",
    level: "info",
    data: { xml_size: file.size, xml_name: file.name, categorias_count: categorias.length },
  });

  return Sentry.startSpan(
    { name: "parse-cfdi-xml", op: "http.client" },
    async () => {
      const t0 = performance.now();
      try {
        const result = await callEdgeFunction(file, categorias);
        Sentry.addBreadcrumb({
          category: "cfdi",
          message: "parse_cfdi_xml.ok",
          level: "info",
          data: { latency_ms: Math.round(performance.now() - t0) },
        });
        return result;
      } catch (err) {
        const latency_ms = Math.round(performance.now() - t0);
        const message = err instanceof Error ? err.message : String(err);
        Sentry.addBreadcrumb({
          category: "cfdi",
          message: "parse_cfdi_xml.error",
          level: "error",
          data: { latency_ms, message },
        });
        Sentry.captureException(err, {
          tags: { feature: "cfdi_upload" },
          contexts: { cfdi: { xml_size: file.size, latency_ms } },
        });
        throw err;
      }
    },
  );
}

async function callEdgeFunction(
  file: File,
  categorias: { id: string; nombre: string }[],
): Promise<CfdiParsedResponse> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) {
    throw new Error(AUTH_ERROR_MESSAGES.csfSessionRequired);
  }

  const t0 = performance.now();
  let attemptCount = 0;
  let lastStatus: number | null = null;

  const buildContext = (): CfdiUploadErrorContext => ({
    attemptCount,
    latencyMs: Math.round(performance.now() - t0),
    online: typeof navigator !== "undefined" ? navigator.onLine : true,
    xmlSize: file.size,
    xmlName: file.name,
    lastStatus,
  });

  const wrap = (cause: unknown, baseMsg: string): CfdiUploadError => {
    const ctx = buildContext();
    const secs = (ctx.latencyMs / 1000).toFixed(1);
    const onlineLabel = ctx.online ? "online" : "offline";
    const summary = `${baseMsg} (${ctx.attemptCount} intento${ctx.attemptCount === 1 ? "" : "s"} · ${secs}s · ${onlineLabel})`;
    const inner = cause instanceof Error ? cause.message : String(cause ?? "");
    return new CfdiUploadError(inner ? `${summary}: ${inner}` : summary, ctx, cause);
  };

  let res: Response;
  try {
    res = await fetchWithRetry(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/parse-cfdi-xml`,
      () => {
        attemptCount += 1;
        const formData = new FormData();
        formData.append("file", file);
        formData.append("categorias", JSON.stringify(categorias));
        return {
          method: "POST",
          headers: { Authorization: `Bearer ${session.access_token}` },
          body: formData,
        };
      },
      {
        onRetry: ({ attempt, reason }) => {
          Sentry.addBreadcrumb({
            category: "cfdi",
            message: "parse_cfdi_xml.retry",
            level: "warning",
            data: { attempt, reason },
          });
        },
      },
    );
  } catch (err) {
    // 13.114.5: breadcrumb final con cuántos intentos se agotaron antes de
    // que el último throw llegue al captureException superior.
    Sentry.addBreadcrumb({
      category: "cfdi",
      message: "parse_cfdi_xml.exhausted",
      level: "error",
      data: { attempt_count: attemptCount },
    });
    throw wrap(err, "No se pudo contactar parse-cfdi-xml");
  }

  if (!res.ok) {
    lastStatus = res.status;
    const errBody = await res.json().catch(() => ({ error: "Error al procesar el XML" }));
    const serverMsg = errBody.error || "Error al procesar el XML";
    throw wrap(new Error(serverMsg), `parse-cfdi-xml respondió HTTP ${res.status}`);
  }
  return res.json();
}
