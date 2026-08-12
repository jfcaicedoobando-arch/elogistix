import { buildCors, corsHeaders } from "./cors.ts";

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

/**
 * EF-10: fábrica de `jsonResponse` ligada al CORS de whitelist del request.
 * Úsala al inicio de handlers autenticados (`const json = makeJson(req)`) para
 * que TODAS las respuestas lleven `Access-Control-Allow-Origin` de whitelist
 * en vez del wildcard por defecto.
 */
export function makeJson(req: Request) {
  const cors = buildCors(req);
  return (body: unknown, status = 200): Response => jsonResponse(body, status, cors);
}
