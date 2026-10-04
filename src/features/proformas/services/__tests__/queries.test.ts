import { describe, it, expect, vi, beforeEach } from "vitest";

const mock = await vi.hoisted(async () => {
  const { createSupabaseMock } = await import("@/services/__tests__/_supabaseChainMock");
  return createSupabaseMock();
});
vi.mock("@/integrations/supabase/client", () => ({ supabase: mock.supabase }));
vi.mock("@/lib/supabase/cast", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/supabase/cast")>()),
  fromDb: <T,>(v: unknown) => v as T,
}));

import {
  fetchProformasEmbarque,
  fetchProformaPorId,
  fetchProformasTodas,
  fetchProformasPendientes,
  fetchClienteParaPdf,
  fetchEmbarqueParaPdf,
  fetchConceptosProforma,
  fetchConceptosConsolidados,
} from "../queries";
import type { ProformaFacturaAsociadaLite } from "../types";
import { totalesListadoProforma } from "@/features/proformas/domain/proformaListado";
import { proformaFixture } from "@/features/facturacion/components/__tests__/fixtures/proforma";

describe("proformas queries", () => {
  beforeEach(() => {
    mock.resetResults();
    mock.tableCalls.length = 0;
  });

  it.each([
    { es_consolidada: true, detalle: undefined }, { es_consolidada: true, detalle: [] },
    { es_consolidada: false, detalle: undefined }, { es_consolidada: false, detalle: [] },
  ])("38: sin detalle preserva encabezado histórico y señala su origen ($es_consolidada/$detalle)", async ({ es_consolidada, detalle }) => {
    mock.setTableResult("proformas", { data: [{
      ...proformaFixture({ es_consolidada, subtotal_mxn: 100, iva_mxn: 16, total_mxn: 116, subtotal_usd: 50, iva_usd: 8, total_usd: 58 }),
      conceptos_lista: detalle, consolidados_lista: detalle,
    }], error: null });
    const [row] = await fetchProformasTodas("org");
    expect(row.totales_calculados).toBeUndefined();
    expect(row.totales_origen).toBe("encabezado_sin_detalle");
    expect(totalesListadoProforma(row)).toEqual({ subtotal_mxn: 100, iva_mxn: 16, total_mxn: 116, subtotal_usd: 50, iva_usd: 8, total_usd: 58 });
    expect(row.total_mxn).toBe(116); expect(row.total_usd).toBe(58);
  });

  it("38: lista y CSV reciben los mismos totales por línea que el detalle", async () => {
    const concepto = { cantidad: 1, precio_unitario: 1533.33, moneda: "MXN", tipo_iva: "gravado_16", aplica_iva: true, tasa_iva_aplicada: 0.16, deleted_at: null };
    mock.setTableResult("proformas", { data: [{
      id: "p1", total_mxn: 3557.3256, subtotal_mxn: 3066.66, iva_mxn: 490.6656,
      conceptos_lista: [{ ...concepto, id: "l1" }, { ...concepto, id: "l2" }, { ...concepto, id: "papelera", deleted_at: "2026-10-04" }],
      consolidados_lista: [],
    }], error: null });
    const rows = await fetchProformasTodas("org");
    expect(rows[0].total_mxn).toBe(3557.3256); // Sin reparar el encabezado histórico.
    expect(rows[0].totales_calculados).toEqual({ subtotal_mxn: 3066.66, iva_mxn: 490.66, total_mxn: 3557.32, subtotal_usd: 0, iva_usd: 0, total_usd: 0 });
    const call = mock.tableCalls[0];
    expect(call.opArgs[call.ops.indexOf("select")][0]).toContain("conceptos_lista:conceptos_venta");
    expect(call.opArgs).toContainEqual(["conceptos_lista.deleted_at", null]);
    expect(call.opArgs).toContainEqual(["consolidados_lista.deleted_at", null]);
    expect(mock.tableCalls).toHaveLength(1);
  });

  it("38: consolidadas usan el snapshot, por moneda y tratamiento", async () => {
    mock.setTableResult("proformas", { data: [{
      id: "p2", es_consolidada: true,
      conceptos_lista: [{ id: "fuente", cantidad: 1, precio_unitario: 999, moneda: "MXN", tipo_iva: "gravado_16" }],
      consolidados_lista: [
        { id: "usd", cantidad: 0.5, precio_unitario: 100, moneda: "USD", tipo_iva: "gravado_8", aplica_iva: true },
        { id: "mxn", cantidad: 1, precio_unitario: 100, moneda: "MXN", tipo_iva: "no_objeto", aplica_iva: true },
      ],
    }], error: null });
    const rows = await fetchProformasTodas("org");
    expect(rows[0].totales_calculados).toEqual({ subtotal_usd: 50, iva_usd: 4, total_usd: 54, subtotal_mxn: 100, iva_mxn: 0, total_mxn: 100 });
  });

  it("fetchProformasEmbarque devuelve filas y filtra por embarque_id", async () => {
    mock.setTableResult("proformas", { data: [{ id: "1" }], error: null });
    const res = await fetchProformasEmbarque("emb-1");
    // D6: la fila pasa por `mergeFacturasVinculadas`, que siempre normaliza
    // `facturas_asociadas` (aquí vacío porque la proforma no tiene factura).
    expect(res).toEqual([{ id: "1", facturas_asociadas: [] }]);
    const call = mock.tableCalls[0];
    const eqArgs = call.ops.map((op, i) => [op, call.opArgs[i]]).filter(([op]) => op === "eq");
    expect(eqArgs).toContainEqual(["eq", ["embarque_id", "emb-1"]]);
  });

  it("fetchProformasEmbarque devuelve [] cuando data es null", async () => {
    mock.setTableResult("proformas", { data: null, error: null });
    await expect(fetchProformasEmbarque("e")).resolves.toEqual([]);
  });

  it("fetchProformasEmbarque propaga error", async () => {
    mock.setTableResult("proformas", { data: null, error: new Error("err") });
    await expect(fetchProformasEmbarque("e")).rejects.toThrow("err");
  });

  it("fetchProformaPorId devuelve null cuando no hay data", async () => {
    mock.setTableResult("proformas", { data: null, error: null });
    await expect(fetchProformaPorId("p")).resolves.toBeNull();
  });

  it("fetchProformaPorId mapea data presente", async () => {
    mock.setTableResult("proformas", { data: { id: "p1" }, error: null });
    await expect(fetchProformaPorId("p1")).resolves.toEqual({
      id: "p1",
      facturas_asociadas: [],
      envios: [],
    });
  });

  // Sentry JAVASCRIPT-REACT-6K: /proformas/PRO-2026-0008 filtraba por `id`
  // (uuid) y Postgres respondía 22P02 → falso error de conexión en la UI.
  it("fetchProformaPorId filtra por id cuando recibe un UUID", async () => {
    mock.setTableResult("proformas", { data: { id: "p1" }, error: null });
    await fetchProformaPorId("11111111-1111-4111-8111-111111111111");
    const call = mock.tableCalls[0];
    const eqArgs = call.ops.map((op, i) => [op, call.opArgs[i]]).filter(([op]) => op === "eq");
    expect(eqArgs).toContainEqual(["eq", ["id", "11111111-1111-4111-8111-111111111111"]]);
  });

  it("fetchProformaPorId filtra por numero cuando recibe un folio", async () => {
    mock.setTableResult("proformas", { data: { id: "p1", numero: "PRO-2026-0008" }, error: null });
    await fetchProformaPorId("PRO-2026-0008");
    const call = mock.tableCalls[0];
    const eqArgs = call.ops.map((op, i) => [op, call.opArgs[i]]).filter(([op]) => op === "eq");
    expect(eqArgs).toContainEqual(["eq", ["numero", "PRO-2026-0008"]]);
  });

  it("fetchProformaPorId devuelve null con folio inexistente (pantalla no encontrada)", async () => {
    mock.setTableResult("proformas", { data: null, error: null });
    await expect(fetchProformaPorId("PRO-2026-9999")).resolves.toBeNull();
  });


  it("fetchProformasPendientes deriva contenedores_lista únicos", async () => {
    mock.setTableResult("proformas", {
      data: [
        {
          id: "p1",
          conceptos_venta: [
            { contenedor_id: "c1", embarque_contenedores: { numero_contenedor: "MSCU1", tipo_contenedor: "40HC" } },
            { contenedor_id: "c1", embarque_contenedores: { numero_contenedor: "MSCU1", tipo_contenedor: "40HC" } },
            { contenedor_id: "c2", embarque_contenedores: { numero_contenedor: "MSCU2", tipo_contenedor: "20GP" } },
            { contenedor_id: null, embarque_contenedores: null },
          ],
        },
      ],
      error: null,
    });
    const res = await fetchProformasPendientes("org");
    const lista = (res[0] as { contenedores_lista: Array<{ numero: string | null }> }).contenedores_lista;
    expect(lista).toHaveLength(3);
    expect(lista.map((l) => l.numero)).toEqual(["MSCU1", "MSCU2", null]);
  });

  it("fetchProformasPendientes maneja conceptos_venta ausentes", async () => {
    mock.setTableResult("proformas", { data: [{ id: "p1" }], error: null });
    const res = await fetchProformasPendientes("org");
    expect((res[0] as { contenedores_lista: unknown[] }).contenedores_lista).toEqual([]);
  });

  it("fetchClienteParaPdf delega a maybeSingle", async () => {
    mock.setTableResult("clientes", { data: { nombre: "X" }, error: null });
    await expect(fetchClienteParaPdf("c")).resolves.toEqual({ nombre: "X" });
  });

  it("fetchEmbarqueParaPdf delega a single y propaga error", async () => {
    mock.setTableResult("embarques", { data: null, error: new Error("404") });
    await expect(fetchEmbarqueParaPdf("e")).rejects.toThrow("404");
  });

  it("fetchConceptosProforma devuelve filas", async () => {
    mock.setTableResult("conceptos_venta", { data: [{ id: "cv1" }], error: null });
    await expect(fetchConceptosProforma("p")).resolves.toEqual([{ id: "cv1" }]);
  });

  it("fetchConceptosConsolidados propaga error", async () => {
    mock.setTableResult("proforma_conceptos_consolidados", { data: null, error: new Error("e") });
    await expect(fetchConceptosConsolidados("p")).rejects.toThrow("e");
  });

  // Regresión: las proformas en papelera se seguían listando y al borrarlas de
  // nuevo el RPC respondía "Registro no encontrado o ya borrado" (P0001).
  describe("excluye proformas en papelera (deleted_at)", () => {
    const isOps = () => {
      const call = mock.tableCalls[0];
      return call.ops.map((op, i) => [op, call.opArgs[i]]).filter(([op]) => op === "is");
    };

    it("fetchProformasEmbarque filtra deleted_at IS NULL", async () => {
      mock.setTableResult("proformas", { data: [], error: null });
      await fetchProformasEmbarque("emb-1");
      expect(isOps()).toContainEqual(["is", ["deleted_at", null]]);
    });

    it("fetchProformaPorId filtra deleted_at IS NULL", async () => {
      mock.setTableResult("proformas", { data: null, error: null });
      await fetchProformaPorId("p1");
      expect(isOps()).toContainEqual(["is", ["deleted_at", null]]);
    });

    it("fetchProformasTodas filtra deleted_at IS NULL", async () => {
      mock.setTableResult("proformas", { data: [], error: null });
      await fetchProformasTodas("org");
      expect(isOps()).toContainEqual(["is", ["deleted_at", null]]);
    });
  });
});


describe("R170-01: facturas_asociadas en la lista distingue borrador de emitida", () => {
  it("fetchProformasTodas trae facturas_asociadas y descarta las borradas", async () => {
    mock.setTableResult("proformas", {
      data: [
        {
          id: "p1",
          facturas_asociadas: [
            { id: "f1", estado: "borrador", uuid_fiscal: null, deleted_at: null } as ProformaFacturaAsociadaLite,
            { id: "f2", estado: "emitida", uuid_fiscal: "u1", deleted_at: "2024-01-01" } as ProformaFacturaAsociadaLite,
          ],
        },
      ],
      error: null,
    });
    const res = await fetchProformasTodas("org");
    expect(res[0].facturas_asociadas).toEqual([
      { id: "f1", estado: "borrador", uuid_fiscal: null, deleted_at: null },
    ]);
  });

  it("fetchProformasTodas selecciona la relación real facturas!proforma_id", async () => {
    mock.setTableResult("proformas", { data: [], error: null });
    await fetchProformasTodas("org");
    const call = mock.tableCalls[0];
    const selectArgs = call.ops.map((op, i) => [op, call.opArgs[i]]).filter(([op]) => op === "select");
    expect(selectArgs[0][1][0]).toContain("facturas_asociadas:facturas!proforma_id");
  });
});

describe("O8: selects explícitos (sin comodín) en listados de proformas", () => {
  it("fetchProformasEmbarque no incluye `*` en las columnas seleccionadas", async () => {
    mock.setTableResult("proformas", { data: [], error: null });
    await fetchProformasEmbarque("emb-1");
    const call = mock.tableCalls[0];
    const selectArgs = call.ops.map((op, i) => [op, call.opArgs[i]]).filter(([op]) => op === "select");
    expect(selectArgs[0][1][0]).not.toMatch(/^\*|,\s*\*/);
    expect(selectArgs[0][1][0]).toContain("numero");
  });

  // R170-03: HistorialProformas (tab facturación del embarque) necesita estas
  // columnas para no mostrar fecha/operador/crédito vacíos.
  it("fetchProformasEmbarque incluye fecha_emision, operador y dias_credito", async () => {
    mock.setTableResult("proformas", { data: [], error: null });
    await fetchProformasEmbarque("emb-1");
    const call = mock.tableCalls[0];
    const selectArgs = call.ops.map((op, i) => [op, call.opArgs[i]]).filter(([op]) => op === "select");
    expect(selectArgs[0][1][0]).toContain("fecha_emision");
    expect(selectArgs[0][1][0]).toContain("operador");
    expect(selectArgs[0][1][0]).toContain("dias_credito");
  });

  it("fetchProformasTodas no incluye `*` en las columnas seleccionadas", async () => {
    mock.setTableResult("proformas", { data: [], error: null });
    await fetchProformasTodas("org");
    const call = mock.tableCalls[0];
    const selectArgs = call.ops.map((op, i) => [op, call.opArgs[i]]).filter(([op]) => op === "select");
    expect(selectArgs[0][1][0]).not.toMatch(/^\*|,\s*\*/);
    expect(selectArgs[0][1][0]).toContain("cliente_nombre");
  });
});
