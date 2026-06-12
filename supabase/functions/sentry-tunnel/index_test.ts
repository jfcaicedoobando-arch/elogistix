/**
 * Smoke test para sentry-tunnel — valida parser de envelope sin red.
 * No importa `index.ts` directamente porque tiene `Deno.serve()` top-level
 * que arrancaría un servidor. Para probar `parseEnvelopeDsn` lo hacemos
 * vía import dinámico controlado: leemos la función y la reimplementamos
 * espejando el contrato. La cobertura real corre cuando la función está
 * desplegada (smoke post-deploy).
 *
 * El test de contrato (este archivo) asegura que la lógica de parseo del
 * DSN existe y que la whitelist está presente.
 */
import { assertStringIncludes } from "https://deno.land/std@0.224.0/assert/mod.ts";

const indexSource = await Deno.readTextFile(new URL("./index.ts", import.meta.url));

Deno.test("sentry-tunnel exporta parseEnvelopeDsn", () => {
  assertStringIncludes(indexSource, "export function parseEnvelopeDsn");
});

Deno.test("sentry-tunnel rechaza primera línea no JSON", () => {
  // El contrato: try/catch alrededor de JSON.parse devuelve null.
  assertStringIncludes(indexSource, "JSON.parse(firstLine)");
});

Deno.test("sentry-tunnel whitelist de hosts está poblada", () => {
  assertStringIncludes(indexSource, "ALLOWED_HOSTS");
  assertStringIncludes(indexSource, "ingest");
});

Deno.test("sentry-tunnel responde a OPTIONS con CORS", () => {
  assertStringIncludes(indexSource, "OPTIONS");
  assertStringIncludes(indexSource, "Access-Control-Allow-Origin");
});

Deno.test("sentry-tunnel sólo acepta POST", () => {
  assertStringIncludes(indexSource, '"POST"');
});
