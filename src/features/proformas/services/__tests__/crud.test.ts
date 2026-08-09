import { describe, it, expect, beforeEach, vi } from "vitest";

const mock = await vi.hoisted(async () => {
  const { createSupabaseMock } = await import("@/services/__tests__/_supabaseChainMock");
  return createSupabaseMock();
});
vi.mock("@/integrations/supabase/client", () => ({ supabase: mock.supabase }));
vi.mock("@sentry/react", () => ({
  startSpan: (_o: unknown, fn: () => unknown) => fn(),
  metrics: { distribution: vi.fn() },
}));

import {
  crearProforma,
  eliminarProforma,
  aprobarProformas,
} from "@/features/proformas/services/crud";

const TOTALES = {
  subtotal_usd: 100,
  iva_usd: 16,
  total_usd: 116,
  subtotal_mxn: 2000,
  iva_mxn: 320,
  total_mxn: 2320,
};

const BASE = {
  organizationId: "org1",
  embarqueId: "e1",
  clienteId: "c1",
  clienteNombre: "ACME",
  expediente: "EXP-1",
  blMaster: null,
  totales: TOTALES,
  notas: null,
  operador: null,
  diasCredito: 30,
  tasaIva: 0.16,
};

beforeEach(() => {
  mock.tableCalls.length = 0;
  mock.rpcCalls.length = 0;
});

describe("services/proforma/crud", () => {
  it("crearProforma rechaza si no hay conceptos", async () => {
    await expect(
      crearProforma({ ...BASE, conceptoIds: [] } as never),
    ).rejects.toThrow(/al menos un concepto/);
  });

  it("crearProforma devuelve fila desde RPC", async () => {
    mock.setRpcResult("crear_proforma_atomica", {
      data: { id: "pf1", numero: "PRF-001" },
      error: null,
    });
    const r = await crearProforma({ ...BASE, conceptoIds: ["c1"] } as never);
    expect(r.id).toBe("pf1");
  });

  it("crearProforma propaga error de RPC", async () => {
    mock.setRpcResult("crear_proforma_atomica", { data: null, error: { message: "x" } });
    await expect(
      crearProforma({ ...BASE, conceptoIds: ["c1"] } as never),
    ).rejects.toThrow();
  });

  it("crearProforma lanza si RPC retorna data null sin error", async () => {
    mock.setRpcResult("crear_proforma_atomica", { data: null, error: null });
    await expect(
      crearProforma({ ...BASE, conceptoIds: ["c1"] } as never),
    ).rejects.toThrow(/No se pudo crear/);
  });

  it("Ola 6 · M15: eliminarProforma usa la RPC atómica", async () => {
    mock.setRpcResult("eliminar_proforma_rpc", {
      data: { numero: "PF-1", embarque_id: "e1", eliminada: true },
      error: null,
    });
    await expect(
      eliminarProforma({ proformaId: "pf1", embarqueId: "e1" }),
    ).resolves.toBeUndefined();
    const call = mock.rpcCalls.find((c) => c.fn === "eliminar_proforma_rpc");
    expect(call?.args).toMatchObject({ p_proforma_id: "pf1" });
  });

  it("eliminarProforma propaga el error de la RPC (p. ej. proforma facturada)", async () => {
    mock.setRpcResult("eliminar_proforma_rpc", {
      data: null,
      error: { message: "LC_PROFORMA_FACTURADA" },
    });
    await expect(
      eliminarProforma({ proformaId: "pf1", embarqueId: "e1" }),
    ).rejects.toThrow(/LC_PROFORMA_FACTURADA/);
  });

  it("aprobarProformas rechaza con array vacío", async () => {
    await expect(aprobarProformas([])).rejects.toThrow(/al menos una proforma/);
  });

  it("aprobarProformas actualiza estado cuando afecta todas las filas", async () => {
    mock.setTableResult("proformas", { data: [{ id: "pf1" }], error: null });
    await expect(aprobarProformas(["pf1"])).resolves.toBeUndefined();
  });

  it("aprobarProformas propaga error", async () => {
    mock.setTableResult("proformas", { data: null, error: { message: "x" } });
    await expect(aprobarProformas(["pf1"])).rejects.toThrow();
  });

  it("aprobarProformas lanza si RLS filtra silenciosamente (0 filas actualizadas)", async () => {
    // Simula RLS bloqueando: update sin error pero data vacía.
    mock.setTableResult("proformas", { data: [], error: null });
    await expect(aprobarProformas(["pf1", "pf2"])).rejects.toThrow(/No se pudo aprobar 2 de 2/);
  });
});
