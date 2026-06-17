/**
 * Smoke compile-time: garantiza que helpers.ts no se desincronice de index.ts.
 */
import { assert } from "https://deno.land/std@0.224.0/assert/mod.ts";
import * as helpers from "./helpers.ts";

Deno.test("helpers exporta la API consumida por index.ts", () => {
  assert(typeof helpers.validateCancelacionInput === "function");
  assert(typeof helpers.buildCancelQuery === "function");
  assert(helpers.MOTIVOS_VALIDOS instanceof Set);
});
