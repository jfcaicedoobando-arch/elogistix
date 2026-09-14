/**
 * D5 (v13.823.382) — `actualizarPagoProveedor` delega en la RPC transaccional.
 *
 * Antes eran tres llamadas del navegador (actualizar pago → borrar movimiento →
 * crear movimiento): si una fallaba, la factura quedaba editada sin salida
 * bancaria o con la salida vieja. Ahora todo vive en una sola transacción.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mock = await vi.hoisted(async () => {
  const { createSupabaseMock } = await import("@/services/__tests__/_supabaseChainMock");
  return createSupabaseMock();
});
vi.mock("@/integrations/supabase/client", () => ({ supabase: mock.supabase }));
vi.mock("@/services/bitacora/registrar", () => ({ registrarActividad: vi.fn() }));

import { actualizarPagoProveedor } from "../pagoProveedorActualizar";
import { registrarActividad } from "@/services/bitacora/registrar";

const INPUT = {
  id: "pago-1",
  proveedor_factura_id: "fac-1",
  fecha_pago: "2026-06-01",
  monto: 500,
  moneda: "MXN" as const,
  tipo_cambio_usd: null,
  metodo_pago: "transferencia",
  cuenta_bancaria_id: "cta-1",
  expectedUpdatedAt: "2026-06-01T00:00:00Z",
};

beforeEach(() => {
  mock.tableCalls.length = 0;
  mock.rpcCalls.length = 0;
  mock.resetResults();
  mock.setTableResult("pagos_proveedor", {
    data: { id: "pago-1", organization_id: "org-1", monto: 400, moneda: "MXN", cuenta_bancaria_id: null, deleted_at: null },
    error: null,
  });
});

describe("actualizarPagoProveedor · RPC atómica (D5)", () => {
  it("cambio de cuenta/importe exitoso: una sola RPC y sin UPDATE directo", async () => {
    mock.setRpcResult("actualizar_pago_proveedor_atomico", {
      data: { pago_id: "pago-1", movimiento_id: "mov-1", movimiento_creado: true },
      error: null,
    });
    await actualizarPagoProveedor(INPUT, "user-1");
    expect(mock.rpcCalls.filter((c) => c.fn === "actualizar_pago_proveedor_atomico")).toHaveLength(1);
    expect(mock.rpcCalls[0].args).toMatchObject({
      p_pago_id: "pago-1",
      p_monto: 500,
      p_cuenta_bancaria_id: "cta-1",
      p_expected_updated_at: "2026-06-01T00:00:00Z",
    });
    expect(mock.tableCalls.filter((c) => c.ops.includes("update"))).toHaveLength(0);
    expect(mock.tableCalls.filter((c) => c.ops.includes("delete"))).toHaveLength(0);
  });

  it("registra la bitácora con el movimiento regenerado", async () => {
    mock.setRpcResult("actualizar_pago_proveedor_atomico", {
      data: { movimiento_creado: true },
      error: null,
    });
    await actualizarPagoProveedor(INPUT, "user-1");
    expect(registrarActividad).toHaveBeenCalled();
  });

  it("rollback forzado: propaga el error y no toca la bitácora", async () => {
    vi.mocked(registrarActividad).mockClear();
    mock.setRpcResult("actualizar_pago_proveedor_atomico", {
      data: null,
      error: { message: "LC_MOVIMIENTO_NO_CREADO: no se pudo regenerar la salida bancaria" },
    });
    await expect(actualizarPagoProveedor(INPUT, "user-1")).rejects.toThrow(/LC_MOVIMIENTO_NO_CREADO/);
    expect(registrarActividad).not.toHaveBeenCalled();
  });

  it("conflicto de concurrencia se traduce al aviso de la app", async () => {
    mock.setRpcResult("actualizar_pago_proveedor_atomico", {
      data: null,
      error: { message: "LC_CONFLICTO_CONCURRENCIA: otro usuario editó este pago" },
    });
    await expect(actualizarPagoProveedor(INPUT, "user-1")).rejects.toThrow();
  });
});
