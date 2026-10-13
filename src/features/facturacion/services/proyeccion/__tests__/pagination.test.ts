import { beforeEach, expect, it, vi } from "vitest";
import { createSupabaseMock } from "@/services/__tests__/_supabaseChainMock";
const { ref } = vi.hoisted(() => ({ ref: { current: null as ReturnType<typeof createSupabaseMock> | null } }));
vi.mock("@/integrations/supabase/client", () => ({ get supabase() { return ref.current!.supabase; } }));
import { fetchConceptosYFacturas, fetchEmbarquesMes } from "../fetchSources";
import { fetchFacturasEmitidasCierre } from "../ventasPendientes";
import { fetchProjectionInChunks } from "../fetchInChunks";
import { CAP_LOTES_DURO } from "@/constants/queryCaps";
beforeEach(() => { ref.current = createSupabaseMock(); });
const ids = Array.from({ length: 451 }, (_, i) => `00000000-0000-0000-0000-${String(i).padStart(12, "0")}`);
const rowId = (i: number) => String(i).padStart(8, "0");
it.each([999, 1000, 1001, 10000, 10001])("returns all %i shipments with tenant, filters and stable order on every page", async (count) => {
  const rows = Array.from({ length: count }, (_, i) => ({ id: rowId(i), eta: "2026-10-01" }));
  for (let start = 0; start < count; start += 1000) ref.current!.setTableResultOnce("embarques", { data: rows.slice(start, start + 1000), error: null });
  expect(await fetchEmbarquesMes("org-a", "2026-10-01", "2026-10-31")).toEqual(rows);
  expect(ref.current!.tableCalls).toHaveLength(Math.floor(count / 1000) + 1);
  ref.current!.tableCalls.forEach((call, i) => {
    const args = (op: string) => call.opArgs.filter((_, idx) => call.ops[idx] === op);
    expect(args("order")).toEqual([["id", { ascending: true }]]);
    expect(args("eq")).toContainEqual(["organization_id", "org-a"]);
    expect(args("is")).toContainEqual(["deleted_at", null]);
    expect(args("gte")).toContainEqual(["eta", "2026-10-01"]);
    expect(args("lte")).toContainEqual(["eta", "2026-10-31"]);
    expect(args("not")).toContainEqual(["estado", "in", "(Cotización,Borrador,Cancelado)"]);
    expect(args("limit")).toEqual([[1000]]);
    expect(args("gt")).toEqual(i ? [["id", rowId(i * 1000 - 1)]] : []);
    expect(args("range")).toEqual([]);
  });
});
it("rejects rather than return a partial when page two fails", async () => {
  ref.current!.setTableResultOnce("embarques", { data: Array.from({ length: 1000 }, (_, i) => ({ id: rowId(i) })), error: null });
  ref.current!.setTableResultOnce("embarques", { data: null, error: { message: "page two failed" } });
  await expect(fetchEmbarquesMes("org-a", "2026-10-01", "2026-10-31")).rejects.toEqual({ message: "page two failed" });
});
it("fails closed at the existing hard cap", async () => {
  for (let start = 0; start < CAP_LOTES_DURO; start += 1000) {
    ref.current!.setTableResultOnce("embarques", { data: Array.from({ length: 1000 }, (_, i) => ({ id: rowId(start + i) })), error: null });
  }
  await expect(fetchEmbarquesMes("org-a", "2026-10-01", "2026-10-31")).rejects.toThrow();
  expect(ref.current!.tableCalls).toHaveLength(CAP_LOTES_DURO / 1000);
});
it("chunks 451 unique IDs into 200/200/51 across all projection sources", async () => {
  await fetchConceptosYFacturas([...ids, ids[0]], [], "org-a");
  for (const table of ["conceptos_venta", "conceptos_costo", "facturas", "conceptos_factura", "factura_embarques"]) {
    const calls = ref.current!.tableCalls.filter((c) => c.table === table);
    const chunks = calls.map((c) => c.opArgs[c.ops.indexOf("in")][1] as string[]);
    expect(chunks.map((c) => c.length)).toEqual([200, 200, 51]);
    expect(chunks.flat()).toEqual(ids);
    expect(calls.every((c) => c.ops.includes("limit") && c.ops.includes("order"))).toBe(true);
  }
  expect(ref.current!.rpcCalls.map((c) => (c.args as { p_embarque_ids: string[] }).p_embarque_ids.length)).toEqual([200, 200, 51]);
});
it.each(["conceptos_venta", "conceptos_costo", "facturas", "conceptos_factura", "factura_embarques"])("fails closed on %s second page", async (table) => {
  ref.current!.setTableResultOnce(table, { data: Array.from({ length: 1000 }, (_, i) => ({ id: rowId(i), factura_id: rowId(i), embarque_id: "shipment" })), error: null });
  ref.current!.setTableResultOnce(table, { data: null, error: { message: "page two failed" } });
  await expect(fetchConceptosYFacturas([ids[0]], [], "org-a")).rejects.toEqual({ message: "page two failed" });
});
it("deduplicates invoices linked through different chunks", async () => {
  ref.current!.setTableResult("conceptos_factura", { data: [{ id: "line", factura_id: "same" }], error: null });
  ref.current!.setTableResult("facturas", { data: [{ id: "same" }], error: null });
  expect(await fetchFacturasEmitidasCierre(ids)).toEqual([{ id: "same" }]);
});
it("does not request any source for empty IDs", async () => {
  await fetchConceptosYFacturas([], [], "org-a");
  expect(ref.current!.tableCalls).toHaveLength(0);
  expect(ref.current!.rpcCalls).toHaveLength(0);
});
it("bounds each source to three concurrent chunks and keeps order", async () => {
  let active = 0, max = 0;
  const many = Array.from({ length: 10001 }, (_, i) => String(i));
  const result = await fetchProjectionInChunks(many, async (chunk) => {
    active++; max = Math.max(max, active);
    await Promise.resolve(); active--; return chunk;
  });
  expect(max).toBe(3); expect(result).toEqual(many);
});
it("chunks 451 indirect invoice IDs and deduplicates links before fetching", async () => {
  ref.current!.setTableResultOnce("facturas", { data: [], error: null });
  ref.current!.setTableResultOnce("conceptos_factura", { data: [...ids, ids[0]].map((id, i) => ({ id: rowId(i), factura_id: id })), error: null });
  ref.current!.setTableResultOnce("factura_embarques", { data: [{ factura_id: ids[0], embarque_id: "shipment" }], error: null });
  await fetchFacturasEmitidasCierre(["shipment"]);
  const calls = ref.current!.tableCalls.filter((c) => c.table === "facturas").slice(1);
  expect(calls.map((c) => (c.opArgs[c.ops.indexOf("in")][1] as string[]).length)).toEqual([200, 200, 51]);
  expect(calls.every((c) => c.ops.includes("limit") && c.ops.includes("order"))).toBe(true);
});
it("fails closed when a consolidated invoice page fails", async () => {
  ref.current!.setTableResultOnce("facturas", { data: [], error: null });
  ref.current!.setTableResultOnce("conceptos_factura", { data: [{ id: "line", factura_id: "indirect" }], error: null });
  ref.current!.setTableResultOnce("facturas", { data: null, error: { message: "consolidated failure" } });
  await expect(fetchFacturasEmitidasCierre(["shipment"])).rejects.toEqual({ message: "consolidated failure" });
});
