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
import { initSentryEdge, captureEdgeException, debeReportarStatus } from "../_shared/sentry.ts";
import { autorizarYLimitar } from "./guardas.ts";


initSentryEdge("parse-csf");
import { validateFile } from "./validate.ts";

export { validateFile };



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
- regimen_fiscal: Régimen fiscal vigente del contribuyente. Devuelve SOLO la clave numérica de 3 dígitos (ej. "601", "612", "626"). Si la CSF lista varios regímenes, elige el vigente o el primero listado. Si no hay régimen, devuelve cadena vacía.

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
        regimen_fiscal: { type: "string", description: "Clave numérica del régimen fiscal SAT (3 dígitos)" },
      },
      required: ["nombre", "rfc", "cp", "direccion", "ciudad", "estado", "regimen_fiscal"],
      additionalProperties: false,
    },
  },
};


/**
 * N-01 (auditoría R2): timeout de 45 s al gateway (patrón de
 * `parse-invoice-pdf/extract.ts`). Sin él, un gateway colgado dejaba la
 * invocación abierta hasta el límite de plataforma.
 */
async function callAiGateway(apiKey: string, fileName: string, base64: string) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 45_000);
  try {
    return await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      signal: controller.signal,
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
  } finally {
    clearTimeout(timeoutId);
  }
}

async function processCsf(req: Request, cors: Record<string, string>, log: ReturnType<typeof createLogger>) {
  const auth = await authenticate(req);
  // N-01 (auditoría R2): rol de alta fiscal + rate limit persistente por
  // usuario y por org (fail-CLOSED). Antes bastaba cualquier membresía, así que
  // cualquier sesión podía drenar los créditos de IA.
  const rechazo = await autorizarYLimitar(auth, cors, log);
  if (rechazo) return rechazo;

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

  const bytes = new Uint8Array(await file!.arrayBuffer());
  // Codificación por chunks para evitar "Maximum call stack size exceeded"
  // cuando el PDF supera ~100KB (el spread pasa cada byte como argumento).
  const CHUNK = 0x8000; // 32 KB
  let binary = "";
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode.apply(
      null,
      bytes.subarray(i, i + CHUNK) as unknown as number[],
    );
  }
  const base64 = btoa(binary);

  const response = await callAiGateway(LOVABLE_API_KEY, file!.name, base64);
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
}

serve(async (req) => {
  const preflight = handlePreflightStrict(req);
  if (preflight) return preflight;
  const cors = buildCors(req);
  const log = createLogger(req, "parse-csf");

  try {
    return await processCsf(req, cors, log);
  } catch (error) {
    // N-02 (auditoría R2): NO se devuelve `err.message` al cliente (filtraba
    // huellas internas: nombres de variables de entorno, rutas, detalle del
    // gateway). Se mapea la CLASE de error a (status, mensaje genérico); el
    // detalle queda en logs y Sentry.
    const message = error instanceof Error ? error.message : "Error desconocido";
    let status = 500;
    let mensajeCliente = "Error interno al procesar el documento";
    if (message.startsWith("401:")) {
      status = 401;
      mensajeCliente = "No autorizado";
    } else if (error instanceof DOMException && error.name === "AbortError") {
      status = 504;
      mensajeCliente = "El servicio de IA tardó demasiado en responder, intenta de nuevo.";
    }
    log.error("parse-csf falló", { status_code: status, payload: { error: message } });
    // 13.114.20: capturar también 4xx inesperados (consistencia con 13.114.19).
    if (debeReportarStatus(status)) await captureEdgeException(error, { fn: "parse-csf", status_code: status });
    return errorResponse(mensajeCliente, status, cors);
  }
});

