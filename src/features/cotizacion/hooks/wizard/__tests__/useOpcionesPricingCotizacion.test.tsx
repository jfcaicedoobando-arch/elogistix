import { setAuthSnapshot } from "@/lib/auth/authSnapshot";
import { syncActiveOrganizationScope, captureAuthDataScope } from "@/lib/auth/authOperationScope";
function sesion(organizationId = "org", userId = "usuario") {
  setAuthSnapshot({ userId, organizationId, email: null, organizationName: null, role: "admin", effectiveRole: "admin" });
  syncActiveOrganizationScope({ organizationId, userId });
}
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
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
  sesion();
  vi.clearAllMocks();
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  fetchOpciones.mockResolvedValue([]);
});
afterEach(() => { cleanup(); client.clear(); });
const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={client}>{children}</QueryClientProvider>
);

describe("useOpcionesPricingCotizacion", () => {
  it("no reutiliza resultados ni promesas del tenant anterior con filtros idénticos", async () => {
    let resolver!: (value: { organizationId: string }[]) => void;
    fetchOpciones.mockImplementation(({ organizationId }) => organizationId === "org"
      ? new Promise((r) => { resolver = r; }) : Promise.resolve([{ organizationId }]));
    const { result } = renderHook(() => useOpcionesPricingCotizacion({ clienteId: "cliente" }), { wrapper });
    act(() => sesion("org-2"));
    await waitFor(() => expect(result.current.data).toEqual([{ organizationId: "org-2" }]));
    await act(async () => resolver([{ organizationId: "org" }]));
    expect(result.current.data).toEqual([{ organizationId: "org-2" }]);
    expect(fetchOpciones).toHaveBeenCalledWith({ organizationId: "org-2", clienteId: "cliente", oportunidadId: undefined });
  });
  it("sin sesión no consulta aun si el filtro conserva IDs", () => {
    setAuthSnapshot({ userId: null, organizationId: null, email: null, organizationName: null, role: null, effectiveRole: null });
    const { result } = renderHook(() => useOpcionesPricingCotizacion({ clienteId: "cliente" }), { wrapper });
    expect(result.current.fetchStatus).toBe("idle"); expect(fetchOpciones).not.toHaveBeenCalled();
  });

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
    expect(fetchOpciones).toHaveBeenCalledWith({ organizationId: "org", oportunidadId: undefined, clienteId: undefined, ...filtro });
    expect(client.getQueryData(cotizaciones.opcionesPricing(captureAuthDataScope(), filtro.oportunidadId, filtro.clienteId))).toEqual([]);
  });
  it("separa opciones por usuario, organización y generación", () => {
    const scope = captureAuthDataScope();
    expect(cotizaciones.opcionesPricing(scope)).toEqual(["cotizacion", "opciones-pricing", "org", "usuario", scope.generation, null, null]);
    expect(cotizaciones.opcionesPricing(scope, "opp-1", "cli-1")).toEqual(["cotizacion", "opciones-pricing", "org", "usuario", scope.generation, "opp-1", "cli-1"]);
    expect(cotizaciones.prefillTarifaPricing(null)).toEqual(["cotizacion", "prefill-tarifa-pricing", null]);
    expect(cotizaciones.prefillTarifaPricing("t1")).toEqual(["cotizacion", "prefill-tarifa-pricing", "t1"]);
  });
});
