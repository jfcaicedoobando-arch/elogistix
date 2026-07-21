/**
 * parse-invoice-pdf — Extrae los campos de una factura en PDF usando Lovable AI (Gemini).
 *
 * Uso: facturas de proveedores internacionales que no envían XML CFDI.
 * Devuelve el MISMO shape que `parse-cfdi-xml` para que el frontend reutilice
 * el flujo de prellenado (`handleCfdiParsed`), con `uuid = ""` y RFC = tax_id
 * extranjero. La UI y el usuario siempre revisan antes de guardar.
 */
import { handlePreflightStrict, buildCors } from "../_shared/cors.ts";
import { jsonResponse, errorResponse } from "../_shared/response.ts";
import { authenticate } from "../_shared/auth.ts";
import { createLogger } from "../_shared/logger.ts";
import { captureEdgeException, wrapEdgeHandler } from "../_shared/sentry.ts";
import {
  callGeminiExtract,
  mapGeminiToCfdiShape,
  parseCategoriasJson,
  type Categoria,
} from "./extract.ts";

const MAX_BYTES = 10 * 1024 * 1024;

async function handle(req: Request, cors: HeadersInit, log: ReturnType<typeof createLogger>) {
  await authenticate(req);
  // @ts-expect-error Deno
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) return errorResponse("Falta LOVABLE_API_KEY en el servidor", 500, cors);

  const form = await req.formData();
  const file = form.get("file") as File | null;
  const categoriasJson = form.get("categorias") as string | null;

  if (!file) return errorResponse("Falta archivo PDF", 400, cors);
  if (file.size > MAX_BYTES) return errorResponse("El PDF excede 10 MB", 413, cors);
  const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
  if (!isPdf) return errorResponse("Solo se aceptan archivos PDF", 400, cors);

  const buf = new Uint8Array(await file.arrayBuffer());
  // Convertir a base64 sin explotar el stack en PDFs grandes.
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < buf.length; i += chunk) {
    bin += String.fromCharCode(...buf.subarray(i, i + chunk));
  }
  const base64 = btoa(bin);

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
      payload: { event: "gemini_extract_failed", error: err.message ?? "unknown" },
    });
    return errorResponse(err.message ?? "La IA no pudo procesar el PDF", status, cors);
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
    log.error("parse-invoice-pdf falló", { status_code: status, payload: { error: message } });
    if (status >= 400) await captureEdgeException(e, { fn: "parse-invoice-pdf", status_code: status });
    return errorResponse(rest.join(":") || message, status, cors);
  }
}));
