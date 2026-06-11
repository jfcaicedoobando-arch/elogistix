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
  "src/pages/auth/ForgotPasswordDialog.tsx",
  "src/pages/auth/ResetPassword.tsx",
]);

// Sincronizado con OVERSIZED_BASELINE en architecture-baseline.test.ts.
const OVERSIZED_BASELINE = new Set<string>([
  "src/pages/auth/Login.tsx",
  "src/lib/mappers/genericPayloadMapper.ts",
  "src/components/proveedor/NuevoProveedorDialog.tsx",
  "src/pages/proveedores/ProveedorDetalle.tsx",
  "src/features/embarques/components/StepCostosPrecios.tsx",
  "src/features/costeo/components/TarifaForm.tsx",
  "src/hooks/proveedor/useNuevoProveedorController.ts",
  "src/components/proveedor/EditarProveedorDialog.tsx",
  "src/services/proveedor/index.ts",
  "src/components/usuario/NuevoUsuarioDialog.tsx",
  "src/hooks/cxp/useNuevaFacturaProveedorForm.ts",
  "src/lib/csv/parseCsv.ts",
  "src/pages/proveedores/Proveedores.tsx",
]);

describe("audit-report", () => {
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

  it("test hygiene baseline: 0 violaciones", () => {
    expect(auditTests(ROOT)).toEqual([]);
  });
});
