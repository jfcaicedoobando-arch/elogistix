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

  let attemptCount = 0;
  const res = await fetchWithRetry(
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
  ).catch((err) => {
    // 13.114.5: breadcrumb final con cuántos intentos se agotaron antes de
    // que el último throw llegue al captureException superior. Sin esto no
    // distinguimos "falló al primer intento" vs "fallaron los 3".
    Sentry.addBreadcrumb({
      category: "cfdi",
      message: "parse_cfdi_xml.exhausted",
      level: "error",
      data: { attempt_count: attemptCount },
    });
    throw err;
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Error al procesar el XML" }));
    throw new Error(err.error || "Error al procesar el XML");
  }
  return res.json();
}
