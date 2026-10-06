import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider, QueryObserver, type QueryKey } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { crmPricingKeys as keys } from "@/features/crm/queryKeys.performance";
import { OPCION_VACIA, type SolicitudPricingInsert } from "@/features/crm/services/pricing/tiposPricing";

const services = vi.hoisted(() => ({
  actualizarSolicitud: vi.fn(), cancelarSolicitud: vi.fn(), crearSolicitud: vi.fn(),
  eliminarOpcion: vi.fn(), enviarSolicitud: vi.fn(), guardarOpcion: vi.fn(),
  listarBandejaPricing: vi.fn(), listarOpciones: vi.fn(), listarSolicitudesOportunidad: vi.fn(),
  listarUsuariosOrg: vi.fn(), obtenerSolicitud: vi.fn(), responderSolicitud: vi.fn(),
}));
vi.mock("@/features/crm/services/pricing/pricingCrm", () => services);
vi.mock("@/features/crm/services/pricing/tarifasParaPricing", () => ({ listarTarifasParaPricing: vi.fn() }));
vi.mock("@/lib/ui/appFeedback", () => ({ notifySuccess: vi.fn(), notifyError: vi.fn() }));
import { useGuardarSolicitud, useAccionSolicitud, useGuardarOpcion, useEliminarOpcion } from "../usePricingCrm";

const datos: SolicitudPricingInsert = { folio: "", organization_id: "org1", oportunidad_id: "o1", solicitante_id: "u1" };
let client: QueryClient;
let subscriptions: (() => void)[];
const Wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
function observe(queryKey: QueryKey) {
  const read = vi.fn().mockResolvedValue([]);
  const observer = new QueryObserver(client, { queryKey, queryFn: read, initialData: [] });
  subscriptions.push(observer.subscribe(() => undefined));
  return read;
}
function activeQueries() {
  return {
    solicitud: observe(keys.solicitud("s1")), oportunidad: observe(keys.oportunidad("o1")),
    bandeja: observe(keys.bandeja("enviada", 0)), otraPagina: observe(keys.bandeja("respondida", 1)),
    opciones: observe(keys.opciones("s1")), respuestas: observe(keys.tarifasRespuesta("s1")),
    otraSolicitud: observe(keys.solicitud("s2")), otraOportunidad: observe(keys.oportunidad("o2")),
    otrasOpciones: observe(keys.opciones("s2")), otrasRespuestas: observe(keys.tarifasRespuesta("s2")),
    usuarios: observe(keys.usuarios), tarifas: observe(keys.tarifas),
    adjuntos: observe(["crm", "pricing", "adjuntos", "s2"]),
  };
}
function expectReads(reads: ReturnType<typeof activeQueries>, refreshed: (keyof typeof reads)[]) {
  for (const [name, read] of Object.entries(reads)) {
    expect(read, name).toHaveBeenCalledTimes(refreshed.includes(name as keyof typeof reads) ? 1 : 0);
  }
}
beforeEach(() => {
  for (const fn of Object.values(services)) fn.mockReset().mockResolvedValue(undefined);
  services.crearSolicitud.mockResolvedValue({ id: "s1" });
  client = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity, retry: false, gcTime: Infinity }, mutations: { retry: false } } });
  subscriptions = [];
});
afterEach(() => { cleanup(); subscriptions.forEach((stop) => stop()); client.clear(); });

describe("invalidación acotada de Pricing", () => {
  it.each([false, true])("guardar solicitud (enviar=%s) sólo refresca su detalle, oportunidad y bandejas", async (enviar) => {
    const reads = activeQueries();
    const { result } = renderHook(useGuardarSolicitud, { wrapper: Wrapper });
    await act(() => result.current.mutateAsync({ datos, enviar }));
    expectReads(reads, ["solicitud", "oportunidad", "bandeja", "otraPagina"]);
    expect(services.enviarSolicitud).toHaveBeenCalledTimes(enviar ? 1 : 0);
  });

  it("si se guardó el borrador pero falló enviar, refresca lo persistido y conserva el error", async () => {
    const reads = activeQueries();
    services.enviarSolicitud.mockRejectedValue(new Error("LC_PRICING_INCOMPLETA"));
    const { result } = renderHook(useGuardarSolicitud, { wrapper: Wrapper });
    await act(async () => {
      await expect(result.current.mutateAsync({ id: "s1", datos, enviar: true })).rejects.toThrow("LC_PRICING_INCOMPLETA");
    });
    expect(services.actualizarSolicitud).toHaveBeenCalledWith("s1", datos);
    expectReads(reads, ["solicitud", "oportunidad", "bandeja", "otraPagina"]);
    await waitFor(() => expect(result.current.isError).toBe(true));
  });

  it.each(["enviar", "responder", "cancelar"] as const)("%s refresca también la respuesta final, sin usuarios ni catálogos", async (accion) => {
    const reads = activeQueries();
    const { result } = renderHook(useAccionSolicitud, { wrapper: Wrapper });
    await act(() => result.current.mutateAsync({ id: "s1", oportunidadId: "o1", accion }));
    expectReads(reads, ["solicitud", "oportunidad", "bandeja", "otraPagina", "opciones", "respuestas"]);
  });

  it("guardar opción hace una sola lectura y no refresca solicitudes ni catálogos", async () => {
    const reads = activeQueries();
    const { result } = renderHook(useGuardarOpcion, { wrapper: Wrapper });
    await act(() => result.current.mutateAsync({ solicitudId: "s1", organizationId: "org1", orden: 1, datos: OPCION_VACIA }));
    expect(services.guardarOpcion).toHaveBeenCalledWith({
      solicitudId: "s1", organizationId: "org1", orden: 1, datos: OPCION_VACIA,
    }, expect.anything());
    expectReads(reads, ["opciones"]);
  });

  it("eliminar opción sólo relee las opciones de esa solicitud", async () => {
    const reads = activeQueries();
    const { result } = renderHook(useEliminarOpcion, { wrapper: Wrapper });
    await act(() => result.current.mutateAsync({ id: "op1", solicitudId: "s1" }));
    expect(services.eliminarOpcion).toHaveBeenCalledWith("op1");
    expectReads(reads, ["opciones"]);
  });

  it("el callback de guardado puede subir adjuntos sin esperar un refetch lento o fallido", async () => {
    let failRefresh!: (error: Error) => void;
    const refresh = new Promise<never>((_resolve, reject) => { failRefresh = reject; });
    const read = vi.fn(() => refresh);
    const observer = new QueryObserver(client, {
      queryKey: keys.oportunidad("o1"), queryFn: read, initialData: [],
    });
    subscriptions.push(observer.subscribe(() => undefined));
    const subirAdjuntos = vi.fn();
    const { result } = renderHook(useGuardarSolicitud, { wrapper: Wrapper });
    act(() => result.current.mutate({ datos, enviar: false }, { onSuccess: subirAdjuntos }));
    await waitFor(() => expect(subirAdjuntos).toHaveBeenCalledTimes(1));
    expect(read).toHaveBeenCalledTimes(1);
    expect(observer.getCurrentResult().isFetching).toBe(true);
    await act(async () => { failRefresh(new Error("falló refrescar la oportunidad")); });
    await waitFor(() => expect(observer.getCurrentResult().isError).toBe(true));
    expect(subirAdjuntos).toHaveBeenCalledWith("s1", expect.anything(), undefined, expect.anything());
    expect(result.current.isSuccess).toBe(true);
  });

  it("una escritura rechazada no dispara lecturas", async () => {
    const reads = activeQueries();
    services.crearSolicitud.mockRejectedValue(new Error("LC_PRICING_SIN_PERMISO"));
    const { result } = renderHook(useGuardarSolicitud, { wrapper: Wrapper });
    await act(async () => { await expect(result.current.mutateAsync({ datos, enviar: true })).rejects.toThrow("LC_PRICING_SIN_PERMISO"); });
    expectReads(reads, []);
    expect(services.enviarSolicitud).not.toHaveBeenCalled();
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
