import { describe, it, expect, beforeEach, vi } from "vitest";

const mock = await vi.hoisted(async () => {
  const { createSupabaseMock } = await import("@/services/__tests__/_supabaseChainMock");
  return createSupabaseMock();
});
vi.mock("@/integrations/supabase/client", () => ({ supabase: mock.supabase }));

import {
  listarPorEmbarque,
  crearMuchos,
  reemplazarTodos,
  sincronizarContenedores,
} from "../crud";

beforeEach(() => {
  mock.tableCalls.length = 0;
  mock.rpcCalls.length = 0;
});

describe("embarques/services/contenedores/crud", () => {
  it("contenedores.listar: devuelve [] cuando data null", async () => {
    mock.setTableResult("embarque_contenedores", { data: null, error: null });
    const r = await listarPorEmbarque("e1");
    expect(r).toEqual([]);
  });

  it("contenedores.listar: filtra por embarque_id", async () => {
    mock.setTableResult("embarque_contenedores", { data: [], error: null });
    await listarPorEmbarque("e1");
    const call = mock.tableCalls.find((c) => c.table === "embarque_contenedores");
    const idx = call?.ops.indexOf("eq") ?? -1;
    expect(call?.opArgs[idx]).toEqual(["embarque_id", "e1"]);
  });

  it("contenedores.listar: ordena por orden y created_at asc", async () => {
    mock.setTableResult("embarque_contenedores", { data: [], error: null });
    await listarPorEmbarque("e1");
    const call = mock.tableCalls.find((c) => c.table === "embarque_contenedores");
    const orderCount = call?.ops.filter((o) => o === "order").length ?? 0;
    expect(orderCount).toBe(2);
  });

  it("contenedores.listar: propaga error", async () => {
    mock.setTableResult("embarque_contenedores", { data: null, error: { message: "rls" } });
    await expect(listarPorEmbarque("e1")).rejects.toBeDefined();
  });

  it("contenedores.crearMuchos: noop con array vacío (no llama supabase)", async () => {
    const r = await crearMuchos("e1", []);
    expect(r).toEqual([]);
    expect(mock.tableCalls.length).toBe(0);
  });

  it("contenedores.crearMuchos: asigna orden por índice cuando borrador no lo trae", async () => {
    mock.setTableResult("embarque_contenedores", { data: [], error: null });
    await crearMuchos("e1", [
      { numero_contenedor: "A1", tipo_contenedor: "20DV", bl_house: "", peso_kg: 0, volumen_m3: 0, piezas: 0, orden: 0 },
      { numero_contenedor: "A2", tipo_contenedor: "20DV", bl_house: "", peso_kg: 0, volumen_m3: 0, piezas: 0, orden: 0 },
    ]);
    const payload = mock.getMutationPayload("embarque_contenedores", "insert") as Array<Record<string, unknown>>;
    expect(payload[0].orden).toBe(1);
    expect(payload[1].orden).toBe(2);
  });

  it("contenedores.crearMuchos: respeta orden explícito", async () => {
    mock.setTableResult("embarque_contenedores", { data: [], error: null });
    await crearMuchos("e1", [
      { numero_contenedor: "A1", tipo_contenedor: "20DV", bl_house: "", peso_kg: 0, volumen_m3: 0, piezas: 0, orden: 5 },
    ]);
    const payload = mock.getMutationPayload("embarque_contenedores", "insert") as Array<Record<string, unknown>>;
    expect(payload[0].orden).toBe(5);
  });

  it("contenedores.reemplazarTodos: marca borrados antes de insertar", async () => {
    mock.setTableResult("embarque_contenedores", { data: [], error: null });
    await reemplazarTodos("e1", []);
    const call = mock.tableCalls.find((c) => c.table === "embarque_contenedores");
    expect(call?.ops).toContain("update");
    expect(call?.ops).toContain("is");
  });

  it("contenedores.sincronizar: invoca RPC sincronizar_contenedores_embarque", async () => {
    mock.setRpcResult("sincronizar_contenedores_embarque", { data: [], error: null });
    await sincronizarContenedores("e1", []);
    expect(mock.rpcCalls[0].fn).toBe("sincronizar_contenedores_embarque");
    const args = mock.rpcCalls[0].args as Record<string, unknown>;
    expect(args.p_embarque_id).toBe("e1");
  });

  it("contenedores.sincronizar: propaga error del RPC", async () => {
    mock.setRpcResult("sincronizar_contenedores_embarque", { data: null, error: { message: "rls" } });
    await expect(sincronizarContenedores("e1", [])).rejects.toBeDefined();
  });

  it("contenedores.sincronizar: pasa lista con id=null cuando es nuevo", async () => {
    mock.setRpcResult("sincronizar_contenedores_embarque", { data: [], error: null });
    await sincronizarContenedores("e1", [
      { numero_contenedor: "A1", tipo_contenedor: "20DV", bl_house: null, peso_kg: 1000, volumen_m3: 33, piezas: 10, orden: 1 },
    ]);
    const args = mock.rpcCalls[0].args as { p_contenedores: Array<Record<string, unknown>> };
    expect(args.p_contenedores[0].id).toBeNull();
    expect(args.p_contenedores[0].peso_kg).toBe(1000);
  });
});
