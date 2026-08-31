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

// La bitácora se mockea a nivel módulo: el mock de supabase no tiene `auth`
// y `registrarActividad` haría early-return sin sesión, imposible de observar.
const registrarActividadMock = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
vi.mock("@/services/bitacora/registrar", () => ({
  registrarActividad: (...args: unknown[]) => registrarActividadMock(...args),
}));

import {
  crearEmbarqueRpc,
  actualizarEmbarqueRpc,
  avanzarEstadoEmbarqueRpc,
  duplicarEmbarqueRpc,
  eliminarEmbarqueRpc,
  actualizarEstadoEmbarque,
  actualizarFechaLlegadaRealEmbarque,
  insertarNotaEmbarque,
  reabrirEmbarqueRpc,
  EmbarqueBloqueadoError,
} from "@/features/embarques/services/mutations";


const UUID = "11111111-1111-4111-8111-111111111111";
const UUID2 = "22222222-2222-4222-8222-222222222222";

// Reset cross-test state del mock hoisted (auditoría 13.137.28 - CRÍTICA).
// Sin esto, rpcCalls/tableCalls acumulan entre tests del mismo archivo y
// pueden producir falsos positivos al hacer .find() por nombre de RPC.
beforeEach(() => {
  mock.rpcCalls.length = 0;
  mock.tableCalls.length = 0;
  registrarActividadMock.mockClear();
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

  it("escribe bitácora cuando la transición se ejecutó (sin replay)", async () => {
    mock.setRpcResult("avanzar_estado_embarque", { data: { id: UUID, estado: "Cerrado" }, error: null });
    const resultado = await avanzarEstadoEmbarqueRpc({
      embarqueId: UUID,
      nuevoEstado: "Cerrado",
      usuarioEmail: "u@d.com",
      tipoEvento: "estado",
      descripcionEvento: "Cambio",
    });
    expect(resultado).toEqual({ replay: false, pendiente: false });
    expect(registrarActividadMock).toHaveBeenCalledTimes(1);
    expect(registrarActividadMock).toHaveBeenCalledWith(
      expect.objectContaining({ accion: "Avanzó estado de embarque", modulo: "embarques" }),
    );
  });

  it("FIX-R3: NO escribe bitácora cuando la RPC responde replay=true", async () => {
    mock.setRpcResult("avanzar_estado_embarque", { data: { id: UUID, estado: "Cerrado", replay: true }, error: null });
    const resultado = await avanzarEstadoEmbarqueRpc({
      embarqueId: UUID,
      nuevoEstado: "Cerrado",
      usuarioEmail: "u@d.com",
      tipoEvento: "estado",
      descripcionEvento: "Cambio",
    });
    expect(resultado.replay).toBe(true);
    expect(registrarActividadMock).not.toHaveBeenCalled();
  });

  it("FIX-R3: NO escribe bitácora cuando el claim está en vuelo (__idempotency_pending)", async () => {
    mock.setRpcResult("avanzar_estado_embarque", { data: { __idempotency_pending: true }, error: null });
    const resultado = await avanzarEstadoEmbarqueRpc({
      embarqueId: UUID,
      nuevoEstado: "Cerrado",
      usuarioEmail: "u@d.com",
      tipoEvento: "estado",
      descripcionEvento: "Cambio",
    });
    expect(resultado.pendiente).toBe(true);
    expect(registrarActividadMock).not.toHaveBeenCalled();
  });
});

describe("reabrirEmbarqueRpc", () => {
  it("invoca la RPC reabrir_embarque con los argumentos esperados", async () => {
    mock.setRpcResult("reabrir_embarque", { data: { id: UUID, estado: "Entregado" }, error: null });
    await reabrirEmbarqueRpc({ embarqueId: UUID, usuarioEmail: "admin@d.com", motivo: "Motivo de prueba suficientemente largo", requestId: "req-1" });
    const call = mock.rpcCalls.find((c) => c.fn === "reabrir_embarque");
    expect(call).toBeTruthy();
    const args = call?.args as { p_embarque_id: string; p_usuario_email: string };
    expect(args.p_embarque_id).toBe(UUID);
    // B-06: el email del navegador ya NO se envía (era falsificable); la BD usa auth.
    expect(args.p_usuario_email).toBe("");
  });

  it("propaga el error de Supabase (no admin, estado inválido, etc.)", async () => {
    mock.setRpcResult("reabrir_embarque", { data: null, error: new Error("Solo administradores") });
    await expect(
      reabrirEmbarqueRpc({ embarqueId: UUID, usuarioEmail: "u@d.com", motivo: "Motivo de prueba suficientemente largo" }),
    ).rejects.toThrow("Solo administradores");
  });

  it("traduce el error del candado de embarque cerrado a un mensaje claro", async () => {
    mock.setRpcResult("reabrir_embarque", {
      data: null,
      error: new Error("Embarque cerrado: usa reabrir_embarque para modificarlo"),
    });
    await expect(
      reabrirEmbarqueRpc({ embarqueId: UUID, usuarioEmail: "u@d.com", motivo: "Motivo de prueba suficientemente largo" }),
    ).rejects.toThrow(/candado de embarque cerrado/i);
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

  it("propaga el error genérico de Supabase", async () => {
    mock.setRpcResult("eliminar_embarque_completo", { data: null, error: new Error("fk") });
    await expect(eliminarEmbarqueRpc(UUID)).rejects.toThrow("fk");
  });

  it("convierte el marcador LC_EMBARQUE_BLOQUEADO en EmbarqueBloqueadoError con motivos (Fase E)", async () => {
    const motivos = {
      facturas: 2,
      cxp: 1,
      pagos_cxc: 0,
      pagos_cxp: 0,
      notas_credito_cxc: 0,
      notas_credito_cxp: 0,
      comisiones_definitivas: 0,
      proformas: 0,

      cerrado: false,
      expediente: "ELIMP00099",
    };
    mock.setRpcResult("eliminar_embarque_completo", {
      data: null,
      error: {
        message: "LC_EMBARQUE_BLOQUEADO: el embarque ELIMP00099 tiene dependencias",
        hint: JSON.stringify(motivos),
      },
    });
    await expect(eliminarEmbarqueRpc(UUID)).rejects.toBeInstanceOf(EmbarqueBloqueadoError);
    try {
      await eliminarEmbarqueRpc(UUID);
    } catch (err) {
      expect(err).toBeInstanceOf(EmbarqueBloqueadoError);
      expect((err as InstanceType<typeof EmbarqueBloqueadoError>).motivos).toEqual(motivos);
    }
  });
});

describe("actualizarEstadoEmbarque", () => {
  it("escribe el estado correcto en la columna y filtra por id (sprint 1.2)", async () => {
    mock.setTableResult("embarques", { data: { id: UUID }, error: null });
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

describe("actualizarFechaLlegadaRealEmbarque", () => {
  it("avanza a 'Arribo' cuando el estado actual es 'En Tránsito' (v13.303.22)", async () => {
    mock.setTableResult("embarques", { data: { estado: "En Tránsito" }, error: null });
    await actualizarFechaLlegadaRealEmbarque(UUID, "2026-07-20");
    const { assertUpdatePayload, assertEq, findTableCall } = await import(
      "@/test/helpers/assertMutation"
    );
    // El último tableCall es el UPDATE (después del SELECT del estado actual).
    const updateCall = [...mock.tableCalls].reverse().find((c) => c.ops.includes("update"));
    assertUpdatePayload(updateCall!, { estado: "Arribo", fecha_llegada_real: "2026-07-20" });
    assertEq(updateCall!, "id", UUID);
    void findTableCall;
  });

  // v13.303.22 — antes se forzaba `estado: 'Llegada'` (ya deprecado). Estados
  // posteriores (En Aduana/Entregado/EIR/Cerrado) o comerciales previos no
  // deben tocarse para evitar LC_TRANSICION_INVALIDA.
  it("NO cambia estado cuando el actual es 'En Aduana' (regresión Sentry c80465e4)", async () => {
    mock.setTableResult("embarques", { data: { estado: "En Aduana" }, error: null });
    await actualizarFechaLlegadaRealEmbarque(UUID, "2026-07-20");
    const updateCall = [...mock.tableCalls].reverse().find((c) => c.ops.includes("update"));
    const updateArgIdx = updateCall!.ops.indexOf("update");
    const payload = updateCall!.opArgs[updateArgIdx][0] as Record<string, unknown>;
    expect(payload).toEqual({ fecha_llegada_real: "2026-07-20" });
    expect(payload).not.toHaveProperty("estado");
  });

  // v13.814.0 (hallazgo 1): UPDATE de 0 filas (RLS / id inexistente) no debe
  // reportar éxito ni escribir bitácora.
  it("lanza y NO escribe bitácora cuando el UPDATE afecta 0 filas", async () => {
    mock.setTableResult("embarques", { data: null, error: null });
    await expect(actualizarEstadoEmbarque(UUID, "Confirmado")).rejects.toThrow(
      /no tienes permiso o el embarque ya no existe/i,
    );
    expect(registrarActividadMock).not.toHaveBeenCalled();
  });

  // v13.814.0 (hallazgo 2): el pre-select que falla o no encuentra la fila
  // debe abortar antes de cualquier UPDATE.
  it("aborta sin UPDATE si el pre-select de llegada real falla", async () => {
    mock.setTableResult("embarques", { data: null, error: { message: "permission denied" } });
    await expect(actualizarFechaLlegadaRealEmbarque(UUID, "2026-07-20")).rejects.toThrow();
    expect(mock.tableCalls.some((c) => c.ops.includes("update"))).toBe(false);
    expect(registrarActividadMock).not.toHaveBeenCalled();
  });

  it("aborta sin UPDATE si el embarque no existe en el pre-select", async () => {
    mock.setTableResult("embarques", { data: null, error: null });
    await expect(actualizarFechaLlegadaRealEmbarque(UUID, "2026-07-20")).rejects.toThrow(
      /no se encontró el embarque/i,
    );
    expect(mock.tableCalls.some((c) => c.ops.includes("update"))).toBe(false);
    expect(registrarActividadMock).not.toHaveBeenCalled();
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
