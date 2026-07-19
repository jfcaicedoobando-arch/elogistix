import { describe, it, expect, vi, beforeEach } from "vitest";

const mock = await vi.hoisted(async () => {
  const { createSupabaseMock } = await import("@/services/__tests__/_supabaseChainMock");
  return createSupabaseMock();
});
vi.mock("@/integrations/supabase/client", () => ({ supabase: mock.supabase }));

import {
  fetchNotasCreditoFactura,
  crearNotaCreditoProveedor,
  aprobarNotaCredito,
  aplicarNotaCredito,
  cancelarNotaCredito,
  NcProveedorTransicionInvalidaError,
} from "../proveedorNotasCredito";

describe("proveedorNotasCredito service", () => {
  beforeEach(() => {
    mock.tableCalls.length = 0;
  });

  it("fetchNotasCreditoFactura filtra y ordena desc", async () => {
    mock.setTableResult("proveedor_notas_credito", { data: [{ id: "nc1" }], error: null });
    const r = await fetchNotasCreditoFactura("f1");
    expect(r).toHaveLength(1);
    const call = mock.tableCalls.find(c => c.table === "proveedor_notas_credito");
    expect(call?.ops).toContain("eq");
    expect(call?.ops).toContain("order");
  });

  it("fetchNotasCreditoFactura retorna [] si data es null", async () => {
    mock.setTableResult("proveedor_notas_credito", { data: null, error: null });
    expect(await fetchNotasCreditoFactura("f1")).toEqual([]);
  });

  it("fetchNotasCreditoFactura propaga error", async () => {
    mock.setTableResult("proveedor_notas_credito", { data: null, error: { message: "x" } });
    await expect(fetchNotasCreditoFactura("f1")).rejects.toMatchObject({ message: "x" });
  });

  it("crearNotaCreditoProveedor inserta y retorna fila", async () => {
    mock.setTableResult("proveedor_notas_credito", { data: { id: "nc1", monto: 100 }, error: null });
    const payload = { proveedor_factura_id: "f1", monto: 100, organization_id: "org-1" } as Parameters<typeof crearNotaCreditoProveedor>[0];
    const r = await crearNotaCreditoProveedor(payload);
    expect(r.id).toBe("nc1");
    expect(mock.getMutationPayload("proveedor_notas_credito", "insert")).toEqual(payload);
  });

  it("aplicarNotaCredito setea estado=Aplicada", async () => {
    mock.setTableResult("proveedor_notas_credito", { data: null, error: null });
    await aplicarNotaCredito("nc1");
    expect(mock.getMutationPayload("proveedor_notas_credito", "update")).toMatchObject({ estado: "Aplicada" });
  });

  it("cancelarNotaCredito setea estado=Cancelada", async () => {
    mock.setTableResult("proveedor_notas_credito", { data: null, error: null });
    await cancelarNotaCredito("nc1");
    expect(mock.getMutationPayload("proveedor_notas_credito", "update")).toMatchObject({ estado: "Cancelada" });
  });

  it("aplicarNotaCredito propaga error", async () => {
    mock.setTableResult("proveedor_notas_credito", { data: null, error: { message: "boom" } });
    await expect(aplicarNotaCredito("nc1")).rejects.toMatchObject({ message: "boom" });
  });

  it("cancelarNotaCredito propaga error", async () => {
    mock.setTableResult("proveedor_notas_credito", { data: null, error: { message: "boom" } });
    await expect(cancelarNotaCredito("nc1")).rejects.toMatchObject({ message: "boom" });
  });

  it("crearNotaCreditoProveedor propaga error", async () => {
    mock.setTableResult("proveedor_notas_credito", { data: null, error: { message: "x" } });
    await expect(
      crearNotaCreditoProveedor({ proveedor_factura_id: "f1" } as Parameters<typeof crearNotaCreditoProveedor>[0]),
    ).rejects.toMatchObject({ message: "x" });
  });
});
