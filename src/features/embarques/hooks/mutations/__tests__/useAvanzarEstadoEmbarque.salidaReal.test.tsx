import { act, renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { type PropsWithChildren } from "react";
import { describe, expect, it, vi } from "vitest";
import { useAvanzarEstadoEmbarque } from "../useEstadoEmbarqueBasico";

const { avanzar } = vi.hoisted(() => ({ avanzar: vi.fn().mockResolvedValue({}) }));
vi.mock("@/features/embarques/services", () => ({
  avanzarEstadoEmbarqueRpc: avanzar,
  reabrirEmbarqueRpc: vi.fn(),
}));

describe("avance manual de salida", () => {
  it("envía una RPC con fuente manual, usuario y llave explícita", async () => {
    const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    const wrapper = ({ children }: PropsWithChildren) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
    const { result, unmount } = renderHook(() => useAvanzarEstadoEmbarque(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync({ embarqueId: "s09", nuevoEstado: "En Tránsito", usuarioEmail: "operador@example.test", requestId: "salida-confirmada-1" });
    });
    expect(avanzar).toHaveBeenCalledExactlyOnceWith({
      embarqueId: "s09", nuevoEstado: "En Tránsito", usuarioEmail: "operador@example.test",
      tipoEvento: "Zarpe", descripcionEvento: "Salida real confirmada por el operador (hora de confirmación)",
      requestId: "salida-confirmada-1",
    });
    unmount();
    client.clear();
  });
});
