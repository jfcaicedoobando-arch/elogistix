import { beforeEach, describe, expect, it, vi } from "vitest";

const mock = await vi.hoisted(async () => {
  const { createSoftDeleteReadMock } = await import("@/services/__tests__/_softDeleteReadMock");
  return createSoftDeleteReadMock();
});
const actividad = vi.hoisted(() => vi.fn());
vi.mock("@/integrations/supabase/client", () => ({ supabase: mock.supabase }));
vi.mock("@/services/bitacora/registrar", () => ({ registrarActividad: actividad }));

import { recalcularTotalesFactura } from "../recalcularTotalesFactura";
import {
  actualizarConceptoFactura,
  agregarConceptoFactura,
  eliminarConceptoFactura,
} from "../conceptosFacturaCrud";

const FACTURA_ID = "factura-1";
const CONCEPTO_ID = "concepto-1";
const totals = { subtotal: 100, iva: 16, ret_isr: 10, ret_iva: 4, total: 102 };
const deleted = { ...totals, deleted_at: "2026-10-13T00:00:00Z" };
const input = {
  descripcion: "Servicio", cantidad: 1, precio_unitario: 100,
  clave_sat: "78101800", tipo_iva: "gravado_16" as const,
};
const missingMessage = /No se pudo leer la factura después de recalcular sus totales/;

beforeEach(() => {
  mock.reset();
  vi.clearAllMocks();
});

function expectOneRecalculation() {
  expect(mock.rpcCalls.filter(({ fn }) => fn === "recalc_factura_totales")).toEqual([
    { fn: "recalc_factura_totales", args: { p_factura_id: FACTURA_ID } },
  ]);
}

function expectActiveRead() {
  const calls = mock.tableCalls.filter(({ table }) => table === "facturas");
  expect(calls).toHaveLength(1);
  expect(calls[0].ops).toEqual(["select", "eq", "is"]);
  expect(calls[0].opArgs).toEqual([
    ["subtotal, iva, ret_isr, ret_iva, total"], ["id", FACTURA_ID], ["deleted_at", null],
  ]);
}

describe("recalcularTotalesFactura: lectura posterior al RPC", () => {
  it.each([
    ["eliminada después del RPC", deleted],
    ["ausente o no visible", null],
  ])("rechaza una factura %s sin inventar ceros", async (_case, row) => {
    mock.queue("facturas", row);
    await expect(recalcularTotalesFactura(FACTURA_ID)).rejects.toThrow(missingMessage);
    expectOneRecalculation();
    expectActiveRead();
    expect(mock.supabase.rpc.mock.invocationCallOrder[0]).toBeLessThan(
      mock.supabase.from.mock.invocationCallOrder[0],
    );
  });

  it("propaga el mismo error RPC y no hace SELECT ni reintenta", async () => {
    const error = { code: "P0002", message: "Factura no disponible" };
    mock.setRpcResult("recalc_factura_totales", { data: null, error });
    await expect(recalcularTotalesFactura(FACTURA_ID)).rejects.toBe(error);
    expectOneRecalculation();
    expect(mock.supabase.from).not.toHaveBeenCalled();
  });

  it("propaga el mismo error SELECT sin repetir el RPC", async () => {
    const error = { code: "42501", message: "No se pudo consultar" };
    mock.queue("facturas", null, error);
    await expect(recalcularTotalesFactura(FACTURA_ID)).rejects.toBe(error);
    expectOneRecalculation();
    expectActiveRead();
  });

  it("conserva ceros legítimos de una factura viva sin conceptos", async () => {
    mock.queue("facturas", {
      deleted_at: null, subtotal: 0, iva: 0, ret_isr: 0, ret_iva: 0, total: 0,
    });
    await expect(recalcularTotalesFactura(FACTURA_ID)).resolves.toEqual({
      subtotal: 0, iva: 0, retIsr: 0, retIva: 0, total: 0,
    });
    expectOneRecalculation();
    expectActiveRead();
  });

  it("devuelve importes persistidos de una factura viva sin escribir totales", async () => {
    mock.queue("facturas", { ...totals, deleted_at: null });
    await expect(recalcularTotalesFactura(FACTURA_ID)).resolves.toEqual({
      subtotal: 100, iva: 16, retIsr: 10, retIva: 4, total: 102,
    });
    expectOneRecalculation();
    expectActiveRead();
    expect(mock.tableCalls).toHaveLength(1);
  });
});

const callers = [
  {
    name: "agregar", mutation: "insert",
    invoke: () => agregarConceptoFactura({
      facturaId: FACTURA_ID, organizationId: "org-1", moneda: "MXN", input,
    }),
  },
  {
    name: "actualizar", mutation: "update",
    invoke: () => actualizarConceptoFactura({ conceptoId: CONCEPTO_ID, facturaId: FACTURA_ID, input }),
  },
  {
    name: "eliminar", mutation: "soft_delete_record",
    invoke: () => eliminarConceptoFactura({ conceptoId: CONCEPTO_ID, facturaId: FACTURA_ID }),
  },
];

describe.each(callers)("$name concepto: fallo posterior a una mutación ya completada", ({ mutation, invoke }) => {
  it.each(["eliminada", "ausente", "SELECT", "RPC"])("propaga %s sin repetir la mutación", async (failure) => {
    const error = { code: "42501", message: "Fallo posterior a la mutación" };
    if (mutation !== "soft_delete_record") mock.queue("conceptos_factura", null);
    if (failure === "RPC") {
      mock.setRpcResult("recalc_factura_totales", { data: null, error });
    } else {
      mock.queue("facturas", failure === "eliminada" ? deleted : null, failure === "SELECT" ? error : null);
    }

    const operation = invoke();
    if (failure === "RPC" || failure === "SELECT") await expect(operation).rejects.toBe(error);
    else await expect(operation).rejects.toThrow(missingMessage);

    expectOneRecalculation();
    expect(actividad).not.toHaveBeenCalled();
    const mutations = mock.tableCalls.filter(({ table }) => table === "conceptos_factura");
    if (mutation === "soft_delete_record") {
      expect(mutations).toHaveLength(0);
      expect(mock.rpcCalls).toEqual([
        { fn: "soft_delete_record", args: { _table: "conceptos_factura", _id: CONCEPTO_ID } },
        { fn: "recalc_factura_totales", args: { p_factura_id: FACTURA_ID } },
      ]);
    } else {
      expect(mutations).toHaveLength(1);
      expect(mutations[0].ops).toEqual(mutation === "insert" ? ["insert"] : ["update", "eq"]);
      expect(mock.rpcCalls).toHaveLength(1);
      expect(mock.supabase.from.mock.invocationCallOrder[0]).toBeLessThan(
        mock.supabase.rpc.mock.invocationCallOrder[0],
      );
    }
    if (failure === "RPC") {
      expect(mock.tableCalls.filter(({ table }) => table === "facturas")).toHaveLength(0);
    } else {
      expectActiveRead();
    }
  });
});
