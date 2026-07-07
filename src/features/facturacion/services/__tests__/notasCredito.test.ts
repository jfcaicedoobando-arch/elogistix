import { describe, it, expect, beforeEach, vi } from "vitest";

const mock = await vi.hoisted(async () => {
  const { createSupabaseMock } = await import("@/services/__tests__/_supabaseChainMock");
  return createSupabaseMock();
});
vi.mock("@/integrations/supabase/client", () => ({ supabase: mock.supabase }));
vi.mock("@/features/auth/services", () => ({
  getCurrentUser: vi.fn().mockResolvedValue({ id: "user-1" }),
}));

import {
  listarNotasCreditoPorFactura,
  crearNotaCredito,
  cambiarEstadoNotaCredito,
} from "@/features/facturacion/services/notasCredito";

beforeEach(() => {
  mock.tableCalls.length = 0;
});

const INPUT = {
  factura_id: "f1",
  folio: "NC-001",
  motivo: "descuento" as const,
  descripcion: "x",
  monto: 100,
  moneda: "MXN" as const,
  tipo_cambio: 1,
  fecha_emision: "2026-06-01",
};

describe("services/facturas/notasCredito", () => {
  it("listarNotasCreditoPorFactura devuelve filas", async () => {
    mock.setTableResult("factura_notas_credito", {
      data: [{ id: "nc1", estado: "Borrador" }],
      error: null,
    });
    const r = await listarNotasCreditoPorFactura("f1");
    expect(r).toHaveLength(1);
  });

  it("listarNotasCreditoPorFactura propaga error", async () => {
    mock.setTableResult("factura_notas_credito", { data: null, error: { message: "x" } });
    await expect(listarNotasCreditoPorFactura("f1")).rejects.toThrow();
  });

  it("crearNotaCredito inserta con estado Borrador", async () => {
    mock.setTableResult("factura_notas_credito", {
      data: { id: "nc1", estado: "Borrador" },
      error: null,
    });
    const r = await crearNotaCredito(INPUT as never);
    expect(r.id).toBe("nc1");
  });

  it("crearNotaCredito propaga error", async () => {
    mock.setTableResult("factura_notas_credito", { data: null, error: { message: "x" } });
    await expect(crearNotaCredito(INPUT as never)).rejects.toThrow();
  });

  it("crearNotaCredito asigna folio provisional BORRADOR-<ts> cuando no viene folio (v13.213.20)", async () => {
    mock.setTableResult("factura_notas_credito", { data: { id: "nc1" }, error: null });
    const { folio: _omit, ...sinFolio } = INPUT;
    void _omit;
    await crearNotaCredito(sinFolio as never);
    const payload = mock.getMutationPayload("factura_notas_credito", "insert") as { folio?: string };
    expect(payload.folio).toMatch(/^BORRADOR-\d{1,8}$/);
  });

  it("cambiarEstadoNotaCredito permite Borrador→Aprobada", async () => {
    mock.setTableResult("factura_notas_credito", { data: null, error: null });
    await expect(
      cambiarEstadoNotaCredito("nc1", "Borrador", "Aprobada"),
    ).resolves.toBeUndefined();
  });

  it("cambiarEstadoNotaCredito permite Aprobada→Aplicada", async () => {
    mock.setTableResult("factura_notas_credito", { data: null, error: null });
    await expect(
      cambiarEstadoNotaCredito("nc1", "Aprobada", "Aplicada"),
    ).resolves.toBeUndefined();
  });

  it("cambiarEstadoNotaCredito rechaza transición inválida", async () => {
    await expect(
      cambiarEstadoNotaCredito("nc1", "Aplicada", "Borrador"),
    ).rejects.toThrow(/Transición inválida/);
  });

  it("cambiarEstadoNotaCredito propaga error de update", async () => {
    mock.setTableResult("factura_notas_credito", { data: null, error: { message: "boom" } });
    await expect(
      cambiarEstadoNotaCredito("nc1", "Borrador", "Cancelada"),
    ).rejects.toThrow();
  });
});
