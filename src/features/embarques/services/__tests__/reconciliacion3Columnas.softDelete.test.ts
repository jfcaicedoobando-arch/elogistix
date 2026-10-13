import { beforeEach, describe, expect, it, vi } from "vitest";
const mock = await vi.hoisted(async () => {
  const { createSoftDeleteReadMock } = await import("@/services/__tests__/_softDeleteReadMock");
  return createSoftDeleteReadMock();
});
const deps = vi.hoisted(() => ({ costos: vi.fn(), reales: vi.fn(), interno: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: mock.supabase }));
vi.mock("@/features/cotizacion/services/versionado", () => ({ obtenerCostosCotizacionVersion: deps.costos }));
vi.mock("../reconciliacionCostos", () => ({ fetchReconciliacionEmbarque: deps.reales }));
vi.mock("../internoEmbarque", () => ({ obtenerEmbarqueInterno: deps.interno }));
import { obtenerReconciliacion3Columnas } from "../reconciliacion3Columnas";
import { setAuthSnapshot } from "@/lib/auth/authSnapshot";
import { syncActiveOrganizationScope } from "@/lib/auth/authOperationScope";

const deleted_at = "2026-10-01T00:00:00Z";
const embarque = { organization_id: "org-test", cotizacion_id: "cot1", tipo_cambio_usd: 18, tipo_cambio_eur: 20 };
beforeEach(() => {
  mock.reset();
  setAuthSnapshot({ userId: "u-test", organizationId: "org-test", role: "admin", effectiveRole: "admin", email: null, organizationName: null });
  syncActiveOrganizationScope({ userId: "u-test", organizationId: "org-test" });
  deps.costos.mockReset().mockResolvedValue([{ concepto: "Flete", moneda: "MXN", costo_total: 100 }]);
  deps.reales.mockReset().mockResolvedValue([{ concepto: "Flete", moneda: "MXN", real_facturado: 105, facturas: [{ excluida: false }] }]);
  deps.interno.mockReset().mockResolvedValue(null);
});

describe("reconciliación: sólo orígenes vivos", () => {
  it.each([null, { ...embarque, deleted_at }])("embarque ausente/borrado retorna vacío sin más consultas: %j", async row => {
    mock.queue("embarques", row);
    expect(await obtenerReconciliacion3Columnas("emb1")).toMatchObject({ filas: [], tiene_cotizacion: false, version_aceptada: null });
    expect(mock.tableCalls).toHaveLength(1);
    expect(mock.tableCalls[0].opArgs).toContainEqual(["deleted_at", null]);
    expect(deps.costos).not.toHaveBeenCalled(); expect(deps.reales).not.toHaveBeenCalled(); expect(deps.interno).not.toHaveBeenCalled();
  });
  it.each([null, { version_aceptada: 2, deleted_at }])("cotización ausente/borrada corta antes de RPC: %j", async row => {
    mock.queue("embarques", embarque); mock.queue("cotizaciones", row);
    await expect(obtenerReconciliacion3Columnas("emb1")).rejects.toThrow(/cotización de origen ya no está disponible/);
    expect(deps.costos).not.toHaveBeenCalled(); expect(deps.reales).not.toHaveBeenCalled(); expect(deps.interno).not.toHaveBeenCalled();
    expect(mock.tableCalls[1].opArgs).toContainEqual(["deleted_at", null]);
  });
  it.each([2, null])("conserva la versión %j de cotización viva y los importes reales", async version => {
    mock.queue("embarques", embarque); mock.queue("cotizaciones", { version_aceptada: version });
    const result = await obtenerReconciliacion3Columnas("emb1");
    expect(result).toMatchObject({ tiene_cotizacion: true, version_aceptada: version,
      filas: [expect.objectContaining({ concepto: "Flete", cotizado: 100, real: 105 })] });
    expect(deps.costos).toHaveBeenCalledExactlyOnceWith("cot1", version);
    expect(deps.reales).toHaveBeenCalledExactlyOnceWith("emb1");
    expect(deps.interno).toHaveBeenCalledExactlyOnceWith("emb1");
    expect(mock.tableCalls[0].opArgs).toContainEqual(["id", "emb1"]);
    expect(mock.tableCalls[1].opArgs).toContainEqual(["id", "cot1"]);
    for (const call of mock.tableCalls) expect(call.opArgs).toContainEqual(["deleted_at", null]);
  });
  it("embarque vivo sin cotización conserva reales sin consultar costos versionados", async () => {
    mock.queue("embarques", { ...embarque, cotizacion_id: null });
    const result = await obtenerReconciliacion3Columnas("emb1");
    expect(result).toMatchObject({ tiene_cotizacion: false, version_aceptada: null,
      filas: [expect.objectContaining({ real: 105 })] });
    expect(deps.costos).not.toHaveBeenCalled(); expect(mock.tableCalls).toHaveLength(1);
  });
  it("error al leer cotización no dispara RPC", async () => {
    mock.queue("embarques", embarque); mock.queue("cotizaciones", null, { message: "error-lectura" });
    await expect(obtenerReconciliacion3Columnas("emb1")).rejects.toThrow("error-lectura");
    expect(deps.costos).not.toHaveBeenCalled();
  });
});
