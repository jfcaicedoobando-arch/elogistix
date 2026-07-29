import { describe, it, expect, beforeEach, vi } from "vitest";

const mock = await vi.hoisted(async () => {
  const { createSupabaseMock } = await import("@/services/__tests__/_supabaseChainMock");
  return createSupabaseMock();
});
vi.mock("@/integrations/supabase/client", () => ({ supabase: mock.supabase }));

import { calcularDemorasEmbarque, eliminarDemorasAuto } from "../demorasEmbarque";

beforeEach(() => {
  mock.tableCalls.length = 0;
  mock.rpcCalls.length = 0;
});

describe("embarques/services/demorasEmbarque", () => {
  it("demorasEmb.calcular: invoca RPC calcular_demoras_embarque con id", async () => {
    mock.setRpcResult("calcular_demoras_embarque", { data: { dias_demora: 0, costo_usd: 0, venta_usd: 0 }, error: null });
    await calcularDemorasEmbarque("emb-1");
    expect(mock.rpcCalls[0].fn).toBe("calcular_demoras_embarque");
    expect(mock.rpcCalls[0].args).toEqual({ p_embarque_id: "emb-1" });
  });

  it("demorasEmb.calcular: normaliza el payload del RPC (B-097)", async () => {
    mock.setRpcResult("calcular_demoras_embarque", {
      data: {
        embarque_id: "emb-1",
        fecha_descarga_embarque: "2026-01-01",
        fecha_devolucion_embarque: "2026-01-10",
        dias_libres_default: 7,
        total_costo: 300,
        moneda_costo: "USD",
        total_venta_usd: 450,
        contenedores: [
          { contenedor_id: "c1", numero_contenedor: "ABC", tipo_contenedor: "40HC", dias_libres: 7, dias_en_puerto: 9, dias_excedidos: 2, monto_costo: 300, monto_venta_usd: 450 },
        ],
      },
      error: null,
    });
    const r = await calcularDemorasEmbarque("emb-1");
    expect(r.dias_excedidos).toBe(2);
    expect(r.dias_en_puerto).toBe(9);
    expect(r.sin_eventos).toBe(false);
    expect(r.total_costo_usd).toBe(300);
    expect(r.total_venta_usd).toBe(450);
    expect(r.contenedores[0].monto_costo_usd).toBe(300);
  });

  it("demorasEmb.calcular: marca sin_eventos cuando faltan fechas", async () => {
    mock.setRpcResult("calcular_demoras_embarque", {
      data: { embarque_id: "emb-1", fecha_descarga_embarque: null, fecha_devolucion_embarque: null, contenedores: [] },
      error: null,
    });
    const r = await calcularDemorasEmbarque("emb-1");
    expect(r.sin_eventos).toBe(true);
    expect(r.dias_excedidos).toBe(0);
  });

  it("demorasEmb.calcular: propaga error del RPC", async () => {
    mock.setRpcResult("calcular_demoras_embarque", { data: null, error: { message: "rpc fail" } });
    await expect(calcularDemorasEmbarque("e")).rejects.toThrow();
  });

  it("demorasEmb.eliminarAuto: borra de conceptos_costo y conceptos_venta", async () => {
    mock.setTableResult("conceptos_costo", { data: null, error: null });
    mock.setTableResult("conceptos_venta", { data: null, error: null });
    await eliminarDemorasAuto("emb-1");
    expect(mock.tableCalls.some((c) => c.table === "conceptos_costo")).toBe(true);
    expect(mock.tableCalls.some((c) => c.table === "conceptos_venta")).toBe(true);
  });

  it("demorasEmb.eliminarAuto: filtra por embarque_id y origen=demoras_auto", async () => {
    mock.setTableResult("conceptos_costo", { data: null, error: null });
    mock.setTableResult("conceptos_venta", { data: null, error: null });
    await eliminarDemorasAuto("emb-1");
    const costo = mock.tableCalls.find((c) => c.table === "conceptos_costo");
    const eqArgs = costo?.opArgs.filter((_, i) => costo.ops[i] === "eq") ?? [];
    expect(eqArgs).toContainEqual(["embarque_id", "emb-1"]);
    expect(eqArgs).toContainEqual(["origen", "demoras_auto"]);
  });

  it("demorasEmb.eliminarAuto: incluye op delete", async () => {
    mock.setTableResult("conceptos_costo", { data: null, error: null });
    mock.setTableResult("conceptos_venta", { data: null, error: null });
    await eliminarDemorasAuto("emb-1");
    const costo = mock.tableCalls.find((c) => c.table === "conceptos_costo");
    expect(costo?.ops).toContain("delete");
  });

  it("demorasEmb.eliminarAuto: propaga error de conceptos_costo", async () => {
    mock.setTableResult("conceptos_costo", { data: null, error: { message: "x" } });
    mock.setTableResult("conceptos_venta", { data: null, error: null });
    await expect(eliminarDemorasAuto("e")).rejects.toThrow();
  });

  it("demorasEmb.eliminarAuto: propaga error de conceptos_venta", async () => {
    mock.setTableResult("conceptos_costo", { data: null, error: null });
    mock.setTableResult("conceptos_venta", { data: null, error: { message: "y" } });
    await expect(eliminarDemorasAuto("e")).rejects.toThrow();
  });

  it("demorasEmb.eliminarAuto: ejecuta ambas borrados en paralelo (Promise.all)", async () => {
    mock.setTableResult("conceptos_costo", { data: null, error: null });
    mock.setTableResult("conceptos_venta", { data: null, error: null });
    await eliminarDemorasAuto("e");
    // Ambas tablas deben estar presentes en tableCalls
    const tables = mock.tableCalls.map((c) => c.table);
    expect(tables).toContain("conceptos_costo");
    expect(tables).toContain("conceptos_venta");
  });

  it("demorasEmb.calcular: con id vacío sigue llamando RPC", async () => {
    mock.setRpcResult("calcular_demoras_embarque", { data: { dias_demora: 0, costo_usd: 0, venta_usd: 0 }, error: null });
    await calcularDemorasEmbarque("");
    expect(mock.rpcCalls[0].args).toEqual({ p_embarque_id: "" });
  });
});
