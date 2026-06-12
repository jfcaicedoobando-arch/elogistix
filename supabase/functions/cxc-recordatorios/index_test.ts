/**
 * Smoke test para cxc-recordatorios — valida contrato del módulo (sin red).
 */
import { assertStringIncludes } from "https://deno.land/std@0.224.0/assert/mod.ts";

const indexSource = await Deno.readTextFile(new URL("./index.ts", import.meta.url));

Deno.test("cxc-recordatorios usa Deno.serve", () => {
  assertStringIncludes(indexSource, "Deno.serve");
});

Deno.test("cxc-recordatorios usa el helper compartido de CORS", () => {
  assertStringIncludes(indexSource, "_shared/cors");
});

Deno.test("cxc-recordatorios maneja preflight (OPTIONS)", () => {
  assertStringIncludes(indexSource, "handlePreflight");
});
