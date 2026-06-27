/**
 * Tests del boundary de mutaciones de embarques.
 * Cubre validación zod, propagación de errores Supabase y shape de RPC.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mock = await vi.hoisted(async () => {
  const { createSupabaseMock } = await import("@/services/__tests__/_supabaseChainMock");
  return createSupabaseMock();
});
vi.mock("@/integrations/supabase/client", () => ({ supabase: mock.supabase }));

import {
  crearEmbarqueRpc,
  actualizarEmbarqueRpc,
  avanzarEstadoEmbarqueRpc,
  duplicarEmbarqueRpc,
  eliminarEmbarqueRpc,
  actualizarEstadoEmbarque,
  insertarNotaEmbarque,
  reabrirEmbarqueRpc,
} from "@/features/embarques/services/mutations";

const UUID = "11111111-1111-4111-8111-111111111111";
const UUID2 = "22222222-2222-4222-8222-222222222222";

// Reset cross-test state del mock hoisted (auditoría 13.137.28 - CRÍTICA).
// Sin esto, rpcCalls/tableCalls acumulan entre tests del mismo archivo y
// pueden producir falsos positivos al hacer .find() por nombre de RPC.
beforeEach(() => {
  mock.rpcCalls.length = 0;
  mock.tableCalls.length = 0;
});


const embarqueValido = {
  cliente_nombre: "Acme SA",
  modo: "Marítimo",
  operador: "operador@demo.com",
  tipo: "Importación",
};

describe("crearEmbarqueRpc", () => {
  it("invoca la RPC y devuelve el id validado", async () => {
    mock.setRpcResult("crear_embarque_completo", { data: { id: UUID }, error: null });
    const result = await crearEmbarqueRpc({
      embarque: embarqueValido as never,
      conceptosVenta: [],
      conceptosCosto: [],
      documentos: [],
      requestId: "req-1",
    });
    expect(result).toEqual({ id: UUID });
    const call = mock.rpcCalls.find((c) => c.fn === "crear_embarque_completo");
    expect(call).toBeDefined();
    expect((call?.args as { p_request_id: string }).p_request_id).toBe("req-1");
  });

  it("lanza con mensaje en español si el embarque no pasa validación", async () => {
    await expect(
      crearEmbarqueRpc({
        embarque: { modo: "Marítimo", operador: "x" } as never,
        conceptosVenta: [],
        conceptosCosto: [],
        documentos: [],
      }),
    ).rejects.toThrow(/Embarque.*Cliente/i);
  });

  it("propaga el error de Supabase", async () => {
    mock.setRpcResult("crear_embarque_completo", { data: null, error: new Error("rls denied") });
    await expect(
      crearEmbarqueRpc({
        embarque: embarqueValido as never,
        conceptosVenta: [],
        conceptosCosto: [],
        documentos: [],
      }),
    ).rejects.toThrow("rls denied");
  });

  it("lanza ZodError si la RPC devuelve un id inválido", async () => {
    mock.setRpcResult("crear_embarque_completo", { data: { id: "no-uuid" }, error: null });
    await expect(
      crearEmbarqueRpc({
        embarque: embarqueValido as never,
        conceptosVenta: [],
        conceptosCosto: [],
        documentos: [],
      }),
    ).rejects.toThrow();
  });
});

describe("actualizarEmbarqueRpc", () => {
  it("envía p_embarque_id y p_request_id a la RPC", async () => {
    mock.setRpcResult("actualizar_embarque_completo", { data: null, error: null });
    await actualizarEmbarqueRpc({
      id: UUID,
      embarque: { eta: "2026-06-15" },
      conceptosVenta: [],
      conceptosCosto: [],
      requestId: "req-upd",
    });
    const call = mock.rpcCalls.find((c) => c.fn === "actualizar_embarque_completo");
    const args = call?.args as { p_embarque_id: string; p_request_id: string };
    expect(args.p_embarque_id).toBe(UUID);
    expect(args.p_request_id).toBe("req-upd");
  });

  it("propaga el error de Supabase", async () => {
    mock.setRpcResult("actualizar_embarque_completo", { data: null, error: new Error("conflict") });
    await expect(
      actualizarEmbarqueRpc({
        id: UUID,
        embarque: {},
        conceptosVenta: [],
        conceptosCosto: [],
      }),
    ).rejects.toThrow("conflict");
  });
});

describe("avanzarEstadoEmbarqueRpc", () => {
  it("invoca la RPC con tipoEvento y descripcionEvento", async () => {
    mock.setRpcResult("avanzar_estado_embarque", { data: null, error: null });
    await avanzarEstadoEmbarqueRpc({
      embarqueId: UUID,
      nuevoEstado: "En tránsito",
      usuarioEmail: "u@d.com",
      tipoEvento: "estado",
      descripcionEvento: "Cambio",
    });
    const call = mock.rpcCalls.find((c) => c.fn === "avanzar_estado_embarque");
    const args = call?.args as { p_nuevo_estado: string; p_tipo_evento: string };
    expect(args.p_nuevo_estado).toBe("En tránsito");
    expect(args.p_tipo_evento).toBe("estado");
  });
});

describe("reabrirEmbarqueRpc", () => {
  it("invoca la RPC reabrir_embarque con los argumentos esperados", async () => {
    mock.setRpcResult("reabrir_embarque", { data: { id: UUID, estado: "Entregado" }, error: null });
    await reabrirEmbarqueRpc({ embarqueId: UUID, usuarioEmail: "admin@d.com", requestId: "req-1" });
    const call = mock.rpcCalls.find((c) => c.fn === "reabrir_embarque");
    expect(call).toBeTruthy();
    const args = call?.args as { p_embarque_id: string; p_usuario_email: string };
    expect(args.p_embarque_id).toBe(UUID);
    expect(args.p_usuario_email).toBe("admin@d.com");
  });

  it("propaga el error de Supabase (no admin, estado inválido, etc.)", async () => {
    mock.setRpcResult("reabrir_embarque", { data: null, error: new Error("Solo administradores") });
    await expect(
      reabrirEmbarqueRpc({ embarqueId: UUID, usuarioEmail: "u@d.com" }),
    ).rejects.toThrow("Solo administradores");
  });
});

describe("duplicarEmbarqueRpc", () => {
  it("valida el array devuelto y propaga los expedientes", async () => {
    mock.setRpcResult("duplicar_embarque_completo", {
      data: [{ id: UUID, expediente: "EXP-001" }, { id: UUID2, expediente: "EXP-002" }],
      error: null,
    });
    const result = await duplicarEmbarqueRpc(UUID, [], "req-dup");
    expect(result).toHaveLength(2);
    expect(result[1]?.expediente).toBe("EXP-002");
  });

  it("rechaza payloads con id no UUID", async () => {
    mock.setRpcResult("duplicar_embarque_completo", {
      data: [{ id: "bad", expediente: "EXP-X" }],
      error: null,
    });
    await expect(duplicarEmbarqueRpc(UUID, [])).rejects.toThrow();
  });
});

describe("eliminarEmbarqueRpc", () => {
  it("invoca la RPC con p_embarque_id", async () => {
    mock.setRpcResult("eliminar_embarque_completo", { data: null, error: null });
    await eliminarEmbarqueRpc(UUID);
    const call = mock.rpcCalls.find((c) => c.fn === "eliminar_embarque_completo");
    expect((call?.args as { p_embarque_id: string }).p_embarque_id).toBe(UUID);
  });

  it("propaga el error de Supabase", async () => {
    mock.setRpcResult("eliminar_embarque_completo", { data: null, error: new Error("fk") });
    await expect(eliminarEmbarqueRpc(UUID)).rejects.toThrow("fk");
  });
});

describe("actualizarEstadoEmbarque", () => {
  it("escribe el estado correcto en la columna y filtra por id (sprint 1.2)", async () => {
    mock.setTableResult("embarques", { data: null, error: null });
    await actualizarEstadoEmbarque(UUID, "Confirmado");
    const { assertUpdatePayload, assertEq, findTableCall } = await import(
      "@/test/helpers/assertMutation"
    );
    const call = findTableCall(mock, "embarques");
    // Antes el test pasaba con `update({ estado: null })`. Ahora valida payload real.
    assertUpdatePayload(call, { estado: "Confirmado" });
    assertEq(call, "id", UUID);
  });
});

describe("insertarNotaEmbarque", () => {
  it("inserta una nota válida", async () => {
    mock.setTableResult("notas_embarque", { data: null, error: null });
    await insertarNotaEmbarque(UUID, "Mensaje de prueba", "u@d.com");
    const call = mock.tableCalls[mock.tableCalls.length - 1];
    expect(call?.table).toBe("notas_embarque");
    expect(call?.ops).toContain("insert");
  });

  it("rechaza una nota vacía con mensaje en español", async () => {
    await expect(insertarNotaEmbarque(UUID, "", "u@d.com")).rejects.toThrow(/Nota.*requerid/i);
  });
});
