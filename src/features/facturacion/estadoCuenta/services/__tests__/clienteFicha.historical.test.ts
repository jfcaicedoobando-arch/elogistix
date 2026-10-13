import { beforeEach, describe, expect, it, vi } from "vitest";
import { createHistoricalReadMock } from "@/test/helpers/historicalReadMock";
import { createSupabaseMock } from "@/services/__tests__/_supabaseChainMock";

const h = vi.hoisted(() => ({
  current: null as ReturnType<typeof createHistoricalReadMock> | null,
  operational: null as ReturnType<typeof createSupabaseMock> | null,
}));
vi.mock("@/integrations/supabase/client", () => ({ get supabase() { return h.operational?.supabase ?? h.current!.supabase; } }));
import { fetchClienteFichaEstadoCuenta } from "../clienteFicha";
import { fetchEstadoCuenta } from "../estadoCuenta";

const deletedAt = "2026-10-01T12:00:00.000Z";
const ficha = {
  id: "cliente-a", organization_id: "org-a", nombre: "Nombre actual",
  rfc: "RFC-SINTETICO", direccion: "Dirección actual", ciudad: "Ciudad actual", estado: "Estado actual",
  dias_credito: 30, limite_credito_mxn: 1000,
};
const columnas = "id, organization_id, nombre, rfc, direccion, ciudad, estado, dias_credito, limite_credito_mxn";

beforeEach(() => {
  h.current = createHistoricalReadMock();
  h.operational = null;
  h.current.tables.clientes = [{ ...ficha, deleted_at: null }];
});

function expectSoloFicha() {
  expect(h.current!.calls).toEqual([{
    table: "clientes", columns: columnas,
    filters: [{ method: "eq", column: "id", value: "cliente-a" }],
  }]);
  expect(h.current!.supabase.rpc).not.toHaveBeenCalled();
}

describe("ficha actual de cliente visible para representar estado de cuenta", () => {
  it.each([null, deletedAt])("devuelve la identidad actual visible aunque deleted_at sea %s", async (deleted_at) => {
    h.current!.tables.clientes = [
      { ...ficha, id: "otro-cliente", nombre: "NO", deleted_at: null },
      { ...ficha, deleted_at, campo_no_solicitado: "NO" },
    ];
    expect(await fetchClienteFichaEstadoCuenta("cliente-a")).toEqual(ficha);
    expectSoloFicha();
  });

  it.each([null, undefined])("conserva los defaults existentes para campos opcionales %s", async (vacio) => {
    h.current!.tables.clientes = [{ id: "cliente-a", organization_id: "org-a", deleted_at: deletedAt,
      nombre: vacio, rfc: vacio, direccion: vacio, ciudad: vacio, estado: vacio,
      dias_credito: vacio, limite_credito_mxn: vacio }];
    expect(await fetchClienteFichaEstadoCuenta("cliente-a")).toEqual({
      id: "cliente-a", organization_id: "org-a", nombre: "", rfc: null,
      direccion: null, ciudad: null, estado: null, dias_credito: null, limite_credito_mxn: null,
    });
    expectSoloFicha();
  });

  it("conserva cero y cadenas vacías sin tratarlos como null", async () => {
    const actual = { ...ficha, nombre: "", rfc: "", direccion: "", ciudad: "", estado: "",
      dias_credito: 0, limite_credito_mxn: 0 };
    h.current!.tables.clientes = [{ ...actual, deleted_at: deletedAt }];
    expect(await fetchClienteFichaEstadoCuenta("cliente-a")).toEqual(actual);
    expectSoloFicha();
  });

  it("una nueva lectura refleja la ficha actual y no reconstruye un snapshot de emisión", async () => {
    expect(await fetchClienteFichaEstadoCuenta("cliente-a")).toEqual(ficha);
    const actual = { ...ficha, nombre: "Nombre actualizado", rfc: "RFC-ACTUALIZADO", dias_credito: 0 };
    h.current!.tables.clientes = [{ ...actual, deleted_at: deletedAt }];
    expect(await fetchClienteFichaEstadoCuenta("cliente-a")).toEqual(actual);
    expect(h.current!.calls).toHaveLength(2);
    for (const call of h.current!.calls) {
      expect(call).toEqual({ table: "clientes", columns: columnas,
        filters: [{ method: "eq", column: "id", value: "cliente-a" }] });
    }
    expect(h.current!.supabase.rpc).not.toHaveBeenCalled();
  });

  it.each(["ausente", "invisible"])("rechaza cliente %s sin inventar identidad ni distinguir su causa", async (motivo) => {
    if (motivo === "ausente") h.current!.tables.clientes = [];
    else h.current!.setVisible(() => false);
    await expect(fetchClienteFichaEstadoCuenta("cliente-a")).rejects.toThrow("Cliente no encontrado");
    expectSoloFicha();
  });

  it("propaga el error del servidor sin reemplazarlo por Cliente no encontrado", async () => {
    const error = { code: "42501", message: "Lectura denegada" };
    h.current!.errors.set("clientes:0", error);
    await expect(fetchClienteFichaEstadoCuenta("cliente-a")).rejects.toBe(error);
    expectSoloFicha();
  });

  it("propaga un rechazo de transporte sin devolver defaults", async () => {
    const error = new Error("Red interrumpida");
    const from = h.current!.supabase.from.getMockImplementation()!;
    h.current!.supabase.from.mockImplementation((table) => {
      const builder = from(table);
      vi.spyOn(builder, "maybeSingle").mockRejectedValue(error);
      return builder;
    });
    await expect(fetchClienteFichaEstadoCuenta("cliente-a")).rejects.toBe(error);
    expectSoloFicha();
  });
});


it("leer una ficha dada de baja no amplía el universo operativo del estado de cuenta", async () => {
  h.current!.tables.clientes = [{ ...ficha, deleted_at: deletedAt }];
  expect(await fetchClienteFichaEstadoCuenta("cliente-a")).toEqual(ficha);
  expectSoloFicha();
  h.operational = createSupabaseMock();
  h.operational.setTableResult("facturas", { data: [], error: null });
  expect(await fetchEstadoCuenta({ clienteIds: ["cliente-a"], desde: "2026-01-01",
    hasta: "2026-10-01", moneda: "USD", soloConSaldo: true })).toEqual([]);
  expect(h.operational.tableCalls).toEqual([{
    table: "facturas", ops: ["select", "in", "in", "is", "order", "limit", "gte", "lte", "eq"],
    opArgs: [[expect.any(String)], ["cliente_id", ["cliente-a"]],
      ["estado", ["Emitida", "Parcialmente pagada", "Vencida", "Pagada"]],
      ["deleted_at", null], ["fecha_emision", { ascending: false }], [2000],
      ["fecha_emision", "2026-01-01"], ["fecha_emision", "2026-10-01"], ["moneda", "USD"]],
  }]);
  expect(h.operational.supabase.rpc).not.toHaveBeenCalled();
});
