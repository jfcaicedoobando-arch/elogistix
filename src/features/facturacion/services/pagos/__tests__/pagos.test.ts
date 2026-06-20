import { describe, it, expect, vi, beforeEach } from "vitest";

const mock = await vi.hoisted(async () => {
  const { createSupabaseMock } = await import("@/services/__tests__/_supabaseChainMock");
  return createSupabaseMock();
});
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    ...mock.supabase,
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "u-1" } } }) },
  },
}));

import { listarPagosFactura, registrarPagoFactura, eliminarPagoFactura } from "../index";

const validInput = {
  factura_id: "fac-1",
  fecha_pago: "2025-01-15",
  monto: 1000,
  moneda: "MXN" as const,
  tipo_cambio: 1,
  monto_aplicado_factura: 1000,
  forma_pago: "transferencia",
};

beforeEach(() => { mock.tableCalls.length = 0; });

describe("listarPagosFactura", () => {
  it("devuelve arreglo de pagos", async () => {
    mock.setTableResult("pagos_factura", { data: [{ id: "p-1" }, { id: "p-2" }], error: null });
    const r = await listarPagosFactura("fac-1");
    expect(r).toHaveLength(2);
  });

  it("devuelve [] cuando data es null", async () => {
    mock.setTableResult("pagos_factura", { data: null, error: null });
    const r = await listarPagosFactura("fac-1");
    expect(r).toEqual([]);
  });

  it("propaga error de supabase al listar pagos", async () => {
    mock.setTableResult("pagos_factura", { data: null, error: { message: "err" } });
    await expect(listarPagosFactura("fac-1")).rejects.toThrow();
  });
});

describe("registrarPagoFactura", () => {
  it("happy path: inserta sin error", async () => {
    mock.setTableResult("pagos_factura", { data: {}, error: null });
    await expect(registrarPagoFactura(validInput)).resolves.toBeUndefined();
    expect(mock.tableCalls[0]?.ops).toContain("insert");
  });

  it("propaga error de supabase en insert", async () => {
    mock.setTableResult("pagos_factura", { data: null, error: { message: "fk violated" } });
    await expect(registrarPagoFactura(validInput)).rejects.toThrow();
  });
});

describe("eliminarPagoFactura", () => {
  it("hace soft-delete (update deleted_at)", async () => {
    mock.setTableResult("pagos_factura", { data: {}, error: null });
    await expect(eliminarPagoFactura("p-1")).resolves.toBeUndefined();
    expect(mock.tableCalls[0]?.ops).toContain("update");
  });

  it("propaga error de supabase al registrar pago", async () => {
    mock.setTableResult("pagos_factura", { data: null, error: { message: "rls" } });
    await expect(eliminarPagoFactura("p-1")).rejects.toThrow();
  });
});
