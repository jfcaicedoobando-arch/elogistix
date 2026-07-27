/**
 * Smoke test del reporte consolidado. Ejecuta los auditores puros contra
 * el repo y valida el shape esperado del baseline.
 *
 * Algunos chequeos honran allowlists temporales documentadas en
 * `src/lib/__tests__/architecture-baseline.test.ts` y `mem://audit/pendings`.
 * Estos sets DEBEN mantenerse sincronizados con esa fuente de verdad.
 */
import { describe, it, expect } from "vitest";
import { runArchAudit } from "../../scripts/lib/arch";
import { scanCasts, summarizeCasts } from "../../scripts/lib/casts";
import { auditTests } from "../../scripts/lib/tests";

const ROOT = process.cwd();

// Sincronizado con PAGES_COMPONENTS_BASELINE en architecture-baseline.test.ts.
const PAGES_COMPONENTS_BASELINE = new Set<string>([
  "src/features/auth/components/ForgotPasswordDialog.tsx",
  "src/features/auth/routes/ResetPassword.tsx",
]);

// Sincronizado con OVERSIZED_BASELINE en architecture-baseline.test.ts.
const OVERSIZED_BASELINE = new Set<string>([
  "src/features/auditoria/domain/ejecutivoAgregados.ts",
  "src/features/proformas/routes/ProformaDetalle.tsx",
  "src/features/embarques/services/pnlPorContenedor.ts",
  "src/features/embarques/components/TabDemoras.tsx",
  "src/features/embarques/components/TabPnlContenedor.tsx",
  "src/features/embarques/components/EmbarqueDetalleTabs.tsx",
]);

// Baseline temporal de archivos con `.rejects.toBeDefined()/toBeTruthy()`.
// 13.14.1: refactor masivo a `.rejects.toThrow()` — baseline en 0.
// NO agregar archivos nuevos a este baseline.
const WEAK_REJECTS_BASELINE = new Set<string>();


// Baseline de tests que mockean supabase con `.from(...)` sin createSupabaseMock.
// 13.14.2: tras tightening de la regla (sólo flagea cuando usa cadena tabular),
// baseline en 0. NO agregar nuevos archivos.
const SUPABASE_MOCK_BASELINE = new Set<string>();



describe("audit-report", { timeout: 30_000 }, () => {
  it("arch baseline: 0 imports directos nuevos en hooks/contexts/components/pages", () => {
    const a = runArchAudit(ROOT);
    expect(a.hooksContextsDirectImports).toEqual([]);
    const nuevos = a.componentsPagesDirectImports.filter(
      (f) => !PAGES_COMPONENTS_BASELINE.has(f),
    );
    expect(nuevos).toEqual([]);
  });

  it("arch baseline: 0 archivos productivos > 200 líneas (salvo allowlist)", () => {
    const a = runArchAudit(ROOT);
    const nuevos = a.oversized.filter((o) => !OVERSIZED_BASELINE.has(o.file));
    expect(nuevos).toEqual([]);
  });

  it("casts summary tiene el shape esperado", () => {
    const hits = scanCasts(ROOT);
    const s = summarizeCasts(hits, { topFiles: 5, topHits: 5 });
    expect(s.total).toBeGreaterThan(0);
    for (const k of ["SAFE", "LOW", "MEDIUM", "HIGH", "CRITICAL"] as const) {
      expect(typeof s.bySeverity[k]).toBe("number");
    }
    expect(s.topFiles.length).toBeLessThanOrEqual(5);
  });

  // D16 (11.64.0) — guardrail: 0 casts HIGH ni CRITICAL tras aplicar
  // las reglas de degradación (test files → MEDIUM, SAFE-CAST → LOW).
  it("casts baseline: 0 HIGH y 0 CRITICAL", () => {
    const hits = scanCasts(ROOT);
    const s = summarizeCasts(hits);
    expect(s.bySeverity.HIGH).toBe(0);
    expect(s.bySeverity.CRITICAL).toBe(0);
  });

  it("test hygiene baseline: 0 violaciones (excepto baselines temporales)", () => {
    const violations = auditTests(ROOT);
    const nuevos = violations.filter((v) => {
      if (v.rule === "weak-rejects-assertion") return !WEAK_REJECTS_BASELINE.has(v.file);
      if (v.rule === "supabase-mock-helper") return !SUPABASE_MOCK_BASELINE.has(v.file);
      return true;
    });
    expect(nuevos).toEqual([]);
  });
});

