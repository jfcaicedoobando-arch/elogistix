import { beforeEach, describe, expect, it, vi } from "vitest";
const mock = await vi.hoisted(async () => {
  const { createSoftDeleteReadMock } = await import("@/services/__tests__/_softDeleteReadPlanMock");
  return createSoftDeleteReadMock();
});
vi.mock("@/integrations/supabase/client", () => ({ supabase: mock.supabase }));
import { resolverFacturaIdsPorBusqueda } from "../facturaSearchHelper";
import { CAP_POSTGREST } from "@/constants/queryCaps";
beforeEach(() => mock.reset());
describe("búsqueda de facturas: sólo proveedores vivos", () => {
  it("conserva búsqueda, dedupe y límites de las tres consultas", async () => {
    mock.queue("proveedor_facturas", [{ id: "f1" }]); mock.queue("proveedores", [{ id: "prov1" }]);
    mock.queue("proveedor_facturas", [{ id: "f1" }, { id: "f2" }]);
    expect(await resolverFacturaIdsPorBusqueda("Naviera ficticia")).toEqual(["f1", "f2"]);
    for (const call of mock.tableCalls) {
      expect(call.opArgs).toContainEqual(["deleted_at", null]); expect(call.opArgs).toContainEqual([CAP_POSTGREST]);
    }
    expect(mock.tableCalls[0].ops).toContain("or");
    expect(mock.tableCalls[1].opArgs).toContainEqual(["nombre", "%Naviera ficticia%"]);
    expect(mock.tableCalls[2].opArgs).toContainEqual(["proveedor_id", ["prov1"]]);
  });
  it.each([{ rows: [] }, { rows: [{ id: "prov1", deleted_at: "2026-10-01" }] }])("no expande proveedor ausente/borrado y conserva factura viva: %j", async ({ rows }) => {
    mock.queue("proveedor_facturas", [{ id: "f1" }]); mock.queue("proveedores", rows);
    expect(await resolverFacturaIdsPorBusqueda("f1")).toEqual(["f1"]); expect(mock.tableCalls).toHaveLength(2);
  });
  it("propaga error del lookup de proveedor sin expansión", async () => {
    const error = new Error("lectura-proveedor"); mock.queue("proveedor_facturas", []); mock.queue("proveedores", null, error);
    await expect(resolverFacturaIdsPorBusqueda("test")).rejects.toBe(error); expect(mock.tableCalls).toHaveLength(2);
  });
});
