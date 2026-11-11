import { beforeEach, describe, expect, it, vi } from "vitest";
const mock = await vi.hoisted(async () => {
  const { createSoftDeleteReadMock } = await import("./_softDeleteReadMock"); return createSoftDeleteReadMock();
});
const spies = vi.hoisted(() => ({ actividad: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: mock.supabase }));
vi.mock("@/services/bitacora/registrar", () => ({ registrarActividad: spies.actividad }));
import { fetchSustitutaEstado } from "@/features/facturacion/services/sustitucionEstado";
import { setAuthSnapshot } from "@/lib/auth/authSnapshot";
import { syncActiveOrganizationScope } from "@/lib/auth/authOperationScope";
function usuario(userId = "actor-test", organizationId = "org-test") {
  setAuthSnapshot({ userId, organizationId, role: "admin", effectiveRole: "admin", email: null, organizationName: null });
  syncActiveOrganizationScope({ userId, organizationId });
}
const from = mock.supabase.from.getMockImplementation()!;
beforeEach(() => {
  usuario(); mock.reset(); mock.supabase.from.mockImplementation(from); spies.actividad.mockReset();
});
const sinEfectos = () => { expect(mock.tableCalls.some(c => c.ops.includes("update"))).toBe(false); expect(spies.actividad).not.toHaveBeenCalled(); };
const filtros = (index: number) => {
  expect(mock.tableCalls[index].opArgs).toContainEqual(["deleted_at", null]);
  expect(mock.tableCalls[index].opArgs).toContainEqual(["organization_id", "org-test"]);
};
describe("estado de sustituta: sólo borrado lógico determina ausencia", () => {
  it.each([null, { id: "f1", estado: "Borrador", uuid_fiscal: null, deleted_at: "2026-10-01" }])("ausente/borrado devuelve null: %j", async row => {
    mock.queue("facturas", row); expect(await fetchSustitutaEstado("f1")).toBeNull(); filtros(0); sinEfectos();
  });
  it.each(["Borrador", "Cancelada", "Sustituida", "Emitida"])("conserva estado vivo %s", async estado => {
    const row = { id: "f1", estado, uuid_fiscal: "uuid-fixture" }; mock.queue("facturas", row);
    expect(await fetchSustitutaEstado("f1")).toEqual(row); filtros(0);
  });
  it("error se propaga sin convertirlo en ausencia", async () => {
    const error = new Error("lectura-sustituta"); mock.queue("facturas", null, error); await expect(fetchSustitutaEstado("f1")).rejects.toBe(error);
  });
  it("contexto cambiado no entrega estado de otra sesión", async () => {
    mock.queue("facturas", { id: "f1", estado: "Borrador", uuid_fiscal: null }); const pendiente = fetchSustitutaEstado("f1");
    usuario("otro-actor", "otra-org"); await expect(pendiente).rejects.toThrow(/canceló/); sinEfectos();
  });
});
