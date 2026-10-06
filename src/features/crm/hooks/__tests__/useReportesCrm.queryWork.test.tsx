import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider, QueryObserver, type QueryKey } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { crmReportesKeys as keys } from "@/features/crm/queryKeys.performance";
import type { ReporteInput } from "@/features/crm/services/reportes/reportesCrm";

const services = vi.hoisted(() => ({
  crearTablero: vi.fn(), renombrarTablero: vi.fn(), eliminarTablero: vi.fn(),
  crearReporte: vi.fn(), actualizarReporte: vi.fn(), eliminarReporte: vi.fn(),
  listTableros: vi.fn(), listReportes: vi.fn(), fetchReporteDatos: vi.fn(),
}));
vi.mock("@/features/crm/services/reportes/reportesCrm", () => services);
vi.mock("@/lib/ui/appFeedback", () => ({ notifySuccess: vi.fn(), notifyError: vi.fn() }));
import {
  useCrearTablero, useRenombrarTablero, useEliminarTablero,
  useGuardarReporte, useEliminarReporte,
} from "../useReportesCrm";

const input: ReporteInput = {
  nombre: "Reporte", objeto: "oportunidad", medida: "conteo", agrupacion: "etapa",
  tipoGrafica: "barras", filtro: {},
};
let client: QueryClient;
let subscriptions: (() => void)[];
const Wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;

/** Un observador real: cada llamada a read representa una lectura tras invalidar. */
function observe<T>(queryKey: QueryKey, data: T) {
  const read = vi.fn((): Promise<T> => new Promise((resolve) => resolve(data)));
  const observer = new QueryObserver(client, { queryKey, queryFn: read, initialData: data });
  subscriptions.push(observer.subscribe(() => undefined));
  return { read, observer };
}

beforeEach(() => {
  vi.clearAllMocks();
  for (const fn of Object.values(services)) fn.mockReset().mockResolvedValue(undefined);
  client = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity, retry: false, gcTime: Infinity }, mutations: { retry: false } } });
  subscriptions = [];
});
afterEach(() => { cleanup(); subscriptions.forEach((stop) => stop()); client.clear(); });

describe("trabajo de consultas de reportes CRM", () => {
  it.each([1, 6, 20])("crear/renombrar tablero con %i reportes no recalcula agregados", async (count) => {
    const tableros = observe(keys.tableros, [{ id: "t1" }]);
    const lista = observe(keys.lista("t1"), Array.from({ length: count }, (_, i) => ({ id: `r${i}` })));
    const datos = Array.from({ length: count }, (_, i) => observe(keys.datos(`r${i}`), [{ etiqueta: "A", valor: i }]));
    const { result } = renderHook(() => ({ crear: useCrearTablero(), renombrar: useRenombrarTablero() }), { wrapper: Wrapper });

    await act(() => result.current.crear.mutateAsync("Nuevo"));
    await act(() => result.current.renombrar.mutateAsync({ id: "t1", nombre: "Renombrado" }));

    expect(tableros.read).toHaveBeenCalledTimes(2);
    expect(lista.read).not.toHaveBeenCalled();
    expect(datos.reduce((sum, q) => sum + q.read.mock.calls.length, 0)).toBe(0);
  });

  it("guardar filtro refresca una lista y un agregado, sin tocar los demás", async () => {
    const lista = observe(keys.lista("t1"), [{ id: "r1" }, { id: "r2" }]);
    const otraLista = observe(keys.lista("t2"), [{ id: "r3" }]);
    const datos = observe(keys.datos("r1"), [{ etiqueta: "Antes", valor: 1 }]);
    const otrosDatos = observe(keys.datos("r2"), []);
    const tableros = observe(keys.tableros, []);
    datos.read.mockResolvedValue([{ etiqueta: "Después", valor: 2 }]);
    const { result } = renderHook(useGuardarReporte, { wrapper: Wrapper });

    await act(() => result.current.mutateAsync({ id: "r1", tableroId: "t1", input }));

    expect(lista.read).toHaveBeenCalledTimes(1);
    expect(datos.read).toHaveBeenCalledTimes(1);
    expect(client.getQueryData(keys.datos("r1"))).toEqual([{ etiqueta: "Después", valor: 2 }]);
    for (const q of [otraLista, otrosDatos, tableros]) expect(q.read).not.toHaveBeenCalled();
  });

  it("crear reporte sólo refresca las definiciones del tablero", async () => {
    const lista = observe(keys.lista("t1"), []);
    const datos = observe(keys.datos("r1"), []);
    const { result } = renderHook(useGuardarReporte, { wrapper: Wrapper });
    await act(() => result.current.mutateAsync({ tableroId: "t1", input }));
    expect(services.crearReporte).toHaveBeenCalledWith("t1", input);
    expect(lista.read).toHaveBeenCalledTimes(1);
    expect(datos.read).not.toHaveBeenCalled();
  });

  it("borrar reporte elimina su caché y refresca sólo su lista", async () => {
    const lista = observe(keys.lista("t1"), [{ id: "r1" }, { id: "r2" }]);
    lista.read.mockResolvedValue([{ id: "r2" }]);
    const otraLista = observe(keys.lista("t2"), [{ id: "r3" }]);
    const datos = observe(keys.datos("r1"), [{ etiqueta: "A", valor: 1 }]);
    const otrosDatos = observe(keys.datos("r2"), []);
    const { result } = renderHook(useEliminarReporte, { wrapper: Wrapper });
    await act(() => result.current.mutateAsync("r1"));
    expect(client.getQueryData(keys.datos("r1"))).toBeUndefined();
    expect(client.getQueryData(keys.lista("t1"))).toEqual([{ id: "r2" }]);
    expect(lista.read).toHaveBeenCalledTimes(1);
    for (const q of [otraLista, datos, otrosDatos]) expect(q.read).not.toHaveBeenCalled();
  });

  it("borrar tablero retira sus definiciones/resultados sin recalcular otros tableros", async () => {
    const tableros = observe(keys.tableros, [{ id: "t1" }, { id: "t2" }]);
    const lista = observe(keys.lista("t1"), [{ id: "r1" }]);
    const datos = observe(keys.datos("r1"), []);
    const otros = observe(keys.datos("r2"), [{ etiqueta: "Otro", valor: 3 }]);
    const { result } = renderHook(useEliminarTablero, { wrapper: Wrapper });
    await act(() => result.current.mutateAsync("t1"));
    expect(client.getQueryData(keys.lista("t1"))).toBeUndefined();
    expect(client.getQueryData(keys.datos("r1"))).toBeUndefined();
    expect(client.getQueryData(keys.datos("r2"))).toEqual([{ etiqueta: "Otro", valor: 3 }]);
    expect(tableros.read).toHaveBeenCalledTimes(1);
    for (const q of [lista, datos, otros]) expect(q.read).not.toHaveBeenCalled();
  });

  it("un error de escritura no invalida ni elimina la caché", async () => {
    const datos = observe(keys.datos("r1"), []);
    services.eliminarReporte.mockRejectedValue(new Error("sin permiso"));
    const { result } = renderHook(useEliminarReporte, { wrapper: Wrapper });
    await act(async () => { await expect(result.current.mutateAsync("r1")).rejects.toThrow("sin permiso"); });
    expect(client.getQueryData(keys.datos("r1"))).toEqual([]);
    expect(datos.read).not.toHaveBeenCalled();
    await waitFor(() => expect(result.current.isError).toBe(true));
  });

  it("un refetch fallido conserva estado de error y los datos previos", async () => {
    const datos = observe(keys.datos("r1"), [{ etiqueta: "A", valor: 1 }]);
    datos.read.mockRejectedValue(new Error("falló lectura"));
    const { result } = renderHook(useGuardarReporte, { wrapper: Wrapper });
    await act(() => result.current.mutateAsync({ id: "r1", tableroId: "t1", input }));
    expect(datos.observer.getCurrentResult().isError).toBe(true);
    expect(datos.observer.getCurrentResult().data).toEqual([{ etiqueta: "A", valor: 1 }]);
  });
});
