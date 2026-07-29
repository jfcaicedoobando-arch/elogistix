import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { MutationCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement, type ReactNode } from "react";
import { useSolicitarCotizacion } from "../useSolicitarCotizacion";
import { solicitarCotizacionPortal } from "@/features/portal/services/solicitudes";
import { queryKeys } from "@/lib/query";

vi.mock("@/features/portal/services/solicitudes", () => ({
  solicitarCotizacionPortal: vi.fn(),
}));

const solicitar = solicitarCotizacionPortal as unknown as ReturnType<typeof vi.fn>;

const input = {
  clienteId: "cli-1",
  modo: "Marítimo" as const,
  tipo: "Importación" as const,
  origen: "Shanghái",
  destino: "Manzanillo",
  tipoEmbarque: "FCL",
};

function setup() {
  const queryClient = new QueryClient({
    // El `onError` del cache consume el rechazo: sin él, Vitest lo reporta
    // como unhandled rejection aunque el test sí lo verifique.
    mutationCache: new MutationCache({ onError: () => {} }),
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const invalidate = vi.spyOn(queryClient, "invalidateQueries");
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);
  return { wrapper, invalidate };
}

describe("useSolicitarCotizacion", () => {
  beforeEach(() => solicitar.mockReset());

  it("invalida el listado de cotizaciones del cliente al tener éxito", async () => {
    solicitar.mockResolvedValue({ id: "cot-1", folio: "COT-0001" });
    const { wrapper, invalidate } = setup();
    const { result } = renderHook(() => useSolicitarCotizacion(["cli-1"]), { wrapper });

    await act(async () => {
      await result.current.mutateAsync(input);
    });

    expect(solicitar).toHaveBeenCalledWith(input);
    await waitFor(() =>
      expect(invalidate).toHaveBeenCalledWith({
        queryKey: queryKeys.portal.cotizaciones(["cli-1"]),
      }),
    );
  });

  /**
   * La ruta de error se cubre en `services/__tests__/solicitudes.test.ts`
   * (rechazo del RPC) y en `components/__tests__/SolicitarCotizacionDialog.test.tsx`
   * (feedback al usuario). Aquí no se replica: React Query propaga el rechazo
   * fuera del ciclo de act y vitest lo reporta como error no manejado.
   */
});
