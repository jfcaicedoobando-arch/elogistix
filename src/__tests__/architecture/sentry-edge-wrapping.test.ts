/**
 * Plan C (audit Sentry): garantiza que las edge functions críticas de
 * facturación (facturapi-emitir, facturapi-cancelar) llaman a
 * `Deno.serve(wrapEdgeHandler(...))`. Sin el wrapper, los errores 500/timeout
 * de Facturapi pasarían invisibles a Sentry — riesgo fiscal.
 *
 * Si añades una edge function nueva sensible al CFDI, agrégala a `CRITICAL`.
 */
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(__dirname, "../../..");

const CRITICAL = [
  // Fase C (13.62.0)
  "supabase/functions/facturapi-emitir/index.ts",
  "supabase/functions/facturapi-cancelar/index.ts",
  // 13.114.18 — REP fiscal (complementos de pago)
  "supabase/functions/facturapi-emitir-rep/index.ts",
  "supabase/functions/facturapi-cancelar-rep/index.ts",
  // F1 (13.65.0) — email/queue/sales/cron/exchange-rates
  "supabase/functions/send-transactional-email/index.ts",
  "supabase/functions/process-email-queue/index.ts",
  "supabase/functions/enviar-cotizacion-email/index.ts",
  "supabase/functions/auditoria-weekly-digest/index.ts",
  "supabase/functions/handle-email-suppression/index.ts",
  "supabase/functions/handle-email-unsubscribe/index.ts",
  "supabase/functions/preview-transactional-email/index.ts",
  // 13.166.0 — exchange-rates ahora consulta Banxico (SF43718 + SF46410)
  "supabase/functions/exchange-rates/index.ts",
  // 13.114.5 — CFDI upload (visibilidad server-side de "Failed to fetch")
  "supabase/functions/parse-cfdi-xml/index.ts",
  // 13.136.3 — Webhook de FacturApi (sync de estado factura)
  "supabase/functions/facturapi-webhook/index.ts",
  // 13.137.4-5 — Descarga y envío de CFDI vía FacturApi
  "supabase/functions/facturapi-descargar/index.ts",
  "supabase/functions/facturapi-enviar-email/index.ts",
  // 13.794.0 — Paquete ZIP mensual de CFDI (cierre contable)
  "supabase/functions/facturapi-descargar-zip/index.ts",

  // 13.137.7 — Notas de crédito (CFDI tipo E)
  "supabase/functions/facturapi-emitir-nota-credito/index.ts",
  "supabase/functions/facturapi-cancelar-nota-credito/index.ts",
  // 13.141.0 — AUDIT-17.1 notificación de respuesta de cotización desde portal
  "supabase/functions/notificar-respuesta-cotizacion/index.ts",
  // 13.144.6 — Envío de proforma al cliente por email (portal público)
  "supabase/functions/enviar-proforma-email/index.ts",
  // 13.149.1 — Envío branded de facturas (PDF+XML) al cliente
  "supabase/functions/enviar-factura-email/index.ts",
  // 13.187.0 — Verificación UUID vs SAT + reintento nocturno de REP
  "supabase/functions/verificar-uuid-sat/index.ts",
  "supabase/functions/rep-retry-nocturno/index.ts",
  // 13.301.0 — Reconciliación async de cancelaciones CFDI (cron 30 min)
  "supabase/functions/facturapi-reconciliar-cancelaciones/index.ts",
  // 13.301.11 — Consulta en vivo + reconciliación puntual de una factura
  "supabase/functions/facturapi-consultar/index.ts",
  // 13.594.7 — Consulta puntual de REP timbrado (sincronización manual)
  "supabase/functions/facturapi-consultar-rep/index.ts",
  // 13.303.2 — Recuperación de claims huérfanos PENDING:<uuid>
  "supabase/functions/facturapi-recuperar-claim/index.ts",
  // 13.315.0 — Recordatorios de cobro y estado de cuenta CxC
  "supabase/functions/cxc-recordatorio-enviar/index.ts",
  "supabase/functions/cxc-estado-cuenta-enviar/index.ts",
  // 13.430.1 — Mantenimiento CxP y verificación SAT en lote
  "supabase/functions/verificar-sat-lote/index.ts",
  // 13.710.0 — Verificación SAT semanal (cron) para CFDI cancelados
  "supabase/functions/verificar-sat-semanal/index.ts",
  // 13.715.0 — Ola 5 · O5.8: verificación server-side del XML del buzón CxP
  "supabase/functions/adjuntar-xml-entrante/index.ts",
];

describe("Edge functions críticas envueltas con wrapEdgeHandler", () => {
  it.each(CRITICAL)("%s usa Deno.serve(wrapEdgeHandler(...))", (rel) => {
    const full = path.join(ROOT, rel);
    expect(fs.existsSync(full), `Falta archivo ${rel}`).toBe(true);
    const src = fs.readFileSync(full, "utf-8");

    // 1) Importa el wrapper desde el shared.
    expect(src).toMatch(/from\s+["']\.\.\/_shared\/sentry\.ts["']/);
    expect(src).toMatch(/import\s+\{[^}]*wrapEdgeHandler[^}]*\}/);

    // 2) El handler se monta a través de wrapEdgeHandler(fnName, ...).
    expect(src).toMatch(/Deno\.serve\(\s*wrapEdgeHandler\(/);
  });
});
