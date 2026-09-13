/**
 * v13.823.348 — Dos fallos de diálogo:
 *  1. `abrirDialogConvertir` reventaba la promesa si la precarga fiscal falla:
 *     el usuario se quedaba sin modal y sin mensaje.
 *  2. `confirmarEliminar` cerraba el diálogo incluso cuando la eliminación
 *     fallaba, ocultando el error y obligando a rebuscar la cotización.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

const { mutateAsync, fetchFiscales, notifyError } = vi.hoisted(() => ({
  mutateAsync: vi.fn(),
  fetchFiscales: vi.fn(),
  notifyError: vi.fn(),
}));

vi.mock("react-router-dom", () => ({ useNavigate: () => vi.fn() }));
vi.mock("@/features/cotizacion/hooks/useCotizaciones", () => ({
  useDeleteCotizacion: () => ({ mutateAsync, isPending: false }),
  usePrefetchCotizacion: () => vi.fn(),
  useConvertirProspectoACliente: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));
vi.mock("@/features/cotizacion/services/datosFiscalesProspecto", () => ({
  fetchDatosFiscalesProspecto: fetchFiscales,
}));
vi.mock("@/lib/ui/appFeedback", () => ({ notifyError }));

import { useCotizacionActions } from "@/features/cotizacion/hooks/useCotizacionActions";
import { useConvertirProspectoHandlers } from "@/features/cotizacion/hooks/useConvertirProspectoHandlers";

beforeEach(() => {
  mutateAsync.mockReset();
  fetchFiscales.mockReset();
  notifyError.mockReset();
});

describe("confirmarEliminar", () => {
  it("cierra el diálogo cuando la eliminación tiene éxito", async () => {
    mutateAsync.mockResolvedValue(undefined);
    const { result } = renderHook(() => useCotizacionActions());
    act(() => result.current.setCotizacionAEliminar("cot-1"));
    await act(async () => { await result.current.confirmarEliminar(); });
    expect(result.current.cotizacionAEliminar).toBeNull();
  });

  it("conserva el diálogo abierto cuando la eliminación falla (reintento)", async () => {
    mutateAsync.mockRejectedValue(new Error("42501"));
    const { result } = renderHook(() => useCotizacionActions());
    act(() => result.current.setCotizacionAEliminar("cot-1"));
    await act(async () => { await result.current.confirmarEliminar(); });
    expect(result.current.cotizacionAEliminar).toBe("cot-1");
  });
});

const cotizacion = {
  id: "cot-1",
  oportunidad_id: "op-1",
  prospecto_empresa: "Chino SA",
  prospecto_contacto: "Ana",
  prospecto_email: "ana@chino.com",
  prospecto_telefono: "5555555555",
};

describe("abrirDialogConvertir", () => {
  it("abre el modal con datos básicos y avisa cuando falla la precarga fiscal", async () => {
    fetchFiscales.mockRejectedValue(new Error("network"));
    const { result } = renderHook(() =>
      // SAFE-CAST: el handler sólo lee los campos del prospecto declarados arriba.
      useConvertirProspectoHandlers(cotizacion as never),
    );
    await act(async () => { await result.current.abrirDialogConvertir(); });
    expect(result.current.showConvertir).toBe(true);
    expect(result.current.clienteForm.nombre).toBe("Chino SA");
    expect(notifyError).toHaveBeenCalledTimes(1);
  });

  it("precarga los datos fiscales cuando la consulta responde", async () => {
    fetchFiscales.mockResolvedValue({ rfc: "XAXX010101000" });
    const { result } = renderHook(() =>
      useConvertirProspectoHandlers(cotizacion as never),
    );
    await act(async () => { await result.current.abrirDialogConvertir(); });
    expect(result.current.clienteForm.rfc).toBe("XAXX010101000");
    expect(notifyError).not.toHaveBeenCalled();
  });
});
