/**
 * R2 seguridad · P1 (B-3) — `parse-invoice-pdf` no debe llamar a Gemini sin
 * autorización de rol ni rate limit.
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
  const src = await Deno.readTextFile(new URL("./guardas.ts", import.meta.url));
  assert(src.includes("ROLES_CAPTURA_CXP"));
  assert(src.includes("check_ratelimit"));
  assert(src.includes("rate_limit_unavailable"), "sin contador debe fallar cerrado");
});

Deno.test("B-2: el backfill de CxP filtra por organización", async () => {
  const src = await Deno.readTextFile(
    new URL("../backfill-cxp-buzon/backfill.ts", import.meta.url),
  );
  assert(src.includes('query.eq("organization_id", organizationId)'));
});
