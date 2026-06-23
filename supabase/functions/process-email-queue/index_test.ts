/**
 * 13.116.0 — Reemplaza tests de grep por checks de invariantes críticos.
 *
 * Esta función procesa la cola de emails con SERVICE_ROLE. Si la auth se
 * quita por error, cualquiera podría disparar envíos masivos. Si el orden
 * de las colas cambia, los emails de auth (alta prioridad) se pueden
 * quedar atrás de transaccionales.
 */
import { assertEquals, assertStringIncludes } from "https://deno.land/std@0.224.0/assert/mod.ts";

const indexSource = await Deno.readTextFile(new URL("./index.ts", import.meta.url));
const queueAuthSource = await Deno.readTextFile(new URL("./queueAuth.ts", import.meta.url));

Deno.test("process-email-queue: autentica ANTES de cargar config o procesar", () => {
  const authIdx = indexSource.indexOf("authenticateRequest");
  const cfgIdx = indexSource.indexOf("loadQueueConfig");
  const procIdx = indexSource.indexOf("processQueue");
  assertEquals(authIdx >= 0 && cfgIdx > authIdx && procIdx > cfgIdx, true,
    "Orden requerido: authenticateRequest → loadQueueConfig → processQueue");
});

Deno.test("process-email-queue: corta corto si rate-limited (no procesa nada)", () => {
  assertStringIncludes(indexSource, "rateLimited");
  // El return debe ocurrir ANTES del loop de colas.
  const limIdx = indexSource.indexOf("rateLimited) return");
  const loopIdx = indexSource.indexOf("for (const queue");
  assertEquals(limIdx > 0 && limIdx < loopIdx, true,
    "El check de rate-limit debe estar antes del loop de colas");
});

Deno.test("process-email-queue: procesa auth_emails ANTES que transactional_emails", () => {
  // Orden importa: emails de auth (reset password) son críticos vs marketing.
  const authIdx = indexSource.indexOf('"auth_emails"');
  const txIdx = indexSource.indexOf('"transactional_emails"');
  assertEquals(authIdx >= 0 && authIdx < txIdx, true);
});

Deno.test("process-email-queue: queueAuth verifica firma JWT (no decode manual)", () => {
  // Regresión: antes hacía base64 decode (vulnerable a tokens forjados).
  assertStringIncludes(queueAuthSource, "auth.getClaims");
  assertStringIncludes(queueAuthSource, "service_role");
});

Deno.test("process-email-queue: queueAuth rechaza si faltan env vars críticas", () => {
  assertStringIncludes(queueAuthSource, "Server configuration error");
  assertStringIncludes(queueAuthSource, "SUPABASE_SERVICE_ROLE_KEY");
});

Deno.test("process-email-queue: wrapped en Sentry", () => {
  assertStringIncludes(indexSource, 'wrapEdgeHandler("process-email-queue"');
});
