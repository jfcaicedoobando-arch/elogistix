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
import { esConflictoConcurrencia } from "@/lib/errors/concurrencia";
import { registrarActividad } from "@/services/bitacora/registrar";

vi.mock("@/services/bitacora/registrar", () => ({
  registrarActividad: vi.fn().mockResolvedValue(undefined),
}));

describe("proveedorNotasCredito service", () => {
  beforeEach(() => {
    mock.tableCalls.length = 0;
    vi.mocked(registrarActividad).mockClear();
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
    mock.setTableResult("proveedor_notas_credito", { data: { id: "nc1" }, error: null });
    await aplicarNotaCredito("nc1");
    expect(mock.getMutationPayload("proveedor_notas_credito", "update")).toMatchObject({ estado: "Aplicada" });
  });

  it("cancelarNotaCredito setea estado=Cancelada", async () => {
    mock.setTableResult("proveedor_notas_credito", { data: { id: "nc1" }, error: null });
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

  it("aprobarNotaCredito setea estado=Aprobada con timestamp", async () => {
    mock.setTableResult("proveedor_notas_credito", { data: { id: "nc1" }, error: null });
    await aprobarNotaCredito("nc1");
    const payload = mock.getMutationPayload("proveedor_notas_credito", "update") as Record<string, unknown>;
    expect(payload.estado).toBe("Aprobada");
    expect(typeof payload.aprobada_at).toBe("string");
  });

  it("aplicarNotaCredito traduce LC_NC_PROV_TRANSICION_INVALIDA a error tipado", async () => {
    mock.setTableResult("proveedor_notas_credito", {
      data: null,
      error: { message: "LC_NC_PROV_TRANSICION_INVALIDA\nHINT: No se puede pasar de Borrador a Aplicada.", code: "P0001" },
    });
    const err = await aplicarNotaCredito("nc1").catch((e) => e);
    expect(err).toBeInstanceOf(NcProveedorTransicionInvalidaError);
    expect((err as NcProveedorTransicionInvalidaError).hint).toBe("No se puede pasar de Borrador a Aplicada.");
  });

  it("cancelarNotaCredito traduce LC_NC_PROV_ESTADO_TERMINAL a error tipado", async () => {
    mock.setTableResult("proveedor_notas_credito", {
      data: null,
      error: { message: "LC_NC_PROV_ESTADO_TERMINAL\nHINT: La nota de crédito está Cancelada y no admite cambios de estado.", code: "P0001" },
    });
    const err = await cancelarNotaCredito("nc1").catch((e) => e);
    expect(err).toBeInstanceOf(NcProveedorTransicionInvalidaError);
  });

  it("aprobarNotaCredito lanza conflicto de concurrencia si el UPDATE no afecta filas (0 filas) y no registra actividad", async () => {
    mock.setTableResult("proveedor_notas_credito", { data: null, error: null });
    const err = await aprobarNotaCredito("nc1").catch((e) => e);
    expect(esConflictoConcurrencia(err)).toBe(true);
    expect(registrarActividad).not.toHaveBeenCalled();
  });

  it("aplicarNotaCredito lanza conflicto de concurrencia si el UPDATE no afecta filas (0 filas) y no registra actividad", async () => {
    mock.setTableResult("proveedor_notas_credito", { data: null, error: null });
    const err = await aplicarNotaCredito("nc1").catch((e) => e);
    expect(esConflictoConcurrencia(err)).toBe(true);
    expect(registrarActividad).not.toHaveBeenCalled();
  });

  it("cancelarNotaCredito lanza conflicto de concurrencia si el UPDATE no afecta filas (0 filas) y no registra actividad", async () => {
    mock.setTableResult("proveedor_notas_credito", { data: null, error: null });
    const err = await cancelarNotaCredito("nc1").catch((e) => e);
    expect(esConflictoConcurrencia(err)).toBe(true);
    expect(registrarActividad).not.toHaveBeenCalled();
  });

  it("crearNotaCreditoProveedor traduce LC_NC_PROV_INSERT_ESTADO_INVALIDO a error tipado (R.7)", async () => {
    mock.setTableResult("proveedor_notas_credito", {
      data: null,
      error: {
        message:
          "LC_NC_PROV_INSERT_ESTADO_INVALIDO\nHINT: Toda nueva NC debe empezar en Borrador.",
        code: "P0001",
      },
    });
    const err = await crearNotaCreditoProveedor({
      proveedor_factura_id: "f1",
      estado: "Aplicada",
    } as Parameters<typeof crearNotaCreditoProveedor>[0]).catch((e) => e);
    expect(err).toBeInstanceOf(NcProveedorTransicionInvalidaError);
    expect((err as NcProveedorTransicionInvalidaError).hint).toBe(
      "Toda nueva NC debe empezar en Borrador.",
    );
  });
});
