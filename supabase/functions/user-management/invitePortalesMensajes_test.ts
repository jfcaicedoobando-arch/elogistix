/**
 * Ola 14 · R5EF-01 — invite-agente / invite-cliente no propagan .message crudo.
 * Inspección de fuente (mismo estilo que ratelimit_test.ts).
 * Run: deno test --no-check supabase/functions/user-management/invitePortalesMensajes_test.ts
 */
// @ts-nocheck — Deno runtime.
import { assert, assertStringIncludes } from "https://deno.land/std@0.224.0/assert/mod.ts";

const srcAgente = await Deno.readTextFile(new URL("./agenteHandlers.ts", import.meta.url));
const srcCliente = await Deno.readTextFile(new URL("./clientHandlers.ts", import.meta.url));

for (const [nombre, src] of [["agente", srcAgente], ["cliente", srcCliente]] as const) {
  Deno.test(`R5EF-01 (${nombre}): importa mensajeSeguro del catálogo LC_*`, () => {
    assertStringIncludes(src, `from "./errores.ts"`);
    assertStringIncludes(src, "mensajeSeguro(");
  });

  Deno.test(`R5EF-01 (${nombre}): ningún errorResponse interpola crudo`, () => {
    const crudos = src.match(/errorResponse\(`[^`]*\$\{(inviteResult\.error|linkError\.message)\}`/g);
    assert(!crudos, `quedan respuestas con texto crudo: ${crudos}`);
  });

  Deno.test(`R5EF-01 (${nombre}): el detalle crudo se conserva en log.finish (payload.error)`, () => {
    assertStringIncludes(src, "payload: { error: inviteResult.error }");
    assertStringIncludes(src, "error: linkError.message");
  });
}

Deno.test("R5EF-01 (agente): el fallback de vínculo usa código LC_*", () => {
  assertStringIncludes(srcAgente, "LC_USUARIO_VINCULO_AGENTE_FALLIDO:");
});
Deno.test("R5EF-01 (cliente): el fallback de vínculo usa código LC_*", () => {
  assertStringIncludes(srcCliente, "LC_USUARIO_VINCULO_CLIENTE_FALLIDO:");
});
