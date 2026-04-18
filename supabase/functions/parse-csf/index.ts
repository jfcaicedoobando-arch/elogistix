import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { handlePreflight } from "../_shared/cors.ts";
import { jsonResponse, errorResponse } from "../_shared/response.ts";

serve(async (req) => {
  const preflight = handlePreflight(req);
  if (preflight) return preflight;

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) return errorResponse("No se envió archivo PDF", 400);

    const arrayBuffer = await file.arrayBuffer();
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
      if (response.status === 429) return errorResponse("Límite de solicitudes excedido, intenta en unos momentos.", 429);
      if (response.status === 402) return errorResponse("Créditos insuficientes para procesamiento AI.", 402);
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      return errorResponse("Error al procesar el documento", 500);
    }

    const aiResult = await response.json();
    const toolCall = aiResult.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall?.function?.arguments) {
      return errorResponse("No se pudieron extraer los datos del documento", 422);
    }

    return jsonResponse(JSON.parse(toolCall.function.arguments));
  } catch (error) {
    console.error("parse-csf error:", error);
    const message = error instanceof Error ? error.message : "Error desconocido";
    return errorResponse(message, 500);
  }
});
