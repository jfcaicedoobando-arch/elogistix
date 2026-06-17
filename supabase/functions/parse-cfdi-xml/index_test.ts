/**
 * Smoke compile-time: garantiza que aiHelpers.ts y parser.ts siguen
 * exportando lo que index.ts consume.
 */
import { assert } from "https://deno.land/std@0.224.0/assert/mod.ts";
import * as ai from "./aiHelpers.ts";
import * as parser from "./parser.ts";

Deno.test("aiHelpers expone la API consumida por index.ts", () => {
  assert(typeof ai.fallbackResult === "function");
  assert(typeof ai.parseToolCallResponse === "function");
  assert(typeof ai.parseCategoriasJson === "function");
});

Deno.test("parser expone parseCfdi", () => {
  assert(typeof parser.parseCfdi === "function");
});
