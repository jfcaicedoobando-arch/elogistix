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

import { listarPagosFactura, registrarPagoFactura, eliminarPagoFactura, PagoConRepVivoError } from "../index";

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
  it("happy path: inserta sin error y devuelve el id", async () => {
    mock.setTableResult("pagos_factura", { data: { id: "pago-1" }, error: null });
    await expect(registrarPagoFactura(validInput)).resolves.toBe("pago-1");
    expect(mock.tableCalls[0]?.ops).toContain("insert");
  });

  it("propaga error de supabase en insert", async () => {
    mock.setTableResult("pagos_factura", { data: null, error: { message: "fk violated" } });
    await expect(registrarPagoFactura(validInput)).rejects.toThrow();
  });
});

describe("eliminarPagoFactura", () => {
  it("hace soft-delete (update deleted_at) cuando no hay REP vivo", async () => {
    mock.setTableResult("pagos_factura", { data: { id: "p-1", uuid_rep: null, rep_cancelado_en: null }, error: null });
    await expect(eliminarPagoFactura("p-1")).resolves.toBeUndefined();
    const ops = mock.tableCalls.flatMap((c) => c.ops);
    expect(ops).toContain("update");
  });

  it("permite eliminar cuando el REP existe pero ya está cancelado", async () => {
    mock.setTableResult("pagos_factura", { data: { id: "p-1", uuid_rep: "uuid-abc", rep_cancelado_en: "2026-01-01" }, error: null });
    await expect(eliminarPagoFactura("p-1")).resolves.toBeUndefined();
  });

  it("R.5 · Bug 8 — bloquea eliminar cuando hay REP vivo (uuid_rep + rep_cancelado_en NULL)", async () => {
    mock.setTableResult("pagos_factura", { data: { id: "p-1", uuid_rep: "uuid-abc", rep_cancelado_en: null }, error: null });
    await expect(eliminarPagoFactura("p-1")).rejects.toBeInstanceOf(PagoConRepVivoError);
    // Verificamos que ni siquiera se intentó el update.
    const updates = mock.tableCalls.filter((c) => c.ops.includes("update"));
    expect(updates).toHaveLength(0);
  });

  it("R.5 · Bug 8 — mapea LC_PAGO_CON_REP_VIVO del trigger a PagoConRepVivoError", async () => {
    // Primer llamado (select) sin REP → pasa la defensa temprana; el trigger
    // simula que entre la lectura y el update apareció un REP.
    let call = 0;
    mock.setTableResult("pagos_factura", { data: { id: "p-1", uuid_rep: null, rep_cancelado_en: null }, error: null });
    const original = mock.supabase.from;
    (mock.supabase as unknown as { from: typeof original }).from = ((table: string) => {
      call += 1;
      if (call === 2) {
        mock.setTableResult("pagos_factura", { data: null, error: { message: "LC_PAGO_CON_REP_VIVO: no permitido" } });
      }
      return original(table);
    }) as typeof original;
    try {
      await expect(eliminarPagoFactura("p-1")).rejects.toBeInstanceOf(PagoConRepVivoError);
    } finally {
      (mock.supabase as unknown as { from: typeof original }).from = original;
    }
  });

  it("propaga errores genéricos de supabase al eliminar", async () => {
    // La defensa temprana pasa (uuid_rep null), luego el update falla.
    let call = 0;
    mock.setTableResult("pagos_factura", { data: { id: "p-1", uuid_rep: null, rep_cancelado_en: null }, error: null });
    const original = mock.supabase.from;
    (mock.supabase as unknown as { from: typeof original }).from = ((table: string) => {
      call += 1;
      if (call === 2) mock.setTableResult("pagos_factura", { data: null, error: { message: "rls" } });
      return original(table);
    }) as typeof original;
    try {
      await expect(eliminarPagoFactura("p-1")).rejects.toThrow();
    } finally {
      (mock.supabase as unknown as { from: typeof original }).from = original;
    }
  });
});
