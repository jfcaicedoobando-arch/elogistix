import { describe, it, expect, vi, beforeEach } from "vitest";

const mock = await vi.hoisted(async () => {
  const { createSupabaseMock } = await import("@/services/__tests__/_supabaseChainMock");
  return createSupabaseMock();
});
vi.mock("@/integrations/supabase/client", () => ({ supabase: mock.supabase }));

const { notificarMock } = vi.hoisted(() => ({ notificarMock: vi.fn(async () => undefined) }));
vi.mock("../notificaciones", () => ({ crearNotificacionSilencioso: notificarMock }));

import {
  fetchEtapa,
  fetchOportunidad,
  notifyVendedorMovido,
  crearTareaGanada,
  cancelarActividadesPerdida,
  crearTareaSeguimiento,
  runAutomatizaciones,
  type AutomationCtx,
  type EtapaInfo,
  type OportunidadMin,
} from "../automatizacionesEtapa";

const baseEtapa: EtapaInfo = {
  id: "e1",
  nombre: "Cotizando",
  tipo: "abierta",
  probabilidad_default: 30,
  crea_tarea_seguimiento: true,
  dias_seguimiento: 3,
};
const baseOp: OportunidadMin = {
  id: "o1", nombre: "Op 1", vendedor_id: "u-vend", vendedor_email: "v@x.com",
  cliente_nombre: "Cliente SA",
};
const ctx = (over: Partial<AutomationCtx> = {}): AutomationCtx => ({
  etapa: baseEtapa, op: baseOp, responsableId: "u-vend",
  responsableEmail: "v@x.com", userId: "u-actor",
  ...over,
});

beforeEach(() => {
  mock.tableCalls.length = 0;
  notificarMock.mockClear();
});

describe("fetchEtapa / fetchOportunidad", () => {
  it("fetchEtapa retorna data cuando existe", async () => {
    mock.setTableResult("crm_etapas_pipeline", { data: baseEtapa, error: null });
    expect(await fetchEtapa("e1")).toEqual(baseEtapa);
  });
  it("fetchEtapa devuelve null en error o data nula", async () => {
    mock.setTableResult("crm_etapas_pipeline", { data: null, error: { message: "x" } });
    expect(await fetchEtapa("e1")).toBeNull();
  });
  it("fetchOportunidad retorna data", async () => {
    mock.setTableResult("crm_oportunidades", { data: baseOp, error: null });
    expect(await fetchOportunidad("o1")).toEqual(baseOp);
  });
});

describe("notifyVendedorMovido", () => {
  it("no notifica si el actor es el mismo vendedor", async () => {
    await notifyVendedorMovido(ctx({ userId: "u-vend" }));
    expect(notificarMock).not.toHaveBeenCalled();
  });
  it("no notifica si no hay vendedor_id", async () => {
    await notifyVendedorMovido(ctx({ op: { ...baseOp, vendedor_id: null } }));
    expect(notificarMock).not.toHaveBeenCalled();
  });
  it("notifica al vendedor con título y link correctos", async () => {
    await notifyVendedorMovido(ctx());
    expect(notificarMock).toHaveBeenCalledTimes(1);
    const arg = (notificarMock.mock.calls[0] as unknown as [{ titulo: string; link: string; mensaje: string }])[0];
    expect(arg.titulo).toContain("Cotizando");
    expect(arg.link).toBe("/crm/oportunidades/o1");
    expect(arg.mensaje).toContain("Cliente SA");
  });
});

describe("crearTareaGanada", () => {
  it("no hace nada si la etapa no es 'ganada'", async () => {
    await crearTareaGanada(ctx());
    expect(mock.tableCalls.length).toBe(0);
  });
  it("inserta tarea cuando etapa es ganada y hay responsable", async () => {
    mock.setTableResult("crm_actividades", { data: null, error: null });
    await crearTareaGanada(ctx({ etapa: { ...baseEtapa, tipo: "ganada" } }));
    const payload = mock.getMutationPayload("crm_actividades", "insert") as Record<string, unknown>;
    expect(payload.tipo).toBe("tarea");
    expect(payload.asunto).toBe("Generar cotización en firme");
    expect(payload.entidad_id).toBe("o1");
  });
  it("no inserta si no hay responsableId", async () => {
    await crearTareaGanada(ctx({ etapa: { ...baseEtapa, tipo: "ganada" }, responsableId: null }));
    expect(mock.tableCalls.length).toBe(0);
  });
});

describe("cancelarActividadesPerdida", () => {
  it("no hace nada si etapa no es 'perdida'", async () => {
    await cancelarActividadesPerdida(ctx());
    expect(mock.tableCalls.length).toBe(0);
  });
  it("cierra las actividades pendientes de una etapa perdida", async () => {
    mock.setTableResult("crm_actividades", { data: null, error: null });
    await cancelarActividadesPerdida(ctx({ etapa: { ...baseEtapa, tipo: "perdida" } }));
    // v13.823.50: el primer UPDATE sólo cierra (sin pisar `resultado`); el
    // texto "cancelada" se escribe en el segundo, para filas sin resultado.
    const payload = mock.getMutationPayload("crm_actividades", "update") as Record<string, unknown>;
    expect(payload).toHaveProperty("fecha_completada");
    expect(payload).not.toHaveProperty("resultado");
    const call = mock.tableCalls.find(c => c.table === "crm_actividades");
    expect(call?.ops).toContain("is");
  });
});


describe("crearTareaSeguimiento", () => {
  it("no inserta si etapa no es abierta", async () => {
    await crearTareaSeguimiento(ctx({ etapa: { ...baseEtapa, tipo: "ganada" } }));
    expect(mock.tableCalls.length).toBe(0);
  });
  it("no inserta si flag crea_tarea_seguimiento=false", async () => {
    await crearTareaSeguimiento(ctx({ etapa: { ...baseEtapa, crea_tarea_seguimiento: false } }));
    expect(mock.tableCalls.length).toBe(0);
  });
  it("inserta tarea de seguimiento con asunto correcto", async () => {
    mock.setTableResult("crm_actividades", { data: null, error: null });
    await crearTareaSeguimiento(ctx());
    const payload = mock.getMutationPayload("crm_actividades", "insert") as Record<string, unknown>;
    expect(payload.asunto).toBe("Seguimiento: Cotizando");
  });
});

describe("tanda 2 · hallazgo 2: los fallos de tarea automática no se ocultan", () => {
  it("propaga el error del INSERT de la tarea ganada", async () => {
    mock.setTableResultOnce("crm_actividades", { data: null, error: null }); // chequeo idempotencia
    mock.setTableResult("crm_actividades", { data: null, error: { message: "insert down" } });
    await expect(
      crearTareaGanada(ctx({ etapa: { ...baseEtapa, tipo: "ganada" } })),
    ).rejects.toMatchObject({ message: "insert down" });
    mock.resetResults();
  });

  it("propaga el error del INSERT de la tarea de seguimiento", async () => {
    mock.setTableResultOnce("crm_actividades", { data: null, error: null });
    mock.setTableResult("crm_actividades", { data: null, error: { message: "insert down" } });
    await expect(crearTareaSeguimiento(ctx())).rejects.toMatchObject({ message: "insert down" });
    mock.resetResults();
  });

  it("no duplica la tarea si ya existe una abierta (reintento idempotente)", async () => {
    mock.setTableResult("crm_actividades", { data: { id: "act-1" }, error: null });
    await crearTareaSeguimiento(ctx());
    expect(mock.tableCalls.some(c => c.table === "crm_actividades" && c.ops.includes("insert"))).toBe(false);
    mock.resetResults();
  });

  it("runAutomatizaciones agrega el fallo en un mensaje accionable sin revertir la etapa", async () => {
    mock.setTableResult("crm_etapas_pipeline", { data: baseEtapa, error: null });
    mock.setTableResult("crm_oportunidades", { data: baseOp, error: null });
    mock.setTableResultOnce("crm_actividades", { data: null, error: null });
    mock.setTableResult("crm_actividades", { data: null, error: { message: "insert down" } });
    await expect(runAutomatizaciones("e1", "o1", "u-actor", "actor@x.com")).rejects.toThrow(
      /tarea de seguimiento.*insert down.*reintentar sin duplicar/is,
    );
    mock.resetResults();
  });
});

describe("runAutomatizaciones", () => {
  it("retorna temprano si etapa no existe", async () => {
    mock.setTableResult("crm_etapas_pipeline", { data: null, error: null });
    mock.setTableResult("crm_oportunidades", { data: baseOp, error: null });
    await runAutomatizaciones("e1", "o1", "u", "u@x.com");
    expect(notificarMock).not.toHaveBeenCalled();
  });
  it("ejecuta notify + seguimiento para etapa abierta", async () => {
    mock.setTableResult("crm_etapas_pipeline", { data: baseEtapa, error: null });
    mock.setTableResult("crm_oportunidades", { data: baseOp, error: null });
    mock.setTableResult("crm_actividades", { data: null, error: null });
    await runAutomatizaciones("e1", "o1", "u-actor", "actor@x.com");
    expect(notificarMock).toHaveBeenCalledTimes(1);
    expect(mock.tableCalls.some(c => c.table === "crm_actividades" && c.ops.includes("insert"))).toBe(true);
  });
});
