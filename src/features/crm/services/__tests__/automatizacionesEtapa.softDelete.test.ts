import { beforeEach, describe, expect, it, vi } from "vitest";
const mock = await vi.hoisted(async () => {
  const { createSoftDeleteReadMock } = await import("@/services/__tests__/_softDeleteReadPlanMock");
  return createSoftDeleteReadMock();
});
const spies = vi.hoisted(() => ({ notificar: vi.fn(), actividad: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: mock.supabase }));
vi.mock("../notificaciones", () => ({ crearNotificacionSilencioso: spies.notificar }));
vi.mock("@/services/bitacora/registrar", () => ({ registrarActividad: spies.actividad }));
import { runAutomatizaciones } from "../automatizacionesEtapa";
const etapa = { id: "et1", nombre: "Etapa ficticia", tipo: "abierta", probabilidad_default: 30, crea_tarea_seguimiento: true, dias_seguimiento: 3 };
const op = { id: "op1", nombre: "Oportunidad ficticia", vendedor_id: "vendedor-test", vendedor_email: "vendedor@example.invalid", cliente_nombre: "Cliente ficticio" };
beforeEach(() => { mock.reset(); spies.notificar.mockReset(); spies.actividad.mockReset(); });
describe.each(["abierta", "ganada", "perdida"])("automatización %s", tipo => {
  it.each(["etapa", "oportunidad"])("%s ausente o borrada no notifica, crea tareas ni cierra actividades", async destino => {
    for (const borrado of [false, true]) {
      mock.reset();
      mock.queue("crm_etapas_pipeline", destino !== "etapa" ? { ...etapa, tipo } : borrado ? { ...etapa, tipo, deleted_at: "2026-10-01" } : null);
      mock.queue("crm_oportunidades", destino !== "oportunidad" ? op : borrado ? { ...op, deleted_at: "2026-10-01" } : null);
      await runAutomatizaciones("et1", "op1", "actor-test", "actor@example.invalid");
      expect(mock.tableCalls).toHaveLength(2); expect(mock.rpcCalls).toHaveLength(0);
      expect(spies.notificar).not.toHaveBeenCalled(); expect(spies.actividad).not.toHaveBeenCalled();
      for (const call of mock.tableCalls) expect(call.opArgs).toContainEqual(["deleted_at", null]);
    }
  });
  it("conserva notificación y acción cuando ambos registros siguen vivos", async () => {
    mock.queue("crm_etapas_pipeline", { ...etapa, tipo }); mock.queue("crm_oportunidades", op);
    if (tipo !== "perdida") mock.queue("crm_actividades", null); // Dedupe tarea.
    mock.queue("crm_actividades", null); // INSERT o cierre.
    await runAutomatizaciones("et1", "op1", "actor-test", "actor@example.invalid");
    expect(spies.notificar).toHaveBeenCalledOnce(); expect(spies.actividad).toHaveBeenCalledOnce();
    const write = mock.tableCalls.find(call => call.ops.includes(tipo === "perdida" ? "update" : "insert"));
    expect(write).toBeDefined(); expect(write?.table).toBe("crm_actividades");
    for (const call of mock.tableCalls.slice(0, 2)) expect(call.opArgs).toContainEqual(["deleted_at", null]);
  });
});
it("error al leer etapa no inicia ninguna automatización", async () => {
  const error = new Error("lectura-etapa"); mock.queue("crm_etapas_pipeline", null, error); mock.queue("crm_oportunidades", op);
  await expect(runAutomatizaciones("et1", "op1", "actor", "actor@example.invalid")).rejects.toBe(error);
  expect(spies.notificar).not.toHaveBeenCalled(); expect(spies.actividad).not.toHaveBeenCalled(); expect(mock.tableCalls).toHaveLength(2);
});
