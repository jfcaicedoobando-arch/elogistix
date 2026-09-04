import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { createWrapper } from "@/test/utils/queryWrapper";

const convertirLead = vi.hoisted(() => vi.fn());

vi.mock("@/features/crm/services/leads", () => ({
  convertirLead,
}));

vi.mock("@/lib/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { id: "user-1" } }),
}));

vi.mock("@/lib/query", () => ({
  queryKeys: {
    crm: {
      leads: { all: ["crm", "leads"] },
      prospectos: { all: ["crm", "prospectos"] },
      kpis: ["crm", "kpis"],
      oportunidades: { all: ["crm", "oportunidades"] },
      dashboardAll: ["crm", "dashboard"],
    },
    clientes: { all: ["clientes"] },
  },
}));

import { useConvertirLead } from "../leads/convertir";
import type { ConvertirLeadParams } from "@/features/crm/services/leads";

const params = {
  lead: { id: "l1" },
  crearCliente: true,
  nombreOportunidad: "Op 1",
  montoEstimado: 1000,
  moneda: "MXN",
} as unknown as ConvertirLeadParams;

describe("useConvertirLead", () => {
  beforeEach(() => {
    convertirLead.mockReset();
  });

  it("invalida leads, oportunidades, dashboard y clientes al convertir", async () => {
    convertirLead.mockResolvedValueOnce({ cliente_id: "c1", oportunidad_id: "o1" });
    const { result } = renderHook(() => useConvertirLead(), { wrapper: createWrapper() });
    const client = (globalThis as unknown as {
      __TEST_QUERY_CLIENT__: { invalidateQueries: (args: unknown) => unknown };
    }).__TEST_QUERY_CLIENT__;
    const invalidateSpy = vi.spyOn(client, "invalidateQueries");

    result.current.mutate(params);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const invalidated = invalidateSpy.mock.calls.map(
      (args) => (args[0] as { queryKey: unknown }).queryKey,
    );
    expect(invalidated).toContainEqual(["crm", "leads"]);
    expect(invalidated).toContainEqual(["crm", "prospectos"]);
    expect(invalidated).toContainEqual(["crm", "kpis"]);
    expect(invalidated).toContainEqual(["clientes"]);
    // Regresión: la conversión crea una oportunidad — antes no se invalidaba
    // y el kanban no la mostraba hasta vencer el staleTime.
    expect(invalidated).toContainEqual(["crm", "oportunidades"]);
    expect(invalidated).toContainEqual(["crm", "dashboard"]);
  });

  it("propaga el error del servicio", async () => {
    convertirLead.mockRejectedValueOnce(new Error("lead ya convertido"));
    const { result } = renderHook(() => useConvertirLead(), { wrapper: createWrapper() });
    result.current.mutate(params);
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBeInstanceOf(Error);
  });
});
