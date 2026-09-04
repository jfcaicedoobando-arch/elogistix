/**
 * Regresión — actualizar y eliminar oportunidades deben invalidar
 * `crm.kpis` y `crm.dashboardAll` para que el resumen ejecutivo no quede
 * con montos/embudo viejos hasta que venza el staleTime de 60s.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { createWrapper } from "@/test/utils/queryWrapper";

const actualizarOportunidad = vi.hoisted(() => vi.fn());
const eliminarOportunidad = vi.hoisted(() => vi.fn());

vi.mock("@/features/crm/services/oportunidades", () => ({
  listOportunidades: vi.fn(),
  getOportunidad: vi.fn(),
  crearOportunidad: vi.fn(),
  actualizarOportunidad,
  eliminarOportunidad,
}));

vi.mock("@/lib/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { id: "user-1", email: "kam@example.com" } }),
}));

vi.mock("@/lib/ui/appFeedback", () => ({
  notifySuccess: vi.fn(),
  notifyError: vi.fn(),
}));

vi.mock("@/lib/query", () => ({
  queryKeys: {
    crm: {
      oportunidades: {
        all: ["crm", "oportunidades"],
        detail: (id: string) => ["crm", "oportunidades", id],
      },
      higiene: { all: ["crm", "higiene"] },
      kpis: ["crm", "kpis"],
      dashboardAll: ["crm", "dashboard"],
    },
  },
}));

import { useActualizarOportunidad, useEliminarOportunidad } from "../useOportunidades";

function spyClient() {
  const client = (globalThis as unknown as {
    __TEST_QUERY_CLIENT__: { invalidateQueries: (args: unknown) => unknown };
  }).__TEST_QUERY_CLIENT__;
  return vi.spyOn(client, "invalidateQueries");
}

const keys = (spy: ReturnType<typeof spyClient>) =>
  spy.mock.calls.map((args) => (args[0] as { queryKey: unknown }).queryKey);

describe("invalidación de dashboard en oportunidades", () => {
  beforeEach(() => {
    actualizarOportunidad.mockReset().mockResolvedValue({ id: "op-1" });
    eliminarOportunidad.mockReset().mockResolvedValue(undefined);
  });

  it("actualizar invalida listas, detalle, kpis y dashboard", async () => {
    const { result } = renderHook(() => useActualizarOportunidad(), { wrapper: createWrapper() });
    const spy = spyClient();

    result.current.mutate({ id: "op-1", monto: 1000 } as never);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const invalidated = keys(spy);
    expect(invalidated).toContainEqual(["crm", "oportunidades"]);
    expect(invalidated).toContainEqual(["crm", "oportunidades", "op-1"]);
    expect(invalidated).toContainEqual(["crm", "higiene"]);
    expect(invalidated).toContainEqual(["crm", "kpis"]);
    expect(invalidated).toContainEqual(["crm", "dashboard"]);
  });

  it("eliminar invalida listas, higiene, kpis y dashboard", async () => {
    const { result } = renderHook(() => useEliminarOportunidad(), { wrapper: createWrapper() });
    const spy = spyClient();

    result.current.mutate("op-1");
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const invalidated = keys(spy);
    expect(invalidated).toContainEqual(["crm", "oportunidades"]);
    expect(invalidated).toContainEqual(["crm", "higiene"]);
    expect(invalidated).toContainEqual(["crm", "kpis"]);
    expect(invalidated).toContainEqual(["crm", "dashboard"]);
  });
});
