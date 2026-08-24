/**
 * Ola 2 · O2.8 — el auto-sync de estado debe viajar por la RPC
 * `avanzar_estado_embarque` (candado de documentos incluido) y no escribir
 * directo en la tabla. Los rechazos esperados del candado no son errores.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import React from "react";

const avanzarMock = vi.fn().mockResolvedValue(undefined);

vi.mock("@/features/embarques/services", () => ({
  avanzarEstadoEmbarqueRpc: (...args: unknown[]) => avanzarMock(...args),
  reabrirEmbarqueRpc: vi.fn().mockResolvedValue(undefined),
}));

import { useSyncEstadoEmbarque } from "../useEstadoEmbarque";

const EMB = "11111111-1111-4111-8111-111111111111";

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return React.createElement(QueryClientProvider, { client }, children);
}

describe("useSyncEstadoEmbarque (O2.8)", () => {
  beforeEach(() => {
    avanzarMock.mockClear();
    avanzarMock.mockResolvedValue(undefined);
  });

  it("usa la RPC de avance con requestId estable por transición", async () => {
    const { result } = renderHook(() => useSyncEstadoEmbarque(), { wrapper });
    result.current.mutate({ embarqueId: EMB, nuevoEstado: "En Tránsito", usuarioEmail: "a@b.mx" });
    await waitFor(() => expect(avanzarMock).toHaveBeenCalledTimes(1));

    const primera = avanzarMock.mock.calls[0][0];
    expect(primera.embarqueId).toBe(EMB);
    expect(primera.nuevoEstado).toBe("En Tránsito");
    expect(primera.requestId).toBeTruthy();

    result.current.mutate({ embarqueId: EMB, nuevoEstado: "En Tránsito", usuarioEmail: "a@b.mx" });
    await waitFor(() => expect(avanzarMock).toHaveBeenCalledTimes(2));
    expect(avanzarMock.mock.calls[1][0].requestId).toBe(primera.requestId);
  });

  it("no falla cuando el candado de documentos rechaza el avance", async () => {
    avanzarMock.mockRejectedValueOnce(new Error("documentos_faltantes: BL, DODA"));
    const { result } = renderHook(() => useSyncEstadoEmbarque(), { wrapper });
    result.current.mutate({ embarqueId: EMB, nuevoEstado: "Arribo", usuarioEmail: "a@b.mx" });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.isError).toBe(false);
  });

  it("propaga errores inesperados", async () => {
    avanzarMock.mockRejectedValueOnce(new Error("boom"));
    const { result } = renderHook(() => useSyncEstadoEmbarque(), { wrapper });
    result.current.mutate({ embarqueId: EMB, nuevoEstado: "Arribo", usuarioEmail: "a@b.mx" });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });

  it("M-3: ante replay cacheado invalida la llave y reintenta con requestId fresco", async () => {
    // Primera transición real (sin replay): la llave queda en el Map.
    avanzarMock.mockResolvedValueOnce({ replay: false, pendiente: false });
    const { result } = renderHook(() => useSyncEstadoEmbarque(), { wrapper });
    result.current.mutate({ embarqueId: EMB, nuevoEstado: "Cerrado", usuarioEmail: "a@b.mx" });
    await waitFor(() => expect(avanzarMock).toHaveBeenCalledTimes(1));
    const llaveInicial = (avanzarMock.mock.calls[0][0] as { requestId: string }).requestId;

    // Tras reabrir, el auto-sync sugiere la MISMA transición: la RPC responde
    // replay=true (respuesta cacheada, sin ejecutar) con la llave vieja…
    avanzarMock
      .mockResolvedValueOnce({ replay: true, pendiente: false })
      .mockResolvedValueOnce({ replay: false, pendiente: false });
    result.current.mutate({ embarqueId: EMB, nuevoEstado: "Cerrado", usuarioEmail: "a@b.mx" });
    await waitFor(() => expect(avanzarMock).toHaveBeenCalledTimes(3));

    // …y el hook reintenta con una llave NUEVA para que el avance se ejecute.
    const llamadaReplay = avanzarMock.mock.calls[1][0] as { requestId: string };
    const llamadaReintento = avanzarMock.mock.calls[2][0] as { requestId: string };
    expect(llamadaReplay.requestId).toBe(llaveInicial);
    expect(llamadaReintento.requestId).not.toBe(llaveInicial);
  });
});
