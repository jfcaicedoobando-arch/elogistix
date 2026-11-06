import { beforeEach, describe, expect, it, vi } from "vitest";
const mock = await vi.hoisted(async () => {
  const { createSupabaseMock } = await import("@/services/__tests__/_supabaseChainMock");
  return createSupabaseMock();
});
vi.mock("@/integrations/supabase/client", () => ({ supabase: mock.supabase }));
import { fetchHandover, fetchHandoverProveedores } from "../handover";

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
describe("proveedores del handover", () => {
  it("acota el agente por empresa y consulta la naviera global por id", async () => {
    mock.setTableResult("costeo_agentes", { data: { nombre: "Agente QA" }, error: null });
    mock.setTableResult("navieras", { data: { name: "Naviera QA" }, error: null });
    expect(await fetchHandoverProveedores("org1", "a1", "n1")).toEqual({ agente: "Agente QA", naviera: "Naviera QA" });
    const [agente, naviera] = mock.tableCalls;
    const filtros = (call: typeof agente) => call.ops.flatMap((op, i) => op === "eq" ? [call.opArgs[i]] : []);
    expect(filtros(agente)).toEqual([["id", "a1"], ["organization_id", "org1"]]);
    expect(filtros(naviera)).toEqual([["id", "n1"]]);
  });
  it("no consulta proveedores sin identificadores", async () => {
    expect(await fetchHandoverProveedores("org1", null, undefined)).toEqual({ agente: null, naviera: null });
    expect(mock.tableCalls).toHaveLength(0);
  });
  it("propaga errores sin convertirlos en ausencia", async () => {
    mock.setTableResult("costeo_agentes", { data: null, error: { message: "Sin acceso" } });
    await expect(fetchHandoverProveedores("org1", "a1", null)).rejects.toThrow();
  });
});
