import { beforeEach, expect, it, vi } from "vitest";
const mock = await vi.hoisted(async () => {
  const { createSupabaseMock } = await import("@/services/__tests__/_supabaseChainMock");
  return createSupabaseMock();
});
vi.mock("@/integrations/supabase/client", () => ({ supabase: mock.supabase }));
import { registrarBitacoraEmbarque } from "../bitacoraEmbarques";
import { captureAuthOperationScope, syncActiveOrganizationScope } from "@/lib/auth/authOperationScope";
import { setAuthSnapshot } from "@/lib/auth/authSnapshot";
function usuario(userId = "actor-test") {
  setAuthSnapshot({ userId, organizationId: "org-test", role: "admin", effectiveRole: "admin", email: null, organizationName: null });
  syncActiveOrganizationScope({ userId, organizationId: "org-test" });
}
beforeEach(() => {
  usuario(); mock.resetResults(); mock.rpcCalls.length = 0;
  mock.supabase.auth.getSession.mockReset().mockResolvedValue({ data: { session: { user: { id: "actor-test" }, access_token: "fixture" } }, error: null });
});
it("conserva el contrato sin scope de los demás callers", async () => {
  await registrarBitacoraEmbarque({ accion: "Actualizó seguro", entidadId: "emb-test" });
  expect(mock.rpcCalls).toEqual([{ fn: "registrar_bitacora", args: expect.objectContaining({ p_modulo: "embarques", p_entidad_id: "emb-test" }) }]);
  expect(mock.rpcCalls[0].args).not.toHaveProperty("p_organization_id");
});
it("propaga organización y captura de sesión al registrador existente", async () => {
  await registrarBitacoraEmbarque({ accion: "Creó seguro", entidadId: "emb-test", organizationId: "org-test", authScope: captureAuthOperationScope() });
  expect(mock.rpcCalls).toEqual([{ fn: "registrar_bitacora", args: expect.objectContaining({ p_organization_id: "org-test", p_modulo: "embarques" }) }]);
});
it("cambio de sesión durante getSession impide la RPC de bitácora", async () => {
  const scoped = { accion: "Creó seguro", entidadId: "emb-test", organizationId: "org-test", authScope: captureAuthOperationScope() };
  mock.supabase.auth.getSession.mockImplementation(async () => {
    usuario("otro-actor");
    return { data: { session: { user: { id: "otro-actor" }, access_token: "fixture" } }, error: null };
  });
  await registrarBitacoraEmbarque(scoped); expect(mock.rpcCalls).toHaveLength(0);
});
