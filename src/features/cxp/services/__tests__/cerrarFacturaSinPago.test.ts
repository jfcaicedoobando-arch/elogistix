/**
 * Tests del wrapper `cerrarFacturaProveedorSinPago` (Ola A · A4).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mock = await vi.hoisted(async () => {
  const { createSupabaseMock } = await import("@/services/__tests__/_supabaseChainMock");
  return createSupabaseMock();
});
vi.mock("@/integrations/supabase/client", () => ({ supabase: mock.supabase }));

import {
  cerrarFacturaProveedorSinPago,
  MOTIVOS_CIERRE_SIN_PAGO,
  type MotivoCierreSinPago,
} from "../cerrarFacturaSinPago";

const FID = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";

describe("cerrarFacturaProveedorSinPago", () => {
  beforeEach(() => {
    mock.rpcCalls.length = 0;
  });

  it("llama al RPC con los parámetros correctos y devuelve el id", async () => {
    mock.setRpcResult("cerrar_factura_proveedor_sin_pago", { data: "pago-ajuste-1", error: null });
    const res = await cerrarFacturaProveedorSinPago({
      facturaId: FID,
      motivo: "compensacion",
      comentario: "  NC-1234  ",
    });
    expect(res).toBe("pago-ajuste-1");
    expect(mock.rpcCalls).toHaveLength(1);
    expect(mock.rpcCalls[0].fn).toBe("cerrar_factura_proveedor_sin_pago");
    expect(mock.rpcCalls[0].args).toMatchObject({
      p_factura_id: FID,
      p_motivo: "compensacion",
      p_comentario: "NC-1234",
    });
  });

  it("omite p_comentario cuando está vacío o sólo espacios", async () => {
    mock.setRpcResult("cerrar_factura_proveedor_sin_pago", { data: "ok", error: null });
    await cerrarFacturaProveedorSinPago({ facturaId: FID, motivo: "duplicada", comentario: "   " });
    const args = mock.rpcCalls[0].args as Record<string, unknown>;
    expect(args).not.toHaveProperty("p_comentario");
  });

  it("propaga el error del RPC tal cual", async () => {
    const err = new Error("SOBREPAGO_PROVEEDOR");
    mock.setRpcResult("cerrar_factura_proveedor_sin_pago", { data: null, error: err });
    await expect(
      cerrarFacturaProveedorSinPago({ facturaId: FID, motivo: "condonacion" }),
    ).rejects.toBe(err);
  });

  it("cataloga los 4 motivos tipificados en español", () => {
    const values = MOTIVOS_CIERRE_SIN_PAGO.map((m) => m.value);
    const expected: MotivoCierreSinPago[] = [
      "compensacion",
      "condonacion",
      "ajuste_historico",
      "duplicada",
    ];
    expect(values.sort()).toEqual(expected.sort());
    for (const m of MOTIVOS_CIERRE_SIN_PAGO) {
      expect(m.label.length).toBeGreaterThan(0);
      expect(m.descripcion.length).toBeGreaterThan(0);
    }
  });
});
