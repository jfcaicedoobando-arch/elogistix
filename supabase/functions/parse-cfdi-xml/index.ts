/**
 * parse-cfdi-xml — Parsea un XML CFDI 4.0 mexicano y sugiere categoría via AI.
 *
 * Seguridad:
 *  - Requiere JWT válido.
 *  - Rechaza no-XML, >2 MB, DOCTYPE (XXE), o CFDI != 4.0.
 *  - El parser es regex puro, sin DOM. La AI sólo recibe descripciones de
 *    conceptos + nombres de categorías para sugerir matcheo.
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { handlePreflightStrict, buildCors } from "../_shared/cors.ts";
import { jsonResponse, errorResponse } from "../_shared/response.ts";
import { authenticate } from "../_shared/auth.ts";
import { createLogger } from "../_shared/logger.ts";
import { parseCfdi } from "./parser.ts";

const MAX_BYTES = 2 * 1024 * 1024;

interface Categoria { id: string; nombre: string }

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

function fallbackResult(conceptos: { descripcion: string }[]): { categoria_id: string | null; notas: string } {
  return {
    categoria_id: null,
    notas: conceptos.map(c => c.descripcion).join("; ").slice(0, 240),
  };
}

function parseToolCallResponse(j: unknown, categorias: Categoria[]): { categoria_id: string | null; notas: string } | null {
  const args = (j as { choices?: Array<{ message?: { tool_calls?: Array<{ function?: { arguments?: string } }> } }> })
    .choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
  if (!args) return null;
  try {
    const parsed = JSON.parse(args);
    const id = String(parsed.categoria_id ?? "").trim();
    const valid = categorias.some(c => c.id === id);
    return { categoria_id: valid ? id : null, notas: String(parsed.notas ?? "").slice(0, 240) };
  } catch {
    return null;
  }
}

async function sugerirCategoria(
  apiKey: string,
  conceptos: { descripcion: string }[],
  categorias: Categoria[],
): Promise<{ categoria_id: string | null; notas: string }> {
  if (categorias.length === 0 || conceptos.length === 0) {
    return fallbackResult(conceptos);
  }
  const prompt = `Categorías disponibles (id | nombre):\n${categorias.map(c => `${c.id} | ${c.nombre}`).join("\n")}\n\nConceptos de la factura:\n${conceptos.map(c => `- ${c.descripcion}`).join("\n")}\n\nElige el id de la categoría que mejor matchea. Si nada matchea claramente, devuelve cadena vacía en categoria_id.`;

  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
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
    if (!res.ok) {
      return { categoria_id: null, notas: conceptos[0]?.descripcion?.slice(0, 200) ?? "" };
    }
    const parsed = parseToolCallResponse(await res.json(), categorias);
    return parsed ?? { categoria_id: null, notas: "" };
  } catch {
    return { categoria_id: null, notas: "" };
  }
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

  let categorias: Categoria[] = [];
  if (categoriasJson) {
    try {
      const arr = JSON.parse(categoriasJson);
      if (Array.isArray(arr)) {
        categorias = arr
          .filter((c) => c && typeof c.id === "string" && typeof c.nombre === "string")
          .slice(0, 50);
      }
    } catch { /* ignore */ }
  }

  const ai = LOVABLE_API_KEY
    ? await sugerirCategoria(LOVABLE_API_KEY, cfdi.conceptos, categorias)
    : { categoria_id: null, notas: cfdi.conceptos[0]?.descripcion?.slice(0, 200) ?? "" };

  log.finish(200, "cfdi parseado");
  return jsonResponse({ cfdi, ai }, 200, cors);
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
    return errorResponse(rest.join(":") || message, status, cors);
  }
});
