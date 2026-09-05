import { describe, it, expect, beforeEach, vi } from "vitest";

const mock = await vi.hoisted(async () => {
  const { createSupabaseMock } = await import("@/services/__tests__/_supabaseChainMock");
  return createSupabaseMock();
});
vi.mock("@/integrations/supabase/client", () => ({ supabase: mock.supabase }));
vi.mock("@/services/bitacora/registrar", () => ({ registrarActividad: vi.fn() }));

import { registrarActividad } from "@/services/bitacora/registrar";

import {
  fetchPlantillasMensaje,
  crearPlantilla,
  actualizarPlantilla,
  eliminarPlantilla,
} from "@/features/crm/services/plantillas";

beforeEach(() => {
  mock.tableCalls.length = 0;
  mock.rpcCalls.length = 0;
  mock.resetResults();
});

describe("services/crm/plantillas", () => {
  it("fetchPlantillasMensaje devuelve filas", async () => {
    mock.setTableResult("crm_plantillas_mensaje", { data: [{ id: "p1" }], error: null });
    const r = await fetchPlantillasMensaje();
    expect(r).toHaveLength(1);
  });

  it("fetchPlantillasMensaje devuelve [] cuando data null", async () => {
    mock.setTableResult("crm_plantillas_mensaje", { data: null, error: null });
    const r = await fetchPlantillasMensaje();
    expect(r).toEqual([]);
  });

  it("fetchPlantillasMensaje aplica filtro por canal", async () => {
    mock.setTableResult("crm_plantillas_mensaje", { data: [], error: null });
    await fetchPlantillasMensaje("email");
    const call = mock.tableCalls[0];
    const idx = call.ops.indexOf("eq");
    expect(call.opArgs[idx]).toEqual(["canal", "email"]);
  });

  it("fetchPlantillasMensaje filtra solo activas por default", async () => {
    mock.setTableResult("crm_plantillas_mensaje", { data: [], error: null });
    await fetchPlantillasMensaje();
    const call = mock.tableCalls[0];
    const eqArgs = call.opArgs.filter((_, i) => call.ops[i] === "eq");
    expect(eqArgs).toContainEqual(["activa", true]);
  });

  it("fetchPlantillasMensaje sin filtro activa cuando soloActivas=false", async () => {
    mock.setTableResult("crm_plantillas_mensaje", { data: [], error: null });
    await fetchPlantillasMensaje(undefined, false);
    const call = mock.tableCalls[0];
    const eqArgs = call.opArgs.filter((_, i) => call.ops[i] === "eq");
    expect(eqArgs).not.toContainEqual(["activa", true]);
  });

  it("fetchPlantillasMensaje propaga error", async () => {
    mock.setTableResult("crm_plantillas_mensaje", { data: null, error: { message: "x" } });
    await expect(fetchPlantillasMensaje()).rejects.toThrow();
  });

  it("crearPlantilla inserta con defaults", async () => {
    mock.setTableResult("crm_plantillas_mensaje", { data: null, error: null });
    await crearPlantilla({ nombre: "X", canal: "whatsapp", cuerpo: "hola" });
    const p = mock.getMutationPayload("crm_plantillas_mensaje") as Record<string, unknown>;
    expect(p).toMatchObject({ nombre: "X", asunto: "", activa: true });
  });

  it("crearPlantilla preserva activa=false", async () => {
    mock.setTableResult("crm_plantillas_mensaje", { data: null, error: null });
    await crearPlantilla({ nombre: "X", canal: "email", cuerpo: "c", activa: false });
    const p = mock.getMutationPayload("crm_plantillas_mensaje") as Record<string, unknown>;
    expect(p.activa).toBe(false);
  });

  it("crearPlantilla propaga error", async () => {
    mock.setTableResult("crm_plantillas_mensaje", { data: null, error: { message: "x" } });
    await expect(crearPlantilla({ nombre: "X", canal: "email", cuerpo: "c" })).rejects.toThrow();
  });

  it("actualizarPlantilla actualiza cuando hay fila afectada", async () => {
    vi.mocked(registrarActividad).mockClear();
    mock.setTableResult("crm_plantillas_mensaje", { data: { id: "p1" }, error: null });
    await actualizarPlantilla({ id: "p1", patch: { nombre: "Y" } });
    const call = mock.tableCalls[0];
    const idx = call.ops.indexOf("update");
    expect(call.opArgs[idx][0]).toEqual({ nombre: "Y" });
    expect(registrarActividad).toHaveBeenCalledTimes(1);
  });

  it("actualizarPlantilla exige fila afectada y no registra bitácora si RLS/id inexistente", async () => {
    vi.mocked(registrarActividad).mockClear();
    mock.setTableResult("crm_plantillas_mensaje", { data: null, error: null });
    await expect(actualizarPlantilla({ id: "p1", patch: { nombre: "Y" } })).rejects.toThrow(
      /no tienes permiso|ya no existe/i,
    );
    expect(registrarActividad).not.toHaveBeenCalled();
  });

  it("actualizarPlantilla propaga error", async () => {
    mock.setTableResult("crm_plantillas_mensaje", { data: null, error: { message: "x" } });
    await expect(actualizarPlantilla({ id: "p1", patch: {} })).rejects.toThrow();
  });

  it("eliminarPlantilla hace soft delete con deleted_at", async () => {
    vi.mocked(registrarActividad).mockClear();
    mock.setTableResult("crm_plantillas_mensaje", { data: { id: "p1" }, error: null });
    await eliminarPlantilla("p1");
    const p = mock.getMutationPayload("crm_plantillas_mensaje", "update") as Record<string, unknown>;
    expect(p.deleted_at).toEqual(expect.any(String));
    expect(new Date(p.deleted_at as string).toString()).not.toBe("Invalid Date");
    expect(registrarActividad).toHaveBeenCalledTimes(1);
  });

  it("eliminarPlantilla exige fila afectada y no registra bitácora si no existe/RLS", async () => {
    vi.mocked(registrarActividad).mockClear();
    mock.setTableResult("crm_plantillas_mensaje", { data: null, error: null });
    await expect(eliminarPlantilla("p1")).rejects.toThrow(/no tienes permiso|ya no existe/i);
    expect(registrarActividad).not.toHaveBeenCalled();
  });

  it("eliminarPlantilla propaga error", async () => {
    mock.setTableResult("crm_plantillas_mensaje", { data: null, error: { message: "x" } });
    await expect(eliminarPlantilla("p1")).rejects.toThrow();
  });
});
