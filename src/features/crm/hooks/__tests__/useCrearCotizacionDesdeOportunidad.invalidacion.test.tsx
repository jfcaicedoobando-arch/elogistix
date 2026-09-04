/**
 * Regresión — crear cotización desde oportunidad debe invalidar
 * `crm.dashboardAll` y `crm.cotizacionesSinRespuesta` para que el resumen
 * ejecutivo y "Cotizaciones sin respuesta" no queden stale tras mover la
 * etapa mediante el servicio directo.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { createWrapper } from "@/test/utils/queryWrapper";

const insertCotizacionDesdeOportunidad = vi.hoisted(() => vi.fn());
const actualizarEtapaOportunidad = vi.hoisted(() => vi.fn());
const generarFolioCotizacion = vi.hoisted(() => vi.fn());

vi.mock("@/features/crm/services", () => ({
  insertCotizacionDesdeOportunidad,
  actualizarEtapaOportunidad,
}));

vi.mock("@/features/cotizacion/services/queries", () => ({
  generarFolioCotizacion,
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
      oportunidades: { all: ["crm", "oportunidades"] },
      opCotizaciones: { all: ["crm", "op-cotizaciones"] },
      dashboardAll: ["crm", "dashboard"],
      cotizacionesSinRespuesta: (dias: number, limit: number, uid?: string) =>
        ["crm", "cotizaciones-sin-respuesta", dias, limit, uid],
    },
  },
}));

import { useCrearCotizacionDesdeOportunidad } from "../useCrearCotizacionDesdeOportunidad";

function spyClient() {
  const client = (globalThis as unknown as {
    __TEST_QUERY_CLIENT__: { invalidateQueries: (args: unknown) => unknown };
  }).__TEST_QUERY_CLIENT__;
  return vi.spyOn(client, "invalidateQueries");
}

const keys = (spy: ReturnType<typeof spyClient>) =>
  spy.mock.calls.map((args) => (args[0] as { queryKey: unknown }).queryKey);

const baseInput = {
  oportunidad: {
    id: "op-1",
    cliente_id: null,
    cliente_nombre: null,
    origen: "Shanghai",
    destino: "Manzanillo",
    etapa_id: "etapa-1",
    modo: "Marítimo",
  },
  etapaCotizandoId: "etapa-cotizando",
  etapaCotizandoProbabilidad: 50,
};

describe("invalidación de dashboard al crear cotización desde oportunidad", () => {
  beforeEach(() => {
    generarFolioCotizacion.mockReset().mockResolvedValue("COT-2026-0001");
    insertCotizacionDesdeOportunidad.mockReset().mockResolvedValue({
      id: "cot-1",
      folio: "COT-2026-0001",
      reutilizada: false,
    });
    actualizarEtapaOportunidad.mockReset().mockResolvedValue(undefined);
  });

  it("invalida oportunidades, op-cotizaciones, dashboard y cotizaciones sin respuesta", async () => {
    const { result } = renderHook(() => useCrearCotizacionDesdeOportunidad(), {
      wrapper: createWrapper(),
    });
    const spy = spyClient();

    result.current.mutate(baseInput as never);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const invalidated = keys(spy);
    expect(invalidated).toContainEqual(["crm", "oportunidades"]);
    expect(invalidated).toContainEqual(["crm", "op-cotizaciones"]);
    expect(invalidated).toContainEqual(["crm", "dashboard"]);
    expect(invalidated).toContainEqual([
      "crm",
      "cotizaciones-sin-respuesta",
      5,
      10,
      "user-1",
    ]);
  });

  it("mantiene la protección contra duplicados cuando falla mover la etapa", async () => {
    actualizarEtapaOportunidad.mockRejectedValue(new Error("timeout"));
    const { result } = renderHook(() => useCrearCotizacionDesdeOportunidad(), {
      wrapper: createWrapper(),
    });

    result.current.mutate(baseInput as never);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual({
      id: "cot-1",
      folio: "COT-2026-0001",
      reutilizada: false,
      avisoEtapa: "timeout",
    });
  });
});
