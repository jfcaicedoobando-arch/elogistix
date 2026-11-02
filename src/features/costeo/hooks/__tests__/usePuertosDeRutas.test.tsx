import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { usePuertosDeRutas } from "../usePuertosDeRutas";
import type { RutaPuertos } from "../../utils/puertosDeRutas";

type Puerto = { id: string; code: string; name: string; country: string };
const queries = vi.hoisted(() => ({
  rutas: { data: undefined as RutaPuertos[] | undefined, isLoading: false },
  puertos: { data: undefined as Puerto[] | undefined },
}));

vi.mock("@/features/costeo/hooks/useCosteoRutas", () => ({
  useCosteoRutas: () => queries.rutas,
}));
vi.mock("@/features/catalogos/hooks", () => ({
  usePuertos: () => queries.puertos,
}));

const puerto = (id: string): Puerto => ({ id, code: id, name: id, country: "MX" });
const catalogo = () => [puerto("VER"), puerto("SHA"), puerto("LZC"), puerto("MZT"), puerto("NGB")];

beforeEach(() => {
  queries.rutas = { data: [], isLoading: false };
  queries.puertos = { data: catalogo() };
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

  it("distingue carga de ausencia de rutas elegibles y tolera datos aún no recibidos", () => {
    queries.rutas = { data: undefined, isLoading: true };
    queries.puertos = { data: undefined };
    const { result, rerender } = renderHook(() => usePuertosDeRutas("SHA"));
    expect(result.current).toEqual({ origenes: [], destinos: [], isLoading: true, sinRutas: false });

    queries.rutas = { data: [], isLoading: false };
    queries.puertos = { data: catalogo() };
    rerender();
    expect(result.current.sinRutas).toBe(true);
    expect(result.current.isLoading).toBe(false);

    queries.rutas.data = [{ puerto_origen_id: "SHA", puerto_destino_id: "MZT", activa: false }];
    rerender();
    expect(result.current.sinRutas).toBe(true);
    expect(result.current.destinos).toEqual([]);

    queries.rutas.data = [{ puerto_origen_id: "SHA", puerto_destino_id: "MZT", activa: true }];
    rerender();
    expect(result.current.sinRutas).toBe(false);
    expect(result.current.destinos.map((p) => p.id)).toEqual(["MZT"]);
  });
});
