import { describe, it, expect, vi, beforeEach } from "vitest";

const mock = await vi.hoisted(async () => {
  const { createSupabaseMock } = await import("@/services/__tests__/_supabaseChainMock");
  return createSupabaseMock();
});
vi.mock("@/integrations/supabase/client", () => ({ supabase: mock.supabase }));

import { fetchLayoutContableData, fetchEstadoCuentaFacturas } from "../exports";

beforeEach(() => {
  mock.tableCalls.length = 0;
});

describe("fetchLayoutContableData", () => {
  it("retorna estructura vacía si no hay ids (sin consultar BD)", async () => {
    const res = await fetchLayoutContableData([]);
    expect(res.facturas).toEqual([]);
    expect(res.rfcByClienteId.size).toBe(0);
    expect(mock.tableCalls.length).toBe(0);
  });

  it("consulta facturas + clientes y arma map de RFC por cliente_id", async () => {
    mock.setTableResult("facturas", {
      data: [
        { numero: "F1", fecha_emision: "2026-01-01", subtotal: 100, iva: 16, total: 116,
          moneda: "MXN", tipo_cambio: null, expediente: "E1", referencia_bl: null,
          estado: "Emitida", cliente_id: "cl1", cliente_nombre: "A" },
        { numero: "F2", fecha_emision: "2026-01-02", subtotal: 200, iva: 32, total: 232,
          moneda: "MXN", tipo_cambio: null, expediente: "E2", referencia_bl: null,
          estado: "Emitida", cliente_id: "cl1", cliente_nombre: "A" },
        { numero: "F3", fecha_emision: "2026-01-03", subtotal: 50, iva: 8, total: 58,
          moneda: "USD", tipo_cambio: 17, expediente: "E3", referencia_bl: "BL",
          estado: "Emitida", cliente_id: null, cliente_nombre: "—" },
      ],
      error: null,
    });
    mock.setTableResult("clientes", {
      data: [{ id: "cl1", rfc: "ABC010101XYZ" }],
      error: null,
    });

    const res = await fetchLayoutContableData(["f1", "f2", "f3"]);
    expect(res.facturas).toHaveLength(3);
    expect(res.rfcByClienteId.get("cl1")).toBe("ABC010101XYZ");
  });

  it("omite clientes con rfc nulo en el map", async () => {
    mock.setTableResult("facturas", {
      data: [{ numero: "F", fecha_emision: "x", subtotal: 0, iva: 0, total: 0,
        moneda: "MXN", tipo_cambio: null, expediente: "", referencia_bl: null,
        estado: "Emitida", cliente_id: "cl1", cliente_nombre: "" }],
      error: null,
    });
    mock.setTableResult("clientes", {
      data: [{ id: "cl1", rfc: null }],
      error: null,
    });
    const res = await fetchLayoutContableData(["f1"]);
    expect(res.rfcByClienteId.size).toBe(0);
  });

  it("no consulta clientes si todas las facturas tienen cliente_id null", async () => {
    mock.setTableResult("facturas", {
      data: [{ numero: "F", fecha_emision: "x", subtotal: 0, iva: 0, total: 0,
        moneda: "USD", tipo_cambio: 17, expediente: "", referencia_bl: null,
        estado: "Emitida", cliente_id: null, cliente_nombre: "" }],
      error: null,
    });
    const res = await fetchLayoutContableData(["f1"]);
    expect(res.facturas).toHaveLength(1);
    expect(res.rfcByClienteId.size).toBe(0);
    expect(mock.tableCalls.some(c => c.table === "clientes")).toBe(false);
  });

  it("propaga errores de facturas", async () => {
    mock.setTableResult("facturas", { data: null, error: new Error("fact") });
    await expect(fetchLayoutContableData(["f1"])).rejects.toThrow("fact");
  });

  it("propaga errores de clientes", async () => {
    mock.setTableResult("facturas", {
      data: [{ numero: "F", fecha_emision: "x", subtotal: 0, iva: 0, total: 0,
        moneda: "MXN", tipo_cambio: null, expediente: "", referencia_bl: null,
        estado: "Emitida", cliente_id: "cl1", cliente_nombre: "" }],
      error: null,
    });
    mock.setTableResult("clientes", { data: null, error: new Error("cli") });
    await expect(fetchLayoutContableData(["f1"])).rejects.toThrow("cli");
  });
});

describe("fetchEstadoCuentaFacturas", () => {
  it("filtra por cliente_id + estados Emitida/Vencida y ordena asc por fecha_emision", async () => {
    mock.setTableResult("facturas", {
      data: [
        { numero: "F1", fecha_emision: "2026-01-01", fecha_vencimiento: "2026-02-01",
          total: 100, moneda: "MXN", estado: "Emitida", expediente: "E1" },
      ],
      error: null,
    });
    const res = await fetchEstadoCuentaFacturas("cl1");
    expect(res).toHaveLength(1);
    const call = mock.tableCalls.find(c => c.table === "facturas");
    expect(call?.ops).toContain("eq");
    expect(call?.ops).toContain("in");
    expect(call?.ops).toContain("order");
  });

  it("retorna [] cuando no hay data", async () => {
    mock.setTableResult("facturas", { data: null, error: null });
    expect(await fetchEstadoCuentaFacturas("cl1")).toEqual([]);
  });

  it("propaga error", async () => {
    mock.setTableResult("facturas", { data: null, error: new Error("db") });
    await expect(fetchEstadoCuentaFacturas("cl1")).rejects.toThrow("db");
  });
});
