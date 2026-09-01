/**
 * Tests CRUD de embarque_contenedores.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mock = await vi.hoisted(async () => {
  const { createSupabaseMock } = await import("@/services/__tests__/_supabaseChainMock");
  return createSupabaseMock();
});
vi.mock("@/integrations/supabase/client", () => ({ supabase: mock.supabase }));

import {
  listarPorEmbarque,
  crearMuchos,
  sincronizarContenedores,
} from "@/features/embarques/services/contenedores/crud";

const EMB = "11111111-1111-4111-8111-111111111111";

beforeEach(() => {
  // Bajo singleFork los registros del mock se acumulan entre tests y producen
  // falsos positivos en find(...). Vaciamos antes de cada test.
  mock.tableCalls.length = 0;
  mock.rpcCalls.length = 0;
});

describe("listarPorEmbarque", () => {
  it("devuelve la lista de la tabla embarque_contenedores", async () => {
    const rows = [{ id: "c1", embarque_id: EMB, numero_contenedor: "MSCU1", orden: 1 }];
    mock.setTableResult("embarque_contenedores", { data: rows, error: null });
    const result = await listarPorEmbarque(EMB);
    expect(result).toEqual(rows);
    const call = mock.tableCalls[mock.tableCalls.length - 1];
    expect(call?.table).toBe("embarque_contenedores");
    expect(call?.ops).toEqual(expect.arrayContaining(["select", "eq", "order"]));
  });

  it("propaga el error", async () => {
    mock.setTableResult("embarque_contenedores", { data: null, error: new Error("rls") });
    await expect(listarPorEmbarque(EMB)).rejects.toThrow("rls");
  });
});

describe("crearMuchos", () => {
  it("retorna lista vacía sin tocar Supabase si no hay borradores", async () => {
    const before = mock.tableCalls.length;
    const result = await crearMuchos(EMB, []);
    expect(result).toEqual([]);
    expect(mock.tableCalls.length).toBe(before);
  });

  it("invoca insert+select con orden autoincrementado", async () => {
    mock.setTableResult("embarque_contenedores", { data: [{ id: "c1" }, { id: "c2" }], error: null });
    const result = await crearMuchos(EMB, [
      { numero_contenedor: "A1", tipo_contenedor: "40HC", peso_kg: 1, volumen_m3: 1, piezas: 1 },
      { numero_contenedor: "A2", tipo_contenedor: "40HC", peso_kg: 1, volumen_m3: 1, piezas: 1 },
    ] as never);
    expect(result).toHaveLength(2);
    const call = [...mock.tableCalls].reverse().find((c) => c.table === "embarque_contenedores");
    expect(call?.ops).toEqual(expect.arrayContaining(["insert", "select"]));
  });
});

describe("sincronizarContenedores", () => {
  it("invoca la RPC sincronizar_contenedores_embarque con el payload", async () => {
    mock.setRpcResult("sincronizar_contenedores_embarque", {
      data: [{ id: "c1", embarque_id: EMB }],
      error: null,
    });
    const result = await sincronizarContenedores(EMB, [
      { id: "c1", numero_contenedor: "A1", tipo_contenedor: "40HC", peso_kg: 1, volumen_m3: 1, piezas: 1 },
    ] as never);
    expect(result).toHaveLength(1);
    const call = mock.rpcCalls.find((c) => c.fn === "sincronizar_contenedores_embarque");
    const args = call?.args as { p_embarque_id: string; p_contenedores: unknown[] };
    expect(args.p_embarque_id).toBe(EMB);
    expect(args.p_contenedores).toHaveLength(1);
  });

  it("propaga el error de la RPC al sincronizar contenedores", async () => {
    mock.setRpcResult("sincronizar_contenedores_embarque", { data: null, error: new Error("conflict") });
    await expect(sincronizarContenedores(EMB, [])).rejects.toThrow("conflict");
  });
});
