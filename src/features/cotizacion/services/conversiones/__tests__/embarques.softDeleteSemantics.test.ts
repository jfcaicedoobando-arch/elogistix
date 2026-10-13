import { beforeEach, describe, expect, it, vi } from "vitest";

const mock = await vi.hoisted(async () => {
  const { createSimpleFilteredReadMock } = await import("@/services/__tests__/_simpleFilteredReadMock");
  return createSimpleFilteredReadMock();
});
const { revalidarTarifa, registrarActividad } = vi.hoisted(() => ({
  revalidarTarifa: vi.fn(),
  registrarActividad: vi.fn(),
}));
vi.mock("@/integrations/supabase/client", () => ({ supabase: mock.supabase }));
vi.mock("@/features/cotizacion/services/revalidacion", () => ({ revalidarTarifa }));
vi.mock("@/services/bitacora/registrar", () => ({ registrarActividad }));

import { RevalidacionRequeridaError } from "@/features/cotizacion/domain/revalidacionTarifa";
import { crearEmbarqueBorradorDesdeCotizacion } from "../embarques";

const cotizacion = (tipo_documento = "formal", deleted_at: string | null = null, id = "cot-test") => ({
  id, tipo_documento, deleted_at,
});

function expectSinEfectos() {
  expect(revalidarTarifa).not.toHaveBeenCalled();
  expect(mock.rpcCalls).toEqual([]);
  expect(registrarActividad).not.toHaveBeenCalled();
}

function expectLecturaVigente() {
  expect(mock.tableCalls).toEqual([{
    table: "cotizaciones",
    ops: ["select", "eq", "is"],
    opArgs: [["tipo_documento"], ["id", "cot-test"], ["deleted_at", null]],
  }]);
}

beforeEach(() => {
  mock.reset();
  revalidarTarifa.mockReset().mockResolvedValue({ severidad: "sin_cambios" });
  registrarActividad.mockReset().mockResolvedValue(undefined);
  mock.source("cotizaciones", cotizacion());
  mock.setRpcResult("crear_embarque_borrador_desde_cotizacion", { data: "emb-test", error: null });
});

describe("conversión operativa: sólo cotización vigente antes de cualquier efecto", () => {
  it("formal vigente conserva revalidación, RPC de un argumento y bitácora", async () => {
    expect(await crearEmbarqueBorradorDesdeCotizacion("cot-test")).toBe("emb-test");
    expectLecturaVigente();
    expect(revalidarTarifa).toHaveBeenCalledExactlyOnceWith("cot-test");
    expect(mock.rpcCalls).toEqual([{
      fn: "crear_embarque_borrador_desde_cotizacion", args: { p_cotizacion_id: "cot-test" },
    }]);
    expect(registrarActividad).toHaveBeenCalledExactlyOnceWith({
      modulo: "cotizaciones", accion: "convertir_a_embarque", entidadId: "cot-test",
      entidadNombre: "emb-test", detalles: { decision: "sin_cambios" },
    });
    expect(revalidarTarifa.mock.invocationCallOrder[0]).toBeLessThan(mock.supabase.rpc.mock.invocationCallOrder[0]);
    expect(mock.supabase.rpc.mock.invocationCallOrder[0]).toBeLessThan(registrarActividad.mock.invocationCallOrder[0]);
  });

  it.each(["formal", "informativa"])("cotización %s eliminada queda ausente al aplicar el filtro", async tipo => {
    mock.source("cotizaciones", cotizacion(tipo, "2026-10-01T00:00:00Z"));
    await expect(crearEmbarqueBorradorDesdeCotizacion("cot-test")).rejects.toThrow("La cotización no existe o fue eliminada.");
    expectLecturaVigente();
    expectSinEfectos();
  });

  it.each([
    { caso: "ausente", row: null },
    { caso: "identidad distinta", row: cotizacion("formal", null, "cot-otra") },
  ])("$caso aborta antes de revalidar, crear o registrar", async ({ row }) => {
    mock.source("cotizaciones", row);
    await expect(crearEmbarqueBorradorDesdeCotizacion("cot-test")).rejects.toThrow("La cotización no existe o fue eliminada.");
    expectLecturaVigente();
    expectSinEfectos();
  });

  it("informativa vigente conserva el rechazo propio sin efectos", async () => {
    mock.source("cotizaciones", cotizacion("informativa"));
    await expect(crearEmbarqueBorradorDesdeCotizacion("cot-test")).rejects.toThrow(/informativas \(tarifarios\)/);
    expectLecturaVigente();
    expectSinEfectos();
  });

  it.each([null, cotizacion()])("propaga el error original aunque la lectura traiga datos: %j", async row => {
    const error = { message: "fallo-lectura-cotizacion", code: "P0001" };
    mock.source("cotizaciones", row, error);
    await expect(crearEmbarqueBorradorDesdeCotizacion("cot-test")).rejects.toBe(error);
    expectLecturaVigente();
    expectSinEfectos();
  });

  it("una revalidación pendiente sigue bloqueando RPC y bitácora", async () => {
    revalidarTarifa.mockResolvedValue({ severidad: "requiere_revision" });
    await expect(crearEmbarqueBorradorDesdeCotizacion("cot-test")).rejects.toBeInstanceOf(RevalidacionRequeridaError);
    expect(revalidarTarifa).toHaveBeenCalledExactlyOnceWith("cot-test");
    expect(mock.rpcCalls).toEqual([]);
    expect(registrarActividad).not.toHaveBeenCalled();
  });

  it("un error de revalidación se propaga sin RPC ni bitácora", async () => {
    const error = new Error("fallo-revalidacion");
    revalidarTarifa.mockRejectedValue(error);
    await expect(crearEmbarqueBorradorDesdeCotizacion("cot-test")).rejects.toBe(error);
    expect(mock.rpcCalls).toEqual([]);
    expect(registrarActividad).not.toHaveBeenCalled();
  });

  it("conserva el mapeo del rechazo servidor por eliminación posterior a la lectura", async () => {
    mock.setRpcResult("crear_embarque_borrador_desde_cotizacion", {
      data: null, error: { message: "LC_COTIZACION_ELIMINADA" },
    });
    await expect(crearEmbarqueBorradorDesdeCotizacion("cot-test")).rejects.toThrow(/eliminada/);
    expect(mock.rpcCalls).toHaveLength(1);
    expect(registrarActividad).not.toHaveBeenCalled();
  });

  it("conserva el rechazo de respuesta RPC vacía sin registrar éxito", async () => {
    mock.setRpcResult("crear_embarque_borrador_desde_cotizacion", { data: null, error: null });
    await expect(crearEmbarqueBorradorDesdeCotizacion("cot-test")).rejects.toThrow("La función no devolvió un embarque");
    expect(registrarActividad).not.toHaveBeenCalled();
  });
});
