import { beforeEach, describe, expect, it, vi } from "vitest";
const mock = await vi.hoisted(async () => {
  const { createSupabaseMock } = await import("@/services/__tests__/_supabaseChainMock");
  return createSupabaseMock();
});
vi.mock("@/integrations/supabase/client", () => ({ supabase: mock.supabase }));
import {
  fetchFacturasMes, fetchNotasCreditoMes, fetchProveedorFacturasMes, fetchProveedorNotasCreditoMes,
  loadEmbarquesPorIds, loadEmbarquesPorExpedientes, loadEmbarqueIdsPorFacturaProveedor,
} from "../estadoResultadosFetch";

beforeEach(() => { mock.resetResults(); mock.tableCalls.length = 0; });

describe("AUD83: lecturas completas del rango anual", () => {
  it.each([
    { table: "facturas", fetch: fetchFacturasMes },
    { table: "factura_notas_credito", fetch: fetchNotasCreditoMes },
    { table: "proveedor_facturas", fetch: fetchProveedorFacturasMes },
    { table: "proveedor_notas_credito", fetch: fetchProveedorNotasCreditoMes },
  ])("página todas las filas de $table, con orden estable, organización y borrado lógico", async ({ table, fetch }) => {
    const filas = Array.from({ length: 1501 }, (_, i) => ({
      id: `fila-${String(i).padStart(4, "0")}`, fecha_emision: "2026-10-03", fecha: "2026-10-03",
      subtotal: 50, monto: 58, conceptos: [{ cantidad: 1, precio_unitario: 50 }], moneda: "MXN",
    }));
    mock.setTableResultOnce(table, { data: filas.slice(0, 1000), error: null });
    mock.setTableResultOnce(table, { data: filas.slice(1000), error: null });
    const resultado = await fetch("org-83", "2026-01-01", "2026-12-31");
    expect(resultado).toHaveLength(1501);
    const llamadas = mock.tableCalls.filter((call) => call.table === table);
    expect(llamadas).toHaveLength(2);
    expect(llamadas.map((call) => call.opArgs[call.ops.indexOf("range")])).toEqual([[0, 999], [1000, 1999]]);
    for (const call of llamadas) {
      expect(call.opArgs).toContainEqual(["organization_id", "org-83"]);
      expect(call.opArgs).toContainEqual(["deleted_at", null]);
      expect(call.opArgs).toContainEqual(["id"]);
    }
  });

  it.each([
    { campo: "id", fetch: (ids: string[]) => loadEmbarquesPorIds(ids) },
    { campo: "expediente", fetch: (ids: string[]) => loadEmbarquesPorExpedientes(ids, "org-83") },
    { campo: "id", fetch: (ids: string[]) => loadEmbarqueIdsPorFacturaProveedor(ids) },
  ])("resuelve vínculos de factura por lotes de 200, sin URLs anuales excesivas ($campo)", async ({ campo, fetch }) => {
    await fetch(Array.from({ length: 451 }, (_, i) => `vinculo-${i}`));
    const filtros = mock.tableCalls.map((call) => call.opArgs[call.ops.indexOf("in")]);
    expect(filtros.map((args) => args[0])).toEqual([campo, campo, campo]);
    expect(filtros.map((args) => Array.isArray(args[1]) ? args[1].length : 0)).toEqual([200, 200, 51]);
  });

  it("propaga un error de la segunda página en vez de reportar un subtotal anual", async () => {
    mock.setTableResultOnce("proveedor_facturas", { data: Array.from({ length: 1000 }, (_, i) => ({ id: String(i) })), error: null });
    mock.setTableResultOnce("proveedor_facturas", { data: null, error: { message: "página2 falló" } });
    await expect(fetchProveedorFacturasMes("org-83", "2026-01-01", "2026-12-31")).rejects.toMatchObject({ message: "página2 falló" });
  });
});
