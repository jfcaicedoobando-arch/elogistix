/** El guard del escritor legado no cambia el contrato de los flujos vigentes. */
import indexSource from "../index.ts?raw";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mock = await vi.hoisted(async () => {
  const { createSupabaseMock } = await import("@/services/__tests__/_supabaseChainMock");
  return createSupabaseMock();
});
vi.mock("@/integrations/supabase/client", () => ({ supabase: mock.supabase }));
vi.mock("@/services/bitacora/registrar", () => ({ registrarActividad: vi.fn() }));

import { registrarPagoProveedor } from "../pagosProveedor";
import { actualizarPagoProveedor } from "../pagoProveedorActualizar";
import { regenerarMovimientoPagoProveedor } from "../pagoProveedorMovimientoRegenerar";

const INPUT = {
  proveedor_factura_id: "factura-fixture",
  fecha_pago: "2026-10-13",
  monto: 100,
  moneda: "MXN" as const,
  tipo_cambio_usd: null,
  metodo_pago: "transferencia",
  client_request_id: "request-fixture",
};

beforeEach(() => {
  vi.clearAllMocks();
  mock.tableCalls.length = 0;
  mock.rpcCalls.length = 0;
  mock.resetResults();
  mock.setTableResult("proveedor_facturas", {
    data: { organization_id: "org-fixture", estado_aprobacion: "aprobada" }, error: null,
  });
  mock.setTableResult("pagos_proveedor", {
    data: { ...INPUT, id: "pago-fixture", organization_id: "org-fixture", deleted_at: null, es_anticipo_aplicado: false, anticipos_aplicaciones: [] }, error: null,
  });
  mock.setRpcResult("current_user_org_id", { data: "org-fixture", error: null });
});

function expectSinEscritorLegado() {
  expect(mock.tableCalls.some((call) => call.table === "cuentas_bancarias" || call.table === "bbva_movimientos")).toBe(false);
  expect(mock.tableCalls.some((call) => call.ops.some((op) => ["insert", "update", "delete", "upsert"].includes(op)))).toBe(false);
}

describe("pagos a proveedor · frontera RPC vigente", () => {
  it.each(["cuenta-fixture", null])("alta con cuenta %s conserva la RPC atómica y su payload", async (cuenta_bancaria_id) => {
    mock.setRpcResult("registrar_pago_proveedor_atomico", {
      data: { pago_id: "pago-fixture", movimiento_id: cuenta_bancaria_id ? "mov-fixture" : null }, error: null,
    });
    await registrarPagoProveedor({ ...INPUT, cuenta_bancaria_id }, "user-fixture");
    expect(mock.rpcCalls.filter((call) => call.fn === "registrar_pago_proveedor_atomico")).toEqual([{
      fn: "registrar_pago_proveedor_atomico",
      args: {
        p_factura_id: INPUT.proveedor_factura_id,
        p_fecha_pago: INPUT.fecha_pago,
        p_monto: INPUT.monto,
        p_moneda: INPUT.moneda,
        p_metodo_pago: INPUT.metodo_pago,
        p_referencia: "",
        p_cuenta_bancaria_id: cuenta_bancaria_id ?? undefined,
        p_notas: "",
        p_tipo_cambio_usd: undefined,
        p_diferencia_cambiaria_mxn: undefined,
        p_client_request_id: INPUT.client_request_id,
      },
    }]);
    expectSinEscritorLegado();
  });

  it.each(["cuenta-fixture", null])("edición con cuenta %s conserva la RPC atómica", async (cuenta_bancaria_id) => {
    mock.setRpcResult("actualizar_pago_proveedor_atomico", { data: { movimiento_creado: Boolean(cuenta_bancaria_id) }, error: null });
    await actualizarPagoProveedor({ ...INPUT, id: "pago-fixture", cuenta_bancaria_id, expectedUpdatedAt: "version-fixture" }, "user-fixture");
    expect(mock.rpcCalls).toEqual([{
      fn: "actualizar_pago_proveedor_atomico",
      args: {
        p_pago_id: "pago-fixture",
        p_fecha_pago: INPUT.fecha_pago,
        p_monto: INPUT.monto,
        p_moneda: INPUT.moneda,
        p_tipo_cambio_usd: null,
        p_metodo_pago: INPUT.metodo_pago,
        p_referencia: "",
        p_cuenta_bancaria_id: cuenta_bancaria_id ?? undefined,
        p_notas: "",
        p_diferencia_cambiaria_mxn: undefined,
        p_expected_updated_at: "version-fixture",
      },
    }]);
    expectSinEscritorLegado();
  });

  it.each(["mov-fixture", null])("regeneración conserva respuesta %s y sólo invoca su RPC", async (movimientoId) => {
    mock.setRpcResult("regenerar_movimiento_pago_proveedor", { data: movimientoId, error: null });
    await expect(regenerarMovimientoPagoProveedor("pago-fixture")).resolves.toBe(movimientoId);
    expect(mock.rpcCalls).toEqual([{ fn: "regenerar_movimiento_pago_proveedor", args: { p_pago_id: "pago-fixture" } }]);
    expectSinEscritorLegado();
  });

  it("el barrel de CxP no reexporta comandos del módulo legado", () => {
    const exportLegado = indexSource.match(/export\s*([^;]+)\s*from\s*["']\.\/pagoProveedorMovimiento["']/g);
    expect(exportLegado).toBeNull();
  });
});
