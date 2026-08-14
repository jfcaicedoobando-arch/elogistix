/**
 * Ola 14 · R5EF-02/R5EF-03 — rate limit fail-closed y 502 genérico.
 * Inspección estructural de fuente: el módulo arranca `serve()` y lee env al
 * importarse, así que no se importa (mismo estilo que ratelimit_test.ts).
 * Run: deno test --no-check supabase/functions/facturapi-consultar-rep/index_test.ts
 */
// @ts-nocheck — Deno runtime.
import { assert, assertStringIncludes } from "https://deno.land/std@0.224.0/assert/mod.ts";

const src = await Deno.readTextFile(new URL("./index.ts", import.meta.url));

Deno.test("R5EF-02: check_ratelimit por org, 10/min, fail-closed 503 con Sentry", () => {
  assertStringIncludes(src, "check_ratelimit");
  assertStringIncludes(src, "facturapi-consultar-rep:${organizationId}");
  assertStringIncludes(src, "rate_limit_unavailable");
  assertStringIncludes(src, "captureEdgeException");
  assertStringIncludes(src, "503");
  assertStringIncludes(src, "RL_CONSULTA_REP = { windowSeconds: 60, max: 10 }");
});

Deno.test("R5EF-02: 429 con mensaje al usuario cuando ok:false", () => {
  assertStringIncludes(src, "rate_limited");
  assertStringIncludes(src, "429");
  assertStringIncludes(src, "Demasiadas consultas de estatus seguidas");
});

Deno.test("R5EF-02: el rate limit va DESPUÉS de resolverPago y ANTES de traerRepRemoto", () => {
  const iPago = src.indexOf("await resolverPago(");
  const iRl = src.indexOf("await checkRateLimitConsultaRep(");
  const iRemoto = src.indexOf("await traerRepRemoto(json, supabase, pago)");
  assert(iPago >= 0 && iRl > iPago && iRemoto > iRl, "orden incorrecto en handle");
});

Deno.test("R5EF-03: el 502 ya no lleva el detalle crudo del PAC", () => {
  assert(!src.includes("message: detail"), "sigue propagando err.message al cliente");
  assertStringIncludes(src, "LC_FACTURAPI_NO_DISPONIBLE:");
  assertStringIncludes(src, 'console.error("facturapi-consultar-rep invoices.retrieve:", detail)');
});
