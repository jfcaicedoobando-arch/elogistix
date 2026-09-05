/**
 * Frescura del tablero de Higiene (v13.823.56):
 * 1. Las queries de Higiene se refrescan por reloj (60 s), porque un SLA vence
 *    sin que nadie mute datos.
 * 2. Las mutaciones de actividades invalidan `crm.higiene.*`.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { createWrapper } from "@/test/utils/queryWrapper";

const crearActividad = vi.hoisted(() => vi.fn());
const completarActividad = vi.hoisted(() => vi.fn());
const posponerActividad = vi.hoisted(() => vi.fn());

vi.mock("@/features/crm/services/actividades", () => ({
  crearActividad,
  completarActividad,
  posponerActividad,
  listActividades: vi.fn(),
}));

vi.mock("@/lib/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { id: "user-1", email: "u@test.local" } }),
}));

vi.mock("@/lib/query", () => ({
  queryKeys: {
    crm: {
      actividades: { all: ["crm", "actividades"], list: (f: unknown) => ["crm", "actividades", f] },
      higiene: {
        all: ["crm", "higiene"],
        resumen: ["crm", "higiene", "resumen"],
        oportunidades: ["crm", "higiene", "oportunidades"],
      },
      kpis: ["crm", "kpis"],
      dashboardAll: ["crm", "dashboard"],
      nbaSignalsAll: ["crm", "nba-signals"],
      presupuesto: { all: ["crm", "presupuesto"], anio: (a: number) => ["crm", "presupuesto", a] },
      metas: { all: ["crm", "metas"] },
    },
  },
}));

import {
  useCrearActividad,
  useCompletarActividad,
  usePosponerActividad,
} from "../useActividades";

function invalidaciones(spy: { mock: { calls: unknown[][] } }) {
  return spy.mock.calls.map((args) => (args[0] as { queryKey: unknown }).queryKey);
}

function espiarCliente() {
  const client = (globalThis as unknown as {
    __TEST_QUERY_CLIENT__: { invalidateQueries: (args: unknown) => unknown };
  }).__TEST_QUERY_CLIENT__;
  return vi.spyOn(client, "invalidateQueries");
}

describe("invalidación de Higiene tras mutar actividades", () => {
  beforeEach(() => {
    crearActividad.mockReset();
    completarActividad.mockReset();
    posponerActividad.mockReset();
  });

  it("crear actividad invalida higiene", async () => {
    crearActividad.mockResolvedValueOnce({ id: "a1" });
    const { result } = renderHook(() => useCrearActividad(), { wrapper: createWrapper() });
    const spy = espiarCliente();
    result.current.mutate({ tipo: "llamada", asunto: "x", entidad_tipo: "oportunidad", entidad_id: "o1" } as never);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(invalidaciones(spy)).toContainEqual(["crm", "higiene"]);
  });

  it("completar actividad invalida higiene", async () => {
    completarActividad.mockResolvedValueOnce(undefined);
    const { result } = renderHook(() => useCompletarActividad(), { wrapper: createWrapper() });
    const spy = espiarCliente();
    result.current.mutate("a1" as never);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(invalidaciones(spy)).toContainEqual(["crm", "higiene"]);
  });

  it("posponer actividad invalida higiene", async () => {
    posponerActividad.mockResolvedValueOnce(undefined);
    const { result } = renderHook(() => usePosponerActividad(), { wrapper: createWrapper() });
    const spy = espiarCliente();
    result.current.mutate({ id: "a1", dias: 3 } as never);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(invalidaciones(spy)).toContainEqual(["crm", "higiene"]);
  });
});
