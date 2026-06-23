/**
 * 13.114.17 (auditoría Sentry): blinda la cobertura Sentry de edge functions
 * que usan el patrón "manual" (initSentryEdge + captureEdgeException en catch)
 * en vez de `wrapEdgeHandler`. El test garantiza que nadie borre el catch o
 * la llamada a Sentry de estas funciones críticas para la operación.
 *
 * Si añades una función nueva con manejo manual, agrégala a `MANUAL_COVERAGE`.
 * Si la migras a `wrapEdgeHandler`, muévela a `sentry-edge-wrapping.test.ts`.
 */
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(__dirname, "../../..");

const MANUAL_COVERAGE = [
  "supabase/functions/user-management/index.ts",
  "supabase/functions/parse-csf/index.ts",
  "supabase/functions/cxc-recordatorios/index.ts",
  "supabase/functions/auditoria-snapshot-daily/index.ts",
  "supabase/functions/auditoria-explicar-hallazgo/index.ts",
  "supabase/functions/tracking-public/index.ts",
  "supabase/functions/demo-access/index.ts",
  "supabase/functions/client-error-log/index.ts",
];

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
});
