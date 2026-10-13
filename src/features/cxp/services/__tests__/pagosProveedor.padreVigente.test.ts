import { beforeEach, describe, expect, it, vi } from "vitest";

const mock = await vi.hoisted(async () => {
  const { createSoftDeleteReadMock } = await import("@/services/__tests__/_softDeleteReadPlanMock");
  return createSoftDeleteReadMock();
});
vi.mock("@/integrations/supabase/client", () => ({ supabase: mock.supabase }));
vi.mock("@/services/bitacora/registrar", () => ({ registrarActividad: vi.fn() }));

import { registrarActividad } from "@/services/bitacora/registrar";
import { MSG_PAGO_LLAVE_REUSADA, PagoRequiereAprobacionError, registrarPagoProveedor, type RegistrarPagoProveedorInput } from "../pagosProveedor";

type FacturaFixture = {
  id: string;
  organization_id: string | null;
  estado_aprobacion: string | null;
  deleted_at: string | null;
};
const INPUT = {
  proveedor_factura_id: "factura-fixture",
  fecha_pago: "2026-10-13",
  monto: 100,
  moneda: "MXN" as const,
  tipo_cambio_usd: null,
  metodo_pago: "transferencia",
  cuenta_bancaria_id: "cuenta-fixture",
  client_request_id: "request-fixture",
};
const PAGO = { ...INPUT, id: "pago-fixture", organization_id: "org-fixture", deleted_at: null };
let factura: FacturaFixture | null;
let errorFactura: unknown;
let pagoDevuelto: unknown;

beforeEach(() => {
  vi.clearAllMocks();
  mock.reset();
  factura = { id: INPUT.proveedor_factura_id, organization_id: "org-fixture", estado_aprobacion: "aprobada", deleted_at: null };
  errorFactura = null;
  pagoDevuelto = PAGO;
  mock.setRpcResult("current_user_org_id", { data: "org-fixture", error: null });
  mock.setRpcResult("registrar_pago_proveedor_atomico", {
    data: { pago_id: PAGO.id, movimiento_id: "mov-fixture", reintento: false }, error: null,
  });
});

// El helper existente evalúa deleted_at sobre el fixture del padre: retirar el
// filtro devuelve la fila eliminada y permite llegar a la RPC, haciendo fallar
// las pruebas semánticas, aunque el resultado final del pago estuviera filtrado.
function registrar(input: RegistrarPagoProveedorInput = INPUT) {
  mock.queue("proveedor_facturas", factura, errorFactura);
  mock.queue("pagos_proveedor", pagoDevuelto);
  return registrarPagoProveedor(input, "user-fixture");
}

function expectSinAltaNiActividad() {
  expect(mock.rpcCalls.some((call) => call.fn === "registrar_pago_proveedor_atomico")).toBe(false);
  expect(mock.tableCalls.map((call) => call.table)).toEqual(["proveedor_facturas"]);
  expect(registrarActividad).not.toHaveBeenCalled();
}

describe("registrarPagoProveedor · vigencia del padre antes del alta", () => {
  it.each([
    ["eliminada", "request-fixture"], ["eliminada", undefined],
    ["ausente", "request-fixture"], ["ausente", undefined],
  ] as const)("rechaza factura %s con llave %s sin RPC ni actividad", async (estado, client_request_id) => {
    factura = estado === "ausente" ? null : { ...factura!, deleted_at: "2026-10-12T00:00:00Z" };
    await expect(registrar({ ...INPUT, client_request_id })).rejects.toMatchObject({
      code: "NOT_FOUND", message: "Factura de proveedor no encontrada.",
    });
    expect(mock.rpcCalls).toEqual([]);
    expectSinAltaNiActividad();
  });

  it.each(["eliminada", "ausente"])("un reintento tras quedar %s no crea registro ni actividad adicionales", async (estado) => {
    await expect(registrar()).resolves.toEqual(PAGO);
    factura = estado === "ausente" ? null : { ...factura!, deleted_at: "2026-10-13T00:00:00Z" };
    await expect(registrar()).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(mock.rpcCalls.filter((call) => call.fn === "registrar_pago_proveedor_atomico")).toHaveLength(1);
    expect(mock.tableCalls.map((call) => call.table)).toEqual(["proveedor_facturas", "pagos_proveedor", "proveedor_facturas"]);
    expect(registrarActividad).toHaveBeenCalledOnce();
  });

  it("conserva NOT_FOUND cuando falta la organización del padre", async () => {
    factura!.organization_id = null;
    await expect(registrar()).rejects.toMatchObject({ code: "NOT_FOUND" });
    expectSinAltaNiActividad();
  });

  it.each([false, true])("padre vivo conserva respuesta RPC con reintento=%s y actividad", async (reintento) => {
    mock.setRpcResult("registrar_pago_proveedor_atomico", {
      data: { pago_id: PAGO.id, movimiento_id: "mov-fixture", reintento }, error: null,
    });
    await expect(registrar()).resolves.toEqual(PAGO);
    expect(mock.tableCalls[0]).toEqual({
      table: "proveedor_facturas", ops: ["select", "eq", "is"],
      opArgs: [["organization_id, estado_aprobacion"], ["id", INPUT.proveedor_factura_id], ["deleted_at", null]],
    });
    expect(mock.rpcCalls).toEqual([
      { fn: "current_user_org_id", args: undefined },
      { fn: "registrar_pago_proveedor_atomico", args: {
        p_factura_id: INPUT.proveedor_factura_id, p_fecha_pago: INPUT.fecha_pago,
        p_monto: INPUT.monto, p_moneda: INPUT.moneda, p_metodo_pago: INPUT.metodo_pago,
        p_referencia: "", p_cuenta_bancaria_id: INPUT.cuenta_bancaria_id, p_notas: "",
        p_tipo_cambio_usd: undefined, p_diferencia_cambiaria_mxn: undefined, p_client_request_id: INPUT.client_request_id,
      } },
    ]);
    expect(mock.tableCalls.map((call) => call.table)).toEqual(["proveedor_facturas", "pagos_proveedor"]);
    expect(mock.tableCalls.some((call) => call.ops.some((op) => ["insert", "update", "delete", "upsert"].includes(op)))).toBe(false);
    expect(registrarActividad).toHaveBeenCalledExactlyOnceWith({
      modulo: "cxp", accion: "pagar", entidadId: INPUT.proveedor_factura_id,
      detalles: { pago_id: PAGO.id, monto: INPUT.monto, moneda: INPUT.moneda, metodo_pago: INPUT.metodo_pago,
        referencia: null, cuenta_bancaria_id: INPUT.cuenta_bancaria_id, cargo_mxn: INPUT.monto, movimiento_tesoreria: "creado" },
    });
  });

  it("conserva el error de lectura del padre aun con datos presentes", async () => {
    errorFactura = { code: "42501", message: "permission denied" };
    await expect(registrar()).rejects.toBe(errorFactura);
    expect(mock.rpcCalls).toEqual([]);
    expectSinAltaNiActividad();
  });

  it("conserva el error al resolver la organización activa", async () => {
    const error = { message: "org unavailable" };
    mock.setRpcResult("current_user_org_id", { data: null, error });
    await expect(registrar()).rejects.toBe(error);
    expectSinAltaNiActividad();
  });

  it("conserva ORG_MISMATCH antes de registrar", async () => {
    mock.setRpcResult("current_user_org_id", { data: "otra-org", error: null });
    await expect(registrar()).rejects.toMatchObject({ code: "ORG_MISMATCH", message: "ORG_MISMATCH" });
    expectSinAltaNiActividad();
  });

  it.each(["pendiente", "rechazada", null])("conserva el error tipado de aprobación %s", async (estado) => {
    factura!.estado_aprobacion = estado;
    await expect(registrar()).rejects.toBeInstanceOf(PagoRequiereAprobacionError);
    expectSinAltaNiActividad();
  });

  it.each([
    { proveedor_factura_id: "otra-factura" }, { fecha_pago: "2026-10-12" },
    { monto: 101 }, { moneda: "USD" },
  ])("una llave reutilizada con otro pago sigue rechazándose: %j", async (cambio) => {
    pagoDevuelto = { ...PAGO, ...cambio };
    mock.setRpcResult("registrar_pago_proveedor_atomico", {
      data: { pago_id: PAGO.id, movimiento_id: "mov-fixture", reintento: true }, error: null,
    });
    await expect(registrar()).rejects.toThrow(MSG_PAGO_LLAVE_REUSADA);
    expect(registrarActividad).not.toHaveBeenCalled();
  });

  it.each([null, { ...PAGO, deleted_at: "2026-10-12T00:00:00Z" }])("no acepta un pago devuelto no disponible: %j", async (pago) => {
    pagoDevuelto = pago;
    await expect(registrar()).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(registrarActividad).not.toHaveBeenCalled();
  });

  it("conserva el mapeo de aprobación rechazado por la RPC después del precheck", async () => {
    mock.setRpcResult("registrar_pago_proveedor_atomico", { data: null, error: { message: "LC_PAGO_SIN_APROBACION" } });
    await expect(registrar()).rejects.toBeInstanceOf(PagoRequiereAprobacionError);
    expect(registrarActividad).not.toHaveBeenCalled();
  });

  it("propaga el rechazo backend si el padre desapareció después del precheck", async () => {
    const error = { code: "P0001", message: "LC_CXP_NO_EXISTE: la factura de proveedor no existe o fue eliminada" };
    mock.setRpcResult("registrar_pago_proveedor_atomico", { data: null, error });
    await expect(registrar()).rejects.toBe(error);
    expect(mock.tableCalls.map((call) => call.table)).toEqual(["proveedor_facturas"]);
    expect(registrarActividad).not.toHaveBeenCalled();
  });
});
