/**
 * Ola 13 · R4EF-04 — invariantes estructurales del timeout SAT (12 s).
 * Run: deno test --no-check supabase/functions/verificar-uuid-sat/index_test.ts
 */
// @ts-nocheck — Deno runtime.
import { assert, assertStringIncludes } from "https://deno.land/std@0.224.0/assert/mod.ts";

const src = await Deno.readTextFile(new URL("./index.ts", import.meta.url));

Deno.test("R4EF-04: el fetch SOAP al SAT lleva AbortSignal.timeout de 12 s", () => {
  assertStringIncludes(src, "SAT_FETCH_TIMEOUT_MS = 12_000");
  assertStringIncludes(src, "signal: AbortSignal.timeout(SAT_FETCH_TIMEOUT_MS)");
  const iFetch = src.indexOf("fetch(SAT_ENDPOINT");
  const iSignal = src.indexOf("signal: AbortSignal.timeout", iFetch);
  assert(iSignal > iFetch && iSignal < iFetch + 600, "signal debe estar en las opciones del fetch SAT");
});

Deno.test("R4EF-04: timeout del SAT responde 504 sat_timeout, no 502 genérico", () => {
  assertStringIncludes(src, '"sat_timeout"');
  assertStringIncludes(src, "}, 504)");
  assertStringIncludes(src, 'e.name === "TimeoutError"');
});
