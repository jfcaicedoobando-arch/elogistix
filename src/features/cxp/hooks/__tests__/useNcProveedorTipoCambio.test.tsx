import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createWrapper } from "@/test/utils/queryWrapper";
import { fetchTcDofPorFecha, type TcDofVigente } from "@/features/catalogos/services/tipoCambioDof";
import { useNcProveedorTipoCambio } from "../useNcProveedorTipoCambio";

vi.mock("@/features/catalogos/services/tipoCambioDof", () => ({ fetchTcDofPorFecha: vi.fn() }));
const consultar = vi.mocked(fetchTcDofPorFecha);
const opciones = {
  open: true, fecha: "2026-10-03", moneda: "MXN", monedaFactura: "USD", tipoCambio: "",
} as const;
const dof: TcDofVigente = { usdMxn: 18.1903, eurMxn: 21.1, fecha: "2026-10-02", exacto: false };

function diferido<T>() {
  let resolver!: (value: T) => void;
  const promise = new Promise<T>((resolve) => { resolver = resolve; });
  return { promise, resolver };
}

beforeEach(() => { consultar.mockReset(); });

describe("TC efectivo de la nota de crédito de proveedor", () => {
  it.each(["0.5", "1", "20"])("respeta el TC explícito %s sin consultar DOF", (tipoCambio) => {
    const { result } = renderHook(() => useNcProveedorTipoCambio({ ...opciones, tipoCambio }), { wrapper: createWrapper() });
    expect(result.current).toMatchObject({ tipoCambio: Number(tipoCambio), disponible: true, fuente: "manual", aviso: null });
    expect(consultar).not.toHaveBeenCalled();
  });

  it.each(["0", "-2", "Infinity"])("bloquea TC explícito %s en vez de sustituirlo por DOF", (tipoCambio) => {
    const { result } = renderHook(() => useNcProveedorTipoCambio({ ...opciones, tipoCambio }), { wrapper: createWrapper() });
    expect(result.current).toMatchObject({ tipoCambio: null, disponible: false, fuente: null });
    expect(result.current.aviso).toMatch(/positivo/);
    expect(consultar).not.toHaveBeenCalled();
  });

  it("bloquea mientras carga DOF y conserva su fecha de publicación", async () => {
    const carga = diferido<TcDofVigente | null>();
    consultar.mockReturnValue(carga.promise);
    const { result } = renderHook(() => useNcProveedorTipoCambio(opciones), { wrapper: createWrapper() });
    expect(result.current.disponible).toBe(false);
    expect(result.current.aviso).toMatch(/Consultando/);
    expect(consultar).toHaveBeenCalledWith("2026-10-03");
    await act(async () => carga.resolver(dof));
    await waitFor(() => expect(result.current).toMatchObject({
      tipoCambio: 18.1903, disponible: true, fuente: "dof", fechaDof: "2026-10-02", aviso: null,
    }));
  });

  it("un error DOF no produce una conversión ni una consulta por otra fecha", async () => {
    consultar.mockRejectedValue(new Error("Consulta aislada fallida"));
    const { result } = renderHook(() => useNcProveedorTipoCambio(opciones), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.aviso).toMatch(/No se pudo consultar/));
    expect(result.current).toMatchObject({ tipoCambio: null, disponible: false });
    expect(consultar).toHaveBeenCalledTimes(1);
    expect(consultar).toHaveBeenCalledWith("2026-10-03");
  });

  it.each([
    { moneda: "MXN" as const, monedaFactura: "USD" as const, respuesta: null },
    { moneda: "EUR" as const, monedaFactura: "MXN" as const, respuesta: { ...dof, eurMxn: null } },
  ])("bloquea si falta la paridad de $moneda/$monedaFactura", async ({ moneda, monedaFactura, respuesta }) => {
    consultar.mockResolvedValue(respuesta);
    const { result } = renderHook(() => useNcProveedorTipoCambio({ ...opciones, moneda, monedaFactura }), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.aviso).toMatch(/No hay tipo de cambio/));
    expect(result.current).toMatchObject({ tipoCambio: null, disponible: false });
  });

  it("no conserva el TC de otra fecha ni acepta una respuesta tardía de esa fecha", async () => {
    const antigua = diferido<TcDofVigente | null>();
    const nueva = diferido<TcDofVigente | null>();
    consultar.mockImplementation((fecha) => fecha === "2026-10-03" ? antigua.promise : nueva.promise);
    const { result, rerender } = renderHook(({ fecha }) => useNcProveedorTipoCambio({ ...opciones, fecha }), {
      initialProps: { fecha: "2026-10-03" }, wrapper: createWrapper(),
    });
    rerender({ fecha: "2026-10-05" });
    await act(async () => antigua.resolver(dof));
    expect(result.current).toMatchObject({ tipoCambio: null, disponible: false });
    await act(async () => nueva.resolver({ ...dof, usdMxn: 19.25, fecha: "2026-10-05", exacto: true }));
    await waitFor(() => expect(result.current).toMatchObject({ tipoCambio: 19.25, fechaDof: "2026-10-05", disponible: true }));
    expect(consultar.mock.calls.map(([fecha]) => fecha)).toEqual(["2026-10-03", "2026-10-05"]);
  });

  it("una fecha nueva sin cotización bloquea aunque la fecha anterior ya tenga TC", async () => {
    const nueva = diferido<TcDofVigente | null>();
    consultar.mockImplementation((fecha) => fecha === "2026-10-03" ? Promise.resolve(dof) : nueva.promise);
    const { result, rerender } = renderHook(({ fecha }) => useNcProveedorTipoCambio({ ...opciones, fecha }), {
      initialProps: { fecha: "2026-10-03" }, wrapper: createWrapper(),
    });
    await waitFor(() => expect(result.current.disponible).toBe(true));
    rerender({ fecha: "2026-10-05" });
    expect(result.current).toMatchObject({ tipoCambio: null, disponible: false });
    await act(async () => nueva.resolver(null));
    await waitFor(() => expect(result.current.aviso).toMatch(/No hay tipo de cambio/));
  });

  it("en la misma moneda ignora un TC oculto y no consulta DOF", () => {
    const { result } = renderHook(() => useNcProveedorTipoCambio({ ...opciones, moneda: "USD", tipoCambio: "-1" }), { wrapper: createWrapper() });
    expect(result.current).toMatchObject({ tipoCambio: null, disponible: true, fuente: null, aviso: null });
    expect(consultar).not.toHaveBeenCalled();
  });

  it("no consulta ni habilita un cruce USD/EUR", () => {
    const { result } = renderHook(() => useNcProveedorTipoCambio({ ...opciones, moneda: "EUR", tipoCambio: "20" }), { wrapper: createWrapper() });
    expect(result.current.disponible).toBe(false);
    expect(consultar).not.toHaveBeenCalled();
  });
});
