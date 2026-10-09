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
import { ErrorEnvioSolicitudPricing, useGuardarSolicitud, useAccionSolicitud, useGuardarOpcion, useEliminarOpcion } from "../usePricingCrm";
import { notifyError, notifySuccess } from "@/lib/ui/appFeedback";
import { setAuthSnapshot } from "@/lib/auth/authSnapshot";
import { AuthOperationChangedError, syncActiveOrganizationScope } from "@/lib/auth/authOperationScope";
import { purgeSessionCache } from "@/lib/auth/purgeSessionCache";

const datos: SolicitudPricingInsert = { folio: "", organization_id: "org1", oportunidad_id: "o1", solicitante_id: "u1" };
const auth = { userId: "u1", email: null, organizationId: "org1", organizationName: null, role: "operador", effectiveRole: "operador" };
function diferido<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((si, no) => { resolve = si; reject = no; });
  return { promise, resolve, reject };
}
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
  setAuthSnapshot(auth);
  vi.mocked(notifyError).mockClear(); vi.mocked(notifySuccess).mockClear();
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
    expect(result.current.error).toBeInstanceOf(ErrorEnvioSolicitudPricing);
    expect(result.current.error).toMatchObject({ solicitudId: "s1" });
  });

  it("un alta seguida de fallo de envío conserva ID, fila y caché aun sin refetch", async () => {
    const creada = { ...datos, id: "s1", folio: "SP1", estado: "borrador" };
    const existente = { id: "s2", folio: "SP2", estado: "borrador" };
    const errorEnvio = { message: "LC_PRICING_INCOMPLETA" };
    client.setQueryData(keys.oportunidad("o1"), [existente]);
    services.crearSolicitud.mockResolvedValue(creada);
    services.enviarSolicitud.mockRejectedValue(errorEnvio);
    const invalidar = vi.spyOn(client, "invalidateQueries");
    const { result } = renderHook(useGuardarSolicitud, { wrapper: Wrapper });
    await act(async () => {
      await expect(result.current.mutateAsync({ datos, enviar: true })).rejects.toMatchObject({
        solicitudId: "s1", errorEnvio,
      });
    });
    expect(services.crearSolicitud).toHaveBeenCalledTimes(1);
    expect(services.enviarSolicitud).toHaveBeenCalledWith("s1");
    expect(client.getQueryData(keys.solicitud("s1"))).toEqual(creada);
    expect(client.getQueryData(keys.oportunidad("o1"))).toEqual([creada, existente]);
    expect(invalidar.mock.calls).toEqual([
      [{ queryKey: keys.solicitud("s1"), exact: true }],
      [{ queryKey: keys.bandejas }],
      [{ queryKey: keys.oportunidad("o1"), exact: true }],
    ]);
    expect(notifySuccess).not.toHaveBeenCalled();
    expect(notifyError).toHaveBeenCalledWith(undefined, expect.objectContaining({
      title: "Solicitud guardada; envío sin confirmar", error: errorEnvio,
      description: "Falta el servicio, el origen o el destino.",
    }));
  });

  it("no repite automáticamente un alta parcial aunque el cliente configure retries", async () => {
    client.setDefaultOptions({ mutations: { retry: 2, retryDelay: 0 } });
    services.enviarSolicitud.mockRejectedValue(new Error("falló el envío"));
    const { result } = renderHook(useGuardarSolicitud, { wrapper: Wrapper });
    await act(async () => {
      await expect(result.current.mutateAsync({ datos, enviar: true })).rejects.toBeInstanceOf(ErrorEnvioSolicitudPricing);
    });
    expect(services.crearSolicitud).toHaveBeenCalledTimes(1);
    expect(services.enviarSolicitud).toHaveBeenCalledTimes(1);
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

describe("vigencia de la mutación de Pricing después de limpiar sesión", () => {
  it.each(["organización", "usuario", "purga", "tenant", "limpieza directa"])("INSERT tardío no repuebla caché ni envía después de cambiar %s", async (cambio) => {
    if (cambio === "tenant") {
      setAuthSnapshot({ ...auth, organizationId: null, role: "super_admin", effectiveRole: "super_admin" });
      syncActiveOrganizationScope({ userId: "u1", organizationId: "org1" });
    }
    const insert = diferido<{ id: string }>();
    services.crearSolicitud.mockReturnValueOnce(insert.promise);
    client.setQueryData(keys.oportunidad("o1"), []);
    const invalidar = vi.spyOn(client, "invalidateQueries");
    const { result } = renderHook(useGuardarSolicitud, { wrapper: Wrapper });
    let completada!: Promise<unknown>;
    const callbacks = { onSuccess: vi.fn(), onError: vi.fn(), onSettled: vi.fn() };
    act(() => { completada = result.current.mutateAsync({ datos, enviar: true }, callbacks).catch((error: unknown) => error); });
    await waitFor(() => expect(services.crearSolicitud).toHaveBeenCalledTimes(1));
    if (cambio === "organización") setAuthSnapshot({ ...auth, organizationId: "org2" });
    if (cambio === "usuario") setAuthSnapshot({ ...auth, userId: "u2" });
    if (cambio === "tenant") syncActiveOrganizationScope({ userId: "u1", organizationId: "org2" });
    if (cambio === "limpieza directa") client.clear(); else purgeSessionCache(client);
    const nueva = { id: "s2", organization_id: "org2" };
    client.setQueryData(keys.solicitud("s2"), nueva);
    await act(async () => { insert.resolve({ id: "s1" }); expect(await completada).toBeInstanceOf(AuthOperationChangedError); });
    expect(client.getQueryData(keys.solicitud("s1"))).toBeUndefined();
    expect(client.getQueryData(keys.oportunidad("o1"))).toBeUndefined();
    expect(client.getQueryData(keys.solicitud("s2"))).toEqual(nueva);
    expect(services.enviarSolicitud).not.toHaveBeenCalled();
    expect(invalidar).not.toHaveBeenCalled();
    expect(notifySuccess).not.toHaveBeenCalled(); expect(notifyError).not.toHaveBeenCalled();
    for (const callback of Object.values(callbacks)) expect(callback).not.toHaveBeenCalled();
  });

  it.each([true, false])("respuesta de envío tardía no invalida ni avisa en la sesión nueva (fallo=%s)", async (falla) => {
    const envio = diferido<void>();
    services.enviarSolicitud.mockReturnValueOnce(envio.promise);
    const invalidar = vi.spyOn(client, "invalidateQueries");
    const { result } = renderHook(useGuardarSolicitud, { wrapper: Wrapper });
    let completada!: Promise<unknown>;
    act(() => { completada = result.current.mutateAsync({ id: "s1", datos, enviar: true }).catch((error: unknown) => error); });
    await waitFor(() => expect(services.enviarSolicitud).toHaveBeenCalledTimes(1));
    setAuthSnapshot({ ...auth, userId: "u2" }); purgeSessionCache(client);
    await act(async () => {
      if (falla) envio.reject(new Error("falló enviar")); else envio.resolve();
      expect(await completada).toBeInstanceOf(AuthOperationChangedError);
    });
    expect(client.getQueryCache().getAll()).toHaveLength(0);
    expect(invalidar).not.toHaveBeenCalled();
    expect(notifySuccess).not.toHaveBeenCalled(); expect(notifyError).not.toHaveBeenCalled();
  });

  it("revalida antes de la segunda escritura si una suscripción purga durante la primera", async () => {
    const nueva = [{ id: "s2", organization_id: "org2" }];
    let purgada = false;
    const unsubscribe = client.getQueryCache().subscribe((event) => {
      if (event.type === "updated" && event.query.queryKey.join("/") === keys.solicitud("s1").join("/") && !purgada) {
        purgada = true; purgeSessionCache(client);
        client.setQueryData(keys.oportunidad("o1"), nueva);
      }
    });
    subscriptions.push(unsubscribe);
    const invalidar = vi.spyOn(client, "invalidateQueries");
    const { result } = renderHook(useGuardarSolicitud, { wrapper: Wrapper });
    await act(async () => {
      await expect(result.current.mutateAsync({ datos, enviar: true })).rejects.toBeInstanceOf(AuthOperationChangedError);
    });
    expect(purgada).toBe(true);
    expect(client.getQueryData(keys.oportunidad("o1"))).toEqual(nueva);
    expect(client.getQueryData(keys.solicitud("s1"))).toBeUndefined();
    expect(services.enviarSolicitud).not.toHaveBeenCalled(); expect(invalidar).not.toHaveBeenCalled();
    expect(notifySuccess).not.toHaveBeenCalled(); expect(notifyError).not.toHaveBeenCalled();
  });

  it("detiene las invalidaciones restantes y callbacks si la primera invalida la sesión", async () => {
    const invalidar = vi.spyOn(client, "invalidateQueries").mockImplementationOnce(async () => { purgeSessionCache(client); });
    const callbacks = { onSuccess: vi.fn(), onError: vi.fn(), onSettled: vi.fn() };
    const { result } = renderHook(useGuardarSolicitud, { wrapper: Wrapper });
    await act(async () => {
      await expect(result.current.mutateAsync({ datos, enviar: false }, callbacks)).rejects.toBeInstanceOf(AuthOperationChangedError);
    });
    expect(invalidar).toHaveBeenCalledTimes(1);
    expect(client.getQueryCache().getAll()).toHaveLength(0);
    expect(notifySuccess).not.toHaveBeenCalled(); expect(notifyError).not.toHaveBeenCalled();
    for (const callback of Object.values(callbacks)) expect(callback).not.toHaveBeenCalled();
  });
});
