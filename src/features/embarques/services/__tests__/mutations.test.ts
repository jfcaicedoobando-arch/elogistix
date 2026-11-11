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
  insertarNotaEmbarque,
  reabrirEmbarqueRpc,
  EmbarqueBloqueadoError,
} from "@/features/embarques/services/mutations";


import { setAuthSnapshot } from "@/lib/auth/authSnapshot";
import { captureAuthOperationScope, syncActiveOrganizationScope } from "@/lib/auth/authOperationScope";

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
  it("envía embarque y contenedores en una sola RPC", async () => {
    mock.setRpcResult("actualizar_embarque_con_contenedores", { data: null, error: null });
    const contenedores = [{ numero_contenedor: "COSU1234560", tipo_contenedor: "40HC" }];
    await actualizarEmbarqueRpc({
      id: UUID,
      embarque: { eta: "2026-06-15" },
      conceptosVenta: [],
      conceptosCosto: [],
      contenedores: contenedores as never,
      requestId: "req-upd",
    });
    const call = mock.rpcCalls.find((c) => c.fn === "actualizar_embarque_con_contenedores");
    const args = call?.args as { p_embarque_id: string; p_request_id: string; p_contenedores: unknown };
    expect(args.p_embarque_id).toBe(UUID);
    expect(args.p_request_id).toBe("req-upd");
    expect(args.p_contenedores).toEqual(contenedores);
    expect(mock.rpcCalls).toHaveLength(1);
  });

  it("propaga el error de Supabase", async () => {
    mock.setRpcResult("actualizar_embarque_con_contenedores", { data: null, error: new Error("conflict") });
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

  it.each(["success", "blocked"])("descarta continuación tardía %s después de cambiar empresa", async (outcome) => {
    const actor = (organizationId: string) => {
      setAuthSnapshot({ userId: "actor-h14", organizationId, role: "admin_org", effectiveRole: "admin_org", email: null, organizationName: null });
      syncActiveOrganizationScope({ userId: "actor-h14", organizationId });
    };
    actor("org-a");
    let finish!: (value: { data: null; error: unknown }) => void;
    const response = new Promise<{ data: null; error: unknown }>((resolve) => { finish = resolve; });
    mock.supabase.rpc.mockImplementationOnce(() => response);
    const request = eliminarEmbarqueRpc(UUID);
    actor("org-b");
    finish({ data: null, error: outcome === "blocked" ? { message: "LC_EMBARQUE_BLOQUEADO", hint: JSON.stringify({ expediente: "NO-MOSTRAR-A", cerrado: true }) } : null });
    await expect(request).rejects.toThrow("Revisa el estado del embarque al volver al contexto original");
    expect(registrarActividadMock).not.toHaveBeenCalled();
  });


  it("no construye la RPC cuando cambió el scope fijo antes de entrar al service", async () => {
    const actor = (organizationId: string) => {
      setAuthSnapshot({ userId: "actor-sa", organizationId: null, role: "super_admin", effectiveRole: "super_admin", email: null, organizationName: null });
      syncActiveOrganizationScope({ userId: "actor-sa", organizationId });
    };
    actor("org-a");
    const scopeFijo = captureAuthOperationScope();
    actor("org-b");
    mock.setRpcResult("eliminar_embarque_completo", { data: null, error: null });
    const outcome = await eliminarEmbarqueRpc(UUID, scopeFijo).then(() => ({ ok: true }), (error: Error) => ({ error }));
    expect(mock.rpcCalls).toEqual([]);
    expect(outcome).toMatchObject({ error: expect.objectContaining({ message: expect.stringContaining("contexto original") }) });
    expect(registrarActividadMock).not.toHaveBeenCalled();
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
