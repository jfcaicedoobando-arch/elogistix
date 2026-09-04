/**
 * Hallazgo P1 (reapertura CRM): mover una oportunidad de "ganada"/"perdida"
 * de vuelta a una etapa "abierta" debe limpiar los campos de cierre
 * (fecha_cierre_real, valor_real, motivo_perdida_id) sin tocar el historial
 * de etapas (`crm_historial_etapas` lo registra el trigger de BD, nunca el
 * cliente) y reutilizando el guard optimista `expectedUpdatedAt`.
 *
 * `resolverLimpiezaCierre` (moverOportunidadEtapaHelpers.ts) calcula el patch
 * de limpieza; este test verifica que `moverEtapaOportunidad` lo aplique tal
 * cual contra `crm_oportunidades` en un solo UPDATE atómico.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

const mock = await vi.hoisted(async () => {
  const { createSupabaseMock } = await import("@/services/__tests__/_supabaseChainMock");
  return createSupabaseMock();
});
vi.mock("@/integrations/supabase/client", () => ({ supabase: mock.supabase }));

import { moverEtapaOportunidad } from "../oportunidadesMutations";
import { resolverLimpiezaCierre } from "@/features/crm/hooks/moverOportunidadEtapaHelpers";

beforeEach(() => { mock.tableCalls.length = 0; });

type EtapaArg = Parameters<typeof resolverLimpiezaCierre>[0];
/** Sólo `id`/`tipo` participan en la limpieza de cierre; el resto de la fila es irrelevante. */
const etapa = (id: string, tipo: string): EtapaArg => ({ id, tipo }) as unknown as EtapaArg;

const ETAPA_GANADA = etapa("e-ganada", "ganada");
const ETAPA_PERDIDA = etapa("e-perdida", "perdida");
const ETAPA_ABIERTA = etapa("e-abierta", "abierta");

describe("Reapertura de oportunidades — Ganada → Abierta", () => {
  it("limpia fecha_cierre_real y valor_real en el mismo UPDATE, conserva expectedUpdatedAt", async () => {
    mock.setTableResult("crm_oportunidades", {
      data: { id: "op-1", updated_at: "2024-03-01T00:00:00Z" },
      error: null,
    });
    const limpieza = resolverLimpiezaCierre(ETAPA_ABIERTA, ETAPA_GANADA);
    expect(limpieza).toEqual({ fecha_cierre_real: null, valor_real: null });

    await moverEtapaOportunidad({
      id: "op-1",
      etapa_id: ETAPA_ABIERTA.id,
      probabilidad: 20,
      ...limpieza,
      expectedUpdatedAt: "2024-02-01T00:00:00Z",
    });

    const payload = mock.getMutationPayload("crm_oportunidades", "update") as Record<string, unknown>;
    expect(payload.etapa_id).toBe(ETAPA_ABIERTA.id);
    expect(payload.fecha_cierre_real).toBeNull();
    expect(payload.valor_real).toBeNull();
    // El guard optimista se reutiliza: el UPDATE va filtrado por updated_at.
    const call = mock.tableCalls.find((c) => c.table === "crm_oportunidades");
    const eqArgs = call?.opArgs[call.ops.indexOf("eq")];
    expect(call?.ops).toContain("eq");
    expect(eqArgs).toBeDefined();
    // No se tocó crm_historial_etapas ni bitácora de auditoría desde el cliente.
    expect(mock.tableCalls.some((c) => c.table === "crm_historial_etapas")).toBe(false);
  });
});

describe("Reapertura de oportunidades — Perdida → Abierta", () => {
  it("limpia motivo_perdida_id, conserva expectedUpdatedAt y no borra historial", async () => {
    mock.setTableResult("crm_oportunidades", {
      data: { id: "op-2", updated_at: "2024-03-02T00:00:00Z" },
      error: null,
    });
    const limpieza = resolverLimpiezaCierre(ETAPA_ABIERTA, ETAPA_PERDIDA);
    expect(limpieza).toEqual({ motivo_perdida_id: null });

    await moverEtapaOportunidad({
      id: "op-2",
      etapa_id: ETAPA_ABIERTA.id,
      probabilidad: 20,
      ...limpieza,
      expectedUpdatedAt: "2024-02-02T00:00:00Z",
    });

    const payload = mock.getMutationPayload("crm_oportunidades", "update") as Record<string, unknown>;
    expect(payload.etapa_id).toBe(ETAPA_ABIERTA.id);
    expect(payload.motivo_perdida_id).toBeNull();
    expect(payload.fecha_cierre_real).toBeUndefined();
    expect(mock.tableCalls.some((c) => c.table === "crm_historial_etapas")).toBe(false);
  });

  it("0 filas + expectedUpdatedAt en la reapertura => conflicto de concurrencia (no se pisa el cambio ajeno)", async () => {
    mock.setTableResult("crm_oportunidades", { data: null, error: null });
    const limpieza = resolverLimpiezaCierre(ETAPA_ABIERTA, ETAPA_PERDIDA);
    const p = moverEtapaOportunidad({
      id: "op-3",
      etapa_id: ETAPA_ABIERTA.id,
      ...limpieza,
      expectedUpdatedAt: "2024-01-01T00:00:00Z",
    });
    await expect(p).rejects.toThrow();
  });
});
