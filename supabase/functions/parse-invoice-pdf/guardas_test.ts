/**
 * R2 seguridad · P1 (B-3) — `parse-invoice-pdf` no debe llamar a Gemini sin
 * autorización de rol ni rate limit. Ola P2: la lógica vive en
 * `_shared/cxpGuard.ts` y aquí sólo se fijan los topes.
 */
import { assert } from "https://deno.land/std@0.224.0/assert/mod.ts";

Deno.test("B-3: index aplica autorizarYLimitar antes de callGeminiExtract", async () => {
  const src = await Deno.readTextFile(new URL("./index.ts", import.meta.url));
  const idxGuard = src.indexOf("await autorizarYLimitar(");
  const idxGemini = src.indexOf("await callGeminiExtract(");
  assert(idxGuard > 0, "debe llamar autorizarYLimitar");
  assert(idxGuard < idxGemini, "la guarda debe correr antes del llamado a la IA");
  assert(src.includes("content-length"), "debe cortar por Content-Length");
});

Deno.test("B-3: la guarda usa rol de captura CxP y check_ratelimit fail-closed", async () => {
  const guardas = await Deno.readTextFile(new URL("./guardas.ts", import.meta.url));
  assert(guardas.includes("autorizarCxp"), "debe delegar en la guarda compartida");
  assert(guardas.includes("RL_USUARIO") && guardas.includes("RL_ORG"));

  const shared = await Deno.readTextFile(new URL("../_shared/cxpGuard.ts", import.meta.url));
  assert(shared.includes("ROLES_CAPTURA_CXP"));
  assert(shared.includes("check_ratelimit"));
  assert(shared.includes("rate_limit_unavailable"), "sin contador debe fallar cerrado");
});

// B-2 (el backfill de CxP filtraba por organización): la edge function
// `backfill-cxp-buzon` se retiró en v13.808.0 (YAGNI · Ola 10) porque era un
// backfill de un solo uso ya ejecutado y sin consumidor en la app ni en cron.
// El aislamiento por organización del buzón CxP sigue cubierto por las suites
// RLS de `embarque_facturas_entrantes`.

Deno.test("v13.823.4: guarda por header antes de formData/arrayBuffer/base64", async () => {
  const src = await Deno.readTextFile(new URL("./index.ts", import.meta.url));
  const idxGuard = src.indexOf("await autorizarYLimitar(");
  const idxLeer = src.indexOf("await leerPdfDelRequest(");
  const idxForm = src.indexOf("await req.formData()");
  const idxBuf = src.indexOf("await file.arrayBuffer()");
  const idxB64 = src.indexOf("btoa(bin)");
  assert(idxGuard > 0);
  assert(idxGuard < idxLeer, "la guarda corre antes de leer el PDF");
  assert(idxGuard < idxForm && idxGuard < idxBuf && idxGuard < idxB64);
  assert(src.includes("leerOrgHeader(req)"), "org objetivo desde header");
  assert(
    !src.includes('form.get("organization_id")'),
    "ya no se confía en el organization_id del multipart",
  );
  assert(src.includes("content-length") && src.includes("MAX_BYTES"));
});
