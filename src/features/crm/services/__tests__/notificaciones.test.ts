import { describe, it, expect, beforeEach, vi } from "vitest";

const mock = await vi.hoisted(async () => {
  const { createSupabaseMock } = await import("@/services/__tests__/_supabaseChainMock");
  return createSupabaseMock();
});
vi.mock("@/integrations/supabase/client", () => ({ supabase: mock.supabase }));

const { loggerWarn } = vi.hoisted(() => ({ loggerWarn: vi.fn() }));
vi.mock("@/lib/observability/logger", () => ({
  logger: { warn: loggerWarn, info: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { crearNotificacionSilencioso } from "../notificaciones";

beforeEach(() => {
  mock.tableCalls.length = 0;
  loggerWarn.mockReset();
});

describe("crm/services/notificaciones", () => {
  it("notificaciones.crear: inserta con mensaje vacío por defecto", async () => {
    mock.setTableResult("crm_notificaciones", { data: null, error: null });
    await crearNotificacionSilencioso({ user_id: "u1", tipo: "tarea", titulo: "Hola" });
    const payload = mock.getMutationPayload("crm_notificaciones", "insert") as Record<string, unknown>;
    expect(payload.user_id).toBe("u1");
    expect(payload.mensaje).toBe("");
    expect(payload.link).toBeNull();
  });

  it("notificaciones.crear: respeta mensaje y link explícitos", async () => {
    mock.setTableResult("crm_notificaciones", { data: null, error: null });
    await crearNotificacionSilencioso({
      user_id: "u1",
      tipo: "x",
      titulo: "T",
      mensaje: "Detalle",
      link: "/crm/leads/1",
    });
    const payload = mock.getMutationPayload("crm_notificaciones", "insert") as Record<string, unknown>;
    expect(payload.mensaje).toBe("Detalle");
    expect(payload.link).toBe("/crm/leads/1");
  });

  it("notificaciones.crear: link explícitamente null se preserva", async () => {
    mock.setTableResult("crm_notificaciones", { data: null, error: null });
    await crearNotificacionSilencioso({ user_id: "u", tipo: "x", titulo: "T", link: null });
    const payload = mock.getMutationPayload("crm_notificaciones", "insert") as Record<string, unknown>;
    expect(payload.link).toBeNull();
  });

  it("notificaciones.crear: tipo y título se persisten", async () => {
    mock.setTableResult("crm_notificaciones", { data: null, error: null });
    await crearNotificacionSilencioso({ user_id: "u", tipo: "lead_movido", titulo: "Lead movido" });
    const payload = mock.getMutationPayload("crm_notificaciones", "insert") as Record<string, unknown>;
    expect(payload.tipo).toBe("lead_movido");
    expect(payload.titulo).toBe("Lead movido");
  });

  it("notificaciones.crear: nunca lanza aunque supabase falle (silencioso)", async () => {
    mock.supabase.from = vi.fn(() => {
      throw new Error("network");
    }) as never;
    await expect(
      crearNotificacionSilencioso({ user_id: "u", tipo: "x", titulo: "T" }),
    ).resolves.toBeUndefined();
  });

  it("notificaciones.crear: registra warning cuando falla", async () => {
    mock.supabase.from = vi.fn(() => {
      throw new Error("oops");
    }) as never;
    await crearNotificacionSilencioso({ user_id: "u", tipo: "x", titulo: "T" });
    expect(loggerWarn).toHaveBeenCalled();
  });

  it("notificaciones.crear: tabla correcta", async () => {
    mock.setTableResult("crm_notificaciones", { data: null, error: null });
    await crearNotificacionSilencioso({ user_id: "u", tipo: "x", titulo: "T" });
    expect(mock.tableCalls.some((c) => c.table === "crm_notificaciones")).toBe(true);
  });

  it("notificaciones.crear: usa op insert (no update)", async () => {
    mock.setTableResult("crm_notificaciones", { data: null, error: null });
    await crearNotificacionSilencioso({ user_id: "u", tipo: "x", titulo: "T" });
    const call = mock.tableCalls.find((c) => c.table === "crm_notificaciones");
    expect(call?.ops).toContain("insert");
    expect(call?.ops).not.toContain("update");
  });

  it("notificaciones.crear: acepta título vacío sin transformar", async () => {
    mock.setTableResult("crm_notificaciones", { data: null, error: null });
    await crearNotificacionSilencioso({ user_id: "u", tipo: "x", titulo: "" });
    const payload = mock.getMutationPayload("crm_notificaciones", "insert") as Record<string, unknown>;
    expect(payload.titulo).toBe("");
  });

  it("notificaciones.crear: mensaje undefined → cadena vacía", async () => {
    mock.setTableResult("crm_notificaciones", { data: null, error: null });
    await crearNotificacionSilencioso({ user_id: "u", tipo: "x", titulo: "T", mensaje: undefined });
    const payload = mock.getMutationPayload("crm_notificaciones", "insert") as Record<string, unknown>;
    expect(payload.mensaje).toBe("");
  });
});
