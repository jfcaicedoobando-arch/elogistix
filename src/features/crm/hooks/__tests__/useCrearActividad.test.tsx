/**
 * Regresión v13.823.78 — `useCrearActividad` debe invalidar `crm.dashboardAll`
 * para que el resumen ejecutivo/Mi día refleje la actividad recién creada
 * sin esperar a que venza el staleTime de 60s del dashboard.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { createWrapper } from "@/test/utils/queryWrapper";

const crearActividad = vi.hoisted(() => vi.fn());
const notifySuccess = vi.hoisted(() => vi.fn());

vi.mock("@/features/crm/services/actividades", () => ({
  crearActividad,
}));

vi.mock("@/lib/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { id: "user-1", email: "kam@example.com" } }),
}));

vi.mock("@/lib/ui/appFeedback", () => ({
  notifySuccess,
  notifyError: vi.fn(),
}));

vi.mock("@/lib/query", () => ({
  queryKeys: {
    crm: {
      actividades: { all: ["crm", "actividades"] },
      higiene: { all: ["crm", "higiene"] },
      kpis: ["crm", "kpis"],
      dashboardAll: ["crm", "dashboard"],
      nbaSignalsAll: ["crm", "nba-signals"],
    },
  },
}));

import { useCrearActividad, type ActividadInput } from "../useActividades";

const baseInput: ActividadInput = {
  tipo: "tarea",
  asunto: "Llamar de seguimiento",
  entidad_tipo: "lead",
  entidad_id: "lead-1",
};

describe("useCrearActividad invalidación de queries", () => {
  beforeEach(() => {
    crearActividad.mockReset();
    crearActividad.mockResolvedValue({ id: "act-1" });
    notifySuccess.mockReset();
  });

  it("invalida actividades, higiene, kpis y dashboard tras crear una actividad", async () => {
    const { result } = renderHook(() => useCrearActividad(), { wrapper: createWrapper() });
    const client = (globalThis as unknown as {
      __TEST_QUERY_CLIENT__: { invalidateQueries: (args: unknown) => unknown };
    }).__TEST_QUERY_CLIENT__;
    const invalidateSpy = vi.spyOn(client, "invalidateQueries");

    result.current.mutate(baseInput);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const invalidated = invalidateSpy.mock.calls.map(
      (args) => (args[0] as { queryKey: unknown }).queryKey,
    );
    expect(invalidated).toContainEqual(["crm", "actividades"]);
    expect(invalidated).toContainEqual(["crm", "higiene"]);
    expect(invalidated).toContainEqual(["crm", "kpis"]);
    expect(invalidated).toContainEqual(["crm", "dashboard"]);
    // v13.823.94: NBA no requiere invalidarse aquí — sus señales de
    // actividades vencidas viven bajo `crm.actividades.*`.
    expect(invalidated).not.toContainEqual(["crm", "nba-signals"]);
  });

  it("muestra toast de éxito salvo cuando la actividad es silenciosa", async () => {
    const { result } = renderHook(() => useCrearActividad(), { wrapper: createWrapper() });

    result.current.mutate(baseInput);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(notifySuccess).toHaveBeenCalledTimes(1);

    result.current.mutate({ ...baseInput, silencioso: true });
    await waitFor(() => expect(result.current.variables?.silencioso).toBe(true));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(notifySuccess).toHaveBeenCalledTimes(1);
  });
});
