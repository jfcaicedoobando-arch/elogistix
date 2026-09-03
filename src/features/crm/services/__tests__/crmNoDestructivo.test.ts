/**
 * v13.823.50 — regresiones de "no borrar el texto del usuario":
 * - `completarActividad` sin resultado no debe escribir `resultado: ""`.
 * - la cancelación por oportunidad perdida no debe pisar resultados existentes.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mock = await vi.hoisted(async () => {
  const { createSupabaseMock } = await import("@/services/__tests__/_supabaseChainMock");
  return createSupabaseMock();
});
vi.mock("@/integrations/supabase/client", () => ({ supabase: mock.supabase }));
vi.mock("@/services/bitacora/registrar", () => ({ registrarActividad: vi.fn(async () => undefined) }));
vi.mock("../notificaciones", () => ({ crearNotificacionSilencioso: vi.fn(async () => undefined) }));

import { completarActividad } from "../actividades";
import { cancelarActividadesPerdida, type AutomationCtx } from "../automatizacionesEtapa";

beforeEach(() => { mock.tableCalls.length = 0; });

/** Payloads de todas las operaciones `update` registradas por el mock. */
function updates(): Record<string, unknown>[] {
  return mock.tableCalls.flatMap((c) =>
    c.ops.flatMap((op, i) => (op === "update" ? [c.opArgs[i][0] as Record<string, unknown>] : [])),
  );
}

describe("completarActividad (no destructivo: preserva resultado)", () => {
  it("sin resultado sólo escribe fecha_completada", async () => {
    mock.setTableResult("crm_actividades", { data: { id: "act-1" }, error: null });
    await completarActividad({ id: "act-1" });
    const patch = updates()[0];
    expect(patch).toHaveProperty("fecha_completada");
    expect(patch).not.toHaveProperty("resultado");
  });

  it("con resultado explícito lo escribe", async () => {
    mock.setTableResult("crm_actividades", { data: { id: "act-1" }, error: null });
    await completarActividad({ id: "act-1", resultado: "Contactado" });
    expect(updates()[0].resultado).toBe("Contactado");
  });

  it("permite limpiar el resultado con cadena vacía explícita", async () => {
    mock.setTableResult("crm_actividades", { data: { id: "act-1" }, error: null });
    await completarActividad({ id: "act-1", resultado: "" });
    expect(updates()[0].resultado).toBe("");
  });
});

describe("cancelarActividadesPerdida (no destructivo: un solo UPDATE)", () => {
  const ctx: AutomationCtx = {
    etapa: {
      id: "e8", nombre: "Perdida", tipo: "perdida", probabilidad_default: 0,
      crea_tarea_seguimiento: false, dias_seguimiento: 0,
    },
    op: { id: "o1", nombre: "Op 1", vendedor_id: "u1", vendedor_email: "v@x.com", cliente_nombre: "C" },
    responsableId: "u1", responsableEmail: "v@x.com", userId: "u1",
  };

  it("cierra todas las pendientes en un solo UPDATE y nunca toca resultado", async () => {
    mock.setTableResult("crm_actividades", { data: [], error: null });
    await cancelarActividadesPerdida(ctx);
    const ups = updates();
    // v13.823.51 — un único UPDATE: la variante de dos pasos podía dejar media
    // lista abierta si el segundo fallaba.
    expect(ups).toHaveLength(1);
    expect(ups[0]).toHaveProperty("fecha_completada");
    expect(ups[0]).not.toHaveProperty("resultado");
  });

  it("propaga el error del UPDATE (no declara éxito silencioso)", async () => {
    mock.setTableResult("crm_actividades", { data: null, error: { message: "boom" } });
    await expect(cancelarActividadesPerdida(ctx)).rejects.toMatchObject({ message: "boom" });
  });
});
