import { describe, it, expect, vi, beforeEach } from "vitest";

const mock = await vi.hoisted(async () => {
  const { createSupabaseMock } = await import("@/services/__tests__/_supabaseChainMock");
  return createSupabaseMock();
});
vi.mock("@/integrations/supabase/client", () => ({ supabase: mock.supabase }));

import { listarConciliacionEmbarques } from "../conciliacionEmbarques";

interface Row {
  embarque_id: string;
  monto: number;
  moneda: "MXN" | "USD";
  estado_liquidacion: "Pendiente" | "Pagado";
  embarques: { expediente: string | null; cliente_nombre: string | null; estado: string | null } | null;
}

const row = (over: Partial<Row> = {}): Row => ({
  embarque_id: "e1",
  monto: 100,
  moneda: "MXN",
  estado_liquidacion: "Pendiente",
  embarques: { expediente: "EXP-001", cliente_nombre: "ACME", estado: "En tránsito" },
  ...over,
});

describe("listarConciliacionEmbarques", () => {
  beforeEach(() => {
    mock.tableCalls.length = 0;
  });

  it("agrupa por embarque+moneda y calcula métricas", async () => {
    mock.setTableResult("conceptos_costo", {
      data: [
        row({ embarque_id: "e1", monto: 100, estado_liquidacion: "Pagado" }),
        row({ embarque_id: "e1", monto: 50, estado_liquidacion: "Pendiente" }),
        row({ embarque_id: "e2", monto: 200, estado_liquidacion: "Pendiente", embarques: { expediente: "EXP-002", cliente_nombre: "BETA", estado: null } }),
      ],
      error: null,
    });

    const res = await listarConciliacionEmbarques();
    expect(res).toHaveLength(2);
    // Ordenado por mayor pendiente
    expect(res[0].embarque_id).toBe("e2");
    expect(res[0].pendiente).toBe(200);
    expect(res[0].estado_conciliacion).toBe("sin_facturar");

    const e1 = res.find((r) => r.embarque_id === "e1")!;
    expect(e1.presupuestado).toBe(150);
    expect(e1.pagado).toBe(100);
    expect(e1.pendiente).toBe(50);
    expect(e1.estado_conciliacion).toBe("parcial");
    expect(e1.conceptos_pendientes).toBe(1);
    expect(e1.conceptos_total).toBe(2);
  });

  it("clasifica como completa cuando cobertura >= 99%", async () => {
    mock.setTableResult("conceptos_costo", {
      data: [row({ monto: 100, estado_liquidacion: "Pagado" })],
      error: null,
    });
    const res = await listarConciliacionEmbarques();
    expect(res[0].estado_conciliacion).toBe("completa");
    expect(res[0].cobertura).toBe(1);
  });

  it("separa por moneda", async () => {
    mock.setTableResult("conceptos_costo", {
      data: [
        row({ embarque_id: "e1", moneda: "MXN", monto: 100 }),
        row({ embarque_id: "e1", moneda: "USD", monto: 50 }),
      ],
      error: null,
    });
    const res = await listarConciliacionEmbarques();
    expect(res).toHaveLength(2);
    expect(new Set(res.map((r) => r.moneda))).toEqual(new Set(["MXN", "USD"]));
  });

  it("filtra por estado_conciliacion", async () => {
    mock.setTableResult("conceptos_costo", {
      data: [
        row({ embarque_id: "a", monto: 100, estado_liquidacion: "Pagado" }),
        row({ embarque_id: "b", monto: 100, estado_liquidacion: "Pendiente" }),
      ],
      error: null,
    });
    const res = await listarConciliacionEmbarques({ estado: "completa" });
    expect(res).toHaveLength(1);
    expect(res[0].embarque_id).toBe("a");
  });

  it("filtra por search (expediente o cliente)", async () => {
    mock.setTableResult("conceptos_costo", {
      data: [
        row({ embarque_id: "a", embarques: { expediente: "EXP-AAA", cliente_nombre: "Uno", estado: null } }),
        row({ embarque_id: "b", embarques: { expediente: "EXP-BBB", cliente_nombre: "Dos", estado: null } }),
      ],
      error: null,
    });
    const res = await listarConciliacionEmbarques({ search: "bbb" });
    expect(res).toHaveLength(1);
    expect(res[0].expediente).toBe("EXP-BBB");
  });

  it("estado 'todos' no filtra", async () => {
    mock.setTableResult("conceptos_costo", {
      data: [row(), row({ embarque_id: "e2" })],
      error: null,
    });
    const res = await listarConciliacionEmbarques({ estado: "todos" });
    expect(res).toHaveLength(2);
  });

  it("propaga error de supabase", async () => {
    mock.setTableResult("conceptos_costo", { data: null, error: new Error("boom") });
    await expect(listarConciliacionEmbarques()).rejects.toThrow("boom");
  });

  it("data vacía retorna []", async () => {
    mock.setTableResult("conceptos_costo", { data: [], error: null });
    expect(await listarConciliacionEmbarques()).toEqual([]);
  });

  it("fallback expediente = id.slice(0,8) cuando embarques es null", async () => {
    mock.setTableResult("conceptos_costo", {
      data: [row({ embarque_id: "abcdef1234567890", embarques: null })],
      error: null,
    });
    const res = await listarConciliacionEmbarques();
    expect(res[0].expediente).toBe("abcdef12");
    expect(res[0].cliente_nombre).toBeNull();
  });

  it("aplica filtros organizationId y moneda al query", async () => {
    mock.setTableResult("conceptos_costo", { data: [], error: null });
    await listarConciliacionEmbarques({ organizationId: "org-1", moneda: "USD" });
    const call = mock.tableCalls[0];
    expect(call.table).toBe("conceptos_costo");
    expect(call.ops).toContain("eq");
  });
});
