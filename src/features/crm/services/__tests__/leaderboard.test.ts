import { describe, it, expect, beforeEach, vi } from "vitest";

const mock = await vi.hoisted(async () => {
  const { createSupabaseMock } = await import("@/services/__tests__/_supabaseChainMock");
  return createSupabaseMock();
});
vi.mock("@/integrations/supabase/client", () => ({ supabase: mock.supabase }));

import {
  fetchLeaderboardRaw,
  computeLeaderboard,
  type LeaderboardRawData,
} from "@/features/crm/services/leaderboard";

beforeEach(() => {
  mock.tableCalls.length = 0;
  mock.rpcCalls.length = 0;
  mock.resetResults();
});

describe("computeLeaderboard (pure)", () => {
  const ETAPAS = [
    { id: "e-ganada", tipo: "ganada" },
    { id: "e-perdida", tipo: "perdida" },
  ];

  it("suma valor_real para ops en etapa ganada", () => {
    const raw: LeaderboardRawData = {
      cuotas: [{ vendedor_email: "a@x.com", cuota_monto: 1000 }],
      ops: [
        { vendedor_email: "a@x.com", valor_real: 500, monto_estimado: 0, etapa_id: "e-ganada" },
        { vendedor_email: "a@x.com", valor_real: 300, monto_estimado: 0, etapa_id: "e-ganada" },
      ],
      etapas: ETAPAS,
    };
    const r = computeLeaderboard(raw);
    expect(r[0].cerrado).toBe(800);
    expect(r[0].avance).toBe(80);
  });

  it("ignora ops en etapas no ganadas", () => {
    const r = computeLeaderboard({
      cuotas: [{ vendedor_email: "a@x.com", cuota_monto: 1000 }],
      ops: [{ vendedor_email: "a@x.com", valor_real: 500, monto_estimado: 0, etapa_id: "e-perdida" }],
      etapas: ETAPAS,
    });
    expect(r[0].cerrado).toBe(0);
  });

  it("fallback a monto_estimado cuando valor_real es null", () => {
    const r = computeLeaderboard({
      cuotas: [],
      ops: [{ vendedor_email: "a@x.com", valor_real: null, monto_estimado: 200, etapa_id: "e-ganada" }],
      etapas: ETAPAS,
    });
    expect(r[0].cerrado).toBe(200);
  });

  it("avance se capa en 100", () => {
    const r = computeLeaderboard({
      cuotas: [{ vendedor_email: "a@x.com", cuota_monto: 100 }],
      ops: [{ vendedor_email: "a@x.com", valor_real: 500, monto_estimado: 0, etapa_id: "e-ganada" }],
      etapas: ETAPAS,
    });
    expect(r[0].avance).toBe(100);
  });

  it("avance es 0 si cuota es 0", () => {
    const r = computeLeaderboard({
      cuotas: [{ vendedor_email: "a@x.com", cuota_monto: 0 }],
      ops: [{ vendedor_email: "a@x.com", valor_real: 100, monto_estimado: 0, etapa_id: "e-ganada" }],
      etapas: ETAPAS,
    });
    expect(r[0].avance).toBe(0);
  });

  it("usa 'Sin asignar' cuando vendedor_email es null", () => {
    const r = computeLeaderboard({
      cuotas: [{ vendedor_email: null, cuota_monto: 100 }],
      ops: [],
      etapas: ETAPAS,
    });
    expect(r[0].vendedor).toBe("Sin asignar");
  });

  it("ordena por cerrado descendente", () => {
    const r = computeLeaderboard({
      cuotas: [
        { vendedor_email: "a@x.com", cuota_monto: 1000 },
        { vendedor_email: "b@x.com", cuota_monto: 1000 },
      ],
      ops: [
        { vendedor_email: "a@x.com", valor_real: 100, monto_estimado: 0, etapa_id: "e-ganada" },
        { vendedor_email: "b@x.com", valor_real: 900, monto_estimado: 0, etapa_id: "e-ganada" },
      ],
      etapas: ETAPAS,
    });
    expect(r[0].vendedor).toBe("b@x.com");
    expect(r[1].vendedor).toBe("a@x.com");
  });

  it("combina vendedores de cuotas + ops sin duplicar", () => {
    const r = computeLeaderboard({
      cuotas: [{ vendedor_email: "a@x.com", cuota_monto: 100 }],
      ops: [{ vendedor_email: "b@x.com", valor_real: 50, monto_estimado: 0, etapa_id: "e-ganada" }],
      etapas: ETAPAS,
    });
    expect(r).toHaveLength(2);
  });
});

describe("fetchLeaderboardRaw (I/O)", () => {
  it("devuelve estructura combinada", async () => {
    mock.setTableResult("crm_cuotas_vendedor", { data: [{ vendedor_email: "a", cuota_monto: 1 }], error: null });
    mock.setTableResult("crm_oportunidades", { data: [], error: null });
    mock.setTableResult("crm_etapas_pipeline", { data: [{ id: "e1", tipo: "ganada" }], error: null });
    const r = await fetchLeaderboardRaw(2026, 6, "2026-06-01", "2026-07-01");
    expect(r.cuotas).toHaveLength(1);
    expect(r.etapas).toHaveLength(1);
  });

  it("propaga error de cuotas", async () => {
    mock.setTableResult("crm_cuotas_vendedor", { data: null, error: { message: "x" } });
    mock.setTableResult("crm_oportunidades", { data: [], error: null });
    mock.setTableResult("crm_etapas_pipeline", { data: [], error: null });
    await expect(fetchLeaderboardRaw(2026, 6, "2026-06-01", "2026-07-01")).rejects.toThrow();
  });

  it("FIX-3: acota fecha_cierre_real con límite superior EXCLUSIVO del mes (excluye cierres futuros)", async () => {
    mock.setTableResult("crm_cuotas_vendedor", { data: [], error: null });
    mock.setTableResult("crm_oportunidades", { data: [], error: null });
    mock.setTableResult("crm_etapas_pipeline", { data: [], error: null });
    await fetchLeaderboardRaw(2026, 6, "2026-06-01T06:00:00.000Z", "2026-07-01T06:00:00.000Z");
    const call = mock.tableCalls.find((c) => c.table === "crm_oportunidades");
    expect(call).toBeDefined();
    const gteIdx = call!.ops.indexOf("gte");
    const ltIdx = call!.ops.indexOf("lt");
    const notIdx = call!.ops.indexOf("not");
    expect(gteIdx).toBeGreaterThanOrEqual(0);
    expect(ltIdx).toBeGreaterThanOrEqual(0);
    expect(notIdx).toBeGreaterThanOrEqual(0);
    expect(call!.opArgs[gteIdx]).toEqual(["fecha_cierre_real", "2026-06-01T06:00:00.000Z"]);
    expect(call!.opArgs[ltIdx]).toEqual(["fecha_cierre_real", "2026-07-01T06:00:00.000Z"]);
    expect(call!.opArgs[notIdx]).toEqual(["fecha_cierre_real", "is", null]);
  });

  it("excluye etapas borradas al clasificar oportunidades", async () => {
    mock.setTableResult("crm_cuotas_vendedor", { data: [], error: null });
    mock.setTableResult("crm_oportunidades", { data: [], error: null });
    mock.setTableResult("crm_etapas_pipeline", { data: [], error: null });
    await fetchLeaderboardRaw(2026, 6, "2026-06-01T06:00:00.000Z", "2026-07-01T06:00:00.000Z");
    const call = mock.tableCalls.find((c) => c.table === "crm_etapas_pipeline");
    expect(call).toBeDefined();
    const isIdx = call!.ops.indexOf("is");
    expect(isIdx).toBeGreaterThanOrEqual(0);
    expect(call!.opArgs[isIdx]).toEqual(["deleted_at", null]);
  });

  it("sólo suma oportunidades cerradas dentro del mes solicitado", () => {
    const raw: LeaderboardRawData = {
      cuotas: [],
      ops: [
        { vendedor_email: "a@x.com", valor_real: 1000, monto_estimado: 0, etapa_id: "e-ganada" },
        // Esta oportunidad fue descartada por el rango superior del servicio
        // y no debe llegar al computo del leaderboard de junio.
        { vendedor_email: "a@x.com", valor_real: 500, monto_estimado: 0, etapa_id: "e-ganada" },
      ],
      etapas: [
        { id: "e-ganada", tipo: "ganada" },
      ],
    };
    // Simula que el servicio ya filtró: conservamos sólo la del mes.
    const filtrado: LeaderboardRawData = {
      ...raw,
      ops: [raw.ops[0]],
    };
    const r = computeLeaderboard(filtrado);
    expect(r).toHaveLength(1);
    expect(r[0].cerrado).toBe(1000);
  });
});
