/**
 * parse-cfdi-xml — Parsea un XML CFDI 4.0 mexicano y sugiere categoría via AI.
 *
 * Seguridad:
 *  - Requiere JWT válido + membresía de organización + rol de captura CxP y
 *    rate limit persistente (Ola P2, `_shared/cxpGuard.ts`): antes cualquier
 *    sesión autenticada — incluidos portal cliente y la cuenta demo — podía
 *    consumir la cuota de IA del servidor.
 *  - Rechaza no-XML, >2 MB (corte temprano por Content-Length), DOCTYPE (XXE),
 *    o CFDI != 4.0.
 *  - El string crudo de `categorias` tiene tope explícito ANTES de JSON.parse.
 *  - El parser es regex puro, sin DOM. La AI sólo recibe descripciones de
 *    conceptos + nombres de categorías para sugerir matcheo.
 */
import { handlePreflightStrict, buildCors } from "../_shared/cors.ts";
import { jsonResponse, errorResponse } from "../_shared/response.ts";
import { authenticate } from "../_shared/auth.ts";
import { autorizarCxp } from "../_shared/cxpGuard.ts";
import { createLogger } from "../_shared/logger.ts";
import { captureEdgeException, debeReportarStatus, wrapEdgeHandler } from "../_shared/sentry.ts";
import { parseCfdi } from "../_shared/cfdiParser.ts";
import {
  fallbackResult,
  parseCategoriasJson,
  parseToolCallResponse,
  type Categoria,
} from "./aiHelpers.ts";

// 13.114.5: `wrapEdgeHandler` reemplaza `initSentryEdge` + try/catch manual
// para que excepciones no controladas (cold start, CPU wall-limit) lleguen
// también a Sentry server-side, no sólo el "Failed to fetch" del browser.

const MAX_BYTES = 2 * 1024 * 1024;
/** Margen para el overhead del multipart (boundary + headers de la parte). */
const MAX_CONTENT_LENGTH = MAX_BYTES + 256 * 1024;
/**
 * Tope del string crudo de `categorias` ANTES de JSON.parse: 50 categorías
 * (el recorte que ya aplica `parseCategoriasJson`) con UUID + nombre largo
 * caben de sobra en 32 KiB.
 */
export const MAX_CATEGORIAS_CHARS = 32 * 1024;
/** Topes de uso de IA por usuario y por organización (ventana de 1 h). */
const RL_USUARIO = { windowSeconds: 3600, max: 40 } as const;
const RL_ORG = { windowSeconds: 3600, max: 200 } as const;


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
  // Sólo mandamos las primeras 30 descripciones al LLM: ya son suficientes
  // para sugerir categoría y evita inflar prompt/latencia en CFDIs con >30 líneas.
  const conceptosPrompt = conceptos.slice(0, 30);
  const prompt = `Categorías disponibles (id | nombre):\n${categorias.map(c => `${c.id} | ${c.nombre}`).join("\n")}\n\nConceptos de la factura:\n${conceptosPrompt.map(c => `- ${c.descripcion}`).join("\n")}\n\nElige el id de la categoría que mejor matchea. Si nada matchea claramente, devuelve cadena vacía en categoria_id.`;

  let status_code: number | null = null;
  let outcome: AiOutcome = "ok";
  let result: { categoria_id: string | null; notas: string };

  const controller = new AbortController();
  // 13.114.11: bajado a 2s. El AI es 100% opcional (hay fallbackResult),
  // pero su latencia bloqueaba la respuesta al browser sumándose al cold
  // start del edge function — combinación que disparaba "Failed to fetch"
  // en clientes con red marginal. A 2s la respuesta siempre llega bajo
  // ~3s aun con AI Gateway caído.
  const timeoutId = setTimeout(() => controller.abort(), 2000);
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

/**
 * Ola P2 · valida tamaño, tipo y catálogo del multipart antes de parsear.
 * Devuelve el archivo o la respuesta de error ya lista.
 */
async function validarEntrada(
  req: Request,
  cors: Record<string, string>,
): Promise<{ ok: true; file: File; categoriasJson: string | null } | { ok: false; res: Response }> {
  const contentLength = Number(req.headers.get("content-length") ?? "0");
  if (Number.isFinite(contentLength) && contentLength > MAX_CONTENT_LENGTH) {
    return { ok: false, res: errorResponse("El XML excede 2 MB", 413, cors) };
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return { ok: false, res: errorResponse("No se pudo leer el archivo enviado", 400, cors) };
  }
  const file = form.get("file") as File | null;
  const categoriasJson = form.get("categorias") as string | null;

  if (!file) return { ok: false, res: errorResponse("Falta archivo XML", 400, cors) };
  if (file.size > MAX_BYTES) return { ok: false, res: errorResponse("El XML excede 2 MB", 413, cors) };
  const isXml = file.type.includes("xml") || file.name.toLowerCase().endsWith(".xml");
  if (!isXml) return { ok: false, res: errorResponse("Solo se aceptan archivos XML", 400, cors) };

  if (categoriasJson && categoriasJson.length > MAX_CATEGORIAS_CHARS) {
    return {
      ok: false,
      res: errorResponse("El catálogo de categorías enviado es demasiado grande", 413, cors),
    };
  }
  return { ok: true, file, categoriasJson };
}

async function handle(req: Request, cors: Record<string, string>, log: ReturnType<typeof createLogger>) {
  const auth = await authenticate(req, log);
  const autorizacion = await autorizarCxp(auth, cors, log, {
    fn: "parse-cfdi-xml",
    rlUsuario: RL_USUARIO,
    rlOrg: RL_ORG,
    mensaje429: "Demasiadas solicitudes de parseo de XML. Intenta más tarde.",
  });
  if (!autorizacion.ok) return autorizacion.res;

  // @ts-expect-error Deno
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

  const entrada = await validarEntrada(req, cors);
  if (!entrada.ok) return entrada.res;
  const { file, categoriasJson } = entrada;

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

Deno.serve(wrapEdgeHandler("parse-cfdi-xml", async (req) => {
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
    // 13.114.20: capturar también 4xx inesperados (consistente con
    // user-management / auditoria-explicar-hallazgo desde 13.114.19).
    if (debeReportarStatus(status)) await captureEdgeException(e, { fn: "parse-cfdi-xml", status_code: status });
    return errorResponse(rest.join(":") || message, status, cors);
  }
}));
