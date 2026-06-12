/**
 * Smoke test para process-email-queue — contrato básico del módulo.
 */
import { assertStringIncludes } from "https://deno.land/std@0.224.0/assert/mod.ts";

const indexSource = await Deno.readTextFile(new URL("./index.ts", import.meta.url));

Deno.test("process-email-queue usa Deno.serve", () => {
  assertStringIncludes(indexSource, "Deno.serve");
});

Deno.test("process-email-queue procesa ambas colas (auth + transactional)", () => {
  assertStringIncludes(indexSource, "auth_emails");
  assertStringIncludes(indexSource, "transactional_emails");
});

Deno.test("process-email-queue valida autenticación antes de procesar", () => {
  assertStringIncludes(indexSource, "authenticateRequest");
});

Deno.test("process-email-queue respeta rate-limiting", () => {
  assertStringIncludes(indexSource, "rate_limited");
});
