import { beforeEach, describe, expect, it, vi } from "vitest";
const mock = await vi.hoisted(async () => {
  const { createSimpleFilteredReadMock } = await import("@/services/__tests__/_simpleFilteredReadMock"); return createSimpleFilteredReadMock();
});
vi.mock("@/integrations/supabase/client", () => ({ supabase: mock.supabase }));
import { fetchMotivosPerdida } from "../etapas";
const matriz = [
  { id: "activo-vivo", nombre: "Zeta activo", activa: true, deleted_at: null },
  { id: "inactivo-vivo", nombre: "Alfa inactivo", activa: false, deleted_at: null },
  { id: "activo-baja", nombre: "Activo eliminado", activa: true, deleted_at: "2026-10-01" },
  { id: "inactivo-baja", nombre: "Inactivo eliminado", activa: false, deleted_at: "2026-10-01" },
];
beforeEach(() => mock.reset());
describe.each([true, false])("crm/motivosPerdida: soloActivos=%s", soloActivos => {
  it("matriz viva/baja y activa/inactiva conserva semántica y orden", async () => {
    mock.source("crm_motivos_perdida", matriz);
    expect(await fetchMotivosPerdida(soloActivos)).toEqual(soloActivos
      ? [{ id: "activo-vivo", nombre: "Zeta activo", activa: true }]
      : [{ id: "inactivo-vivo", nombre: "Alfa inactivo", activa: false }, { id: "activo-vivo", nombre: "Zeta activo", activa: true }]);
    const call = mock.tableCalls[0]; expect(call.opArgs).toContainEqual(["deleted_at", null]);
    expect(call.opArgs[call.ops.indexOf("select")]).toEqual(["id, nombre, activa"]);
    expect(call.opArgs[call.ops.indexOf("order")]).toEqual(["nombre"]);
    expect(call.opArgs.some(args => args[0] === "activa")).toBe(soloActivos);
  });
  it("sólo bajas devuelve vacío aun cuando son activas", async () => {
    mock.source("crm_motivos_perdida", matriz.filter(r => r.deleted_at)); expect(await fetchMotivosPerdida(soloActivos)).toEqual([]);
  });
  it("null devuelve vacío", async () => {
    mock.source("crm_motivos_perdida", null); expect(await fetchMotivosPerdida(soloActivos)).toEqual([]);
  });
  it("error se propaga sin sustituirlo por vacío", async () => {
    const error = new Error("lectura-motivos"); mock.source("crm_motivos_perdida", null, error);
    await expect(fetchMotivosPerdida(soloActivos)).rejects.toBe(error);
  });
});
it("crm/motivosPerdida: rama por defecto devuelve sólo activos vivos", async () => {
  mock.source("crm_motivos_perdida", matriz); expect((await fetchMotivosPerdida()).map(r => r.id)).toEqual(["activo-vivo"]);
});
