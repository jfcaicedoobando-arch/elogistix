import { beforeEach, describe, expect, it, vi } from "vitest";
const mock = await vi.hoisted(async () => {
  const { createSupabaseMock } = await import("@/services/__tests__/_supabaseChainMock");
  return createSupabaseMock();
});
vi.mock("@/integrations/supabase/client", () => ({ supabase: mock.supabase }));
import { fetchFacturaById } from "../detail";

beforeEach(() => { mock.resetResults(); mock.tableCalls.length = 0; });
describe("DTO de vigencia del detalle", () => {
  it.each([null, "2026-10-10T10:00:00Z"])("selecciona y transporta deleted_at=%s sin filtrar el detalle", async (deleted_at) => {
    mock.setTableResult("facturas", { data: { id: "f1", deleted_at, sustituida_por: null, proforma_id: null }, error: null });
    const factura = await fetchFacturaById("f1");
    const query = mock.tableCalls[0];
    const selection = query.opArgs[query.ops.indexOf("select")][0] as string;
    expect(selection.split(",").map((field) => field.trim())).toContain("deleted_at");
    expect(factura?.deleted_at).toBe(deleted_at);
    expect(query.ops).not.toContain("is");
  });
});
