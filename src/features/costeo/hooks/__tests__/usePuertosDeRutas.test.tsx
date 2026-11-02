import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { usePuertosDeRutas } from "../usePuertosDeRutas";
import type { RutaPuertos } from "../../utils/puertosDeRutas";

type Puerto = { id: string; code: string; name: string; country: string };
const queries = vi.hoisted(() => ({
  rutas: {
    data: undefined as RutaPuertos[] | undefined,
    isLoading: false, isEnabled: true, isError: false, isFetching: false,
    refetch: vi.fn(),
  },
  puertos: {
    data: undefined as Puerto[] | undefined,
    isLoading: false, isEnabled: true, isError: false, isFetching: false,
    refetch: vi.fn(),
  },
}));

vi.mock("@/features/costeo/hooks/useCosteoRutas", () => ({
  useCosteoRutas: () => queries.rutas,
}));
vi.mock("@/features/catalogos/hooks", () => ({
  usePuertos: () => queries.puertos,
}));

const puerto = (id: string): Puerto => ({ id, code: id, name: id, country: "MX" });
const catalogo = () => [puerto("VER"), puerto("SHA"), puerto("LZC"), puerto("MZT"), puerto("NGB")];
const fuentes = ["rutas", "puertos"] as const;

function datosDisponibles() {
  queries.rutas.data = [{ puerto_origen_id: "SHA", puerto_destino_id: "MZT", activa: true }];
  queries.puertos.data = catalogo();
}

beforeEach(() => {
  Object.assign(queries.rutas, {
    data: [], isLoading: false, isEnabled: true, isError: false, isFetching: false,
  });
  Object.assign(queries.puertos, {
    data: catalogo(), isLoading: false, isEnabled: true, isError: false, isFetching: false,
  });
  for (const fuente of fuentes) queries[fuente].refetch.mockReset().mockResolvedValue(undefined);
});

describe("usePuertosDeRutas", () => {
  it("recalcula los destinos al cambiar de origen, respetando el sentido y las rutas activas", () => {
    queries.rutas.data = [
      { puerto_origen_id: "SHA", puerto_destino_id: "MZT", activa: true },
      { puerto_origen_id: "SHA", puerto_destino_id: "LZC", activa: false },
      { puerto_origen_id: "NGB", puerto_destino_id: "VER", activa: true },
    ];
    const { result, rerender } = renderHook(({ origen }) => usePuertosDeRutas(origen), {
      initialProps: { origen: "" },
    });
    expect(result.current.origenes.map((p) => p.id)).toEqual(["SHA", "NGB"]);
    expect(result.current.destinos).toEqual([]);

    rerender({ origen: "SHA" });
    expect(result.current.destinos.map((p) => p.id)).toEqual(["MZT"]);
    rerender({ origen: "NGB" });
    expect(result.current.destinos.map((p) => p.id)).toEqual(["VER"]);
    rerender({ origen: "MZT" });
    expect(result.current.destinos).toEqual([]);
    expect(result.current.sinRutas).toBe(false);
  });

  it("actualiza las opciones al refrescar rutas y catálogo sin cambiar el origen", () => {
    queries.rutas.data = [{ puerto_origen_id: "SHA", puerto_destino_id: "MZT", activa: true }];
    const { result, rerender } = renderHook(() => usePuertosDeRutas("SHA"));
    expect(result.current.destinos.map((p) => p.id)).toEqual(["MZT"]);

    queries.rutas.data = [
      { puerto_origen_id: "SHA", puerto_destino_id: "LZC", activa: null },
      { puerto_origen_id: "SHA", puerto_destino_id: "LZC" },
      { puerto_origen_id: "SHA", puerto_destino_id: "MZT", activa: false },
      { puerto_origen_id: "NGB", puerto_destino_id: "VER", activa: true },
    ];
    rerender();
    expect(result.current.origenes.map((p) => p.id)).toEqual(["SHA", "NGB"]);
    expect(result.current.destinos.map((p) => p.id)).toEqual(["LZC"]);

    const actualizado = { ...puerto("LZC"), code: "LZC-NUEVO", name: "Puerto actualizado" };
    queries.puertos.data = [puerto("VER"), actualizado, puerto("NGB"), puerto("SHA")];
    rerender();
    expect(result.current.origenes.map((p) => p.id)).toEqual(["NGB", "SHA"]);
    expect(result.current.destinos).toEqual([actualizado]);

    queries.puertos.data = [puerto("VER"), puerto("NGB"), puerto("SHA")];
    rerender();
    expect(result.current.destinos).toEqual([]);
    expect(result.current.origenes.map((p) => p.id)).toEqual(["NGB", "SHA"]);
  });

  it.each(fuentes)("espera los datos de %s antes de ofrecer opciones o declarar vacío", (fuente) => {
    datosDisponibles();
    queries[fuente].data = undefined;
    queries[fuente].isLoading = true;
    const { result, rerender } = renderHook(() => usePuertosDeRutas("SHA"));
    expect(result.current).toMatchObject({
      origenes: [], destinos: [], isLoading: true, isError: false, sinRutas: false,
    });

    // Una consulta pendiente o pausada puede no estar ejecutando su fetch.
    queries[fuente].isLoading = false;
    rerender();
    expect(result.current.isLoading).toBe(true);
    expect(result.current.sinRutas).toBe(false);
  });

  it.each(fuentes)("no usa ni reintenta %s cuando está deshabilitada, incluso con caché o error", async (fuente) => {
    datosDisponibles();
    queries[fuente].isEnabled = false;
    const { result, rerender } = renderHook(() => usePuertosDeRutas("SHA"));
    expect(result.current).toMatchObject({
      origenes: [], destinos: [], isLoading: true, isError: false, sinRutas: false,
    });

    queries[fuente].isError = true;
    rerender();
    expect(result.current).toMatchObject({
      origenes: [], destinos: [], isLoading: false, isError: true, sinRutas: false,
    });
    await act(async () => { await result.current.reintentar(); });
    expect(queries.rutas.refetch).not.toHaveBeenCalled();
    expect(queries.puertos.refetch).not.toHaveBeenCalled();
  });

  it.each(fuentes)("prioriza el error de %s sobre su caché y reintenta sólo esa fuente", async (fuente) => {
    datosDisponibles();
    queries[fuente].isError = true;
    const { result, rerender } = renderHook(() => usePuertosDeRutas("SHA"));
    expect(result.current).toMatchObject({
      origenes: [], destinos: [], isLoading: false, isError: true,
      isRetrying: false, actualizando: false, sinRutas: false,
    });

    await act(async () => { await result.current.reintentar(); });
    expect(queries[fuente].refetch).toHaveBeenCalledExactlyOnceWith({ cancelRefetch: false });
    const otra = fuente === "rutas" ? "puertos" : "rutas";
    expect(queries[otra].refetch).not.toHaveBeenCalled();

    queries[fuente].isFetching = true;
    rerender();
    expect(result.current.isRetrying).toBe(true);
    expect(result.current.actualizando).toBe(false);
    expect(result.current.origenes).toEqual([]);

    queries[fuente].isError = false;
    queries[fuente].isFetching = false;
    rerender();
    expect(result.current.isError).toBe(false);
    expect(result.current.isRetrying).toBe(false);
    expect(result.current.destinos.map((p) => p.id)).toEqual(["MZT"]);
  });

  it("reintenta ambas fuentes con error y omite la que deja de estar habilitada", async () => {
    datosDisponibles();
    queries.rutas.isError = true;
    queries.puertos.isError = true;
    queries.puertos.isFetching = true;
    const { result, rerender } = renderHook(() => usePuertosDeRutas("SHA"));
    expect(result.current).toMatchObject({
      origenes: [], destinos: [], isLoading: false, isError: true, isRetrying: true, sinRutas: false,
    });
    await act(async () => { await result.current.reintentar(); });
    expect(queries.rutas.refetch).toHaveBeenCalledExactlyOnceWith({ cancelRefetch: false });
    expect(queries.puertos.refetch).toHaveBeenCalledExactlyOnceWith({ cancelRefetch: false });

    queries.rutas.isEnabled = false;
    queries.puertos.isFetching = false;
    queries.rutas.refetch.mockClear();
    queries.puertos.refetch.mockClear();
    rerender();
    expect(result.current.isRetrying).toBe(false);
    await act(async () => { await result.current.reintentar(); });
    expect(queries.rutas.refetch).not.toHaveBeenCalled();
    expect(queries.puertos.refetch).toHaveBeenCalledExactlyOnceWith({ cancelRefetch: false });
  });

  it("sólo declara vacío cuando ambas fuentes están disponibles y no hay orígenes elegibles", () => {
    const { result, rerender } = renderHook(() => usePuertosDeRutas("SHA"));
    expect(result.current).toMatchObject({
      origenes: [], destinos: [], isLoading: false, isError: false, sinRutas: true,
    });

    queries.rutas.data = [{ puerto_origen_id: "SHA", puerto_destino_id: "MZT", activa: false }];
    rerender();
    expect(result.current.sinRutas).toBe(true);

    datosDisponibles();
    rerender();
    expect(result.current.sinRutas).toBe(false);
    expect(result.current.destinos.map((p) => p.id)).toEqual(["MZT"]);

    queries.puertos.data = [];
    rerender();
    expect(result.current.isLoading).toBe(false);
    expect(result.current.sinRutas).toBe(true);
  });

  it.each(fuentes)("conserva opciones durante un refresco sano de %s sin habilitar un retry innecesario", async (fuente) => {
    datosDisponibles();
    queries[fuente].isFetching = true;
    const { result, rerender } = renderHook(() => usePuertosDeRutas("SHA"));
    expect(result.current).toMatchObject({
      isLoading: false, isError: false, isRetrying: false, actualizando: true, sinRutas: false,
    });
    expect(result.current.origenes.map((p) => p.id)).toEqual(["SHA"]);
    expect(result.current.destinos.map((p) => p.id)).toEqual(["MZT"]);
    await act(async () => { await result.current.reintentar(); });
    expect(queries.rutas.refetch).not.toHaveBeenCalled();
    expect(queries.puertos.refetch).not.toHaveBeenCalled();

    queries[fuente].isFetching = false;
    rerender();
    expect(result.current.actualizando).toBe(false);
    expect(result.current.destinos.map((p) => p.id)).toEqual(["MZT"]);
  });
});
