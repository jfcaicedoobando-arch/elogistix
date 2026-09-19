/**
 * P2-B · Pruebas de normalización de errores FacturAPI: 429 con Retry-After,
 * request id, logId, timeouts y errores genéricos.
 */
import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  COD_FACTURAPI_RATE_LIMIT,
  COD_FACTURAPI_TIMEOUT,
  metadatosErrorFacturapi,
  normalizarErrorFacturapi,
  parseRetryAfter,
} from "./facturapiErrorNormalizado.ts";

Deno.test("429 conserva Retry-After, request id y logId, y no autoriza reintento automático", () => {
  const norm = normalizarErrorFacturapi({
    response: {
      status: 429,
      headers: new Headers({ "Retry-After": "45", "X-Request-Id": "req_123" }),
      data: { message: "Too many requests", logId: "log_9" },
    },
  });
  assertEquals(norm.status, 429);
  assertEquals(norm.code, COD_FACTURAPI_RATE_LIMIT);
  assertEquals(norm.retryAfterSegundos, 45);
  assertEquals(norm.requestId, "req_123");
  assertEquals(norm.logId, "log_9");
  assert(norm.rateLimited);
  assert(norm.reintentable);
  assertEquals(norm.reintentoAutomatico, false);
  assert(norm.mensajeUsuario.includes("45 segundos"));
  assert(norm.mensajeUsuario.includes("duplicados"));
});

Deno.test("429 sin Retry-After devuelve mensaje genérico de espera", () => {
  const norm = normalizarErrorFacturapi({ status: 429, message: "rate limited" });
  assertEquals(norm.retryAfterSegundos, undefined);
  assert(norm.mensajeUsuario.includes("Espera un minuto"));
});

Deno.test("headers planos en minúsculas/mayúsculas también se leen", () => {
  const norm = normalizarErrorFacturapi({
    status: 429,
    headers: { "retry-after": 10, "Request-Id": "rq-7" },
  });
  assertEquals(norm.retryAfterSegundos, 10);
  assertEquals(norm.requestId, "rq-7");
});

Deno.test("Retry-After con fecha HTTP se convierte a segundos", () => {
  const futuro = new Date(Date.now() + 30_000).toUTCString();
  const seg = parseRetryAfter(futuro);
  assert(seg !== undefined && seg >= 28 && seg <= 31, `seg=${seg}`);
  assertEquals(parseRetryAfter("no-es-fecha"), undefined);
  assertEquals(parseRetryAfter(""), undefined);
});

Deno.test("timeout del SDK se normaliza a 504 recuperable", () => {
  const err = Object.assign(new Error("FacturApi no respondió"), {
    name: "FacturapiTimeoutError",
  });
  const norm = normalizarErrorFacturapi(err);
  assertEquals(norm.status, 504);
  assertEquals(norm.code, COD_FACTURAPI_TIMEOUT);
  assert(norm.timeout);
  assert(norm.reintentable);
  assert(norm.mensajeUsuario.includes("Recuperar timbrado"));
});

Deno.test("400 de validación no es reintentable y conserva el código del proveedor", () => {
  const norm = normalizarErrorFacturapi({
    response: { status: 400, data: { message: 'El campo "complements" no es válido', code: "invalid_value" } },
  });
  assertEquals(norm.status, 400);
  assertEquals(norm.code, "invalid_value");
  assertEquals(norm.rateLimited, false);
  assertEquals(norm.reintentable, false);
  assertEquals(norm.mensajeUsuario, 'El campo "complements" no es válido');
});

Deno.test("error desconocido cae a 502 y los metadatos no filtran payloads", () => {
  const norm = normalizarErrorFacturapi("boom");
  assertEquals(norm.status, 502);
  assertEquals(norm.message, "boom");
  const meta = metadatosErrorFacturapi(norm);
  assertEquals(Object.keys(meta).sort(), [
    "code", "log_id", "rate_limited", "request_id", "retry_after_segundos", "status", "timeout",
  ]);
});
