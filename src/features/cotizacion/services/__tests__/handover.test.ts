import { beforeEach, describe, expect, it, vi } from "vitest";
const mock = await vi.hoisted(async () => {
  const { createSupabaseMock } = await import("@/services/__tests__/_supabaseChainMock");
  return createSupabaseMock();
});
vi.mock("@/integrations/supabase/client", () => ({ supabase: mock.supabase }));
import { fetchHandover } from "../handover";

beforeEach(() => { mock.resetResults(); mock.tableCalls.length = 0; });
describe("lectura del handover existente", () => {
  it("filtra tanto por cotización como por empresa", async () => {
    mock.setTableResult("cotizacion_handovers", { data: { id: "h1" }, error: null });
    expect(await fetchHandover("c1", "org1")).toEqual({ id: "h1" });
    const call = mock.tableCalls[0];
    const filters = call.ops.flatMap((op, i) => op === "eq" ? [call.opArgs[i]] : []);
    expect(filters).toContainEqual(["cotizacion_id", "c1"]);
    expect(filters).toContainEqual(["organization_id", "org1"]);
  });
  it("no inventa un handover cuando todavía no existe", async () => {
    mock.setTableResult("cotizacion_handovers", { data: null, error: null });
    expect(await fetchHandover("c1", "org1")).toBeNull();
  });
  it("propaga errores de lectura para mostrar reintento", async () => {
    mock.setTableResult("cotizacion_handovers", { data: null, error: { message: "Sin acceso" } });
    await expect(fetchHandover("c1", "org1")).rejects.toThrow();
  });
});