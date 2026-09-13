/**
 * v13.823.349 — `exportar` no tenía candado in-flight: dos clics seguidos
 * disparaban dos cargas completas (y dos descargas), y un fallo de red quedaba
 * como promesa rechazada sin ningún aviso al usuario.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";

const mocks = vi.hoisted(() => ({
  exportToCsv: vi.fn(),
  notifyError: vi.fn(),
}));

vi.mock("react-router-dom", () => ({ useNavigate: () => vi.fn() }));
vi.mock("@/features/cotizacion/hooks/useCotizaciones", () => ({
  useDeleteCotizacion: () => ({ mutateAsync: vi.fn(), isPending: false }),
  usePrefetchCotizacion: () => vi.fn(),
}));
vi.mock("@/generators/exportCsv", () => ({ exportToCsv: mocks.exportToCsv }));
vi.mock("@/lib/ui/appFeedback", () => ({
  notifyError: mocks.notifyError,
  notifySuccess: vi.fn(),
}));

import { useCotizacionActions } from "../useCotizacionActions";

describe("useCotizacionActions.exportar", () => {
  beforeEach(() => vi.clearAllMocks());

  it("ignora el segundo clic mientras la carga está en vuelo", async () => {
    let resolver: (v: []) => void = () => {};
    const cargar = vi.fn(() => new Promise<[]>((r) => { resolver = r; }));
    const { result } = renderHook(() => useCotizacionActions());

    await act(async () => {
      void result.current.exportar(cargar);
      void result.current.exportar(cargar);
    });
    expect(cargar).toHaveBeenCalledTimes(1);
    expect(result.current.exportando).toBe(true);

    await act(async () => { resolver([]); });
    await waitFor(() => expect(result.current.exportando).toBe(false));
    expect(mocks.exportToCsv).toHaveBeenCalledTimes(1);
  });

  it("avisa al usuario cuando la carga falla y libera el candado", async () => {
    const { result } = renderHook(() => useCotizacionActions());
    await act(async () => {
      await result.current.exportar(() => Promise.reject(new Error("sin red")));
    });
    expect(mocks.notifyError).toHaveBeenCalledTimes(1);
    expect(mocks.exportToCsv).not.toHaveBeenCalled();
    expect(result.current.exportando).toBe(false);
  });
});
