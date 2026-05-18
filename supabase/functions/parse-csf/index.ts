/**
 * parse-csf — Extrae datos fiscales de una Constancia de Situación Fiscal (PDF).
 *
 * Seguridad:
 *  - Requiere JWT válido (`authenticate`) para evitar abuso de créditos AI por
 *    usuarios anónimos.
 *  - Valida `file.type === 'application/pdf'` y un tamaño máximo de 5 MB antes
 *    de reenviar al gateway.
 *  - El archivo se reenvía como base64 al Lovable AI Gateway (Gemini) y se
 *    recibe JSON estructurado vía tool-calling. **No se parsea XML ni se
 *    deserializa contenido del PDF localmente**, por lo tanto NO hay
 *    superficie para XXE/XEE.
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { handlePreflightStrict, buildCors } from "../_shared/cors.ts";
import { jsonResponse, errorResponse } from "../_shared/response.ts";
import { authenticate } from "../_shared/auth.ts";
import { createLogger } from "../_shared/logger.ts";

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB

function validateFile(file: File | null): string | null {
  if (!file) return "No se envió archivo PDF";
  if (file.type !== "application/pdf") return "Solo se aceptan archivos PDF";
  if (file.size > MAX_BYTES) return "El archivo excede el límite de 5 MB";
  return null;
}

function handleGatewayError(status: number, log: ReturnType<typeof createLogger>, cors: HeadersInit, detail?: string) {
  if (status === 429) {
    log.warn("rate limited por gateway", { status_code: 429 });
    return errorResponse("Límite de solicitudes excedido, intenta en unos momentos.", 429, cors);
  }
  if (status === 402) {
    log.warn("sin créditos AI", { status_code: 402 });
    return errorResponse("Créditos insuficientes para procesamiento AI.", 402, cors);
  }
  log.error("AI gateway error", { status_code: status, payload: { detail: detail?.slice(0, 500) } });
  return errorResponse("Error al procesar el documento", 500, cors);
}

const SYSTEM_PROMPT = `Eres un extractor de datos fiscales mexicanos. Se te proporcionará una Constancia de Situación Fiscal (CSF) del SAT en formato PDF.

Extrae los siguientes campos y devuélvelos en el tool call:
- nombre: Denominación o Razón Social del contribuyente
- rfc: RFC del contribuyente (13 caracteres para personas morales, 12 para físicas)
- cp: Código Postal del domicilio fiscal
- direccion: Dirección completa (concatena: Tipo Vialidad + Nombre Vialidad + Número Exterior + Número Interior + Colonia)
- ciudad: Nombre del Municipio o Demarcación Territorial
- estado: Nombre de la Entidad Federativa

Si no encuentras un campo, devuelve cadena vacía. No inventes datos.`;

const TOOL_SCHEMA = {
  type: "function",
  function: {
    name: "extraer_datos_csf",
    description: "Retorna los datos fiscales extraídos de la CSF",
    parameters: {
      type: "object",
      properties: {
        nombre: { type: "string", description: "Denominación o Razón Social" },
        rfc: { type: "string", description: "RFC del contribuyente" },
        cp: { type: "string", description: "Código Postal" },
        direccion: { type: "string", description: "Dirección completa" },
        ciudad: { type: "string", description: "Municipio o Demarcación" },
        estado: { type: "string", description: "Entidad Federativa" },
      },
      required: ["nombre", "rfc", "cp", "direccion", "ciudad", "estado"],
      additionalProperties: false,
    },
  },
};

async function callAiGateway(apiKey: string, fileName: string, base64: string) {
  return await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: [
            { type: "file", file: { filename: fileName, file_data: `data:application/pdf;base64,${base64}` } },
            { type: "text", text: "Extrae los datos fiscales de esta Constancia de Situación Fiscal." },
          ],
        },
      ],
      tools: [TOOL_SCHEMA],
      tool_choice: { type: "function", function: { name: "extraer_datos_csf" } },
    }),
  });
}

serve(async (req) => {
  const preflight = handlePreflightStrict(req);
  if (preflight) return preflight;
  const cors = buildCors(req);
  const log = createLogger(req, "parse-csf");

  try {
    // Require authenticated user — protege créditos del AI Gateway.
    await authenticate(req);

    // @ts-expect-error Deno global
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const fileError = validateFile(file);
    if (fileError) {
      const status = fileError.includes("excede") ? 413 : 400;
      return errorResponse(fileError, status, cors);
    }

    const arrayBuffer = await file!.arrayBuffer();
    const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));

    const systemPrompt = `Eres un extractor de datos fiscales mexicanos. Se te proporcionará una Constancia de Situación Fiscal (CSF) del SAT en formato PDF.

Extrae los siguientes campos y devuélvelos en el tool call:
- nombre: Denominación o Razón Social del contribuyente
- rfc: RFC del contribuyente (13 caracteres para personas morales, 12 para físicas)
- cp: Código Postal del domicilio fiscal
- direccion: Dirección completa (concatena: Tipo Vialidad + Nombre Vialidad + Número Exterior + Número Interior + Colonia)
- ciudad: Nombre del Municipio o Demarcación Territorial
- estado: Nombre de la Entidad Federativa

Si no encuentras un campo, devuelve cadena vacía. No inventes datos.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: [
              { type: "file", file: { filename: file.name, file_data: `data:application/pdf;base64,${base64}` } },
              { type: "text", text: "Extrae los datos fiscales de esta Constancia de Situación Fiscal." },
            ],
          },
        ],
        tools: [{
          type: "function",
          function: {
            name: "extraer_datos_csf",
            description: "Retorna los datos fiscales extraídos de la CSF",
            parameters: {
              type: "object",
              properties: {
                nombre: { type: "string", description: "Denominación o Razón Social" },
                rfc: { type: "string", description: "RFC del contribuyente" },
                cp: { type: "string", description: "Código Postal" },
                direccion: { type: "string", description: "Dirección completa" },
                ciudad: { type: "string", description: "Municipio o Demarcación" },
                estado: { type: "string", description: "Entidad Federativa" },
              },
              required: ["nombre", "rfc", "cp", "direccion", "ciudad", "estado"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "extraer_datos_csf" } },
      }),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      return handleGatewayError(response.status, log, cors, detail);
    }

    const aiResult = await response.json();
    const toolCall = aiResult.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall?.function?.arguments) {
      log.warn("respuesta sin tool_call", { status_code: 422 });
      return errorResponse("No se pudieron extraer los datos del documento", 422, cors);
    }

    log.finish(200, "csf parseado");
    return jsonResponse(JSON.parse(toolCall.function.arguments), 200, cors);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error desconocido";
    const [code, ...rest] = message.split(":");
    const status = /^\d+$/.test(code) ? parseInt(code) : 500;
    log.error("parse-csf falló", { status_code: status, payload: { error: message } });
    return errorResponse(rest.join(":") || message, status, cors);
  }
});
