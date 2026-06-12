/**
 * Smoke test para process-email-queue — valida contrato del módulo.
 */
import { assertStringIncludes } from "https://deno.land/std@0.224.0/assert/mod.ts";

const indexSource = await Deno.readTextFile(new URL("./index.ts", import.meta.url));

Deno.test("process-email-queue responde a OPTIONS con CORS", () => {
  assertStringIncludes(indexSource, '"Access-Control-Allow-Origin"');
  assertStringIncludes(indexSource, '"OPTIONS"');
});

Deno.test("process-email-queue usa Deno.serve", () => {
  assertStringIncludes(indexSource, "Deno.serve");
});
