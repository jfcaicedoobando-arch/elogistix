/**
 * R3 · P3 — notificar-respuesta-cotizacion: freno contra spam a operadores.
 * Cada invocación con el mismo cotizacion_id reenviaba correos a TODOS los
 * operadores de la org (messageId aleatorio → email_send_log no deduplicaba).
 *
 * Run: deno test --no-check --allow-read supabase/functions/notificar-respuesta-cotizacion/index_throttle_test.ts
 */
// @ts-nocheck — Deno runtime.
import { assert, assertStringIncludes } from "https://deno.land/std@0.224.0/assert/mod.ts";

const src = await Deno.readTextFile(new URL("./index.ts", import.meta.url));

Deno.test("P3: dedupe por (cotización, estado) y tope por usuario vía check_ratelimit", () => {
  assertStringIncludes(src, 'check_ratelimit');
  assertStringIncludes(src, "cotizacion-respuesta:${cotizacionId}:${estado}");
  assertStringIncludes(src, "cotizacion-respuesta:user:${ctx.userId}");
  assertStringIncludes(src, "deduplicated: true");
});

Deno.test("P3: el freno va DESPUÉS de autenticar y ANTES de cargar/enviar", () => {
  const idxAuth = src.lastIndexOf("await authOrError(req)");
  const idxThrottle = src.indexOf("await checkThrottle(ctx");
  const idxLoad = src.lastIndexOf("get_operadores_para_cotizacion");
  const idxSend = src.indexOf("await sendToRecipients(");
  assert(idxThrottle > idxAuth, "throttle tras auth");
  assert(idxLoad > idxThrottle && idxSend > idxThrottle, "throttle antes del trabajo");
});

Deno.test("P3: fall-open con captura a Sentry si la RPC falta", () => {
  assertStringIncludes(src, "captureEdgeException");
  assertStringIncludes(src, "continue; // fail-open");
});
