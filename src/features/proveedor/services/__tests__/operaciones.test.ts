import { describe, it, expect, beforeEach, vi } from "vitest";

const mock = await vi.hoisted(async () => {
  const { createSupabaseMock } = await import("@/services/__tests__/_supabaseChainMock");
  return createSupabaseMock();
});
vi.mock("@/integrations/supabase/client", () => ({ supabase: mock.supabase }));

import { fetchProveedorOperaciones } from "../operaciones";

beforeEach(() => {
  mock.tableCalls.length = 0;
});

const baseRow = {
  concepto: "Flete",
  monto: "1500.55",
  moneda: "USD",
  estado_liquidacion: "Pendiente",
  fecha_vencimiento: "2026-06-30",
  embarques: { expediente: "EXP-1", id: "e1", cliente_nombre: "ACME" },
};

describe("proveedor/services/operaciones", () => {
  it("operaciones.fetch: devuelve [] si data es null", async () => {
    mock.setTableResult("conceptos_costo", { data: null, error: null });
    const r = await fetchProveedorOperaciones("p1");
    expect(r).toEqual([]);
  });

  it("operaciones.fetch: filtra por proveedor_id", async () => {
    mock.setTableResult("conceptos_costo", { data: [], error: null });
    await fetchProveedorOperaciones("p1");
    const call = mock.tableCalls.find((c) => c.table === "conceptos_costo");
    const idx = call?.ops.indexOf("eq") ?? -1;
    expect(call?.opArgs[idx]).toEqual(["proveedor_id", "p1"]);
  });

  it("operaciones.fetch: propaga error", async () => {
    mock.setTableResult("conceptos_costo", { data: null, error: { message: "rls" } });
    await expect(fetchProveedorOperaciones("p1")).rejects.toThrow();
  });

  it("operaciones.fetch: convierte monto a número", async () => {
    mock.setTableResult("conceptos_costo", { data: [baseRow], error: null });
    const r = await fetchProveedorOperaciones("p1");
    expect(r[0].monto).toBe(1500.55);
    expect(typeof r[0].monto).toBe("number");
  });

  it("operaciones.fetch: extrae expediente del join", async () => {
    mock.setTableResult("conceptos_costo", { data: [baseRow], error: null });
    const r = await fetchProveedorOperaciones("p1");
    expect(r[0].expediente).toBe("EXP-1");
    expect(r[0].embarqueId).toBe("e1");
    expect(r[0].clienteNombre).toBe("ACME");
  });

  it("operaciones.fetch: embarques null → strings vacías", async () => {
    mock.setTableResult("conceptos_costo", { data: [{ ...baseRow, embarques: null }], error: null });
    const r = await fetchProveedorOperaciones("p1");
    expect(r[0].expediente).toBe("");
    expect(r[0].embarqueId).toBe("");
    expect(r[0].clienteNombre).toBe("");
  });

  it("operaciones.fetch: mapea concepto y moneda", async () => {
    mock.setTableResult("conceptos_costo", { data: [baseRow], error: null });
    const r = await fetchProveedorOperaciones("p1");
    expect(r[0].concepto).toBe("Flete");
    expect(r[0].moneda).toBe("USD");
  });

  it("operaciones.fetch: mapea estadoLiquidacion (camelCase)", async () => {
    mock.setTableResult("conceptos_costo", { data: [baseRow], error: null });
    const r = await fetchProveedorOperaciones("p1");
    expect(r[0].estadoLiquidacion).toBe("Pendiente");
  });

  it("operaciones.fetch: mapea fechaVencimiento (camelCase)", async () => {
    mock.setTableResult("conceptos_costo", { data: [baseRow], error: null });
    const r = await fetchProveedorOperaciones("p1");
    expect(r[0].fechaVencimiento).toBe("2026-06-30");
  });

  it("operaciones.fetch: soporta N filas", async () => {
    const rows = [baseRow, { ...baseRow, concepto: "Almacenaje", monto: "200" }];
    mock.setTableResult("conceptos_costo", { data: rows, error: null });
    const r = await fetchProveedorOperaciones("p1");
    expect(r).toHaveLength(2);
    expect(r[1].concepto).toBe("Almacenaje");
    expect(r[1].monto).toBe(200);
  });
});
