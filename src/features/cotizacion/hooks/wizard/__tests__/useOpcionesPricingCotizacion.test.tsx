import { cleanup, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cotizaciones } from "@/features/cotizacion/queryKeys";
import { useOpcionesPricingCotizacion } from "../useOpcionesPricingCotizacion";

const fetchOpciones = vi.hoisted(() => vi.fn());
vi.mock("@/features/cotizacion/services/opcionesPricingCotizacion", () => ({
  fetchOpcionesPricingCotizacion: fetchOpciones,
}));
let client: QueryClient;
beforeEach(() => {
  vi.clearAllMocks();
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  fetchOpciones.mockResolvedValue([]);
});
afterEach(() => { cleanup(); client.clear(); });
const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={client}>{children}</QueryClientProvider>
);

describe("useOpcionesPricingCotizacion", () => {
  it("no consulta sin oportunidad ni cliente", () => {
    const { result } = renderHook(() => useOpcionesPricingCotizacion({}), { wrapper });
    expect(result.current.fetchStatus).toBe("idle");
    expect(fetchOpciones).not.toHaveBeenCalled();
  });
  it.each([
    { oportunidadId: "opp-1" },
    { clienteId: "cli-1" },
    { oportunidadId: "opp-1", clienteId: "cli-1" },
  ])("conserva los filtros y la clave para %o", async (filtro) => {
    const { result } = renderHook(() => useOpcionesPricingCotizacion(filtro), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(fetchOpciones).toHaveBeenCalledWith({ oportunidadId: undefined, clienteId: undefined, ...filtro });
    expect(client.getQueryData(cotizaciones.opcionesPricing(filtro.oportunidadId, filtro.clienteId))).toEqual([]);
  });
  it("preserva exactamente ambas claves históricas", () => {
    expect(cotizaciones.opcionesPricing()).toEqual(["cotizacion", "opciones-pricing", null, null]);
    expect(cotizaciones.opcionesPricing("opp-1", "cli-1")).toEqual(["cotizacion", "opciones-pricing", "opp-1", "cli-1"]);
    expect(cotizaciones.prefillTarifaPricing(null)).toEqual(["cotizacion", "prefill-tarifa-pricing", null]);
    expect(cotizaciones.prefillTarifaPricing("t1")).toEqual(["cotizacion", "prefill-tarifa-pricing", "t1"]);
  });
});
