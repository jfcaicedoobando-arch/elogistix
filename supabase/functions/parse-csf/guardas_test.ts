/**
 * R2 · N-01/N-02 — `parse-csf` no debe llamar a la IA sin rol de alta fiscal
 * ni rate limit, debe cortar por timeout y no filtrar detalles internos.
 */
import { assert } from "https://deno.land/std@0.224.0/assert/mod.ts";

Deno.test("N-01: index aplica autorizarYLimitar antes de callAiGateway", async () => {
  const src = await Deno.readTextFile(new URL("./index.ts", import.meta.url));
  const idxGuard = src.indexOf("await autorizarYLimitar(");
  const idxIa = src.indexOf("await callAiGateway(");
  assert(idxGuard > 0, "debe llamar autorizarYLimitar");
  assert(idxIa > 0, "debe llamar callAiGateway");
  assert(idxGuard < idxIa, "la guarda debe correr antes del llamado a la IA");
});

Deno.test("N-01: la guarda usa rol de alta fiscal y check_ratelimit fail-closed", async () => {
  const src = await Deno.readTextFile(new URL("./guardas.ts", import.meta.url));
  assert(src.includes("ROLES_ALTA_FISCAL"));
  assert(src.includes("check_ratelimit"));
  assert(src.includes("rate_limit_unavailable"), "sin contador debe fallar cerrado");
});

Deno.test("N-01: callAiGateway aborta el fetch con timeout", async () => {
  const src = await Deno.readTextFile(new URL("./index.ts", import.meta.url));
  assert(src.includes("AbortController"), "debe usar AbortController");
  assert(src.includes("signal: controller.signal"), "el fetch debe recibir el signal");
  assert(src.includes("clearTimeout(timeoutId)"), "debe limpiar el timer");
});

Deno.test("N-02: el catch global no devuelve error.message al cliente", async () => {
  const src = await Deno.readTextFile(new URL("./index.ts", import.meta.url));
  assert(
    !/errorResponse\((?:rest\.join|message)/.test(src),
    "no debe responder con el mensaje crudo del error",
  );
  assert(src.includes("mensajeCliente"), "debe mapear a un mensaje genérico");
  assert(src.includes('error.name === "AbortError"'), "debe mapear el timeout a 504");
});
