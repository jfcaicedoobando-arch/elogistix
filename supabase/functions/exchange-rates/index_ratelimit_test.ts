/**
 * R3 · P3 — exchange-rates (endpoint público): freno contra el drenaje de la
 * cuota Banxico. Un atacante iterando `?fecha=` distintas saltaba el caché y
 * disparaba 2 llamadas SIE por fecha; el Map del caché además crecía sin
 * límite en el aislado.
 *
 * Run: deno test --no-check --allow-read supabase/functions/exchange-rates/index_ratelimit_test.ts
 */
// @ts-nocheck — Deno runtime.
import { assert, assertStringIncludes } from "https://deno.land/std@0.224.0/assert/mod.ts";

const src = await Deno.readTextFile(new URL("./index.ts", import.meta.url));

Deno.test("P3: rate limit persistente por IP + global antes de pegarle a Banxico", () => {
  assertStringIncludes(src, "limitarPeticionesPublicas(");
  // El freno debe ir DESPUÉS del caché y de la tabla interna (caminos
  // baratos) y ANTES de las llamadas en vivo a Banxico.
  const idxCache = src.indexOf("cacheHistorico.get(key)");
  const idxTabla = src.indexOf("leerTcDeTabla(fechaIso)");
  const idxRl = src.indexOf("limitarPeticionesPublicas(");
  const idxBanxico = src.indexOf("fetchUsdDof(token, ctrl.signal");
  assert(idxCache > 0 && idxTabla > idxCache, "orden cache → tabla");
  assert(idxRl > idxTabla, "el rate limit va tras los caminos baratos");
  assert(idxBanxico > idxRl, "el rate limit va antes de Banxico en vivo");
});

Deno.test("P3: el caché histórico en memoria tiene tope de entradas", () => {
  assertStringIncludes(src, "MAX_CACHE_HISTORICO");
  assertStringIncludes(src, "cacheHistorico.delete(");
});
