import { describe, it, expect, vi, beforeEach } from "vitest";

const mock = await vi.hoisted(async () => {
  const { createSupabaseMock } = await import("@/services/__tests__/_supabaseChainMock");
  return createSupabaseMock();
});
vi.mock("@/integrations/supabase/client", () => ({ supabase: mock.supabase }));

import { listarConciliacionEmbarques } from "../conciliacionEmbarques";

const SAMPLE = [
  // Embarque A (MXN): 1000 presupuestado, 1000 pagado → completa
  {
    embarque_id: "emb-a", monto: "1000", moneda: "MXN", estado_liquidacion: "Pagado",
    embarques: { expediente: "MX-25-001", cliente_nombre: "ACME", estado: "EnTransito" },
  },
  // Embarque B (MXN): 2000 presupuestado, 500 pagado → parcial
  {
    embarque_id: "emb-b", monto: "500", moneda: "MXN", estado_liquidacion: "Pagado",
    embarques: { expediente: "MX-25-002", cliente_nombre: "Globex", estado: "EnPuerto" },
  },
  {
    embarque_id: "emb-b", monto: "1500", moneda: "MXN", estado_liquidacion: "Pendiente",
    embarques: { expediente: "MX-25-002", cliente_nombre: "Globex", estado: "EnPuerto" },
  },
  // Embarque C (USD): 800 pendiente → sin_facturar
  {
    embarque_id: "emb-c", monto: "800", moneda: "USD", estado_liquidacion: "Pendiente",
    embarques: { expediente: "MX-25-003", cliente_nombre: "Umbrella", estado: "Nuevo" },
  },
];

describe("listarConciliacionEmbarques", () => {
  beforeEach(() => {
    mock.tableCalls.length = 0;
    mock.resetResults();
    mock.setTableResult("conceptos_costo", { data: SAMPLE, error: null });
  });

  it("agrega por embarque+moneda y clasifica estado_conciliacion", async () => {
    const rows = await listarConciliacionEmbarques();
    expect(rows.length).toBe(3);
    const byId = Object.fromEntries(rows.map((r) => [r.embarque_id, r]));
    expect(byId["emb-a"].estado_conciliacion).toBe("completa");
    expect(byId["emb-a"].cobertura).toBeCloseTo(1);
    expect(byId["emb-b"].estado_conciliacion).toBe("parcial");
    expect(byId["emb-b"].pendiente).toBe(1500);
    expect(byId["emb-b"].conceptos_pendientes).toBe(1);
    expect(byId["emb-c"].estado_conciliacion).toBe("sin_facturar");
    expect(byId["emb-c"].moneda).toBe("USD");
  });

  it("ordena por pendiente descendente", async () => {
    const rows = await listarConciliacionEmbarques();
    // emb-b(1500) > emb-c(800) > emb-a(0)
    expect(rows[0].embarque_id).toBe("emb-b");
    expect(rows[rows.length - 1].embarque_id).toBe("emb-a");
  });

  it("filtra por estado_conciliacion", async () => {
    const rows = await listarConciliacionEmbarques({ estado: "sin_facturar" });
    expect(rows.map((r) => r.embarque_id)).toEqual(["emb-c"]);
  });

  it("filtra por búsqueda de cliente/expediente", async () => {
    const rows = await listarConciliacionEmbarques({ search: "globex" });
    expect(rows.map((r) => r.embarque_id)).toEqual(["emb-b"]);
  });

  it("propaga errores de Supabase", async () => {
    mock.setTableResult("conceptos_costo", { data: null, error: { message: "boom" } });
    await expect(listarConciliacionEmbarques()).rejects.toThrow();
  });
});
