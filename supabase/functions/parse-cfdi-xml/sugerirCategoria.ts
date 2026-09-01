/**
 * Llamada opcional al AI Gateway para sugerir categoría de un CFDI.
 * Extraído de index.ts (v13.823.13) para respetar el tope de 250 líneas por
 * archivo; el contrato y los tiempos de espera no cambian.
 */
import { createLogger } from "../_shared/logger.ts";
import { type Categoria, fallbackResult, parseToolCallResponse } from "./aiHelpers.ts";

const TOOL_DEF = {
  type: "function",
  function: {
    name: "sugerir",
    description: "Sugiere la categoría que mejor matchea los conceptos",
    parameters: {
      type: "object",
      properties: {
        categoria_id: {
          type: "string",
          description: "ID exacto de la categoría más adecuada, o vacío",
        },
        notas: {
          type: "string",
          description: "Resumen breve (máx 200 chars) de los conceptos",
        },
      },
      required: ["categoria_id", "notas"],
      additionalProperties: false,
    },
  },
};

export type AiOutcome =
  | "ok"
  | "http_error"
  | "timeout"
  | "network_error"
  | "parse_error"
  | "skipped";

export interface AiCallResult {
  result: { categoria_id: string | null; notas: string };
  outcome: AiOutcome;
  latency_ms: number;
  status_code: number | null;
}

export async function sugerirCategoria(
  apiKey: string,
  conceptos: { descripcion: string }[],
  categorias: Categoria[],
  log: ReturnType<typeof createLogger>,
): Promise<AiCallResult> {
  const t0 = performance.now();
  if (categorias.length === 0 || conceptos.length === 0) {
    return {
      result: fallbackResult(conceptos),
      outcome: "skipped",
      latency_ms: 0,
      status_code: null,
    };
  }
  // Sólo mandamos las primeras 30 descripciones al LLM: ya son suficientes
  // para sugerir categoría y evita inflar prompt/latencia en CFDIs con >30 líneas.
  const conceptosPrompt = conceptos.slice(0, 30);
  const prompt = `Categorías disponibles (id | nombre):\n${
    categorias.map((c) => `${c.id} | ${c.nombre}`).join("\n")
  }\n\nConceptos de la factura:\n${
    conceptosPrompt.map((c) => `- ${c.descripcion}`).join("\n")
  }\n\nElige el id de la categoría que mejor matchea. Si nada matchea claramente, devuelve cadena vacía en categoria_id.`;

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
    const res = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        signal: controller.signal,
        body: JSON.stringify({
          model: "google/gemini-2.5-flash-lite",
          messages: [
            {
              role: "system",
              content:
                "Eres un asistente contable mexicano. Responde sólo vía tool call.",
            },
            { role: "user", content: prompt },
          ],
          tools: [TOOL_DEF],
          tool_choice: { type: "function", function: { name: "sugerir" } },
        }),
      },
    );
    status_code = res.status;
    if (!res.ok) {
      outcome = "http_error";
      result = {
        categoria_id: null,
        notas: conceptos[0]?.descripcion?.slice(0, 200) ?? "",
      };
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
  const logFn = outcome === "ok" ? log.info : log.warn;
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
