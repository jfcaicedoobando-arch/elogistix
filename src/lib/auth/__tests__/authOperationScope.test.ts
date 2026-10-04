import { beforeEach, describe, expect, it } from "vitest";
import { setAuthSnapshot } from "../authSnapshot";
import { captureAuthOperationScope, syncActiveOrganizationScope } from "../authOperationScope";
import { buildErrorReport } from "@/lib/ui/errorReport";
import { isCurrentErrorReport } from "@/lib/diagnostics/errorReportScope";

beforeEach(() => {
  setAuthSnapshot({ userId: "u1", email: null, organizationId: null, organizationName: null, role: "super_admin", effectiveRole: "super_admin" });
  syncActiveOrganizationScope({ userId: "u1", organizationId: "org1" });
});
describe("Ámbito efectivo de operaciones y PR120", () => {
  it("sin cambio real de contexto conserva la operación y el reporte", () => {
    const scope = captureAuthOperationScope(); const report = buildErrorReport({ error: new Error("fallo original") });
    syncActiveOrganizationScope({ userId: "u1", organizationId: "org1" });
    expect(scope.isCurrent()).toBe(true); expect(isCurrentErrorReport(report)).toBe(true);
  });
  it("tenant efectivo distinto invalida operación y acción anterior aun con perfil de plataforma null", () => {
    const scope = captureAuthOperationScope(); const report = buildErrorReport({ error: new Error("fallo original") });
    syncActiveOrganizationScope({ userId: "u1", organizationId: "org2" });
    expect(scope.isCurrent()).toBe(false); expect(isCurrentErrorReport(report)).toBe(false);
    expect(captureAuthOperationScope().isCurrent()).toBe(true);
  });
  it("regresar al tenant original no revive la operación obsoleta", () => {
    const scope = captureAuthOperationScope();
    syncActiveOrganizationScope({ userId: "u1", organizationId: "org2" });
    syncActiveOrganizationScope({ userId: "u1", organizationId: "org1" });
    expect(scope.isCurrent()).toBe(false);
  });
  it("cambio de usuario o rol conserva la invalidación de PR120", () => {
    const scope = captureAuthOperationScope();
    setAuthSnapshot({ userId: "u2", email: null, organizationId: null, organizationName: null, role: "super_admin", effectiveRole: "super_admin" });
    expect(scope.isCurrent()).toBe(false);
  });
});
