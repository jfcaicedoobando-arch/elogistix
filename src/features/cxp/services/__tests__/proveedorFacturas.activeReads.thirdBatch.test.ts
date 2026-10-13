import { beforeEach, describe, expect, it, vi } from "vitest";
const mock = await vi.hoisted(async () => {
  const { createSoftDeleteReadMock } = await import("@/services/__tests__/_softDeleteReadMock"); return createSoftDeleteReadMock();
});
const spies = vi.hoisted(() => ({ dup: vi.fn(), saldo: vi.fn(), actividad: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: mock.supabase }));
vi.mock("@/features/cxp/services/proveedorFacturas", () => ({ existeFacturaDuplicada: spies.dup }));
vi.mock("@/features/cxp/services/saldosProveedorFactura", () => ({ fetchSaldosProveedorFacturas: spies.saldo }));
vi.mock("@/services/bitacora/registrar", () => ({ registrarActividad: spies.actividad }));
import { fetchFacturaParaEdicion, actualizarFacturaProveedor, type ActualizarFacturaPayload } from "@/features/cxp/services/proveedorFacturas.update";
import { setAuthSnapshot } from "@/lib/auth/authSnapshot";
import { syncActiveOrganizationScope } from "@/lib/auth/authOperationScope";
function usuario(userId = "actor-test", organizationId = "org-test") {
  setAuthSnapshot({ userId, organizationId, role: "admin", effectiveRole: "admin", email: null, organizationName: null });
  syncActiveOrganizationScope({ userId, organizationId });
}
const from = mock.supabase.from.getMockImplementation()!;
beforeEach(() => {
  usuario(); mock.reset(); mock.supabase.from.mockImplementation(from); spies.actividad.mockReset();
  spies.dup.mockReset().mockResolvedValue(false);
  spies.saldo.mockReset().mockResolvedValue(new Map([["f1", { pagado: 0, notas_credito: 0, saldo: 116 }]]));
});
const sinEfectos = () => { expect(mock.tableCalls.some(c => c.ops.includes("update"))).toBe(false); expect(spies.actividad).not.toHaveBeenCalled(); };
const filtros = (index: number) => {
  expect(mock.tableCalls[index].opArgs).toContainEqual(["deleted_at", null]);
  expect(mock.tableCalls[index].opArgs).toContainEqual(["organization_id", "org-test"]);
};
const payload: ActualizarFacturaPayload = { folio_proveedor: "TEST-1", fecha_emision: "2026-10-01", fecha_vencimiento: "2026-10-31", dias_credito: 30,
  moneda: "MXN", tipo_cambio_usd: 1, subtotal: 100, iva: 16, ieps: 0, retenciones: 0, categoria_presupuesto_id: "cat-test", notas: "nota-test" };
const factura = { id: "f1", proveedor_id: "prov-test", estado_aprobacion: "aprobada", ...payload };
describe("factura proveedor: dos prelecturas vivas", () => {
  it.each([null, { ...factura, deleted_at: "2026-10-01" }])("precarga ausente/borrada retorna null: %j", async row => {
    mock.queue("proveedor_facturas", row); expect(await fetchFacturaParaEdicion("f1")).toBeNull(); filtros(0); sinEfectos();
  });
  it("precarga viva conserva campos y filtro id", async () => {
    mock.queue("proveedor_facturas", factura); expect(await fetchFacturaParaEdicion("f1")).toEqual(factura);
    filtros(0); expect(mock.tableCalls[0].opArgs).toContainEqual(["id", "f1"]);
  });
  it.each([null, { ...factura, deleted_at: "2026-10-01" }])("edición rechaza ausencia/baja antes de validar o UPDATE: %j", async row => {
    mock.queue("proveedor_facturas", row); await expect(actualizarFacturaProveedor("f1", payload)).rejects.toMatchObject({ code: "NOT_FOUND" });
    sinEfectos(); expect(spies.dup).not.toHaveBeenCalled(); expect(spies.saldo).not.toHaveBeenCalled();
  });
  it("viva mantiene bloqueo optimista, total y notas sin reaprobar", async () => {
    mock.queue("proveedor_facturas", factura); mock.queue("proveedor_facturas", [{ ...factura, total: 116 }]);
    expect(await actualizarFacturaProveedor("f1", payload, "sello-test")).toMatchObject({ id: "f1", total: 116 });
    filtros(0); filtros(1); expect(mock.tableCalls[1].opArgs).toContainEqual(["updated_at", "sello-test"]);
    expect(mock.getMutationPayload("proveedor_facturas", "update")).toMatchObject({ total: 116, notas: payload.notas });
    expect(mock.getMutationPayload("proveedor_facturas", "update")).not.toHaveProperty("estado_aprobacion");
    expect(spies.actividad).toHaveBeenCalledOnce();
  });
  it.each(["normal", "optimista"])("baja entre lectura y UPDATE %s rechaza cero filas sin bitácora", async modo => {
    mock.queue("proveedor_facturas", factura); mock.queue("proveedor_facturas", [{ ...factura, deleted_at: "2026-10-01" }]);
    await expect(actualizarFacturaProveedor("f1", payload, modo === "optimista" ? "sello" : undefined)).rejects.toThrow(modo === "optimista" ? /LC_CONFLICTO_CONCURRENCIA/ : /No se guardaron/);
    filtros(1); expect(spies.actividad).not.toHaveBeenCalled();
  });
  it.each(["precarga", "edición"])("error de %s se propaga sin efectos", async modo => {
    const error = new Error("lectura-factura"); mock.queue("proveedor_facturas", null, error);
    await expect(modo === "precarga" ? fetchFacturaParaEdicion("f1") : actualizarFacturaProveedor("f1", payload)).rejects.toBe(error); sinEfectos();
  });
  it.each(["precarga", "edición"])("cambio de contexto durante %s aborta antes de UPDATE", async modo => {
    mock.queue("proveedor_facturas", factura); const pendiente = modo === "precarga" ? fetchFacturaParaEdicion("f1") : actualizarFacturaProveedor("f1", payload);
    usuario("otro-actor", "otra-org"); await expect(pendiente).rejects.toThrow(/canceló/); sinEfectos();
  });
  it("cambio de organización durante validación de saldo impide UPDATE", async () => {
    mock.queue("proveedor_facturas", factura); spies.saldo.mockImplementation(async () => { usuario("actor-test", "otra-org"); return new Map([["f1", { pagado: 0, notas_credito: 0, saldo: 116 }]]); });
    await expect(actualizarFacturaProveedor("f1", payload)).rejects.toThrow(/canceló/); sinEfectos();
  });
});
