/**
 * v13.823.32: la etapa se deriva del CONJUNTO de cotizaciones vivas de la
 * oportunidad, no del último evento.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mock = await vi.hoisted(async () => {
  const { createSupabaseMock } = await import("@/services/__tests__/_supabaseChainMock");
  return createSupabaseMock();
});
vi.mock("@/integrations/supabase/client", () => ({ supabase: mock.supabase }));
const { fetchEtapasMock } = vi.hoisted(() => ({ fetchEtapasMock: vi.fn() }));
vi.mock("@/features/crm/services/etapas", () => ({
  fetchEtapasPipelineActivas: fetchEtapasMock,
}));

import { sincronizarEtapaPorEstadoCotizacion, derivarTipoEtapa } from "../sincronizarEtapa";

const etapasMock = [
  { id: "e-abierta", tipo: "abierta", nombre: "Negociación", probabilidad_default: 60, activa: true, orden: 1 },
  { id: "e-ganada", tipo: "ganada", nombre: "Ganada", probabilidad_default: 100, activa: true, orden: 2 },
  { id: "e-perdida", tipo: "perdida", nombre: "Perdida", probabilidad_default: 0, activa: true, orden: 3 },
];

beforeEach(() => {
  mock.tableCalls.length = 0;
  mock.resetResults();
  fetchEtapasMock.mockReset();
  fetchEtapasMock.mockResolvedValue(etapasMock as never);
});

describe("derivarTipoEtapa (precedencia)", () => {
  it("Aceptada gana sobre Rechazada", () => {
    expect(derivarTipoEtapa(["Aceptada", "Rechazada"])).toBe("ganada");
  });
  it("Enviada gana sobre Rechazada", () => {
    expect(derivarTipoEtapa(["Enviada", "Rechazada"])).toBe("abierta");
  });
  it("perdida sólo si todas están Rechazadas", () => {
    expect(derivarTipoEtapa(["Rechazada", "Rechazada"])).toBe("perdida");
    expect(derivarTipoEtapa(["Rechazada", "Borrador"])).toBeNull();
  });
  it("sin cotizaciones → null", () => {
    expect(derivarTipoEtapa([])).toBeNull();
  });
});

describe("sincronizarEtapaPorEstadoCotizacion", () => {
  it("dos cotizaciones (una aceptada, una rechazada) → NO marca perdida", async () => {
    mock.setTableResult("cotizaciones", {
      data: [{ id: "c1", estado: "Aceptada" }, { id: "c2", estado: "Rechazada" }],
      error: null,
    });
    mock.setTableResult("crm_oportunidades", { data: { id: "op-1" }, error: null });
    await sincronizarEtapaPorEstadoCotizacion({ oportunidadId: "op-1", estadoCotizacion: "Rechazada" });
    const update = mock.tableCalls.find(
      (c) => c.table === "crm_oportunidades" && c.ops.includes("update"),
    );
    expect(update?.ops).toContain("update");
    expect(JSON.stringify(update?.opArgs ?? [])).toContain("e-ganada");
  });

  it("todas rechazadas → etapa perdida", async () => {
    mock.setTableResult("cotizaciones", { data: [{ id: "c1", estado: "Rechazada" }], error: null });
    mock.setTableResult("crm_oportunidades", { data: { id: "op-1" }, error: null });
    await sincronizarEtapaPorEstadoCotizacion({ oportunidadId: "op-1", estadoCotizacion: "Rechazada" });
    const update = mock.tableCalls.find(
      (c) => c.table === "crm_oportunidades" && c.ops.includes("update"),
    );
    expect(JSON.stringify(update?.opArgs ?? [])).toContain("e-perdida");
  });

  it("sin tipo derivable → no toca la oportunidad", async () => {
    mock.setTableResult("cotizaciones", { data: [{ id: "c1", estado: "Borrador" }], error: null });
    await sincronizarEtapaPorEstadoCotizacion({ oportunidadId: "op-1", estadoCotizacion: "Borrador" });
    expect(mock.tableCalls.some((c) => c.table === "crm_oportunidades")).toBe(false);
  });

  it("propaga error de supabase al sincronizar etapa", async () => {
    mock.setTableResult("cotizaciones", { data: [{ id: "c1", estado: "Enviada" }], error: null });
    mock.setTableResult("crm_oportunidades", { data: null, error: { message: "rls" } });
    await expect(
      sincronizarEtapaPorEstadoCotizacion({ oportunidadId: "op-1", estadoCotizacion: "Enviada" }),
    ).rejects.toThrow();
  });
});

// P1-B (13.823.70): volver a etapa abierta limpia los datos de cierre.
describe("limpieza de cierre al reabrir (P1-B)", () => {
  const patchDe = () => {
    const call = mock.tableCalls.find(
      (c) => c.table === "crm_oportunidades" && c.ops.includes("update"),
    );
    const idx = call?.ops.indexOf("update") ?? -1;
    return (idx >= 0 ? (call?.opArgs?.[idx]?.[0] ?? {}) : {}) as Record<string, unknown>;
  };

  it("perdida → abierta limpia fecha_cierre_real y motivo_perdida_id", async () => {
    mock.setTableResult("cotizaciones", { data: [{ id: "c1", estado: "Enviada" }], error: null });
    mock.setTableResult("crm_oportunidades", { data: { id: "op-1" }, error: null });
    await sincronizarEtapaPorEstadoCotizacion({ oportunidadId: "op-1", estadoCotizacion: "Enviada" });
    const patch = patchDe();
    expect(patch.etapa_id).toBe("e-abierta");
    expect(patch.fecha_cierre_real).toBeNull();
    expect(patch.motivo_perdida_id).toBeNull();
    expect(patch.valor_real).toBeNull();
  });

  it("ganada → abierta también limpia el cierre", async () => {
    mock.setTableResult("cotizaciones", { data: [{ id: "c1", estado: "Solicitada" }], error: null });
    mock.setTableResult("crm_oportunidades", { data: { id: "op-2" }, error: null });
    await sincronizarEtapaPorEstadoCotizacion({ oportunidadId: "op-2", estadoCotizacion: "Solicitada" });
    const patch = patchDe();
    expect(patch.etapa_id).toBe("e-abierta");
    expect(patch.fecha_cierre_real).toBeNull();
    expect(patch.motivo_perdida_id).toBeNull();
  });

  it("ganada limpia motivo_perdida_id y fija fecha de cierre", async () => {
    mock.setTableResult("cotizaciones", { data: [{ id: "c1", estado: "Aceptada" }], error: null });
    mock.setTableResult("crm_oportunidades", { data: { id: "op-3" }, error: null });
    await sincronizarEtapaPorEstadoCotizacion({ oportunidadId: "op-3", estadoCotizacion: "Aceptada" });
    const patch = patchDe();
    expect(patch.etapa_id).toBe("e-ganada");
    expect(patch.motivo_perdida_id).toBeNull();
    expect(typeof patch.fecha_cierre_real).toBe("string");
  });

  it("perdida conserva su motivo_perdida_id", async () => {
    mock.setTableResult("cotizaciones", { data: [{ id: "c1", estado: "Rechazada" }], error: null });
    mock.setTableResult("crm_oportunidades", { data: { id: "op-4" }, error: null });
    await sincronizarEtapaPorEstadoCotizacion({ oportunidadId: "op-4", estadoCotizacion: "Rechazada" });
    const patch = patchDe();
    expect(patch.etapa_id).toBe("e-perdida");
    expect("motivo_perdida_id" in patch).toBe(false);
    expect(typeof patch.fecha_cierre_real).toBe("string");
  });

  it("varias cotizaciones: una aceptada mantiene ganada y no reabre", async () => {
    mock.setTableResult("cotizaciones", {
      data: [{ id: "c1", estado: "Aceptada" }, { id: "c2", estado: "Enviada" }],
      error: null,
    });
    mock.setTableResult("crm_oportunidades", { data: { id: "op-5" }, error: null });
    await sincronizarEtapaPorEstadoCotizacion({ oportunidadId: "op-5", estadoCotizacion: "Enviada" });
    const patch = patchDe();
    expect(patch.etapa_id).toBe("e-ganada");
    expect(typeof patch.fecha_cierre_real).toBe("string");
  });
});

// P1 (13.823.142): sin transición real se conserva la fecha de cierre original.
describe("preserva fecha de cierre cuando no hay transición real", () => {
  const patchDe = () => {
    const call = mock.tableCalls.find(
      (c) => c.table === "crm_oportunidades" && c.ops.includes("update"),
    );
    const idx = call?.ops.indexOf("update") ?? -1;
    return (idx >= 0 ? (call?.opArgs?.[idx]?.[0] ?? {}) : {}) as Record<string, unknown>;
  };

  it("ya ganada con fecha previa + otra cotización enviada NO mueve el cierre", async () => {
    mock.setTableResult("cotizaciones", {
      data: [{ id: "c1", estado: "Aceptada" }, { id: "c2", estado: "Enviada" }],
      error: null,
    });
    mock.setTableResult("crm_oportunidades", {
      data: { id: "op-9", fecha_cierre_real: "2026-08-31", crm_etapas_pipeline: { tipo: "ganada" } },
      error: null,
    });
    await sincronizarEtapaPorEstadoCotizacion({ oportunidadId: "op-9", estadoCotizacion: "Enviada" });
    const patch = patchDe();
    expect(patch.etapa_id).toBe("e-ganada");
    expect("fecha_cierre_real" in patch).toBe(false);
    expect("valor_real" in patch).toBe(false);
  });

  it("transición real (abierta → ganada) sí fija la fecha de cierre", async () => {
    mock.setTableResult("cotizaciones", { data: [{ id: "c1", estado: "Aceptada" }], error: null });
    mock.setTableResult("crm_oportunidades", {
      data: { id: "op-10", fecha_cierre_real: null, crm_etapas_pipeline: { tipo: "abierta" } },
      error: null,
    });
    await sincronizarEtapaPorEstadoCotizacion({ oportunidadId: "op-10", estadoCotizacion: "Aceptada" });
    const patch = patchDe();
    expect(patch.etapa_id).toBe("e-ganada");
    expect(typeof patch.fecha_cierre_real).toBe("string");
  });

  it("oportunidad inexistente/filtrada por RLS no actualiza", async () => {
    mock.setTableResult("cotizaciones", { data: [{ id: "c1", estado: "Enviada" }], error: null });
    mock.setTableResult("crm_oportunidades", { data: null, error: null });
    await sincronizarEtapaPorEstadoCotizacion({ oportunidadId: "op-11", estadoCotizacion: "Enviada" });
    expect(
      mock.tableCalls.some((c) => c.table === "crm_oportunidades" && c.ops.includes("update")),
    ).toBe(false);
  });
});


describe("cierre y valor real en el mismo update", () => {
  it.each([
    { previa: "abierta", fecha: null, moneda: "MXN", esperado: { valor_real: 300.3, moneda: "MXN" } },
    { previa: "abierta", fecha: null, moneda: "EUR", esperado: { valor_real: 50, moneda: "USD" } },
    { previa: "ganada", fecha: "2026-08-31", moneda: "MXN", esperado: {} },
  ])("conserva la política monetaria al pasar de $previa ($moneda, $fecha)", async ({ previa, fecha, moneda, esperado }) => {
    mock.setTableResult("cotizaciones", { error: null, data: [
      { id: "c1", estado: "Aceptada", subtotal: 100.1, moneda: "MXN", updated_at: "2026-11-01" },
      { id: "c2", estado: "En operación", subtotal: 200.2, moneda: "MXN", updated_at: "2026-11-02" },
      { id: "c3", estado: "Aceptada", subtotal: 50, moneda: "USD", updated_at: "2026-11-03" },
      { id: "c4", estado: "Rechazada", subtotal: 999, moneda: "MXN", updated_at: "2026-11-04" },
    ] });
    mock.setTableResult("crm_oportunidades", { error: null, data: {
      id: "op-money", moneda, fecha_cierre_real: fecha, crm_etapas_pipeline: { tipo: previa },
    } });
    await sincronizarEtapaPorEstadoCotizacion({ oportunidadId: "op-money", estadoCotizacion: "Aceptada" });
    const updates = mock.tableCalls.filter((c) => c.table === "crm_oportunidades" && c.ops.includes("update"));
    expect(updates).toHaveLength(1);
    const update = updates[0];
    const patch = update.opArgs[update.ops.indexOf("update")][0] as Record<string, unknown>;
    expect(patch).toEqual({
      etapa_id: "e-ganada", probabilidad: 100, motivo_perdida_id: null,
      ...(fecha ? {} : { fecha_cierre_real: expect.any(String) }), ...esperado,
    });
    expect(update.opArgs).toContainEqual(["id", "op-money"]);
    expect(update.opArgs).toContainEqual(["deleted_at", null]);
  });
});
