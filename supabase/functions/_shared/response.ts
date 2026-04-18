import { corsHeaders } from "./cors.ts";

/** Respuesta JSON con headers CORS aplicados. */
export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/** Respuesta de error estandarizada. */
export function errorResponse(message: string, status = 500): Response {
  return jsonResponse({ error: message }, status);
}
