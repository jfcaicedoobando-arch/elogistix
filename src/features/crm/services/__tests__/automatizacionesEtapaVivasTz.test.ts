/**
 * Regresiones v13.823.119:
 * 1) `cancelarActividadesPerdida` sólo toca registros vivos (`deleted_at IS NULL`).
 * 2) Las tareas automáticas suman días en el calendario CDMX, no con el reloj
 *    del navegador (estable cerca de medianoche UTC).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mock = await vi.hoisted(async () => {
  const { createSupabaseMock } = await import("@/services/__tests__/_supabaseChainMock");
  return createSupabaseMock();
});
vi.mock("@/integrations/supabase/client", () => ({ supabase: mock.supabase }));
vi.mock("../notificaciones", () => ({ crearNotificacionSilencioso: vi.fn(async () => undefined) }));
vi.mock("@/services/bitacora/registrar", () => ({ registrarActividad: vi.fn(async () => undefined) }));

import {
  cancelarActividadesPerdida,
  crearTareaGanada,
  type AutomationCtx,
  type EtapaInfo,
  type OportunidadMin,
} from "../automatizacionesEtapa";
import { utcIsoToMxLocal } from "@/lib/date/mx";

const baseEtapa: EtapaInfo = {
  id: "e1",
  nombre: "Cotizando",
  tipo: "abierta",
  probabilidad_default: 30,
  crea_tarea_seguimiento: true,
  dias_seguimiento: 3,
};
const baseOp: OportunidadMin = {
  id: "o1",
  nombre: "Op 1",
  vendedor_id: "u-vend",
  vendedor_email: "v@x.com",
  cliente_nombre: "Cliente SA",
};
const ctx = (over: Partial<AutomationCtx> = {}): AutomationCtx => ({
  etapa: baseEtapa,
  op: baseOp,
  responsableId: "u-vend",
  responsableEmail: "v@x.com",
  userId: "u-actor",
  ...over,
});

beforeEach(() => {
  mock.tableCalls.length = 0;
  mock.resetResults();
});
afterEach(() => {
  vi.useRealTimers();
});

describe("cancelarActividadesPerdida · sólo registros vivos", () => {
  it("filtra por deleted_at nulo: una actividad archivada no se marca completada", async () => {
    mock.setTableResult("crm_actividades", { data: null, error: null });
    await cancelarActividadesPerdida(ctx({ etapa: { ...baseEtapa, tipo: "perdida" } }));
    const call = mock.tableCalls.find((c) => c.table === "crm_actividades");
    const filtrosIs = (call?.ops ?? [])
      .map((op, i) => (op === "is" ? call!.opArgs[i] : null))
      .filter(Boolean) as unknown[][];
    expect(filtrosIs).toContainEqual(["fecha_completada", null]);
    expect(filtrosIs).toContainEqual(["deleted_at", null]);
  });

  it("sigue cerrando las tareas activas (payload intacto)", async () => {
    mock.setTableResult("crm_actividades", { data: null, error: null });
    await cancelarActividadesPerdida(ctx({ etapa: { ...baseEtapa, tipo: "perdida" } }));
    const payload = mock.getMutationPayload("crm_actividades", "update") as Record<string, unknown>;
    expect(payload).toHaveProperty("fecha_completada");
    expect(payload).not.toHaveProperty("resultado");
  });
});

describe("fecha programada de tareas automáticas · calendario CDMX", () => {
  const fechaProgramada = async (): Promise<string> => {
    mock.setTableResultOnce("crm_actividades", { data: null, error: null });
    mock.setTableResult("crm_actividades", { data: null, error: null });
    await crearTareaGanada(ctx({ etapa: { ...baseEtapa, tipo: "ganada" } }));
    const payload = mock.getMutationPayload("crm_actividades", "insert") as Record<string, string>;
    return payload.fecha_programada;
  };

  it("cerca de medianoche UTC programa el día siguiente en MX, no en UTC", async () => {
    // 2026-03-10T02:30:00Z = 2026-03-09 20:30 en CDMX.
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-10T02:30:00Z"));
    const iso = await fechaProgramada();
    expect(utcIsoToMxLocal(new Date(iso)).slice(0, 10)).toBe("2026-03-10");
  });

  it("conserva la hora local mexicana al sumar el día", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-10T02:30:00Z"));
    const iso = await fechaProgramada();
    expect(utcIsoToMxLocal(new Date(iso)).slice(11, 16)).toBe("20:30");
  });

  it("dentro del día CDMX suma un día natural", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-09T18:00:00Z")); // 12:00 CDMX
    const iso = await fechaProgramada();
    expect(utcIsoToMxLocal(new Date(iso)).slice(0, 10)).toBe("2026-03-10");
  });
});
