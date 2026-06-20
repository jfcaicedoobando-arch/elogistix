import { describe, it, expect, beforeEach, vi } from "vitest";

const mock = await vi.hoisted(async () => {
  const { createSupabaseMock } = await import("@/services/__tests__/_supabaseChainMock");
  const base = createSupabaseMock();
  const getUser = vi.fn();
  return {
    ...base,
    getUser,
    supabase: { ...base.supabase, auth: { getUser } },
  };
});
vi.mock("@/integrations/supabase/client", () => ({ supabase: mock.supabase }));

import {
  listarPagosFactura,
  registrarPagoFactura,
  eliminarPagoFactura,
} from "@/features/facturacion/services/pagos";

beforeEach(() => {
  mock.tableCalls.length = 0;
  mock.getUser.mockReset();
  mock.getUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
});

const INPUT = {
  factura_id: "f1",
  fecha_pago: "2026-06-01",
  monto: 1000,
  moneda: "MXN" as const,
  tipo_cambio: 1,
  monto_aplicado_factura: 1000,
  forma_pago: "transferencia",
};

describe("services/pagos-factura", () => {
  it("listarPagosFactura devuelve lista", async () => {
    mock.setTableResult("pagos_factura", { data: [{ id: "p1" }], error: null });
    const r = await listarPagosFactura("f1");
    expect(r).toHaveLength(1);
  });

  it("listarPagosFactura devuelve [] cuando data es null", async () => {
    mock.setTableResult("pagos_factura", { data: null, error: null });
    const r = await listarPagosFactura("f1");
    expect(r).toEqual([]);
  });

  it("listarPagosFactura propaga error", async () => {
    mock.setTableResult("pagos_factura", { data: null, error: { message: "x" } });
    await expect(listarPagosFactura("f1")).rejects.toThrow();
  });

  it("registrarPagoFactura inserta con created_by", async () => {
    mock.setTableResult("pagos_factura", { data: null, error: null });
    await registrarPagoFactura(INPUT as never);
    const payload = mock.tableCalls[0].opArgs[mock.tableCalls[0].ops.indexOf("insert")]?.[0] as Record<string, unknown>;
    expect(payload.created_by).toBe("user-1");
    expect(payload.diferencia_cambiaria_mxn).toBe(0);
  });

  it("registrarPagoFactura usa diferencia_cambiaria_mxn dado", async () => {
    mock.setTableResult("pagos_factura", { data: null, error: null });
    await registrarPagoFactura({ ...INPUT, diferencia_cambiaria_mxn: 25 } as never);
    const payload = mock.tableCalls[0].opArgs[mock.tableCalls[0].ops.indexOf("insert")]?.[0] as Record<string, unknown>;
    expect(payload.diferencia_cambiaria_mxn).toBe(25);
  });

  it("registrarPagoFactura normaliza referencia/notas a string vacío", async () => {
    mock.setTableResult("pagos_factura", { data: null, error: null });
    await registrarPagoFactura(INPUT as never);
    const payload = mock.tableCalls[0].opArgs[mock.tableCalls[0].ops.indexOf("insert")]?.[0] as Record<string, unknown>;
    expect(payload.referencia).toBe("");
    expect(payload.notas).toBe("");
  });

  it("registrarPagoFactura usa null created_by sin user", async () => {
    mock.getUser.mockResolvedValue({ data: { user: null } });
    mock.setTableResult("pagos_factura", { data: null, error: null });
    await registrarPagoFactura(INPUT as never);
    const payload = mock.tableCalls[0].opArgs[mock.tableCalls[0].ops.indexOf("insert")]?.[0] as Record<string, unknown>;
    expect(payload.created_by).toBeNull();
  });

  it("registrarPagoFactura propaga error", async () => {
    mock.setTableResult("pagos_factura", { data: null, error: { message: "x" } });
    await expect(registrarPagoFactura(INPUT as never)).rejects.toThrow();
  });

  it("eliminarPagoFactura hace soft delete con deleted_by", async () => {
    mock.setTableResult("pagos_factura", { data: null, error: null });
    await eliminarPagoFactura("p1");
    const payload = mock.tableCalls[0].opArgs[mock.tableCalls[0].ops.indexOf("update")]?.[0] as Record<string, unknown>;
    expect(payload.deleted_by).toBe("user-1");
    expect(typeof payload.deleted_at).toBe("string");
  });

  it("eliminarPagoFactura propaga error", async () => {
    mock.setTableResult("pagos_factura", { data: null, error: { message: "x" } });
    await expect(eliminarPagoFactura("p1")).rejects.toThrow();
  });
});
