import { beforeEach, expect, it, vi } from "vitest";
const mock = await vi.hoisted(async () => {
  const { createSupabaseMock } = await import("@/services/__tests__/_supabaseChainMock");
  return createSupabaseMock();
});
vi.mock("@/integrations/supabase/client", () => ({ supabase: mock.supabase }));
import { fetchCotizacionDraftSnapshot } from "../draftSnapshot";
const row = { id: "q", organization_id: "o", updated_at: "stamp", deleted_at: null, estado: "Borrador", embarque_id: null, conceptos_venta: [], tipo_cambio_usd: null };
beforeEach(() => { mock.resetResults(); mock.tableCalls.length = 0; });
it("lee identidad, estado, sello y ventas juntos con tenant e id explícitos", async () => {
  mock.setTableResult("cotizaciones", { data: row, error: null });
  expect(await fetchCotizacionDraftSnapshot("q", "o")).toEqual(row);
  expect(mock.tableCalls).toHaveLength(1);
  const call = mock.tableCalls[0];
  expect(call.opArgs).toEqual(expect.arrayContaining([["id", "q"], ["organization_id", "o"], ["deleted_at", null]]));
  expect(call.opArgs[call.ops.indexOf("select")][0]).toContain("conceptos_venta");
});
it("sin fila no inventa snapshot", async () => {
  mock.setTableResult("cotizaciones", { data: null, error: null });
  expect(await fetchCotizacionDraftSnapshot("q", "o")).toBeNull();
});
it("red/permisos fallan cerrado", async () => {
  mock.setTableResult("cotizaciones", { data: null, error: { message: "offline" } });
  await expect(fetchCotizacionDraftSnapshot("q", "o")).rejects.toThrow();
});
