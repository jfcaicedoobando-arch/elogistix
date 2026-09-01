/**
 * Smoke compile-time: garantiza que aiHelpers.ts y _shared/cfdiParser.ts siguen
 * exportando lo que index.ts consume.
 */
import { assert } from "https://deno.land/std@0.224.0/assert/mod.ts";
import * as ai from "./aiHelpers.ts";
import * as parser from "../_shared/cfdiParser.ts";

Deno.test("aiHelpers expone la API consumida por index.ts", () => {
  assert(typeof ai.fallbackResult === "function");
  assert(typeof ai.parseToolCallResponse === "function");
  assert(typeof ai.parseCategoriasJson === "function");
});

Deno.test("parser expone parseCfdi", () => {
  assert(typeof parser.parseCfdi === "function");
});

Deno.test("v13.823.4: autoriza por header ANTES de leer el multipart", async () => {
  const src = await Deno.readTextFile(new URL("./index.ts", import.meta.url));
  const handle = src.slice(src.indexOf("async function handle("));
  const idxAuth = handle.indexOf("await autorizarCxp(");
  const idxEntrada = handle.indexOf("await validarEntrada(");
  assert(idxAuth > 0 && idxEntrada > 0);
  assert(idxAuth < idxEntrada, "la guarda corre antes de validarEntrada");
  assert(src.includes("leerOrgHeader(req)"), "org objetivo desde header");
  assert(
    !src.includes('form.get("organization_id")'),
    "ya no se confía en el organization_id del multipart",
  );
  assert(src.includes("content-length"), "conserva el corte por Content-Length");
  assert(src.includes("file.size > MAX_BYTES"), "conserva el tope real");
});
