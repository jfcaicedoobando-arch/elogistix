import { beforeEach, describe, expect, it, vi } from "vitest";
const mock = await vi.hoisted(async () => {
  const { createSoftDeleteReadMock } = await import("@/services/__tests__/_softDeleteReadPlanMock");
  return createSoftDeleteReadMock();
});
vi.mock("@/integrations/supabase/client", () => ({ supabase: mock.supabase }));
import { fetchPortalCotizaciones, fetchPortalCotizacion } from "../queries";
import { fetchPortalFacturas, fetchPortalFactura } from "../queriesFacturas";
const casos = [
  { nombre: "lista cotizaciones", table: "cotizaciones", list: true, run: () => fetchPortalCotizaciones(["cli-test"]) },
  { nombre: "detalle cotización", table: "cotizaciones", list: false, run: () => fetchPortalCotizacion("doc1") },
  { nombre: "lista facturas", table: "facturas", list: true, run: () => fetchPortalFacturas(["cli-test"]) },
  { nombre: "detalle factura", table: "facturas", list: false, run: () => fetchPortalFactura("doc1") },
];
const documento = { id: "doc1", cliente_id: "cli-test", embarque_id: "emb1", expediente: null };
beforeEach(() => mock.reset());
describe.each(casos)("$nombre: expediente auxiliar", ({ table, list, run }) => {
  const queueDoc = (row: unknown) => mock.queue(table, list ? [row] : row);
  const expectDoc = async (expediente: string | null) => {
    const result = { ...documento, embarque_expediente: expediente };
    expect(await run()).toEqual(list ? [result] : result);
  };
  it("conserva documento vivo, expediente vivo y sus filtros actuales", async () => {
    queueDoc(documento); const emb = { id: "emb1", expediente: "EXP-TEST" }; mock.queue("embarques", list ? [emb] : emb);
    await expectDoc("EXP-TEST"); expect(mock.tableCalls).toHaveLength(2);
    for (const call of mock.tableCalls) expect(call.opArgs).toContainEqual(["deleted_at", null]);
    expect(mock.tableCalls[0].opArgs).toContainEqual(list ? ["cliente_id", ["cli-test"]] : ["id", "doc1"]);
    expect(mock.tableCalls[1].opArgs).toContainEqual(list ? ["id", ["emb1"]] : ["id", "emb1"]);
    if (list) expect(mock.tableCalls[0].ops).toContain("order");
  });
  it.each(["ausente", "borrado"])("embarque %s conserva documento y hace fallback null", async estado => {
    queueDoc(documento); const emb = { id: "emb1", expediente: "EXP-PAPELERA", deleted_at: "2026-10-01" };
    mock.queue("embarques", estado === "borrado" ? list ? [emb] : emb : list ? [] : null);
    await expectDoc(null); expect(mock.tableCalls[1].opArgs).toContainEqual(["deleted_at", null]);
  });
  it("documento eliminado corta antes del lookup de embarque", async () => {
    queueDoc({ ...documento, deleted_at: "2026-10-01" });
    expect(await run()).toEqual(list ? [] : null); expect(mock.tableCalls).toHaveLength(1);
  });
  if (table === "facturas") it("conserva expediente propio sin resolver el del embarque", async () => {
    const doc = { ...documento, expediente: "EXP-PROPIO" }; queueDoc(doc);
    const result = { ...doc, embarque_expediente: null };
    expect(await run()).toEqual(list ? [result] : result); expect(mock.tableCalls).toHaveLength(1);
  });
});
