/**
 * Regresión — actualizar una etapa del pipeline debe invalidar tanto
 * `crm.etapas.all` (activas) como `crm.etapas.todas` (todas las etapas,
 * usada por el editor de configuración). Antes sólo invalidaba `all`,
 * por lo que `useEtapasPipelineAll` mantenía datos viejos hasta recargar.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { createWrapper } from "@/test/utils/queryWrapper";

const actualizarEtapa = vi.hoisted(() => vi.fn());

vi.mock("@/features/crm/services", () => ({
  fetchEtapasPipelineActivas: vi.fn(),
  fetchEtapasPipelineTodas: vi.fn(),
  actualizarEtapa,
  fetchMotivosPerdida: vi.fn(),
  actualizarMotivoPerdida: vi.fn(),
  crearMotivoPerdida: vi.fn(),
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
      etapas: {
        all: ["crm", "etapas"],
        todas: ["crm", "etapas", "all"],
      },
    },
  },
}));

import { useActualizarEtapa } from "../useEtapasPipeline";

function spyClient() {
  const client = (globalThis as unknown as {
    __TEST_QUERY_CLIENT__: { invalidateQueries: (args: unknown) => unknown };
  }).__TEST_QUERY_CLIENT__;
  return vi.spyOn(client, "invalidateQueries");
}

const keys = (spy: ReturnType<typeof spyClient>) =>
  spy.mock.calls.map((args) => (args[0] as { queryKey: unknown }).queryKey);

describe("invalidación de etapas en useActualizarEtapa", () => {
  beforeEach(() => {
    actualizarEtapa.mockReset().mockResolvedValue({ id: "etapa-1" });
  });

  it("invalida etapas activas y la lista completa del editor", async () => {
    const { result } = renderHook(() => useActualizarEtapa(), {
      wrapper: createWrapper(),
    });
    const spy = spyClient();

    result.current.mutate({
      id: "etapa-1",
      nombre: "Cotizando",
      orden: 2,
    } as never);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const invalidated = keys(spy);
    expect(invalidated).toContainEqual(["crm", "etapas"]);
    expect(invalidated).toContainEqual(["crm", "etapas", "all"]);
  });
});
