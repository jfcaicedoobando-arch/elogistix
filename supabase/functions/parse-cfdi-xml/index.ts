/**
 * parse-cfdi-xml — Parsea un XML CFDI 4.0 mexicano y sugiere categoría via AI.
 *
 * Seguridad:
 *  - Requiere JWT válido.
 *  - Rechaza no-XML, >2 MB, DOCTYPE (XXE), o CFDI != 4.0.
 *  - El parser es regex puro, sin DOM. La AI sólo recibe descripciones de
 *    conceptos + nombres de categorías para sugerir matcheo.
 */
import { handlePreflightStrict, buildCors } from "../_shared/cors.ts";
import { jsonResponse, errorResponse } from "../_shared/response.ts";
import { authenticate } from "../_shared/auth.ts";
import { createLogger } from "../_shared/logger.ts";
import { captureEdgeException, wrapEdgeHandler } from "../_shared/sentry.ts";
import { parseCfdi } from "./parser.ts";
import {
  fallbackResult,
  parseCategoriasJson,
  parseToolCallResponse,
  type Categoria,
} from "./aiHelpers.ts";

initSentryEdge("parse-cfdi-xml");

const MAX_BYTES = 2 * 1024 * 1024;

const TOOL_DEF = {
  type: "function",
  function: {
    name: "sugerir",
    description: "Sugiere la categoría que mejor matchea los conceptos",
    parameters: {
      type: "object",
      properties: {
        categoria_id: { type: "string", description: "ID exacto de la categoría más adecuada, o vacío" },
        notas: { type: "string", description: "Resumen breve (máx 200 chars) de los conceptos" },
      },
      required: ["categoria_id", "notas"],
      additionalProperties: false,
    },
  },
};

type AiOutcome = "ok" | "http_error" | "timeout" | "network_error" | "parse_error" | "skipped";

interface AiCallResult {
  result: { categoria_id: string | null; notas: string };
  outcome: AiOutcome;
  latency_ms: number;
  status_code: number | null;
}

async function sugerirCategoria(
  apiKey: string,
  conceptos: { descripcion: string }[],
  categorias: Categoria[],
  log: ReturnType<typeof createLogger>,
): Promise<AiCallResult> {
  const t0 = performance.now();
  if (categorias.length === 0 || conceptos.length === 0) {
    return { result: fallbackResult(conceptos), outcome: "skipped", latency_ms: 0, status_code: null };
  }
  const prompt = `Categorías disponibles (id | nombre):\n${categorias.map(c => `${c.id} | ${c.nombre}`).join("\n")}\n\nConceptos de la factura:\n${conceptos.map(c => `- ${c.descripcion}`).join("\n")}\n\nElige el id de la categoría que mejor matchea. Si nada matchea claramente, devuelve cadena vacía en categoria_id.`;

  let status_code: number | null = null;
  let outcome: AiOutcome = "ok";
  let result: { categoria_id: string | null; notas: string };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          { role: "system", content: "Eres un asistente contable mexicano. Responde sólo vía tool call." },
          { role: "user", content: prompt },
        ],
        tools: [TOOL_DEF],
        tool_choice: { type: "function", function: { name: "sugerir" } },
      }),
    });
    status_code = res.status;
    if (!res.ok) {
      outcome = "http_error";
      result = { categoria_id: null, notas: conceptos[0]?.descripcion?.slice(0, 200) ?? "" };
    } else {
      const parsed = parseToolCallResponse(await res.json(), categorias);
      if (!parsed) {
        outcome = "parse_error";
        result = { categoria_id: null, notas: "" };
      } else {
        result = parsed;
      }
    }
  } catch (e) {
    const name = e instanceof Error ? e.name : "";
    outcome = name === "AbortError" ? "timeout" : "network_error";
    result = outcome === "timeout"
      ? fallbackResult(conceptos)
      : { categoria_id: null, notas: "" };
  } finally {
    clearTimeout(timeoutId);
  }

  const latency_ms = Math.round(performance.now() - t0);
  const logFn = outcome === "ok" || outcome === "skipped" ? log.info : log.warn;
  logFn("ai_gateway_call", {
    status_code,
    latency_ms,
    payload: {
      event: "ai_gateway_call",
      model: "google/gemini-2.5-flash-lite",
      outcome,
      conceptos_count: conceptos.length,
      categorias_count: categorias.length,
    },
  });
  return { result, outcome, latency_ms, status_code };
}

async function handle(req: Request, cors: HeadersInit, log: ReturnType<typeof createLogger>) {
  await authenticate(req);
  // @ts-expect-error Deno
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

  const form = await req.formData();
  const file = form.get("file") as File | null;
  const categoriasJson = form.get("categorias") as string | null;

  if (!file) return errorResponse("Falta archivo XML", 400, cors);
  if (file.size > MAX_BYTES) return errorResponse("El XML excede 2 MB", 413, cors);
  const isXml = file.type.includes("xml") || file.name.toLowerCase().endsWith(".xml");
  if (!isXml) return errorResponse("Solo se aceptan archivos XML", 400, cors);

  const text = await file.text();
  let cfdi;
  try {
    cfdi = parseCfdi(text);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "XML inválido";
    return errorResponse(msg, 400, cors);
  }

  const categorias: Categoria[] = parseCategoriasJson(categoriasJson);

  let aiResult: AiCallResult;
  if (LOVABLE_API_KEY) {
    aiResult = await sugerirCategoria(LOVABLE_API_KEY, cfdi.conceptos, categorias, log);
  } else {
    aiResult = {
      result: { categoria_id: null, notas: cfdi.conceptos[0]?.descripcion?.slice(0, 200) ?? "" },
      outcome: "skipped",
      latency_ms: 0,
      status_code: null,
    };
  }

  log.finish(200, "cfdi parseado", {
    payload: { ai_outcome: aiResult.outcome, ai_latency_ms: aiResult.latency_ms },
  });
  return jsonResponse({ cfdi, ai: aiResult.result }, 200, cors);
}

serve(async (req) => {
  const preflight = handlePreflightStrict(req);
  if (preflight) return preflight;
  const cors = buildCors(req);
  const log = createLogger(req, "parse-cfdi-xml");
  try {
    return await handle(req, cors, log);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Error desconocido";
    const [code, ...rest] = message.split(":");
    const status = /^\d+$/.test(code) ? parseInt(code) : 500;
    log.error("parse-cfdi-xml falló", { status_code: status, payload: { error: message } });
    if (status >= 500) await captureEdgeException(e, { fn: "parse-cfdi-xml", status_code: status });
    return errorResponse(rest.join(":") || message, status, cors);
  }
});
