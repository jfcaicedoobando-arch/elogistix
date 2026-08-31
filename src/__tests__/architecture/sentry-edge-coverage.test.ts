/**
 * 13.114.17 (auditoría Sentry): blinda la cobertura Sentry de edge functions
 * que usan el patrón "manual" (initSentryEdge + captureEdgeException en catch)
 * en vez de `wrapEdgeHandler`. El test garantiza que nadie borre el catch o
 * la llamada a Sentry de estas funciones críticas para la operación.
 *
 * 13.115.0 (Sprint 1.3): añadido test de **exhaustividad** — toda edge function
 * con `index.ts` debe estar listada en `MANUAL_COVERAGE` o en la lista CRITICAL
 * de `sentry-edge-wrapping.test.ts`. Antes una función nueva pasaba invisible.
 *
 * Si añades una función nueva con manejo manual, agrégala a `MANUAL_COVERAGE`.
 * Si la migras a `wrapEdgeHandler`, muévela a `sentry-edge-wrapping.test.ts`.
 */
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(__dirname, "../../..");
const FUNCTIONS_DIR = path.join(ROOT, "supabase/functions");

const MANUAL_COVERAGE = [
  "supabase/functions/user-management/index.ts",
  "supabase/functions/parse-csf/index.ts",
  "supabase/functions/cxc-recordatorios/index.ts",
  "supabase/functions/auditoria-snapshot-daily/index.ts",
  "supabase/functions/auditoria-explicar-hallazgo/index.ts",
  "supabase/functions/tracking-public/index.ts",
  "supabase/functions/demo-access/index.ts",
  "supabase/functions/client-error-log/index.ts",
  // 13.335.0 — Cron diario de tipo de cambio DOF (Banxico)
  "supabase/functions/tc-dof-diario/index.ts",
];

// Sincronizado con CRITICAL en sentry-edge-wrapping.test.ts.
const WRAPPED_COVERAGE = [
  "supabase/functions/facturapi-emitir/index.ts",
  "supabase/functions/facturapi-cancelar/index.ts",
  "supabase/functions/facturapi-emitir-rep/index.ts",
  "supabase/functions/facturapi-cancelar-rep/index.ts",
  "supabase/functions/enviar-cotizacion-email/index.ts",
  "supabase/functions/auditoria-weekly-digest/index.ts",
  "supabase/functions/exchange-rates/index.ts",
  "supabase/functions/parse-cfdi-xml/index.ts",
  "supabase/functions/facturapi-webhook/index.ts",
  "supabase/functions/facturapi-descargar/index.ts",
  "supabase/functions/facturapi-enviar-email/index.ts",
  // 13.794.0 — Paquete ZIP mensual de CFDI (cierre contable)
  "supabase/functions/facturapi-descargar-zip/index.ts",

  "supabase/functions/facturapi-emitir-nota-credito/index.ts",
  // 13.149.1 — Envío branded de facturas (PDF+XML) al cliente
  "supabase/functions/enviar-factura-email/index.ts",
  "supabase/functions/facturapi-cancelar-nota-credito/index.ts",
  "supabase/functions/notificar-respuesta-cotizacion/index.ts",
  "supabase/functions/enviar-proforma-email/index.ts",
  // 13.187.0 — Verificación UUID vs SAT + reintento nocturno de REP
  "supabase/functions/verificar-uuid-sat/index.ts",
  "supabase/functions/rep-retry-nocturno/index.ts",
  // 13.301.0 — Reconciliación async de cancelaciones CFDI
  "supabase/functions/facturapi-reconciliar-cancelaciones/index.ts",
  // 13.301.11 — Consulta en vivo + reconciliación puntual
  "supabase/functions/facturapi-consultar/index.ts",
  // 13.594.7 — Consulta puntual de REP timbrado
  "supabase/functions/facturapi-consultar-rep/index.ts",
  // 13.303.2 — Recuperación de claims huérfanos PENDING:<uuid>
  "supabase/functions/facturapi-recuperar-claim/index.ts",
  // 13.303.99 — Parseo de facturas PDF con Gemini (proveedores sin XML)
  "supabase/functions/parse-invoice-pdf/index.ts",
  // 13.315.0 — Recordatorios de cobro y estado de cuenta CxC
  "supabase/functions/cxc-recordatorio-enviar/index.ts",
  "supabase/functions/cxc-estado-cuenta-enviar/index.ts",
  // 13.430.1 — Mantenimiento CxP y verificación SAT en lote
  "supabase/functions/verificar-sat-lote/index.ts",
  // 13.710.0 — Verificación SAT semanal (cron) para CFDI cancelados
  "supabase/functions/verificar-sat-semanal/index.ts",
  "supabase/functions/adjuntar-xml-entrante/index.ts",
];

// Funciones intencionalmente exentas de Sentry (proxy puro, sin lógica propia
// que pueda fallar de modo recuperable). Si se añade lógica de negocio, sacar
// de esta lista y añadir a manual o wrapped.
const SENTRY_EXEMPT = new Set<string>([
  "supabase/functions/sentry-tunnel/index.ts",
  // facturapi-test-conexion: prueba de conectividad sin lógica de negocio;
  // los errores se devuelven al cliente (200 con `ok:false, status, detail`)
  // y se reportan desde el front (`reportCaughtError`).
  "supabase/functions/facturapi-test-conexion/index.ts",
  // e2e-provision-users: invocada exclusivamente desde CI (bun run e2e:provision).
  // Los errores se propagan al script provision-users.ts que hace fallar el job
  // de GitHub Actions con logs completos; Sentry aquí sólo generaría ruido.
  "supabase/functions/e2e-provision-users/index.ts",
  // e2e-provision-multi-tenant: mismo patrón que e2e-provision-users (CI-only,
  // errores propagados al workflow con logs completos).
  "supabase/functions/e2e-provision-multi-tenant/index.ts",
  // auth-email-hook: webhook scaffolded por la plataforma (firma verificada +
  // encolado en email_send_log). Cada fallo ya queda registrado en
  // `email_send_log` con `status: failed`, que es la fuente de verdad para
  // soporte; envolverlo en Sentry sólo duplicaría el mismo evento.
  "supabase/functions/auth-email-hook/index.ts",
  // handle-email-events: receptor scaffolded por la plataforma (firma
  // verificada por el handler de Lovable). Los fallos de escritura ya se
  // registran en consola y provocan reintento de la entrega.
  "supabase/functions/handle-email-events/index.ts",
  // preview-transactional-email: función scaffolded por la plataforma para
  // previsualizar plantillas (sólo render, gated por LOVABLE_API_KEY).
  "supabase/functions/preview-transactional-email/index.ts",
]);


describe("Edge functions con manejo manual de Sentry", () => {
  it.each(MANUAL_COVERAGE)("%s importa y llama captureEdgeException", (rel) => {
    const full = path.join(ROOT, rel);
    expect(fs.existsSync(full), `Falta archivo ${rel}`).toBe(true);
    const src = fs.readFileSync(full, "utf-8");

    // 1) Importa wrapper compartido.
    expect(src).toMatch(/from\s+["']\.\.\/_shared\/sentry\.ts["']/);
    expect(src).toMatch(/import\s+\{[^}]*initSentryEdge[^}]*\}/);
    expect(src).toMatch(/import\s+\{[^}]*captureEdgeException[^}]*\}/);

    // 2) Inicializa Sentry y captura excepciones en al menos un punto.
    expect(src).toMatch(/initSentryEdge\(/);
    expect(src).toMatch(/captureEdgeException\(/);
  });

  // Sprint 1.3 (13.115.0): exhaustividad. Antes, una función nueva podía
  // omitir Sentry sin que ningún test fallara.
  it("toda edge function con index.ts está cubierta (manual, wrapped o exenta)", () => {
    const covered = new Set<string>([
      ...MANUAL_COVERAGE,
      ...WRAPPED_COVERAGE,
      ...SENTRY_EXEMPT,
    ]);
    const allIndexFiles: string[] = [];
    for (const name of fs.readdirSync(FUNCTIONS_DIR)) {
      if (name.startsWith("_")) continue; // _shared, _utils, etc.
      const indexPath = path.join(FUNCTIONS_DIR, name, "index.ts");
      if (fs.existsSync(indexPath)) {
        allIndexFiles.push(`supabase/functions/${name}/index.ts`);
      }
    }
    const missing = allIndexFiles.filter((f) => !covered.has(f));
    expect(
      missing,
      `Edge functions sin cobertura Sentry declarada:\n${missing.join("\n")}\n\n` +
        `Agrégalas a MANUAL_COVERAGE, a CRITICAL en sentry-edge-wrapping.test.ts, ` +
        `o (si son proxy puro) a SENTRY_EXEMPT.`,
    ).toEqual([]);
  });
});
