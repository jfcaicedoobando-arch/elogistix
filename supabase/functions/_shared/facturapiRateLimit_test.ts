/**
 * P2-B · Pruebas de la respuesta ante 429 y de la invariante "sin reintento
 * automático de timbrados".
 */
import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  COD_RATE_LIMIT,
  cuerpoRateLimit,
  esRateLimitFacturapi,
  respuestaRateLimit,
} from "./facturapiRateLimit.ts";
import { normalizarErrorFacturapi } from "./facturapiErrorNormalizado.ts";

Deno.test("esRateLimitFacturapi detecta el 429 por status y por detalle", () => {
  assert(esRateLimitFacturapi(429));
  assert(esRateLimitFacturapi(502, { rateLimited: true }));
  assertEquals(esRateLimitFacturapi(400, { rateLimited: false }), false);
  assertEquals(esRateLimitFacturapi(500, null), false);
});

Deno.test("la respuesta 429 lleva Retry-After, espera y reintento_automatico=false", async () => {
  const norm = normalizarErrorFacturapi({
    response: { status: 429, headers: new Headers({ "Retry-After": "30", "x-request-id": "rq1" }), data: { logId: "lg1" } },
  });
  const res = respuestaRateLimit(norm);
  assertEquals(res.status, 429);
  assertEquals(res.headers.get("Retry-After"), "30");
  const body = await res.json() as Record<string, unknown>;
  assertEquals(body.error, COD_RATE_LIMIT);
  assertEquals(body.retry_after_segundos, 30);
  assertEquals(body.retryable, true);
  assertEquals(body.reintento_automatico, false);
  assertEquals(body.request_id, "rq1");
  assertEquals(body.log_id, "lg1");
  assert(String(body.message).includes("30 segundo"));
});

Deno.test("sin Retry-After no se inventa el header y el mensaje sigue siendo accionable", async () => {
  const res = respuestaRateLimit(normalizarErrorFacturapi({ status: 429 }));
  assertEquals(res.headers.get("Retry-After"), null);
  const body = await res.json() as Record<string, unknown>;
  assertEquals(body.retry_after_segundos, null);
  assert(String(body.message).length > 20);
});

Deno.test("cuerpoRateLimit tolera un detalle vacío", () => {
  const body = cuerpoRateLimit(null);
  assertEquals(body.error, COD_RATE_LIMIT);
  assertEquals(body.reintento_automatico, false);
  assertEquals(body.retry_after_segundos, null);
});
