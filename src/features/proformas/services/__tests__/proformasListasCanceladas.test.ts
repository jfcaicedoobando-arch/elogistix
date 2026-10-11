import { beforeEach, describe, expect, it, vi } from "vitest";
const mock = await vi.hoisted(async () => {
  const { createSupabaseMock } = await import("@/services/__tests__/_supabaseChainMock");
  return createSupabaseMock();
});
vi.mock("@/integrations/supabase/client", () => ({ supabase: mock.supabase }));
import { fetchProformasListas, fetchProformasListasCount } from "@/features/facturacion/services/proformasListas";

describe("bandeja y conteo de proformas listas", () => {
  beforeEach(() => { mock.tableCalls.length = 0; mock.resetResults(); });
  it.each([fetchProformasListas, fetchProformasListasCount])("excluye canceladas y conserva tenant, aceptación, moneda y papelera", async (fetch) => {
    await fetch("synthetic-org");
    expect(mock.tableCalls[0].opArgs).toContainEqual(["organization_id", "synthetic-org"]);
    expect(mock.tableCalls[0].opArgs).toContainEqual(["estado_proforma", "cancelada"]);
    expect(mock.tableCalls[0].opArgs).toContainEqual(["estado_proforma", "facturada"]);
    expect(mock.tableCalls[0].opArgs).toContainEqual(["estado_cliente", "aceptada"]);
    expect(mock.tableCalls[0].opArgs).toContainEqual(["deleted_at", null]);
    expect(mock.tableCalls[0].opArgs).toContainEqual(["factura_id", null]);
  });
});
