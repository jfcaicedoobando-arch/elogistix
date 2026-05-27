/**
 * Smoke test del reporte consolidado. Ejecuta los auditores puros contra
 * el repo y valida el shape esperado del baseline 11.62.0.
 */
import { describe, it, expect } from "vitest";
import { runArchAudit } from "../lib/arch";
import { scanCasts, summarizeCasts } from "../lib/casts";
import { auditTests } from "../lib/tests";

const ROOT = process.cwd();

describe("audit-report", () => {
  it("arch baseline: 0 imports directos en hooks/contexts/components/pages", () => {
    const a = runArchAudit(ROOT);
    expect(a.hooksContextsDirectImports).toEqual([]);
    expect(a.componentsPagesDirectImports).toEqual([]);
  });

  it("arch baseline: 0 archivos productivos > 200 líneas", () => {
    const a = runArchAudit(ROOT);
    expect(a.oversized).toEqual([]);
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

  it("test hygiene baseline: 0 violaciones", () => {
    expect(auditTests(ROOT)).toEqual([]);
  });
});
