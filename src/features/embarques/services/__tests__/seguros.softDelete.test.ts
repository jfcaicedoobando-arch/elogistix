import { beforeEach, describe, expect, it, vi } from "vitest";
const mock = await vi.hoisted(async () => {
  const { createSoftDeleteReadMock } = await import("@/services/__tests__/_softDeleteReadPlanMock");
  return createSoftDeleteReadMock();
});
const { bitacora } = vi.hoisted(() => ({ bitacora: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: mock.supabase }));
vi.mock("../bitacoraEmbarques", () => ({ registrarBitacoraEmbarque: bitacora }));
import { createSeguroEmbarque, type SeguroEmbarqueInput } from "../seguros";
import { setAuthSnapshot } from "@/lib/auth/authSnapshot";
import { syncActiveOrganizationScope } from "@/lib/auth/authOperationScope";
const input: SeguroEmbarqueInput = { embarque_id: "emb1", aseguradora: "Aseguradora ficticia", numero_poliza: "POL-TEST",
  certificado_url: null, cobertura_descripcion: null, suma_asegurada: 1000, deducible: 0, prima: 100, moneda: "MXN",
  vigencia_desde: "2026-10-01", vigencia_hasta: "2026-10-31", contacto: null, notas: null, proveedor_factura_id: null };
const from = mock.supabase.from.getMockImplementation()!;
function usuario(userId = "actor-test", organizationId = "org-test") {
  setAuthSnapshot({ userId, organizationId, role: "admin", effectiveRole: "admin", email: null, organizationName: null });
  syncActiveOrganizationScope({ userId, organizationId });
}
beforeEach(() => { usuario(); mock.reset(); mock.supabase.from.mockImplementation(from); bitacora.mockReset(); });
const sinEscrituras = () => {
  expect(mock.tableCalls.some(call => call.ops.includes("insert"))).toBe(false);
  expect(mock.rpcCalls).toHaveLength(0); expect(bitacora).not.toHaveBeenCalled();
};
describe.each([
  { nombre: "sin organización explícita", organization_id: undefined },
  { nombre: "con organización explícita", organization_id: "org-test" },
])("creación $nombre: padre vivo y organización correcta", ({ organization_id }) => {
  const payload = () => ({ ...input, ...(organization_id ? { organization_id } : {}) });
  it.each([null, { organization_id: "org-test", deleted_at: "2026-10-01" }])("rechaza padre ausente/borrado antes de INSERT: %j", async row => {
    mock.queue("embarques", row);
    await expect(createSeguroEmbarque(payload())).rejects.toThrow(/Embarque sin organización/); sinEscrituras();
    expect(mock.tableCalls).toHaveLength(1); expect(mock.tableCalls[0].opArgs).toContainEqual(["deleted_at", null]);
  });
  it("rechaza padre de organización distinta antes de INSERT y bitácora", async () => {
    mock.queue("embarques", { organization_id: "otra-org" });
    await expect(createSeguroEmbarque(payload())).rejects.toMatchObject({ code: "ORG_MISMATCH" }); sinEscrituras();
  });
  it("valida padre y organización antes de crear y registrar una sola vez", async () => {
    mock.queue("embarques", { organization_id: "org-test" }); const row = { id: "seg1", ...input, organization_id: "org-test" };
    mock.queue("seguros_embarque", row);
    expect(await createSeguroEmbarque(payload())).toEqual(row);
    expect(mock.tableCalls.map(call => call.table)).toEqual(["embarques", "seguros_embarque"]);
    expect(mock.tableCalls[0].opArgs).toContainEqual(["id", input.embarque_id]);
    expect(mock.tableCalls[0].opArgs).toContainEqual(["deleted_at", null]);
    expect(mock.getMutationPayload("seguros_embarque")).toEqual({ ...input, organization_id: "org-test" });
    expect(bitacora).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ organizationId: "org-test", authScope: expect.objectContaining({ organizationId: "org-test" }) }));
  });
  it("error al leer padre se propaga sin INSERT", async () => {
    const error = new Error("lectura-embarque"); mock.queue("embarques", null, error);
    await expect(createSeguroEmbarque(payload())).rejects.toBe(error); sinEscrituras();
  });
  it("rechazo de INSERT tras validar padre no registra éxito", async () => {
    mock.queue("embarques", { organization_id: "org-test" }); const error = new Error("rechazo-servidor");
    mock.queue("seguros_embarque", null, error);
    await expect(createSeguroEmbarque(payload())).rejects.toBe(error); expect(bitacora).not.toHaveBeenCalled();
  });
  it.each(["usuario", "organización"])("cambio de %s durante lookup corta antes de INSERT", async cambio => {
    mock.queue("embarques", { organization_id: "org-test" });
    const pendiente = createSeguroEmbarque(payload());
    usuario(cambio === "usuario" ? "otro-actor" : "actor-test", cambio === "organización" ? "otra-org" : "org-test");
    await expect(pendiente).rejects.toThrow(/canceló/); sinEscrituras();
  });
  it("si cambia sesión tras iniciar INSERT no simula aborto ni registra con otra sesión", async () => {
    mock.queue("embarques", { organization_id: "org-test" }); const row = { id: "seg1", ...input, organization_id: "org-test" };
    mock.queue("seguros_embarque", row);
    mock.supabase.from.mockImplementation(table => {
      const chain = from(table);
      if (table === "seguros_embarque") {
        const single = chain.single as () => Promise<unknown>;
        chain.single = () => { const result = single(); usuario("otro-actor"); return result; };
      }
      return chain;
    });
    expect(await createSeguroEmbarque(payload())).toEqual(row); expect(bitacora).not.toHaveBeenCalled();
    expect(mock.tableCalls.filter(call => call.ops.includes("insert"))).toHaveLength(1);
  });
});
it("organización explícita ajena se rechaza aunque el padre coincida con el ámbito activo", async () => {
  mock.queue("embarques", { organization_id: "org-test" });
  await expect(createSeguroEmbarque({ ...input, organization_id: "otra-org" })).rejects.toMatchObject({ code: "ORG_MISMATCH" }); sinEscrituras();
});
