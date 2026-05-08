import { corsHeaders } from "./cors.ts";

/**
 * Respuesta JSON con headers CORS aplicados.
 * Por defecto usa wildcard (`*`). Para endpoints autenticados pasar
 * `cors: buildCors(req)` desde el handler.
 */
export function jsonResponse(
  body: unknown,
  status = 200,
  cors: Record<string, string> = corsHeaders,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

/** Respuesta de error estandarizada. */
export function errorResponse(
  message: string,
  status = 500,
  cors: Record<string, string> = corsHeaders,
): Response {
  return jsonResponse({ error: message }, status, cors);
}
