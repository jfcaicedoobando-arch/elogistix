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
]);

// Baseline temporal de archivos con `.rejects.toBeDefined()/toBeTruthy()`.
// Estos casos NO garantizan que el error correcto fue lanzado. Refactorizar
// progresivamente a `.rejects.toThrow(/msg/)` o `.rejects.toMatchObject({ code })`
// y remover el archivo del set. NO agregar nuevos archivos a este baseline.
const WEAK_REJECTS_BASELINE = new Set<string>([
  "src/features/cliente/services/__tests__/contactos.test.ts",
  "src/features/cliente/services/__tests__/crud.test.ts",
  "src/features/costeo/services/__tests__/demorasVenta.test.ts",
  "src/features/cotizacion/services/__tests__/costos.test.ts",
  "src/features/cotizacion/services/__tests__/queries.test.ts",
  "src/features/cotizacion/services/mutations/__tests__/crear.test.ts",
  "src/features/cotizacion/services/mutations/__tests__/estado.test.ts",
  "src/features/cotizacion/services/mutations/__tests__/update.test.ts",
  "src/features/crm/services/__tests__/actividades.test.ts",
  "src/features/crm/services/__tests__/cliente360.test.ts",
  "src/features/crm/services/__tests__/etapas.test.ts",
  "src/features/crm/services/__tests__/forecast.test.ts",
  "src/features/crm/services/__tests__/leaderboard.test.ts",
  "src/features/crm/services/__tests__/lineage.test.ts",
  "src/features/crm/services/__tests__/oportunidades.test.ts",
  "src/features/crm/services/__tests__/plantillas.test.ts",
  "src/features/crm/services/__tests__/prospectoSearch.test.ts",
  "src/features/crm/services/leads/__tests__/convertir.test.ts",
  "src/features/crm/services/leads/__tests__/mutations.test.ts",
  "src/features/crm/services/vincularCotizacion/__tests__/helpers.test.ts",
  "src/features/crm/services/vincularCotizacion/__tests__/propagarConversion.test.ts",
  "src/features/crm/services/vincularCotizacion/__tests__/sincronizarEtapa.test.ts",
  "src/features/cxp/services/__tests__/conceptosCostoVinculables.test.ts",
  "src/features/embarques/services/__tests__/demorasEmbarque.test.ts",
  "src/features/embarques/services/__tests__/garantias.test.ts",
  "src/features/embarques/services/contenedores/__tests__/crudExtra.test.ts",
  "src/features/facturas/services/__tests__/detail.test.ts",
  "src/features/facturas/services/__tests__/facturasIndex.test.ts",
  "src/features/facturas/services/__tests__/notasCredito.test.ts",
  "src/features/portal/services/__tests__/perfil.test.ts",
  "src/features/proveedor/services/__tests__/operaciones.test.ts",
  "src/features/proveedor/services/__tests__/proveedor.test.ts",
  "src/services/admin/__tests__/members.test.ts",
  "src/services/admin/__tests__/organizations.test.ts",
  "src/services/admin/__tests__/papelera.test.ts",
  "src/services/admin/__tests__/stats.test.ts",
  "src/services/embarques/__tests__/dependenciasFinancieras.test.ts",
  "src/services/pagos-factura/__tests__/pagos.test.ts",
  "src/services/pagos-factura/__tests__/pagosFactura.test.ts",
  "src/services/proforma/__tests__/crud.test.ts",
  "src/services/usuario/__tests__/usuario.test.ts",

]);

// Baseline temporal de tests que mockean supabase sin createSupabaseMock.
// Normalizar uno por uno migrando a `@/services/__tests__/_supabaseChainMock`.
const SUPABASE_MOCK_BASELINE = new Set<string>([
  "src/features/auditoria/services/__tests__/reporte.test.ts",
  "src/features/cliente/services/usuarios/__tests__/index.test.ts",
  "src/features/cxp/services/__tests__/parseCfdi.test.ts",
  "src/services/__tests__/csfService.test.ts",
  "src/services/__tests__/idempotency.integration.test.ts",
  "src/services/__tests__/tracking.test.ts",
  "src/services/admin/__tests__/stats.test.ts",
  "src/services/csf/__tests__/index.test.ts",
  "src/services/observability/__tests__/logClientError.test.ts",
  "src/services/storage/__tests__/facturas.test.ts",
  "src/services/storage/__tests__/index.test.ts",
  "src/services/tracking/__tests__/index.test.ts",
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

