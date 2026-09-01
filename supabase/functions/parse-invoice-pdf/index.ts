/**
 * parse-invoice-pdf — Extrae los campos de una factura en PDF usando Lovable AI (Gemini).
 *
 * Uso: facturas de proveedores internacionales que no envían XML CFDI.
 * Devuelve el MISMO shape que `parse-cfdi-xml` para que el frontend reutilice
 * el flujo de prellenado (`handleCfdiParsed`), con `uuid = ""` y RFC = tax_id
 * extranjero. La UI y el usuario siempre revisan antes de guardar.
 *
 * Seguridad (R2 · P1 — drenaje de cuota IA), ver `./guardas.ts`:
 *  - JWT válido + membresía de org + rol de captura CxP (ROLES_CAPTURA_CXP).
 *  - Rate limit persistente por usuario y por org (fail-CLOSED).
 *  - Tope de 10 MB: corte por `Content-Length` antes de parsear el multipart
 *    y revalidación con el tamaño real del archivo.
 */
import { buildCors, handlePreflightStrict } from "../_shared/cors.ts";
import { errorResponse, jsonResponse } from "../_shared/response.ts";
import { authenticate } from "../_shared/auth.ts";
import { createLogger } from "../_shared/logger.ts";
import {
  captureEdgeException,
  debeReportarStatus,
  wrapEdgeHandler,
} from "../_shared/sentry.ts";
import { autorizarYLimitar } from "./guardas.ts";
import {
  callGeminiExtract,
  type Categoria,
  mapGeminiToCfdiShape,
  parseCategoriasJson,
} from "./extract.ts";

const MAX_BYTES = 10 * 1024 * 1024;
// Margen para el overhead del multipart (boundary + headers de la parte).
const MAX_CONTENT_LENGTH = MAX_BYTES + 512 * 1024;

/**
 * Validación y lectura del PDF del multipart. Devuelve un `Response` de error
 * o el archivo ya convertido a base64. Extraído de `handle` para mantener la
 * complejidad ciclomática bajo el límite del lint.
 */
async function leerPdfDelRequest(
  req: Request,
  cors: Record<string, string>,
): Promise<
  Response | {
    file: File;
    base64: string;
    categoriasJson: string | null;
    organizationId: string;
  }
> {
  // Sentry JAVASCRIPT-REACT-57: sin `content-type: multipart/form-data`,
  // `req.formData()` lanza "Missing content type" y se reportaba como 500.
  const contentType = req.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("multipart/form-data")) {
    return errorResponse("Envía el PDF como multipart/form-data", 400, cors);
  }

  // R2 · P1: corte temprano por Content-Length ANTES de bufferar el multipart.
  const contentLength = Number(req.headers.get("content-length") ?? "0");
  if (Number.isFinite(contentLength) && contentLength > MAX_CONTENT_LENGTH) {
    return errorResponse("El PDF excede 10 MB", 413, cors);
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return errorResponse("No se pudo leer el archivo enviado", 400, cors);
  }
  const file = form.get("file") as File | null;
  const categoriasJson = form.get("categorias") as string | null;
  const organizationId = form.get("organization_id");

  if (!file) return errorResponse("Falta archivo PDF", 400, cors);
  if (typeof organizationId !== "string" || !organizationId) {
    return errorResponse("organization_id requerido", 400, cors);
  }
  if (file.size > MAX_BYTES) {
    return errorResponse("El PDF excede 10 MB", 413, cors);
  }
  const isPdf = file.type === "application/pdf" ||
    file.name.toLowerCase().endsWith(".pdf");
  if (!isPdf) return errorResponse("Solo se aceptan archivos PDF", 400, cors);

  const buf = new Uint8Array(await file.arrayBuffer());
  // Convertir a base64 sin explotar el stack en PDFs grandes.
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < buf.length; i += chunk) {
    bin += String.fromCharCode(...buf.subarray(i, i + chunk));
  }
  return { file, base64: btoa(bin), categoriasJson, organizationId };
}

async function handle(
  req: Request,
  cors: Record<string, string>,
  log: ReturnType<typeof createLogger>,
) {
  const auth = await authenticate(req, log);
  const leido = await leerPdfDelRequest(req, cors);
  if (leido instanceof Response) return leido;
  const rechazo = await autorizarYLimitar(
    auth,
    cors,
    log,
    leido.organizationId,
  );
  if (rechazo) return rechazo;

  // @ts-expect-error Deno
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) {
    return errorResponse("Falta LOVABLE_API_KEY en el servidor", 500, cors);
  }

  const { file, base64, categoriasJson } = leido;

  const categorias: Categoria[] = parseCategoriasJson(categoriasJson);

  const t0 = performance.now();
  let extracted;
  try {
    extracted = await callGeminiExtract({
      apiKey: LOVABLE_API_KEY,
      pdfBase64: base64,
      fileName: file.name,
      categorias,
    });
  } catch (e) {
    const err = e as { message?: string; status?: number };
    const status = err.status ?? 502;
    log.error("gemini_extract_failed", {
      status_code: status,
      payload: {
        event: "gemini_extract_failed",
        error: err.message ?? "unknown",
      },
    });
    return errorResponse(
      err.message ?? "La IA no pudo procesar el PDF",
      status,
      cors,
    );
  }
  const latency_ms = Math.round(performance.now() - t0);

  const response = mapGeminiToCfdiShape(extracted, categorias);
  log.finish(200, "pdf procesado por ia", {
    payload: {
      event: "pdf_ia_ok",
      latency_ms,
      pdf_size: file.size,
      line_items: response.cfdi.conceptos.length,
      currency: response.cfdi.moneda,
      categorias_count: categorias.length,
    },
  });
  return jsonResponse(response, 200, cors);
}

Deno.serve(wrapEdgeHandler("parse-invoice-pdf", async (req) => {
  const preflight = handlePreflightStrict(req);
  if (preflight) return preflight;
  const cors = buildCors(req);
  const log = createLogger(req, "parse-invoice-pdf");
  try {
    return await handle(req, cors, log);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Error desconocido";
    const [code, ...rest] = message.split(":");
    const status = /^\d+$/.test(code) ? parseInt(code) : 500;
    log.error("parse-invoice-pdf falló", {
      status_code: status,
      payload: { error: message },
    });
    if (debeReportarStatus(status)) {
      await captureEdgeException(e, {
        fn: "parse-invoice-pdf",
        status_code: status,
      });
    }
    return errorResponse(rest.join(":") || message, status, cors);
  }
}));
